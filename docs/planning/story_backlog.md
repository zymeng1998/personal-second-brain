# Story Backlog — Second Brain Core

JIRA-style backlog. Process and definitions: [`backlog_workflow.md`](backlog_workflow.md).
Phase 1 sequencing: [`phase_1_story_map.md`](phase_1_story_map.md).

> **Format note.** The 15-field story structure is impractical as a single Markdown table. This doc
> uses a **scannable summary table** (ID/Type/Title/Epic/Priority/Status/Points/Deps) followed by
> **detailed story cards** carrying the long fields (Scope, Acceptance Criteria, Definition of Done,
> Validation, Files Expected to Change, Out of Scope, Notes). Phase 1 stories are fully detailed;
> later-epic stories are coarse and remain `Backlog`/`Deferred` until refined.

> **Status snapshot.** Phase 0 (scaffold) is `Done`. Phase 1 stories below are `Ready` only where their
> dependencies permit; the rest are `Backlog`. `EPIC-DOMAIN-001` (broker) is `Deferred`.

---

## Epics

| Epic ID | Title | Phase | Priority | Status | Summary |
|---|---|---|---|---|---|
| EPIC-CORE-001 | Workspace & Local-First Foundation | 1A | P0 | Done | Create the external workspace tree safely; no real data. |
| EPIC-CORE-002 | Interfaces & Schemas | 1B | P0 | Done | Finalize frontmatter v1, event v1, capture interface v0. |
| EPIC-CORE-003 | Markdown Vault & Raw Immutability | 1C | P0 | Done | Raw note write contract + immutability guard (L0). |
| EPIC-CORE-005 | Event Log & Audit Spine | 1D | P0 | Done | Append-only JSONL capture events. |
| EPIC-CORE-004 | CLI Capture MVP | 1E | P0 | Done | Minimal CLI capture + read-only list/get. |
| EPIC-CORE-006 | Note Validation | 1F | P0 | Done | Frontmatter validation + immutability checks. |
| EPIC-CORE-007 | Human-Confirmed Distillation Workflow | 1H | P1 | Done | Minimal human-confirmed L1→L2 (SB-019/024/025/026/027 Done). Phase 1H complete. L3 facts moved to Phase 2. |
| EPIC-CORE-008 | Structured Projections | 2 | P1 | Refined | fact-store / entity-graph / task-store + replay (SQLite, rebuildable). Decomposed into ≤3-pt stories (SB-020/034/023/035/036/021/037/022/038/039); see [`phase_2_story_map.md`](phase_2_story_map.md). |
| EPIC-CORE-009 | Retrieval Sidecar | 3 | P1 | Backlog | Python DuckDB+BGE-M3 retrieval over stdio JSONL. |
| EPIC-CORE-010 | Surfaces | 5 | P2 | Backlog | Obsidian helper, then dashboard. |
| EPIC-CORE-011 | Security & Privacy Hardening | cross | P0/P1 | Backlog | secure_refs, permission scopes, secret handling. |
| EPIC-CORE-012 | Domain App Boundary | 4–6 | P1 | Backlog | Capability/scope model + generic example-readonly smoke test. |
| EPIC-DOMAIN-001 | Broker Domain App | 6+ | P3 | **Deferred** | Broker tool, docs-only until core is stable. **Not planned in detail.** |

---

## Story summary

### Phase 1 (detailed below)

| ID | Type | Title | Epic | Pri | Status | SP | Dependencies |
|---|---|---|---|---|---|---|---|
| SB-001 | Story | Implement workspace initializer (entry + skeleton) | EPIC-CORE-001 | P0 | **Done** | 2 | — |
| SB-002 | Story | Add environment loading & path-safety checks | EPIC-CORE-001 | P0 | **Done** | 3 | SB-001 |
| SB-003 | Story | Create workspace tree exactly as documented | EPIC-CORE-001 | P0 | **Done** | 2 | SB-002 |
| SB-004 | Story | Create append-only event files (empty) | EPIC-CORE-001 | P0 | **Done** | 1 | SB-003 |
| SB-005 | Story | Create workspace README & safety README files | EPIC-CORE-001 | P0 | **Done** | 1 | SB-003 |
| SB-006 | Story | Add dry-run support for the initializer | EPIC-CORE-001 | P1 | **Done** | 2 | SB-001 |
| SB-007 | Story | Add validation commands for workspace init | EPIC-CORE-001 | P0 | **Done** | 2 | SB-003, SB-004, SB-005 |
| SB-008 | Story | Define frontmatter schema v1 | EPIC-CORE-002 | P0 | Done | 3 | — (Phase 1A done) |
| SB-009 | Story | Define event schema v1 | EPIC-CORE-002 | P0 | Done | 3 | — |
| SB-010 | Story | Define capture interface v0 | EPIC-CORE-002 | P0 | Done | 3 | SB-008, SB-009 |
| SB-011 | Story | Implement raw note write contract | EPIC-CORE-003 | P0 | Done | 3 | SB-008, SB-010 |
| SB-012 | Story | Implement raw immutability guard | EPIC-CORE-003 | P0 | Done | 3 | SB-011 |
| SB-013 | Story | Implement minimal CLI capture command | EPIC-CORE-004 | P0 | Done | 3 | SB-011, SB-012, SB-014 |
| SB-014 | Story | Write capture event to JSONL | EPIC-CORE-005 | P0 | Done | 2 | SB-009, SB-004 |
| SB-015 | Story | Add note listing / read-only query command | EPIC-CORE-004 | P0 | Done | 2 | SB-011 |
| SB-016 | Story | Implement frontmatter validation script | EPIC-CORE-006 | P0 | Done | 3 | SB-008 |
| SB-017 | Story | Add checks/tests for raw immutability | EPIC-CORE-006 | P0 | Done | 2 | SB-012 |
| SB-018 | Story | Update documentation & STATUS after Phase 1 | EPIC-CORE-001..006 | P0 | Done | 1 | SB-007, SB-013, SB-016, SB-017 |

### Phase 1H — Minimal Human-Confirmed Distillation (detailed below)

Old `5→split` SB-019 decomposed into ≤3-pt stories. L2-only (L3 facts → Phase 2). Cards below.

| ID | Type | Title | Epic | Pri | Status | SP | Dependencies |
|---|---|---|---|---|---|---|---|
| SB-019 | Story | Distillation proposal contract (interfaces) | EPIC-CORE-007 | P1 | Done | 2 | SB-010 |
| SB-024 | Story | L2 distilled-note writer (note-vault) | EPIC-CORE-007 | P1 | Done | 3 | SB-019, SB-011 |
| SB-025 | Story | Memory-stream event append (event-log) | EPIC-CORE-007 | P1 | Done | 2 | SB-009, SB-014 |
| SB-026 | Story | CLI `distill` command (propose + accept) | EPIC-CORE-007 | P1 | Done | 3 | SB-024, SB-025 |
| SB-027 | Story | Distillation skill + L0/L1 safety check | EPIC-CORE-007 | P1 | Done | 2 | SB-026 |

### Phase 1 review follow-ups (backlog; from the 2026-06-05 final review)

| ID | Type | Title | Epic | Pri | Status | SP | Dependencies |
|---|---|---|---|---|---|---|---|
| SB-028 | Story | Record multi-source provenance on the L2 note | EPIC-CORE-007 | P2 | Backlog | 2 | SB-024, SB-026 |
| SB-029 | Story | L1 working-note creation so `distill propose` has candidates | EPIC-CORE-007 | P2 | Backlog | 3 | SB-026 |
| SB-033 | Story | Test-coverage measurement + `init_workspace` automated test | EPIC-CORE-001 | P2 | Backlog | 3 | — |

### Phase 2 — Structured Projections (EPIC-CORE-008, refined; see [`phase_2_story_map.md`](phase_2_story_map.md))

Decomposed from the old `5→split` SB-020/021/023 (split rule). **`Backlog` — refined, not yet `Ready`**;
promote after the open decisions in the story map are confirmed at review. Cards below.

| ID | Type | Title | Epic | Pri | Status | SP | Dependencies |
|---|---|---|---|---|---|---|---|
| SB-020 | Story | Fact + projection contracts (interfaces) | EPIC-CORE-008 | P1 | In Review | 2 | SB-009, SB-010 |
| SB-034 | Story | Projection store bootstrap (SQLite `db/memory.sqlite`) | EPIC-CORE-008 | P1 | In Review | 3 | SB-020 |
| SB-023 | Story | Replay projector core (pure event→state fold) | EPIC-CORE-008 | P1 | In Review | 3 | SB-034 |
| SB-035 | Story | fact-store table + `addFact` (ADD-only) | EPIC-CORE-008 | P1 | In Review | 3 | SB-023 |
| SB-036 | Story | fact-store `supersedeFact` + current-facts query | EPIC-CORE-008 | P1 | Backlog | 3 | SB-035 |
| SB-021 | Story | entity-graph nodes projection | EPIC-CORE-008 | P1 | Backlog | 3 | SB-023 |
| SB-037 | Story | entity-graph edges + manual-confirm `entity_merged` | EPIC-CORE-008 | P1 | Backlog | 3 | SB-021 |
| SB-022 | Story | task-store projection | EPIC-CORE-008 | P2 | Backlog | 3 | SB-023 |
| SB-038 | Story | Replay rebuild command (drop `db/` → rebuild + events) | EPIC-CORE-008 | P1 | Backlog | 3 | SB-035, SB-021 |
| SB-039 | Story | Replay reproducibility gate (drop+replay identical) | EPIC-CORE-008 | P1 | Backlog | 2 | SB-038 |

