# STATUS

**Project:** personal-second-brain (Second Brain Core)
**Phase:** Phase 1D COMPLETE — SB-014 `Done`. Next: Phase 1E (SB-013 CLI capture, SB-015 list/get)
**Last updated:** 2026-06-03

## Workflow rule in effect
- **Atomic Story Rule (MANDATORY):** each story is implemented, reviewed, validated, and committed as one
  atomic unit; one atomic commit per reviewed story (only directly-related files); do not start the next
  story until the current one is reviewed and committed; no story > 5 points enters implementation. At every
  stop point STATUS.md records: current story ID, status, files changed, validation run, next action — so an
  interrupted session resumes from `git log` + `STATUS.md` + `story_backlog.md`. Full text:
  `docs/planning/backlog_workflow.md`.

## Phase 1D COMPLETE — SB-014 `Done` (EPIC-CORE-005 Done), committed + pushed
- **SB-014 — write capture event to JSONL. Status:** `Done` (atomic commit + pushed).
  **Prev (pushed):** SB-011 `59d9333`, SB-012 `a9501e2` (Phase 1C complete).
  **Next story:** SB-013 — minimal CLI capture command (Phase 1E; deps SB-011/012/014 all `Done`).
- **Scope delivered:** `@sb/event-log` with `appendCaptureEvent()` — appends one schema-valid capture
  event as a single JSONL line to `<workspace>/events/capture_events.jsonl`, append-only (fs append mode,
  never truncates). Builds `{stream:"capture",kind:"captured"}`, auto-stamps `recorded_at` +
  `schema_version:"1.0.0"`, validates via dependency-free `validateCaptureEvent` (capture-stream branch
  of event v1) before writing. `EventLogError` codes `unsafe_path`/`invalid_event`/`append_failed`;
  nothing written on validation failure. Caller supplies the `event_id` ULID (runtime ULID generation
  arrives with the CLI, SB-013).
- **Out of scope (SB-014):** memory/projection events; replay/projection rebuild.
- **Files changed (SB-014):** `packages/event-log/{package.json,tsconfig.json,README.md}`,
  `packages/event-log/src/{index.ts,capture-event.ts,validate-event.ts,errors.ts}`,
  `packages/event-log/test/capture-event.test.ts`, `pnpm-lock.yaml` (new `@sb/event-log` importer),
  `docs/planning/{story_backlog.md,phase_1_story_map.md}`, `STATUS.md`.
- **Validation run (green):** `pnpm install` → ok; `pnpm --filter @sb/event-log test` → **5/5 pass**
  (one valid line w/ id+ts+actor+source_ref; N events = N lines, ordered, earlier lines unchanged;
  invalid event writes nothing; bad subject_id rejected; relative path rejected);
  `pnpm --filter @sb/event-log build` (`tsc --noEmit`) → exit 0; domain-leakage grep → event-log clean.
- **Next recommended action:** human reviews append semantics + ordering; on approval, commit SB-014
  atomically (`feat: event-log capture append (SB-014)`). That completes Phase 1D → next is Phase 1E
  (SB-013 CLI capture, SB-015 list/get).
- **Scope delivered:** the single guarded path that makes L0 raw immutable via the vault API.
  `guardRawImmutable(workspace, path, op)` throws `RawImmutabilityError` for any path under
  `vault/00_Raw/`; `updateRawNote`/`deleteRawNote` always reject (`overwrite_rejected`/`delete_rejected`)
  and never touch the file. Create-time overwrite is already blocked by the writer's exclusive-create
  (`already_exists`). Extracted `raw-paths.ts` to single-source the raw filename convention (the SB-011
  writer now uses it; behavior unchanged, re-verified by its tests).
- **Out of scope (SB-012):** OS-level filesystem permissions; guarding non-raw (L1+) folders.
- **Files changed (SB-012):** `packages/note-vault/src/{raw-immutability.ts,raw-paths.ts}` (new),
  `packages/note-vault/src/{errors.ts,index.ts,raw-note-writer.ts}` (edited),
  `packages/note-vault/test/raw-immutability.test.ts` (new), `packages/note-vault/package.json` (test
  script runs both files), `packages/note-vault/README.md`, `docs/planning/{story_backlog.md,
  phase_1_story_map.md}`, `STATUS.md`. (No new deps → no `pnpm-lock.yaml` change.)
