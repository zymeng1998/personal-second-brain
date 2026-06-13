/**
 * SB-086 — L1 reviewable bridge: `ingest --review` reuses the enforced
 * `note promote` to seed an L1 working note in 00_Inbox referencing the L0
 * transcript; the transcript enters the existing distill/review flow; the
 * provenance chain L1 → L0 → media_id → media reference resolves; the L0 stays
 * immutable; an idempotent re-ingest never duplicates the L1.
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { runIngest } from "../src/ingest.js";
import { invoke } from "../src/invoke.js";

const tmpDirs: string[] = [];
after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

async function makeWorkspace(): Promise<string> {
  const ws = await mkdtemp(join(tmpdir(), "sb-review-ws-"));
  tmpDirs.push(ws);
  return ws;
}

async function makeArtifactDir(mediaId: string, transcript: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "sb-review-art-"));
  tmpDirs.push(root);
  const dir = join(root, mediaId);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "transcript.md"), transcript, "utf8");
  return dir;
}

test("ingest --review seeds an L1 working note citing the L0; the chain resolves", async () => {
  const ws = await makeWorkspace();
  const dir = await makeArtifactDir("54c63db258a34d84", "Transcript for review.\n");
  const res = await runIngest({ workspace: ws, artifactDir: dir, mediaRef: "https://example.org/v.mp4", review: true });
  assert.ok(res.working_note_id, "an L1 working note was promoted");

  // the L1 working note lives in 00_Inbox and cites the L0 as source_ref
  const working = await invoke(["note", "get", res.working_note_id as string, "--workspace", ws]);
  assert.equal(working.exitCode, 0, working.stderr);
  assert.match(working.stdout, /type: working/);
  assert.match(working.stdout, new RegExp(`source_ref: ${res.note_id}`));

  // chain: L1.source_ref → L0; L0 carries media_id → the media reference
  const l0 = await invoke(["note", "get", res.note_id, "--workspace", ws]);
  assert.match(l0.stdout, /media_id: "54c63db258a34d84"/);
  assert.match(l0.stdout, /ref_class: "public_ref"/);

  // and the transcript is now a distill candidate (enters the existing flow)
  const propose = await invoke(["distill", "propose", "--workspace", ws]);
  assert.equal(propose.exitCode, 0, propose.stderr);
  assert.ok(propose.stdout.includes(res.working_note_id as string), "the L1 note is a distill candidate");
});

test("the L0 transcript note is immutable across the promote", async () => {
  const ws = await makeWorkspace();
  const dir = await makeArtifactDir("a4bf9becd046d7ae", "Immutable L0 body.\n");
  const res = await runIngest({ workspace: ws, artifactDir: dir, mediaRef: "https://example.org/v.mp4", review: true });
  const rawDir = join(ws, "vault", "00_Raw");
  const files = await readFile(join(rawDir, `${res.note_id}.md`), "utf8").catch(async () => {
    // filename may carry a slug; fall back to note get
    return (await invoke(["note", "get", res.note_id, "--workspace", ws])).stdout;
  });
  assert.match(files, /Immutable L0 body\./);
  assert.match(files, /layer: 0/);
});

test("idempotent re-ingest with --review does not duplicate the L1 note", async () => {
  const ws = await makeWorkspace();
  const dir = await makeArtifactDir("deadbeefcafe9999", "No duplicate L1.\n");
  await runIngest({ workspace: ws, artifactDir: dir, mediaRef: "https://example.org/v.mp4", review: true });

  // count working notes before/after a second (idempotent) ingest
  const inboxCount = async (): Promise<number> => {
    const list = await invoke(["note", "list", "--type", "working", "--workspace", ws]);
    return list.stdout.split("\n").filter((l) => l.trim().length > 0).length;
  };
  const before = await inboxCount();
  const second = await runIngest({ workspace: ws, artifactDir: dir, mediaRef: "https://example.org/v.mp4", review: true });
  assert.equal(second.idempotent, true);
  assert.equal(second.working_note_id, undefined, "no L1 promoted on an idempotent no-op");
  assert.equal(await inboxCount(), before, "no duplicate working note");
});
