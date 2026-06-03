# @sb/task-store

Domain-neutral tasks / next-actions projection. Supports the "make it actionable" half of PARA.

- Status: **Phase 0 — no code.** Phase 2.
- Tasks reference notes/entities by id; carry status + timestamps.
- No domain-specific task types in the core (a domain app models its own task semantics on top, via
  `interfaces`).
