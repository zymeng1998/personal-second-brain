# STATUS

**Project:** personal-second-brain (Second Brain Core)
**Phase:** **Phase 1 core COMPLETE** (SB-001..018). **Now: Phase 1H — Minimal Human-Confirmed Distillation**
(decision 2026-06-04: build before Phase 2). **SB-019 `In Review`** (distillation proposal contract).
**Next story: SB-024** (L2 distilled-note writer).
**Last updated:** 2026-06-05

## SB-019 `In Review` (Phase 1H, EPIC-CORE-007) — implemented + validated, NOT yet committed
- **SB-019 — distillation proposal contract (interfaces). Status:** `In Review` (atomic; awaiting human
  review → commit). **Dep:** SB-010 `Done`. **Next story:** SB-024 (L2 `writeDistilledNote` in
  `@sb/note-vault`). Mirrors the SB-010 capture-contract pattern: **types + operation descriptors only,
  no behavior.**
- **Scope delivered (contracts only):**
  - New `packages/interfaces/src/distillation.ts` — `ProposeDistillationInput` (`source_ids: Ulid[]`),
    `DistillationProposal` (`source_ids`, `title`, `body`, `tags?`, `rationale`), `DistillationResult`
    (`note_id`, `event_id`). Module doc records the invariants the later writer/CLI must enforce: never
    touch `00_Raw/`, never mutate L1 sources, L2 note needs `title` + `source_ref`, accept emits exactly
    one `distillation_accepted` memory event.
  - `scope.ts` — added `write:distill` to `PermissionScope` (distinct from `write:capture`; `write:raw`
    stays in `ALWAYS_DENIED_SCOPES`, so least-privilege holds: distill cannot write capture/raw).
  - `operations.ts` — added `proposeDistillation(input)→DistillationProposal` (read-only) and
    `acceptDistillation(proposal)→DistillationResult` (write) to `CoreOperations`, plus
    `OPERATION_CONTRACTS` entries: `proposeDistillation` `{scope:"read:notes", readOnly:true,
    errors:[not_found,scope_denied,io_error]}`; `acceptDistillation` `{scope:"write:distill",
    readOnly:false, errors:[validation_failed,not_found,raw_immutable,scope_denied,duplicate_id,io_error]}`.
    Reused the existing `InterfaceErrorCode` union (no new codes needed).
  - `index.ts` — re-exports the three new types.
- **No implementation, no new dependency, no schema change.** (`distillation_accepted` MemoryKind already
  existed in `event.ts` from SB-009.)
- **Out of scope (SB-019):** any writer/event/CLI/skill behavior (SB-024..027); L3 facts (Phase 2).
- **Files changed (SB-019):** `packages/interfaces/src/{distillation.ts(new),operations.ts,scope.ts,
  index.ts}`, `docs/planning/{story_backlog.md,phase_1_story_map.md}`, `STATUS.md`.
- **Validation run (green):** `@sb/interfaces` `tsc --noEmit` → **exit 0**; throwaway alignment smoke
  (one typed `ProposeDistillationInput` + `DistillationProposal` + `DistillationResult`, `write:distill`
  scope, and `OPERATION_CONTRACTS.{propose,accept}Distillation.readOnly`/`.scope` reads) compiled under
  `--strict --module nodenext` → **exit 0** (temp file removed); domain-leakage grep on the changed files →
  clean (only the pre-existing generic `example-readonly` placeholder in `scope.ts`, never broker).
- **Next recommended action:** human reviews the contract; on approval, commit SB-019 atomically
  (`feat: distillation proposal contract (SB-019)`). Then proceed SB-024 → SB-025 → SB-026 → SB-027.

## Docs (2026-06-05) — media transcription intake convention documented
- **Context:** the standalone `psb-media-transcriber` (live, v0.1.0) writes to its own artifact store
  `~/PersonalSecondBrainMediaArtifacts/` (`<YYYY>/<MM>/<media_id>/` + a `by-name/` symlink view named by
  original video filename). It does **not** write into the vault; integration is a future optional adapter.
