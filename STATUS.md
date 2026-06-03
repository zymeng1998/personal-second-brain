# STATUS

**Project:** personal-second-brain (Second Brain Core)
**Phase:** Phase 1B — Schema Finalization (COMPLETE — SB-008/009/010 Done; at mandatory stop point)
**Last updated:** 2026-06-03

## Workflow rule in effect
- **Atomic Story Rule (MANDATORY):** each story is implemented, reviewed, validated, and committed as one
  atomic unit; one atomic commit per reviewed story (only directly-related files); do not start the next
  story until the current one is reviewed and committed; no story > 5 points enters implementation. At every
  stop point STATUS.md records: current story ID, status, files changed, validation run, next action — so an
  interrupted session resumes from `git log` + `STATUS.md` + `story_backlog.md`. Full text:
  `docs/planning/backlog_workflow.md`.

## Stop point — Phase 1B COMPLETE (EPIC-CORE-002, all 3 stories Done)
- **Done (atomic commits):** SB-008 (frontmatter v1, `fb00c5d`), SB-009 (event v1, `0b9d7c8`),
  SB-010 (capture interface v0, this commit). **Phase 1B complete — mandatory human review point.**
- **Next phase:** Phase 1C — Vault Write Path (SB-011 raw write contract, then SB-012 immutability guard).
  Do not start until the 1B schema decisions are reviewed.
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
