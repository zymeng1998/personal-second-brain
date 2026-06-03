# ADR-004: Layered AI memory

- **Status:** Accepted (2026-06-03)
- **Deciders:** Mengziyue

## Context

AI systems often blur raw input, interpretation, and derived data — leading to silent overwrites, lost
provenance, and unrecoverable state. We need clear roles and recovery guarantees.

## Decision

Adopt six layers plus an append-only event log:

- **L0 Raw** (immutable, source of truth) · **L1 Working** · **L2 Distilled** ·
  **L3 Facts** (projection, provenance, ADD-only) · **L4 Indexes** (disposable) ·
  **L5 Outputs** (cite sources).
- **Event log** (`events/*.jsonl`) is **append-only source of truth** for audit + replay (distinct from
  disposable `logs/`).

Rules: AI never overwrites/deletes raw; never auto-deletes notes; never mutates facts without
provenance; indexes are rebuildable; events are never rewritten; human confirms changes.

## Consequences

- Full recoverability: projections (L3) and indexes (L4) rebuild from L0–L2 + event replay.
- Auditable history of every change (incl. AI actions).
- Slightly more storage/structure; large gain in safety and trust.
- See [`../architecture/memory_layers.md`](../architecture/memory_layers.md).
