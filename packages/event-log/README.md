# @sb/event-log

Append-only JSONL event store (`events/{capture,memory,projection}_events.jsonl`). The **source-of-truth
audit + replay spine** — never rewritten; corrections are new events. Distinct from disposable `logs/`.

- Status: **Phase 0 — no code.** MVP package (Phase 1, capture events first).
- Responsibilities: append events, stream/read events, support replay to rebuild projections (Phase 2).
- Events validate against `schemas/json/`.

See [`docs/architecture/memory_layers.md`](../../docs/architecture/memory_layers.md).
