/**
 * @sb/note-vault — Markdown + YAML-frontmatter vault writer/reader.
 * SB-011 ships the low-level raw (L0) write primitive only.
 */
export { writeRawNote, RAW_SOURCE_KINDS } from "./raw-note-writer.js";
export type { WriteRawNoteInput, WriteRawNoteResult, RawSourceKind } from "./raw-note-writer.js";
export { RawNoteWriteError } from "./errors.js";
export type { RawNoteWriteErrorCode } from "./errors.js";
