/**
 * SB-039 — the epic "Done when" reproducibility gate. Populate a workspace,
 * snapshot every L3 projection table, DELETE `db/`, replay (rebuild), and assert
 * the rebuilt projections are row-identical. Any non-determinism fails here.
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { addFact, supersedeFact } from "@sb/fact-store";
import { mergeEntities, projectEntities } from "@sb/entity-graph";
import { openProjectionStore, projectionDbPath } from "@sb/memory-kernel";
import { runCapture } from "../src/capture-command.js";
import { runRebuild } from "../src/rebuild-command.js";

const SRC = "01KTF9SRC00000000000000000";
const A_ENT = "01KTF9AAAA0000000000000000";
const B_ENT = "01KTF9BBBB0000000000000000";
const C_ENT = "01KTF9CCCC0000000000000000";
const TASK = "01KTF9TASK0000000000000000";

const tmpDirs: string[] = [];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "sb-repro-"));
  tmpDirs.push(dir);
  return dir;
}

async function seedNote(ws: string, folder: string, id: string, fm: string): Promise<void> {
  const dir = join(ws, "vault", folder);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${id}.md`), `---\n${fm}\n---\n\nbody`, "utf8");
}

const TABLES = ["facts", "entity_nodes", "entity_edges", "tasks"] as const;

/** Snapshot every projection table as ordered rows. */
function snapshotProjections(ws: string): Record<string, unknown[]> {
  const store = openProjectionStore(ws);
  try {
    const snap: Record<string, unknown[]> = {};
    for (const t of TABLES) {
      snap[t] = store.db.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all();
    }
    return snap;
  } finally {
    store.close();
  }
}

after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

test("drop db/ and replay reproduces byte/row-identical projections", async () => {
  const ws = await makeWorkspace();

  // A rich workspace: capture, facts (incl. a supersede), entities (incl. a merge), a task.
  await runCapture({ workspace: ws, content: "raw", source: "paste" });
  const f1 = await addFact({ workspace: ws, statement: "v1", source_ref: SRC, observed_at: "2026-06-05T09:00:00Z", confidence: 0.5, now: "2026-06-05T10:00:00Z" });
  await supersedeFact({ workspace: ws, statement: "v2", source_ref: SRC, observed_at: "2026-06-05T09:00:00Z", confidence: 0.9, supersedes: f1.fact.id, now: "2026-06-05T10:05:00Z" });
  await seedNote(ws, "50_Entities", A_ENT, `id: ${A_ENT}\ntype: entity\nlayer: 2\ntitle: "Acme"\nentities:\n  - ${JSON.stringify(C_ENT)}\ncreated: "2026-06-05T08:00:00Z"`);
  await seedNote(ws, "50_Entities", B_ENT, `id: ${B_ENT}\ntype: entity\nlayer: 2\ntitle: "Beta"\ncreated: "2026-06-05T08:00:00Z"`);
  await seedNote(ws, "50_Entities", C_ENT, `id: ${C_ENT}\ntype: entity\nlayer: 2\ntitle: "Cee dup"\ncreated: "2026-06-05T08:00:00Z"`);
  await seedNote(ws, "10_Projects", TASK, `id: ${TASK}\ntype: project\nlayer: 1\ntitle: "Ship"\nstatus: active\ncreated: "2026-06-05T08:00:00Z"`);
  await projectEntities(ws); // so the merge existence check sees the nodes
  await mergeEntities({ workspace: ws, canonical: B_ENT, duplicate: C_ENT, now: "2026-06-05T11:00:00Z" });

  // First rebuild → snapshot the canonical projection state.
  await runRebuild({ workspace: ws, now: "2026-06-05T12:00:00Z" });
  const before = snapshotProjections(ws);

  // sanity: the supersede + merge actually shaped the projections
  assert.equal((before.facts as unknown[]).length, 2); // both facts retained (ADD-only)
  assert.equal((before.entity_edges as unknown[]).length, 1); // A -> B (C merged into B)

  // Drop db/ entirely and replay.
  rmSync(projectionDbPath(ws));
  assert.equal(existsSync(projectionDbPath(ws)), false);
  await runRebuild({ workspace: ws, now: "2026-06-05T13:00:00Z" });
  const after = snapshotProjections(ws);

  assert.deepEqual(after, before, "projections must be row-identical after drop + replay");
});
