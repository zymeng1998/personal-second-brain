/**
 * @sb/note-vault — Markdown + YAML-frontmatter vault writer/reader.
 * SB-011: low-level raw (L0) write primitive. SB-012: raw immutability guard.
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
export { RawNoteWriteError, RawImmutabilityError } from "./errors.js";
export type { RawNoteWriteErrorCode, RawImmutabilityErrorCode } from "./errors.js";
