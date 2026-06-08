# @sb/task-store

Domain-neutral tasks / next-actions projection. Supports the "make it actionable" half of PARA.

- Status: **Phase 2, SB-022 — task projection.** `projectTasks(workspace)` re-derives tasks from the vault:
  any note whose frontmatter has a non-empty `status` AND a `title` becomes a task in the SQLite `tasks`
  projection (`@sb/memory-kernel`), read via the `@sb/note-vault` API. Full-rebuild per run (a note losing
  its `status` drops its task); idempotent; each task carries `source_ref` provenance. `listTasks(workspace)`
  reads them back. **Source decision (OQ #4, resolved):** tasks come from note frontmatter `status`, not a
  dedicated task event kind.
- Tasks reference notes/entities by id; carry status + timestamps.
- No domain-specific task types in the core (a domain app models its own task semantics on top, via
  `interfaces`).
