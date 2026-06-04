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
- **Minimal human-confirmed distillation workflow** — a Claude-Code skill that proposes L2/L3 from L1;
  human accepts. **⏳ Deferred (SB-019)** to Phase 1H / Phase 2 pending a scope decision; not built in
  Phase 1A–1G.

## Explicitly deferred

- Retrieval / vector indexing (Phase 3).
- `fact-store` / `entity-graph` / `task-store` projections (Phase 2).
- Dashboard (Phase 5).
- Obsidian helper (Phase 5).
- Email / WeChat / OCR / voice adapters (later).
- Broker-specific workflow (Phase 6; docs-only until then).
- Permission **enforcement** beyond design (model designed now in `interfaces`, enforced later).

## Acceptance criteria

_Status after Phase 1A–1G (SB-001..018):_

1. ✅ Capturing content writes an immutable `00_Raw/` file **and** a capture event. *(SB-013/SB-014)*
2. ✅ Attempting to overwrite/delete a raw file is rejected by the guard. *(SB-012, test-locked by SB-017)*
3. ✅ Every note in the vault validates against the frontmatter schema. *(SB-016 `validate:notes`)*
4. ✅ A separate reader can list/read notes and read events using only documented contracts.
   *(SB-015 `note list`/`note get`; events are append-only JSONL)*
5. ⏳ The distillation skill never edits raw and never mutates without confirmation. *(deferred — SB-019;
   the skill is not built yet, so this criterion is pending Phase 1H/Phase 2.)*
6. ✅ Grep confirms **zero** domain/broker terms in `packages/`, `schemas/`, vault structure. *(only
   generic capture channels like `paste`/`email`/`wechat` and the negative test asserting `source:"broker"`
   is rejected — no broker domain logic.)*

## Non-goals (MVP)

Performance tuning, multi-LLM, cloud sync, mobile, advanced RAG, analytics.
