/**
 * Entity-node projection (SB-021). Re-derives L3 entity nodes from the L2 entity
 * notes in the vault (`vault/50_Entities/`, `type: entity`) and upserts them into
 * the SQLite `entity_nodes` projection (`@sb/memory-kernel`). Read through the
 * `@sb/note-vault` API (no direct fs). Idempotent: re-projecting yields the same
 * rows. Each node carries provenance (`source_ref`) to its source note.
 *
 * Edges + manual `entity_merged` are a later story (SB-037).
 */
import { frontmatterOf, getNote, listNotes } from "@sb/note-vault";
import type { EntityNode, Ulid } from "@sb/interfaces";
import { openProjectionStore } from "@sb/memory-kernel";
import type { ProjectionStore } from "@sb/memory-kernel";
import { EntityGraphError } from "./errors.js";

function aliasesOf(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const aliases = value.filter((a): a is string => typeof a === "string" && a.length > 0);
  return aliases.length > 0 ? aliases : undefined;
}

/** Upsert one entity node (idempotent by id). Shared by live projection + replay rebuild. */
export function insertEntityNode(store: ProjectionStore, node: EntityNode): void {
  store.db
    .prepare("INSERT OR REPLACE INTO entity_nodes (id, title, aliases, source_ref) VALUES (?, ?, ?, ?)")
    .run(
      node.id,
      node.title,
      node.aliases !== undefined ? JSON.stringify(node.aliases) : null,
      node.source_ref,
    );
}

function rowToNode(row: Record<string, unknown>): EntityNode {
  const aliasesRaw = row.aliases;
  const aliases = typeof aliasesRaw === "string" ? (JSON.parse(aliasesRaw) as string[]) : undefined;
  return {
    id: row.id as Ulid,
    title: row.title as string,
    source_ref: row.source_ref as Ulid,
    ...(aliases !== undefined && aliases.length > 0 ? { aliases } : {}),
  };
}

export interface ProjectEntitiesResult {
  /** Number of entity nodes projected. */
  count: number;
}

/**
 * Project every L2 entity note into the `entity_nodes` table. Idempotent (upsert
 * by id). Throws `EntityGraphError("invalid_entity_note")` if an entity note has
 * no title (the schema requires one). An injected open `store` (SB-043) is used
 * as-is and left open — the caller owns its lifecycle/transaction; otherwise a
 * store is opened and closed per call.
 */
export async function projectEntities(
  workspace: string,
  injectedStore?: ProjectionStore,
): Promise<ProjectEntitiesResult> {
  const summaries = await listNotes(workspace, { type: "entity" });
  const ownStore = injectedStore === undefined ? openProjectionStore(workspace) : undefined;
  const store = injectedStore ?? ownStore!;
  try {
    let count = 0;
    for (const summary of summaries) {
      const note = await getNote(workspace, summary.id);
      const fm = frontmatterOf(note.content);
      const title =
        typeof fm.title === "string" && fm.title.length > 0 ? fm.title : summary.title;
      if (title === undefined || title.length === 0) {
        throw new EntityGraphError("invalid_entity_note", `entity note ${summary.id} has no title`, {
          id: summary.id,
        });
      }
      const aliases = aliasesOf(fm.aliases);
      const node: EntityNode = {
        id: summary.id as Ulid,
        title,
        source_ref: summary.id as Ulid,
        ...(aliases !== undefined ? { aliases } : {}),
      };
      insertEntityNode(store, node);
      count++;
    }
    return { count };
  } finally {
    ownStore?.close();
  }
}

/** List projected entity nodes, ordered by id. Read-only. */
export function listEntityNodes(workspace: string): EntityNode[] {
  const store = openProjectionStore(workspace);
  try {
    const rows = store.db.prepare("SELECT * FROM entity_nodes ORDER BY id").all() as Array<
      Record<string, unknown>
    >;
    return rows.map(rowToNode);
  } finally {
    store.close();
  }
}
