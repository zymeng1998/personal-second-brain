# PRD v0.2 — Personal Second Brain Core

## Vision

A deep, general-purpose, **local-first** personal second brain that captures messy information,
organizes it (PARA + CODE), distills it into reusable knowledge, projects queryable facts, and
generates outputs — over open formats you fully own. It is **domain-independent**: future
domain apps (broker, research, finance, job-search, course-notes, writing) plug in through stable
interfaces without polluting the core.

## Goals

- **G1.** Capture anything (paste, later: email/WeChat/OCR/voice/clip) with zero loss; raw capture is immutable.
- **G2.** Organize using PARA folders and the CODE workflow (Capture, Organize, Distill, Express).
- **G3.** Layered AI memory: raw → working → distilled → facts → indexes → outputs.
- **G4.** Retrieval-aware organization (structure that supports later FTS/semantic/graph/temporal retrieval).
- **G5.** Stable interfaces future domain apps call (scoped, contract-based).
- **G6.** Local-first data ownership; open formats (Markdown, YAML, JSONL, SQLite/DuckDB).
- **G7.** Human-in-the-loop AI: suggest, never silently mutate; never overwrite raw; never auto-delete.

## Non-goals (for the core, ever)

- Broker (or any domain) concepts inside the core. Those live only in `domain-apps/`.
- Cloud-required operation; vendor lock-in; closed formats as source of truth.
- Storing raw sensitive documents (passports, bank statements, IDs) — only metadata + secure references.

## Users & primary jobs-to-be-done

Single primary user (technically strong, macOS, may add many workflows). JTBD:
- "Dump a messy thought / paste / transcript and trust it's safely captured."
- "Turn raw material into a clean, linked, reusable note when I choose to."
- "Ask my brain a question and get an answer grounded in my own sources." *(later phase)*
- "Let a domain app (e.g. broker) read/write my brain through a safe, scoped contract." *(later phase)*

## Memory layers (product-level)

| Layer | Meaning | Guarantee |
|---|---|---|
| L0 Raw Capture | Original pasted text/email/transcript/OCR/clip | Immutable; AI never overwrites/deletes |
| L1 Working Notes | Human/AI processed | Editable |
| L2 Distilled Notes | Evergreen/concept/entity/project/case | Curated, reusable |
| L3 Structured Facts | Queryable projections | Provenance + timestamp + confidence + source ref |
| L4 Retrieval Indexes | FTS/vector/graph/temporal | Disposable, rebuildable |
| L5 Generated Outputs | Drafts/reports/emails/plans | Must cite source context |

Event log (`workspace/events/*.jsonl`) is an additional **source-of-truth** audit/replay spine.

## MVP (v0.1) scope

CLI capture → L0 raw + append-only event log; PARA Markdown vault; typed YAML frontmatter
validation; `note-vault` read/write with raw-immutability guard; `interfaces` v0 (capture/read/list);
`init_workspace` + `validate_notes` scripts; one minimal human-confirmed distillation workflow
(Claude-Code skill). See [`../planning/mvp_scope.md`](../planning/mvp_scope.md).

## Deferred (post-MVP)

Retrieval/vector indexing; fact-store/entity-graph/task-store projections; dashboard; Obsidian
helper; email/WeChat/OCR/voice/clip adapters; multi-LLM; permission enforcement; all domain apps.

## Success criteria (MVP)

- Capture is loss-free and raw is provably immutable (guard + event log).
- Every note validates against the frontmatter schema.
- A second tool could read the vault + event log using only documented contracts.
- Zero domain-specific concepts in the core.

## Risks

See [`../planning/open_questions.md`](../planning/open_questions.md) and the risk section of the
implementation roadmap.
