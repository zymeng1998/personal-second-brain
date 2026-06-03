# Open Questions

To resolve before / during the noted phase. Tracked here so they don't block scaffolding.

## Must decide before Phase 1

| # | Question | Options / lean |
|---|---|---|
| 1 | Frontmatter schema v1 fields per note type (raw/working/distilled/entity/project/concept/case/daily) | Draft in `schemas/markdown/`; finalize with first real notes |
| 2 | Event schema v1 fields (`capture`/`memory`/`projection`) | Common envelope + per-type payload; ids + timestamps + actor + source_ref |
| 3 | Note id scheme | ULID/timestamp-slug; must be stable + sortable + filename-safe |
| 4 | Workspace creation | `init_workspace.ts` creates the tree; confirm exact path + whether to seed templates |
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

## Decide later

| # | Question | Lean |
|---|---|---|
| 13 | Permission-scope enforcement mechanism | Capability tokens checked at the `interfaces` boundary |
| 14 | Interface smoke test before broker | Generic `domain-apps/example-readonly/`, never broker |
| 15 | MCP adapter timing | Only after `interfaces` stabilizes; never in Phase 0/1 |
| 16 | Sync mechanism | Git for text; iCloud/Syncthing optional; user choice |

## Answered (recorded in ADRs)

- Build vs fork → **combine** (ADR-007 + evaluation).
- Stack → **hybrid contracts-first** (ADR-007).
- Obsidian → **optional surface** (ADR-003).
- Domain independence → **enforced** (ADR-001, ADR-006).
- Local-first/open-format → **yes** (ADR-002).
- Layered memory → **yes** (ADR-004).
- Retrieval-aware organization → **yes** (ADR-005).
