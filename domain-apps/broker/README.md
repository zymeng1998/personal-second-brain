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

Docs-only placeholder. **REFINED 2026-06-13** — the coarse epic stub (SB-900) is decomposed into 6
≤3-pt stories (SB-089..094); see [`../../docs/planning/broker_story_map.md`](../../docs/planning/broker_story_map.md)
for the v1 plan (client preference tracking, read-only-first) and
[`../../docs/planning/open_questions.md`](../../docs/planning/open_questions.md) (OQ #41–#47). **No
code, schemas, or data models yet** — implementation begins only after the OQ #41–#47 decision
review confirms the leans and SB-089 goes `Ready`.
