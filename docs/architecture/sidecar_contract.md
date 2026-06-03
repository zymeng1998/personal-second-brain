# Sidecar Contract (TS ↔ Python)

> **Not implemented in Phase 0.** This documents the boundary so the design is fixed before any code.

## Why sidecars

The strongest retrieval/embedding/RAG/memory tooling is in Python (DuckDB VSS, sentence-transformers,
mem0/ReMe patterns, sspaeti's design). Rather than reimplement it in TypeScript, the core delegates
those concerns to **Python sidecars** while keeping TS as the contract/structure/orchestration owner.

## Division of responsibility

| Concern | Owner |
|---|---|
| Repo structure, schemas, contracts, CLI, dashboard, orchestration | TypeScript |
| Source of truth (vault, events, projections) | TypeScript (`memory-kernel` coordinates) |
| Embeddings, vector/FTS/graph indexing, RAG query | Python `sidecars/retrieval` |
| Extraction/distillation suggestions, summarization | Python `sidecars/ai` |

**Rules:** the Python sidecars **read & index** the vault but **never own or mutate** it. They never
write raw (L0). Any writes they suggest flow back through `interfaces` for human-confirmed application.

## Transport (decided)

- **Phase 0/1:** **stdio JSON / JSONL.** TS spawns the sidecar process and exchanges newline-delimited
  JSON over stdin/stdout. No network, no daemon — simplest, most local-first, easiest to test.
- **Phase 3:** *optional* local HTTP service if retrieval needs a long-running, warm-model process.
- **Future:** *optional* MCP adapter once `interfaces` stabilizes. **No MCP in Phase 0/1.**

## Message shape (illustrative, stdio JSONL)

```jsonc
// request (one JSON object per line)
{ "op": "index_vault", "req_id": "r1", "args": { "vault": "...", "out": "..." } }
{ "op": "query", "req_id": "r2", "args": { "q": "...", "k": 8 } }
// response
{ "req_id": "r2", "ok": true, "data": { "results": [ /* {id, score, snippet, source_ref} */ ] } }
{ "req_id": "r1", "ok": false, "error": { "code": "INDEX_FAILED", "message": "..." } }
```

## Contracts the sidecar must honor

- Input/output validated against `schemas/json/` (same schemas the TS side uses).
- Deterministic `req_id` correlation; errors are structured, never thrown across the boundary.
- Idempotent index builds; output goes only to `indexes/` (disposable).

## Phase 0 deliverable

`sidecars/retrieval/README.md` and `sidecars/ai/README.md` documenting this boundary. **No** Python
code, `requirements`/`pyproject`, retrieval logic, embedding logic, or AI extraction logic yet.