### Later phases (coarse; refine before implementation)

| ID | Type | Title | Epic | Pri | Status | SP | Dependencies |
|---|---|---|---|---|---|---|---|
| SB-030 | Story | Retrieval sidecar skeleton (stdio JSONL contract) | EPIC-CORE-009 | P1 | Backlog | 5→split | SB-009, SB-010 |
| SB-031 | Story | DuckDB + BGE-M3 index build | EPIC-CORE-009 | P1 | Backlog | 5→split | SB-030 |
| SB-032 | Story | TS retrieval facade + query command | EPIC-CORE-009 | P1 | Backlog | 5→split | SB-031 |
| SB-040 | Story | Obsidian helper (optional surface) | EPIC-CORE-010 | P2 | Backlog | 5→split | SB-010 |
| SB-041 | Story | Web dashboard (capture/review) | EPIC-CORE-010 | P2 | Backlog | 8→split | SB-010 |
| SB-050 | Story | secure_refs pointer pattern impl | EPIC-CORE-011 | P0 | Backlog | 3 | SB-010 |
| SB-051 | Story | Permission/scope model in interfaces | EPIC-CORE-011 | P1 | Backlog | 5→split | SB-010 |
| SB-052 | Story | Scope enforcement at the interfaces boundary | EPIC-CORE-011 | P1 | Backlog | 5→split | SB-051 |
| SB-060 | Story | Capability/scope contract for domain apps | EPIC-CORE-012 | P1 | Backlog | 3 | SB-051 |
| SB-061 | Story | Generic `domain-apps/example-readonly/` smoke test | EPIC-CORE-012 | P1 | Backlog | 3 | SB-015, SB-060 |
| SB-900 | Epic-stub | Broker domain app | EPIC-DOMAIN-001 | P3 | **Deferred** | — | Core stable + SB-060/061 |

> Stories marked `5→split` or `8→split` **must be decomposed** into ≤3-point stories during refinement
> before they can become `Ready` (project split rule). They are intentionally left coarse now.

---

# Phase 1 story cards

Project-wide **Definition of Done** (applies to every story, in addition to story-specific DoD):
no domain/broker leakage into `packages/` or `schemas/`; no real data committed; raw (L0) never
overwritten; events append-only; AC met; listed validation commands pass; `git diff` limited to listed
files; STATUS/docs updated where the story says so; human review at the sub-phase stop point.

---

## SB-001 — Implement workspace initializer (entry + skeleton)

- **Type:** Story · **Epic:** EPIC-CORE-001 · **Priority:** P0 · **Points:** 2 · **Status:** Done
- **Dependencies:** none
- **Scope:** Replace the `scripts/init_workspace.ts` stub with a real entry point: argument parsing
  (`--dry-run`, `--help`), structured logging, and a top-level `main()` that wires the (not-yet-built)
  steps with clear ordering. No tree creation yet — steps are stubbed functions that log intent.
- **Acceptance Criteria:**
  - Running the script prints a clear plan of steps and exits 0 with `--help`.
  - Without flags it reports "not yet creating anything" (steps not implemented until SB-003) and exits
    non-zero with a clear message, OR exits 0 if `--dry-run` (see SB-006) — pick one and document it.
  - No filesystem writes occur in SB-001.
- **Definition of Done:** Entry point + arg parsing exist; structured, ordered step scaffold present;
  unit/smoke check that `--help` works.
- **Validation:**
  - `pnpm tsx scripts/init_workspace.ts --help` → prints usage, exit 0.
  - `git diff --stat` shows only `scripts/init_workspace.ts` (+ `package.json` if a script alias added).
- **Files Expected to Change:** `scripts/init_workspace.ts`; possibly `package.json` (script alias).
- **Out of Scope:** Creating any directory/file; env loading; path safety; dry-run output detail
  (SB-002/003/006).
- **Notes:** This is the recommended first story. Keep it a thin, safe skeleton.

## SB-002 — Add environment loading & path-safety checks

- **Type:** Story · **Epic:** EPIC-CORE-001 · **Priority:** P0 · **Points:** 3 · **Status:** Done
- **Dependencies:** SB-001
- **Scope:** Load `SECOND_BRAIN_WORKSPACE` (and derived paths) from `.env`/env. Add defensive checks:
  path must be **absolute**; must **not** be inside the git repo / `personal-second-brain/`; parent must
  exist or be creatable; warn if it already contains data; handle spaces/Unicode in paths; fail fast with
  actionable messages.
- **Acceptance Criteria:**
  - Missing/empty `SECOND_BRAIN_WORKSPACE` → clear error, non-zero exit, no writes.
  - Relative path or path inside the repo → refused with explanation.
  - Existing non-empty workspace → explicit warning; never auto-overwrites.
  - Paths with spaces/Unicode are handled correctly.
- **Definition of Done:** Env/path resolution centralized; all failure modes covered by checks with
  friendly messages.
- **Validation:**
  - `SECOND_BRAIN_WORKSPACE= pnpm tsx scripts/init_workspace.ts` → error, exit ≠ 0.
  - `SECOND_BRAIN_WORKSPACE=relative/path pnpm tsx scripts/init_workspace.ts` → refused.
  - `SECOND_BRAIN_WORKSPACE="$PWD" pnpm tsx scripts/init_workspace.ts` → refused (inside repo).
- **Files Expected to Change:** `scripts/init_workspace.ts`; optionally a small helper in
  `packages/note-vault/src/paths.ts` (domain-neutral path utils).
- **Out of Scope:** Actually creating the tree (SB-003); .env parsing library choice is implementer's
  call but must be local-only.
- **Notes:** Aligns with privacy rules (data outside repo) and macOS path quoting lessons.

## SB-003 — Create workspace tree exactly as documented

- **Type:** Story · **Epic:** EPIC-CORE-001 · **Priority:** P0 · **Points:** 2 · **Status:** Done
- **Dependencies:** SB-002
- **Scope:** Create the workspace directory tree exactly per
  [`repo_structure.md`](repo_structure.md): `vault/{00_Raw,00_Inbox,10_Projects,20_Areas,30_Resources,40_Archives,50_Entities,60_Outputs,70_Daily,80_Wiki,90_System}`,
  `events/`, `db/backups/`, `indexes/{full_text,vector,graph,temporal}`, `attachments/non_sensitive`,
  `secure_refs/`, `logs/{capture_logs,extraction_logs,indexing_logs}`. Idempotent (safe to re-run).
- **Acceptance Criteria:**
  - All documented directories exist after a run; re-running is a no-op (no errors, no duplication).
  - No real data files are written (only directories; event files come from SB-004; READMEs from SB-005).
  - `00_Raw/` exists and is documented as immutable.
- **Definition of Done:** Tree matches `repo_structure.md` exactly; idempotency verified.
- **Validation:**
  - Run, then `find "$SECOND_BRAIN_WORKSPACE" -type d | sort` matches the documented tree.
  - Re-run → exit 0, no changes.
- **Files Expected to Change:** `scripts/init_workspace.ts`.
- **Out of Scope:** Event files (SB-004), READMEs (SB-005), seeding templates/notes.
- **Notes:** Tree is the single source of truth in `repo_structure.md`; if they diverge, fix the doc or
  the code in the same story and note it.

## SB-004 — Create append-only event files (empty)

- **Type:** Story · **Epic:** EPIC-CORE-001 · **Priority:** P0 · **Points:** 1 · **Status:** Done
- **Dependencies:** SB-003
- **Scope:** Create empty `events/{capture_events,memory_events,projection_events}.jsonl` if absent.
  Never truncate or overwrite existing files (append-only source of truth).
- **Acceptance Criteria:**
  - The three `.jsonl` files exist after a run.
  - Re-running does **not** truncate or modify existing event files (verified by size/hash unchanged).
- **Definition of Done:** Files created only when missing; existing content preserved.
- **Validation:**
  - Run; `ls "$SECOND_BRAIN_WORKSPACE/events"` shows the 3 files.
  - Append a test line manually, re-run init, confirm the line is still present.
