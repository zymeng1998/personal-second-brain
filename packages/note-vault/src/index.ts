/**
 * @sb/note-vault — Markdown + YAML-frontmatter vault writer/reader.
 * SB-011: low-level raw (L0) write primitive. SB-012: raw immutability guard.
 * SB-015: read-only note list/get.
 */
export { writeRawNote, RAW_SOURCE_KINDS } from "./raw-note-writer.js";
export type { WriteRawNoteInput, WriteRawNoteResult, RawSourceKind } from "./raw-note-writer.js";
export {
  guardRawImmutable,
  updateRawNote,
  deleteRawNote,
  isRawPath,
  rawNotePath,
} from "./raw-immutability.js";
export type { RawMutationInput } from "./raw-immutability.js";
export { listNotes, getNote } from "./read-notes.js";
export type { NoteSummary, NoteFile, ListNotesOptions } from "./read-notes.js";
export { RawNoteWriteError, RawImmutabilityError, NoteReadError } from "./errors.js";
export type { RawNoteWriteErrorCode, RawImmutabilityErrorCode, NoteReadErrorCode } from "./errors.js";
