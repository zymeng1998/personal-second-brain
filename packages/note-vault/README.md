# @sb/note-vault

Read/write the Markdown + YAML-frontmatter vault. Owns PARA conventions and the **raw-immutability
guard** (`vault/00_Raw/` is never overwritten or deleted).

- Status: **Phase 1C–1E (SB-011, SB-012, SB-015).** `writeRawNote()` safely creates an immutable L0 raw
  note under `<workspace>/vault/00_Raw/` (`<ULID>.md` or `<ULID>--<slug>.md`), frontmatter aligned to
  `schemas/markdown/` v1, body byte-faithful, exclusive create (never overwrites). The **immutability
  guard** (SB-012) refuses any overwrite/delete of L0 raw via the vault API. The **read-only API**
  (SB-015) lists notes and gets one by id.
- Responsibilities (full package, incremental): load/save notes, validate frontmatter against
  `schemas/markdown/`, enforce folder conventions, guard L0 raw immutability.
- Never owns retrieval/indexing (that's the sidecar) and never holds domain concepts.

## SB-011 surface (current)

- `writeRawNote(input): Promise<WriteRawNoteResult>` — the low-level raw write contract. Validates the
  ULID (via `@sb/interfaces`), absolute workspace path, source kind, and slug safety; throws
  `RawNoteWriteError` with a structured `code` (`invalid_ulid` / `unsafe_path` / `invalid_slug` /
  `invalid_source` / `invalid_content` / `already_exists` / `write_failed`).
- `guardRawImmutable(workspace, path, op)` / `isRawPath(...)` — the single guarded path: any
  overwrite/delete targeting `vault/00_Raw/` is refused.
- `updateRawNote(input)` / `deleteRawNote(input)` — always reject with `RawImmutabilityError`
  (`overwrite_rejected` / `delete_rejected`); the file is never touched. Creating a *new* raw note works.
- `listNotes(workspace, { type? })` / `getNote(workspace, id)` — **read-only** (SB-015). `listNotes`
  returns `NoteSummary[]` (`id/type/title/layer/path`, sorted by id); `getNote` returns the verbatim
  note content. Throw `NoteReadError` (`unsafe_path` / `invalid_ulid` / `not_found` / `read_failed`).
  Never write to the vault.
- **Not here** (later stories): the `00_Inbox/` L1 stub + capture-event emission (SB-013/SB-014), CLI
  (SB-013), OS-level filesystem permissions (SB-012), and search/retrieval (Phase 3).

Scripts: `pnpm --filter @sb/note-vault test` (Node built-in test runner via tsx), `… build` (`tsc --noEmit`).

See [`docs/architecture/memory_layers.md`](../../docs/architecture/memory_layers.md).
