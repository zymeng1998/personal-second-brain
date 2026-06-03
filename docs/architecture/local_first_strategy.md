# Local-First Strategy

## Principles

1. **You own the data.** Everything lives on your machine in open formats. No cloud is required to
   read, write, or search your brain.
2. **Open formats as source of truth.** Markdown + YAML frontmatter (notes), append-only JSONL
   (events). These are human-readable and tool-agnostic.
3. **Projections are derived, not authoritative.** SQLite/DuckDB databases and indexes are rebuilt
   from the Markdown + event log; losing them loses nothing.
4. **No lock-in.** The vault is usable with any text editor or Obsidian; no proprietary container.
5. **Sync is your choice.** Git, iCloud, Syncthing, or none — the formats are sync-friendly (text +
   append-only JSONL minimize merge conflicts).

## What is authoritative vs derived

| Authoritative (back up these) | Derived (rebuildable) |
|---|---|
| `vault/` Markdown + frontmatter | `db/memory.sqlite` projections |
| `events/*.jsonl` | `indexes/` (FTS/vector/graph/temporal) |
| `secure_refs/` pointers | retrieval caches |

## Sync & backup

- **Recommended:** Git for `vault/` text history (private repo or none) + periodic `db/backups/`.
  JSONL event logs append cleanly; Markdown merges are line-based.
- Indexes/projections are excluded from backups (rebuildable via `scripts/index_vault.ts` and replay).
- The core never *requires* a network. Cloud LLMs/sidecars are optional, opt-in, and pluggable.

## Offline-first AI

Retrieval (Phase 3) uses local embeddings (BGE-M3 via the Python sidecar) so semantic search works
offline. Generation (Phase 4) can use a local or remote LLM; remote is opt-in and never a hard
dependency of the core.

## Relationship to other docs

- Storage formats: [`storage_strategy.md`](storage_strategy.md)
- Privacy: [`privacy_and_security.md`](privacy_and_security.md)
- Decision record: [`../decisions/adr_002_local_first_open_format.md`](../decisions/adr_002_local_first_open_format.md)
