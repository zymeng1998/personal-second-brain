# System Architecture

## Overview

A **contracts-first hybrid**: a language-neutral source of truth (Markdown + YAML + append-only
JSONL event log + rebuildable SQLite/DuckDB projections), a TypeScript monorepo owning structure
and contracts, Python sidecars owning retrieval/AI, and Claude-Code skills as the agent workflow
layer. The core is **domain-independent**; domain apps attach only via `packages/interfaces`.

## Layered data model

```
            ┌─────────────────────────────────────────────────────────┐
 capture →  │ L0 Raw (vault/00_Raw)  [IMMUTABLE]                       │
            │      │                                                    │
            │      ▼                                                    │
            │ L1 Working Notes → L2 Distilled Notes   (Markdown vault)  │
            │      │                                                    │
            │      ▼                                                    │
            │ L3 Structured Facts / Entities / Tasks  (SQLite proj.)    │
            │      │  provenance + timestamp + confidence + source ref  │
            │      ▼                                                    │
            │ L4 Retrieval Indexes (FTS/vector/graph/temporal) [DISPOSABLE]
            │      │                                                    │
            │      ▼                                                    │
            │ L5 Generated Outputs (vault/60_Outputs)  [must cite L0–L3] │
            └─────────────────────────────────────────────────────────┘
 append-only │ events/*.jsonl  — SOURCE OF TRUTH audit + replay spine   │
```

**Invariant:** Raw = truth · Distilled = interpretation · Facts = projection · Indexes = disposable.
Projections (L3) and indexes (L4) are always rebuildable from L0–L2 + the event log.

## Components (TypeScript packages)

| Package | Responsibility | MVP? |
|---|---|---|
| `interfaces` | The contract: JSON Schemas + TS types + capability/permission model. Everything depends on it. | v0 |
| `note-vault` | Read/write Markdown+frontmatter; PARA conventions; **raw-immutability guard**. | ✅ |
| `event-log` | Append-only JSONL store; audit + replay spine. | ✅ |
| `memory-kernel` | Orchestrates layers; enforces source-of-truth rules; sole coordinator of vault+events+projections. | partial |
| `fact-store` | L3 facts (SQLite) with provenance/confidence/temporal. | ✕ (Phase 2) |
| `entity-graph` | Domain-neutral entities + relations projection. | ✕ (Phase 2) |
| `task-store` | Domain-neutral tasks/next-actions. | ✕ (Phase 2) |
| `retrieval` | **TS facade** over the Python retrieval sidecar; rebuildable indexes. | ✕ (Phase 3) |
| `adapters` | Ingestion (manual paste first; email/WeChat/OCR/voice/clip later) → L0 events. | paste only |
| `surfaces` | Surface adapters (CLI first; dashboard/Obsidian/mobile later). | CLI |
| `ai` | Glue to Claude-Code skills + Python AI sidecar (suggestions, human-confirmed). | minimal |

## Sidecars (Python — not implemented in Phase 0)

`sidecars/retrieval/` and `sidecars/ai/` are documented boundaries only. They will read & index the
vault but never own it. TS↔Python communicates over **stdio JSON/JSONL** (Phase 0/1). See
[`sidecar_contract.md`](sidecar_contract.md).

## Agent workflow layer

Claude-Code skills (and `AGENTS.md`-compatible equivalents) drive capture intake, braindump
processing, distillation, and review — through documented workflows and `interfaces`. They are
**not** the backend and never bypass the contracts or mutate raw/facts silently.

## Domain apps

Live only under `domain-apps/`. They call the core through `interfaces` under **scoped permissions**
(no default unrestricted read). Phase 0: broker is docs-only. See
[`../decisions/adr_006_domain_apps_use_interfaces_only.md`](../decisions/adr_006_domain_apps_use_interfaces_only.md).

## Data flow (end to end)

`capture → adapter → L0 raw file + capture event → (human/AI) L1/L2 notes + memory events →
memory-kernel projects L3 facts/entities/tasks + projection events → retrieval sidecar (re)builds L4
→ AI generates L5 outputs citing sources`.
