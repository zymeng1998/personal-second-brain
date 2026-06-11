# Implementation Roadmap

Phased plan. Each phase has a verifiable end state. Domain (broker) work is last and built only on
`interfaces`.

## Phase 0 — Scaffold & contracts ✅

Docs, repo tree, READMEs, schema skeletons, `.gitignore`/`.env.example`/`AGENTS.md`/`CLAUDE.md`, stub
scripts. **No application logic. Sidecars: boundary docs only. Broker: docs-only.**
- **Done when:** structure + docs exist and pass human review.

## Phase 1 — MVP core ✅

CLI capture → L0 raw + append-only event log; `note-vault` read/write with **raw-immutability guard**;
typed YAML frontmatter validation; `interfaces` v0 (capture/getNote/listNotes/appendEvent);
`init_workspace` + `validate_notes` implemented.
- **Status:** **Complete (SB-001..018).** Shipped with atomic commits and green validation.
- **Done when:** capture is loss-free, raw is provably immutable, all notes validate, and a second
  tool can read vault+events via documented contracts. No domain concepts in core. — **met**.
- **Decided:** frontmatter schema v1 (SB-008), event schema v1 (SB-009), ULID id scheme (open questions
  #1–#3 resolved).

## Phase 1H — Human-confirmed distillation ✅

The minimal human-confirmed L1→L2 distillation workflow (originally carved out of the MVP).
- **Status:** **Complete (SB-019/024/025/026/027).** Distillation proposal contract → `writeDistilledNote`
  (L2, never under `00_Raw/`) → `appendMemoryEvent('distillation_accepted')` → CLI `distill propose`/`accept`
  → `skills/distill/` + an end-to-end L0/L1-never-mutated safety check. Closes MVP acceptance criterion #5.

## Phase 2 — Projections ✅

`fact-store` + `entity-graph` + `task-store` (SQLite via `node:sqlite`) with provenance/confidence/temporal;
ADD-only facts; `memory-kernel` projector + store; full **replay** from the event log via `sb rebuild`.
- **Status:** **Complete (SB-020/034/023/035/036/021/037/022/038/039).** Facts (ADD-only + supersede +
  query), entity nodes + edges + manual `entity_merged`, tasks (from note `status`); the pure projector is
  shared by live writes and replay.
- **Done when:** dropping `db/` and replaying events + re-deriving from L0–L2 reproduces projections —
  **met** (SB-039 row-identical reproducibility gate, wired into `pnpm test`).

## Phase 3 — Retrieval sidecar (Python)

`sidecars/retrieval` (DuckDB VSS + FTS + bge-small embeddings — OQ #9 fallback; BGE-M3 unloadable on
this machine), TS `packages/retrieval` facade over **stdio JSONL**; rebuildable indexes.
- **Done when:** `index_vault` + `query_memory` work; deleting `indexes/` and rebuilding is lossless —
  **met 2026-06-10** (SB-054 gate: delete-`indexes/`-rebuild → identical ranked results across
  lexical/vector/hybrid, L0 + capture/memory streams byte-unchanged; wired into `test:sidecar`).
  Graph/temporal indexes remain the optional P2 stretch (SB-055).

## Phase 4 — AI workflows

`sidecars/ai` extraction/distillation suggestions (human-confirmed); Claude-Code skills for
braindump/distill/review; L5 outputs citing sources.
- **Status:** ✅ **COMPLETE 2026-06-10** — EPIC-CORE-014, all 9 stories `Done` (SB-056..059 +
  SB-062..066; distill itself shipped in Phase 1H). OQ #21–#25 approved as leaned: **skills-first**
  engine with `sidecars/ai` deferred (approved deviation from the line above — the boundary README
  stays authoritative until a batch/non-interactive need appears). See
  [`phase_4_story_map.md`](phase_4_story_map.md).
- **Done when:** AI proposes facts/notes with provenance; nothing is mutated without confirmation.
  (Automated as SB-066 — **met**, green in root `pnpm test`.)

## Phase 5 — Surfaces

`obsidian-helper`, then `dashboard`; later mobile capture / browser clipper. All via `interfaces`.
- **Done when:** at least one extra surface performs capture+read via contracts only.

## Phase 6 — First domain app (broker)

Built entirely on `interfaces` under scoped permissions; validates domain independence. (Any earlier
interface smoke test uses a generic `domain-apps/example-readonly/`, never broker.)
- **Done when:** broker reads/writes the core only through scoped contracts; core has zero broker code.

## Cross-cutting (every phase)

Privacy rules, license safety, human-in-the-loop, append-only events, STATUS.md discipline, commit at
phase boundaries.
