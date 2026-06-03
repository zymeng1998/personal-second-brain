# CLAUDE.md — Second Brain Core

Project-specific guidance for Claude Code. See [`AGENTS.md`](AGENTS.md) for the cross-CLI rules
(they apply here too) and [`README.md`](README.md) for the overview.

## Session start ritual

1. Read [`STATUS.md`](STATUS.md) (handoff from the previous session).
2. Open the backlog: [`docs/planning/phase_1_story_map.md`](docs/planning/phase_1_story_map.md) for the
   current sub-phase + next story, and [`docs/planning/story_backlog.md`](docs/planning/story_backlog.md)
   for that story's card. Cross-check [`docs/planning/implementation_roadmap.md`](docs/planning/implementation_roadmap.md)
   and [`docs/planning/mvp_scope.md`](docs/planning/mvp_scope.md) for phase + scope.
3. State the next concrete task (by story ID) in one sentence before acting.

## Non-negotiable invariants

- **Domain independence.** No broker/domain concepts in the core. Domain code only under `domain-apps/`,
  reaching the core only via `packages/interfaces`. See
  [`docs/decisions/adr_001_second_brain_independent_of_domain_apps.md`](docs/decisions/adr_001_second_brain_independent_of_domain_apps.md).
- **Raw immutability.** `vault/00_Raw/` (L0) is never overwritten or deleted by AI.
- **Provenance.** Facts (L3) require source ref + timestamp + confidence.
- **Disposable indexes.** L4 indexes are always rebuildable from L0–L2 + events.
- **Event log = source of truth** (append-only JSONL in the workspace).
- **Human-in-the-loop.** Suggest, don't silently mutate.

## Stack boundaries (contracts-first hybrid)

- TypeScript owns structure, schemas, contracts, CLI, dashboard, Obsidian helper, orchestration.
- Python sidecars (`sidecars/`) own retrieval/embeddings/RAG — **not implemented in Phase 0**.
- TS↔Python contract: **stdio JSON/JSONL** (Phase 0/1). No HTTP/MCP yet.
- Claude-Code skills = agent workflow layer, never the backend.

## Backlog workflow (MANDATORY — JIRA-style)

This project is managed through a JIRA-style backlog. Full definitions:
[`docs/planning/backlog_workflow.md`](docs/planning/backlog_workflow.md). Enforced rules:

- **Work is organized as Epic → Story → Task.** The **Story** is the unit of implementation; every story
  has Acceptance Criteria, Definition of Done, Validation commands, Files Expected to Change, Out of Scope,
  and Dependencies in [`docs/planning/story_backlog.md`](docs/planning/story_backlog.md).
- **Ready rule:** **no implementation starts unless the story is `Ready` and has acceptance criteria.**
  If it isn't `Ready` (or deps aren't `Done`), refine first — do not start coding.
- **Split rule:** any story **> 5 story points must be split** before implementation. An `8` is never started.
- **One story at a time** on the critical path. Implement **only** what is in the story's Scope; touch
  **only** its listed files. Anything else → add a new `Backlog` story (never silent scope growth).
- **Statuses:** `Backlog → Ready → In Progress → In Review → Done` (+ `Blocked`, `Deferred`). Move a story to
  `In Progress` when you start and to `In Review` when done; **stop for human review** at that point.
- **Mandatory review checkpoints:** stop for human review at every story's `In Review` and at each
  **sub-phase stop point** in [`docs/planning/phase_1_story_map.md`](docs/planning/phase_1_story_map.md).
- **Atomic Story Rule (MANDATORY):** every story is an atomic unit — implement, review, validate, and
  commit it independently. **One atomic commit per reviewed story** (only files directly related to that
  story); **do not start the next story until the current one is reviewed and committed.** No story > 5
  points enters implementation (split first). At every stop point, update `STATUS.md` with: current story
  ID, status, files changed, validation run, and next recommended action — so an interrupted session can
  resume from `git log` + `STATUS.md` + `story_backlog.md`. Full text:
  [`docs/planning/backlog_workflow.md`](docs/planning/backlog_workflow.md) (Atomic Story Rule).
- **Priorities:** P0 (required before MVP) → P1 → P2 → P3.
- **Validation before Done:** run the story's Validation commands; redirect verbose output to a file and
  surface only the summary. A story is not `Done` until AC + DoD are met and validation is green.
- **Domain independence still applies:** no story may add domain/broker concepts to the core; `EPIC-DOMAIN-001`
  (broker) stays `Deferred` until the core is stable.

When picking up work: confirm the story is `Ready` + deps `Done` → re-read its card → implement in-scope only
→ validate → set `In Review` → stop for review. Update `STATUS.md` with the story ID at milestones and before stopping.

## Working norms (from user global rules)

- Redirect verbose command output to files; surface only summaries.
- Update [`STATUS.md`](STATUS.md) at milestones and before stopping.
- Many small files (<400 lines typical). Immutable update patterns. Explicit error handling.
- License safety: reference, don't copy, from AGPL/GPL/unclear-license repos.

## Current phase

**Phase 1A — Workspace Initialization (in progress).** Phase 0 scaffold committed (`3990af3`); JIRA
workflow committed (`0cb6b00`). **SB-001 (initializer entry + skeleton) is `Done`** and committed —
`scripts/init_workspace.ts` is now a safe skeleton (arg parsing, logging, ordered step descriptions; no
filesystem writes). The next story is **SB-002 — environment loading & path-safety checks** (start only on
human approval). Do not implement DB code, retrieval, AI extraction, connectors, or domain workflows ahead
of the backlog/story map.
