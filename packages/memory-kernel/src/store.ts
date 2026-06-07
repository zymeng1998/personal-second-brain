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
export const SCHEMA_VERSION = 1;

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
    const row = db.prepare("SELECT version FROM schema_version LIMIT 1").get() as
      | { version: number }
      | undefined;
    if (row === undefined) {
      db.prepare("INSERT INTO schema_version (version) VALUES (?)").run(SCHEMA_VERSION);
      schemaVersion = SCHEMA_VERSION;
    } else {
      schemaVersion = Number(row.version);
    }
  } catch (err) {
    db.close();
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
