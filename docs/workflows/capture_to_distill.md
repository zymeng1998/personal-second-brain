# Workflow: Capture → Distill (human-confirmed)

The first end-to-end workflow. MVP implements Capture + a minimal human-confirmed Distill; full
Express (generation) is post-MVP.

## 1. Capture (MVP)

```
human pastes content  →  CLI `capture`
  → write verbatim to vault/00_Raw/<id>.md   (L0, immutable)
  → append capture_events.jsonl record       (source of truth)
  → create a stub working note in 00_Inbox/   (L1, references <id>)
```

Guarantees: nothing is lost; raw is immutable; the event makes it replayable.

## 2. Organize (MVP, human)

The human triages `00_Inbox/` notes into PARA folders, adds typed frontmatter (validated by
`validate_notes`), and links entities with `[[wikilinks]]`.

## 3. Distill (MVP minimal, human-confirmed)

A Claude-Code skill **proposes** a distilled note (L2) and/or candidate facts (L3) from a working
note. The human reviews and accepts/edits. The skill:
- **never** edits `00_Raw/`,
- writes proposals as suggestions (e.g. a draft note or a diff), not silent mutations,
- records a `memory_events` entry when the human accepts,
- attaches provenance (source raw id + timestamp + confidence) to any proposed fact.

## 4. Express (post-MVP)

Generate outputs (L5) into `60_Outputs/` that cite the L0–L3 sources used. Requires retrieval + AI
(Phases 3–4).

## Invariants enforced throughout

- Raw immutability (L0). · No auto-delete. · Facts ADD-only with provenance. · Event log append-only.
- AI suggests; human confirms. · Indexes (if present) are rebuildable.

## Out of scope for this workflow doc

Domain-specific capture/distill (e.g. broker WeChat threads) — those are built later in
`domain-apps/` and reuse this same core workflow via `interfaces`.
