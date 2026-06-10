/**
 * Task projection (SB-022). Re-derives L3 tasks from the vault: any note whose
 * frontmatter carries a non-empty `status` AND a `title` is projected as a task
 * into the SQLite `tasks` projection (`@sb/memory-kernel`). Read through the
 * `@sb/note-vault` API (no direct fs). Full-rebuild per run (so a note losing its
 * `status` drops its task); deterministic; each task carries `source_ref`
 * provenance to its note.
 *
 * Source decision (OQ #4, resolved): tasks come from note frontmatter `status`,
 * not a dedicated task event kind. When `note_created/updated` events are emitted
 * (future), they can drive live updates; today tasks are vault-derived (rebuildable).
 */
import { frontmatterOf, listNotes } from "@sb/note-vault";
import type { Task, Ulid } from "@sb/interfaces";
import { openProjectionStore } from "@sb/memory-kernel";
import type { ProjectionStore } from "@sb/memory-kernel";

/** Upsert one task row. Shared by live projection + replay rebuild. */
export function insertTask(store: ProjectionStore, task: Task): void {
  store.db
    .prepare("INSERT OR REPLACE INTO tasks (id, title, status, source_ref, updated_at) VALUES (?, ?, ?, ?, ?)")
    .run(task.id, task.title, task.status, task.source_ref, task.updated_at ?? null);
}

function rowToTask(row: Record<string, unknown>): Task {
  return {
    id: row.id as Ulid,
    title: row.title as string,
    status: row.status as string,
    source_ref: row.source_ref as Ulid,
    ...(row.updated_at !== null && row.updated_at !== undefined ? { updated_at: row.updated_at as string } : {}),
  };
}

export interface ProjectTasksResult {
  /** Number of tasks projected. */
  count: number;
}

/**
 * Rebuild the `tasks` table from the current vault. A note is a task iff its
 * frontmatter has a non-empty `status` AND a `title`. Full-rebuild (DELETE +
 * insert) so dropped/changed statuses are reflected. Idempotent + deterministic.
 * An injected open `store` (SB-043) is used as-is and left open — the caller owns
 * its lifecycle/transaction; otherwise a store is opened and closed per call.
 */
export async function projectTasks(
  workspace: string,
  injectedStore?: ProjectionStore,
): Promise<ProjectTasksResult> {
  const summaries = await listNotes(workspace, { includeContent: true });
  const ownStore = injectedStore === undefined ? openProjectionStore(workspace) : undefined;
  const store = injectedStore ?? ownStore!;
  try {
    store.db.exec("DELETE FROM tasks");
    let count = 0;
    for (const summary of summaries) {
      const fm = frontmatterOf(summary.content ?? "");
      const status = typeof fm.status === "string" && fm.status.trim().length > 0 ? fm.status : undefined;
      if (status === undefined) continue; // not a task
      const title = typeof fm.title === "string" && fm.title.length > 0 ? fm.title : summary.title;
      if (title === undefined || title.length === 0) continue; // a task requires a title
      const updatedAt = typeof fm.updated === "string" && fm.updated.length > 0 ? fm.updated : undefined;
      const task: Task = {
        id: summary.id as Ulid,
        title,
        status,
        source_ref: summary.id as Ulid,
        ...(updatedAt !== undefined ? { updated_at: updatedAt } : {}),
      };
      insertTask(store, task);
      count++;
    }
    return { count };
  } finally {
    ownStore?.close();
  }
}

/** List projected tasks, ordered by id. Read-only. */
export function listTasks(workspace: string): Task[] {
  const store = openProjectionStore(workspace);
  try {
    const rows = store.db.prepare("SELECT * FROM tasks ORDER BY id").all() as Array<Record<string, unknown>>;
    return rows.map(rowToTask);
  } finally {
    store.close();
  }
}
