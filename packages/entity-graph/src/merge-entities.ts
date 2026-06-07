/**
 * Manual-confirm entity merge (SB-037, OQ #7). `mergeEntities()` records an
 * explicit `entity_merged` memory event (the source of truth) mapping a duplicate
 * entity onto a canonical one. Merges are **never inferred automatically** — a
 * human/skill invokes this. Edges repoint to the canonical node on the next
 * `projectEdges()` (which folds these events into the merge map).
 */
import { appendMemoryEvent } from "@sb/event-log";
import { isUlid, ulid } from "@sb/interfaces";
import type { Actor, Ulid } from "@sb/interfaces";
import { openProjectionStore } from "@sb/memory-kernel";
import { EntityGraphError } from "./errors.js";

export interface MergeEntitiesOptions {
  workspace: string;
  /** The surviving entity id. */
  canonical: string;
  /** The entity id being merged into `canonical`. */
  duplicate: string;
  /** Who confirmed the merge; defaults to "human" (manual-confirm). */
  actor?: Actor;
  /** Injected clock for tests; defaults to now. */
  now?: string;
}

export interface MergeEntitiesResult {
  event_id: Ulid;
  /** Absolute path of the memory event stream. */
  event_path: string;
}

/** Record a manual-confirm entity merge (duplicate → canonical) as an `entity_merged` event. */
export async function mergeEntities(opts: MergeEntitiesOptions): Promise<MergeEntitiesResult> {
  if (typeof opts.canonical !== "string" || !isUlid(opts.canonical)) {
    throw new EntityGraphError("invalid_merge", `canonical must be a ULID: ${String(opts.canonical)}`, {
      canonical: opts.canonical,
    });
  }
  if (typeof opts.duplicate !== "string" || !isUlid(opts.duplicate)) {
    throw new EntityGraphError("invalid_merge", `duplicate must be a ULID: ${String(opts.duplicate)}`, {
      duplicate: opts.duplicate,
    });
  }
  if (opts.canonical === opts.duplicate) {
    throw new EntityGraphError("invalid_merge", "cannot merge an entity into itself");
  }

  // Both entities must exist as projected nodes (manual-confirm over real entities).
  const store = openProjectionStore(opts.workspace);
  try {
    const exists = (id: string): boolean =>
      store.db.prepare("SELECT 1 AS x FROM entity_nodes WHERE id = ?").get(id) !== undefined;
    if (!exists(opts.canonical)) {
      throw new EntityGraphError("merge_target_not_found", `canonical entity not found: ${opts.canonical}`, {
        canonical: opts.canonical,
      });
    }
    if (!exists(opts.duplicate)) {
      throw new EntityGraphError("merge_target_not_found", `duplicate entity not found: ${opts.duplicate}`, {
        duplicate: opts.duplicate,
      });
    }
  } finally {
    store.close();
  }

  const now = opts.now ?? new Date().toISOString();
  const result = await appendMemoryEvent({
    workspace: opts.workspace,
    event_id: ulid(),
    kind: "entity_merged",
    subject_id: opts.canonical as Ulid,
    occurred_at: now,
    actor: opts.actor ?? "human",
    payload: { merged: [opts.duplicate] },
  });

  return { event_id: result.event_id, event_path: result.path };
}
