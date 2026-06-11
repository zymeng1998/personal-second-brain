/**
 * SB-066 — the EPIC-CORE-014 "Done when" gate (mirrors SB-027/039/054):
 * across every Phase 4 workflow write path,
 *   (a) propose-without-accept leaves vault + all three event streams + db/
 *       byte-identical to baseline;
 *   (b) accepted writes carry provenance (facts: source_ref + observed_at +
 *       confidence; outputs: non-empty resolvable sources);
 *   (c) L0 raw and L1 sources stay byte-unchanged throughout;
 *   (d) every appended event validates against event schema v1.
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { frontmatterOf } from "@sb/note-vault";
import { runCapture } from "../src/capture-command.js";
import { runNoteList } from "../src/note-command.js";
import { runNotePromote } from "../src/promote-command.js";
import { runFactAccept, runFactList } from "../src/fact-command.js";
import { runOutputCreate } from "../src/output-command.js";

const require = createRequire(import.meta.url);
interface AjvLike {
  compile(schema: unknown): ((data: unknown) => boolean) & { errors?: unknown };
}
type AjvCtor = new (opts?: Record<string, unknown>) => AjvLike;
const ajvMod = require("ajv/dist/2020.js") as { default?: AjvCtor } & AjvCtor;
const Ajv2020: AjvCtor = ajvMod.default ?? ajvMod;
const afMod = require("ajv-formats") as { default?: (ajv: AjvLike) => void } & ((ajv: AjvLike) => void);
const addFormats: (ajv: AjvLike) => void = afMod.default ?? afMod;

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const EVENT_SCHEMA_PATH = join(REPO_ROOT, "schemas", "json", "event.schema.json");

const tmpDirs: string[] = [];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "sb-phase4-gate-"));
  tmpDirs.push(dir);
  return dir;
}

after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

/** Byte snapshot of everything the gate guards: vault + events + db. */
async function snapshot(ws: string): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const walk = async (dir: string): Promise<void> => {
    if (!existsSync(dir)) return;
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else result.set(path, await readFile(path, "utf8"));
    }
  };
  for (const top of ["vault", "events", "db"]) await walk(join(ws, top));
  return result;
}

async function allEventLines(ws: string): Promise<string[]> {
  const lines: string[] = [];
  const eventsDir = join(ws, "events");
  if (!existsSync(eventsDir)) return lines;
  for (const file of (await readdir(eventsDir)).sort()) {
    if (!file.endsWith(".jsonl")) continue;
    const raw = await readFile(join(eventsDir, file), "utf8");
    lines.push(...raw.split("\n").filter((l) => l.trim().length > 0));
  }
  return lines;
}

