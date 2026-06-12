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

**All eight RESOLVED (2026-06-10): human approved every decision exactly as leaned** at the Phase 3
refinement review. Recorded here; full context in [`phase_3_story_map.md`](phase_3_story_map.md).

| # | Question | Decision (2026-06-10) |
|---|---|---|
| 9 | Embedding model | **RESOLVED — fallback adopted (SB-049, 2026-06-10):** `bge-small-en-v1.5` (384-d). BGE-M3 is **unloadable** on this machine, not merely slow: its HF repo ships only `pytorch_model.bin`, transformers requires torch ≥2.6 for `.bin` loads (CVE-2025-32434), and torch on macOS x86_64 caps at 2.2.2. Fallback benchmark (i9-9880H CPU, `benchmarks/bench_embed.py`): 5.93 chunks/s indexing, 14 ms median query embed. Override via `SB_EMBED_MODEL`; known limitation: English-only (revisit on torch ≥2.6-capable hardware or via ONNX). |
| 10 | Index store | **RESOLVED:** DuckDB for both FTS and vector (VSS/HNSW) — one engine, one disposable file. |
| 11 | stdio JSONL vs local HTTP | **RESOLVED:** stdio JSONL; local HTTP only if warm-model latency later forces it. |
| 12 | Embed mem0/ReMe as a Python dep, or reference only? | **RESOLVED:** reference only — no dependency. |
| 17 | Python toolchain (machine had only system Python 3.9.6) | **RESOLVED:** **uv** with a pinned Python ≥3.11 in `sidecars/retrieval/` (`pyproject.toml` + `uv.lock`; uv installs the interpreter — no system-Python dependency). |
| 18 | Test policy for Python-dependent tests | **RESOLVED:** root `pnpm test` stays Node-only deterministic; sidecar = `pytest`; TS↔Python integration behind an env-gated `test:sidecar` target (visible SKIP when env absent). |
| 19 | Index artifact layout | **RESOLVED:** single `indexes/retrieval.duckdb` (FTS + vector + later graph/temporal tables, one disposable file); existing `indexes/*` subdirs reserved for aux artifacts; model cache outside the workspace. |
| 20 | Chunking | **RESOLVED:** ~512-token heading-aware chunks; chunk id `<note ULID>#<seq>`; every chunk carries `source_ref` = note id. |

## Decide before Phase 4 implementation (AI workflows)

Raised at the 2026-06-10 Phase 4 refinement ([`phase_4_story_map.md`](phase_4_story_map.md)).
**ALL FIVE RESOLVED (2026-06-10): human approved every decision exactly as leaned** ("all five
positions are approved"), including the OQ #21 roadmap deviation (skills-first; `sidecars/ai`
stays boundary-docs until a batch/non-interactive need appears).

| # | Question | Decision (2026-06-10, approved as leaned) |
|---|---|---|
| 21 | **AI engine:** Claude-Code skills (agent drafts; CLI validates + writes) vs implementing `sidecars/ai` (local LLM / API) now | **Skills-first**; `sidecars/ai` stays boundary-docs until a batch/non-interactive workflow needs it. **Deviates from the roadmap's `sidecars/ai` wording — needs explicit approval.** |
| 22 | Proposal artifact format for accept steps | Shared versioned `schemas/json/proposal.schema.json` envelope (`workflow`/`version`/`proposed_at`/`items[]`) with per-workflow item payloads; accept commands validate against it (mirrors `distill accept --file`). |
| 23 | Duplicate facts on re-extraction | No auto-dedupe; the extract-facts skill surfaces near-duplicates (`sb fact list` + `sb query`) in the proposal; human picks add / supersede / skip per item. |
| 24 | L5 `sources` validation depth | `sb output create` resolves note-id sources via `getNote` (missing ⇒ fail, nothing written); non-note ULIDs (fact ids) accepted as-is; schema already enforces non-empty. |
| 25 | Review-skill scope v1 | Deterministic candidate queries only (inbox working notes older than N days; never-promoted raws; stale-`status` tasks); heuristics live in the skill; no new CLI surface. |

## Decide before EPIC-CORE-011 implementation (security hardening)

Raised at the 2026-06-10 security refinement ([`security_story_map.md`](security_story_map.md)).
**ALL THREE RESOLVED (2026-06-10): human approved exactly as leaned**, with explicit guardrails:
secure_ref is a reference primitive, never a secret container; raw secrets appear nowhere
(notes/events/tests/fixtures/logs/errors); the CLI goes through the SAME grant resolver as every
other caller; **no env/test/dev bypass of enforcement is allowed**; audit evidence must not leak
secret values.

| # | Question | Decision (2026-06-10, approved as leaned) |
|---|---|---|
| 26 | Grant declaration/loading | **RESOLVED:** static in-code registry for first-party callers this phase; workspace `config/grants.json` reserved for domain apps (EPIC-CORE-012), not built yet. |
| 27 | Enforcement default | **RESOLVED:** enforce for ALL callers at the operations boundary; `cli` may hold every scope except `ALWAYS_DENIED_SCOPES` but goes through the same resolver; **no env bypass**. (Refines OQ #13.) |
| 28 | secure_ref validation home | **RESOLVED:** `schemas/markdown/secure_ref.schema.json`; validated by `validate_notes.ts` as a separate pass (secure_refs lives outside `vault/`); pointer files must have no body. |

## Decide before EPIC-CORE-012 implementation (domain app boundary)

Filed 2026-06-11 during the EPIC-CORE-012 refinement (SB-060/075/076/061/077 — see
[`domain_boundary_story_map.md`](domain_boundary_story_map.md)).
**ALL THREE RESOLVED (2026-06-11): human approved exactly as leaned**, with one additional
guardrail: **duplicate `domain-app:*` entries in `config/grants.json` fail closed** (whole-file
rejection — never merge, never last-write-wins). Epic-wide guardrails fixed by the authorization:
external grants default-deny; `ALWAYS_DENIED_SCOPES` ungrantable even through config; config never
overrides/shadows/mutates the first-party registry; fail closed on unknown caller / unknown scope /
malformed config / duplicate app entry / reserved caller identity / privileged-scope attempts;
read-only generic example app; same resolver/enforcer path for all CLI ops; one atomic commit per
story; SB-074 re-run inside SB-077.

| # | Question | Decision (2026-06-11, approved as leaned) |
|---|---|---|
| 29 | Grant config validation mechanism | **RESOLVED:** `grant_config.schema.json` is the published contract; runtime validation is a strict dependency-free TS validator in `@sb/interfaces` (zero runtime deps preserved). Ajv stays test-only: a lock-step test proves schema/runtime verdict parity on shared fixtures. |
| 30 | Domain-app invocation boundary | **RESOLVED:** domain apps invoke core operations only through the existing enforced CLI dispatch — programmatic `main(argv, io, caller)` with a fixed `domain-app:<name>` identity; config consulted only for non-first-party callers; **no second enforcing facade**. Cooperative-enforcement honesty note documented. (Refines OQ #13/#14.) |
| 31 | Config rejection semantics + caller namespace | **RESOLVED:** fail-closed **whole-file rejection** as `grant_config_invalid` for ANY invalid content (unknown scope, privileged scope, reserved app id, schema violation, **duplicate app entry**); missing file = valid empty config (default-deny); only `^domain-app:[a-z0-9][a-z0-9-]*$` apps representable. |

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
