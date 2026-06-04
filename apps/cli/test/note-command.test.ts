/**
 * Tests for the SB-015 read-only `note list` / `note get` commands. Seeds a note
 * via runCapture, then exercises the commands through main(). Temp workspaces only.
 */
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { runCapture } from "../src/capture-command.js";
import { main } from "../src/index.js";

const ABSENT = "01KT6ZZZZZZZZZZZZZZZZZZZZZ";

const tmpDirs: string[] = [];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "sb-note-cmd-"));
  tmpDirs.push(dir);
  return dir;
}

after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

test("`note list` enumerates captured notes (id shown)", async () => {
  const ws = await makeWorkspace();
  const captured = await runCapture({ workspace: ws, content: "hello", source: "paste", title: "Greeting" });

  let stdout = "";
  const code = await main(["note", "list", "--workspace", ws], { out: (t) => (stdout += t), err: () => {} });
  assert.equal(code, 0);
  assert.ok(stdout.includes(captured.note_id), "list output includes the note id");
  assert.ok(stdout.includes("raw"), "list output includes the type");
});

test("`note get <id>` prints the note content", async () => {
  const ws = await makeWorkspace();
  const captured = await runCapture({ workspace: ws, content: "hello body text", source: "paste" });

  let stdout = "";
  const code = await main(["note", "get", captured.note_id, "--workspace", ws], { out: (t) => (stdout += t), err: () => {} });
  assert.equal(code, 0);
  assert.ok(stdout.includes("hello body text"), "get prints the raw body");
  assert.ok(stdout.includes("type: raw"));
});

test("`note get` without an id errors (exit 1)", async () => {
  const ws = await makeWorkspace();
  let stderr = "";
  const code = await main(["note", "get", "--workspace", ws], { out: () => {}, err: (t) => (stderr += t) });
  assert.equal(code, 1);
  assert.equal(JSON.parse(stderr).error.code, "bad_arguments");
});

test("`note get` with an absent id reports not_found (exit 1)", async () => {
  const ws = await makeWorkspace();
  await runCapture({ workspace: ws, content: "x", source: "paste" });
  let stderr = "";
  const code = await main(["note", "get", ABSENT, "--workspace", ws], { out: () => {}, err: (t) => (stderr += t) });
  assert.equal(code, 1);
  assert.equal(JSON.parse(stderr).error.code, "not_found");
});

test("read commands never write (raw count + event lines unchanged)", async () => {
  const ws = await makeWorkspace();
  const captured = await runCapture({ workspace: ws, content: "x", source: "paste" });

  const rawBefore = (await readdir(join(ws, "vault", "00_Raw"))).length;
  const eventsBefore = (await readFile(join(ws, "events", "capture_events.jsonl"), "utf8")).split("\n").filter(Boolean).length;

  await main(["note", "list", "--workspace", ws], { out: () => {}, err: () => {} });
  await main(["note", "get", captured.note_id, "--workspace", ws], { out: () => {}, err: () => {} });

  const rawAfter = (await readdir(join(ws, "vault", "00_Raw"))).length;
  const eventsAfter = (await readFile(join(ws, "events", "capture_events.jsonl"), "utf8")).split("\n").filter(Boolean).length;
  assert.equal(rawAfter, rawBefore);
  assert.equal(eventsAfter, eventsBefore);
});
