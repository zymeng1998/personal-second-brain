# domain-apps/broker — DOCS ONLY

A **future** domain app for rental-broker work. **No code, schemas, data models, examples, extraction
logic, or smoke tests in Phase 0 or Phase 1.** This directory exists only to make the domain boundary
explicit.

## Hard boundary (ADR-001, ADR-006)

- Broker concepts (clients, listings, rental applications, management emails, commission, property
  media, WeChat drafts) live **only here** — never in the core (`packages/`, `schemas/`, vault).
- When built (Phase 6), broker accesses the core **only** through `packages/interfaces`, under
  least-privilege scopes. No direct vault/DB/event access.

## Not the place for early testing

Any pre-Phase-6 interface smoke test uses a generic `domain-apps/example-readonly/`, **not** broker.

## Status

Docs-only placeholder. See `docs/` (also placeholder). Real work begins after the core is stable.
