# Phase 3 Story Map — Retrieval Sidecar (EPIC-CORE-009)

Refinement of the Phase 3 backlog (the `5→split` stories SB-030/031/032 decomposed into ≤3-pt atomic
stories, per the split rule). Companion to [`story_backlog.md`](story_backlog.md) (cards) and
[`phase_2_story_map.md`](phase_2_story_map.md) (prior phase).

**Status (2026-06-10): EPIC GATE MET — Phase 3 required scope COMPLETE.** All eight open decisions
(OQ #9–12, #17–20) were approved exactly as leaned (recorded in
[`open_questions.md`](open_questions.md)) and all eight required stories
(SB-047/030/048/031/053/032/049/054) are `Done` — implemented, tested, and pushed the same day. The
SB-054 disposability gate (delete `indexes/` → lossless rebuild) is green. **OQ #9 note:** BGE-M3
proved unloadable on this machine (torch ≤2.2.2 on macOS x86_64 vs the CVE-2025-32434 torch ≥2.6
requirement for `.bin` weights) — the pre-approved fallback `bge-small-en-v1.5` (384-d) is the
default. **The SB-055 graph/temporal stretch is also `Done`** (human-approved after the gate):
`graph_edges` (entity refs + title-resolved wikilinks) + `temporal` (frontmatter dates + event
timestamps) tables and composable query `filters:{near,from,to}`. **All 9 Phase 3 stories
complete.** Story statuses live in [`story_backlog.md`](story_backlog.md).

## Objective

Build the **L4 retrieval layer**: a **Python sidecar** (`sidecars/retrieval`) that reads the vault and
builds **disposable indexes** under `<workspace>/indexes/` (full-text + vector, then graph/temporal), and
a **TypeScript facade** (`@sb/retrieval`) + CLI that drive it over **stdio JSONL**. The sidecar never owns
or mutates the vault, never writes L0, and never touches the event log — all events stay TS-emitted.

- **Done when (epic gate, roadmap "Phase 3 — Done when"):** `index_vault` + `query_memory` work
  end-to-end, and **deleting `indexes/` and rebuilding is lossless** (same queries → same results).
  Automated as SB-054.

## Architecture (fixed by ADRs / prior decisions)

- **Division of labor** ([`sidecar_contract.md`](../architecture/sidecar_contract.md)): TS owns contracts,
  CLI, orchestration, and the event log; Python owns embeddings/indexing/query. The sidecar **reads &
  indexes** the vault read-only; output goes **only** to `indexes/` (L4 — disposable).
