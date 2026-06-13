/**
 * SB-085 — transcript ingest → L0 with STRICT idempotency (amendment A):
 * verbatim L0 capture (source:transcript) + media provenance; idempotent
 * re-ingest; media_id_conflict on differing transcript/reference; binary
 * refusal; no media binary in the vault; no locator leak.
 */
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { main as mediaMain } from "../src/index.js";
import { runIngest, IngestError } from "../src/ingest.js";
import { invoke } from "../src/invoke.js";

const tmpDirs: string[] = [];
after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

async function makeWorkspace(): Promise<string> {
  const ws = await mkdtemp(join(tmpdir(), "sb-ingest-ws-"));
  tmpDirs.push(ws);
  return ws;
}

/** A transcriber-style artifact dir: <root>/<media_id>/transcript.md (outside the workspace). */
async function makeArtifactDir(mediaId: string, transcript: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "sb-artifacts-"));
  tmpDirs.push(root);
  const dir = join(root, mediaId);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "transcript.md"), transcript, "utf8");
  return dir;
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

test("artifact-dir ingest → one L0 transcript note + capture event, with media provenance", async () => {
  const ws = await makeWorkspace();
  const dir = await makeArtifactDir("54c63db258a34d84", "Lecture one. The espresso ratio is 1:2.\n");
  const res = await runIngest({ workspace: ws, artifactDir: dir, mediaRef: "https://example.org/lec1.mp4" });
  assert.equal(res.idempotent, false);
  assert.equal(res.media_id, "54c63db258a34d84");

  const got = await invoke(["note", "get", res.note_id, "--workspace", ws]);
  assert.match(got.stdout, /source:\n {2}kind: "transcript"/);
  assert.match(got.stdout, /media_id: "54c63db258a34d84"/);
  assert.match(got.stdout, /ref_class: "public_ref"/);
  assert.match(got.stdout, /Lecture one\. The espresso ratio is 1:2\./);

  const events = await readFile(join(ws, "events", "capture_events.jsonl"), "utf8");
  assert.equal(events.split("\n").filter((l) => l.trim().length > 0).length, 1);
});

test("idempotent re-ingest: same media_id + transcript + reference ⇒ no-op, zero new writes", async () => {
  const ws = await makeWorkspace();
  const dir = await makeArtifactDir("a4bf9becd046d7ae", "Same content.\n");
  const first = await runIngest({ workspace: ws, artifactDir: dir, mediaRef: "https://example.org/v.mp4" });
  const before = await snapshot(ws);

  const second = await runIngest({ workspace: ws, artifactDir: dir, mediaRef: "https://example.org/v.mp4" });
  assert.equal(second.idempotent, true);
  assert.equal(second.note_id, first.note_id);

  const afterAll = await snapshot(ws);
  assert.deepEqual([...afterAll.keys()].sort(), [...before.keys()].sort(), "no new file");
  for (const [p, b] of before) assert.equal(afterAll.get(p), b, p);
});

test("media_id_conflict: same media_id, different transcript OR reference ⇒ fail closed, zero writes", async () => {
  const ws = await makeWorkspace();
  const dirA = await makeArtifactDir("deadbeefcafe0001", "Original transcript.\n");
  await runIngest({ workspace: ws, artifactDir: dirA, mediaRef: "https://example.org/v.mp4" });
  const before = await snapshot(ws);

  // different transcript content, same media_id
  const dirB = await makeArtifactDir("deadbeefcafe0001", "DIFFERENT transcript text.\n");
  await assert.rejects(
    runIngest({ workspace: ws, artifactDir: dirB, mediaRef: "https://example.org/v.mp4" }),
    (e: unknown) => e instanceof IngestError && e.code === "media_id_conflict",
  );
  // same transcript, DIFFERENT media reference
  await assert.rejects(
    runIngest({ workspace: ws, artifactDir: dirA, mediaRef: "https://example.org/OTHER.mp4" }),
    (e: unknown) => e instanceof IngestError && e.code === "media_id_conflict",
  );

  const afterAll = await snapshot(ws);
  assert.deepEqual([...afterAll.keys()].sort(), [...before.keys()].sort(), "conflict wrote nothing");
  for (const [p, b] of before) assert.equal(afterAll.get(p), b, p);
});

