# Retrieval Strategy

> **Not implemented in Phase 0.** This documents the design so the vault/frontmatter/event schema are
> "retrieval-aware" from day one. Retrieval lands in **Phase 3** as a Python sidecar.

## Goals

- Retrieval-aware organization now (structure that future indexing can exploit) without building the
  indexer yet.
- Indexes are **L4 — disposable**, always rebuildable from L0–L2 + events.
- Local-first: embeddings run locally (offline-capable).

## Planned index types (L4)

| Index | Built from | Tech (planned) |
|---|---|---|
| Full-text | note bodies + frontmatter | DuckDB FTS / SQLite FTS5 |
| Vector (semantic) | chunked notes (~512 tokens) | BGE-M3 (1024-d) + DuckDB VSS (HNSW) |
| Graph | `[[wikilinks]]` + entity relations | edge table (port of sspaeti design) |
| Temporal | event timestamps + frontmatter dates | time-bucketed index |

Design ported (not copied) from **sspaeti/obsidian-note-taking-assistant** (license unspecified —
**reference only**). Hybrid ranking (vector + keyword, ReMe-style ~70/30) is a Phase 3 tuning task.

## Retrieval-aware requirements on earlier layers (enforced now)

- **Stable note ids** in frontmatter (so chunks/edges reference a durable key).
- **Wikilinks** for graph edges.
- **Typed frontmatter** (type, tags, dates, source_ref) so filters and temporal queries work.
- **Event timestamps** (`captured_at`, `observed_at`) for temporal retrieval and replay.
- **Chunkable structure** (headings) — encouraged in templates.

## Sidecar boundary

The TS `packages/retrieval` is a **facade**; the Python `sidecars/retrieval` does embedding + indexing
+ query, communicating over **stdio JSON/JSONL** (see [`sidecar_contract.md`](sidecar_contract.md)).
The sidecar **reads & indexes** the vault but never owns or mutates it.

## Advanced techniques to evaluate later

Contextual retrieval and parent-document retrieval (ref: decodingai course, MIT — study) for higher
answer quality once the basic pipeline works.

## Rebuild

`scripts/index_vault.ts` (stub now) will trigger a full rebuild from L0–L2 + events. Deleting
`indexes/` must always be safe.
