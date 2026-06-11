/**
 * SB-064 — review workflow safety check: the three OQ #25 candidate queries
 * are deterministic read-only operations, and a full review pass with zero
 * confirmations leaves the workspace byte-identical (vault, all event
 * streams, projections).
 */
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { frontmatterOf, getNote } from "@sb/note-vault";
import { runCapture } from "../src/capture-command.js";
import { runNoteList } from "../src/note-command.js";
import { runNotePromote } from "../src/promote-command.js";

const tmpDirs: string[] = [];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "sb-review-"));
  tmpDirs.push(dir);
  return dir;
}

after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

/** Byte snapshot of everything review must not touch: vault + events + db. */
async function workspaceSnapshot(ws: string): Promise<Map<string, string>> {
  const snapshot = new Map<string, string>();
  const walk = async (dir: string): Promise<void> => {
    if (!existsSync(dir)) return;
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else snapshot.set(path, await readFile(path, "utf8"));
    }
  };
  for (const top of ["vault", "events", "db"]) await walk(join(ws, top));
  return snapshot;
}

/** The OQ #25 candidate queries, exactly as the skill documents them. */
async function gatherCandidates(ws: string): Promise<{
  agedInbox: string[];
  neverPromotedRaws: string[];
}> {
  const working = await runNoteList({ workspace: ws, type: "working" });
  const raws = await runNoteList({ workspace: ws, type: "raw" });

  // aged inbox: working notes older than N days (N=0 here so every working note qualifies)
  const cutoff = Date.now();
  const agedInbox: string[] = [];
  for (const note of working.notes) {
    const fm = frontmatterOf((await getNote(ws, note.id)).content);
    const created = typeof fm["created"] === "string" ? Date.parse(fm["created"]) : Number.NaN;
    if (!Number.isNaN(created) && created <= cutoff) agedInbox.push(note.id);
  }

  // never-promoted raws: raw ids no working note cites as source_ref
  const cited = new Set<string>();
  for (const note of working.notes) {
    const fm = frontmatterOf((await getNote(ws, note.id)).content);
    if (typeof fm["source_ref"] === "string") cited.add(fm["source_ref"]);
  }
  const neverPromotedRaws = raws.notes.map((n) => n.id).filter((id) => !cited.has(id));

  return { agedInbox: agedInbox.sort(), neverPromotedRaws: neverPromotedRaws.sort() };
}

test("review: candidate queries are deterministic and read-only; no confirmation = no writes", async () => {
  const ws = await makeWorkspace();

  // fixture: two raws, one promoted (so exactly one never-promoted raw)
  const promotedRaw = await runCapture({ workspace: ws, content: "Promoted content.", source: "paste" });
  const orphanRaw = await runCapture({ workspace: ws, content: "Orphan content.", source: "paste" });
  const working = await runNotePromote({ id: promotedRaw.note_id, workspace: ws, title: "Promoted" });

  const baseline = await workspaceSnapshot(ws);

  // 1. the queries surface the expected candidates
  const candidates = await gatherCandidates(ws);
  assert.deepEqual(candidates.neverPromotedRaws, [orphanRaw.note_id], "set difference finds the orphan raw");
  assert.deepEqual(candidates.agedInbox, [working.note_id], "the working note is an inbox candidate");

  // 2. deterministic: a second pass returns the identical candidate sets
  assert.deepEqual(await gatherCandidates(ws), candidates);

  // 3. drafting the review proposal is pure data — and the whole pass wrote nothing
  const proposal = {
    workflow: "review",
    version: 1,
    proposed_at: "2026-06-10T12:00:00Z",
    items: [
      ...candidates.neverPromotedRaws.map((id) => ({
        candidate_id: id,
        query: "never_promoted_raw",
        recommendation: "promote",
        reason: "raw captured but never organized",
      })),
      ...candidates.agedInbox.map((id) => ({
        candidate_id: id,
        query: "aged_inbox",
        recommendation: "leave",
        reason: "recently promoted; nothing to do yet",
      })),
    ],
  };
  assert.equal(proposal.items.length, 2);

  const after = await workspaceSnapshot(ws);
  assert.deepEqual(
    [...after.entries()],
    [...baseline.entries()],
    "a review pass without confirmations must leave vault/events/db byte-identical",
  );
});
