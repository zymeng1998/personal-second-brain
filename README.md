# personal-second-brain

A **local-first, open-format, domain-independent personal second brain core**.

It captures messy information, organizes it (PARA + Tiago Forte's CODE), distills it into
reusable notes, projects queryable facts, and generates outputs — all over plain Markdown,
YAML frontmatter, an append-only JSON event log, and rebuildable SQLite/DuckDB projections.

> **Status:** Phase 0 — scaffolding and planning only. No application logic yet.
> See [`docs/planning/implementation_roadmap.md`](docs/planning/implementation_roadmap.md).

## Core principle: domain independence

This repository is the **domain-independent core**. Domain-specific work (e.g. rental-broker
work) lives **only** under [`domain-apps/`](domain-apps/) and reaches the core **only** through
the stable contracts in [`packages/interfaces`](packages/interfaces). Broker concepts (clients,
listings, applications, commission, property media, WeChat drafts) must never appear in the
memory kernel, note vault, event log, entity graph, fact store, task store, retrieval layer,
core interfaces, or schemas.

## Memory layers (source-of-truth discipline)

| Layer | Name | Mutability |
|---|---|---|
| L0 | Raw Capture (`vault/00_Raw/`) | **Immutable.** AI never overwrites or deletes. |
| L1 | Working Notes | Human/AI editable |
| L2 | Distilled Notes | Curated, reusable |
| L3 | Structured Facts | Projection (provenance + timestamp + confidence + source ref) |
| L4 | Retrieval Indexes | **Disposable / rebuildable** |
| L5 | Generated Outputs | Must cite source context |

**Rule:** Raw = truth · Distilled = interpretation · Facts = projection · Indexes = disposable.
The event log (`workspace/events/*.jsonl`) is also **source of truth** (audit + replay), not a disposable log.

## Architecture (hybrid, contracts-first)

- **TypeScript (this monorepo)** owns repo structure, schemas, interface contracts, CLI,
  dashboard, Obsidian helper, domain-app integration, and orchestration.
- **Python sidecars** (`sidecars/`) own retrieval, embeddings, RAG, and vector/DuckDB indexing.
  *Not implemented in Phase 0.*
- **Claude-Code skills** are the agent workflow layer (capture, distill, review) — never the backend.
- **Stable boundary:** JSON Schemas + CLI commands + file/DB contracts. TS↔Python over **stdio JSON/JSONL**.

## Repository map

```
docs/         product, research, architecture, methodology, workflows, decisions, planning, prompts
apps/         cli (MVP), dashboard, obsidian-helper (post-MVP)
packages/     memory-kernel, note-vault, event-log, entity-graph, fact-store,
              task-store, retrieval, interfaces, adapters, surfaces, ai
sidecars/     retrieval, ai  (Python — boundary docs only in Phase 0)
domain-apps/  broker (docs-only)
schemas/      markdown, json, sql
examples/     notes, captures, entities, projects, outputs
scripts/      init_workspace, validate_notes, index_vault, query_memory (stubs)
```

## Data lives outside this repo

Real notes, captures, events, indexes, and attachments live in a separate **workspace**
(`PersonalSecondBrainWorkspace/`), referenced via `.env`. **No real personal/client data is
ever committed.** See [`docs/architecture/privacy_and_security.md`](docs/architecture/privacy_and_security.md).

## Getting started (after Phase 1)

```bash
cp .env.example .env        # set SECOND_BRAIN_WORKSPACE to your workspace path
pnpm install
pnpm tsx scripts/init_workspace.ts   # creates the workspace tree
```

## License

TBD (see [`docs/decisions/adr_002_local_first_open_format.md`](docs/decisions/adr_002_local_first_open_format.md)).
