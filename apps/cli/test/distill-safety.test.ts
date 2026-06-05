/**
 * SB-027 distillation safety check. Exercises the whole distillation path
 * end-to-end (capture an L0 raw note + seed an L1 working source, then
 * propose → accept) and asserts the non-negotiable invariant: the path NEVER
 * overwrites/deletes raw (L0) and NEVER mutates the L1 source. Byte-checked.
 *
 * This is the automated guarantee behind skills/distill/SKILL.md.
 */
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { runCapture } from "../src/capture-command.js";
import { runDistillAccept, runDistillPropose } from "../src/distill-command.js";

const tmpDirs: string[] = [];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "sb-distill-safety-"));
  tmpDirs.push(dir);
  return dir;
}

/** Snapshot every file under a dir as path -> bytes (for byte-identical comparison). */
async function snapshot(dir: string): Promise<Map<string, Buffer>> {
  const snap = new Map<string, Buffer>();
  let entries: string[];
  try {
    entries = await readdir(dir, { recursive: true });
  } catch {
    return snap;
  }
  for (const rel of entries) {
    const abs = join(dir, rel);
    if ((await stat(abs)).isFile()) snap.set(rel, await readFile(abs));
  }
  return snap;
}

function assertSnapshotsEqual(before: Map<string, Buffer>, after: Map<string, Buffer>, label: string): void {
  assert.deepEqual([...after.keys()].sort(), [...before.keys()].sort(), `${label}: file set changed`);
  for (const [rel, bytes] of before) {
    assert.ok(after.get(rel)!.equals(bytes), `${label}: ${rel} bytes changed`);
  }
}

after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

test("distillation never mutates L0 raw or the L1 source, and creates exactly one L2 note + one event", async () => {
  const ws = await makeWorkspace();

  // L0: a real captured raw note.
  const cap = await runCapture({ workspace: ws, content: "raw source material", source: "paste" });
  assert.equal(cap.ok, true);

  // L1: a seeded working note that the distillation will reference.
  const workingId = "01KT6S3G408VV6NHJDH0ZND8DK";
  const workingDir = join(ws, "vault", "10_Projects");
  await mkdir(workingDir, { recursive: true });
  const workingPath = join(workingDir, `${workingId}.md`);
  const workingBytes = `---\nid: ${workingId}\ntype: working\nlayer: 1\ntitle: "Working source"\nsource_ref: ${cap.note_id}\ncreated: "2026-06-04T08:00:00Z"\n---\n\nWorking note body.`;
  await writeFile(workingPath, workingBytes, "utf8");

  // Snapshot the immutable/source surfaces BEFORE distillation.
  const rawBefore = await snapshot(join(ws, "vault", "00_Raw"));
  const l1Before = await readFile(workingPath);

  // propose is read-only — it must not change anything.
  const rawBeforePropose = await snapshot(join(ws, "vault", "00_Raw"));
  await runDistillPropose({ workspace: ws });
  assertSnapshotsEqual(rawBeforePropose, await snapshot(join(ws, "vault", "00_Raw")), "raw after propose");
  assert.ok(l1Before.equals(await readFile(workingPath)), "L1 source changed during propose");

  // accept — the only write.
  const result = await runDistillAccept({
    workspace: ws,
    proposal: {
      source_ids: [workingId, cap.note_id],
      title: "Distilled from L1",
      body: "Synthesized, traceable to its sources.",
      rationale: "one coherent idea",
    },
  });
  assert.equal(result.ok, true);

  // L0 raw: byte-identical and same file set (never overwritten or deleted).
  assertSnapshotsEqual(rawBefore, await snapshot(join(ws, "vault", "00_Raw")), "raw after accept");
  // L1 source: byte-identical (never mutated).
  assert.ok(l1Before.equals(await readFile(workingPath)), "L1 source changed during accept");

  // Exactly one L2 note created, exactly one memory event appended.
  const wiki = await readdir(join(ws, "vault", "80_Wiki"));
  assert.equal(wiki.length, 1);
  const eventLines = (await readFile(join(ws, "events", "memory_events.jsonl"), "utf8"))
    .split("\n")
    .filter((l) => l.length > 0);
  assert.equal(eventLines.length, 1);
  assert.equal(JSON.parse(eventLines[0]!).kind, "distillation_accepted");
});
