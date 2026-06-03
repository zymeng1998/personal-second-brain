# ADR-002: Local-first, open-format

- **Status:** Accepted (2026-06-03)
- **Deciders:** Mengziyue

## Context

The data is deeply personal. Cloud dependence and proprietary formats risk lock-in and loss of
ownership. The user values data ownership and longevity.

## Decision

Local-first with open formats as the **source of truth**: Markdown + YAML frontmatter (notes),
append-only JSONL (events). Projections (SQLite/DuckDB) and indexes are **derived and rebuildable**.
No network is required to read/write/search the brain. Cloud LLMs/sidecars are optional and opt-in.

## Consequences

- The vault is usable with any editor and survives the loss of any tool.
- Backups target authoritative data (`vault/`, `events/`, `secure_refs/`); projections/indexes are
  rebuildable and excluded.
- Sync is the user's choice (Git/iCloud/Syncthing/none); text + append-only JSONL minimize conflicts.
- See [`../architecture/local_first_strategy.md`](../architecture/local_first_strategy.md),
  [`../architecture/storage_strategy.md`](../architecture/storage_strategy.md).
- License of the project itself: TBD (lean permissive for the core; data is never in the repo).
