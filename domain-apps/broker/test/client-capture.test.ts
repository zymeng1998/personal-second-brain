/**
 * SB-090 — client-preference capture → L0 (`write:capture`).
 *  - with `write:capture`, capturing a synthetic client note (from a file and
 *    from inline text) writes exactly one L0 raw note + one capture event, body
 *    verbatim, readable back;
 *  - WITHOUT `write:capture` (read-only grant), capture is scope_denied with
 *    zero filesystem writes;
 *  - guardrails: a media-binary path is refused before any dispatch; the
 *    captured note is generically tagged (no broker note type).
 *
 * Synthetic data only (OQ #45): fictional client, sentinel contact handle.
 */
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { CaptureClientError, captureClientNote, getNote } from "../src/index.js";

const tmpDirs: string[] = [];
after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

async function freshWorkspace(allow: string[]): Promise<string> {
  const ws = await mkdtemp(join(tmpdir(), "sb-broker-capture-"));
  tmpDirs.push(ws);
  await mkdir(join(ws, "config"), { recursive: true });
  await writeFile(
    join(ws, "config", "grants.json"),
    JSON.stringify({ version: 1, grants: [{ app: "domain-app:broker", allow }] }, null, 2),
  );
  return ws;
}

/** Count `captured` events across the workspace event log(s). */
async function countCaptureEvents(ws: string): Promise<number> {
  const dir = join(ws, "events");
  if (!existsSync(dir)) return 0;
  let n = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;
    const text = await readFile(join(dir, entry.name), "utf8");
    for (const line of text.split("\n")) {
      if (line.trim().length === 0) continue;
      try {
        if ((JSON.parse(line) as { kind?: string }).kind === "captured") n++;
      } catch {
        /* ignore non-JSON lines */
      }
    }
  }
  return n;
}

async function snapshot(root: string): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  const walk = async (dir: string): Promise<void> => {
    if (!existsSync(dir)) return;
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else files.set(relative(root, path), (await readFile(path)).toString("base64"));
    }
  };
  await walk(root);
  return files;
}

const CLIENT_NOTE = [
  "Client A — rental brief",
  "Budget around 2000/month, 2 bedrooms, river district preferred, move-in next quarter.",
  "Reachable at wechat:REDACTED_SENTINEL (synthetic placeholder).",
].join("\n");

test("captures a client note from a FILE → one L0 + one capture event, verbatim", async () => {
  const ws = await freshWorkspace(["read:notes", "read:facts", "write:capture"]);
  const artifact = join(ws, "client-a-export.md");
  await writeFile(artifact, CLIENT_NOTE);

  const result = await captureClientNote({ workspace: ws, file: artifact, title: "Client A brief" });
  assert.equal(result.exitCode, 0, result.stderr);
  assert.ok(result.note_id, "a note id is returned");
  assert.equal(await countCaptureEvents(ws), 1, "exactly one capture event");

  const got = await getNote(ws, result.note_id as string);
  assert.equal(got.exitCode, 0, got.stderr);
  assert.ok(got.stdout.includes("river district preferred"), "body captured verbatim");
  assert.match(got.stdout, /type:\s*raw/, "captured as a generic L0 raw note");
  assert.match(got.stdout, /client-intake/, "generically tagged (no broker note type)");
});

test("captures a client note from inline TEXT", async () => {
  const ws = await freshWorkspace(["read:notes", "read:facts", "write:capture"]);
  const result = await captureClientNote({ workspace: ws, text: "Client B wants a studio near the metro" });
  assert.equal(result.exitCode, 0, result.stderr);
  const got = await getNote(ws, result.note_id as string);
  assert.ok(got.stdout.includes("studio near the metro"));
});

test("WITHOUT write:capture, capture is scope_denied with ZERO writes", async () => {
  const ws = await freshWorkspace(["read:notes", "read:facts"]);
  const before = await snapshot(ws);
  const result = await captureClientNote({ workspace: ws, text: "Client C brief" });
  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /scope_denied/);
  assert.match(result.stderr, /domain-app:broker/);
  assert.equal(await countCaptureEvents(ws), 0, "no capture event written");
  const after = await snapshot(ws);
  assert.deepEqual([...after.keys()].sort(), [...before.keys()].sort(), "no file created or deleted");
  for (const [path, bytes] of before) assert.equal(after.get(path), bytes, `byte change in ${path}`);
});

test("refuses a media binary BEFORE any dispatch (broker captures text only)", async () => {
  const ws = await freshWorkspace(["read:notes", "read:facts", "write:capture"]);
  const fakeVideo = join(ws, "tour.mp4");
  await writeFile(fakeVideo, "not really a video — guardrail is by extension");
  const before = await snapshot(ws);
  await assert.rejects(
    () => captureClientNote({ workspace: ws, file: fakeVideo }),
    (e: unknown) => e instanceof CaptureClientError && e.code === "refused_binary",
  );
  assert.equal(await countCaptureEvents(ws), 0, "no capture event written");
  const after = await snapshot(ws);
  assert.deepEqual([...after.keys()].sort(), [...before.keys()].sort(), "no file created or deleted");
});