- **Files Expected to Change:** `scripts/init_workspace.ts`.
- **Out of Scope:** Writing real events (SB-014); event schema (SB-009).
- **Notes:** Distinct from disposable `logs/`.

## SB-005 — Create workspace README & safety README files

- **Type:** Story · **Epic:** EPIC-CORE-001 · **Priority:** P0 · **Points:** 1 · **Status:** Done
- **Dependencies:** SB-003
- **Scope:** Write a top-level `workspace/README.md` (what lives here, what is authoritative vs
  rebuildable, "never commit this") and `secure_refs/README.md` (metadata-only pointer pattern; no
  sensitive content). Generated into the workspace, not the repo.
- **Acceptance Criteria:**
  - Both README files exist in the workspace after a run.
  - Content states: data lives outside the repo; `00_Raw/` immutable; `events/` is source of truth;
    `indexes/`+`db/` rebuildable; secure_refs hold pointers only.
- **Definition of Done:** READMEs present, accurate, consistent with privacy doc.
- **Validation:** `test -f "$SECOND_BRAIN_WORKSPACE/README.md" && test -f "$SECOND_BRAIN_WORKSPACE/secure_refs/README.md"`.
- **Files Expected to Change:** `scripts/init_workspace.ts` (it writes the files); optionally template
  strings under `scripts/` or `packages/note-vault/src/`.
- **Out of Scope:** Vault note templates in `90_System/` (later).
- **Notes:** These READMEs are workspace content, never committed to the repo.

## SB-006 — Add dry-run support for the initializer

- **Type:** Story · **Epic:** EPIC-CORE-001 · **Priority:** P1 · **Points:** 2 · **Status:** Done
- **Dependencies:** SB-001
- **Scope:** `--dry-run` prints exactly what would be created (dirs + files) without touching the
  filesystem. Shared with the real path so the plan can't drift from behavior.
- **Acceptance Criteria:**
  - `--dry-run` produces zero filesystem changes.
  - Output lists every directory/file the real run would create, in order.
- **Definition of Done:** Dry-run and real run share one plan; verified no writes in dry-run.
- **Validation:**
  - `pnpm tsx scripts/init_workspace.ts --dry-run` then `git status`/`find` shows no new files.
- **Files Expected to Change:** `scripts/init_workspace.ts`.
- **Out of Scope:** Diffing against an existing workspace state.
- **Notes:** Strongly recommended to land alongside SB-003 for safe iteration.

## SB-007 — Add validation commands for workspace init

- **Type:** Story · **Epic:** EPIC-CORE-001 · **Priority:** P0 · **Points:** 2 · **Status:** Done
- **Dependencies:** SB-003, SB-004, SB-005 (all `Done`)
- **Scope:** Provide a repeatable check (script target or documented command sequence) that asserts the
  workspace matches `repo_structure.md`: all dirs present, 3 event files present, READMEs present, and
  no unexpected extra top-level entries.
- **Acceptance Criteria:**
  - A single command returns success on a correctly initialized workspace and a clear failure otherwise.
  - The check is read-only.
- **Definition of Done:** Check exists, documented in README/STATUS; green on a fresh init.
- **Validation:** `pnpm tsx scripts/init_workspace.ts --verify` (or documented `find`/`test` sequence) → exit 0.
- **Files Expected to Change:** `scripts/init_workspace.ts` (add `--verify`) or a small `scripts/verify_workspace.ts`; `package.json`.
- **Out of Scope:** Frontmatter validation (SB-016); event content validation.
- **Notes:** Becomes `Ready` once SB-003–005 are `Done`.

## SB-008 — Define frontmatter schema v1

- **Type:** Story · **Epic:** EPIC-CORE-002 · **Priority:** P0 · **Points:** 3 · **Status:** Done
- **Dependencies:** Phase 1A `Done`
- **Scope:** Finalize `schemas/markdown/frontmatter.schema.json` from skeleton to v1: required/optional
  fields per note type (raw/working/distilled/entity/project/concept/case/daily/output), id scheme
  (ULID recommended), provenance fields, link fields. Resolve open questions #1, #3.
- **Acceptance Criteria:**
  - Schema validates a set of example notes (one per type) under `examples/notes/`.
  - Every required field has a clear definition; `$comment` "DRAFT" removed; versioned `v1`.
- **Definition of Done:** Schema v1 finalized; examples added; open questions #1/#3 marked resolved.
- **Validation:** `node` + a JSON-Schema validator (e.g. ajv) over `examples/notes/*.md` frontmatter → all valid.
- **Files Expected to Change:** `schemas/markdown/frontmatter.schema.json`; `examples/notes/*`;
  `docs/planning/open_questions.md`.
- **Out of Scope:** Validation script (SB-016); SQL projections.
- **Notes:** Decision-bearing; domain-neutral fields only.

## SB-009 — Define event schema v1

- **Type:** Story · **Epic:** EPIC-CORE-002 · **Priority:** P0 · **Points:** 3 · **Status:** Done
- **Dependencies:** Phase 1A `Done`
- **Scope:** Finalize `schemas/json/event.schema.json` to v1: envelope fields, per-stream kinds
  (capture/memory/projection), actor convention, provenance, timestamps. Resolve open question #2.
- **Acceptance Criteria:**
  - Schema validates example event lines (one per stream/kind).
  - Append-only/never-rewrite semantics documented in the schema doc.
- **Definition of Done:** Event v1 finalized; examples validate; open question #2 resolved.
- **Validation:** validator over `examples/captures/*.jsonl` (sample lines) → valid.
- **Files Expected to Change:** `schemas/json/event.schema.json`; `examples/captures/*`;
  `docs/planning/open_questions.md`.
- **Out of Scope:** Writing events (SB-014); replay (SB-023).
- **Notes:** Keep forward-compatible (preserve unknown fields on replay).

## SB-010 — Define capture interface v0

- **Type:** Story · **Epic:** EPIC-CORE-002 · **Priority:** P0 · **Points:** 3 · **Status:** Done
- **Dependencies:** SB-008, SB-009
- **Scope:** Define the v0 operation contracts in `packages/interfaces`: `capture`, `getNote`,
  `listNotes`, `appendEvent` — typed inputs/outputs aligned to the schemas; finalize
  `schemas/json/capture.schema.json`. TS types only (no implementation of the operations here).
- **Acceptance Criteria:**
  - TS types/contracts compile; align field-for-field with the JSON schemas.
  - Each operation documents inputs, outputs, errors, and required permission scope (design-level).
- **Definition of Done:** `interfaces` v0 published within the workspace packages; capture schema v1.
- **Validation:** `pnpm -C packages/interfaces tsc --noEmit` (or repo-level typecheck) passes.
- **Files Expected to Change:** `packages/interfaces/src/*`; `schemas/json/capture.schema.json`.
- **Out of Scope:** Operation implementations (SB-011/013/014/015); scope enforcement (SB-052).
- **Notes:** This is the stable boundary; keep it domain-neutral and minimal.

## SB-011 — Implement raw note write contract

- **Type:** Story · **Epic:** EPIC-CORE-003 · **Priority:** P0 · **Points:** 3 · **Status:** Done
- **Dependencies:** SB-008, SB-010
- **Scope:** In `packages/note-vault`, implement writing an L0 raw note to `vault/00_Raw/<id>.md` with
  valid frontmatter and verbatim content. Create the matching L1 stub note in `00_Inbox/` referencing
  the raw id. Immutable-by-convention (guard enforced in SB-012).
- **Acceptance Criteria:**
  - Writing a capture produces a well-formed `00_Raw/<id>.md` (validates against frontmatter v1) and an
    `00_Inbox/` stub linking to it.
  - Content is stored verbatim (byte-faithful for text).
- **Definition of Done:** Write path implemented + unit-tested; validates against schema.
- **Validation:** unit test writes a note and asserts file exists + frontmatter valid + `source_ref` set.
- **Files Expected to Change:** `packages/note-vault/src/*`; tests.
- **Out of Scope:** Immutability enforcement (SB-012); event emission (SB-014); CLI (SB-013).
- **Notes:** No domain fields.
- **Implementation note (scope split, In Review):** Per explicit human instruction, SB-011 was
  delivered as the **low-level raw write primitive only** (`writeRawNote()` → `vault/00_Raw/<id>.md`
  or `<id>--<slug>.md`, exclusive-create, verbatim body, structured errors, 8 passing tests). The
  **`00_Inbox/` L1 stub** part of the original AC is **deferred** to capture orchestration (recommend
  tracking under SB-013) so this story stays atomic. Raw frontmatter uses schema-exact required fields
  (`id`/`type:raw`/`layer:0`/`created`, no `updated`); capture source kind + external `ref` are carried
  as additive provenance metadata (`source: { kind, ref }`) permitted by the schema's
  `additionalProperties: true`. A raw (L0) note has **no `source_ref`** (it is the origin), so that part
  of the illustrative validation does not apply to the raw note itself.

