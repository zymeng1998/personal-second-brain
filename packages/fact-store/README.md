# @sb/fact-store

L3 structured facts as a rebuildable SQLite projection. **ADD-only** (mem0-style): facts are never
silently mutated; corrections are new facts that supersede old ones. Every fact carries provenance:
`source_ref + captured_at + observed_at + confidence`.

- Status: **Phase 0 — no code.** Phase 2.
- Rebuildable by replaying the event log + re-extracting from L0–L2.
- Domain-neutral schema only (no broker/domain fields).

See [`docs/architecture/memory_layers.md`](../../docs/architecture/memory_layers.md) and `schemas/sql/`.
