# STATUS

**Project:** personal-second-brain (Second Brain Core)
**Phase:** Backlog planning (before Phase 1 implementation)
**Last updated:** 2026-06-03

## Just completed
- Phase 0 scaffold (committed `3990af3`): repo tree, READMEs, schema skeletons, configs, stub scripts,
  evaluation + architecture + decision docs (ADRs 001–007).
- **Adopted a JIRA-style backlog workflow** before Phase 1. Created
  `docs/planning/backlog_workflow.md`, `story_backlog.md`, `phase_1_story_map.md`.

## Now entering
- **Backlog planning, before Phase 1 implementation.** No application logic written yet; `init_workspace.ts`
  and all other scripts/packages remain stubs/empty.

## Next concrete action
- Human review of the backlog + Phase 1 story map.
- On approval to begin Phase 1: implement **SB-001 — workspace initializer (entry + skeleton)** (Phase 1A,
  P0, 2 pts, Ready). Then proceed through Phase 1A stories, stopping at the 1A review checkpoint.

## Open conflict to resolve
- Minimal distillation is in `mvp_scope.md` but not in Phase 1A–1G. See Phase 1H note in
  `phase_1_story_map.md` (add Phase 1H vs. defer to Phase 2).

## Key constraints
- Domain-independent core; broker only under `domain-apps/`, via `interfaces` only.
- Raw (L0) immutable; event log append-only source of truth; indexes disposable.
- No real data in repo (workspace lives outside; created by `scripts/init_workspace.ts`).

## Open questions
See `docs/planning/open_questions.md`.

## Blockers
None. Awaiting human review of Phase 0.