- **Documented:** new [`docs/workflows/media_transcription_intake.md`](docs/workflows/media_transcription_intake.md)
  (how transcripts arrive, the by-name convention, binding rules: read-only, provenance via `media_id`,
  idempotent re-ingest, preserve organize-by-name). Added coarse **EPIC-CORE-013 (SB-070–072)** to
  `story_backlog.md` so the adapter is tracked. Transcriber repo README updated with the canonical artifact
  output layout + `by-name/` rule (source of truth).
- **No code/scope change** in the core; docs-only here. No vault writes from transcription until EPIC-CORE-013
  is refined + implemented. **Next story is still SB-019** (Phase 1H distillation contract).

## Phase 1H scheduled — SB-019 split (refinement committed-pending)
- **Decision:** build the minimal human-confirmed distillation workflow now (chosen over folding into
  Phase 2). EPIC-CORE-007 → `In Progress`. **L2-only** (L3 facts moved to Phase 2 / EPIC-CORE-008).
- **Split** of the old `5→split` SB-019 into ≤3-pt atomic stories (cards in `story_backlog.md`,
  sub-phase in `phase_1_story_map.md`):
  - **SB-019** `Ready` (2) — distillation proposal **contract** in `@sb/interfaces` (types + descriptors
    + `write:distill` scope; no impl). Dep SB-010 `Done`.
  - **SB-024** (3) — `writeDistilledNote()` L2 writer in `@sb/note-vault` (never under `00_Raw/`).
  - **SB-025** (2) — `appendMemoryEvent()` memory-stream append in `@sb/event-log` (append-only).
  - **SB-026** (3) — CLI `distill` (`propose` read-only + `accept` human-confirmed write).
  - **SB-027** (2) — `skills/distill/` skill + end-to-end L0/L1 never-mutated safety check.
- **Key design decisions (documented in the map):** skill = agent layer / core = contracts+CLI; proposal
  transport = JSON via stdin/file; L2 distilled note requires `title` + `source_ref`; the distillation path
  is forbidden from touching L0 raw and from mutating L1 sources.
- **Next recommended action:** on approval of this refinement, implement **SB-019** atomically (interfaces
  types + operation descriptors only; `tsc --noEmit` + alignment smoke), set `In Review`, commit
  (`feat: distillation proposal contract (SB-019)`), then proceed SB-024 → SB-025 → SB-026 → SB-027.

## SB-018 `Done` (Phase 1G, EPIC-CORE-001..006) — docs-only, committed + pushed
- **SB-018 — update documentation & STATUS after Phase 1. Status:** `Done` (atomic, docs-only commit).
  **Prev (pushed):** SB-017 `bb650b1`. **Final Phase 1 gate cleared.**
