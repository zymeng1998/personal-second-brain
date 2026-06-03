# ADR-007: Hybrid stack — TypeScript core, Python sidecars, Claude-Code skills

- **Status:** Accepted (2026-06-03)
- **Deciders:** Mengziyue

## Context

The scaffold leaned TypeScript (pnpm monorepo), but the strongest reusable retrieval/AI code is Python
(sspaeti DuckDB+BGE-M3, flepied, Khoj, mem0/ReMe), and the best workflow repos (eugeniughelbur, COG)
are pure Markdown + Claude-Code with no backend. Reimplementing mature retrieval in TS would be wasteful;
making Claude-Code skills the backend would be unstable; going all-Python would weaken the
contract/surface story (Obsidian plugin, dashboard, CLI, domain integration).

## Decision

**Hybrid, contracts-first:**

1. **Source of truth is language-neutral:** Markdown + YAML frontmatter + JSONL event log +
   SQLite/DuckDB/Postgres projections.
2. **TypeScript/pnpm monorepo owns:** repo structure, schemas, interface contracts, CLI, dashboard,
   Obsidian helper, domain-app integration, workflow orchestration.
3. **Python sidecars own:** retrieval, embeddings, RAG, vector/DuckDB/SQLite indexing experiments, and
   integration with mature Python projects (Khoj/mem0/ReMe/sspaeti patterns).
4. **Claude-Code skills are the agent workflow layer:** vault maintenance, braindump, distillation,
   human-in-the-loop review, command workflows.
5. **Not** the backend (skills) and **not** the source of truth (Python). TS does **not** reimplement
   mature retrieval tooling.
6. **Stable boundary:** JSON Schemas + CLI commands + OpenAPI-style contracts + file/DB contracts.
   TS↔Python over **stdio JSON/JSONL** (Phase 0/1); optional local HTTP (Phase 3); optional MCP later.

## Consequences

- Best reuse of existing Python tooling without polluting the core or the contracts.
- Two toolchains to maintain — mitigated by a single documented stdio contract and thin TS facades.
- Sidecars read & index the vault but never own it; skills act only through documented workflows.
- Phase 0 ships **no** sidecar code — boundary docs only.
- See [`../architecture/sidecar_contract.md`](../architecture/sidecar_contract.md),
  [`../research/open_source_second_brain_evaluation.md`](../research/open_source_second_brain_evaluation.md).
