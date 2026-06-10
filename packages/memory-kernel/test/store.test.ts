/**
 * Tests for the SB-034 projection store bootstrap. Uses Node's built-in test
 * runner; each store opens a fresh temp workspace. `node:sqlite` is built-in
 * (no flag on Node 22; emits an experimental warning).
 */
import { existsSync, rmSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { after, test } from "node:test";
import { MemoryKernelError, openProjectionStore, projectionDbPath, SCHEMA_VERSION } from "../src/index.js";

const tmpDirs: string[] = [];
const EXPECTED_TABLES = ["entity_edges", "entity_nodes", "facts", "schema_version", "tasks"];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "sb-memory-kernel-"));
  tmpDirs.push(dir);
  return dir;
}

function tableNames(store: { db: { prepare: (sql: string) => { all: () => unknown[] } } }): string[] {
  const rows = store.db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all() as Array<{ name: string }>;
  return rows.map((r) => r.name);
}

after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

test("opens a fresh store, creates db/memory.sqlite + all tables at the current schema", async () => {
  const ws = await makeWorkspace();
  const store = openProjectionStore(ws);
  try {
    assert.equal(store.path, join(ws, "db", "memory.sqlite"));
    assert.ok(existsSync(store.path), "db file should exist");
    assert.equal(store.schemaVersion, SCHEMA_VERSION);
    assert.deepEqual(tableNames(store), EXPECTED_TABLES);
  } finally {
    store.close();
  }
});

test("re-opening is idempotent (no duplicate schema_version row, same version)", async () => {
  const ws = await makeWorkspace();
  const first = openProjectionStore(ws);
  first.close();

  const second = openProjectionStore(ws);
  try {
    assert.equal(second.schemaVersion, SCHEMA_VERSION);
    const count = second.db.prepare("SELECT COUNT(*) AS n FROM schema_version").get() as { n: number };
    assert.equal(count.n, 1, "schema_version must have exactly one row after re-open");
    assert.deepEqual(tableNames(second), EXPECTED_TABLES);
  } finally {
    second.close();
  }
});

test("db/ is disposable: deleting the file and re-opening recreates it", async () => {
  const ws = await makeWorkspace();
  const first = openProjectionStore(ws);
  first.close();

  rmSync(projectionDbPath(ws));
  assert.equal(existsSync(projectionDbPath(ws)), false);

  const rebuilt = openProjectionStore(ws);
  try {
    assert.ok(existsSync(rebuilt.path));
    assert.equal(rebuilt.schemaVersion, SCHEMA_VERSION);
    assert.deepEqual(tableNames(rebuilt), EXPECTED_TABLES);
  } finally {
    rebuilt.close();
  }
});

test("rejects a relative / non-absolute workspace path", () => {
  assert.throws(
    () => openProjectionStore("relative/ws"),
    (err: unknown) => err instanceof MemoryKernelError && err.code === "unsafe_path",
  );
});

test("a v1 store upgrades to v2 on open: version bumped + entity_edges UNIQUE index (SB-045)", async () => {
  const ws = await makeWorkspace();
  // Downgrade a fresh store to the v1 shape: version 1, no unique index.
  const v1 = openProjectionStore(ws);
  v1.db.exec("DROP INDEX IF EXISTS entity_edges_unique");
  v1.db.prepare("UPDATE schema_version SET version = 1").run();
  v1.close();

  const upgraded = openProjectionStore(ws);
  try {
    assert.equal(upgraded.schemaVersion, SCHEMA_VERSION);
    const row = upgraded.db.prepare("SELECT version FROM schema_version LIMIT 1").get() as { version: number };
    assert.equal(Number(row.version), SCHEMA_VERSION);
    const index = upgraded.db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='entity_edges_unique'")
      .get();
    assert.ok(index !== undefined, "entity_edges_unique index must exist after upgrade");
  } finally {
    upgraded.close();
  }
});

test("a store with a NEWER schema version refuses to open (forward guard)", async () => {
  // Review MEDIUM #3: a db written by future code must not be silently
  // downgraded — db/ is disposable, so the remedy is delete + rebuild.
  const ws = await makeWorkspace();
  const current = openProjectionStore(ws);
  current.db.prepare("UPDATE schema_version SET version = ?").run(SCHEMA_VERSION + 1);
  current.close();

  assert.throws(
    () => openProjectionStore(ws),
    (e: unknown) =>
      e instanceof MemoryKernelError &&
      e.code === "migration_failed" &&
      /newer than this code/.test(e.message),
  );

  // The stored version was not touched by the refused open.
  const sqlite = new DatabaseSync(projectionDbPath(ws));
  const row = sqlite.prepare("SELECT version FROM schema_version LIMIT 1").get() as { version: number };
  sqlite.close();
  assert.equal(Number(row.version), SCHEMA_VERSION + 1);
});

test("a store with a CORRUPT (non-integer) schema version refuses to open", async () => {
  // Re-review follow-up: NaN passes neither < nor > SCHEMA_VERSION, so without
  // an integer check a corrupt version row silently passed as current.
  const ws = await makeWorkspace();
  const current = openProjectionStore(ws);
  current.db.prepare("UPDATE schema_version SET version = ?").run("banana");
  current.close();

  assert.throws(
    () => openProjectionStore(ws),
    (e: unknown) =>
      e instanceof MemoryKernelError &&
      e.code === "migration_failed" &&
      /or invalid/.test(e.message),
  );
});
