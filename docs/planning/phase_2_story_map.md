# Phase 2 Story Map — Structured Projections (EPIC-CORE-008)

Refinement of the Phase 2 backlog (the `5→split` stories SB-020/021/023 decomposed into ≤3-pt atomic
stories, per the split rule). Companion to [`story_backlog.md`](story_backlog.md) (cards) and
[`phase_1_story_map.md`](phase_1_story_map.md) (prior phase). **Status: refined, `Backlog` — not yet
`Ready`.** Promote to `Ready` only after the open decisions below are confirmed at the refinement review.

## Objective

Build the **L3 structured projections** — `fact-store`, `entity-graph`, `task-store` — as **rebuildable
SQLite** state under `db/memory.sqlite`, derived from the append-only event log (+ L0–L2). Facts are
**ADD-only** (mem0-style): never mutated; corrections are new facts that supersede old ones. The event log
stays the single source of truth; `db/` is disposable.

- **Done when (epic gate):** dropping `db/` and replaying the event log (+ re-deriving from L0–L2)
  reproduces byte/row-identical projections. (Roadmap "Phase 2 — Done when".)

## Architecture (fixed by ADRs / resolved leans)

- **Event-sourced.** Facts/entities/tasks are written as **memory events** (`fact_added`,
  `fact_superseded`, `entity_merged`, `note_created/updated`) — already in event schema v1 (SB-009). The
  SQLite projection is a **fold over those events**; the same projector runs live (on write) and on replay.
- **ADD-only facts** (ADR-004, OQ #6): every fact carries
  `{ id, statement, source_ref, captured_at, observed_at, confidence(0–1), supersedes? }`. Never updated in
  place; `supersedeFact` appends a new fact referencing the old via `supersedes`.
- **Manual-confirm entity merges** (OQ #7): never auto-merge; a merge is an explicit `entity_merged` event.
- **Replay determinism** (OQ #8): the projector is a **pure function** of (events + L0–L2); replay yields
  identical projections.
- **Domain-neutral**, no broker concepts; `db/` is L3 (rebuildable), distinct from L4 indexes (Phase 3,
  DuckDB) and from the event log (source of truth).

## Open decisions

1. **SQLite driver — RESOLVED (2026-06-05): `node:sqlite`** (built-in, zero runtime dependency; matches the
   project's dependency-light style). Experimental in Node 22 (emits a warning); acceptable. No
   `pnpm-lock.yaml` change. Implemented in SB-034.
2. **ULID centralization — RESOLVED (2026-06-05): centralize now.** Add a shared ULID utility (in
   `@sb/interfaces` or a small core module) used by cli/event-log/memory-kernel; retire the duplicated
   `apps/cli/src/ulid.ts`. Done as part of SB-034 (its own sub-step/commit-safe slice).
3. **Fact creation surface — CONFIRMED (default):** Phase 2 = the **projection + replay machinery** + a
   programmatic `addFact`/`supersedeFact` (append event → project). **AI/LLM fact extraction is OUT** (the
   `@sb/ai` package, later).
4. **task-store source — STILL OPEN** (affects SB-022 only, not the critical path to SB-034). Lean: derive
   from note frontmatter (`status`) + `note_created/updated` events; no new event kind. Confirm before
   SB-022 → `Ready`.

## Sub-phases & sequencing (all stories ≤3 pts)

### 2A — Contracts & store foundation
- **SB-020** — Fact + projection **contracts** in `@sb/interfaces` (types + operation descriptors only; no
  impl). *(was "fact-store schema + ADD-only writes" 5→split; this is the contract anchor slice)*
- **SB-034** — Projection **store bootstrap**: `@sb/memory-kernel` opens/creates `db/memory.sqlite` +
  schema migration; `db/` treated as disposable/rebuildable. (driver = open decision #1)

### 2B — fact-store
- **SB-035** — fact-store table + **`addFact`** (append `fact_added` event → ADD-only insert; provenance +
  confidence required; never update/delete).
- **SB-036** — **`supersedeFact`** + current-facts **query** (append `fact_superseded`; reads exclude
  superseded; never mutates prior rows).

### 2C — entity-graph *(was SB-021 5→split)*
- **SB-021** — entity-graph **nodes** projection (from `50_Entities/` notes + `entities` refs). *(anchor)*
- **SB-037** — entity-graph **edges** + manual-confirm **`entity_merged`** (never auto-merge).

### 2D — task-store
- **SB-022** — **task-store** projection (3 pts; source = open decision #4). *(already atomic; refine AC)*

### 2E — replay *(was SB-023 5→split)*
- **SB-023** — replay **projector core**: pure `apply(event, state) → state'` fold; deterministic. *(anchor;
  also the shared live-write projector)*
- **SB-038** — replay **rebuild command**: drop `db/`, replay events → rebuild SQLite; emit
  `projection_rebuilt` / `projection_reset` projection events; CLI/script.
- **SB-039** — replay **reproducibility gate**: drop + replay → byte/row-identical projections; automated
  test wired into `pnpm test` (the epic "Done when" gate).

### Dependency graph (critical path)
```
SB-020 (contracts)
  └─ SB-034 (store bootstrap)
       ├─ SB-023 (projector core) ──┬─ SB-035 (addFact) ─ SB-036 (supersede/query)
       │                            ├─ SB-021 (entity nodes) ─ SB-037 (edges/merge)
       │                            └─ SB-022 (task-store)
       └─ SB-038 (rebuild cmd) ─ SB-039 (reproducibility gate)
```
Recommended order: **SB-020 → SB-034 → SB-023 → SB-035 → SB-036 → SB-021 → SB-037 → SB-022 → SB-038 → SB-039.**
Stop for human review at each `In Review` and at the 2A/2B/2C/2D/2E sub-phase boundaries.

## Out of scope (Phase 2)
- L4 retrieval indexes / embeddings / DuckDB (Phase 3, EPIC-CORE-009).
- AI/LLM fact & entity **extraction** (the `@sb/ai` package, later).
- Surfaces/dashboard (Phase 5); domain apps (Phase 4–6).
