# BASB / CODE Mapping

How Tiago Forte's **CODE** workflow (Capture, Organize, Distill, Express) maps onto the system's
layers, folders, and operations. Domain-independent — the same flow serves research, finance, job
search, course notes, writing, and (later) broker work.

## CODE → layers → locations

| CODE step | What happens | Layers | Location | Operation |
|---|---|---|---|---|
| **Capture** | Save messy input verbatim | L0 → event | `vault/00_Raw/` + `events/capture_events.jsonl` | `capture` |
| **Organize** | Triage into PARA; light processing | L0→L1 | `00_Inbox/` → PARA folders | (human/AI, `interfaces`) |
| **Distill** | Extract the essence; evergreen notes | L1→L2 (and L3 facts) | `50_Entities/`, `80_Wiki/`, PARA | distillation skill (human-confirmed) |
| **Express** | Produce outputs that cite sources | L5 | `60_Outputs/` | generation (later) |

## Capture

- Loss-free, immutable (L0). Every capture also emits a capture event (audit/replay).
- MVP supports manual paste via CLI; later adapters add email/WeChat/OCR/voice/clip.

## Organize (PARA)

- Move from `00_Inbox` into Projects/Areas/Resources/Archives. See [`para_mapping.md`](para_mapping.md).
- Organization is **retrieval-aware**: stable ids, wikilinks, typed frontmatter, dates.

## Distill (progressive summarization, human-confirmed)

- Working notes (L1) become evergreen/concept/entity/case notes (L2).
- AI may *suggest* distillation and *propose* structured facts (L3) — the human confirms.
- Never overwrites raw; facts carry provenance. See [`../workflows/capture_to_distill.md`](../workflows/capture_to_distill.md).

## Express

- Drafts/reports/emails/plans (L5) generated from distilled knowledge, **citing** L0–L3 sources.
- Post-MVP (needs retrieval + AI). Outputs are editable Markdown in `60_Outputs/`.

## Principle alignment

- **Keep what resonates** → capture freely; distill selectively.
- **Make it actionable** → PARA's project orientation + `task-store` (later).
- **Express to learn** → outputs link back to sources, closing the loop.
