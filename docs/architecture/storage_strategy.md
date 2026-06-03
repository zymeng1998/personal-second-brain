# Storage Strategy

## Formats by layer

| Layer | Format | Location | Role |
|---|---|---|---|
| L0 Raw | Markdown (+ original text/attachment ref) | `vault/00_Raw/` | Immutable truth |
| L1/L2 Notes | Markdown + YAML frontmatter | `vault/**` | Editable / curated |
| L3 Facts/Entities/Tasks | SQLite tables | `db/memory.sqlite` | Projection (rebuildable) |
| L4 Indexes | DuckDB / VSS / FTS files | `indexes/` | Disposable |
| L5 Outputs | Markdown | `vault/60_Outputs/` | Cited generations |
| Events | **JSONL (append-only)** | `events/*.jsonl` | Source-of-truth audit/replay |

## Why these choices

- **Markdown + YAML** — human-readable, tool-agnostic, Obsidian-compatible, diff/merge-friendly.
- **JSONL events** — append-only, line-addressable, trivially streamable and mergeable; the audit spine.
- **SQLite** for projections — zero-server, embedded, queryable, easy to back up and to **drop & rebuild**.
- **DuckDB** for retrieval/analytics + VSS vector search — fast, embedded, columnar; great for the
  rebuildable index layer (Phase 3). Postgres remains a *future* option for multi-process/shared use.

## Source of truth vs projections (critical)

- **Authoritative:** `vault/` Markdown + `events/*.jsonl` + `secure_refs/`.
- **Derived (rebuildable):** `db/memory.sqlite`, everything in `indexes/`, any caches.
- Rule: you can delete every projection/index and rebuild from authoritative data + event replay.

## Schemas

- `schemas/markdown/` — frontmatter JSON Schema (per note type).
- `schemas/json/` — event + capture schemas.
- `schemas/sql/` — projection DDL skeletons (L3).

These are **skeletons** in Phase 0; field-level finalization is a Phase 1 decision (see open questions).

## Backup posture

Back up `vault/`, `events/`, `secure_refs/`. Exclude `indexes/` and `db/` (rebuildable; keep
`db/backups/` only as a convenience snapshot). Never back up secrets or sensitive originals into the repo.

## Sensitive data

Raw sensitive documents are **never** stored in the vault or DB. Only metadata + a `secure_refs/`
pointer to external secure storage. See [`privacy_and_security.md`](privacy_and_security.md).
