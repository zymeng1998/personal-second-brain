# MVP Scope (v0.1)

The smallest core that proves the data model and contracts before any retrieval/AI sophistication.

## In scope

- **CLI capture** (`apps/cli`) — paste content, get a stored raw note + event.
- **Markdown vault** with PARA + system folders (incl. `00_Raw/`, `00_Inbox/`).
- **Typed YAML frontmatter validation** against `schemas/markdown/`.
- **Append-only event log** (`events/*.jsonl`) — capture events at minimum.
- **Raw capture immutability** — `note-vault` guard prevents overwrite/delete of `00_Raw/`.
- **`interfaces` v0** — `capture`, `getNote`, `listNotes`, `appendEvent`.
- **`init_workspace` script** — creates the external workspace tree.
- **`validate_notes` script** — validates frontmatter across the vault.
- **Minimal human-confirmed distillation workflow** — a Claude-Code skill that proposes **L2** from L1;
  human accepts. **✅ Delivered in Phase 1H** (SB-019 contract → SB-024 L2 writer → SB-025 memory event →
  SB-026 CLI `distill` → SB-027 skill + safety check). L3 facts moved to Phase 2 (EPIC-CORE-008).

## Explicitly deferred

- Retrieval / vector indexing (Phase 3).
- `fact-store` / `entity-graph` / `task-store` projections (Phase 2).
- Dashboard (Phase 5).
- Obsidian helper (Phase 5).
- Email / WeChat / OCR / voice adapters (later).
- Broker-specific workflow (Phase 6; docs-only until then).
- Permission **enforcement** beyond design (model designed now in `interfaces`, enforced later).

## Acceptance criteria

_Status after Phase 1A–1H (SB-001..018 + SB-019/024/025/026/027):_

1. ✅ Capturing content writes an immutable `00_Raw/` file **and** a capture event. *(SB-013/SB-014)*
2. ✅ Attempting to overwrite/delete a raw file is rejected by the guard. *(SB-012, test-locked by SB-017)*
3. ✅ Every note in the vault validates against the frontmatter schema. *(SB-016 `validate:notes`)*
4. ✅ A separate reader can list/read notes and read events using only documented contracts.
   *(SB-015 `note list`/`note get`; events are append-only JSONL)*
5. ✅ The distillation skill never edits raw and never mutates without confirmation. *(Phase 1H: SB-027
   `skills/distill/` + the `distill-safety.test.ts` end-to-end check — raw/L1 bytes unchanged across
   propose→accept; SB-026 `accept` is the only, human-confirmed, write.)*
6. ✅ Grep confirms **zero** domain/broker terms in `packages/`, `schemas/`, vault structure. *(only
   generic capture channels like `paste`/`email`/`wechat` and the negative test asserting `source:"broker"`
   is rejected — no broker domain logic.)*

## Non-goals (MVP)

Performance tuning, multi-LLM, cloud sync, mobile, advanced RAG, analytics.