- **Scope delivered (docs only):**
  - `README.md` — status → "**Phase 1 (MVP core) complete**"; **getting-started rewritten** with the real,
    end-to-end-verified flow (`pnpm init:workspace` / `verify:workspace` → `capture` flag+stdin →
    `note list`/`note get` → `validate:notes` → `pnpm test`); scripts map marks `init_workspace` +
    `validate_notes` implemented; distillation deferral noted.
  - `docs/planning/implementation_roadmap.md` — Phase 0 ✅, Phase 1 ✅ (with the SB-019 distillation
    carve-out and "decided: schema v1 / event v1 / ULID").
  - `docs/planning/mvp_scope.md` — acceptance criteria annotated: **AC 1–4, 6 ✅**; **AC 5 (distillation) ⏳
    deferred** (SB-019); distillation in-scope item flagged deferred.
  - `docs/planning/open_questions.md` — **#4 (workspace creation) RESOLVED** (init_workspace; no template
    seeding in Phase 1). (#1–#3 already resolved.)
  - `docs/planning/story_backlog.md` — epic table 1A/1B/1E/1F → `Done`; SB-018 row+card → `In Review`.
  - `docs/planning/phase_1_story_map.md` — Phase 1G status note.
- **Honest carve-out:** the MVP's **human-confirmed distillation skill (SB-019) was never built**, so the
  docs mark it **deferred** to Phase 1H / Phase 2 (pending the scope decision) instead of claiming Phase 1
  is 100% of the original MVP. The capture + validate + read + immutability core is complete.
- **Validation run (green):** getting-started smoke on a throwaway `SECOND_BRAIN_WORKSPACE=/tmp/psb-sb018-demo`
  → init (27 dirs+5 files) → verify OK → capture (flag + stdin) both `ok:true` → `note list` shows both →
  `note get <id>` prints frontmatter+body → `validate:notes` 2/2 valid; `pnpm test` exit 0 (note-vault 24,
  event-log 5, cli 14, scripts 12); domain-leakage grep clean (only generic channels + negative broker test).
  `git diff` is **docs-only** (README + docs/planning/* + STATUS).
- **Next recommended action:** begin **Phase 2 (projections)** — but **first decide the SB-019 distillation
  conflict** (add Phase 1H to build it now vs. fold distillation into Phase 2). Phase 2 epic: EPIC-CORE-008
  (fact-store / entity-graph / task-store + event-log replay); refine + split the `5→split` stories
  (SB-020..023) before implementation.

## SB-017 `In Review` (Phase 1F, EPIC-CORE-006) — implemented + validated, NOT yet committed
- **SB-017 — checks/tests for raw immutability. Status:** `In Review` (atomic; awaiting human review →
  commit). **Prev (pushed):** SB-016 `cdd37b8`. **Next story:** SB-018 (docs/STATUS wrap, Phase 1G).
- **Scope delivered:** new `packages/note-vault/test/raw-immutability-invariant.test.ts` (6 tests) that
  harden the L0 invariant *beyond* SB-012's vault-API cases: (1) `guardRawImmutable` returns the
  operation-specific code (`overwrite_rejected`/`delete_rejected`) for a raw path; (2) it is a **no-op**
  (must NOT throw) for non-raw paths (`00_Inbox`, `10_Working`, `events/*.jsonl`) so L1+ stays editable;
  (3) path traversal that *resolves into* `00_Raw` (`00_Raw/../00_Raw/x.md`) is still guarded; (4) traversal
  that *escapes* to `10_Working` is allowed; (5) slugged raw filenames (`<ULID>--<slug>.md`) are immutable
  too (update+delete refused, bytes unchanged); (6) consolidated invariant — after a real `writeRawNote`,
  re-write / `updateRawNote` / `deleteRawNote` are all refused and bytes are byte-identical (with a control
  guarding the byte-comparison itself).
- **Test wiring:** added the new file to `@sb/note-vault`'s `test` script, and added a **documented root
  `pnpm test`** = `pnpm -r run test && pnpm run test:scripts` (the AC's "documented command"; recursive run
  skips `@sb/interfaces`, which has no test script). The user's Terminal has `pnpm` on PATH, so the nested
  `pnpm -r` resolves; validated in-sandbox via a temporary `pnpm`→`corepack pnpm` PATH shim.
- **No new dependency, no production-code change** — tests + `package.json` test scripts only.
- **Out of scope (SB-017):** OS-level filesystem permissions (the guard is API-level).
- **Files changed (SB-017):** `packages/note-vault/test/raw-immutability-invariant.test.ts` (new),
  `packages/note-vault/package.json` (test script + new file), `package.json` (root `test` script),
  `docs/planning/{story_backlog.md,phase_1_story_map.md}`, `STATUS.md`. (No `pnpm-lock.yaml` change.)
- **Validation run (green):** `pnpm test` → **exit 0** — note-vault **24/24** (18 + 6 new), event-log 5/5,
  cli 14/14, scripts 12/12; `pnpm --filter @sb/note-vault build` (`tsc --noEmit`) → exit 0; domain-leakage
  grep on the new test → clean.
- **Next recommended action:** human reviews the immutability tests + the new root `pnpm test`; on approval,
  commit SB-017 atomically (`test: raw immutability checks (SB-017)`) + push. That completes **Phase 1F**;
  next is **Phase 1G / SB-018** (docs/STATUS wrap-up).

## Workflow rule in effect
- **Atomic Story Rule (MANDATORY):** each story is implemented, reviewed, validated, and committed as one
  atomic unit; one atomic commit per reviewed story (only directly-related files); do not start the next
  story until the current one is reviewed and committed; no story > 5 points enters implementation. At every
  stop point STATUS.md records: current story ID, status, files changed, validation run, next action — so an
  interrupted session resumes from `git log` + `STATUS.md` + `story_backlog.md`. Full text:
  `docs/planning/backlog_workflow.md`.

## SB-016 `Done` (Phase 1F, EPIC-CORE-006) — committed + pushed
- **SB-016 — frontmatter validation script. Status:** `Done` (atomic commit + pushed).
  **Prev (pushed):** SB-015 `2736ba3` (Phase 1E complete). **Next story:** SB-017 — raw immutability
  checks/tests (finishes Phase 1F; dep SB-012 `Done`). Invalid fixtures kept inline in the test.
- **Scope delivered:** `scripts/validate_notes.ts` — read-only validator. Scans
  `<workspace>/vault/**/*.md`, parses YAML frontmatter (`yaml`), validates against
  `schemas/markdown/frontmatter.schema.json` v1 with **Ajv 2020 + ajv-formats**. Per-file PASS/FAIL +
  errors and a `checked/valid/invalid` summary. Exit **0** all-valid / **1** invalid / **2** operational
  (unsafe workspace, missing schema, absent/unreadable vault, bad args). `--workspace` override + `--help`;
  workspace safety reuses `resolveWorkspaceConfig` (SB-002). Strictly read-only.
- **Dependencies added (devDependencies):** `ajv` ^8.17.1 (→8.20.0), `ajv-formats` ^3.0.1, `yaml` ^2.5.0
  (→2.9.0) — needed to validate against the real schema (the libraries you sanctioned). `pnpm-lock.yaml`
  updated.
- **Out of scope (SB-016):** auto-fix, mutation, capture, event-log writing, retrieval, AI, sidecars,
  dashboard, Obsidian, broker, DB, schema changes (none were needed).
- **Files changed (SB-016):** `scripts/validate_notes.ts` (implemented), `scripts/validate_notes.test.ts`
  (new — fixtures inline, run via `pnpm test:scripts`), `package.json` (deps + `test:scripts`),
  `pnpm-lock.yaml`, `docs/planning/{story_backlog.md,phase_1_story_map.md}`, `STATUS.md`. (Test fixtures
  kept inline rather than under `examples/` so bad-on-purpose notes don't pollute the committed examples.)
- **Validation run (green):** `pnpm install` ok; `pnpm validate:notes -- --help` prints usage;
  `pnpm validate:notes` on a CLI-captured workspace → exit 0; on a seeded-bad workspace → exit 1 with
  per-error detail; `pnpm test:scripts` → **12/12**; note-vault 18/18, event-log 5/5, cli 14/14; cli
  build exit 0; domain-leakage grep → `validate_notes.ts` clean (only pre-existing anti-leakage rules /
  negative tests / deferred-broker docs elsewhere).
- **Next recommended action:** human reviews the validator; on approval, commit SB-016 atomically
  (`feat: frontmatter validation script (SB-016)`) + push. Then SB-017 (immutability checks) finishes Phase 1F.
- **Scope delivered:** `@sb/note-vault` read-only API — `listNotes(workspace,{type?})` → `NoteSummary[]`
  (`id/type/title/layer/path`, ULID-sorted) and `getNote(workspace,id)` → verbatim content;
  `NoteReadError` (`unsafe_path`/`invalid_ulid`/`not_found`/`read_failed`). Frontmatter read via targeted
  field-extraction (no YAML dep); `getNote` returns raw content (correct regardless of frontmatter).
  `@sb/cli` added `note list` / `note get <id>` (reuses capture path-safety via exported
  `resolveSafeWorkspace`). Both commands are READ-ONLY (verified: raw count + event lines unchanged).
- **Note:** the card's "type/folder" filter is implemented as `--type` (schema-backed discriminator);
  folder filtering deferred. **Out of scope (SB-015):** search/retrieval (Phase 3), facts query, mutation.
- **No new dependency.** Fixed a `pnpm run … --` separator bug in the `note` subcommand parser (smoke-caught).
- **Files changed (SB-015):** `packages/note-vault/src/{read-notes.ts(new),errors.ts,index.ts}`,
  `packages/note-vault/{package.json,README.md}`, `packages/note-vault/test/read-notes.test.ts(new)`;
  `apps/cli/src/{note-command.ts(new),index.ts,capture-command.ts}`, `apps/cli/{package.json,README.md}`,
  `apps/cli/test/note-command.test.ts(new)`; `docs/planning/{story_backlog.md,phase_1_story_map.md}`,
  `STATUS.md`. (No `pnpm-lock.yaml` change — no new deps.)
- **Validation run (green):** tests — note-vault **18/18**, event-log 5/5, cli **14/14**; builds —
  note-vault/event-log/cli `tsc --noEmit` exit 0; real CLI smoke (capture → `note list` shows it →
  `note get <id>` prints it; absent id → exit 1); leakage grep → only negative `source:"broker"` tests.
- **Next recommended action:** human reviews the read API + commands; on approval, commit SB-015
  atomically (`feat: read-only note list/get (SB-015)`) + push. That completes Phase 1E → Phase 1F
  (SB-016 frontmatter validation, SB-017 immutability checks).
- **Scope delivered:** `@sb/cli` `capture` — the first end-to-end path. `runCapture()` generates ULID
  note + event ids (dependency-free `src/ulid.ts`), one shared `captured_at`, calls `writeRawNote()`
  (SB-011) then `appendCaptureEvent()` (SB-014), prints `{ok,note_id,note_path,event_id,event_path,
  captured_at}` to stdout. Reads `--content` or stdin. Event payload links back to the raw note
  (`note_id`, relative `note_path`, `source`, `title?`, `tags?`, `ref?`). Structured `CaptureCliError`
  to stderr + non-zero exit. Partial-failure: raw note kept if event append fails.
- **No new dependency:** ULID generated by a local ~30-line spec-compliant generator (validated by
  `@sb/interfaces.isUlid`) to avoid network/offline risk. Workspace path-safety REUSES
  `resolveWorkspaceConfig` (SB-002) + a CLI broad-path guard (rejects `/`, single-segment roots, home
  dir, repo-containing paths) — no duplication.
- **Deviation:** `00_Inbox/` L1 stub NOT created (deferred with SB-011); tracked for a later
  capture-orchestration story. **Out of scope (SB-013):** list/get, validation, retrieval, AI, sidecars,
  dashboard, Obsidian, broker, DB, non-paste adapters.
- **Files changed (SB-013):** `apps/cli/{package.json,tsconfig.json,README.md}`,
  `apps/cli/src/{index.ts,capture-command.ts,ulid.ts}`, `apps/cli/test/capture-command.test.ts`,
  `pnpm-lock.yaml` (new `@sb/cli` importer), `docs/planning/{story_backlog.md,phase_1_story_map.md}`,
  `STATUS.md`. (No `scripts/lib/*` changes — the CLI imports the existing helper as-is.)
- **Validation run (green):** `pnpm install` → ok; tests — note-vault 13/13, event-log 5/5, **cli 9/9**;
  builds — note-vault/event-log/cli `tsc --noEmit` exit 0; real end-to-end smoke (flag + stdin) wrote
  raw notes + event lines, bad source exits 1; domain-leakage grep → only negative `source:"broker"`
  test + anti-leakage assertion + pre-existing rules (CLI source files clean).
- **Next recommended action:** human reviews the capture path; on approval, commit SB-013 atomically
  (`feat: CLI capture command (SB-013)`) + push. Then SB-015 (list/get) to finish Phase 1E.
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
