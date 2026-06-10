/**
 * Entity-edge projection (SB-037). Derives directed entity→entity edges from the
 * `entities` refs in L2 entity notes, resolves each endpoint through the merge map
 * (from `entity_merged` events), and writes the resolved edges into the SQLite
 * `entity_edges` projection. Idempotent (full rebuild of the edge table each run),
 * so a new merge "repoints" edges to the canonical node on re-projection.
 *
 * Edges are derived from the `entities: [<ULID>…]` frontmatter field (the designed
 * graph seed). Title-based `[[wikilink]]` resolution is intentionally out of scope.
 */
import { frontmatterOf, listNotes } from "@sb/note-vault";
import { readMemoryEvents } from "@sb/event-log";
import { isUlid } from "@sb/interfaces";
import type { EntityEdge, Ulid } from "@sb/interfaces";
import { openProjectionStore, projectEvents, resolveEntity } from "@sb/memory-kernel";
import type { ProjectionStore } from "@sb/memory-kernel";

/** Edge kind for a plain entity→entity reference (domain-neutral). */
const EDGE_KIND = "related";

/** The entity ULIDs referenced by a note's `entities` frontmatter field. */
function entityRefsOf(content: string): Ulid[] {
  const value = frontmatterOf(content).entities;
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is Ulid => typeof v === "string" && isUlid(v));
}

/** Insert one entity edge. */
export function insertEntityEdge(store: ProjectionStore, edge: EntityEdge): void {
  store.db
    .prepare("INSERT INTO entity_edges (from_id, to_id, kind, source_ref) VALUES (?, ?, ?, ?)")
    .run(edge.from, edge.to, edge.kind, edge.source_ref);
}

function rowToEdge(row: Record<string, unknown>): EntityEdge {
  return {
    from: row.from_id as Ulid,
    to: row.to_id as Ulid,
    kind: row.kind as string,
    source_ref: row.source_ref as Ulid,
  };
}

export interface ProjectEdgesResult {
  /** Number of edges written. */
  count: number;
}

/**
 * Rebuild the `entity_edges` table from current entity notes, resolving endpoints
 * through the merge map. Idempotent; deterministic. Self-edges (after resolution)
 * and duplicate (from,to,kind) edges are skipped. An injected open `store`
 * (SB-043) is used as-is and left open — the caller owns its
 * lifecycle/transaction; otherwise a store is opened and closed per call.
 */
export async function projectEdges(
  workspace: string,
  injectedStore?: ProjectionStore,
): Promise<ProjectEdgesResult> {
  const summaries = await listNotes(workspace, { type: "entity", includeContent: true });
  const mergeState = projectEvents(await readMemoryEvents(workspace));
  const ownStore = injectedStore === undefined ? openProjectionStore(workspace) : undefined;
  const store = injectedStore ?? ownStore!;
  try {
    store.db.exec("DELETE FROM entity_edges");
    const seen = new Set<string>();
    let count = 0;
    for (const summary of summaries) {
      const from = resolveEntity(mergeState, summary.id as Ulid);
      for (const ref of entityRefsOf(summary.content ?? "")) {
        const to = resolveEntity(mergeState, ref);
        if (from === to) continue; // skip self-references after resolution
        const key = `${from}|${to}|${EDGE_KIND}`;
        if (seen.has(key)) continue; // dedupe collapsed edges
        seen.add(key);
        insertEntityEdge(store, { from, to, kind: EDGE_KIND, source_ref: summary.id as Ulid });
        count++;
      }
    }
    return { count };
  } finally {
    ownStore?.close();
  }
}

/** List projected entity edges, ordered by (from, to). Read-only. */
export function listEntityEdges(workspace: string): EntityEdge[] {
  const store = openProjectionStore(workspace);
  try {
    const rows = store.db
      .prepare("SELECT * FROM entity_edges ORDER BY from_id, to_id")
      .all() as Array<Record<string, unknown>>;
    return rows.map(rowToEdge);
  } finally {
    store.close();
  }
}
