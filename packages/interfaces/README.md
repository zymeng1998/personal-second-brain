# @sb/interfaces

**The stable boundary.** JSON Schemas + TypeScript types + operation contracts + the permission/scope
model. Everything (surfaces, sidecars, domain apps) depends on this; nothing bypasses it.

- Status: **v0 (Phase 1B, SB-010).** TypeScript contracts in `src/`, aligned field-for-field with the
  JSON schemas. Types only — no operation implementation here. Contracts designed in
  [`docs/architecture/interface_contracts.md`](../../docs/architecture/interface_contracts.md).
- Typecheck: `pnpm -C packages/interfaces typecheck` (or `tsc --noEmit`).
- MVP (v0) operations: `capture`, `getNote`, `listNotes`, `appendEvent` (see `src/operations.ts`,
  `OPERATION_CONTRACTS` for the required scope + error codes per operation).
- Domain apps call **only** these operations under least-privilege scopes (ADR-006).

Do not put domain-specific concepts here.
