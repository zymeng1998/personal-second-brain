# sidecars/retrieval (Python) — boundary docs only

Future Python service for embeddings, vector/FTS/graph indexing, and RAG query. **No code in Phase 0.**

## Boundary (decided)

- **Reads & indexes** the vault; **never owns or mutates** it; never writes raw (L0).
- Output goes only to `indexes/` (L4 — disposable / rebuildable).
- Transport: **stdio JSON/JSONL** (Phase 0/1); optional local HTTP (Phase 3); optional MCP later.
- Validates I/O against `schemas/json/` (same schemas as TS).

## Planned design (Phase 3)

DuckDB + VSS (HNSW) + BGE-M3 (1024-d) + wikilink graph + FTS — **design ported, not copied** from
sspaeti/obsidian-note-taking-assistant (license unspecified → reference only).

## Not in Phase 0

No Python code, `requirements`/`pyproject`, retrieval/embedding logic. See
[`docs/architecture/sidecar_contract.md`](../../docs/architecture/sidecar_contract.md).