- **Transport:** stdio **JSONL** — one JSON object per line; request `{op, req_id, args}`, response
  `{req_id, ok, data | error{code, message}}`; deterministic `req_id` correlation; errors structured,
  never thrown across the boundary. (Local HTTP only if warm-model latency demands it — OQ #11.)
- **Index types** ([`retrieval_strategy.md`](../architecture/retrieval_strategy.md)): full-text + vector
  (BGE-M3 1024-d, HNSW) are the Phase 3 core; graph (wikilinks/entities) + temporal are a stretch story
  (SB-055, P2 — not required for the epic gate). Hybrid ranking vector+keyword ~70/30, tunable.
- **Events stay TS-owned:** after a successful build the TS CLI appends the existing `indexed` projection
  event (event schema v1 already has the kind). The sidecar never writes JSONL events.
- **Retrieval-aware inputs already enforced:** stable ULID ids, typed frontmatter, wikilinks,
  event timestamps, heading-chunkable bodies.
- **Design ported, not copied,** from sspaeti/obsidian-note-taking-assistant (license unspecified —
  reference only). mem0/ReMe: reference first (OQ #12).

## Open decisions — ALL CONFIRMED 2026-06-10 (approved as leaned; see `open_questions.md`)

| # | Decision | Approved resolution |
|---|---|---|
| 9 | Embedding model | **BGE-M3 (1024-d)**; verify CPU-only build+query speed on this Mac during SB-049 — fallback `bge-small-en-v1.5` (384-d) behind the same op if M3 is too slow. |
| 10 | Index store | **DuckDB for both FTS + VSS(HNSW)** — one engine, one disposable file. |
| 11 | stdio vs local HTTP | **Start stdio** (decided lean); revisit only if model warm-up hurts. |
| 12 | mem0/ReMe dependency | **Reference only** first; embed later only if it clearly saves work (Apache-2.0 OK). |
| 17 | **Python toolchain** (machine has only system Python 3.9.6, no uv) | **`uv`** with a pinned Python ≥3.11 in `sidecars/retrieval/` (`pyproject.toml` + `uv.lock`; uv installs the interpreter — no system-Python dependency). Document one-command setup in the sidecar README. |
| 18 | Test policy for Python-dependent tests | Root `pnpm test` stays **Node-only deterministic** (135 tests, no Python needed). Sidecar tests = `pytest` inside the sidecar + a `test:sidecar` root target for the TS↔Python integration tests; integration runner **auto-skips with a visible SKIP** when the sidecar env is absent. |
| 19 | Index artifact layout | Single **`indexes/retrieval.duckdb`** (FTS + vector + later graph/temporal tables in one disposable file). Existing `indexes/*` subdirs stay for future auxiliary artifacts. **Model cache lives outside the workspace** (default HF cache), never under `indexes/`. |
| 20 | Chunking | ~512-token, **heading-aware** chunks; chunk id = `<note ULID>#<seq>`; chunks always carry `source_ref` = note id. |

## Sub-phases & sequencing (all stories ≤3 pts)

### 3A — Contracts & protocol skeleton
- **SB-047** (2) — retrieval + index **contracts** in `@sb/interfaces` (types, scopes
  `read:index`/`write:index`, operation descriptors `indexVault`/`queryMemory`; no impl).
- **SB-030** (3, anchor) — **Python sidecar skeleton**: uv project, stdio JSONL loop, `ping`/`health`
  ops, structured errors, pytest. No indexing yet.
- **SB-048** (3) — **TS transport client** in `@sb/retrieval`: spawn/converse/timeout/structured errors;
  `ping` round-trip integration test (env-gated per OQ #18).

### 3B — Lexical pipeline end-to-end
- **SB-031** (3, anchor) — **FTS index build + lexical query** in the sidecar (`index_vault` v1 → DuckDB
  FTS; `query` lexical mode; read-only over the vault; idempotent).
- **SB-053** (2) — **`sb index` CLI** + `scripts/index_vault.ts`: facade call + `indexed` projection
  event (TS-emitted) + read-only guarantees test.
- **SB-032** (2, anchor) — **`sb query` CLI + facade query** + `scripts/query_memory.ts` (lexical mode
  first; `{id, score, snippet, source_ref}` results).

### 3C — Semantic retrieval
- **SB-049** (3) — **BGE-M3 embeddings + DuckDB VSS (HNSW) + hybrid ranking** (~70/30 vector/keyword,
  tunable); `index_vault` extended; hybrid becomes the default `query` mode (OQ #9 CPU check here).

### 3D — Epic gate
- **SB-054** (2) — **index disposability gate**: populate → index → baseline queries → **delete
  `indexes/`** → rebuild → identical results. Automated, env-gated; the epic "Done when".

### 3X — Stretch (P2, not required for the gate)
- **SB-055** (3) — **graph + temporal indexes** (wikilink/entity edges; time-bucketed) + query filters.

### Dependency graph (critical path)
```
SB-047 (contracts)
  └─ SB-030 (sidecar skeleton)
       └─ SB-048 (TS transport)
            ├─ SB-031 (FTS build + lexical query) ─ SB-053 (sb index + event)
            │                                        └─ SB-032 (sb query + facade)
            └─ SB-049 (embeddings + hybrid)  [after SB-031]
                 └─ SB-054 (disposability gate)  [after SB-032 + SB-049]
                      └─ SB-055 (graph/temporal — stretch, P2)
```
Recommended order: **SB-047 → SB-030 → SB-048 → SB-031 → SB-053 → SB-032 → SB-049 → SB-054 → (SB-055).**
Stop for human review at each `In Review` and at the 3A/3B/3C/3D sub-phase boundaries.

## Out of scope (Phase 3)
- AI/LLM extraction, summarization, RAG **answer generation** (`sidecars/ai`, Phase 4) — Phase 3 returns
  ranked references, not generated answers.
- Contextual/parent-document retrieval (evaluate later per `retrieval_strategy.md`).
- MCP adapter; local HTTP daemon (only if OQ #11 flips).
- Surfaces/dashboard (Phase 5); domain apps; broker (deferred).
