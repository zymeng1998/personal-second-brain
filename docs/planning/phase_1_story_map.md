# Phase 1 Story Map

Phase 1 (MVP core) decomposed into small, reviewable sub-phases. Each sub-phase ends at a **mandatory
human-review stop point**. No implementation starts unless the story is `Ready` with acceptance criteria
(see [`backlog_workflow.md`](backlog_workflow.md)). Story details: [`story_backlog.md`](story_backlog.md).

> **Critical-path ordering:** 1A → 1B → 1C → 1D → 1E → 1F → 1G. Schemas (1B) must finalize before the
> write paths (1C/1D), which must exist before CLI capture (1E), which must work before validation/safety
> (1F) and the final review/commit (1G).

---

## Phase 1A — Workspace Initialization

- **Objective:** A safe, idempotent, documented initializer that creates the external workspace tree
  (no real data), with env loading, path-safety, dry-run, and a verify command.
- **Stories:** SB-001, SB-002, SB-003, SB-004, SB-005, SB-006, SB-007 (EPIC-CORE-001).
- **Dependencies:** Phase 0 scaffold (`Done`).
- **Expected files changed:** `scripts/init_workspace.ts` (+ optional `scripts/verify_workspace.ts`),
  `package.json` (script aliases), optional `packages/note-vault/src/paths.ts`. **Workspace content is
  generated outside the repo and never committed.**
- **Acceptance criteria (sub-phase):**
  - `init_workspace` creates the documented tree, empty event files, and workspace READMEs; is
    idempotent; supports `--dry-run` (no writes) and a verify check.
  - Path-safety refuses relative paths, repo-internal paths, and never overwrites existing data.
  - No real data is committed; `git diff` is limited to scripts/config.
- **Stop point:** Human reviews the initializer + a real run against a throwaway workspace path; verify
  command green. Commit `feat: workspace initializer (Phase 1A)`.

## Phase 1B — Schema Finalization

- **Objective:** Promote the skeleton schemas to v1 and define the v0 capture interface.
- **Stories:** SB-008 (frontmatter v1), SB-009 (event v1), SB-010 (capture interface v0) (EPIC-CORE-002).
- **Dependencies:** Phase 1A `Done`.
- **Expected files changed:** `schemas/markdown/frontmatter.schema.json`, `schemas/json/event.schema.json`,
  `schemas/json/capture.schema.json`, `packages/interfaces/src/*`, `examples/notes/*`,
  `examples/captures/*`, `docs/planning/open_questions.md`.
- **Acceptance criteria (sub-phase):**
  - All three schemas are v1 (no DRAFT marker), validate example fixtures, and are domain-neutral.
  - `interfaces` v0 types compile and align field-for-field with the schemas.
  - Open questions #1, #2, #3 marked resolved.
- **Stop point:** Human reviews schema decisions (id scheme, required fields, event envelope). Commit
  `feat: schemas v1 + interfaces v0 (Phase 1B)`.

## Phase 1C — Vault Write Path

- **Objective:** Write L0 raw notes and enforce raw immutability.
- **Stories:** SB-011 (raw write contract), SB-012 (immutability guard) (EPIC-CORE-003).
- **Dependencies:** SB-008, SB-010 (`Done`).
- **Expected files changed:** `packages/note-vault/src/*` + tests.
- **Acceptance criteria (sub-phase):**
  - Writing a capture produces a schema-valid `00_Raw/<id>.md` + an `00_Inbox/` stub linking to it.
  - Overwriting/deleting a raw file via the vault API is rejected; bytes unchanged; new raw notes still write.
- **Stop point:** Human reviews the write path + guard; immutability tests green. Commit
  `feat: vault raw write + immutability guard (Phase 1C)`.

## Phase 1D — Event Log Write Path

- **Objective:** Append schema-valid capture events to JSONL, append-only.
- **Stories:** SB-014 (write capture event) (EPIC-CORE-005). *(Depends on event files from SB-004.)*
- **Dependencies:** SB-009, SB-004 (`Done`).
- **Expected files changed:** `packages/event-log/src/*` + tests.
- **Acceptance criteria (sub-phase):**
  - Appending adds exactly one valid line; earlier lines untouched; events validate against event v1.