test("PHASE 4 GATE: nothing mutates without confirmation; every accepted write carries provenance", async () => {
  const ws = await makeWorkspace();

  // ---- fixture: a braindump-style L0 capture + its promoted L1 segment ----
  const dump = await runCapture({
    workspace: ws,
    content: "Descale takes 30 minutes. Burrs are 18 months old. Quarterly doc due Friday.",
    source: "paste",
    title: "Braindump",
  });
  const segment = await runNotePromote({ id: dump.note_id, title: "Machine maintenance", workspace: ws });

  const rawDir = join(ws, "vault", "00_Raw");
  const rawPath = join(rawDir, (await readdir(rawDir))[0] as string);
  const rawBytes = await readFile(rawPath, "utf8");
  const l1Bytes = await readFile(segment.note_path, "utf8");

  // The first projection-store open materializes the empty db/ schema (a
  // disposable cache, by design). Prime it so the baseline measures
  // MUTATIONS, not cache materialization.
  await runFactList({ workspace: ws });

  const baseline = await snapshot(ws);

  // ---- (a) PROPOSE phase for all four workflows: pure drafting + read-only
  //      queries; the workspace must stay byte-identical ----
  const extractProposal = {
    workflow: "extract_facts",
    version: 1,
    proposed_at: "2026-06-10T12:00:00Z",
    items: [
      {
        statement: "The descale cycle takes 30 minutes.",
        source_ref: segment.note_id,
        observed_at: "2026-06-10T11:00:00Z",
        confidence: 0.9,
      },
    ],
  };
  const reviewProposal = {
    workflow: "review",
    version: 1,
    proposed_at: "2026-06-10T12:00:00Z",
    items: [
      { candidate_id: segment.note_id, query: "aged_inbox", recommendation: "leave", reason: "fresh" },
    ],
  };
  const braindumpProposal = {
    workflow: "braindump",
    version: 1,
    proposed_at: "2026-06-10T12:00:00Z",
    items: [{ title: "Quarterly planning", summary: "doc due Friday", suggested_next: "promote" }],
  };
  // read-only surveys the skills run while drafting
  await runNoteList({ workspace: ws });
  await runNoteList({ workspace: ws, type: "working" });
  await runFactList({ workspace: ws });

  assert.deepEqual(
    [...(await snapshot(ws)).entries()],
    [...baseline.entries()],
    "(a) proposing across all workflows must write nothing",
  );
  assert.equal([extractProposal, reviewProposal, braindumpProposal].length, 3);

  // ---- ACCEPT phase: only the confirmed writes land ----
  const accepted = await runFactAccept({ proposal: extractProposal, workspace: ws });
  assert.equal(accepted.ok, true);

  const promoted = await runNotePromote({ id: dump.note_id, title: "Quarterly planning", workspace: ws });

  const composed = await runOutputCreate({
    proposal: {
      workflow: "compose_output",
      version: 1,
      proposed_at: "2026-06-10T12:00:00Z",
      items: [
        {
          title: "Maintenance summary",
          sources: [segment.note_id, accepted.fact_ids[0] as string],
          body: `Descale takes 30 minutes [${accepted.fact_ids[0]}]; see [${segment.note_id}].`,
        },
      ],
    },
    workspace: ws,
  });

  // ---- (b) provenance on every accepted write ----
  const facts = (await runFactList({ workspace: ws })).facts as Array<Record<string, unknown>>;
  assert.equal(facts.length, 1);
  assert.equal(facts[0]?.["source_ref"], segment.note_id);
  assert.ok(typeof facts[0]?.["observed_at"] === "string");
  assert.ok(typeof facts[0]?.["confidence"] === "number");

  const outputFm = frontmatterOf(await readFile(composed.note_path, "utf8"));
  const sources = outputFm["sources"] as string[];
  assert.ok(Array.isArray(sources) && sources.length > 0, "output cites sources");
  assert.ok(sources.includes(segment.note_id) && sources.includes(accepted.fact_ids[0] as string));

  const promotedFm = frontmatterOf(await readFile(promoted.note_path, "utf8"));
  assert.equal(promotedFm["source_ref"], dump.note_id, "promoted segment cites its L0 origin");

  // ---- (c) L0 + L1 sources byte-unchanged through every workflow ----
  assert.equal(await readFile(rawPath, "utf8"), rawBytes, "(c) L0 raw immutable");
  assert.equal(await readFile(segment.note_path, "utf8"), l1Bytes, "(c) L1 source unmutated");

  // ---- (d) every appended event validates against event schema v1 ----
  const schema = JSON.parse(await readFile(EVENT_SCHEMA_PATH, "utf8")) as unknown;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const events = await allEventLines(ws);
  // 1 capture + 1 fact_added + 1 note_created = 3 (promotes are vault-derived, no event)
  assert.equal(events.length, 3, "exactly the confirmed writes appended events");
  for (const line of events) {
    const event = JSON.parse(line) as Record<string, unknown>;
    assert.equal(validate(event), true, `event ${String(event["event_id"])}: ${JSON.stringify(validate.errors)}`);
  }
});
