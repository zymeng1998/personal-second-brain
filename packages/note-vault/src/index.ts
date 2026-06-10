/**
 * @sb/note-vault — Markdown + YAML-frontmatter vault writer/reader.
 * SB-011: low-level raw (L0) write primitive. SB-012: raw immutability guard.
 * SB-015: read-only note list/get. SB-024: L2 distilled-note write primitive.
 * SB-044: shared frontmatter parsing.
 */
export { writeRawNote, RAW_SOURCE_KINDS } from "./raw-note-writer.js";
export type { WriteRawNoteInput, WriteRawNoteResult, RawSourceKind } from "./raw-note-writer.js";
export { writeDistilledNote, DISTILLED_RELATIVE_DIR } from "./distilled-note-writer.js";
export type { WriteDistilledNoteInput, WriteDistilledNoteResult } from "./distilled-note-writer.js";
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
export { parseFrontmatter, frontmatterOf } from "./frontmatter.js";
export type { FrontmatterParseResult } from "./frontmatter.js";
export {
  RawNoteWriteError,
  RawImmutabilityError,
  NoteReadError,
  DistilledNoteWriteError,
} from "./errors.js";
export type {
  RawNoteWriteErrorCode,
  RawImmutabilityErrorCode,
  NoteReadErrorCode,
  DistilledNoteWriteErrorCode,
} from "./errors.js";