- **Validation run (green):** `pnpm --filter @sb/note-vault test` → **13/13 pass** (8 SB-011 + 5 SB-012:
  overwrite-rejected+unchanged, updateRawNote rejected+unchanged, delete rejected+file-remains+unchanged,
  new note still creates, `isRawPath` true for 00_Raw / false for 00_Inbox + events);
  `pnpm --filter @sb/note-vault build` (`tsc --noEmit`) → exit 0; domain-leakage grep → only generic
  "client" + anti-leakage rules + the negative `source:"broker"` test (no real leakage).
- **Next recommended action:** human reviews the guard + tests; on approval, commit SB-012 atomically
  (`feat: raw immutability guard (SB-012)`). That completes Phase 1C → next is Phase 1D (SB-014 event append).
- **Scope delivered (narrowed by human instruction):** the **low-level raw write primitive only** —
  `writeRawNote()` in `@sb/note-vault`. Creates an immutable L0 raw note at
  `<workspace>/vault/00_Raw/<ULID>.md` (or `<ULID>--<slug>.md`); frontmatter `id/type:raw/layer:0/created`
  (+ additive `source:{kind,ref}`/`title`/`tags`), schema-exact (no `updated`); body byte-faithful;
  exclusive-create (`flag: wx`) so L0 is never overwritten; structured `RawNoteWriteError` codes.
- **Deferred (NOT done in SB-011):** the `00_Inbox/` L1 stub from the original card AC → moved to capture
  orchestration (recommend SB-013). No event emission (SB-014), no broader immutability guard (SB-012),
  no CLI (SB-013). A raw note has no `source_ref` (it is the origin).
- **Files changed (SB-011):** `packages/note-vault/{package.json,tsconfig.json,README.md}`,
  `packages/note-vault/src/{index.ts,raw-note-writer.ts,errors.ts}`,
  `packages/note-vault/test/raw-note-writer.test.ts`, `pnpm-lock.yaml` (new `@sb/note-vault` importer),
  `docs/planning/{story_backlog.md,phase_1_story_map.md}`, `STATUS.md`.
- **Validation run (green):** `pnpm install` → ok; `pnpm --filter @sb/note-vault test` → 8/8 pass
  (creates note under `00_Raw`, ULID/slug filename, `type:raw`+`layer:0`, verbatim body, no-overwrite,
  invalid-ULID rejected, relative-path rejected, unsafe-slug + unknown-source rejected);
  `pnpm --filter @sb/note-vault build` (`tsc --noEmit`) → exit 0; `@sb/interfaces` typecheck → exit 0;
  domain-leakage grep → only generic "client" + anti-leakage rules + the negative test asserting
  `source:"broker"` is rejected (no real leakage).
- **Next recommended action:** human reviews `writeRawNote()` + tests; on approval, commit SB-011
  atomically (`feat: raw note write contract (SB-011)`), then proceed to **SB-012 — raw immutability guard**.
  (`@sb/interfaces` build script substitution: it exposes `typecheck`, not `build` — ran `tsc --noEmit`.)
- **SB-010 (capture interface v0):** scaffolded `@sb/interfaces` (package.json + tsconfig + `src/*`):
  `ids.ts` (branded `Ulid`/`SecureRef`), `note.ts` (per-type `NoteFrontmatter` discriminated union +
  `Note`), `event.ts` (per-stream `Event` union + `Actor`), `capture.ts` (`CaptureRequest`/`CaptureResult`),
  `scope.ts` (`PermissionScope` + least-privilege deny list), `operations.ts` (`CoreOperations` +
  `OPERATION_CONTRACTS` documenting scope/errors per op), `index.ts`. Finalized
  `schemas/json/capture.schema.json` → v1. Types only, no operation implementation.
  Validation: `pnpm -C packages/interfaces tsc --noEmit` → exit 0; throwaway alignment smoke (one typed
  value per note/event/capture type) → exit 0; domain-leakage grep clean (only the generic
  `example-readonly` placeholder, never broker).
