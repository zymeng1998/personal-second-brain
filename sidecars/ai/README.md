# sidecars/ai (Python) — boundary docs only

Future Python service for extraction/distillation suggestions and summarization. **No code in Phase 0.**

## Boundary (decided)

- Produces **suggestions** only; all writes are **human-confirmed** and applied via `interfaces`.
- Never overwrites raw (L0), never auto-deletes, never mutates facts without provenance.
- Transport: **stdio JSON/JSONL**; validates I/O against `schemas/json/`.
- May reference mem0/ReMe (Apache-2.0) memory patterns; embed only if it clearly saves work.

## Not in Phase 0

No Python code, dependencies, or extraction logic. See
[`docs/architecture/sidecar_contract.md`](../../docs/architecture/sidecar_contract.md).
