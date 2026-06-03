# AGENTS.md

Multi-CLI agent guidance for the Second Brain Core. This file is the universal fallback read by
Claude Code, Codex, Gemini CLI, Cursor, and other markdown-reading agents. It complements
[`CLAUDE.md`](CLAUDE.md).

## What this project is

A local-first, open-format, **domain-independent** personal second brain core. See
[`README.md`](README.md) and [`docs/architecture/system_architecture.md`](docs/architecture/system_architecture.md).

## Hard rules for any agent

1. **Never overwrite or delete raw capture** (`vault/00_Raw/`, layer L0). It is immutable source of truth.
2. **Never delete notes automatically.** Propose; the human confirms.
3. **Never mutate a structured fact without provenance** (source ref + timestamp + confidence).
4. **Never write broker- or other domain-specific concepts into the core** (memory kernel, note vault,
   event log, entity graph, fact store, task store, retrieval, interfaces, schemas). Domain logic lives
   only under `domain-apps/`.
5. **Human-in-the-loop:** AI suggests, the human approves. No silent mutation.
6. **Event logs are source of truth**, not disposable logs. Append only; never rewrite history.
7. **No real personal/client data in the repo.** It lives in the external workspace.
8. **License safety:** do not copy source code from AGPL / GPL / unspecified / unclear-license
   repositories. Reference architecture and ideas only unless license compatibility is verified.

## Backlog workflow (MANDATORY — JIRA-style)

This project is managed through a JIRA-style backlog. See
[`docs/planning/backlog_workflow.md`](docs/planning/backlog_workflow.md),
[`docs/planning/story_backlog.md`](docs/planning/story_backlog.md), and
[`docs/planning/phase_1_story_map.md`](docs/planning/phase_1_story_map.md).

- Work is Epic → Story → Task; the **Story** is the unit of implementation.
- **No implementation unless the story is `Ready` with acceptance criteria** and its dependencies are `Done`.
- **Any story > 5 points must be split** before starting.
- Implement **only** what is in the story's Scope; touch **only** its listed files; new work → new `Backlog` story.
- Statuses: `Backlog → Ready → In Progress → In Review → Done` (+ `Blocked`, `Deferred`). **Stop for human
  review** at `In Review` and at each sub-phase stop point. Run the story's Validation before `Done`.
- `EPIC-DOMAIN-001` (broker) stays `Deferred`; no domain concepts in the core.

## Agent workflow layer

Claude-Code skills (and equivalents) are the **agent workflow layer** — capture intake, braindump
processing, distillation, and review. They are **not** the backend and must act through documented
workflows and the `interfaces` contracts.

## Current phase

Phase 0 (scaffold). No application logic. See [`docs/planning/implementation_roadmap.md`](docs/planning/implementation_roadmap.md).
