# ADR-005: Retrieval-aware organization

- **Status:** Accepted (2026-06-03)
- **Deciders:** Mengziyue

## Context

Retrieval (FTS/semantic/graph/temporal) arrives in Phase 3, but if earlier layers aren't structured
for it, we'd need a painful migration later.

## Decision

Organize notes/events to be **retrieval-aware from day one**, even before the indexer exists:

- **Stable note ids** in frontmatter (durable keys for chunks/edges).
- **`[[wikilinks]]`** to seed the graph index.
- **Typed frontmatter** (type, tags, dates, source_ref) for filters + temporal queries.
- **Event timestamps** (`captured_at`, `observed_at`) for temporal retrieval + replay.
- **Chunkable structure** (headings) encouraged via templates.

Indexes themselves remain **L4 — disposable**, rebuilt by the Python retrieval sidecar.

## Consequences

- No schema migration needed when retrieval lands.
- Index design ported (not copied) from sspaeti's DuckDB+BGE-M3+graph approach (reference only — license).
- Minimal extra discipline now (ids, links, frontmatter) for big future payoff.
- See [`../architecture/retrieval_strategy.md`](../architecture/retrieval_strategy.md).
