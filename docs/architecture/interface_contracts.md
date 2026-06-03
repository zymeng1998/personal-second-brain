# Interface Contracts

`packages/interfaces` is the **stable boundary** between the Second Brain Core and everything that
uses it (surfaces, sidecars, and future domain apps). It is the single most important package for
domain independence.

## What a contract is here

- **JSON Schemas** for every entity and event (`schemas/json/`, `schemas/markdown/`).
- **TypeScript types** generated from / aligned with those schemas.
- **Operation contracts** — named operations with typed input/output (CLI commands now; OpenAPI-style
  spec later).
- **Capability + permission model** — what a caller may read/write, by scope.

## Core operations (v0 surface — capture path only in MVP)

| Operation | Input | Output | Notes |
|---|---|---|---|
| `capture` | `{ content, source, tags?, ref? }` | `{ id, raw_path, event_id }` | Writes L0 + capture event |
| `getNote` | `{ id }` | `Note` | Read-only |
| `listNotes` | `{ filter? }` | `Note[]` | Read-only |
| `appendEvent` | `Event` | `{ event_id }` | Append-only; never rewrite |
| *(later)* `query` | `{ q, scope, k }` | `Result[]` | Via retrieval sidecar |
| *(later)* `getFacts` | `{ subject?, filter? }` | `Fact[]` | L3 projection, with provenance |

Exact field lists are finalized in Phase 1 (see open questions). v0 ships only the capture/read subset.

## Domain-app access (interfaces only)

Domain apps (e.g. broker) **never** touch the vault, DB, or event log directly. They call these
operations under a **permission scope**:

```jsonc
// capability grant (illustrative; enforcement is post-MVP, design now)
{
  "app": "domain-apps/broker",
  "scopes": ["read:notes:project:*", "write:capture", "read:facts:entity:person"],
  "deny": ["read:secure_refs", "write:raw", "delete:*"]
}
```

Defaults are **least privilege**: no unrestricted read; never `write:raw`; never `delete`. See
[`../decisions/adr_006_domain_apps_use_interfaces_only.md`](../decisions/adr_006_domain_apps_use_interfaces_only.md).

## Versioning

- Schemas + operations are versioned (`v0`, `v1`, …). Breaking changes bump the major version.
- Additive changes (new optional fields/operations) are non-breaking.
- The event log is forward-compatible: unknown fields are preserved on replay.

## Stability promise

The contract is the thing other code depends on. Internals (storage engine, sidecar language, index
tech) may change freely as long as the contracts hold.
