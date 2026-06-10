/**
 * Projection store bootstrap (SB-034). Opens/creates the L3 SQLite projection
 * database at `<workspace>/db/memory.sqlite` using the built-in `node:sqlite`
 * driver (zero runtime dependency) and applies an idempotent schema migration.
 *
 * `db/` is L3 — **disposable and rebuildable** from the append-only event log
 * (+ L0–L2). This module only bootstraps the store + tables; writing facts /
 * entities / tasks and replay live in later stories (SB-035+/SB-038).
 *
 * Note: `node:sqlite` is experimental in Node 22 and emits an ExperimentalWarning
 * on first use; that is expected and harmless.
 */
import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { MemoryKernelError } from "./errors.js";

/** Workspace-relative path of the projection database. */
export const DB_RELATIVE_PATH = join("db", "memory.sqlite");

/** Current projection schema version. */
export const SCHEMA_VERSION = 2;

/** Absolute path of the projection database inside a workspace. */
export function projectionDbPath(workspace: string): string {
  return join(workspace, DB_RELATIVE_PATH);
}

/**
 * L3 projection schema (v1). Every statement is idempotent (`IF NOT EXISTS`) so
 * opening an existing store is a safe no-op. Table shapes mirror the
 * `@sb/interfaces` projection contracts (Fact / EntityNode / EntityEdge / Task).
 */
const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS facts (
  id          TEXT PRIMARY KEY,
  statement   TEXT NOT NULL,
  source_ref  TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  confidence  REAL NOT NULL,
  supersedes  TEXT
);
CREATE TABLE IF NOT EXISTS entity_nodes (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  aliases     TEXT,
  source_ref  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS entity_edges (
  from_id     TEXT NOT NULL,
  to_id       TEXT NOT NULL,
  kind        TEXT NOT NULL,
  source_ref  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tasks (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  status      TEXT NOT NULL,
  source_ref  TEXT NOT NULL,
  updated_at  TEXT
);
`;

/**
 * v2 (SB-045): a duplicate entity edge is a constraint violation, not something
 * each writer must remember to dedupe in memory. Idempotent; upgrading a v1 db
 * that somehow holds duplicate edges fails the migration — `db/` is disposable,
 * so the fix is delete + `rebuild`.
 */
const SCHEMA_V2 = `
CREATE UNIQUE INDEX IF NOT EXISTS entity_edges_unique
  ON entity_edges (from_id, to_id, kind);
`;

/** An open projection store. `db` is the raw `node:sqlite` handle for later stories. */
export interface ProjectionStore {
  readonly db: DatabaseSync;
  /** Absolute path of the database file. */
  readonly path: string;
  /** Schema version the database is at. */
  readonly schemaVersion: number;
  /** Close the underlying database handle. */
  close(): void;
}

/**
 * Open (creating if needed) the projection store and ensure the schema exists.
 * Idempotent: re-opening an existing store does not duplicate or modify data.
 * Throws `MemoryKernelError` on an unsafe path / open / migration failure.
 */
export function openProjectionStore(workspace: string): ProjectionStore {
  if (typeof workspace !== "string" || workspace.length === 0 || !isAbsolute(workspace)) {
    throw new MemoryKernelError("unsafe_path", `workspace must be an absolute path: ${String(workspace)}`, {
      workspace,
    });
  }

  const path = projectionDbPath(workspace);

  let db: DatabaseSync;
  try {
    mkdirSync(dirname(path), { recursive: true });
    db = new DatabaseSync(path);
  } catch (err) {
    throw new MemoryKernelError("open_failed", `failed to open projection store: ${path}`, {
      path,
      cause: (err as NodeJS.ErrnoException).code ?? String(err),
    });
  }

  let schemaVersion: number;
  try {
    db.exec(SCHEMA_V1);
    db.exec(SCHEMA_V2);
    const row = db.prepare("SELECT version FROM schema_version LIMIT 1").get() as
      | { version: number }
      | undefined;
    if (row === undefined) {
      db.prepare("INSERT INTO schema_version (version) VALUES (?)").run(SCHEMA_VERSION);
    } else if (!Number.isInteger(Number(row.version)) || Number(row.version) > SCHEMA_VERSION) {
      // Forward guard: a db written by NEWER code (or holding a corrupt
      // version) is not silently downgraded. A NaN passes neither < nor >, so
      // the integer check is load-bearing. db/ is disposable — delete it and
      // `sb rebuild` (or upgrade this code).
      throw new MemoryKernelError(
        "migration_failed",
        `projection store schema version '${String(row.version)}' is newer than this code supports (v${SCHEMA_VERSION}) or invalid: ${path}`,
        { path, found: row.version, supported: SCHEMA_VERSION },
      );
    } else if (Number(row.version) < SCHEMA_VERSION) {
      db.prepare("UPDATE schema_version SET version = ?").run(SCHEMA_VERSION);
    }
    schemaVersion = SCHEMA_VERSION;
  } catch (err) {
    db.close();
    if (err instanceof MemoryKernelError) throw err;
    throw new MemoryKernelError("migration_failed", `failed to migrate projection store: ${path}`, {
      path,
      cause: err instanceof Error ? err.message : String(err),
    });
  }

  return {
    db,
    path,
    schemaVersion,
    close: () => db.close(),
  };
}

/**
 * Run `fn` inside a single SQLite transaction on an open store (SB-043). Commits
 * on success; rolls back on any throw, leaving the projection tables exactly as
 * they were before. The async body is safe on `DatabaseSync` because the whole
 * process shares one connection and nothing else issues statements between the
 * awaits of a single CLI run.
 */
export async function withTransaction<T>(store: ProjectionStore, fn: () => Promise<T> | T): Promise<T> {
  store.db.exec("BEGIN IMMEDIATE");
  try {
    const result = await fn();
    store.db.exec("COMMIT");
    return result;
  } catch (err) {
    try {
      store.db.exec("ROLLBACK");
    } catch {
      // the connection may already be unusable; the original error wins
    }
    throw err;
  }
}