- **Stop point:** Human reviews append semantics + ordering. Commit `feat: event-log capture append (Phase 1D)`.

## Phase 1E — CLI Capture MVP

- **Objective:** End-to-end manual capture via the CLI, plus read-only list/get.
- **Stories:** SB-013 (capture command), SB-015 (list/get) (EPIC-CORE-004).
- **Dependencies:** SB-011, SB-012, SB-014 (`Done`); SB-015 needs SB-011.
- **Expected files changed:** `apps/cli/src/*`, `package.json` (bin/scripts), optional `packages/note-vault` read helpers.
- **Acceptance criteria (sub-phase):**
  - `capture` writes raw note + inbox stub + capture event and prints the id; bad input rejected cleanly.
  - `note list` / `note get <id>` are read-only and surface captured notes via interfaces (no direct fs).
- **Stop point:** Human runs capture→list→get against a throwaway workspace. Commit `feat: CLI capture MVP (Phase 1E)`.

## Phase 1F — Validation & Safety Checks

- **Objective:** Validate frontmatter across the vault and lock in the raw-immutability invariant with tests.
- **Stories:** SB-016 (frontmatter validation script), SB-017 (immutability checks/tests) (EPIC-CORE-006).
- **Dependencies:** SB-008, SB-012 (`Done`).
- **Expected files changed:** `scripts/validate_notes.ts`, tests under `packages/note-vault/`,
  `package.json` (test script), fixtures under `examples/`.
- **Acceptance criteria (sub-phase):**
  - `validate:notes` passes on a good vault and fails with detail on a seeded-bad fixture; read-only.
  - Immutability tests (overwrite-rejected, delete-rejected) pass under `pnpm test`.
- **Stop point:** Human reviews validation output + test results. Commit `test: validation + immutability checks (Phase 1F)`.

## Phase 1G — Review and Commit

- **Objective:** Consolidate, update docs/STATUS, confirm MVP acceptance criteria, final review.
- **Stories:** SB-018 (docs/STATUS update) (EPIC-CORE-001..006).
- **Dependencies:** SB-007, SB-013, SB-016, SB-017 (`Done`).
- **Expected files changed:** `STATUS.md`, `README.md`, `docs/planning/*`.
- **Acceptance criteria (sub-phase):**
  - All MVP acceptance criteria in [`mvp_scope.md`](mvp_scope.md) hold; README getting-started works;
    docs consistent with behavior; **no domain leakage** (grep clean).
- **Stop point:** Final Phase 1 human review. Commit `docs: Phase 1 complete + STATUS` and tag/checkpoint.

---

## Phase 1H — (Conditional) Minimal Distillation — OPEN QUESTION

- **Status:** Not scheduled in 1A–1G. **Conflict to resolve:** [`mvp_scope.md`](mvp_scope.md) lists a
  "minimal human-confirmed distillation skill" as part of MVP, but the requested Phase 1 sub-phases
  (1A–1G) end at review/commit and do not include it.
- **Options for the human:** (a) add **Phase 1H** to implement SB-019 within the MVP; or (b) re-scope
  distillation out of the MVP and into Phase 2. Until decided, SB-019 stays `Backlog` and the MVP is
  treated as capture+validate only.

---

## Next implementation unit

**Phase 1A** is in progress. **SB-001 and SB-002 are `Done`** (each an atomic commit per the Atomic Story
Rule). The next story to implement is:

> **SB-006 — Add dry-run support for the initializer** · P1 · 2 pts · `Ready` · depends on SB-001 (`Done`).

Start SB-006 only on human approval. Remaining 1A order: SB-006 → SB-003 → SB-004 → SB-005 → SB-007,
observing the 1A stop point before Phase 1B. Each story is committed atomically after review.

*(Suggested within-1A order: SB-001 skeleton, SB-002 env/path-safety, SB-006 dry-run, then SB-003 tree,
SB-004 event files, SB-005 READMEs, SB-007 verify — so the safe dry-run path exists before any real writes.)*
