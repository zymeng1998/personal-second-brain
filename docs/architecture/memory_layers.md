# Memory Layers

The spine of the system. Each layer has a distinct role, mutability guarantee, and storage location.

| Layer | Name | Location | Mutability | Source of truth? |
|---|---|---|---|---|
| L0 | Raw Capture | `vault/00_Raw/` | **Immutable** — AI never overwrites/deletes | **Yes** |
| L1 | Working Notes | `vault/00_Inbox/` then PARA folders | Human/AI editable | Derived |
| L2 | Distilled Notes | PARA + `50_Entities/`, `80_Wiki/` | Curated, reusable | Derived |
| L3 | Structured Facts | `db/memory.sqlite` | Projection (ADD-only) | No (rebuildable) |
| L4 | Retrieval Indexes | `indexes/` | **Disposable** | No (rebuildable) |
| L5 | Generated Outputs | `vault/60_Outputs/` | Editable; cites sources | Derived |
| — | Event Log | `events/*.jsonl` | **Append-only** | **Yes** (audit/replay) |

## L0 — Raw Capture (immutable)

The original artifact: pasted text, email body, transcript, OCR text, web clip. Stored verbatim in
`vault/00_Raw/` with a stable id. **AI must never overwrite or delete it.** Every capture also emits a
`capture_events.jsonl` record. Sensitive originals are **not** stored here — only metadata + a
`secure_refs/` pointer (see [`privacy_and_security.md`](privacy_and_security.md)).

## L1 — Working Notes

Human/AI-processed material in `00_Inbox/` (queue) moving into PARA folders. Editable. References its
L0 source by id. This is where Capture→Organize happens (CODE).

## L2 — Distilled Notes

Evergreen/concept/entity/project/case notes — the reusable knowledge. Distill→Express (CODE). Linked
via `[[wikilinks]]`. Interpretation, not truth — always traceable back to L0/L1.

## L3 — Structured Facts (projection)

Queryable facts extracted from notes/events. **ADD-only** (mem0-style): never silently mutated;
corrections are new facts that supersede old ones. Every fact carries:
`{ id, statement, source_ref, captured_at, observed_at, confidence, supersedes? }`. Rebuildable by
replaying the event log + re-extracting from L0–L2.

## L4 — Retrieval Indexes (disposable)

FTS, vector (DuckDB VSS + BGE-M3), graph (wikilinks + entity relations), temporal. Built by the Python
retrieval sidecar. **Always rebuildable**; deleting them loses nothing.

## L5 — Generated Outputs

Drafts, reports, emails, summaries, plans in `vault/60_Outputs/`. **Must cite** the L0–L3 context used
(source ids/links). Editable by the human.

## Event log (source of truth, not a log)

Append-only JSONL streams (`capture_events`, `memory_events`, `projection_events`). They are the
audit + replay spine: projections (L3) and indexes (L4) can be fully reconstructed from L0–L2 + events.
**Never rewrite history**; corrections are new events. Distinct from `logs/` (disposable debug output).

## Hard rules

1. Never overwrite/delete L0. 2. Never auto-delete any note. 3. Never mutate a fact without provenance.
4. Indexes are disposable. 5. Event log is append-only. 6. AI suggests; human confirms.
