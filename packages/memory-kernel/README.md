# @sb/memory-kernel

Orchestrates the layers and enforces source-of-truth rules. The **sole coordinator** that writes across
vault + event log + projections together, keeping them consistent.

- Status: **Phase 0 — no code.** Partial in Phase 1; full coordination in Phase 2.
- Enforces: raw immutability, no auto-delete, ADD-only facts with provenance, append-only events,
  rebuildable projections/indexes, human-in-the-loop.
- Depends on `interfaces`, `note-vault`, `event-log` (+ `fact-store`/`entity-graph`/`task-store` later).

Domain-neutral only.
