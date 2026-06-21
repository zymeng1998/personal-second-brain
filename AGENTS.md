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
- **Atomic Story Rule (MANDATORY):** each story is implemented, reviewed, validated, and committed as one
  atomic unit. **One atomic commit per reviewed story** (only files directly related to it); **do not start
  the next story until the current one is reviewed and committed.** No story > 5 points enters
  implementation. At each stop point, update `STATUS.md` (current story ID, status, files changed,
  validation run, next action) so an interrupted session resumes from `git log` + `STATUS.md` +
  `story_backlog.md`. Full text in
  [`docs/planning/backlog_workflow.md`](docs/planning/backlog_workflow.md).
- `EPIC-DOMAIN-001` (broker) stays `Deferred`; no domain concepts in the core.

## Agent workflow layer

Claude-Code skills (and equivalents) are the **agent workflow layer** — capture intake, braindump
processing, distillation, and review. They are **not** the backend and must act through documented
workflows and the `interfaces` contracts.

## User operating preference — Codex-led media intake

When Mengziyue attaches, uploads, drags in, or points to media files (video/audio) in any Personal
Second Brain thread, treat that as a request for the agent to run the media-intake workflow end to
end, not as a request to give manual folder/command instructions.

Default behavior:

- Locate/read the attached media file path from the thread context.
- Move or copy the media into the configured Google Drive media inbox:
  `~/Library/CloudStorage/GoogleDrive-<account>/My Drive/PersonalSecondBrain/Media/Inbox`.
- Preserve the media in Google Drive as the remote-backed source of truth; never copy media binaries
  into `PersonalSecondBrainWorkspace`.
- Trigger the appropriate workflow commands: RunPod/`psb-media-transcriber` for canonical
  transcription when needed, then `scripts/media_drive_scan.sh` to ingest through `@sb/media-intake`.
  Mengziyue explicitly treats this RunPod endpoint as his private remote compute environment for
  non-room-tour transcription jobs, not as an untrusted public third-party destination. Still do not
  upload room-tour videos unless he explicitly asks for transcription.
- Reuse the established environment:
  `SECOND_BRAIN_WORKSPACE=/Users/mengziyue/PersonalSecondBrain/PersonalSecondBrainWorkspace`,
  `MEDIA_ARTIFACT_ROOT=~/PersonalSecondBrainMediaArtifacts`, and the Drive inbox above.
- Use `--media-secref` / secure refs for Drive paths and private locators; do not print or persist
  private locators in notes/events/log summaries.
- For broker room-tour videos, inspect the opening frames for the apartment doorplate. Record the
  unit number when clear; explicitly report when it is unclear. Tag room-tour captures with the
  building name, area/neighborhood, unit/doorplate, and useful workflow tags such as `room-tour`,
  `rental`, `apartment`, and `video-intake`. Keep the media locator private via secure refs.
- Room-tour videos are visual-only by default: do not transcribe their audio unless Mengziyue
  explicitly asks for transcription for that specific file/session. Treat room-tour audio as
  non-semantic/noise by default.
- Ask Mengziyue only for steps that truly require human action, such as granting macOS permissions,
  signing into Google Drive, resolving a missing credential, or choosing among ambiguous files.

In short: Mengziyue wants to command Codex/agents conversationally and have the agent place files,
run bash commands, trigger workflows, verify results, and report only clear next actions when human
help is unavoidable.

## Current phase

Phase 1A — Workspace Initialization (in progress). SB-001 (initializer skeleton) is `Done`; next is
SB-002 (env loading & path-safety). See
[`docs/planning/implementation_roadmap.md`](docs/planning/implementation_roadmap.md) and
[`docs/planning/phase_1_story_map.md`](docs/planning/phase_1_story_map.md).
