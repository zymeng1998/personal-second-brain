# Open Questions

To resolve before / during the noted phase. Tracked here so they don't block scaffolding.

## Must decide before Phase 1

| # | Question | Options / lean |
|---|---|---|
| 1 | Frontmatter schema v1 fields per note type (raw/working/distilled/entity/project/concept/case/daily) | **RESOLVED (SB-008):** `frontmatter.schema.json` v1. Common required `id,type,layer,created`; each type pins its layer + required fields (raw=L0 no `updated`; working=L1 needs `source_ref`; distilled/entity/concept/case=L2 need `title`; project=L1/L2; daily=L1; output=L5 needs `title`+non-empty `sources`). Validated by 9 example notes under `examples/notes/`. |
| 2 | Event schema v1 fields (`capture`/`memory`/`projection`) | **RESOLVED (SB-009):** `event.schema.json` v1. Common envelope required `event_id(ULID),stream,kind,occurred_at,actor`; optional `recorded_at,subject_id,source_ref,schema_version,payload`. `actor` pattern `human\|cli\|skill:<name>\|sidecar:<name>`. Per-stream kinds via allOf: capture→`captured` (subject_id req); memory→`note_created/note_updated/fact_added/fact_superseded/entity_merged/distillation_accepted` (subject_id req); projection→`indexed/projection_rebuilt/projection_reset`. APPEND-ONLY documented in schema; corrections are new events. Validated by `examples/captures/events.sample.jsonl`. |
| 3 | Note id scheme | **RESOLVED (SB-008):** **ULID** is the canonical immutable `id` for all notes (and events/captures/facts/entities/tasks/outputs). Pattern `^[0-7][0-9A-HJKMNP-TV-Z]{25}$`. Filename convention `<ULID>--<optional-slug>.md`; slugs may change, the `id` never does. ULID is not the retrieval mechanism — retrieval uses metadata/title/tags/links/entities + FTS/vector/graph/temporal indexes. |
| 4 | Workspace creation | **RESOLVED (SB-001..007):** `scripts/init_workspace.ts` creates the tree (27 dirs + 5 files) idempotently and non-destructively at `$SECOND_BRAIN_WORKSPACE` (or `--workspace`), with `--dry-run` + read-only `--verify`. **No template seeding** in Phase 1 (raw notes are written by `capture`; templates can be a later story). |
| 5 | Repo visibility | Private recommended (data sensitivity), even though core code is non-sensitive |

## Decide during Phase 2 (projections)

| # | Question | Lean |
|---|---|---|
| 6 | Fact model detail (confidence scale, supersede semantics) | mem0-style ADD-only; numeric confidence 0–1 |
| 7 | Entity identity/merge rules | Manual-confirm merges; never auto-merge |
| 8 | Replay determinism guarantees | Pure function of L0–L2 + events |

## Decide during Phase 3 (retrieval)

| # | Question | Lean |
|---|---|---|
| 9 | Embedding model | BGE-M3 (sspaeti); confirm CPU-only performance on this Mac |
| 10 | Index store | DuckDB + VSS; SQLite FTS5 vs DuckDB FTS |
| 11 | stdio JSONL vs local HTTP | Start stdio; add HTTP only if warm-model latency demands it |
| 12 | Embed mem0/ReMe as a Python dep, or reference only? | Reference first; embed if it clearly saves work (Apache-2.0 OK) |
| 17 | Python toolchain (machine has only system Python 3.9.6, no uv) | **uv** with a pinned Python ≥3.11 in `sidecars/retrieval/` (`pyproject.toml` + `uv.lock`; uv installs the interpreter — no system-Python dependency) |
| 18 | Test policy for Python-dependent tests | Root `pnpm test` stays Node-only deterministic; sidecar = `pytest`; TS↔Python integration behind an env-gated `test:sidecar` target (visible SKIP when env absent) |
| 19 | Index artifact layout | Single `indexes/retrieval.duckdb` (FTS + vector + later graph/temporal tables, one disposable file); existing `indexes/*` subdirs reserved for aux artifacts; model cache outside the workspace |
| 20 | Chunking | ~512-token heading-aware chunks; chunk id `<note ULID>#<seq>`; every chunk carries `source_ref` = note id |

(#9–12, #17–20 are listed with full context in [`phase_3_story_map.md`](phase_3_story_map.md); confirm at
the Phase 3 refinement review before SB-047 → `Ready`.)

## Decide later

| # | Question | Lean |
|---|---|---|
| 13 | Permission-scope enforcement mechanism | Capability tokens checked at the `interfaces` boundary |
| 14 | Interface smoke test before broker | Generic `domain-apps/example-readonly/`, never broker |
| 15 | MCP adapter timing | Only after `interfaces` stabilizes; never in Phase 0/1 |
| 16 | Sync mechanism | Git for text; iCloud/Syncthing optional; user choice |

## Tech debt (tracked)

- ~~**ULID generation is currently duplicated.**~~ **RESOLVED (SB-034, 2026-06-05):** centralized in
  `@sb/interfaces` (`ulid()` in `src/ulid.ts`, exported from the package index); `apps/cli/src/ulid.ts`
  removed and its consumers now import `ulid` from `@sb/interfaces`. Output is byte-identical (same standard
  ULID encoding); `isUlid()` still accepts every produced value.

## Answered (recorded in ADRs)

- Build vs fork → **combine** (ADR-007 + evaluation).
- Stack → **hybrid contracts-first** (ADR-007).
- Obsidian → **optional surface** (ADR-003).
- Domain independence → **enforced** (ADR-001, ADR-006).
- Local-first/open-format → **yes** (ADR-002).
- Layered memory → **yes** (ADR-004).
- Retrieval-aware organization → **yes** (ADR-005).
