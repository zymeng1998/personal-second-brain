# @sb/interfaces

**The stable boundary.** JSON Schemas + TypeScript types + operation contracts + the permission/scope
model. Everything (surfaces, sidecars, domain apps) depends on this; nothing bypasses it.

- Status: **Phase 0 — no code.** Contracts designed in
  [`docs/architecture/interface_contracts.md`](../../docs/architecture/interface_contracts.md).
- MVP (v0) operations: `capture`, `getNote`, `listNotes`, `appendEvent`.
- Domain apps call **only** these operations under least-privilege scopes (ADR-006).

Do not put domain-specific concepts here.
