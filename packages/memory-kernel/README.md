# @sb/memory-kernel

Orchestrates the layers and enforces source-of-truth rules. The **sole coordinator** that writes across
vault + event log + projections together, keeping them consistent.

- Status: **Phase 2, SB-034 — projection store bootstrap.** `openProjectionStore(workspace)` opens/creates
  `<workspace>/db/memory.sqlite` via the built-in **`node:sqlite`** driver and applies an idempotent schema
  migration (facts / entity_nodes / entity_edges / tasks + `schema_version`). `db/` is **disposable** —
  rebuildable from the event log (+ L0–L2). Throws `MemoryKernelError`
  (`unsafe_path` / `open_failed` / `migration_failed`).
- Enforces: raw immutability, no auto-delete, ADD-only facts with provenance, append-only events,
  rebuildable projections/indexes, human-in-the-loop.
- Depends on `interfaces` (+ `note-vault`/`event-log`/`fact-store`/`entity-graph`/`task-store` later).
- **Not here** (later stories): writing facts/entities/tasks (SB-035+), the pure replay projector (SB-023),
  the rebuild command (SB-038).

## Runtime requirement: Node ≥ 22.5 (SB-042)

The store uses the **built-in `node:sqlite`** driver (`DatabaseSync`), added in Node **22.5.0** and
validated here on **22.20.x**; the floor is pinned via `engines.node` (root + this package).
`node:sqlite` is still **experimental**: the `ExperimentalWarning` on stderr is expected and harmless,
but the API may change before it stabilizes. **Fallback plan:** all driver access goes through
`openProjectionStore` — if the built-in API ever breaks, swap the implementation here (e.g. to
`better-sqlite3`) without touching the projection packages.

## SB-034 surface (current)

- `openProjectionStore(workspace): ProjectionStore` — opens/creates the DB + schema idempotently; returns
  `{ db, path, schemaVersion, close() }`. `db` is the raw `node:sqlite` handle for later stories.
- `projectionDbPath(workspace)`, `DB_RELATIVE_PATH`, `SCHEMA_VERSION` constants/helpers.

Scripts: `pnpm --filter @sb/memory-kernel test`, `… build` (`tsc --noEmit`).

Domain-neutral only.
