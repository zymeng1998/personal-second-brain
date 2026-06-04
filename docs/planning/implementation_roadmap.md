# Implementation Roadmap

Phased plan. Each phase has a verifiable end state. Domain (broker) work is last and built only on
`interfaces`.

## Phase 0 — Scaffold & contracts ✅

Docs, repo tree, READMEs, schema skeletons, `.gitignore`/`.env.example`/`AGENTS.md`/`CLAUDE.md`, stub
scripts. **No application logic. Sidecars: boundary docs only. Broker: docs-only.**
- **Done when:** structure + docs exist and pass human review.

## Phase 1 — MVP core ✅ (distillation deferred)

CLI capture → L0 raw + append-only event log; `note-vault` read/write with **raw-immutability guard**;
typed YAML frontmatter validation; `interfaces` v0 (capture/getNote/listNotes/appendEvent);
`init_workspace` + `validate_notes` implemented; one minimal human-confirmed distillation skill.
- **Status:** **Complete (SB-001..018)** except the distillation skill (SB-019), which is **deferred**
  to Phase 1H / Phase 2 pending a scope decision — see [`phase_1_story_map.md`](phase_1_story_map.md)
  Phase 1H. Everything else shipped with atomic commits and green validation.
- **Done when:** capture is loss-free, raw is provably immutable, all notes validate, and a second
  tool can read vault+events via documented contracts. No domain concepts in core. — **met** for the
  capture+validate+read core (distillation excluded).
- **Decided:** frontmatter schema v1 (SB-008), event schema v1 (SB-009), ULID id scheme (open questions
  #1–#3 resolved).

## Phase 2 — Projections

`fact-store` + `entity-graph` + `task-store` (SQLite) with provenance/confidence/temporal; ADD-only
facts; `memory-kernel` coordination; full **replay** from the event log.
- **Done when:** dropping `db/` and replaying events + re-extracting reproduces projections.

## Phase 3 — Retrieval sidecar (Python)

`sidecars/retrieval` (DuckDB VSS + BGE-M3 + graph + FTS), TS `packages/retrieval` facade over **stdio
JSON/JSONL**; rebuildable indexes; optional local HTTP if a warm process is needed.
- **Done when:** `index_vault` + `query_memory` work; deleting `indexes/` and rebuilding is lossless.

## Phase 4 — AI workflows

`sidecars/ai` extraction/distillation suggestions (human-confirmed); Claude-Code skills for
braindump/distill/review; L5 outputs citing sources.
- **Done when:** AI proposes facts/notes with provenance; nothing is mutated without confirmation.

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
