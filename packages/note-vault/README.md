# @sb/note-vault

Read/write the Markdown + YAML-frontmatter vault. Owns PARA conventions and the **raw-immutability
guard** (`vault/00_Raw/` is never overwritten or deleted).

- Status: **Phase 1C, SB-011 — raw write primitive only.** `writeRawNote()` safely creates an
  immutable L0 raw note under `<workspace>/vault/00_Raw/` (`<ULID>.md` or `<ULID>--<slug>.md`),
  frontmatter aligned to `schemas/markdown/` v1, body byte-faithful, exclusive create (never overwrites).
- Responsibilities (full package, incremental): load/save notes, validate frontmatter against
  `schemas/markdown/`, enforce folder conventions, guard L0 raw immutability.
- Never owns retrieval/indexing (that's the sidecar) and never holds domain concepts.

## SB-011 surface (current)

- `writeRawNote(input): Promise<WriteRawNoteResult>` — the low-level raw write contract. Validates the
  ULID (via `@sb/interfaces`), absolute workspace path, source kind, and slug safety; throws
  `RawNoteWriteError` with a structured `code` (`invalid_ulid` / `unsafe_path` / `invalid_slug` /
  `invalid_source` / `invalid_content` / `already_exists` / `write_failed`).
- **Not in SB-011** (later stories): the `00_Inbox/` L1 stub (capture orchestration), capture-event
  emission (SB-014), the broader immutability guard (SB-012), and the CLI (SB-013).

Scripts: `pnpm --filter @sb/note-vault test` (Node built-in test runner via tsx), `… build` (`tsc --noEmit`).

See [`docs/architecture/memory_layers.md`](../../docs/architecture/memory_layers.md).
