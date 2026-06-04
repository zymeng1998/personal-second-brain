/**
 * Tests for the SB-013 `capture` command. End-to-end against TEMP workspaces
 * only: each capture writes one raw note + one capture event. Built-in test
 * runner; IO is injected for the stdin/exit-code paths.
 */
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { CaptureCliError, runCapture } from "../src/capture-command.js";
import { main } from "../src/index.js";

const ULID_FILE = /^[0-7][0-9A-HJKMNP-TV-Z]{25}(--[A-Za-z0-9._-]+)?\.md$/;

const tmpDirs: string[] = [];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "sb-cli-"));
  tmpDirs.push(dir);
  return dir;
}

async function rawFiles(ws: string): Promise<string[]> {
  return readdir(join(ws, "vault", "00_Raw"));
}

async function eventLines(ws: string): Promise<string[]> {
  const text = await readFile(join(ws, "events", "capture_events.jsonl"), "utf8");
  return text.split("\n").filter((l) => l.length > 0);
}

after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

test("--content creates exactly one raw note and one capture event", async () => {
  const ws = await makeWorkspace();
  const result = await runCapture({ workspace: ws, content: "hello world", source: "paste" });

  assert.equal(result.ok, true);
  const files = await rawFiles(ws);
  assert.equal(files.length, 1);
  assert.match(files[0]!, ULID_FILE);

  const lines = await eventLines(ws);
  assert.equal(lines.length, 1);
  const event = JSON.parse(lines[0]!);
  assert.equal(event.stream, "capture");
  assert.equal(event.kind, "captured");
  assert.equal(event.event_id, result.event_id);
  assert.equal(event.subject_id, result.note_id);
});

test("stdin capture creates one raw note and one capture event", async () => {
  const ws = await makeWorkspace();
  let stdout = "";
  const code = await main(["capture", "--source", "paste", "--workspace", ws], {
    stdin: Readable.from("hello from stdin"),
    out: (t) => {
      stdout += t;
    },
    err: () => {},
  });
  assert.equal(code, 0);
  const result = JSON.parse(stdout);
  assert.equal(result.ok, true);
  assert.equal((await rawFiles(ws)).length, 1);
  assert.equal((await eventLines(ws)).length, 1);
  const body = await readFile(result.note_path, "utf8");
  assert.ok(body.endsWith("hello from stdin"), "stdin content stored verbatim");
});

test("missing content and empty stdin returns a clear error (exit 1)", async () => {
  const ws = await makeWorkspace();
  let stderr = "";
  const code = await main(["capture", "--source", "paste", "--workspace", ws], {
    stdin: Readable.from(""),
    out: () => {},
    err: (t) => {
      stderr += t;
    },
  });
  assert.equal(code, 1);
  assert.equal(JSON.parse(stderr).error.code, "empty_content");
});

test("invalid source is rejected", async () => {
  const ws = await makeWorkspace();
  await assert.rejects(
    () => runCapture({ workspace: ws, content: "x", source: "broker" }),
    (err: unknown) => err instanceof CaptureCliError && err.code === "invalid_source",
  );
});

test("unsafe (relative) workspace path is rejected", async () => {
  await assert.rejects(
    () => runCapture({ workspace: "relative/workspace", content: "x", source: "paste" }),
    (err: unknown) => err instanceof CaptureCliError && err.code === "unsafe_workspace",
  );
});

test("optional slug produces <ULID>--<slug>.md", async () => {
  const ws = await makeWorkspace();
  const result = await runCapture({ workspace: ws, content: "x", source: "paste", slug: "meeting-jot" });
  assert.ok(result.note_path.endsWith("--meeting-jot.md"));
  const files = await rawFiles(ws);
  assert.ok(files.some((f) => f.endsWith("--meeting-jot.md")));
});

test("body preserves raw content verbatim", async () => {
  const ws = await makeWorkspace();
  const content = "Verbatim line one.\nLine two with: a colon.";
  const result = await runCapture({ workspace: ws, content, source: "paste" });
  const text = await readFile(result.note_path, "utf8");
  assert.ok(text.endsWith(content), "raw body must be byte-faithful");
});

test("event payload references the created raw note", async () => {
  const ws = await makeWorkspace();
  const result = await runCapture({
    workspace: ws,
    content: "x",
    source: "paste",
    title: "Kickoff",
    tags: ["a", "b"],
    ref: "https://example.test/msg/1",
  });
  const event = JSON.parse((await eventLines(ws)).at(-1)!);
  assert.equal(event.subject_id, result.note_id);
  assert.equal(event.payload.note_id, result.note_id);
  assert.equal(event.payload.source, "paste");
  assert.ok(String(event.payload.note_path).includes("00_Raw"));
  assert.deepEqual(event.payload.tags, ["a", "b"]);
});

test("captured artifacts contain no broker/domain fields", async () => {
  const ws = await makeWorkspace();
  const result = await runCapture({ workspace: ws, content: "hello", source: "paste" });
  const note = await readFile(result.note_path, "utf8");
  const events = await readFile(result.event_path, "utf8");
  assert.doesNotMatch(note + events, /broker|landlord|commission|rental/i);
});
