# @sb/retrieval

TypeScript **facade** over the Python retrieval sidecar (`sidecars/retrieval`). Exposes query/index
operations through `interfaces`; the actual embedding/indexing/search happens in Python over **stdio
JSON/JSONL**.

- Status: **Phase 0 — no code.** Phase 3.
- Indexes are **L4 — disposable / rebuildable**. This package never owns the source of truth.
- See [`docs/architecture/retrieval_strategy.md`](../../docs/architecture/retrieval_strategy.md) and
  [`docs/architecture/sidecar_contract.md`](../../docs/architecture/sidecar_contract.md).
