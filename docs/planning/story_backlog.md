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
| EPIC-CORE-008 | Structured Projections | 2 | P1 | Done | fact-store / entity-graph / task-store + replay (SQLite, rebuildable). All 10 stories (SB-020/034/023/035/036/021/037/022/038/039) `Done`. Drop-`db/`-and-replay reproduces identical projections (SB-039 gate). |
| EPIC-CORE-009 | Retrieval Sidecar | 3 | P1 | Done | Python DuckDB FTS+VSS retrieval over stdio JSONL (bge-small embeddings — OQ #9 fallback). **Gate met 2026-06-10** (SB-054): delete-`indexes/`-rebuild lossless. **All 9 stories `Done` incl. the SB-055 graph/temporal stretch** (query `filters:{near,from,to}`). |
| EPIC-CORE-010 | Surfaces | 5 | P2 | Backlog | Obsidian helper, then dashboard. |
| EPIC-CORE-011 | Security & Privacy Hardening | cross | P0/P1 | Backlog | secure_refs, permission scopes, secret handling. |
| EPIC-CORE-012 | Domain App Boundary | 4–6 | P1 | Backlog | Capability/scope model + generic example-readonly smoke test. |
| EPIC-CORE-013 | Media Transcription Intake | later | P2 | Backlog | Optional adapter ingesting `psb-media-transcriber` transcripts as L0 captures (SB-070–072, coarse — see "Later-epic notes"). *(Row added 2026-06-10; the epic existed in the notes section only.)* |
| EPIC-CORE-014 | AI Workflows | 4 | P1 | Done | Skills for braindump/extract-facts/review/compose-output (distill shipped in 1H) + `sb fact` / L5 `sb output create` confirmed write paths. **Gate met 2026-06-10** (SB-066): propose-without-accept writes nothing; accepted writes carry provenance; L0/L1 immutable. **All 9 stories `Done`** (SB-056..059 + SB-062..066, one autonomous session). |
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
| SB-028 | Story | Record multi-source provenance on the L2 note | EPIC-CORE-007 | P2 | Done | 2 | SB-024, SB-026 |
| SB-029 | Story | L1 working-note creation so `distill propose` has candidates | EPIC-CORE-007 | P2 | Done | 3 | SB-026 |
| SB-033 | Story | Test-coverage measurement + `init_workspace` automated test | EPIC-CORE-001 | P2 | Done | 3 | — |

### Phase 2 — Structured Projections (EPIC-CORE-008, refined; see [`phase_2_story_map.md`](phase_2_story_map.md))

Decomposed from the old `5→split` SB-020/021/023 (split rule). **`Backlog` — refined, not yet `Ready`**;
promote after the open decisions in the story map are confirmed at review. Cards below.

| ID | Type | Title | Epic | Pri | Status | SP | Dependencies |
|---|---|---|---|---|---|---|---|
| SB-020 | Story | Fact + projection contracts (interfaces) | EPIC-CORE-008 | P1 | Done | 2 | SB-009, SB-010 |
| SB-034 | Story | Projection store bootstrap (SQLite `db/memory.sqlite`) | EPIC-CORE-008 | P1 | Done | 3 | SB-020 |
| SB-023 | Story | Replay projector core (pure event→state fold) | EPIC-CORE-008 | P1 | Done | 3 | SB-034 |
| SB-035 | Story | fact-store table + `addFact` (ADD-only) | EPIC-CORE-008 | P1 | Done | 3 | SB-023 |
| SB-036 | Story | fact-store `supersedeFact` + current-facts query | EPIC-CORE-008 | P1 | Done | 3 | SB-035 |
| SB-021 | Story | entity-graph nodes projection | EPIC-CORE-008 | P1 | Done | 3 | SB-023 |
| SB-037 | Story | entity-graph edges + manual-confirm `entity_merged` | EPIC-CORE-008 | P1 | Done | 3 | SB-021 |
| SB-022 | Story | task-store projection | EPIC-CORE-008 | P2 | Done | 3 | SB-023 |
| SB-038 | Story | Replay rebuild command (drop `db/` → rebuild + events) | EPIC-CORE-008 | P1 | Done | 3 | SB-035, SB-021 |
| SB-039 | Story | Replay reproducibility gate (drop+replay identical) | EPIC-CORE-008 | P1 | Done | 2 | SB-038 |

### Phase 2 review follow-ups (backlog quality band; from the 2026-06-09 review)

| ID | Type | Title | Epic | Pri | Status | SP | Dependencies |
|---|---|---|---|---|---|---|---|
| SB-042 | Story | Pin + document the `node:sqlite` runtime requirement | EPIC-CORE-008 | P2 | Done | 1 | SB-034 |
| SB-043 | Story | Atomic single-connection `rebuild` (one store, one transaction) | EPIC-CORE-008 | P2 | Done | 3 | SB-038 |
| SB-044 | Story | Shared frontmatter helper in `@sb/note-vault` (DRY) | EPIC-CORE-003 | P3 | Done | 2 | SB-011 |
| SB-045 | Story | Projection-table consistency hardening (entity reset + edge UNIQUE) | EPIC-CORE-008 | P3 | Done | 2 | SB-037, SB-038 |
| SB-046 | Story | Single-pass note reads in projections | EPIC-CORE-008 | P3 | Done | 2 | SB-022 |

(Review finding #8 — still no coverage measurement — is already tracked as SB-033, which now spans Phase 2.)

### Phase 3 — Retrieval Sidecar (EPIC-CORE-009, refined; see [`phase_3_story_map.md`](phase_3_story_map.md))

Decomposed from the old `5→split` SB-030/031/032 (split rule). **Decision review PASSED 2026-06-10:
all eight open decisions (OQ #9–12, #17–20) approved exactly as leaned** (recorded in
[`open_questions.md`](open_questions.md)) — stories promote to `Ready` as their dependencies complete.
Cards below.

| ID | Type | Title | Epic | Pri | Status | SP | Dependencies |
|---|---|---|---|---|---|---|---|
| SB-047 | Story | Retrieval + index contracts (interfaces) | EPIC-CORE-009 | P1 | Done | 2 | SB-010 |
| SB-030 | Story | Python sidecar skeleton (stdio JSONL, ping/health) | EPIC-CORE-009 | P1 | Done | 3 | SB-047 |
| SB-048 | Story | TS sidecar transport client (`@sb/retrieval`) | EPIC-CORE-009 | P1 | Done | 3 | SB-030, SB-047 |
| SB-031 | Story | FTS index build + lexical query (sidecar, DuckDB) | EPIC-CORE-009 | P1 | Done | 3 | SB-048 |
| SB-053 | Story | `sb index` CLI + `indexed` projection event | EPIC-CORE-009 | P1 | Done | 2 | SB-031 |
| SB-032 | Story | `sb query` CLI + facade query | EPIC-CORE-009 | P1 | Done | 2 | SB-053 |
| SB-049 | Story | BGE-M3 embeddings + DuckDB VSS + hybrid ranking | EPIC-CORE-009 | P1 | Done | 3 | SB-031 |
| SB-054 | Story | Index disposability gate (delete `indexes/` → lossless rebuild) | EPIC-CORE-009 | P1 | Done | 2 | SB-032, SB-049 |
| SB-055 | Story | Graph + temporal indexes (stretch) | EPIC-CORE-009 | P2 | Done | 3 | SB-054 |

### Phase 4 — AI Workflows (EPIC-CORE-014, refined; see [`phase_4_story_map.md`](phase_4_story_map.md))

Refined 2026-06-10. **`Backlog` until the open-decision review (OQ #21–#25) passes** — then stories
promote to `Ready` as their dependencies complete. Ids skip SB-060/061 (EPIC-CORE-012) and
SB-070–072 (EPIC-CORE-013). Cards below.

| ID | Type | Title | Epic | Pri | Status | SP | Dependencies |
|---|---|---|---|---|---|---|---|
| SB-056 | Story | AI-workflow proposal contracts (interfaces + proposal schema) | EPIC-CORE-014 | P1 | Done | 2 | SB-010 |
| SB-057 | Story | `sb fact` CLI (add / accept-file / list) | EPIC-CORE-014 | P1 | Done | 3 | SB-056 |
| SB-058 | Story | L5 output writer (`writeOutputNote`, `vault/60_Outputs/`) | EPIC-CORE-014 | P1 | Done | 2 | SB-056 |
| SB-059 | Story | `sb output create` CLI + `note_created` memory event | EPIC-CORE-014 | P1 | Done | 2 | SB-058 |
| SB-062 | Story | `skills/extract-facts` + safety check | EPIC-CORE-014 | P1 | Done | 3 | SB-057 |
| SB-063 | Story | `skills/braindump` + safety check | EPIC-CORE-014 | P1 | Done | 3 | SB-056 |
| SB-064 | Story | `skills/review` + safety check | EPIC-CORE-014 | P1 | Done | 3 | SB-057 |
| SB-065 | Story | `skills/compose-output` + safety check | EPIC-CORE-014 | P1 | Done | 2 | SB-059 |
| SB-066 | Story | Phase 4 provenance + confirmation gate | EPIC-CORE-014 | P1 | Done | 2 | SB-062, SB-063, SB-064, SB-065 |

### Later phases (coarse; refine before implementation)

| ID | Type | Title | Epic | Pri | Status | SP | Dependencies |
|---|---|---|---|---|---|---|---|
| SB-040 | Story | Obsidian helper (optional surface) | EPIC-CORE-010 | P2 | Backlog | 5→split | SB-010 |
| SB-041 | Story | Web dashboard (capture/review) | EPIC-CORE-010 | P2 | Backlog | 8→split | SB-010 |
| SB-050 | Story | secure_refs pointer primitive (schema + writer/reader) | EPIC-CORE-011 | P0 | Done | 3 | SB-010 |
| SB-051 | Story | ~~Permission/scope model in interfaces~~ **SPLIT (2026-06-10)** → SB-068 + SB-069 | EPIC-CORE-011 | P1 | Split | 5→split | — |
| SB-052 | Story | ~~Scope enforcement at the interfaces boundary~~ **SPLIT (2026-06-10)** → SB-073 + SB-074 | EPIC-CORE-011 | P1 | Split | 5→split | — |
| SB-067 | Story | `sb secref add/list` CLI + validate_notes secure_refs pass | EPIC-CORE-011 | P0 | Done | 2 | SB-050 |
| SB-068 | Story | Pure grant resolver (`grantAllows`) in interfaces | EPIC-CORE-011 | P1 | Backlog | 2 | SB-010 |
| SB-069 | Story | First-party caller grants registry | EPIC-CORE-011 | P1 | Backlog | 3 | SB-068 |
| SB-073 | Story | Scope enforcement at the operations boundary | EPIC-CORE-011 | P1 | Backlog | 3 | SB-069 |
| SB-074 | Story | Security epic gate (over-scope rejected; secure-ref round-trip) | EPIC-CORE-011 | P1 | Backlog | 2 | SB-067, SB-073 |
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

- **Type:** Story · **Epic:** EPIC-CORE-007 · **Priority:** P2 · **Points:** 2 · **Status:** Done
- **Carrier decision (2026-06-10):** frontmatter `links` (schema: "note ids or titles", additive,
  uniqueItems) carries the non-primary `source_ids`; `source_ref` stays the primary origin.
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

- **Type:** Story · **Epic:** EPIC-CORE-007 · **Priority:** P2 · **Points:** 3 · **Status:** Done
- **Surface decision (2026-06-10):** `sb note promote <rawId> [--title]`; target folder
  `vault/00_Inbox/` (the documented L1 queue per `memory_layers.md`); body seeded from the raw
  content; no event emitted (vault-derived, rebuild-safe).
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

- **Type:** Story · **Epic:** EPIC-CORE-001 (cross-cutting quality) · **Priority:** P2 · **Points:** 3 · **Status:** Done
- **Resolution (2026-06-10):** root `test:coverage` = `c8` wrapping `pnpm test` (subprocess V8
  coverage merged across all packages); non-blocking, ≥80%-line target documented in the README;
  baseline **90.15% lines / 78.27% branches** over 180 tests. `scripts/init_workspace.test.ts`
  (6 subprocess cases) wired into `test:scripts`.
- **Dependencies:** —
- **Context (review finding, MEDIUM):** the suite is broad (80 tests) but there is **no coverage
  measurement** (global rule targets ≥80%), and `scripts/init_workspace.ts` has **no automated test** (only
  manual + the ad-hoc E2E). A regression in the initializer would not be caught by `pnpm test`.
  **2026-06-09 Phase 2 review (finding #8):** still open and now spans the Phase 2 packages too (130 tests,
  still no coverage measurement).
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

- **Type:** Story · **Epic:** EPIC-CORE-008 · **Priority:** P1 · **Points:** 2 · **Status:** Done
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

- **Type:** Story · **Epic:** EPIC-CORE-008 · **Priority:** P1 · **Points:** 3 · **Status:** Done
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

- **Type:** Story · **Epic:** EPIC-CORE-008 · **Priority:** P1 · **Points:** 3 · **Status:** Done
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

- **Type:** Story · **Epic:** EPIC-CORE-008 · **Priority:** P1 · **Points:** 3 · **Status:** Done
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

- **Type:** Story · **Epic:** EPIC-CORE-008 · **Priority:** P1 · **Points:** 3 · **Status:** Done
- **Dependencies:** SB-035 (`Done`)
- **Note (impl):** widened `@sb/event-log` `AppendableMemoryKind` to include `fact_superseded` (one token).
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

- **Type:** Story · **Epic:** EPIC-CORE-008 · **Priority:** P1 · **Points:** 3 · **Status:** Done
- **Dependencies:** SB-023 (`Done`)
- **Note (impl):** reads entity notes via the `@sb/note-vault` API and parses frontmatter with the `yaml`
  lib (added as an `@sb/entity-graph` dep) rather than adding a 4th hand-rolled frontmatter parser.
- **Scope:** `@sb/entity-graph`: project **entity nodes** from `50_Entities/` notes (+ `entities` refs on
  other notes) into SQLite, keyed by ULID. Rebuildable from notes + events.
- **Acceptance Criteria:** each entity note yields one node (id/title/aliases); re-projection is
  idempotent; nodes carry provenance back to their source note.
- **Definition of Done:** tests green; build exit 0; leakage clean.
- **Validation:** `pnpm --filter @sb/entity-graph test` green; build exit 0.
- **Files Expected to Change:** `packages/entity-graph/{package.json,tsconfig.json,README.md,src/*,test/*}`, `docs/planning/*`, `STATUS.md`.
- **Out of Scope:** edges/merges (SB-037).

## SB-037 — entity-graph edges + manual-confirm `entity_merged`

- **Type:** Story · **Epic:** EPIC-CORE-008 · **Priority:** P1 · **Points:** 3 · **Status:** Done
- **Dependencies:** SB-021 (`Done`)
- **Note (impl):** extended the SB-023 projector to fold `entity_merged` → a merge map (+ `resolveEntity`);
  added `readMemoryEvents` + the `entity_merged` kind + a `read_failed` code to `@sb/event-log`; added
  `@sb/event-log` as an `@sb/entity-graph` dep. Edges derived from the `entities` frontmatter refs
  (title-based `[[wikilink]]` resolution intentionally deferred).
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

- **Type:** Story · **Epic:** EPIC-CORE-008 · **Priority:** P2 · **Points:** 3 · **Status:** Done
- **Dependencies:** SB-023 (`Done`)
- **Decision (OQ #4, RESOLVED 2026-06-05):** tasks are derived from **note frontmatter `status`** (a note
  with non-empty `status` + `title` → a task), vault-derived/rebuildable; **no new task event kind**.
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

- **Type:** Story · **Epic:** EPIC-CORE-008 · **Priority:** P1 · **Points:** 3 · **Status:** Done
- **Dependencies:** SB-035 (`Done`), SB-021 (`Done`)
- **Note (impl):** added `appendProjectionEvent` + `validateProjectionEvent` to `@sb/event-log`; the CLI
  `rebuild` command orchestrates fact/entity/edge/task rebuild (cli now deps the projection packages).
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

- **Type:** Story · **Epic:** EPIC-CORE-008 · **Priority:** P1 · **Points:** 2 · **Status:** Done
- **Dependencies:** SB-038 (`Done`)
- **Note (impl):** `apps/cli/test/reproducibility.test.ts` — populates a rich workspace (capture + facts incl.
  a supersede + entities incl. a merge + a task), snapshots all 4 projection tables, **deletes `db/`**,
  re-runs `rebuild`, and asserts row-identical projections. Wired into `pnpm test`. Closes the epic gate.
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

# Phase 2 review follow-up cards (from the 2026-06-09 review; backlog quality band)

> Source: Phase 2 code review of `origin/main` @ `22b02b2` (2026-06-09). Verdict: ship-quality, no
> CRITICAL/HIGH. The MEDIUM findings are SB-042/043 (P2); the LOW findings are SB-044/045/046 (P3).
> Finding #8 (no coverage measurement) is already tracked as SB-033.

## SB-042 — Pin + document the `node:sqlite` runtime requirement

- **Type:** Story · **Epic:** EPIC-CORE-008 · **Priority:** P2 · **Points:** 1 · **Status:** Done
- **Dependencies:** SB-034 (`Done`)
- **Context (review finding, MEDIUM):** the entire L3 layer depends on the built-in `node:sqlite`, which is
  **experimental** in Node 22 (emits an `ExperimentalWarning`; API may change before stabilizing). Nothing
  pins a known-good Node version — there is no `engines.node` floor in any `package.json`, and the README
  does not state the requirement.
- **Scope:** Add an `engines.node` constraint at the workspace root (and `@sb/memory-kernel` if useful)
  pinning the known-good floor (Node ≥22.5, the version validated in SB-034); document the requirement +
  the experimental status in the root README and `packages/memory-kernel/README.md`; note the fallback plan
  (swap to `better-sqlite3` behind `openProjectionStore`) if the built-in API breaks.
- **Acceptance Criteria:**
  - `engines.node` is present and `pnpm install` + `pnpm test` pass on the pinned floor.
  - README(s) state the Node requirement and the experimental caveat.
- **Definition of Done:** docs + manifests updated; full suite green; no production-code change.
- **Validation:** `pnpm install` warning-free w.r.t. engines; root `pnpm test` exit 0.
- **Files Expected to Change:** `package.json`, `packages/memory-kernel/{package.json,README.md}`,
  `README.md`, `docs/planning/*`, `STATUS.md`.
- **Out of Scope:** actually swapping the SQLite driver; supporting older Node.

## SB-043 — Atomic single-connection `rebuild` (one store, one transaction)

- **Type:** Story · **Epic:** EPIC-CORE-008 · **Priority:** P2 · **Points:** 3 · **Status:** Done
- **Note (impl):** `withTransaction` added to `@sb/memory-kernel`; `projectEntities`/`projectEdges`/
  `projectTasks` accept an optional injected open store (caller-owned lifecycle); `runRebuild` does all
  table work on one store in one transaction and appends `projection_reset`/`projection_rebuilt` only
  after commit (a rolled-back run appends nothing). Fault-injection test: title-less entity note mid-rebuild
  → rejects, projections + event stream byte-identical to baseline.
- **Dependencies:** SB-038 (`Done`)
- **Context (review findings, MEDIUM ×2):** (a) `rebuild` is **not atomic** — it resets all tables (+
  emits `projection_reset`), then rebuilds facts→entities→edges→tasks, then emits `projection_rebuilt`; a
  crash mid-rebuild leaves projections empty/partial (a `reset` event with no `rebuilt`). Not data loss
  (`db/` is rebuildable — re-run), but the tables are transiently wrong and nothing wraps the run in a
  transaction. (b) `runRebuild` opens/closes the projection store **~5×** (reset, facts, then each
  `projectX` opens its own), which blocks a single wrapping transaction and is mild overhead.
- **Scope:** Thread **one open `ProjectionStore`** through the whole rebuild (extend
  `projectEntities`/`projectEdges`/`projectTasks` and the fact-replay path to accept an injected store,
  keeping their standalone open-a-store behavior as the default), and wrap the reset+rebuild in a **single
  SQLite transaction** so a failed rebuild rolls back to the pre-rebuild projections. Event emission order
  unchanged (`projection_reset` … `projection_rebuilt`).
- **Acceptance Criteria:**
  - A rebuild that fails mid-way (fault-injected in a test) leaves the projection tables exactly as they
    were before the rebuild (rolled back), and no `projection_rebuilt` event is emitted.
  - A successful rebuild opens the store once and produces the same row-identical result (SB-039 gate
    still green).
- **Definition of Done:** tests green incl. the fault-injection case; `tsc --noEmit` exit 0; SB-039
  reproducibility gate unchanged + green; leakage clean.
- **Validation:** new fault-injection test in `apps/cli/test/`; root `pnpm test` exit 0 (incl.
  reproducibility gate).
- **Files Expected to Change:** `apps/cli/src/rebuild-command.ts`,
  `packages/{fact-store,entity-graph,task-store}/src/*` (store-injection params),
  `packages/memory-kernel/src/store.ts` (transaction helper), tests, `docs/planning/*`, `STATUS.md`.
- **Out of Scope:** incremental (non-full) rebuilds; concurrency/locking across processes; performance
  tuning beyond the single connection.

## SB-044 — Shared frontmatter helper in `@sb/note-vault` (DRY)

- **Type:** Story · **Epic:** EPIC-CORE-003 · **Priority:** P3 · **Points:** 2 · **Status:** Done
- **Note (impl):** `parseFrontmatter` (diagnostic `{frontmatter, body} | {reason}`) + lenient
  `frontmatterOf` in `packages/note-vault/src/frontmatter.ts`; entity-graph (×2), task-store, and
  `validate_notes` migrated; `yaml` dep moved into note-vault (dropped from entity-graph/task-store);
  root devDeps `@sb/note-vault` for the script. `read-notes.ts`'s line-based field extractor deliberately
  retained (SB-015 design: targeted fields, no full parse).
- **Dependencies:** SB-011 (`Done`)
- **Context (review finding, LOW; flagged in the Phase 1 review and grown since):** frontmatter
  parse/build logic now exists ~4× — `@sb/entity-graph` (×2: nodes + edges), `@sb/task-store`, and the
  note-vault read path / `scripts/validate_notes.ts`. Drift risk grows with every new projection.
- **Scope:** Export one shared frontmatter parse helper from `@sb/note-vault` (thin wrapper over the
  `yaml` lib, returning `{frontmatter, body}`), and migrate the entity-graph/task-store/validate_notes
  call sites to it. Behavior-preserving refactor.
- **Acceptance Criteria:** one shared helper; all migrated call sites pass their existing tests unchanged.
- **Definition of Done:** full suite green (130+); `tsc --noEmit` exit 0 across packages; leakage clean.
- **Validation:** root `pnpm test` exit 0; grep shows no remaining hand-rolled frontmatter parsing outside
  the helper.
- **Files Expected to Change:** `packages/note-vault/src/{frontmatter.ts(new),index.ts}`,
  `packages/{entity-graph,task-store}/src/*`, `scripts/validate_notes.ts`, `pnpm-lock.yaml` (dep moves),
  `docs/planning/*`, `STATUS.md`.
- **Out of Scope:** schema changes; new parsing features; touching the capture/distill writers' build path.

## SB-045 — Projection-table consistency hardening (entity reset + edge UNIQUE)

- **Type:** Story · **Epic:** EPIC-CORE-008 · **Priority:** P3 · **Points:** 2 · **Status:** Done
- **Note (impl):** standalone `projectEntities` now full-rebuilds (DELETE + insert; deleted entity note
  drops its stale node — new test); schema **v2**: `CREATE UNIQUE INDEX entity_edges_unique ON
  entity_edges(from_id,to_id,kind)` (idempotent; v1 store upgrades on open — new test; duplicate
  `insertEntityEdge` throws /UNIQUE/ — new test). A v1 db with pre-existing duplicate edges would fail the
  migration; `db/` is disposable → delete + `rebuild`.
- **Dependencies:** SB-037 (`Done`), SB-038 (`Done`)
- **Context (review findings, LOW ×2):** (a) `projectEntities` **upserts without a table reset** while
  edges/tasks full-rebuild — a standalone `projectEntities` run can leave a stale node from a deleted
  entity note (masked today by the `rebuild` command's reset). (b) `entity_edges` has **no `UNIQUE`
  constraint** — dedup happens in-memory per full-rebuild run; safe today, fragile if an incremental
  writer is ever added.
- **Scope:** Make standalone `projectEntities` full-rebuild (DELETE + insert) like edges/tasks, and add a
  `UNIQUE` constraint on `entity_edges(src, dst)` (schema migration v2 in `@sb/memory-kernel`, idempotent).
- **Acceptance Criteria:**
  - Deleting an entity note then re-running `projectEntities` alone drops the stale node (new test).
  - The UNIQUE constraint exists; duplicate edge insertion is rejected/ignored deterministically; SB-039
    gate still green.
- **Definition of Done:** tests green; migration idempotent (re-open applies cleanly); leakage clean.
- **Validation:** new entity-reset + duplicate-edge tests; root `pnpm test` exit 0.
- **Files Expected to Change:** `packages/entity-graph/src/project-entities.ts`,
  `packages/memory-kernel/src/store.ts` (schema v2), tests, `docs/planning/*`, `STATUS.md`.
- **Out of Scope:** incremental projection writers; removing merged-duplicate nodes (separate concern).

## SB-046 — Single-pass note reads in projections

- **Type:** Story · **Epic:** EPIC-CORE-008 · **Priority:** P3 · **Points:** 2 · **Status:** Done
- **Note (impl):** `listNotes(workspace, { includeContent: true })` attaches the verbatim content that
  `listNotes` already read to summarize; `projectEntities`/`projectEdges`/`projectTasks` consume it and
  no longer call `getNote` per note. Single-read AC met structurally ("or equivalent"): grep shows zero
  `getNote` call sites left in the projection packages (no second read path exists) + a unit test that
  `includeContent` returns verbatim bytes and is absent by default.
- **Dependencies:** SB-022 (`Done`)
- **Context (review finding, LOW; performance):** each projection run reads every note **twice** —
  `listNotes()` opens each file to summarize, then the projector calls `getNote()` per note again (O(n)
  double reads). Fine at KB scale; wasteful as the vault grows.
- **Scope:** Let projections obtain full note content in one pass — e.g. a `listNotes({includeContent})`
  option or an iterator on the note-vault read API — and migrate
  `projectEntities`/`projectEdges`/`projectTasks` to it. Behavior-preserving.
- **Acceptance Criteria:** projections read each note file exactly once per run (asserted via an
  fs-spy/counter test or equivalent); outputs unchanged (existing tests green).
- **Definition of Done:** full suite green; `tsc --noEmit` exit 0; SB-039 gate unchanged; leakage clean.
- **Validation:** root `pnpm test` exit 0; the single-read assertion test.
- **Files Expected to Change:** `packages/note-vault/src/{read-notes.ts,index.ts}`,
  `packages/{entity-graph,task-store}/src/*`, tests, `docs/planning/*`, `STATUS.md`.
- **Out of Scope:** caching layers; watch/incremental modes; L4 indexes.

---

# Phase 3 story cards (EPIC-CORE-009 — refined; `Backlog` until open decisions confirmed)

> Sequencing, dependency graph, and the open decisions (OQ #9–12, #17–20) are in
> [`phase_3_story_map.md`](phase_3_story_map.md). Project-wide DoD still applies (no domain leakage; no
> real data committed; raw L0 never overwritten; events append-only TS-owned; `indexes/` is L4 —
> disposable/rebuildable; the sidecar reads the vault read-only and writes only under `indexes/`; AC +
> validation green; STATUS/docs updated). Python-dependent validation is env-gated per OQ #18: root
> `pnpm test` stays Node-only green; sidecar/integration tests run via `pytest` / `test:sidecar`.

## SB-047 — Retrieval + index contracts (interfaces)

- **Type:** Story · **Epic:** EPIC-CORE-009 · **Priority:** P1 · **Points:** 2 · **Status:** Done (`2fca71f`)
- **Dependencies:** SB-010 (`Done`)
- **Scope (contracts only, mirrors SB-010/019/020):** new `packages/interfaces/src/retrieval.ts` —
  `IndexVaultInput`/`IndexVaultResult` (counts per index type), `QueryMemoryInput`
  (`{q, k?, mode?: "lexical"|"vector"|"hybrid", filters?}`), `QueryMemoryResult` +
  `RetrievalHit` (`{id, score, snippet?, source_ref}`), and the sidecar envelope types
  (`SidecarRequest {op, req_id, args}`, `SidecarResponse {req_id, ok, data?|error?{code,message}}`).
  `scope.ts`: add `read:index` + `write:index` (least-privilege; query never writes). `operations.ts`:
  `indexVault` (`write:index`) + `queryMemory` (`read:index`, readOnly) descriptors. `index.ts` re-exports.
- **Acceptance Criteria:** `tsc --noEmit` exit 0; throwaway alignment smoke (typed values per new type +
  both scopes + both `OPERATION_CONTRACTS` entries) compiles under `--strict --module nodenext`.
- **Definition of Done:** contracts only — no impl, no new dependency, no schema change; leakage grep clean.
- **Validation:** `pnpm --filter @sb/interfaces build`; alignment smoke; leakage grep.
- **Files Expected to Change:** `packages/interfaces/src/{retrieval.ts(new),scope.ts,operations.ts,index.ts}`,
  `docs/planning/*`, `STATUS.md`.
- **Out of Scope:** any Python; any transport impl; JSON schema files (SB-030 carries the protocol fixture).

## SB-030 — Python sidecar skeleton (stdio JSONL, ping/health)

- **Type:** Story · **Epic:** EPIC-CORE-009 · **Priority:** P1 · **Points:** 3 · **Status:** Done (`efcfdb3`)
- **Dependencies:** SB-047; OQ #17 (toolchain) confirmed
- **Scope:** `sidecars/retrieval` becomes a real uv project (`pyproject.toml` + `uv.lock`, Python ≥3.11
  pinned; no DuckDB/model deps yet). Entrypoint reads JSONL requests on stdin, writes one JSONL response
  per request on stdout (stderr = logs only): `ping` → `{ok:true,data:{pong:true}}`; `health` →
  `{ok:true,data:{version, python}}`; unknown op → structured `{ok:false,error:{code:"unknown_op"}}`;
  malformed line → structured error response (never a crash, never a non-JSON stdout line). Deterministic
  `req_id` correlation. README rewritten: one-command setup (`uv sync`) + run + protocol reference.
- **Acceptance Criteria:**
  - `uv run pytest` green: ping/health round-trip, unknown op, malformed JSON line, req_id correlation,
    stdout purity (every stdout line parses as a response envelope).
  - The process exits cleanly on stdin EOF.
- **Definition of Done:** pytest green; no vault/index/event access of any kind in this story; README setup
  verified on this machine (uv installs the pinned interpreter).
- **Validation:** `uv run pytest` inside `sidecars/retrieval`; manual echo-pipe smoke
  (`printf '{"op":"ping","req_id":"r1"}\n' | uv run python -m …`).
- **Files Expected to Change:** `sidecars/retrieval/{pyproject.toml,uv.lock,README.md,src/**,tests/**}` (new),
  `docs/planning/*`, `STATUS.md`.
- **Out of Scope:** DuckDB, embeddings, vault reading, TS client (SB-048).

## SB-048 — TS sidecar transport client (`@sb/retrieval`)

- **Type:** Story · **Epic:** EPIC-CORE-009 · **Priority:** P1 · **Points:** 3 · **Status:** Done
- **Dependencies:** SB-030, SB-047
- **Scope:** `packages/retrieval` becomes a real package — `SidecarClient`: spawn the sidecar (`uv run …`,
  cwd `sidecars/retrieval`, overridable command for tests), newline-framed JSONL write/read with
  per-request `req_id` correlation, configurable timeout, structured `RetrievalError`
  (`spawn_failed`/`timeout`/`protocol_error`/`sidecar_error`), graceful shutdown (stdin end → wait → kill).
  Envelope validation against the SB-047 types. Unit tests run against a **stub sidecar script (Node)** so
  root `pnpm test` stays Python-free; a `ping` round-trip against the real sidecar lands in the env-gated
  `test:sidecar` target (OQ #18).
- **Acceptance Criteria:**
  - Unit (stub-sidecar): request/response correlation incl. out-of-order responses; timeout → `timeout`;
    sidecar nonsense line → `protocol_error`; sidecar `{ok:false}` → `sidecar_error` with code passthrough;
    spawn failure → `spawn_failed`; clean shutdown.
  - Env-gated integration: real `ping` round-trip green when the sidecar env exists, visible SKIP otherwise.
- **Definition of Done:** `pnpm test` green Python-free; `tsc --noEmit` exit 0; leakage clean.
- **Validation:** `pnpm --filter @sb/retrieval test` + build; `pnpm run test:sidecar` (env-gated) green/SKIP.
- **Files Expected to Change:** `packages/retrieval/{package.json,tsconfig.json,README.md,src/**,test/**}` (new),
  root `package.json` (`test:sidecar` target), `pnpm-lock.yaml`, `docs/planning/*`, `STATUS.md`.
- **Out of Scope:** index/query ops (SB-031+); CLI wiring (SB-053/032); long-running daemon mode.

## SB-031 — FTS index build + lexical query (sidecar, DuckDB)

- **Type:** Story · **Epic:** EPIC-CORE-009 · **Priority:** P1 · **Points:** 3 · **Status:** Done
- **Dependencies:** SB-048; OQ #10/#19/#20 confirmed
- **Scope:** sidecar gains DuckDB (uv dep) + two ops. `index_vault {workspace}`: scan `vault/**/*.md`
  **read-only**, parse frontmatter + body, chunk heading-aware ~512 tokens (chunk id `<ULID>#<seq>`,
  `source_ref` = note id), build the FTS table/index in **`indexes/retrieval.duckdb`** (full rebuild per
  run; idempotent; deterministic) → `{ok,data:{notes,chunks}}`. `query {q,k,mode:"lexical"}`: FTS match →
  `{hits:[{id,score,snippet,source_ref}]}` ordered by score desc, deterministic tie-break by id. Writes
  **only** under `indexes/`; never touches `vault/`, `events/`, `db/`.
- **Acceptance Criteria:**
  - pytest: index a fixture vault → expected note/chunk counts; re-index idempotent; query returns the
    seeded note for a distinctive term with snippet + provenance; empty vault → 0/empty; vault bytes
    unchanged after index (snapshot compare); only `indexes/` modified.
- **Definition of Done:** `uv run pytest` green; protocol unchanged (envelope from SB-030); no model deps yet.
- **Validation:** `uv run pytest`; manual JSONL smoke against a throwaway workspace.
- **Files Expected to Change:** `sidecars/retrieval/{pyproject.toml,uv.lock,src/**,tests/**}`,
  `docs/planning/*`, `STATUS.md`.
- **Out of Scope:** embeddings/vector/hybrid (SB-049); graph/temporal (SB-055); TS/CLI (SB-053/032).

## SB-053 — `sb index` CLI + `indexed` projection event

- **Type:** Story · **Epic:** EPIC-CORE-009 · **Priority:** P1 · **Points:** 2 · **Status:** Done
- **Dependencies:** SB-031
- **Scope:** `apps/cli` `index` command (`runIndex`): resolve safe workspace → `SidecarClient.indexVault`
  → on success append one **`indexed` projection event** (TS-emitted, `actor:"cli"`, payload = counts;
  the sidecar never writes events) → print counts. `scripts/index_vault.ts` stub replaced by a thin
  delegation to the same path. Unit tests against the stub sidecar (Python-free); read-only guarantees
  test (raw + capture/memory streams byte-unchanged; only `indexes/` + projection stream change) —
  env-gated where the real sidecar is needed.
- **Acceptance Criteria:** one successful run = one `indexed` event with counts; sidecar failure = no
  event + structured error; raw/events byte-unchanged (test).
- **Definition of Done:** `pnpm test` green Python-free; builds exit 0; leakage clean.
- **Validation:** `pnpm --filter @sb/cli test`; env-gated E2E (`pnpm run test:sidecar`).
- **Files Expected to Change:** `apps/cli/src/{index-command.ts(new),index.ts}` + tests,
  `apps/cli/{package.json,README.md}`, `scripts/index_vault.ts`, `pnpm-lock.yaml`, `docs/planning/*`, `STATUS.md`.
- **Out of Scope:** query (SB-032); scheduling/watch mode; incremental indexing.

## SB-032 — `sb query` CLI + facade query

- **Type:** Story · **Epic:** EPIC-CORE-009 · **Priority:** P1 · **Points:** 2 · **Status:** Done
- **Dependencies:** SB-053
- **Scope:** `@sb/retrieval` facade `queryMemory(opts)` (contract types from SB-047) + `apps/cli` `query`
  command (`sb query "<q>" [--k N] [--mode lexical|hybrid]`; mode default lexical until SB-049 lands, then
  hybrid) printing ranked `{id, score, snippet, source_ref}`. **Read-only**: never writes events, never
  touches the workspace beyond reading `indexes/` via the sidecar. `scripts/query_memory.ts` stub replaced
  by thin delegation.
- **Acceptance Criteria:** stub-sidecar unit tests (arg validation, result mapping, error passthrough,
  no writes); env-gated E2E — capture → index → query returns the captured note with provenance.
- **Definition of Done:** `pnpm test` green Python-free; builds exit 0; leakage clean.
- **Validation:** `pnpm --filter @sb/retrieval --filter @sb/cli test`; `pnpm run test:sidecar` E2E.
- **Files Expected to Change:** `packages/retrieval/src/**` + tests, `apps/cli/src/{query-command.ts(new),index.ts}`
  + tests, `apps/cli/README.md`, `scripts/query_memory.ts`, `docs/planning/*`, `STATUS.md`.
- **Out of Scope:** hybrid ranking itself (SB-049); answer generation (Phase 4); filters beyond `k`/`mode`.

## SB-049 — BGE-M3 embeddings + DuckDB VSS + hybrid ranking

- **Type:** Story · **Epic:** EPIC-CORE-009 · **Priority:** P1 · **Points:** 3 · **Status:** Done
- **OQ #9 resolution (2026-06-10): fallback `bge-small-en-v1.5` (384-d) adopted.** BGE-M3 is
  unloadable on this machine (repo ships only `pytorch_model.bin`; transformers requires torch ≥2.6
  for `.bin` loads per CVE-2025-32434; torch on macOS x86_64 caps at 2.2.2). Fallback CPU benchmark
  (i9-9880H): load 0.93 s, **5.93 chunks/s** indexing, **14 ms** median query embed
  (`sidecars/retrieval/benchmarks/bench_embed.py`). English-only limitation documented; override via
  `SB_EMBED_MODEL`.
- **Dependencies:** SB-031; OQ #9 confirmed (CPU check is **inside** this story)
- **Scope:** sidecar `index_vault` additionally embeds chunks (BGE-M3, 1024-d, local/offline after first
  model fetch; model cache **outside** the workspace) into a DuckDB VSS (HNSW) table in the same
  `indexes/retrieval.duckdb`; `query` gains `mode:"vector"` and `mode:"hybrid"` (vector+keyword merge
  ~70/30, weight tunable via arg) and hybrid becomes the sidecar default. **First task: CPU benchmark on
  this Mac** (index N notes + query latency); if unacceptable, fall back to `bge-small-en-v1.5` (384-d)
  behind the same ops and record the decision in OQ #9.
- **Acceptance Criteria:** pytest (model-dependent cases skippable offline): vector query returns a
  semantically-related seeded note for a paraphrase term that lexical misses; hybrid ≥ lexical on the
  fixture set; re-index idempotent; benchmark numbers recorded in the story/STATUS.
- **Definition of Done:** `uv run pytest` green (offline-skips visible); OQ #9 resolution documented;
  `indexes/` still the only write target.
- **Validation:** `uv run pytest`; benchmark snippet in STATUS; env-gated E2E query via `sb query --mode hybrid`.
- **Files Expected to Change:** `sidecars/retrieval/{pyproject.toml,uv.lock,src/**,tests/**}`,
  `docs/planning/{open_questions.md,*}`, `STATUS.md`.
- **Out of Scope:** GPU/remote inference; reranker models; contextual retrieval (later per strategy doc).

## SB-054 — Index disposability gate (delete `indexes/` → lossless rebuild)

- **Type:** Story · **Epic:** EPIC-CORE-009 · **Priority:** P1 · **Points:** 2 · **Status:** Done
  — **the epic gate is MET (2026-06-10)**: `apps/cli/test/disposability-gate.test.ts` (env-gated,
  in `test:sidecar`).
- **Dependencies:** SB-032, SB-049
- **Scope:** the epic **"Done when"** as an automated env-gated test (mirrors SB-039): populate a
  throwaway workspace (capture + entity + task notes), `sb index`, run a fixed query set and snapshot
  results; **delete `indexes/` entirely**; `sb index` again; assert the same query set returns
  **identical ranked results** (and L0/events byte-unchanged throughout). Wire into `test:sidecar`.
- **Acceptance Criteria:** the delete-and-rebuild test is green locally; any non-determinism in
  build/ranking fails it; documented as the epic gate.
- **Definition of Done:** gate green on this machine; STATUS + roadmap "Phase 3 — Done when" marked met.
- **Validation:** `pnpm run test:sidecar` (gate included).
- **Files Expected to Change:** a test under `apps/cli/test/` or `packages/retrieval/test/` (env-gated),
  root `package.json` (wiring), `docs/planning/{implementation_roadmap.md,*}`, `STATUS.md`.
- **Out of Scope:** performance regression gates; cross-machine reproducibility.

## SB-055 — Graph + temporal indexes (stretch)

- **Type:** Story · **Epic:** EPIC-CORE-009 · **Priority:** P2 · **Points:** 3 · **Status:** Done
  (2026-06-10 — human approved starting the stretch after the SB-054 gate)
- **Dependencies:** SB-054
- **Scope:** sidecar `index_vault` additionally builds (a) a **graph** table from `[[wikilinks]]` +
  frontmatter `entities` refs (edges with provenance; complements the L3 SQLite entity graph — this is
  the L4 retrieval view) and (b) a **temporal** bucket table from frontmatter dates + event timestamps;
  `query` gains graph-neighborhood and time-range **filters** (`filters:{near?, from?, to?}`) composable
  with lexical/hybrid modes.
- **Acceptance Criteria:** pytest: wikilink fixture produces expected edges; time-range filter excludes
  out-of-range notes; filters compose with hybrid mode; rebuild lossless (SB-054 gate extended or
  re-asserted).
- **Definition of Done:** pytest green; gate still green; not required for the epic gate (can defer).
- **Validation:** `uv run pytest`; `pnpm run test:sidecar`.
- **Files Expected to Change:** `sidecars/retrieval/src/**` + tests, `packages/interfaces/src/retrieval.ts`
  (filters), `packages/retrieval/src/**`, `docs/planning/*`, `STATUS.md`.
- **Out of Scope:** graph algorithms beyond 1-hop neighborhood; recurrence/scheduling semantics.

---

# Phase 4 story cards (EPIC-CORE-014 — refined; `Backlog` until OQ #21–#25 confirmed)

Refined 2026-06-10 — see [`phase_4_story_map.md`](phase_4_story_map.md) for objective, architecture,
open decisions, and sequencing. Shared constraints for every card: skills never write directly (CLI
commands are the only writers, always human-confirmed); all six memory-layer hard rules; events
TS-emitted; no new event kinds or schema changes; no `sidecars/ai` code (OQ #21 lean).

---

## SB-056 — AI-workflow proposal contracts (interfaces + proposal schema)

- **Type:** Story · **Epic:** EPIC-CORE-014 · **Priority:** P1 · **Points:** 2 · **Status:** Done
  (2026-06-10 — autonomous session; scope note: `write:outputs` scope name [not `write:note`];
  `addFact` descriptor already existed since Phase 2, so only `composeOutput` was added)
- **Dependencies:** SB-010 (`Done`)
- **Scope:** contracts only, mirroring SB-010/019/047. (a) `schemas/json/proposal.schema.json` —
  the shared, versioned proposal envelope (OQ #22): required `workflow`
  (`extract_facts|braindump|review|compose_output`), `version` (const 1), `proposed_at` (ISO),
  `items[]` (≥1); per-workflow item shapes via allOf (fact item: `statement`, `source_ref` ULID,
  `observed_at`, `confidence` 0–1, optional `supersedes`; output item: `title`, `sources[]` ≥1,
  `body`). (b) `@sb/interfaces` `src/proposals.ts`: matching TS types + `addFact`/`composeOutput`
  operation descriptors and `write:fact`/`write:note` scope additions in
  `scope.ts`/`operations.ts`; `index.ts` re-exports. Example proposal files under `examples/`.
- **Acceptance Criteria:** schema validates the example proposals (Ajv) and rejects an itemless /
  unknown-workflow / bad-confidence proposal; `@sb/interfaces` typecheck passes; descriptors carry
  scope + readOnly flags consistent with existing entries; no implementation code.
- **Definition of Done:** project-wide DoD; alignment smoke (typed value per new type compiles
  `--strict`); leakage grep clean.
- **Validation:** `pnpm --filter @sb/interfaces run build`; root `pnpm test`; Ajv check of examples.
- **Files Expected to Change:** `schemas/json/proposal.schema.json(new)`,
  `packages/interfaces/src/{proposals.ts(new),scope.ts,operations.ts,index.ts}`,
  `examples/proposals/*(new)`, `docs/planning/{story_backlog.md,phase_4_story_map.md}`, `STATUS.md`.
- **Out of Scope:** CLI commands (SB-057/059); any skill; any writer.

## SB-057 — `sb fact` CLI (add / accept-file / list)

- **Type:** Story · **Epic:** EPIC-CORE-014 · **Priority:** P1 · **Points:** 3 · **Status:** Done
  (2026-06-10 — autonomous session; scope note: accept-file validation is structural-typed
  mirroring `proposal.schema.json` — the same approach as `distill accept`, no Ajv dep in the CLI;
  the schema itself is test-locked by SB-056)
- **Dependencies:** SB-056
- **Scope:** the human-confirmed write path for L3 facts. `apps/cli` `fact` command
  (`fact-command.ts`): (a) `sb fact add --statement <s> --source-ref <ulid> [--confidence <0..1>]
  [--observed-at <iso>] [--supersedes <ulid>]` — one fact via `@sb/fact-store`
  `addFact`/`supersedeFact` (which already append `fact_added`/`fact_superseded` events + project the
  row); (b) `sb fact accept --file <proposal.json>` — validate against `proposal.schema.json`
  (`workflow: extract_facts`), then write items sequentially with a per-item result report
  (`{ok,written,failed:[{index,code}]}`); validation failure writes **nothing**; (c) `sb fact list
  [--source-ref] [--min-confidence] [--limit]` — read-only over `listCurrentFacts`.
  `FactCliError("bad_arguments"|"invalid_proposal")`.
- **Acceptance Criteria:** add writes exactly one event + one row (asserted); accept of a 3-item file
  writes 3 facts each with provenance; an invalid file (schema or per-item) is rejected before any
  write; list output matches `listCurrentFacts`; supersede path repoints current view; raw/vault
  untouched (events + db only).
- **Definition of Done:** project-wide DoD; cli tests cover add/accept/accept-invalid/list/supersede.
- **Validation:** `pnpm --filter @sb/cli test`; root `pnpm test`.
- **Files Expected to Change:** `apps/cli/src/{fact-command.ts(new),index.ts}`,
  `apps/cli/test/fact-command.test.ts(new)`, `apps/cli/package.json(dep @sb/fact-store if absent)`,
  `pnpm-lock.yaml`, `docs/planning/story_backlog.md`, `STATUS.md`.
- **Out of Scope:** the extract-facts skill (SB-062); AI drafting; dedupe heuristics (OQ #23 puts
  them in the skill).

## SB-058 — L5 output writer (`writeOutputNote`)

- **Type:** Story · **Epic:** EPIC-CORE-014 · **Priority:** P1 · **Points:** 2 · **Status:** Done
  (2026-06-10 — autonomous session)
- **Dependencies:** SB-056
- **Scope:** `@sb/note-vault` `writeOutputNote()` (`output-note-writer.ts` + `OutputNoteWriteError`),
  mirroring the L1/L2 writers: target `vault/60_Outputs/`, frontmatter `type: output` / `layer: 5`,
  **required** `title` and **non-empty `sources`** (schema-required for L5), optional tags/slug;
  exclusive create (`wx`), raw-path + workspace-escape refusal; body verbatim.
- **Acceptance Criteria:** written note is Ajv-valid against frontmatter schema v1; empty/missing
  `sources` or `title` rejected writing nothing; never overwrites; refuses `00_Raw/` targets;
  bytesWritten/path/created returned like sibling writers.
- **Definition of Done:** project-wide DoD; note-vault tests mirror the working-note writer suite.
- **Validation:** `pnpm --filter @sb/note-vault test`; root `pnpm test`.
- **Files Expected to Change:** `packages/note-vault/src/{output-note-writer.ts(new),errors.ts,index.ts}`,
  `packages/note-vault/test/output-note-writer.test.ts(new)`, `packages/note-vault/README.md`,
  `docs/planning/story_backlog.md`, `STATUS.md`.
- **Out of Scope:** the CLI (SB-059); source resolution (CLI concern, OQ #24); events.

## SB-059 — `sb output create` CLI + `note_created` memory event

- **Type:** Story · **Epic:** EPIC-CORE-014 · **Priority:** P1 · **Points:** 2 · **Status:** Done
  (2026-06-10 — autonomous session; scope notes: `AppendableMemoryKind` already included
  `note_created` so no event-log change was needed; OQ #24 resolution implemented as "ULID source
  must be a note OR a current fact id, non-ULID strings accepted as-is")
- **Dependencies:** SB-058
- **Scope:** `apps/cli` `output` command (`output-command.ts`): `sb output create --file
  <proposal.json>` (envelope `workflow: compose_output`, single item v1) → validate → **resolve
  note-id sources via `getNote`** (missing note id ⇒ `source_not_found`, nothing written; non-note
  ULIDs accepted — OQ #24) → `writeOutputNote` → append one TS-emitted **`note_created`** memory
  event (`subject_id` = note id, `actor: "cli"`; widen `AppendableMemoryKind` — kind already in
  event schema v1). Print `{ok,note_id,note_path,event_id}`.
- **Acceptance Criteria:** happy path writes exactly one L5 note + one memory event; missing source
  note ⇒ no note, no event; writer failure ⇒ no event; event append failure after write ⇒
  structured `event_append_failed` (note kept — mirrors SB-053 semantics); L0/L1 untouched.
- **Definition of Done:** project-wide DoD; cli tests cover happy/missing-source/no-event-on-failure.
- **Validation:** `pnpm --filter @sb/cli test`; root `pnpm test`.
- **Files Expected to Change:** `apps/cli/src/{output-command.ts(new),index.ts}`,
  `apps/cli/test/output-command.test.ts(new)`, `packages/event-log/src/memory-event.ts`
  (`AppendableMemoryKind` +`note_created`), `docs/planning/story_backlog.md`, `STATUS.md`.
- **Out of Scope:** the compose-output skill (SB-065); retrieval grounding; fact-id existence checks.

## SB-062 — `skills/extract-facts` + safety check

- **Type:** Story · **Epic:** EPIC-CORE-014 · **Priority:** P1 · **Points:** 3 · **Status:** Done
  (2026-06-10 — autonomous session)
- **Dependencies:** SB-057
- **Scope:** `skills/extract-facts/SKILL.md` mirroring `skills/distill`: read the target note(s)
  via read-only commands; draft a `proposal.schema.json` `extract_facts` proposal (statement +
  `source_ref` = note ULID + `observed_at` + `confidence` per item); **surface near-duplicates**
  (via `sb fact list` + `sb query`) with an add/supersede/skip recommendation per item (OQ #23);
  show the exact proposal for explicit confirmation; only then run `sb fact accept --file`. Plus an
  E2E safety check (`apps/cli/test/extract-safety.test.ts`, mirrors `distill-safety`): a
  propose-shaped flow without accept writes **zero** facts/events and leaves L0/L1 byte-unchanged;
  accept writes exactly the proposal's items with provenance.
- **Acceptance Criteria:** skill doc states the non-negotiable safety rules (no write without
  confirmation; provenance mandatory; never edit sources); safety test green and wired into
  `pnpm test`; duplicate-surfacing step documented with the exact commands.
- **Definition of Done:** project-wide DoD; skill follows the distill SKILL.md structure.
- **Validation:** root `pnpm test` (safety check included).
- **Files Expected to Change:** `skills/extract-facts/SKILL.md(new)`,
  `apps/cli/test/extract-safety.test.ts(new)`, `docs/planning/story_backlog.md`, `STATUS.md`.
- **Out of Scope:** auto-dedupe; batch/scheduled extraction; `sidecars/ai`.

## SB-063 — `skills/braindump` + safety check

- **Type:** Story · **Epic:** EPIC-CORE-014 · **Priority:** P1 · **Points:** 3 · **Status:** Done
  (2026-06-10 — autonomous session)
- **Dependencies:** SB-056
- **Scope:** `skills/braindump/SKILL.md`: take a freeform dump → `sb capture` it verbatim as L0
  (loss-free first, always) → propose a segmentation (titles/tags per segment, task-status
  suggestions where a segment is actionable) as a `braindump` proposal → human confirms → apply via
  existing confirmed commands only (`sb note promote --title …` per accepted segment). The L0
  capture is never altered by segmentation. Safety check: dump → capture → propose without
  confirmation ⇒ exactly one L0 note + one capture event and nothing else; L0 bytes unchanged after
  promotes.
- **Acceptance Criteria:** capture-first is unconditional and documented; every promote is
  per-segment human-confirmed; no direct vault writes; safety test green in `pnpm test`.
- **Definition of Done:** project-wide DoD.
- **Validation:** root `pnpm test` (safety check included).
- **Files Expected to Change:** `skills/braindump/SKILL.md(new)`,
  `apps/cli/test/braindump-safety.test.ts(new)`, `docs/planning/story_backlog.md`, `STATUS.md`.
- **Out of Scope:** new CLI surface; auto-promotion; entity extraction (use extract-facts after).

## SB-064 — `skills/review` + safety check

- **Type:** Story · **Epic:** EPIC-CORE-014 · **Priority:** P1 · **Points:** 3 · **Status:** Done
  (2026-06-10 — autonomous session)
- **Dependencies:** SB-057
- **Scope:** `skills/review/SKILL.md`: deterministic candidate surfacing only (OQ #25) — working
  notes in `00_Inbox` older than N days (`sb note list` + frontmatter `created`), raw notes never
  promoted (no working note carries them as `source_ref`), stale-`status` tasks — then a `review`
  proposal recommending per-item actions (promote / distill / supersede-fact / leave), each applied
  **only** via the existing confirmed commands (`note promote`, `distill propose/accept`,
  `fact add --supersedes`). Safety check: a full review pass without confirmations writes nothing.
- **Acceptance Criteria:** candidate queries are documented and reproducible (no hidden heuristics
  in prose); every action maps to an existing human-confirmed command; safety test green.
- **Definition of Done:** project-wide DoD.
- **Validation:** root `pnpm test` (safety check included).
- **Files Expected to Change:** `skills/review/SKILL.md(new)`,
  `apps/cli/test/review-safety.test.ts(new)`, `docs/planning/story_backlog.md`, `STATUS.md`.
- **Out of Scope:** scheduling/cadence automation; new CLI; scoring models.

## SB-065 — `skills/compose-output` + safety check

- **Type:** Story · **Epic:** EPIC-CORE-014 · **Priority:** P1 · **Points:** 2 · **Status:** Done
  (2026-06-10 — autonomous session)
- **Dependencies:** SB-059
- **Scope:** `skills/compose-output/SKILL.md`: retrieval-grounded L5 drafting — gather context via
  `sb query` (hybrid default) + `note get`; draft the output **with explicit citations** mapping
  every claim-bearing section to source ids; build a `compose_output` proposal (`title`, `sources[]`
  = every cited id, `body`); human confirms; `sb output create --file` is the only write. Safety
  check: draft without confirmation writes nothing; accepted output is schema-valid with non-empty
  resolvable sources.
- **Acceptance Criteria:** the skill forbids uncited claims in the body; `sources` must cover every
  cited id; safety test green in `pnpm test`.
- **Definition of Done:** project-wide DoD.
- **Validation:** root `pnpm test`; env-gated retrieval steps documented (skill works with lexical
  fallback when the sidecar env is absent).
- **Files Expected to Change:** `skills/compose-output/SKILL.md(new)`,
  `apps/cli/test/compose-output-safety.test.ts(new)`, `docs/planning/story_backlog.md`, `STATUS.md`.
- **Out of Scope:** answer-generation service; templates library; multi-output campaigns.

## SB-066 — Phase 4 provenance + confirmation gate

- **Type:** Story · **Epic:** EPIC-CORE-014 · **Priority:** P1 · **Points:** 2 · **Status:** Done
  — **the epic gate is MET (2026-06-10)**: `apps/cli/test/phase4-gate.test.ts` (Node-only, in
  `pnpm test`; retrieval not needed — grounding is exercised by the skill docs, the gate sweeps
  the write paths)
- **Dependencies:** SB-062, SB-063, SB-064, SB-065
- **Scope:** the epic **"Done when"** as an automated test (mirrors SB-027/039/054):
  `apps/cli/test/phase4-gate.test.ts` sweeps every Phase 4 write path on a throwaway workspace —
  (a) each workflow's propose-without-accept leaves vault + all three event streams + `db/`
  **byte/row-identical** to baseline; (b) each accepted write carries provenance (facts:
  `source_ref`+`observed_at`+`confidence`; outputs: non-empty sources, note-ids resolvable);
  (c) L0/L1 bytes unchanged throughout; (d) every appended event validates against event schema v1.
  Wire into `pnpm test` (retrieval-dependent steps env-gated per OQ #18 if needed).
- **Acceptance Criteria:** gate green locally; any unconfirmed write or provenance-less artifact
  fails it; roadmap "Phase 4 — Done when" marked met on completion.
- **Definition of Done:** gate green; STATUS + roadmap updated.
- **Validation:** root `pnpm test` (+ `test:sidecar` if retrieval-grounding is exercised).
- **Files Expected to Change:** `apps/cli/test/phase4-gate.test.ts(new)`, root `package.json` (wiring
  if needed), `docs/planning/{implementation_roadmap.md,story_backlog.md,phase_4_story_map.md}`,
  `STATUS.md`.
- **Out of Scope:** performance gates; multi-machine reproducibility; sidecar-AI scenarios.

---

# Security story cards (EPIC-CORE-011 — refined 2026-06-10; `Backlog` until OQ #26–#28 confirmed)

See [`security_story_map.md`](security_story_map.md) for objective, open decisions (OQ #26–#28),
and the dependency graph. Shared constraints: raw sensitive bytes NEVER enter the workspace;
`ALWAYS_DENIED_SCOPES` are hard-denied for every caller; enforcement sits at the operations
boundary only; no new external dependency.

## SB-050 — secure_refs pointer primitive

- **Type:** Story · **Epic:** EPIC-CORE-011 · **Priority:** P0 · **Points:** 3 · **Status:** Done
  (2026-06-10 — autonomous session; guardrail notes: single-line ≤500-char metadata enforcement
  [`not_a_container`], error messages/details never echo locator/notes values, no body parameter
  exists at all)
- **Dependencies:** SB-010 (`Done`)
- **Scope:** `schemas/markdown/secure_ref.schema.json` (frontmatter-only pointer: `id`
  (`secref_…`), `kind`, `location: external` const, opaque `locator`, `captured_at`, optional
  `notes`; NO body) + `@sb/note-vault` `writeSecureRef`/`listSecureRefs` (`secure_refs/<id>.md`,
  exclusive create, refuses non-empty body or any content-bearing field, never under `vault/`).
- **AC:** written ref is Ajv-valid; a body/content payload is rejected writing nothing;
  never-overwrite; reader returns metadata only. **Validation:** note-vault tests + root `pnpm test`.
- **Files:** `schemas/markdown/secure_ref.schema.json(new)`,
  `packages/note-vault/src/{secure-ref.ts(new),errors.ts,index.ts}` + test, docs, `STATUS.md`.
- **Out of Scope:** CLI (SB-067); reading external storage; encryption.

## SB-067 — `sb secref add/list` CLI + validation pass

- **Type:** Story · **Epic:** EPIC-CORE-011 · **Priority:** P0 · **Points:** 2 · **Status:** Done
  (2026-06-10 — autonomous session; audit note: `secref add` stdout echoes id/kind/path/
  captured_at but never the locator value; ids default to `secref_<ULID>`)
- **Dependencies:** SB-050
- **Scope:** `sb secref add --kind <k> --locator <opaque> [--notes]` / `sb secref list`;
  `validate_notes.ts` gains a secure_refs pass (OQ #28: separate pass, files outside `vault/`).
- **AC:** add → one schema-valid pointer file + stdout envelope; list read-only; validate flags a
  hand-broken ref. **Validation:** cli + scripts tests; root `pnpm test`.
- **Files:** `apps/cli/src/{secref-command.ts(new),index.ts}` + test, `scripts/validate_notes.ts`
  (+test), docs, `STATUS.md`.
- **Out of Scope:** grants/enforcement; secure storage management.

## SB-068 — Pure grant resolver in interfaces

- **Type:** Story · **Epic:** EPIC-CORE-011 · **Priority:** P1 · **Points:** 2 · **Status:** Backlog
- **Dependencies:** SB-010 (`Done`)
- **Scope:** `@sb/interfaces` `grantAllows(grant, scope): boolean` — wildcard segment matching,
  deny overrides allow, `ALWAYS_DENIED_SCOPES` hard-denied regardless of grant. Pure; table tests.
- **AC:** table tests cover exact/wildcard/deny/always-denied; no I/O. **Validation:** interfaces
  typecheck + new test target; root `pnpm test`.
- **Files:** `packages/interfaces/src/{scope.ts,index.ts}` (+ test wiring), docs, `STATUS.md`.
- **Out of Scope:** registry (SB-069); enforcement (SB-073).

## SB-069 — First-party caller grants registry

- **Type:** Story · **Epic:** EPIC-CORE-011 · **Priority:** P1 · **Points:** 3 · **Status:** Backlog
- **Dependencies:** SB-068
- **Scope (OQ #26/#27):** typed in-code registry + `grantFor(caller)`: `cli` = all scopes minus
  `ALWAYS_DENIED_SCOPES`; `sidecar:retrieval` = `read:notes` + `write:index` + `read:index`;
  `skill:*` = none (skills write via cli). Documented least-privilege rationale per caller.
- **AC:** registry matches the documented table; unknown caller → empty grant; ALWAYS_DENIED never
  present. **Validation:** interfaces tests; root `pnpm test`.
- **Files:** `packages/interfaces/src/{grants.ts(new),index.ts}` + test, docs, `STATUS.md`.
- **Out of Scope:** `config/grants.json` (domain apps, EPIC-CORE-012); enforcement.

## SB-073 — Scope enforcement at the operations boundary

- **Type:** Story · **Epic:** EPIC-CORE-011 · **Priority:** P1 · **Points:** 3 · **Status:** Backlog
- **Dependencies:** SB-069
- **Scope:** `enforceScope(caller, operation)` (resolves `OPERATION_CONTRACTS[op].scope` via
  `grantFor` + `grantAllows`; deny → structured `scope_denied`) consulted at every CLI command
  entry point with `caller: "cli"`. No env bypass (OQ #27). All existing tests stay green.
- **AC:** every write command passes through the check; a forced under-scoped caller is rejected;
  zero behavior change for the default cli grant. **Validation:** cli tests; root `pnpm test`.
- **Files:** `packages/interfaces/src/{enforce.ts(new),index.ts}`, `apps/cli/src/*-command.ts`
  (entry-point wiring), tests, docs, `STATUS.md`.
- **Out of Scope:** per-package internal checks; domain-app grant loading.

## SB-074 — Security epic gate

- **Type:** Story · **Epic:** EPIC-CORE-011 · **Priority:** P1 · **Points:** 2 · **Status:** Backlog
- **Dependencies:** SB-067, SB-073
- **Scope:** the epic "Done when" automated (`apps/cli/test/security-gate.test.ts`): (a) an
  over-scoped caller gets `scope_denied` on EVERY write operation; (b) no grant can obtain
  `ALWAYS_DENIED_SCOPES`; (c) secure-ref round-trip (create → list → cite from a note) with a
  byte-leak assertion (the sensitive payload string never appears anywhere in the workspace).
- **AC:** gate green in root `pnpm test`; docs marked met. **Validation:** root `pnpm test`.
- **Files:** `apps/cli/test/security-gate.test.ts(new)`, docs, `STATUS.md`.
- **Out of Scope:** penetration testing; encryption audits.

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
- **EPIC-CORE-009 Retrieval Sidecar:** **REFINED** (2026-06-10) into ≤3-pt stories — see the Phase 3 table
  above and detailed cards, plus [`phase_3_story_map.md`](phase_3_story_map.md). Python sidecar over stdio
  JSONL, DuckDB FTS+VSS, BGE-M3 (design ported, not copied, from sspaeti — reference only), TS facade +
  CLI, delete-`indexes/`-and-rebuild lossless gate.
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
