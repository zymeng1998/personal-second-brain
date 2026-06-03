# schemas

Skeleton schemas (Phase 0 — drafts, not final). Field-level finalization is a Phase 1 decision
(see [`../docs/planning/open_questions.md`](../docs/planning/open_questions.md)).

- `markdown/` — YAML frontmatter JSON Schema per note type.
- `json/` — event + capture schemas (the TS core and Python sidecars validate against these).
- `sql/` — projection DDL skeletons (L3 facts/entities/tasks).

All schemas are **domain-neutral**. No broker/domain fields.