- **SB-009 (event v1):** `event.schema.json` v1. Envelope required `event_id(ULID),stream,kind,
  occurred_at,actor`; per-stream kinds via allOf (capture→`captured`; memory→note/fact/entity/
  distillation kinds, subject_id required; projection→`indexed/projection_rebuilt/projection_reset`).
  `actor` = `human|cli|skill:<name>|sidecar:<name>`. APPEND-ONLY documented. Files:
  `schemas/json/event.schema.json`, `examples/captures/events.sample.jsonl`, `.gitignore`
  (scoped `!examples/**/*.jsonl` exception so synthetic fixtures commit while the `*.jsonl` privacy guard
  holds for real data), `open_questions.md` (#2), backlog/STATUS. Validation: ajv over 9 event lines →
  9/9 valid; 5/5 negative cases rejected. OQ #2 resolved.
- **Decision locked (OQ #1, #3):** **ULID** is the canonical immutable `id` for all notes/events/etc.
  (pattern `^[0-7][0-9A-HJKMNP-TV-Z]{25}$`); filename `<ULID>--<slug>.md`; slug may change, id never does.
  ULID is not the retrieval mechanism (metadata/tags/links/entities + indexes are). Per-type layer pins:
  raw=L0 (no `updated`), working=L1 (needs `source_ref`), distilled/entity/concept/case=L2 (need `title`),
  project=L1/L2, daily=L1, output=L5 (needs `title` + non-empty `sources`).
- **Files changed (SB-008):** `schemas/markdown/frontmatter.schema.json` (v1, DRAFT removed),
  `examples/notes/*` (9 example notes, one per type), `docs/planning/open_questions.md` (#1, #3 resolved),
  `docs/planning/story_backlog.md` + `STATUS.md` (bookkeeping).
- **Validation run (green):** ajv (2020-12) over all 9 `examples/notes/*.md` frontmatter → 9/9 valid;
  5/5 negative cases rejected (raw+`updated`, working w/o `source_ref`, output w/o `sources`,
  wrong layer, bad ULID). Validator was a throwaway `/tmp` project (ajv+yaml) — nothing committed.

## Stop point — Phase 1A COMPLETE (SB-007 done)
- **Current story:** SB-007 — `--verify` workspace validation, Phase 1A, EPIC-CORE-001.
- **Status:** `Done` (committed + pushed). **Phase 1A complete — mandatory human review point.**
- **Files changed (SB-007):** `scripts/init_workspace.ts` (`--verify` flag + `verifyWorkspace()`),
  `package.json` (`verify:workspace` alias), `docs/planning/story_backlog.md`,
  `docs/planning/phase_1_story_map.md`, `STATUS.md`.
- **Atomicity:** SB-007 is 2 pts — atomic; behavior in `scripts/init_workspace.ts` + script alias.
- **Behavior:** `--verify` is read-only; asserts all 27 dirs + 5 files present and no unexpected top-level
  entries (dotfiles like `.DS_Store` ignored). Exit 0 if OK, 1 with a per-problem list otherwise.
- **Validation run (all green):**
  - verify before init → FAILED (root missing), exit 1.
  - init then verify → "Workspace OK: 27 directories and 5 files present", exit 0 (also via
    `pnpm run verify:workspace`).
  - verify is read-only (snapshot unchanged).
  - `.DS_Store` at top level → ignored, still OK.
  - missing dir + stray top-level file → 2 problems reported, exit 1; re-init heals → OK again.
  - `tsc --noEmit --strict` (nodenext) on all 3 script files → exit 0.

## Phase 1A summary (all `Done`, atomic commits, pushed)
- **SB-001** (`2d99fe7`): initializer entry + skeleton; Atomic Story Rule formalized.
- **SB-002** (`1c38186`): env loading + path safety.
- **SB-006** (`ccce72a`): canonical `WORKSPACE_PLAN` + `--dry-run`.
- **SB-003** (`eef5fd6`): idempotent directory-tree creation.
- **SB-004** (`46beab1`): empty append-only event files.
- **SB-005** (`74541fb`): workspace READMEs.
- **SB-007** (this commit): `--verify` read-only check.

## Next concrete action
- **STOP for human review of Phase 1A** (init against a throwaway `SECOND_BRAIN_WORKSPACE`, then
  `--verify` green). On approval, begin **Phase 1B — Schema Finalization**, first story **SB-008**
  (frontmatter schema v1). Do not start Phase 1B until approved.

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
