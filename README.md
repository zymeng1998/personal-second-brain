# personal-second-brain

A **local-first, open-format, domain-independent personal second brain core**.

It captures messy information, organizes it (PARA + Tiago Forte's CODE), distills it into
reusable notes, projects queryable facts, and generates outputs — all over plain Markdown,
YAML frontmatter, an append-only JSON event log, and rebuildable SQLite/DuckDB projections.

> **Status:** **Complete — Core v0.1 + the first domain app (broker).** Every core epic ships:
> capture → read → validate → media-intake → human-confirmed `distill` → L3 projections
> (rebuildable SQLite) → retrieval sidecar → obsidian-helper + dashboard surfaces, all behind one
> enforced permission boundary. **EPIC-DOMAIN-001** — the rental-broker domain app — is built
> entirely on the core through that boundary, with zero broker concepts in the core (ADR-001).
> **340 core tests + 19 broker tests passing**; `pnpm run smoke` exercises the full core path
> end-to-end. See [`docs/PROJECT_HANDOFF.md`](docs/PROJECT_HANDOFF.md) to run it from a fresh clone,
> and [`docs/planning/implementation_roadmap.md`](docs/planning/implementation_roadmap.md) for the phase history.

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
apps/         cli ✅, dashboard ✅, obsidian-helper ✅, media-intake ✅
packages/     interfaces ✅, note-vault ✅, event-log ✅, memory-kernel ✅, fact-store ✅,
              entity-graph ✅, task-store ✅, retrieval ✅; adapters/surfaces/ai (reserved)
sidecars/     retrieval ✅ (Python: DuckDB FTS+VSS, stdio JSONL), ai (boundary docs only)
domain-apps/  example-readonly ✅ (generic interface smoke test); broker ✅ (EPIC-DOMAIN-001, client preference tracking)
schemas/      markdown, json, sql
examples/     notes, captures, entities, projects, outputs, grants, media
scripts/      init_workspace ✅, validate_notes ✅, index_vault ✅, query_memory ✅, smoke_core_v0.1 ✅
```

**All core epics are complete (Core v0.1 — usable).** End-to-end quickstart:
[`docs/CORE_V0.1_QUICKSTART.md`](docs/CORE_V0.1_QUICKSTART.md) (`pnpm run smoke` exercises it).

## Data lives outside this repo

Real notes, captures, events, indexes, and attachments live in a separate **workspace**
(`PersonalSecondBrainWorkspace/`), referenced via `.env`. **No real personal/client data is
ever committed.** See [`docs/architecture/privacy_and_security.md`](docs/architecture/privacy_and_security.md).

## Getting started

These commands are implemented and verified end-to-end (capture → read → validate → distill → project).
The workspace lives **outside** this repo;
point `SECOND_BRAIN_WORKSPACE` at a path that is not the repo, your home dir, or `/`.

**Requires Node ≥ 22.5** (enforced via `engines.node`): the L3 projection store uses the built-in
[`node:sqlite`](https://nodejs.org/api/sqlite.html) driver (added in 22.5, validated here on 22.20).
`node:sqlite` is still **experimental** — the `ExperimentalWarning` on stderr is expected and harmless.
If its API ever breaks, the swap point is `openProjectionStore` in `@sb/memory-kernel` (e.g. to
`better-sqlite3`); nothing else touches the driver directly.

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

# 7b. Same suite with coverage reporting (c8, SB-033)
pnpm run test:coverage
```

**Coverage policy (SB-033):** target is **≥80% line coverage** (project rule). Reporting is
**non-blocking** — `test:coverage` reports but never fails the build on a threshold. Baseline at
adoption (2026-06-10, 180 tests): **90.15% lines / 78.27% branches**. Test files, Node stub
sidecars (`*.mjs`), and `node_modules` are excluded (see the `c8` key in `package.json`).
Python sidecar tests are separate (`uv run pytest` in `sidecars/retrieval`; env-gated TS↔Python
E2E via `pnpm run test:sidecar`).

`validate_notes` and the CLI apps also accept `--workspace <path>` (after a `--` separator)
instead of the environment variable. `init_workspace` is **env-var only** (it takes `--dry-run` /
`--verify` / `--help`, not `--workspace`).

The full Core v0.1 workflow — including **media-intake** transcript ingest, the **obsidian-helper**,
and the local **dashboard** read path — is documented and verified in
[`docs/CORE_V0.1_QUICKSTART.md`](docs/CORE_V0.1_QUICKSTART.md). Run it end-to-end against a
throwaway workspace with `pnpm run smoke`.

## License

TBD (see [`docs/decisions/adr_002_local_first_open_format.md`](docs/decisions/adr_002_local_first_open_format.md)).
