# Glossary

Shared vocabulary. Precise terms keep the core **domain-independent** — when a domain app needs a
concept (e.g. "client"), it maps to these core terms rather than adding new core vocabulary.

| Term | Definition |
|---|---|
| **Capture** | The act of saving input verbatim into L0 (raw). Loss-free, immutable. |
| **Raw capture (L0)** | The original artifact (paste/email/transcript/OCR/clip). Source of truth; AI never overwrites/deletes. |
| **Working note (L1)** | Human/AI-processed note derived from raw; editable. |
| **Distilled note (L2)** | Curated, reusable note (evergreen/concept/entity/project/case). Interpretation, not truth. |
| **Distill** | Progressive summarization from L1 → L2 (and proposing L3 facts). Human-confirmed. |
| **Express** | Generating outputs (L5) from distilled knowledge, citing sources. |
| **Fact (L3)** | A queryable, structured statement projected from notes/events, with provenance (source ref + timestamp + confidence). ADD-only. |
| **Entity** | A domain-neutral subject (person/org/place/concept) that notes/facts reference; a graph anchor. |
| **Task** | A domain-neutral next-action/commitment tracked in the task store. |
| **Projection** | Derived, rebuildable data (facts/entities/tasks/indexes) computed from authoritative sources. |
| **Index (L4)** | A retrieval structure (FTS/vector/graph/temporal). Disposable; rebuildable. |
| **Output (L5)** | A generated artifact (draft/report/email/plan) that must cite its source context. |
| **Event** | An append-only JSONL record (capture/memory/projection). Source of truth for audit + replay. |
| **Event log** | The append-only streams in `events/`. Never rewritten; corrections are new events. Distinct from disposable `logs/`. |
| **Source of truth** | Authoritative data: the vault Markdown + event log + secure refs. Everything else is rebuildable. |
| **Provenance** | The traceable origin of a fact/output: which raw/notes/events it came from, when, with what confidence. |
| **Adapter** | An ingestion component normalizing some input source (paste/email/WeChat/OCR/…) into L0 + a capture event. |
| **Surface** | A way the human interacts with the brain (CLI/Obsidian/dashboard/mobile/clipper). |
| **Sidecar** | A Python service for retrieval/AI that reads & indexes the vault but never owns it; called over stdio JSON/JSONL. |
| **Interface / contract** | The stable JSON-Schema + operation boundary in `packages/interfaces` that all callers (incl. domain apps) use. |
| **Domain app** | A tool under `domain-apps/` for a specific domain (broker/research/finance/…) that uses the core only via interfaces under scoped permissions. |
| **Scope / capability** | A least-privilege grant describing what a caller may read/write. |
| **Workspace** | The external (non-committed) data directory (`PersonalSecondBrainWorkspace/`) holding the vault, events, db, indexes, attachments, secure refs, logs. |
