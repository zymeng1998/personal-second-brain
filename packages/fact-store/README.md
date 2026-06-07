# @sb/fact-store

L3 structured facts as a rebuildable SQLite projection. **ADD-only** (mem0-style): facts are never
silently mutated; corrections are new facts that supersede old ones. Every fact carries provenance:
`source_ref + captured_at + observed_at + confidence`.

- Status: **Phase 2, SB-035 — ADD-only `addFact()`.** Validates provenance (`source_ref` ULID) +
  `confidence` (0–1) + statement, appends a `fact_added` memory event (source of truth), then inserts one
  row into the SQLite `facts` projection (`@sb/memory-kernel`). **Never UPDATEs/DELETEs** a fact row;
  corrections are new facts (SB-036). Throws `FactStoreError`
  (`invalid_statement` / `invalid_source_ref` / `invalid_observed_at` / `invalid_confidence` /
  `projection_write_failed`).
- Rebuildable by replaying the event log; `insertFact()` is shared by the live write and the replay rebuild
  so live == replayed.
- Domain-neutral schema only (no broker/domain fields).
- **Not here** (later): `supersedeFact` + current-facts query (SB-036); AI extraction.

See [`docs/architecture/memory_layers.md`](../../docs/architecture/memory_layers.md) and `schemas/sql/`.
