# Backlog Workflow (JIRA-style)

How this project is managed between Phase 0 (scaffold, done) and implementation. The goal is a clear,
reviewable, drift-resistant workflow: small stories, explicit acceptance criteria, mandatory review
checkpoints, and no giant uncontrolled implementation prompts.

## Hierarchy

```
Epic
  Story
    Task / Subtask
      Acceptance Criteria
      Definition of Done
      Validation Commands
      Files Expected to Change
      Out of Scope
      Dependencies
```

- **Epic** — a large, coherent capability area (e.g. "Markdown Vault & Raw Immutability"). Spans many
  stories and often a whole phase. Not directly implementable.
- **Story** — a small, independently reviewable unit of value with explicit acceptance criteria.
  The atomic unit of implementation in this project. Must fit in one focused Claude Code session.
- **Task / Subtask** — concrete steps inside a story (listed in the story's Scope). Not separately
  tracked in the backlog table.
- **Acceptance Criteria (AC)** — observable, testable conditions that must hold for the story to be
  accepted. Written before implementation. No AC ⇒ not `Ready`.
- **Definition of Done (DoD)** — the project-wide bar plus story-specific completion conditions (tests
  pass, docs updated, validation commands green, no domain leakage, STATUS updated where relevant).
- **Story Points** — relative size/risk estimate (scale below).
- **Priority** — ordering signal relative to MVP (scale below).
- **Status** — workflow state (states below).

## Statuses

| Status | Meaning |
|---|---|
| `Backlog` | Captured but not yet refined. May lack full AC. Not implementable. |
| `Ready` | Refined: has AC, DoD, validation, files, scope, deps. Eligible for implementation. |
| `In Progress` | Actively being implemented in a focused session. |
| `Blocked` | Cannot proceed; blocker noted in Notes. |
| `In Review` | Implementation complete; awaiting human review at a checkpoint. |
| `Done` | Accepted: AC met, DoD satisfied, validation green, reviewed. |
| `Deferred` | Intentionally postponed (e.g. broker, post-MVP epics). Not scheduled. |

Normal flow: `Backlog → Ready → In Progress → In Review → Done`.
Side states: `Blocked` (from In Progress), `Deferred` (from Backlog/Ready).

## Priorities

| Priority | Meaning |
|---|---|
| **P0** | Required before the MVP can work. On the critical path. |
| **P1** | Important, but can wait until the core path works. |
| **P2** | Useful later. |
| **P3** | Future / optional. |

## Story point scale

| Points | Meaning |
|---|---|
| **1** | Tiny / documentation-only / very low risk. |
| **2** | Small implementation. |
| **3** | Moderate implementation. |
| **5** | Complex or risk-bearing. |
| **8** | Too large — **must be split** before implementation. |

## Project rules (non-negotiable)

1. **Split rule:** any story larger than **5 points must be split** before implementation. An `8` is a
   signal to decompose, never to start.
2. **Ready rule:** **no implementation starts unless the story is `Ready` and has acceptance criteria.**
3. **Domain independence:** no story may introduce broker/domain concepts into the core
   (`packages/`, `schemas/`, vault). Domain work lives only under `domain-apps/` and is `Deferred`
   until the core is stable (see [`../decisions/adr_001_second_brain_independent_of_domain_apps.md`](../decisions/adr_001_second_brain_independent_of_domain_apps.md)).
4. **One story at a time:** prefer completing and reviewing a story before starting the next, especially
   on the critical path.
5. **No silent scope growth:** anything outside a story's Scope goes to its `Out of Scope` list and, if
   worth doing, becomes a new backlog story.

## How Claude Code picks up work

1. Open [`phase_1_story_map.md`](phase_1_story_map.md); identify the current sub-phase and the next
   `Ready` story (lowest ID with satisfied dependencies).
2. Confirm the story is `Ready` and its dependencies are `Done`. If not, stop and refine first.
3. Re-read the story card in [`story_backlog.md`](story_backlog.md): Scope, AC, DoD, Validation, Files,
   Out of Scope, Deps.
4. Implement **only** what is in Scope. Touch only the listed files (deviations are flagged, not silently
   made).
5. Run the story's Validation commands; ensure DoD is met.
6. Move the story to `In Review` and stop for human review.

## How human review happens

- Review occurs at each story's `In Review` transition and at each **sub-phase stop point** in the
  story map (mandatory).
- The reviewer checks: AC met, DoD satisfied, validation output, `git diff` scope, no domain leakage,
  STATUS/docs updated.
- Approval moves the story to `Done` and unblocks dependents. Rejection returns it to `In Progress`
  with notes.
- Commits happen at sub-phase boundaries (and may be per-story) with handoff context in the message.

## How to avoid scope creep

- Small stories (≤5 points) with explicit `Out of Scope`.
- AC written before code; implementation maps 1:1 to AC.
- `Files Expected to Change` bounds the blast radius.
- Mandatory review checkpoints prevent multi-story drift.
- New ideas discovered mid-story become new `Backlog` stories, not in-flight additions.

## Estimation & refinement notes

- Estimate by risk + uncertainty, not just effort. Schema/contract decisions and safety guards skew
  higher (3) even when code is small, because they are decision- or risk-bearing.
- Refinement (`Backlog → Ready`) means: write AC/DoD/validation/files/scope and confirm dependencies.
- Keep the backlog consistent with [`implementation_roadmap.md`](implementation_roadmap.md),
  [`mvp_scope.md`](mvp_scope.md), and the architecture docs.
