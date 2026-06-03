# ADR-006: Domain apps use interfaces only

- **Status:** Accepted (2026-06-03)
- **Deciders:** Mengziyue

## Context

To keep the core domain-independent (ADR-001) and safe, domain apps must not reach into core internals
(vault files, DB, event log) directly. They also must not get unrestricted access to all data.

## Decision

Domain apps (broker/research/finance/…) access the core **only** through `packages/interfaces`
(JSON-Schema-typed operations; CLI/OpenAPI/MCP contracts later), under **least-privilege permission
scopes**. Defaults: no unrestricted read; never `write:raw`; never `delete`. Direct access to the
vault/DB/events/secure_refs is forbidden for domain apps.

## Consequences

- Internals (storage engine, sidecar language, index tech) can change without breaking domain apps.
- A permission-scope model is designed now (in `interfaces`) and **enforced** in a later phase.
- Any pre-Phase-6 interface smoke test uses a generic `domain-apps/example-readonly/`, never broker.
- Broker stays docs-only until the core is stable.
- See [`../architecture/interface_contracts.md`](../architecture/interface_contracts.md).
