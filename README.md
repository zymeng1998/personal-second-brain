# personal-second-brain

A **local-first, open-format, domain-independent personal second brain core**.

It captures messy information, organizes it (PARA + Tiago Forte's CODE), distills it into
reusable notes, projects queryable facts, and generates outputs — all over plain Markdown,
YAML frontmatter, an append-only JSON event log, and rebuildable SQLite/DuckDB projections.

> **Status:** **Phase 1 (MVP core), Phase 1H (distillation), and Phase 2 (projections) all complete.**
> CLI `capture` writes immutable L0 raw notes + an append-only capture event; the vault read API
> (`note list` / `note get`) and frontmatter validation work; raw immutability is enforced and test-locked.
> The human-confirmed **`distill`** workflow (L1→L2 note + memory event) ships, and **L3 projections**
> (fact-store ADD-only, entity-graph + manual merges, task-store) build in rebuildable SQLite via
> `sb rebuild` — dropping `db/` and replaying the event log reproduces row-identical projections.
> **130 tests passing.** **Next: Phase 3 — retrieval** (DuckDB + BGE-M3 over a Python sidecar).
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
packages/     interfaces ✅, note-vault ✅, event-log ✅, memory-kernel ✅, fact-store ✅,
              entity-graph ✅, task-store ✅, retrieval, adapters, surfaces, ai
sidecars/     retrieval, ai  (Python — boundary docs only in Phase 0)
domain-apps/  broker (docs-only)
schemas/      markdown, json, sql
examples/     notes, captures, entities, projects, outputs
scripts/      init_workspace ✅, validate_notes ✅, index_vault, query_memory (stubs)
```

## Data lives outside this repo

Real notes, captures, events, indexes, and attachments live in a separate **workspace**
(`PersonalSecondBrainWorkspace/`), referenced via `.env`. **No real personal/client data is
ever committed.** See [`docs/architecture/privacy_and_security.md`](docs/architecture/privacy_and_security.md).

## Getting started

These commands are implemented and verified end-to-end (capture → read → validate → distill → project).
The workspace lives **outside** this repo;
point `SECOND_BRAIN_WORKSPACE` at a path that is not the repo, your home dir, or `/`.

```bash
cp .env.example .env                 # set SECOND_BRAIN_WORKSPACE to your workspace path
pnpm install
export SECOND_BRAIN_WORKSPACE=/path/to/PersonalSecondBrainWorkspace

# 1. Create (idempotent) + verify the workspace tree
pnpm init:workspace                  # 27 dirs + 5 files; non-destructive, never overwrites data
pnpm verify:workspace                # read-only structure check

# 2. Capture into L0 raw + append a capture event
pnpm --filter @sb/cli capture -- --content "hello second brain" --source paste --title "First note"
echo "captured via stdin" | pnpm --filter @sb/cli capture -- --source paste

# 3. Read back (read-only; never mutates the vault or events)
pnpm --filter @sb/cli note -- list             # id  type  title, sorted by id
pnpm --filter @sb/cli note -- get <ULID>       # verbatim markdown for one note

# 4. Validate frontmatter across the vault (read-only; exit 0 valid / 1 invalid / 2 operational)
pnpm validate:notes

# 5. Distill L1 → L2 (human-confirmed). propose is read-only; accept is the only write.
pnpm --filter @sb/cli distill -- propose
cat proposal.json | pnpm --filter @sb/cli distill -- accept

# 6. Build the L3 projections (facts/entities/edges/tasks) — rebuildable from the event log + vault
pnpm --filter @sb/cli rebuild

# 7. Run the test suite (immutability + reproducibility gate included)
pnpm test
```

`init_workspace` and `validate_notes` also accept `--workspace <path>` (and `--dry-run` /
`--help` where applicable) instead of the environment variable.

## License

TBD (see [`docs/decisions/adr_002_local_first_open_format.md`](docs/decisions/adr_002_local_first_open_format.md)).