## SB-012 — Implement raw immutability guard

- **Type:** Story · **Epic:** EPIC-CORE-003 · **Priority:** P0 · **Points:** 3 · **Status:** Done
- **Dependencies:** SB-011
- **Scope:** Enforce that any write/delete targeting `vault/00_Raw/` is rejected after initial creation.
  All raw mutations go through a single guarded path; attempts to overwrite/delete throw a clear error.
- **Acceptance Criteria:**
  - Overwriting an existing `00_Raw/<id>.md` is rejected with a descriptive error; the file is unchanged.
  - Deleting a raw file via the vault API is rejected.
  - Creating a new raw note still works.
- **Definition of Done:** Guard implemented + tested for overwrite and delete attempts.
- **Validation:** unit test attempts overwrite/delete and asserts rejection + unchanged bytes.
- **Files Expected to Change:** `packages/note-vault/src/*`; tests.
- **Out of Scope:** Filesystem-level OS permissions; guarding non-raw folders.
- **Notes:** Core safety invariant (ADR-004). Pairs with SB-017 checks.
- **Implementation note (In Review):** Added `raw-immutability.ts` (`guardRawImmutable`, `isRawPath`,
  `updateRawNote`, `deleteRawNote`) + `RawImmutabilityError` (`overwrite_rejected`/`delete_rejected`),
  and extracted shared `raw-paths.ts` (single-sources the raw filename convention; the SB-011 writer now
  uses it). Overwrite at create time is enforced by the writer's exclusive-create (`already_exists`);
  `update`/`delete` via the API always reject and never touch the file. 5 new tests (13 total) green.

## SB-013 — Implement minimal CLI capture command

- **Type:** Story · **Epic:** EPIC-CORE-004 · **Priority:** P0 · **Points:** 3 · **Status:** Done
- **Dependencies:** SB-011, SB-012, SB-014
- **Scope:** In `apps/cli`, add `capture` that reads content (arg/stdin), calls the `capture` interface
  → writes raw note (SB-011) + capture event (SB-014), prints the new id/paths. Manual `paste` source only.
- **Acceptance Criteria:**
  - `capture` with provided content creates a raw note + an inbox stub + a capture event, and prints the id.
  - Invalid/empty input is rejected with a clear message; no partial writes.
- **Definition of Done:** Command works end-to-end against a test workspace; calls interfaces (no direct fs).
- **Validation:** `echo "hello" | pnpm tsx apps/cli capture` then assert the raw file + event line exist.
- **Files Expected to Change:** `apps/cli/src/*`; `package.json` (bin/script).
- **Out of Scope:** Non-paste adapters; distillation; retrieval.
- **Notes:** Smallest possible end-to-end capture path.
- **Implementation note (In Review):** `@sb/cli` scaffolded. `runCapture()` generates ULID note + event
  ids (dependency-free `ulid.ts`, no new package), one shared `captured_at`, calls `writeRawNote()` then
  `appendCaptureEvent()`, prints `{ok,note_id,note_path,event_id,event_path,captured_at}`. Event payload
  links back to the raw note (`note_id`, workspace-relative `note_path`, `source`, `title?`, `tags?`,
  `ref?`). Structured `CaptureCliError` (`bad_arguments`/`empty_content`/`invalid_source`/
  `unsafe_workspace`/`event_append_failed`) to stderr + non-zero exit. Partial-failure: note kept if the
  event append fails. Workspace safety REUSES `resolveWorkspaceConfig` (SB-002) + a CLI broad-path guard
  (rejects `/`, single-segment roots, home dir, repo-containing paths). stdin + `--content` both supported.
  9 tests green + real end-to-end smoke (both flag and stdin) verified.
  **Deviation from AC:** the `00_Inbox/` L1 stub is **not** created (deferred with SB-011, per the
  narrowed instruction); tracked for a later capture-orchestration story. Capture orchestrates the
  package APIs directly (no `00_Inbox` stub, no distillation).

## SB-014 — Write capture event to JSONL

- **Type:** Story · **Epic:** EPIC-CORE-005 · **Priority:** P0 · **Points:** 2 · **Status:** Done
- **Dependencies:** SB-009, SB-004
- **Scope:** In `packages/event-log`, append a schema-valid capture event to
  `events/capture_events.jsonl` (one JSON object per line). Append-only; never rewrite.
- **Acceptance Criteria:**
  - Appending adds exactly one valid line; prior lines untouched.
  - Each event validates against event schema v1; carries id, timestamp, actor, source_ref.
- **Definition of Done:** Append API implemented + tested; ordering preserved.
- **Validation:** unit test appends N events; assert N new lines, all parse + validate, earlier lines unchanged.
- **Files Expected to Change:** `packages/event-log/src/*`; tests.
- **Out of Scope:** memory/projection events; replay.
- **Notes:** Source-of-truth spine.
- **Implementation note (In Review):** `@sb/event-log` scaffolded. `appendCaptureEvent()` builds a
  `{stream:"capture",kind:"captured"}` event (auto-stamps `recorded_at` + `schema_version:"1.0.0"`),
  validates it via dependency-free `validateCaptureEvent` (aligned to the capture-stream branch of
  event v1: ULID `event_id`/`subject_id`, actor pattern, ISO timestamps, optional `source_ref`), then
  appends one JSONL line via fs append mode (never truncates). `EventLogError` codes:
  `unsafe_path`/`invalid_event`/`append_failed`; nothing is written on a validation failure. 5 tests
  green. The caller supplies `event_id` (ULID) — runtime ULID generation will come with the CLI (SB-013).

## SB-015 — Add note listing / read-only query command

- **Type:** Story · **Epic:** EPIC-CORE-004 · **Priority:** P0 · **Points:** 2 · **Status:** Done
- **Dependencies:** SB-011
- **Scope:** In `apps/cli`, add read-only `note list` and `note get <id>` via `listNotes`/`getNote`.
  No mutation. Optional simple filter (type/folder).
- **Acceptance Criteria:**
  - `note list` enumerates notes with id/type/title; `note get <id>` prints a note.
  - Commands never write to the vault/events.
- **Definition of Done:** Read-only commands implemented + tested.
- **Validation:** create a note (SB-013), then `pnpm tsx apps/cli note list` shows it; `note get <id>` prints it.
- **Files Expected to Change:** `apps/cli/src/*`; possibly `packages/note-vault/src/*` (read helpers).
- **Out of Scope:** Search/retrieval (Phase 3); facts query.
- **Notes:** Proves a second consumer reads via interfaces only.
- **Implementation note (In Review):** `@sb/note-vault` gained a **read-only** API — `listNotes(workspace,
  {type?})` → `NoteSummary[]` (id/type/title/layer/path, ULID-sorted) and `getNote(workspace,id)` →
  verbatim content; `NoteReadError` (`unsafe_path`/`invalid_ulid`/`not_found`/`read_failed`). Frontmatter
  fields are read via targeted extraction (no YAML dependency); `getNote` returns raw content so it is
  correct regardless of frontmatter complexity. `@sb/cli` added `note list` / `note get <id>` (reuses the
  capture path-safety via the now-exported `resolveSafeWorkspace`). Read-only verified (raw count + event
  lines unchanged). 5 note-vault read tests + 5 CLI tests green (note-vault 18 total, cli 14 total);
  real CLI smoke (capture → list → get) verified. No new dependency. **Folder filter** narrowed to a
  `--type` filter (type is the documented, schema-backed discriminator). **Folder filtering is deferred**
  and may become a future story only if a real need appears — not implemented now.

## SB-016 — Implement frontmatter validation script

- **Type:** Story · **Epic:** EPIC-CORE-006 · **Priority:** P0 · **Points:** 3 · **Status:** Done
- **Dependencies:** SB-008
- **Scope:** Replace the `scripts/validate_notes.ts` stub: walk the vault, validate each note's
  frontmatter against schema v1, report violations with file + reason. Read-only.
- **Acceptance Criteria:**
  - Valid vault → exit 0, summary count.
  - Invalid frontmatter → non-zero exit, lists each offending file + reason.
  - Never mutates notes.
