/**
 * SB-063 — braindump workflow safety check: capture-first stores the dump
 * verbatim as one L0 note + one capture event; proposing a segmentation
 * writes nothing; each confirmed promote adds exactly one L1 working note
 * while the L0 raw stays byte-unchanged.
 */
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { CAPTURE_EVENTS_RELATIVE_PATH, MEMORY_EVENTS_RELATIVE_PATH } from "@sb/event-log";
import { runCapture } from "../src/capture-command.js";
import { runNoteGet } from "../src/note-command.js";
import { runNotePromote } from "../src/promote-command.js";

const DUMP = [
  "Random thoughts:",
  "- espresso grinder needs new burrs, maybe 18 months old already",
  "- quarterly planning doc due Friday, budget section unfinished",
  "- idea: weekly review checklist as a template note",
].join("\n");

const tmpDirs: string[] = [];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "sb-braindump-"));
  tmpDirs.push(dir);
  return dir;
}

after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

async function fileCount(dir: string): Promise<number> {
  if (!existsSync(dir)) return 0;
  const entries = await readdir(dir, { withFileTypes: true });
  let count = 0;
  for (const entry of entries) {
    count += entry.isDirectory() ? await fileCount(join(dir, entry.name)) : 1;
  }
  return count;
}

async function eventLines(ws: string, relPath: string): Promise<number> {
  const path = join(ws, relPath);
  if (!existsSync(path)) return 0;
  return (await readFile(path, "utf8")).split("\n").filter((l) => l.trim().length > 0).length;
}

test("braindump: capture-first is verbatim; segmentation writes nothing; promotes never touch L0", async () => {
  const ws = await makeWorkspace();

  // 1. capture FIRST, verbatim: one L0 note + one capture event
  const captured = await runCapture({ workspace: ws, content: DUMP, source: "paste", title: "Braindump" });
  const rawDir = join(ws, "vault", "00_Raw");
  const rawFiles = await readdir(rawDir);
  assert.equal(rawFiles.length, 1);
  const rawPath = join(rawDir, rawFiles[0] as string);
  const rawBytes = await readFile(rawPath, "utf8");
  assert.ok(rawBytes.includes(DUMP), "the dump is stored verbatim — loss-free");
  assert.equal(await eventLines(ws, CAPTURE_EVENTS_RELATIVE_PATH), 1);

  // 2. the segmentation proposal step is read-only: reading the note back +
  //    drafting the proposal object changes nothing in the workspace
  const vaultBefore = await fileCount(join(ws, "vault"));
  const note = await runNoteGet({ id: captured.note_id, workspace: ws });
  const segmentation = {
    workflow: "braindump",
    version: 1,
    proposed_at: "2026-06-10T12:00:00Z",
    items: [
      { title: "Grinder burr replacement", summary: "espresso grinder maintenance", suggested_next: "task" },
      { title: "Quarterly planning budget", summary: "doc due Friday", suggested_next: "promote" },
    ],
  };
  assert.ok(note.content.includes("quarterly planning"), "segments come from the dump's own content");
  assert.equal(segmentation.items.length, 2);
  assert.equal(await fileCount(join(ws, "vault")), vaultBefore, "proposing writes nothing");
  assert.equal(await eventLines(ws, MEMORY_EVENTS_RELATIVE_PATH), 0);

  // 3. each APPROVED segment = one confirmed promote; L0 stays byte-unchanged
  const first = await runNotePromote({ id: captured.note_id, title: "Grinder burr replacement", workspace: ws });
  const second = await runNotePromote({ id: captured.note_id, title: "Quarterly planning budget", workspace: ws });
  assert.notEqual(first.note_id, second.note_id);

  const inbox = await readdir(join(ws, "vault", "00_Inbox"));
  assert.equal(inbox.length, 2, "one L1 working note per approved segment");
  for (const promoted of [first, second]) {
    const text = await readFile(promoted.note_path, "utf8");
    assert.match(text, new RegExp(`^source_ref: ${captured.note_id}$`, "m"), "every segment cites the L0 origin");
  }
  assert.equal(await readFile(rawPath, "utf8"), rawBytes, "L0 raw byte-unchanged through organization");
  assert.equal(await eventLines(ws, CAPTURE_EVENTS_RELATIVE_PATH), 1, "still exactly one capture event");
});
