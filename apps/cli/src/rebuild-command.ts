/**
 * `rebuild` command core (SB-038). Rebuilds all L3 SQLite projections from the
 * sources of truth — the append-only event log (facts) + the vault L0–L2
 * (entities/edges/tasks) — and emits `projection_reset` then `projection_rebuilt`
 * events. `db/` is disposable; this reconstructs it deterministically.
 *
 * Read-only over the source inputs: never writes to `00_Raw/`, never modifies the
 * capture/memory event streams (it only appends to the projection stream).
 */
import { appendProjectionEvent, readMemoryEvents } from "@sb/event-log";
import { ulid } from "@sb/interfaces";
import { openProjectionStore, projectEvents } from "@sb/memory-kernel";
import { insertFact } from "@sb/fact-store";
import { projectEntities, projectEdges } from "@sb/entity-graph";
import { projectTasks } from "@sb/task-store";
import { resolveSafeWorkspace } from "./capture-command.js";

export interface RebuildOptions {
  /** Absolute workspace override; else SECOND_BRAIN_WORKSPACE / .env. */
  workspace?: string;
  /** Injected timestamp (tests); defaults to now. */
  now?: string;
  /** Injected repo root (tests). */
  repoRoot?: string;
}

export interface RebuildResult {
  ok: true;
  counts: { facts: number; entities: number; edges: number; tasks: number };
  /** event_id of the emitted `projection_reset` event. */
  reset_event_id: string;
  /** event_id of the emitted `projection_rebuilt` event. */
  rebuilt_event_id: string;
}

/** Rebuild all L3 projections from the event log (+ L0–L2). Deterministic. */
export async function runRebuild(opts: RebuildOptions = {}): Promise<RebuildResult> {
  const workspace = resolveSafeWorkspace(opts.workspace, opts.repoRoot);
  const now = opts.now ?? new Date().toISOString();

  // 1. Reset all L3 projection tables (db/ is disposable) + record a projection_reset.
  const resetStore = openProjectionStore(workspace);
  try {
    resetStore.db.exec("DELETE FROM facts; DELETE FROM entity_nodes; DELETE FROM entity_edges; DELETE FROM tasks;");
  } finally {
    resetStore.close();
  }
  const resetEventId = ulid();
  await appendProjectionEvent({
    workspace,
    event_id: resetEventId,
    kind: "projection_reset",
    occurred_at: now,
    actor: "cli",
  });

  // 2. Rebuild facts from the memory event log (ADD-only: every fact event).
  const state = projectEvents(await readMemoryEvents(workspace));
  const factStore = openProjectionStore(workspace);
  let factCount = 0;
  try {
    for (const fact of state.facts.values()) {
      insertFact(factStore, fact);
      factCount++;
    }
  } finally {
    factStore.close();
  }

  // 3. Re-derive entities/edges/tasks from the vault (L0–L2).
  const entities = await projectEntities(workspace);
  const edges = await projectEdges(workspace);
  const tasks = await projectTasks(workspace);

  const counts = { facts: factCount, entities: entities.count, edges: edges.count, tasks: tasks.count };

  // 4. Record a projection_rebuilt event with the resulting counts.
  const rebuiltEventId = ulid();
  await appendProjectionEvent({
    workspace,
    event_id: rebuiltEventId,
    kind: "projection_rebuilt",
    occurred_at: now,
    actor: "cli",
    payload: { ...counts },
  });

  return { ok: true, counts, reset_event_id: resetEventId, rebuilt_event_id: rebuiltEventId };
}