test("a media binary is refused and never read; the vault holds only transcript text", async () => {
  const ws = await makeWorkspace();
  const root = await mkdtemp(join(tmpdir(), "sb-bin-"));
  tmpDirs.push(root);
  await writeFile(join(root, "lecture.mov"), "FAKEBINARY", "utf8");
  await assert.rejects(
    runIngest({ workspace: ws, transcript: join(root, "lecture.mov"), mediaId: "abcd1234efgh5678", mediaRef: "https://x/y.mp4" }),
    (e: unknown) => e instanceof IngestError && e.code === "refused_binary",
  );
  // and a real ingest leaves no media-binary extension in the vault
  const dir = await makeArtifactDir("0011223344556677", "text only\n");
  await runIngest({ workspace: ws, artifactDir: dir, mediaRef: "https://x/y.mp4" });
  for (const p of (await snapshot(ws)).keys()) {
    assert.doesNotMatch(p, /\.(mov|mp4|wav|m4a|mp3|mkv|webm)$/i, `media binary in vault: ${p}`);
  }
});

test("private pointer ingest: media block stores class + secref id; the signed URL never leaks", async () => {
  const ws = await makeWorkspace();
  const dir = await makeArtifactDir("feedface00010002", "private source transcript\n");
  const SIGNED = "https://s3.amazonaws.com/b/lec.mov?X-Amz-Signature=LEAKSENTINEL42&X-Amz-Credential=AKIA";
  const res = await runIngest({ workspace: ws, artifactDir: dir, mediaSecref: SIGNED });
  const got = await invoke(["note", "get", res.note_id, "--workspace", ws]);
  assert.match(got.stdout, /ref_class: "signed_url_detected"/);
  assert.match(got.stdout, /secref: "secref_/);

  let sentinelFiles = 0;
  for (const [, b64] of await snapshot(ws)) {
    if (Buffer.from(b64, "base64").toString("utf8").includes("LEAKSENTINEL42")) sentinelFiles += 1;
  }
  assert.equal(sentinelFiles, 1, "the signed URL appears only inside the secref pointer file");
});

test("explicit --transcript + --media-id mode works; bad media_id is rejected", async () => {
  const ws = await makeWorkspace();
  const root = await mkdtemp(join(tmpdir(), "sb-txt-"));
  tmpDirs.push(root);
  const file = join(root, "t.txt");
  await writeFile(file, "plain text transcript\n", "utf8");
  const res = await runIngest({ workspace: ws, transcript: file, mediaId: "cafebabe99887766", mediaRef: "https://x/z.mp4" });
  assert.equal(res.idempotent, false);

  await assert.rejects(
    runIngest({ workspace: ws, transcript: file, mediaId: "bad id!", mediaRef: "https://x/z.mp4" }),
    (e: unknown) => e instanceof IngestError && e.code === "bad_media_id",
  );
});

test("the ingest CLI surfaces structured results + errors", async () => {
  const ws = await makeWorkspace();
  const dir = await makeArtifactDir("11aa22bb33cc44dd", "cli ingest\n");
  let buf = "";
  const io = { out: (t: string) => void (buf += t), err: (t: string) => void (buf += t) };
  assert.equal(await mediaMain(["ingest", "--artifact-dir", dir, "--media-ref", "https://x/c.mp4", "--workspace", ws], io), 0, buf);
  assert.match(buf, /"ok":true/);
  buf = "";
  assert.equal(await mediaMain(["ingest", "--workspace", ws], io), 1);
  assert.match(buf, /bad_arguments/);
});