- **Definition of Done:** Script implemented + tested against good/bad fixtures.
- **Validation:** `pnpm validate:notes` on a good workspace → exit 0; on a seeded-bad fixture → exit ≠ 0 with details.
- **Files Expected to Change:** `scripts/validate_notes.ts`; test fixtures under `examples/`.
- **Out of Scope:** Auto-fixing; event validation.
- **Notes:** Read-only, safe to run anytime.
- **Implementation note (In Review):** `scripts/validate_notes.ts` implemented — scans
  `<workspace>/vault/**/*.md`, parses YAML frontmatter (`yaml`), validates against
  `frontmatter.schema.json` v1 with **Ajv (2020 dialect) + ajv-formats**. Reports per-file PASS/FAIL +
  errors and a `checked/valid/invalid` summary. Exit codes **0** (all valid) / **1** (invalid) / **2**
  (operational: unsafe workspace, missing schema, absent/unreadable vault, bad args). Workspace resolution
  reuses `resolveWorkspaceConfig` (SB-002) with `--workspace` override; `--help` included. Strictly
  read-only (no writes/format/mutation). **Deps added** (devDependencies): `ajv`, `ajv-formats`, `yaml`
  — the libraries needed to validate against the real schema. **Test fixtures are inline in the test**
  (`scripts/validate_notes.test.ts`, run via `pnpm test:scripts`) rather than under `examples/`, to keep
  bad-on-purpose fixtures out of the committed example set; 12 tests green + real `pnpm validate:notes`
  smoke (valid → exit 0, invalid → exit 1).

## SB-017 — Add checks/tests for raw immutability

- **Type:** Story · **Epic:** EPIC-CORE-006 · **Priority:** P0 · **Points:** 2 · **Status:** Done
- **Dependencies:** SB-012
- **Scope:** Add automated tests / a CLI check asserting the immutability guard: overwrite and delete
  attempts on `00_Raw/` are rejected and bytes are unchanged. Wire into the project's test command.
- **Delivered:** New `packages/note-vault/test/raw-immutability-invariant.test.ts` (6 tests) hardening the
  invariant beyond SB-012 — `guardRawImmutable` operation-specific codes; non-raw pass-through must NOT
  throw; path-traversal that resolves into / escapes `00_Raw`; slugged raw filenames; and a consolidated
  "every mutation path refused, bytes byte-identical" case. Wired into `@sb/note-vault` test script and a
  new documented root `pnpm test` (`pnpm -r run test && pnpm run test:scripts`). Validation: `pnpm test`
  exit 0 — note-vault 24/24, event-log 5/5, cli 14/14, scripts 12/12; tsc exit 0; leakage grep clean.
- **Acceptance Criteria:**
  - Test suite includes overwrite-rejected and delete-rejected cases, both passing.
  - A documented command runs them.
- **Definition of Done:** Tests pass; documented in STATUS/README.
- **Validation:** `pnpm test` (or documented runner) → immutability tests green.
- **Files Expected to Change:** tests under `packages/note-vault/`; `package.json` (test script).
- **Out of Scope:** OS-level permission tests.
- **Notes:** Locks in the L0 invariant.

## SB-018 — Update documentation & STATUS after Phase 1

- **Type:** Story · **Epic:** EPIC-CORE-001..006 · **Priority:** P0 · **Points:** 1 · **Status:** Done
- **Dependencies:** SB-007, SB-013, SB-016, SB-017
- **Scope:** Update `STATUS.md`, `README.md` (getting-started now real), and roadmap/mvp_scope to reflect
  Phase 1 completion; record resolved open questions. Documentation only.
- **Delivered:** README status → "Phase 1 (MVP core) complete"; getting-started rewritten with the real,
  end-to-end-verified flow (`init/verify:workspace`, `capture` flag+stdin, `note list/get`, `validate:notes`,
  `pnpm test`) + scripts map marks `init_workspace`/`validate_notes` implemented. Roadmap Phase 0/1 marked ✅
  (distillation SB-019 carve-out noted). mvp_scope acceptance criteria annotated (1–4,6 ✅; 5 distillation ⏳
  deferred). Open question #4 (workspace creation) resolved. STATUS records Phase 1 complete + Phase 2 next.
  **Honest carve-out:** the MVP's distillation skill (SB-019) was never built, so docs mark it deferred to
  Phase 1H/Phase 2 rather than claiming completion. `git diff` is docs-only.
- **Acceptance Criteria:**
  - STATUS reflects Phase 1 done + next phase; README getting-started commands actually work.
  - Resolved open questions marked; roadmap Phase 1 checked off.
- **Definition of Done:** Docs consistent with the implemented behavior; `git diff` is docs-only.
- **Validation:** Re-run the README getting-started commands successfully; `git diff` shows only docs.
- **Files Expected to Change:** `STATUS.md`, `README.md`, `docs/planning/*`.
- **Out of Scope:** New features.
- **Notes:** Final Phase 1 gate (Phase 1G).

---

# Phase 1H story cards (Minimal Human-Confirmed Distillation)

Decomposed from the old `5→split` SB-019. **L2-only** (L3 facts → Phase 2). Project-wide DoD still applies:
no domain/broker leakage; no real data; **L0 raw never overwritten and L1 sources never mutated** by the
distillation path; events append-only; AC met; validation green; `git diff` limited to listed files.

## SB-019 — Distillation proposal contract (interfaces)

- **Type:** Story · **Epic:** EPIC-CORE-007 · **Priority:** P1 · **Points:** 2 · **Status:** Done
- **Dependencies:** SB-010 (`Done`)
- **Scope:** Add the **types + operation descriptors only** (no implementation) for distillation to
  `@sb/interfaces`: a `DistillationProposal` (source note id(s), proposed L2 `title`, body, `tags?`,
  rationale) and `DistillationResult` (new L2 `note_id`, `event_id`); add `proposeDistillation` (read-only)
  and `acceptDistillation` (write) to `CoreOperations` + `OPERATION_CONTRACTS`; add a `write:distill`
  permission scope to `scope.ts` (least-privilege; cannot write capture/raw).
- **Acceptance Criteria:**
  - `DistillationProposal`/`DistillationResult` types exported; `propose`/`accept` documented in
    `OPERATION_CONTRACTS` with scopes (`read:notes` / `write:distill`) and error codes; `propose.readOnly=true`,
    `accept.readOnly=false`.
  - `tsc --noEmit` passes; a throwaway alignment smoke (one typed proposal + result value) compiles.
- **Definition of Done:** Types compile; contracts documented; no implementation; leakage grep clean.
- **Validation:** `pnpm --filter @sb/interfaces exec tsc --noEmit` → exit 0; alignment smoke → exit 0.
- **Files Expected to Change:** `packages/interfaces/src/{distillation.ts(new),operations.ts,scope.ts,index.ts}`,
  `docs/planning/{story_backlog.md,phase_1_story_map.md}`, `STATUS.md`.
- **Out of Scope:** Any implementation (writer/event/CLI/skill — later stories); L3 facts.
- **Notes:** Mirrors the SB-010 capture-contract pattern (types + descriptors, no behavior).

## SB-024 — L2 distilled-note writer (note-vault)

- **Type:** Story · **Epic:** EPIC-CORE-007 · **Priority:** P1 · **Points:** 3 · **Status:** Done
- **Dependencies:** SB-019 (`Done`), SB-011 (`Done`)
- **Scope:** `writeDistilledNote()` in `@sb/note-vault` — writes a **mutable L2** note
  (`type:distilled`, `layer:2`, required `title` + `source_ref` to the L1/L0 origin id) to a non-raw vault
  folder (e.g. `vault/20_Distilled/`); schema-exact frontmatter; exclusive-create by id; **forbidden from
  writing under `00_Raw/`** (reuse `isRawPath` guard) and from touching any L1 source file.
- **Acceptance Criteria:**
  - Writes a valid L2 distilled note (validates against `frontmatter.schema.json`); refuses a target under
    `00_Raw/`; never reads-then-writes an L1 source (no mutation).
  - Structured `DistilledNoteWriteError` codes (`invalid_ulid`/`unsafe_path`/`missing_title`/
    `missing_source_ref`/`already_exists`).
- **Definition of Done:** Tests green; `tsc --noEmit` exit 0; leakage grep clean.
- **Validation:** `pnpm --filter @sb/note-vault test` (new `distilled-note-writer.test.ts`) green; build exit 0.
- **Files Expected to Change:** `packages/note-vault/src/{distilled-note-writer.ts(new),errors.ts,index.ts}`,
  `packages/note-vault/test/distilled-note-writer.test.ts(new)`, `packages/note-vault/{package.json,README.md}`,
  `docs/planning/*`, `STATUS.md`.
- **Out of Scope:** CLI, events, the skill, L3 facts, editing/superseding existing L2 notes.
- **Notes:** L2 is curated/editable (unlike L0); this story only covers create.
- **Decision (impl):** the card's `vault/20_Distilled/` was illustrative and is **not** in the canonical
  workspace tree ([`repo_structure.md`](repo_structure.md)). Per [`memory_layers.md`](../architecture/memory_layers.md)
  (L2 → PARA + `50_Entities/`/`80_Wiki/`), distilled notes default to **`vault/80_Wiki/`** (overridable via
  `dirRelative`); no new workspace folder was introduced (init_workspace untouched). The writer also
  adds a `write_failed` IO code (mirrors `RawNoteWriteError`) beyond the AC's enumerated set, and an extra
  workspace-escape guard on `dirRelative`.

## SB-025 — Memory-stream event append (event-log)

