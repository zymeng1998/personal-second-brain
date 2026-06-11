/**
 * @sb/note-vault — Markdown + YAML-frontmatter vault writer/reader.
 * SB-011: low-level raw (L0) write primitive. SB-012: raw immutability guard.
 * SB-015: read-only note list/get. SB-024: L2 distilled-note write primitive.
 * SB-044: shared frontmatter parsing. SB-029: L1 working-note write primitive.
 * SB-058: L5 output-note write primitive (must cite sources).
 */
export { writeRawNote, RAW_SOURCE_KINDS } from "./raw-note-writer.js";
export type { WriteRawNoteInput, WriteRawNoteResult, RawSourceKind } from "./raw-note-writer.js";
export { writeDistilledNote, DISTILLED_RELATIVE_DIR } from "./distilled-note-writer.js";
export type { WriteDistilledNoteInput, WriteDistilledNoteResult } from "./distilled-note-writer.js";
export { writeWorkingNote, WORKING_RELATIVE_DIR } from "./working-note-writer.js";
export type { WriteWorkingNoteInput, WriteWorkingNoteResult } from "./working-note-writer.js";
export { writeOutputNote, OUTPUTS_RELATIVE_DIR } from "./output-note-writer.js";
export type { WriteOutputNoteInput, WriteOutputNoteResult } from "./output-note-writer.js";
export { writeSecureRef, listSecureRefs, SECURE_REFS_RELATIVE_DIR } from "./secure-ref.js";
export type {
  WriteSecureRefInput,
  WriteSecureRefResult,
  SecureRefRecord,
  ListSecureRefsResult,
} from "./secure-ref.js";
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
  WorkingNoteWriteError,
  OutputNoteWriteError,
  SecureRefError,
} from "./errors.js";
export type {
  RawNoteWriteErrorCode,
  RawImmutabilityErrorCode,
  NoteReadErrorCode,
  DistilledNoteWriteErrorCode,
  WorkingNoteWriteErrorCode,
  OutputNoteWriteErrorCode,
  SecureRefErrorCode,
} from "./errors.js";
