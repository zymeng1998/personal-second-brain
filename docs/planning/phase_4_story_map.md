# Phase 4 Story Map — AI Workflows (EPIC-CORE-014)

Refinement of the Phase 4 backlog into ≤3-pt atomic stories, per the split rule. Companion to
[`story_backlog.md`](story_backlog.md) (cards) and [`phase_3_story_map.md`](phase_3_story_map.md)
(prior phase).

**Status (2026-06-10): DECISION REVIEW PASSED — all five open decisions (OQ #21–#25) approved
exactly as leaned** (recorded in [`open_questions.md`](open_questions.md)), including the OQ #21
skills-first/`sidecars/ai`-deferred roadmap deviation. **Implementation authorized to proceed
autonomously in dependency order** (one atomic commit + push per story; blockers recorded instead
of stopping). Story statuses live in [`story_backlog.md`](story_backlog.md).
Story ids skip SB-060/061 (taken by EPIC-CORE-012) and SB-070–072 (taken by EPIC-CORE-013 media
intake); the Phase 4 set is **SB-056..059 + SB-062..066**.

## Objective

Build the **AI workflow layer**: Claude-Code skills for **braindump / extract-facts / review /
compose-output** (distill already shipped in Phase 1H) in which **AI drafts and proposes, the human
confirms, and the CLI is the only writer**. Adds the two missing human-confirmed write paths the
workflows need — a `sb fact` command (L3 facts with provenance) and an L5 output writer + `sb output`
command (`vault/60_Outputs/`, must cite sources) — both reusable by any future surface.

- **Done when (epic gate, roadmap "Phase 4 — Done when"):** AI proposes facts/notes **with
  provenance**; **nothing is mutated without confirmation**. Automated as SB-066: for every workflow,
  propose-without-accept writes nothing anywhere; accepted writes carry provenance (facts:
  `source_ref` + `observed_at` + `confidence`; outputs: non-empty resolvable `sources`); L0/L1
  byte-unchanged throughout.

## Architecture (fixed by ADRs / prior decisions / memory-layer hard rules)

- **Skills are the agent workflow layer, never the backend** (CLAUDE.md stack boundary; proven by
  `skills/distill`): the skill reads via read-only commands (`note list/get`, `sb query`,
  `fact list`), drafts a proposal, shows it for **explicit confirmation**, and only then invokes a
  CLI write command. There is no auto-accept and no direct package/vault access from a skill.
- **All six memory-layer hard rules apply** (`memory_layers.md`): never overwrite/delete L0; never
  auto-delete any note; never mutate a fact without provenance; indexes disposable; events
  append-only; **AI suggests, human confirms**.
- **Events stay TS-emitted** by the CLI write path (event schema v1 already covers what Phase 4
  needs: `fact_added`/`fact_superseded` ship via `@sb/fact-store`; L5 creation emits
  `note_created`). No new event kinds expected.
- **L5 outputs** (`vault/60_Outputs/`, frontmatter `type: output`, layer 5) **must cite sources** —
  the schema already requires `title` + non-empty `sources` (OQ #1, SB-008). The writer mirrors the
  L1/L2 writers: exclusive create, raw-path refusal, schema-valid output.
- **Retrieval-grounded drafting** uses the Phase 3 surface as-is (`sb query` hybrid default;
  `queryMemory` facade with the injectable client for batch use). No retrieval changes in Phase 4.
- **`sidecars/ai` stays boundary-docs only in the required scope** (OQ #21 lean — see below). The
  roadmap names it; this refinement proposes deferring it because the agent itself is the drafting
  engine in every Phase 4 workflow. Flagged explicitly for the decision review.

## Open decisions — confirm before SB-056 goes `Ready` (leans recorded; full table in [`open_questions.md`](open_questions.md))

| # | Question | Lean |
|---|---|---|
| 21 | **AI engine:** Claude-Code skills (agent drafts; CLI validates + writes) vs implementing `sidecars/ai` (local LLM / API) now | **Skills-first.** Every Phase 4 workflow is interactive and human-confirmed — the agent is the engine. `sidecars/ai` stays boundary-docs until a batch/non-interactive need appears (e.g. scheduled extraction). **Deviates from the roadmap's `sidecars/ai` wording — needs explicit approval.** |
| 22 | **Proposal artifact format** for accept steps | One shared, versioned **`schemas/json/proposal.schema.json`** envelope (`workflow`, `version`, `proposed_at`, `items[]`) with per-workflow item payloads; accept commands validate against it (mirrors `distill accept --file`). |
| 23 | **Duplicate facts on re-extraction** | **No auto-dedupe.** The extract-facts skill must surface near-duplicates (via `fact list` + `sb query`) inside the proposal; the human picks add / supersede / skip per item. |
| 24 | **L5 `sources` validation depth** | `sb output create` **resolves note-id sources** (`getNote`; missing note id fails); non-note ULIDs (e.g. fact ids) are accepted as-is. Schema already enforces non-empty. |
| 25 | **Review-skill scope v1** | **Deterministic candidate queries only** (working notes in `00_Inbox` older than N days; raw notes never promoted; tasks with stale `status`), heuristics live in the skill; no new CLI surface. |

## Sub-phases & sequencing (all stories ≤3 pts; 22 pts total)

### 4A — Confirmed write paths (CLI + contracts; no AI)
- **SB-056** (2) — **AI-workflow proposal contracts**: `@sb/interfaces` types + shared
  `schemas/json/proposal.schema.json` (OQ #22); `addFact`/`composeOutput` operation descriptors +
  scopes. Types/schema only, no impl.
- **SB-057** (3) — **`sb fact` CLI**: `fact add` (flags), `fact accept --file <proposal.json>`
  (schema-validated batch), `fact list` (current facts, filters). The human-confirmed write path for
  extracted facts (events already emitted by `@sb/fact-store`).
- **SB-058** (2) — **`writeOutputNote` (L5)** in `@sb/note-vault`: `vault/60_Outputs/`,
  `type: output`/`layer: 5`, required title + non-empty `sources`, exclusive create, raw-refusal,
  Ajv schema-validity test.
- **SB-059** (2) — **`sb output create` CLI**: source resolution per OQ #24, write via the L5
  writer, TS-emitted `note_created` memory event.

### 4B — Workflows (skills: AI drafts → human confirms → CLI writes)
- **SB-062** (3) — **`skills/extract-facts`** + E2E safety check (propose w/o accept ⇒ zero writes;
  duplicates surfaced per OQ #23).
- **SB-063** (3) — **`skills/braindump`**: freeform dump → `sb capture` (L0) → proposed
  segmentation/titles/tags → human-confirmed `sb note promote` per segment. Existing CLI only.
- **SB-064** (3) — **`skills/review`**: deterministic candidates (OQ #25) → proposed
  promote/distill/supersede actions → human-confirmed writes via existing commands.
- **SB-065** (2) — **`skills/compose-output`**: retrieval-grounded (`sb query`) L5 draft with
  citations → human confirm → `sb output create`.

### 4C — Epic gate
- **SB-066** (2) — **Provenance + confirmation gate**: the roadmap "Done when" automated (mirrors
  SB-027/039/054) across all four workflows' write paths.

### Dependency graph (critical path)
```
SB-056 (contracts + proposal schema)
  ├─ SB-057 (sb fact CLI) ──┬─ SB-062 (extract-facts skill)
  │                         └─ SB-064 (review skill)
  ├─ SB-058 (L5 writer) ─ SB-059 (sb output CLI) ─ SB-065 (compose-output skill)
  └─ SB-063 (braindump skill — existing CLI + proposal envelope)
SB-062 + SB-063 + SB-064 + SB-065 ─ SB-066 (provenance/confirmation gate)
```
Recommended order: **SB-056 → SB-057 → SB-058 → SB-059 → SB-062 → SB-063 → SB-064 → SB-065 → SB-066.**
Stop for human review at each `In Review` and at the 4A/4B/4C sub-phase boundaries.

## Out of scope (Phase 4)

- **`sidecars/ai` implementation** (unless OQ #21 flips — that would be a new refinement, not silent
  scope growth). The boundary README stays authoritative.
- RAG **answer generation** as a service; Phase 4 grounds drafts via `sb query` references inside
  the interactive skill only.
- Auto-accept of any proposal; scheduled/background AI jobs; batch pipelines.
- New event kinds, retrieval changes, or schema changes (frontmatter/event v1 already suffice).
- Surfaces/dashboard (Phase 5); MCP adapter; domain apps; broker (deferred).
