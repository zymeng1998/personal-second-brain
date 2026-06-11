/**
 * SB-062 — extract-facts workflow safety check (mirrors distill-safety):
 * drafting an extract_facts proposal writes NOTHING anywhere; `fact accept`
 * writes exactly the proposal's items with provenance while the L0 raw and
 * L1 working sources stay byte-unchanged.
 */
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { MEMORY_EVENTS_RELATIVE_PATH } from "@sb/event-log";
import { runCapture } from "../src/capture-command.js";
import { runNotePromote } from "../src/promote-command.js";
import { runFactAccept, runFactList } from "../src/fact-command.js";

const tmpDirs: string[] = [];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "sb-extract-safety-"));
  tmpDirs.push(dir);
  return dir;
}

after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

/** Every file under vault/ as relPath -> bytes (the mutate-nothing snapshot). */
async function vaultSnapshot(ws: string): Promise<Map<string, string>> {
  const snapshot = new Map<string, string>();
  const vault = join(ws, "vault");
  if (!existsSync(vault)) return snapshot;
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else snapshot.set(path, await readFile(path, "utf8"));
    }
  };
  await walk(vault);
  return snapshot;
}

test("extract-facts: propose writes nothing; accept writes only provenance-carrying facts", async () => {
  const ws = await makeWorkspace();

  // a realistic source chain: L0 capture -> L1 working note
  const captured = await runCapture({
    workspace: ws,
    content: "The descale cycle takes 30 minutes. The grinder burrs are 18 months old.",
    source: "paste",
    title: "Machine maintenance",
  });
  const promoted = await runNotePromote({ id: captured.note_id, workspace: ws });

  const baselineVault = await vaultSnapshot(ws);
  const eventsPath = join(ws, MEMORY_EVENTS_RELATIVE_PATH);
  const baselineEvents = existsSync(eventsPath) ? await readFile(eventsPath, "utf8") : "";

  // 1. DRAFTING the proposal (what the skill does) — a scratch file OUTSIDE the
  //    workspace tree the system owns; assert zero workspace writes.
  const proposal = {
    workflow: "extract_facts",
    version: 1,
    proposed_at: "2026-06-10T12:00:00Z",
    items: [
      {
        statement: "The descale cycle takes 30 minutes.",
        source_ref: promoted.note_id,
        observed_at: "2026-06-10T11:00:00Z",
        confidence: 0.9,
      },
      {
        statement: "The grinder burrs are 18 months old.",
        source_ref: promoted.note_id,
        observed_at: "2026-06-10T11:00:00Z",
        confidence: 0.7,
      },
    ],
  };
  const proposalPath = join(ws, "..", `proposal-${Date.now()}.json`);
  await writeFile(proposalPath, JSON.stringify(proposal, null, 2), "utf8");
  tmpDirs.push(proposalPath);

  const afterDraft = await vaultSnapshot(ws);
  assert.deepEqual([...afterDraft.entries()], [...baselineVault.entries()], "drafting must write nothing to the vault");
  assert.equal(
    existsSync(eventsPath) ? await readFile(eventsPath, "utf8") : "",
    baselineEvents,
    "drafting must append no events",
  );
  assert.equal(existsSync(join(ws, "db")), false, "drafting must not create projections");
  assert.equal((await runFactList({ workspace: ws })).count, 0);

  // 2. ACCEPT (the human-confirmed write) — exactly the items, with provenance.
  const accepted = await runFactAccept({ proposal, workspace: ws });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.written, 2);

  const facts = (await runFactList({ workspace: ws })).facts as Array<Record<string, unknown>>;
  assert.equal(facts.length, 2);
  for (const fact of facts) {
    assert.equal(fact["source_ref"], promoted.note_id, "every fact carries provenance to its source note");
    assert.ok(typeof fact["confidence"] === "number");
    assert.ok(typeof fact["observed_at"] === "string");
  }

  // 3. Sources are byte-unchanged; the vault gained no files (facts never touch it).
  const finalVault = await vaultSnapshot(ws);
  assert.deepEqual([...finalVault.entries()], [...baselineVault.entries()], "accept must not touch the vault");

  const newEvents = (existsSync(eventsPath) ? await readFile(eventsPath, "utf8") : "")
    .slice(baselineEvents.length)
    .split("\n")
    .filter((line) => line.trim().length > 0);
  assert.equal(newEvents.length, 2, "exactly one event per accepted fact");
  for (const line of newEvents) {
    assert.equal((JSON.parse(line) as Record<string, unknown>)["kind"], "fact_added");
  }
});
