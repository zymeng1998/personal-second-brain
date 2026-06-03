# CLAUDE.md — Second Brain Core

Project-specific guidance for Claude Code. See [`AGENTS.md`](AGENTS.md) for the cross-CLI rules
(they apply here too) and [`README.md`](README.md) for the overview.

## Session start ritual

1. Read [`STATUS.md`](STATUS.md) (handoff from the previous session).
2. Skim [`docs/planning/implementation_roadmap.md`](docs/planning/implementation_roadmap.md) and
   [`docs/planning/mvp_scope.md`](docs/planning/mvp_scope.md) for current phase + scope.
3. State the next concrete task in one sentence before acting.

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

## Working norms (from user global rules)

- Redirect verbose command output to files; surface only summaries.
- Update [`STATUS.md`](STATUS.md) at milestones and before stopping.
- Many small files (<400 lines typical). Immutable update patterns. Explicit error handling.
- License safety: reference, don't copy, from AGPL/GPL/unclear-license repos.

## Current phase

Phase 0 — scaffold only. Do not implement application logic, DB code, retrieval, AI extraction,
connectors, or domain workflows until the roadmap says so.
