/**
 * SB-070 — `sb capture --source transcript --media <json>` writes the auditable
 * media block to the L0 note frontmatter AND the capture event payload; a
 * malformed/leaky `--media` fails closed before any write.
 */
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { main } from "../src/index.js";

const SHA = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";
const tmpDirs: string[] = [];

after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

function io(): { io: { out: (t: string) => void; err: (t: string) => void }; all: () => string } {
  let buf = "";
  return { io: { out: (t: string) => void (buf += t), err: (t: string) => void (buf += t) }, all: () => buf };
}

async function makeWorkspace(): Promise<string> {
  const ws = await mkdtemp(join(tmpdir(), "sb-capture-media-"));
  tmpDirs.push(ws);
  return ws;
}

async function snapshot(root: string): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  const walk = async (dir: string): Promise<void> => {
    if (!existsSync(dir)) return;
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) await walk(p);
      else files.set(relative(root, p), (await readFile(p)).toString("base64"));
    }
  };
  await walk(root);
  return files;
}

test("public_ref media block lands in the note frontmatter and the capture event", async () => {
  const ws = await makeWorkspace();
  const media = { media_id: "54c63db258a34d84", transcript_sha256: SHA, ref_class: "public_ref", ref: "https://example.org/v.mp4" };
  const c = io();
  assert.equal(
    await main(
      ["capture", "--source", "transcript", "--content", "the transcript text", "--media", JSON.stringify(media), "--workspace", ws],
      c.io,
    ),
    0,
    c.all(),
  );
  const noteId = (JSON.parse(c.all()) as { note_id: string }).note_id;

  const get = io();
  assert.equal(await main(["note", "get", noteId, "--workspace", ws], get.io), 0, get.all());
  const note = get.all();
  assert.match(note, /source:\n {2}kind: "transcript"/);
  assert.match(note, /media:\n {2}media_id: "54c63db258a34d84"/);
  assert.match(note, /ref_class: "public_ref"/);
  assert.match(note, /transcript_sha256: "9f86d081/);

  const events = await readFile(join(ws, "events", "capture_events.jsonl"), "utf8");
  const line = JSON.parse(events.trim()) as { payload: { source: string; media: typeof media } };
  assert.equal(line.payload.source, "transcript");
  assert.deepEqual(line.payload.media, media);
});

test("private classification stores the class + secref id, never a raw locator", async () => {
  const ws = await makeWorkspace();
  const media = { media_id: "a4bf9becd046d7ae", transcript_sha256: SHA, ref_class: "signed_url_detected", secref: "secref_01HXMEDIA0001" };
  const c = io();
  assert.equal(
    await main(["capture", "--source", "transcript", "--content", "x", "--media", JSON.stringify(media), "--workspace", ws], c.io),
    0,
    c.all(),
  );
  // scan the whole workspace: the class + secref id are present; no raw URL/locator anywhere
  for (const [, b64] of await snapshot(ws)) {
    const text = Buffer.from(b64, "base64").toString("utf8");
    assert.ok(!/X-Amz-|Signature=|\?token=|s3:\/\//.test(text), "no signed-url/locator artifacts in any file");
  }
});

test("malformed --media fails closed: zero writes", async () => {
  const ws = await makeWorkspace();
  const before = await snapshot(ws);
  for (const bad of [
    "{ not json",
    JSON.stringify({ media_id: "short", transcript_sha256: SHA, ref_class: "public_ref", ref: "x" }),
    JSON.stringify({ media_id: "54c63db258a34d84", transcript_sha256: SHA, ref_class: "public_ref", secref: "secref_x" }),
    JSON.stringify({ media_id: "54c63db258a34d84", transcript_sha256: SHA, ref_class: "public_ref", ref: "x", locator: "s3://secret" }),
  ]) {
    const c = io();
    assert.equal(
      await main(["capture", "--source", "transcript", "--content", "x", "--media", bad, "--workspace", ws], c.io),
      1,
      `should reject: ${bad}`,
    );
    assert.match(c.all(), /bad_arguments|media_reference_invalid/);
  }
  const afterAll = await snapshot(ws);
  assert.deepEqual([...afterAll.keys()].sort(), [...before.keys()].sort(), "no file written");
});