- **Type:** Story · **Epic:** EPIC-CORE-007 · **Priority:** P1 · **Points:** 2 · **Status:** Done
- **Dependencies:** SB-009 (`Done`), SB-014 (`Done`)
- **Scope:** `appendMemoryEvent()` in `@sb/event-log` — appends one validated **memory-stream** event
  (`note_created` or `distillation_accepted`, `subject_id` required) as a single JSONL line to the event
  log, **append-only** (reuse SB-014 append semantics + the memory-stream branch of event schema v1).
- **Acceptance Criteria:**
  - Appends one valid memory event (auto-stamps `recorded_at`, `schema_version`); rejects an invalid event
    (missing `subject_id`/bad kind) writing nothing; N appends → N ordered lines, earlier lines unchanged.
  - Reuses the existing `EventLogError` codes; relative/unsafe paths rejected.
- **Definition of Done:** Tests green; `tsc --noEmit` exit 0; leakage grep clean.
- **Validation:** `pnpm --filter @sb/event-log test` (new memory-event cases) green; build exit 0.
- **Files Expected to Change:** `packages/event-log/src/{memory-event.ts(new),validate-event.ts,index.ts}`,
  `packages/event-log/test/memory-event.test.ts(new)`, `packages/event-log/{package.json,README.md}`,
  `docs/planning/*`, `STATUS.md`.
- **Out of Scope:** projection events; replay; fact events (Phase 2).
- **Notes:** Mirrors `appendCaptureEvent` (SB-014) for the memory stream.

## SB-026 — CLI `distill` command (propose + accept)

- **Type:** Story · **Epic:** EPIC-CORE-007 · **Priority:** P1 · **Points:** 3 · **Status:** Done
- **Dependencies:** SB-024 (`Done`), SB-025 (`Done`)
- **Scope:** `@sb/cli` `distill` subcommand. `distill propose` (READ-ONLY): lists L1 working-note
  candidates and prints a `DistillationProposal` **scaffold** JSON to stdout (no writes). `distill accept`
  (HUMAN-CONFIRMED WRITE): reads a completed proposal JSON from `--file`/stdin, generates L2 + event ULIDs,
  calls `writeDistilledNote()` (SB-024) then `appendMemoryEvent('distillation_accepted')` (SB-025), prints
  `{ ok, note_id, note_path, event_id, ... }`. Partial-failure: L2 note kept if event append fails. Reuses
  the capture path-safety guard.
- **Acceptance Criteria:**
  - `propose` writes nothing (raw/L1/events byte-unchanged) and emits a valid scaffold.
  - `accept` writes exactly one L2 note + appends exactly one `distillation_accepted` event; bad/missing
    proposal → structured stderr error + non-zero exit; no write without `accept`.
- **Definition of Done:** Tests green; build exit 0; real propose→accept smoke; leakage grep clean.
- **Validation:** `pnpm --filter @sb/cli test` (new `distill-command.test.ts`) green; build exit 0; smoke on
  a throwaway workspace (capture an L1 note, propose, accept → L2 + event; raw unchanged).
- **Files Expected to Change:** `apps/cli/src/{distill-command.ts(new),index.ts}`,
  `apps/cli/test/distill-command.test.ts(new)`, `apps/cli/{package.json,README.md}`, `docs/planning/*`,
  `STATUS.md`.
