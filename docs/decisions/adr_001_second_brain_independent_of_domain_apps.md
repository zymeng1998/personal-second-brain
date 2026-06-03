# ADR-001: Second Brain Core is independent of domain apps

- **Status:** Accepted (2026-06-03)
- **Deciders:** Mengziyue

## Context

The first practical use is rental-broker work, but broker is only one future domain. If broker
concepts leak into the core, the system becomes a broker tool, not a general second brain, and future
domains (research/finance/job-search/course-notes/writing) get harder.

## Decision

The core is **domain-independent**. Broker (and any domain) concepts — clients, listings, rental
applications, management emails, commission, property media, WeChat drafts — appear **only** under
`domain-apps/` (or separate domain apps). They must never appear in: memory kernel, note vault, event
log, entity graph, fact store, task store, retrieval layer, core interfaces, or schemas. Domain apps
reach the core only through `packages/interfaces`.

## Consequences

- The core vault, schemas, and packages use only domain-neutral vocabulary (see glossary).
- Domain needs are met by *mapping* onto core notes/entities/facts, not by extending core vocabulary.
- A grep for domain terms in `packages/`/`schemas/` should return nothing.
- `domain-apps/broker/` stays docs-only until the core is stable (Phase 6).
- Slightly more indirection now; large payoff in reusability and clarity.
