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

**Phase 1 (MVP core), Phase 1H (distillation), and Phase 2 (projections) are COMPLETE** — see
[`STATUS.md`](STATUS.md) for the latest. Shipped: workspace init/verify, capture (L0 raw + capture event),
read-only `note list`/`get`, frontmatter validation, raw-immutability guard (test-locked), the
human-confirmed `distill` workflow (L1→L2 + memory event + skill), and the **L3 projections** —
`@sb/fact-store` (ADD-only + supersede), `@sb/entity-graph` (nodes + edges + manual `entity_merged`),
`@sb/task-store`, all in rebuildable SQLite (`@sb/memory-kernel`, `node:sqlite`) via the `sb rebuild`
command, with a drop-`db/`-and-replay reproducibility gate. The Phase 2 review quality band
(SB-042..046: engines pin, atomic rebuild, shared frontmatter, schema-v2 consistency, single-pass reads)
is also `Done`.

**Phase 3 (EPIC-CORE-009, Retrieval Sidecar) required scope is COMPLETE (2026-06-10)** — Python
sidecar (`sidecars/retrieval`, uv + Python 3.11, stdio JSONL), DuckDB FTS+VSS in one disposable
`indexes/retrieval.duckdb`, bge-small-en-v1.5 embeddings (OQ #9 fallback; BGE-M3 unloadable on this
Intel Mac — see `docs/planning/open_questions.md`), `@sb/retrieval` transport + `queryMemory` facade,
and hybrid-default `sb index` / `sb query` with TS-emitted `indexed` events. The SB-054
delete-`indexes/`-rebuild lossless gate is green. **Root suite 159 tests (Node-only); sidecar pytest
33; env-gated `pnpm run test:sidecar` for the real-sidecar E2E + gate.**

**The SB-055 graph/temporal stretch is also `Done`** (graph_edges from entity refs + wikilinks,
temporal from frontmatter dates + event timestamps, composable query `filters:{near,from,to}`) —
**all 9 Phase 3 stories complete; root suite 160 tests, sidecar pytest 42.**

**The P2 review follow-ups are also cleared (2026-06-10):** SB-028 (multi-source provenance via
`links`), SB-029 (`sb note promote` → L1 working notes in `00_Inbox`, giving `distill propose`
real candidates), SB-033 (`test:coverage` via c8 — baseline 90% lines — + `init_workspace`
subprocess tests). **Root suite 180 tests.**

**Phase 4 (EPIC-CORE-014, AI Workflows) is COMPLETE (2026-06-10)** — skills-first engine
(OQ #21–#25 approved; `sidecars/ai` deferred, boundary-docs only): `proposal.schema.json` shared
envelope + `@sb/interfaces` proposal contracts, the **`sb fact`** (add/accept-file/list) and
**`sb output create`** (L5, resolvable non-empty `sources` + `note_created` event) confirmed write
paths, and four skills — `extract-facts`, `braindump`, `review`, `compose-output` — each with an
E2E safety test. The **SB-066 gate** (propose-without-accept writes nothing; accepted writes carry
provenance; L0/L1 byte-unchanged; events schema-valid) is green. **Root suite 204 tests.**

**EPIC-CORE-011 (Security & Privacy Hardening) is COMPLETE (2026-06-10)** — OQ #26–#28 approved:
the **secure_refs pointer primitive** (`secure_ref.schema.json`, `writeSecureRef`/`listSecureRefs`,
`sb secref add/list`, a separate `validate_notes` pass — reference primitive only, never a secret
container; locators never echoed) and the **permission model made real**: `grantAllows` (pure,
environment-blind), the first-party grants registry (`cli` = all operational scopes minus
`ALWAYS_DENIED_SCOPES` through the SAME resolver; `sidecar:retrieval` index-only; skills hold
nothing), and **enforcement at the CLI operations boundary with no env bypass**. The SB-074 gate
is green. **Root suite 229 tests; coverage 92.08% lines.**

**EPIC-CORE-012 (Domain App Boundary) is COMPLETE (2026-06-11)** — OQ #29–#31 approved (+ the
duplicate-entry fail-closed guardrail): the **`config/grants.json` contract**
(`grant_config.schema.json` — strict, versioned, `domain-app:*` namespace only, privileged scopes
structurally absent), the **fail-closed dependency-free loader** (`parseGrantConfig`/
`loadGrantConfig`, whole-file `grant_config_invalid` rejection incl. duplicate apps, deep-frozen
results, Ajv test-only lock-step parity), **config-aware resolution with absolute first-party
precedence** (`resolveGrant`; registry config-blind and frozen; dispatch loads config only for
`domain-app:*` callers), and the **generic read-only `domain-apps/example-readonly/` binding
template** (programmatic `main(argv, io, caller)` — OQ #30; reads succeed, all write forms
`scope_denied` with a byte-identical workspace; ADR-001 grep in-test). The SB-077 gate is green.
**Root suite 262 tests; coverage 92.58% lines.**

**Phase 5 (EPIC-CORE-010, Surfaces) is COMPLETE (2026-06-11)** — OQ #32–#35 approved (+ the
X-SB-CSRF amendment): **surface caller grants** (`surface:obsidian-helper` =
write:capture+read:notes; `surface:dashboard` = reads + capture + the SB-083 distill/fact
accepts), the **Obsidian companion CLI** (`apps/obsidian-helper`: read-only `check`, body-only
domain-neutral `templates install` [never overwrites; templates excluded from note enumeration +
validation], `capture --file` draft bridge — one L0 + one event, draft byte-untouched, Obsidian
never the writer of record), and the **localhost dashboard** (`apps/dashboard`: zero-dep
`node:http` on 127.0.0.1 only, strict headers everywhere, no-build static UI, capture +
confirmation-gated review queue behind the per-start **X-SB-CSRF** same-origin write guard —
cross-site/missing-token POSTs fail with zero writes; secure_refs unsurfaced). The SB-084 gate
(both surfaces capture+read via contracts only; denial sweeps byte-identical; locator sentinel
never leaks; SB-074/077 re-asserted) is green. **Root suite 290 tests; coverage 92.98% lines.**

**Next:** EPIC-CORE-013 (media transcription intake, P2 — needs refinement) or EPIC-DOMAIN-001
(broker, P3 — stays Deferred). Always follow the backlog workflow above: confirm the story is
`Ready`, implement in-scope only, validate, stop at `In Review`.
