# @sb/note-vault

Read/write the Markdown + YAML-frontmatter vault. Owns PARA conventions and the **raw-immutability
guard** (`vault/00_Raw/` is never overwritten or deleted).

- Status: **Phase 1C–1E + 1H (SB-011, SB-012, SB-015, SB-024).** `writeRawNote()` safely creates an
  immutable L0 raw note under `<workspace>/vault/00_Raw/` (`<ULID>.md` or `<ULID>--<slug>.md`), frontmatter
  aligned to `schemas/markdown/` v1, body byte-faithful, exclusive create (never overwrites). The
  **immutability guard** (SB-012) refuses any overwrite/delete of L0 raw via the vault API. The
  **read-only API** (SB-015) lists notes and gets one by id. `writeDistilledNote()` (SB-024) creates a
  curated **L2** distilled note (default `vault/80_Wiki/`), never under `00_Raw/`.
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
- `writeDistilledNote(input): Promise<WriteDistilledNoteResult>` — the L2 distilled-note write contract
  (SB-024). Writes a **mutable** curated note (`type: distilled`, `layer: 2`) to a non-raw folder
  (default `vault/80_Wiki/`, override via `dirRelative`); requires `title` **and** `source_ref` (the
  distillation provenance rule, stricter than the schema). Exclusive-create by id; **refuses any target
  under `00_Raw/`** (reuses `isRawPath`) and never reads/mutates the L1 source. Throws
  `DistilledNoteWriteError` (`invalid_ulid` / `unsafe_path` / `missing_title` / `missing_source_ref` /
  `already_exists` / `write_failed`). Create only — edit/supersede is a later story.
- **Not here** (later stories): the `00_Inbox/` L1 stub + capture-event emission (SB-013/SB-014), CLI
  (SB-013, and `distill` in SB-026), OS-level filesystem permissions (SB-012), distillation events
  (SB-025), and search/retrieval (Phase 3).

Scripts: `pnpm --filter @sb/note-vault test` (Node built-in test runner via tsx), `… build` (`tsc --noEmit`).

See [`docs/architecture/memory_layers.md`](../../docs/architecture/memory_layers.md).