- **Out of Scope:** the LLM proposal logic (that's the skill, SB-027); L3 facts.
- **Notes:** `accept` is the only writing step and is always human-invoked.
- **Decision (impl):** `@sb/interfaces` added as an `@sb/cli` dependency (the contract type
  `DistillationProposal` flows through the CLI per the contracts-first boundary) → `pnpm-lock.yaml` updated
  (new cli importer dep, as with SB-013). A proposal's `source_ids[0]` becomes the L2 note's single
  `source_ref` (the schema has only one `source_ref` for non-output notes); the **full** `source_ids` list
  is preserved in the `distillation_accepted` event payload. `accept`'s memory event uses `actor:"human"`
  (human-in-the-loop confirmation). New `DistillCliError`
  (`bad_arguments`/`bad_proposal`/`event_append_failed`); workspace-safety errors reuse `CaptureCliError`.

## SB-027 — Distillation skill + L0/L1 safety check

- **Type:** Story · **Epic:** EPIC-CORE-007 · **Priority:** P1 · **Points:** 2 · **Status:** Done
- **Dependencies:** SB-026 (`Done`)
- **Scope:** A Claude-Code **skill** under `skills/distill/` (agent workflow, not backend): reads L1 notes,
  drafts an L2 `DistillationProposal`, shows it to the human, and only on explicit confirmation calls
  `cli distill accept`. Plus an automated **safety check/test** asserting the whole distillation path never
  overwrites/deletes `00_Raw/` and never mutates the L1 source (byte-checked end-to-end).
- **Acceptance Criteria:**
  - `skills/distill/SKILL.md` documents the propose→confirm→accept workflow and the never-mutate-L0/L1 rule.
  - A test/check captures an L1 note, runs propose→accept, and asserts: raw bytes unchanged, L1 source bytes
    unchanged, exactly one L2 note + one event created. Wired into `pnpm test`.
- **Definition of Done:** Skill documented; safety check green under `pnpm test`; leakage grep clean.
- **Validation:** `pnpm test` includes the distillation safety check (green); manual skill dry-run documented.
- **Files Expected to Change:** `skills/distill/SKILL.md(new)`, a safety test under `apps/cli/test/` or
  `packages/note-vault/test/`, `package.json`/`*/package.json` (test wiring), `docs/planning/*`, `STATUS.md`.
- **Out of Scope:** multi-note synthesis heuristics; L3 facts; auto-accept (always human-confirmed).
- **Notes:** Closes EPIC-CORE-007 and the original MVP distillation criterion (mvp_scope AC 5).

---

# Phase 1 review follow-up cards (from the 2026-06-05 final review)

## SB-028 — Record multi-source provenance on the L2 note

- **Type:** Story · **Epic:** EPIC-CORE-007 · **Priority:** P2 · **Points:** 2 · **Status:** Backlog
- **Dependencies:** SB-024 (`Done`), SB-026 (`Done`)
- **Context (review finding, MEDIUM):** a `DistillationProposal` carries `source_ids[]`, but
  `writeDistilledNote` records only `source_ids[0]` as the note's single `source_ref`; secondary sources
  survive only in the `distillation_accepted` event payload. A note distilled from N sources should be
  traceable to all N from the note itself, not just the event log.
- **Scope:** Without breaking the schema's single `source_ref` rule for curated notes, also record the
  remaining `source_ids` on the L2 note — e.g. as `links` (wikilink targets) and/or `entities`/a dedicated
  additive field — so provenance is reconstructable from the note. Update `writeDistilledNote` + the CLI
  `accept` path to thread the full list onto the note frontmatter.
- **Acceptance Criteria:**
  - An L2 note distilled from ≥2 sources records `source_ref` = primary **and** the remaining origin ids on
    the note (validates against `frontmatter.schema.json`).
  - The `distillation_accepted` event still carries the full `source_ids` list (unchanged).
- **Definition of Done:** tests green; `tsc --noEmit` exit 0; leakage grep clean; schema still validates.
- **Validation:** new/updated cases in `distilled-note-writer.test.ts` + `distill-command.test.ts`; build exit 0.
- **Files Expected to Change:** `packages/note-vault/src/distilled-note-writer.ts`,
  `apps/cli/src/distill-command.ts`, the two tests, `docs/planning/*`, `STATUS.md`.
- **Out of Scope:** schema change to allow multiple `source_ref` (use existing additive fields instead); L3 facts.
- **Notes:** Decide the exact carrier field (`links` vs `entities` vs a new `sources`-style field for L2)
  during refinement; the frontmatter schema currently reserves `sources` for L5 output notes.

## SB-029 — L1 working-note creation so `distill propose` has candidates

- **Type:** Story · **Epic:** EPIC-CORE-007 · **Priority:** P2 · **Points:** 3 · **Status:** Backlog
- **Dependencies:** SB-026 (`Done`)
- **Context (review finding, MEDIUM):** `distill propose` lists L1 `working` notes as candidates, but
  nothing in Phase 1 creates L1 working notes (capture writes only L0 raw). So `propose` always returns
  `candidates: []`; the workflow is functional only because `accept` takes arbitrary `source_ids`. The
  "surface candidates" UX has no data source yet.
- **Scope:** Add a minimal, in-scope path to create an **L1 working note** from an L0 raw source
  (`writeWorkingNote()` in `@sb/note-vault` + a CLI command, e.g. `work create --from <rawId>` or a promote
  step), writing `type:working`, `layer:1`, required `source_ref` to the L0 origin under a non-raw folder.
  This makes `distill propose` surface real candidates end-to-end.
- **Acceptance Criteria:**
  - A documented command creates exactly one L1 working note referencing its L0 source (schema-valid),
    never under `00_Raw/`, never mutating the source.
  - `distill propose` then lists the new working note as a candidate.
- **Definition of Done:** tests green; build exit 0; E2E capture→work-create→propose shows the candidate; leakage clean.
- **Validation:** new writer + command tests; E2E smoke; build exit 0.
- **Files Expected to Change:** `packages/note-vault/src/{working-note-writer.ts(new),errors.ts,index.ts}`,
  `apps/cli/src/*`, tests, READMEs, `docs/planning/*`, `STATUS.md`.
- **Out of Scope:** AI-assisted working-note drafting (skill layer); L3 facts; editing existing working notes.
- **Notes:** Refine the exact command surface (`work create` vs `note promote`) before marking `Ready`;
  decide the target folder (e.g. `10_Projects`/`20_Areas`) consistent with `memory_layers.md`.

## SB-033 — Test-coverage measurement + `init_workspace` automated test

- **Type:** Story · **Epic:** EPIC-CORE-001 (cross-cutting quality) · **Priority:** P2 · **Points:** 3 · **Status:** Backlog
- **Dependencies:** —
- **Context (review finding, MEDIUM):** the suite is broad (80 tests) but there is **no coverage
  measurement** (global rule targets ≥80%), and `scripts/init_workspace.ts` has **no automated test** (only
  manual + the ad-hoc E2E). A regression in the initializer would not be caught by `pnpm test`.
- **Scope:** Wire coverage reporting into `pnpm test` (Node's built-in `--experimental-test-coverage` or
  `c8`), with a documented threshold; add `scripts/init_workspace.test.ts` covering dry-run, verify
  (pass/fail), idempotent re-init, and the append-only event-file invariant (existing file not truncated).
- **Acceptance Criteria:**
  - `pnpm test` (or a `test:coverage` target) reports coverage; the threshold is documented.
  - `init_workspace.test.ts` is green and wired into the scripts test run.
- **Definition of Done:** coverage reported; init test green under `pnpm test`; no production-code change required.
- **Validation:** `pnpm test` green with coverage output; init test exercises dry-run/verify/idempotency/append-only.
- **Files Expected to Change:** `package.json` (coverage + scripts test wiring),
  `scripts/init_workspace.test.ts(new)`, `docs/planning/*`, `STATUS.md`.
- **Out of Scope:** raising existing modules to a specific % (measure first, then a follow-up if needed).
- **Notes:** Keep coverage non-blocking initially (report, don't fail the build) until a baseline is known.

---

# Phase 2 story cards (EPIC-CORE-008 — refined; `Backlog` until open decisions confirmed)

> Sequencing, dependency graph, and the open decisions are in [`phase_2_story_map.md`](phase_2_story_map.md).
> Project-wide DoD still applies (no domain leakage; no real data committed; raw L0 never overwritten;
> events append-only; `db/` is disposable/rebuildable; AC + validation green; STATUS/docs updated).

## SB-020 — Fact + projection contracts (interfaces)

- **Type:** Story · **Epic:** EPIC-CORE-008 · **Priority:** P1 · **Points:** 2 · **Status:** In Review
- **Dependencies:** SB-009 (`Done`), SB-010 (`Done`)
- **Scope:** Add **types + operation descriptors only** (no impl) to `@sb/interfaces`: a `Fact`
  (`{ id, statement, source_ref, captured_at, observed_at, confidence, supersedes? }`), minimal
  `EntityNode`/`EntityEdge` and `Task` projection types, and projection operation descriptors
  (`addFact`/`supersedeFact`/`listFacts`/`rebuildProjections`) + scopes (`write:facts`, `read:facts`) in
  `operations.ts`/`scope.ts`. Mirrors the SB-010/SB-019 contract pattern.
- **Acceptance Criteria:** types exported; `confidence` documented as 0–1; ADD-only documented; `tsc
  --noEmit` passes; throwaway alignment smoke compiles.
- **Definition of Done:** types compile; contracts documented; no impl; leakage grep clean.
- **Validation:** `pnpm --filter @sb/interfaces exec tsc --noEmit` exit 0; alignment smoke exit 0.
- **Files Expected to Change:** `packages/interfaces/src/{fact.ts(new),projection.ts(new),operations.ts,scope.ts,index.ts}`, `docs/planning/*`, `STATUS.md`.
- **Out of Scope:** any impl; SQLite; AI extraction; L4 indexes.

## SB-034 — Projection store bootstrap (SQLite `db/memory.sqlite`)

- **Type:** Story · **Epic:** EPIC-CORE-008 · **Priority:** P1 · **Points:** 3 · **Status:** In Review
- **Dependencies:** SB-020 (`Done`)
- **Decisions (RESOLVED 2026-06-05):** SQLite driver = **`node:sqlite`** (built-in, zero-dep); **centralize
  ULID** generation in this story (shared util; retire `apps/cli/src/ulid.ts`).
- **Scope:** `@sb/memory-kernel` opens/creates `<workspace>/db/memory.sqlite` via **`node:sqlite`** and
  applies an idempotent schema migration (fact/entity/task tables + a `schema_version` table). `db/` is
  treated as fully disposable/rebuildable. Add a shared ULID utility (core module) and switch
  `apps/cli/src/ulid.ts` consumers to it (retire the duplicate).
- **Acceptance Criteria:** opening a fresh workspace creates the DB + tables idempotently; re-open is a
  no-op; deleting `db/` and re-opening recreates empty tables; workspace path-safety reused.
- **Definition of Done:** tests green; `tsc --noEmit` exit 0; leakage grep clean.
- **Validation:** `pnpm --filter @sb/memory-kernel test` green; build exit 0.
- **Files Expected to Change:** `packages/memory-kernel/{package.json,tsconfig.json,README.md,src/*,test/*}`, `pnpm-lock.yaml` (if a driver dep is added), `docs/planning/*`, `STATUS.md`.
- **Out of Scope:** projecting events (SB-023); fact/entity/task writes (later).
- **Notes:** ULID centralization adds a shared core util used by cli/event-log/memory-kernel — keep that
  slice clean (no behavior change to existing ULID output, which is spec-compliant). `node:sqlite` is
  experimental in Node 22 (warning is acceptable).

## SB-023 — Replay projector core (pure event→state fold)

- **Type:** Story · **Epic:** EPIC-CORE-008 · **Priority:** P1 · **Points:** 3 · **Status:** In Review
- **Dependencies:** SB-034 (`Done`)
- **Scope:** A **pure, deterministic** `apply(state, event) → state'` projector in `@sb/memory-kernel`
  that folds memory events (`fact_added`/`fact_superseded`/`entity_merged`/`note_created`/`note_updated`)
  into in-memory projection state, plus a `project(events) → state` reducer. No I/O — this is the shared
  engine used by both live writes and full replay (OQ #8 determinism).
- **Acceptance Criteria:** given an ordered event list, `project()` yields deterministic state; replaying
  the same events twice yields identical state; unknown/forward-compatible fields are preserved; ADD-only
  fact semantics (supersede marks, never deletes).
- **Definition of Done:** unit tests green; `tsc --noEmit` exit 0; leakage clean.
- **Validation:** `pnpm --filter @sb/memory-kernel test` green; build exit 0.
- **Files Expected to Change:** `packages/memory-kernel/src/{projector.ts(new),index.ts}`, tests, `docs/planning/*`, `STATUS.md`.
- **Out of Scope:** SQLite persistence (SB-038 wires fold→DB); reading the event log from disk.

## SB-035 — fact-store table + `addFact` (ADD-only)

- **Type:** Story · **Epic:** EPIC-CORE-008 · **Priority:** P1 · **Points:** 3 · **Status:** In Review
- **Dependencies:** SB-023 (`Done`)
- **Note (impl):** required a one-token enabling change in `@sb/event-log` — widened
  `AppendableMemoryKind` to include `fact_added` (the validator already accepted the full memory enum).
- **Scope:** `@sb/fact-store` `addFact()`: validate the fact (provenance `source_ref` + `confidence` 0–1
  required), append a `fact_added` memory event (source of truth), then apply it to the SQLite projection
  via the SB-023 projector. **ADD-only**: never UPDATE/DELETE existing fact rows.
- **Acceptance Criteria:** one `addFact` appends exactly one `fact_added` event and inserts exactly one
  row; missing provenance/confidence rejected (structured error); no row is ever updated/deleted.
- **Definition of Done:** tests green; build exit 0; leakage clean.
- **Validation:** `pnpm --filter @sb/fact-store test` green; build exit 0.
- **Files Expected to Change:** `packages/fact-store/{package.json,tsconfig.json,README.md,src/*,test/*}`, `docs/planning/*`, `STATUS.md`.
- **Out of Scope:** supersede/query (SB-036); AI extraction.

## SB-036 — fact-store `supersedeFact` + current-facts query

- **Type:** Story · **Epic:** EPIC-CORE-008 · **Priority:** P1 · **Points:** 3 · **Status:** Backlog
- **Dependencies:** SB-035
- **Scope:** `supersedeFact(oldId, newFact)`: append a `fact_superseded` event + add the new fact
  referencing the old via `supersedes` (never mutate the old row), and a read API returning **current**
  (non-superseded) facts, with provenance.
- **Acceptance Criteria:** supersede adds a new fact + marks the old superseded (old row bytes/values
  unchanged); the current-facts query excludes superseded facts; chains (A←B←C) resolve to the latest.
- **Definition of Done:** tests green; build exit 0; leakage clean.
- **Validation:** `pnpm --filter @sb/fact-store test` green; build exit 0.
- **Files Expected to Change:** `packages/fact-store/src/*`, tests, README, `docs/planning/*`, `STATUS.md`.
- **Out of Scope:** entity/task projections; replay rebuild.

## SB-021 — entity-graph nodes projection

- **Type:** Story · **Epic:** EPIC-CORE-008 · **Priority:** P1 · **Points:** 3 · **Status:** Backlog
- **Dependencies:** SB-023
- **Scope:** `@sb/entity-graph`: project **entity nodes** from `50_Entities/` notes (+ `entities` refs on
  other notes) into SQLite, keyed by ULID. Rebuildable from notes + events.
- **Acceptance Criteria:** each entity note yields one node (id/title/aliases); re-projection is
  idempotent; nodes carry provenance back to their source note.
- **Definition of Done:** tests green; build exit 0; leakage clean.
- **Validation:** `pnpm --filter @sb/entity-graph test` green; build exit 0.
- **Files Expected to Change:** `packages/entity-graph/{package.json,tsconfig.json,README.md,src/*,test/*}`, `docs/planning/*`, `STATUS.md`.
- **Out of Scope:** edges/merges (SB-037).

## SB-037 — entity-graph edges + manual-confirm `entity_merged`

- **Type:** Story · **Epic:** EPIC-CORE-008 · **Priority:** P1 · **Points:** 3 · **Status:** Backlog
- **Dependencies:** SB-021
- **Scope:** Project **edges** (from `[[wikilinks]]`/`entities` relations) and handle **manual-confirm
  merges** via an explicit `entity_merged` event (OQ #7 — never auto-merge). Merged entities resolve to a
  canonical node; edges repoint.
- **Acceptance Criteria:** edges are derived deterministically; an `entity_merged` event repoints edges to
  the canonical node and is never inferred automatically; replay reproduces the merged graph.
- **Definition of Done:** tests green; build exit 0; leakage clean.
- **Validation:** `pnpm --filter @sb/entity-graph test` green; build exit 0.
- **Files Expected to Change:** `packages/entity-graph/src/*`, tests, README, `docs/planning/*`, `STATUS.md`.
- **Out of Scope:** automatic merge heuristics; retrieval/graph indexes (Phase 3).

## SB-022 — task-store projection

- **Type:** Story · **Epic:** EPIC-CORE-008 · **Priority:** P2 · **Points:** 3 · **Status:** Backlog
- **Dependencies:** SB-023
- **Scope:** `@sb/task-store`: project tasks into SQLite. **Source = open decision #4** (lean: derive from
  note frontmatter `status` + `note_created/updated` events; no new event kind). Rebuildable.
- **Acceptance Criteria:** tasks are derived deterministically from the chosen source; re-projection is
  idempotent; each task carries provenance to its source note.
- **Definition of Done:** tests green; build exit 0; leakage clean.
- **Validation:** `pnpm --filter @sb/task-store test` green; build exit 0.
- **Files Expected to Change:** `packages/task-store/{package.json,tsconfig.json,README.md,src/*,test/*}`, `docs/planning/*`, `STATUS.md`.
- **Out of Scope:** task scheduling/reminders; UI.
- **Notes:** Confirm the task source (open decision #4) before `Ready`.

## SB-038 — Replay rebuild command (drop `db/` → rebuild + events)

- **Type:** Story · **Epic:** EPIC-CORE-008 · **Priority:** P1 · **Points:** 3 · **Status:** Backlog
- **Dependencies:** SB-035, SB-021
- **Scope:** A command/script (`@sb/cli` or `scripts/`) that reads the event log (+ L0–L2), runs the
  SB-023 projector, and **rebuilds** all SQLite projections from scratch; emits `projection_rebuilt` /
  `projection_reset` projection events. Safe to drop `db/` first.
- **Acceptance Criteria:** running rebuild on a populated workspace reconstructs fact/entity/task
  projections; emits the projection events; never writes to `00_Raw/`; event log unchanged (read-only input).
- **Definition of Done:** tests green; build exit 0; real rebuild smoke; leakage clean.
- **Validation:** `pnpm --filter @sb/cli test` (or scripts test) green; build exit 0; smoke on a throwaway workspace.
- **Files Expected to Change:** `apps/cli/src/*` or `scripts/*`, `packages/memory-kernel/src/*`, tests, READMEs, `docs/planning/*`, `STATUS.md`.
- **Out of Scope:** the reproducibility assertion (SB-039).

## SB-039 — Replay reproducibility gate (drop+replay identical)

- **Type:** Story · **Epic:** EPIC-CORE-008 · **Priority:** P1 · **Points:** 2 · **Status:** Backlog
- **Dependencies:** SB-038
- **Scope:** The epic **"Done when"** gate as an automated test: populate a workspace, snapshot
  projections, **drop `db/` and replay**, and assert the rebuilt projections are **row/byte-identical**.
  Wired into `pnpm test`.
- **Acceptance Criteria:** the drop+replay test is green and wired into `pnpm test`; any non-determinism
  fails the test.
- **Definition of Done:** test green under `pnpm test`; leakage clean.
- **Validation:** `pnpm test` includes the reproducibility gate (green).
- **Files Expected to Change:** a test under `packages/memory-kernel/test/` or `apps/cli/test/`, test wiring, `docs/planning/*`, `STATUS.md`.
- **Out of Scope:** performance tuning; L4 indexes.

---

# Later-epic notes (coarse)

These remain `Backlog`/`Deferred`. Refine (split to ≤3 points + add AC/validation/files) before any
implementation. Detailed cards will be written when each phase is reached.

- **EPIC-CORE-007 Distillation (SB-019):** minimal Claude-Code skill that *proposes* a distilled L2 note
  (and optionally candidate L3 facts) from an L1 note; never edits raw; human confirms; emits a memory
  event on acceptance. Likely splits into "propose note" + "record acceptance event". *(See conflict
  note in `phase_1_story_map.md`: distillation is part of MVP scope but not in Phase 1A–1G.)*
- **EPIC-CORE-008 Projections:** **REFINED** (2026-06-05) into ≤3-pt stories — see the Phase 2 table above
  and detailed cards, plus [`phase_2_story_map.md`](phase_2_story_map.md). SQLite fact-store (ADD-only +
  provenance), entity-graph, task-store, and event-replay rebuild.
- **EPIC-CORE-009 Retrieval Sidecar (SB-030–032):** Python sidecar skeleton over stdio JSONL, DuckDB+VSS
  +BGE-M3 index build (design ported, not copied, from sspaeti — reference only), TS facade + query.
- **EPIC-CORE-010 Surfaces (SB-040–041):** optional Obsidian helper, then dashboard. All via interfaces.
- **EPIC-CORE-011 Security & Privacy (SB-050–052):** secure_refs pointer impl (P0 when sensitive material
  appears), permission/scope model in interfaces, then enforcement at the boundary.
- **EPIC-CORE-012 Domain App Boundary (SB-060–061):** capability/scope contract for domain apps; a
  **generic** `domain-apps/example-readonly/` smoke test (never broker) proving interface-only access.
- **EPIC-CORE-013 Media Transcription Intake (SB-070–072):** **Backlog.** Optional adapter that ingests
  transcripts from the standalone `psb-media-transcriber` artifact store (`~/PersonalSecondBrainMediaArtifacts/`,
  layout `<YYYY>/<MM>/<media_id>/` + `by-name/`) as L0 captures via `interfaces` only. MUST read the artifact
  store read-only, carry `media_id` + artifact-dir ref as provenance, be idempotent on `media_id`, and preserve
  the organize-**by-name** convention. Workflow + binding rules documented in
  [`../workflows/media_transcription_intake.md`](../workflows/media_transcription_intake.md). Refine + split
  (≤3 pts: read/list artifacts → capture-with-provenance → idempotent re-ingest) before implementation.
- **EPIC-DOMAIN-001 Broker (SB-900):** **Deferred.** No detailed stories. Begins only after the core is
  stable and SB-060/061 are `Done`; lives entirely under `domain-apps/broker/`, core untouched.
