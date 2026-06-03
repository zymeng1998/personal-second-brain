# @sb/ai

Orchestration glue between the core, Claude-Code skills, and the Python AI sidecar
(`sidecars/ai`). Coordinates **suggestions** (extraction, distillation, summarization) that are always
**human-confirmed** before anything is written.

- Status: **Phase 0 — no code.** Minimal in Phase 1 (distillation skill glue); fuller in Phase 4.
- Never overwrites raw, never auto-deletes, never mutates facts without provenance.
- Talks to the Python sidecar over **stdio JSON/JSONL**; applies accepted changes via `interfaces`.

See [`docs/architecture/sidecar_contract.md`](../../docs/architecture/sidecar_contract.md).
