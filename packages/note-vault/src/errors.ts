/**
 * Structured errors for the note-vault write path. Callers can branch on `code`
 * rather than parsing messages.
 */

export type RawNoteWriteErrorCode =
  | "invalid_ulid"
  | "unsafe_path"
  | "invalid_slug"
  | "invalid_source"
  | "invalid_content"
  | "already_exists"
  | "write_failed";

export class RawNoteWriteError extends Error {
  readonly code: RawNoteWriteErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: RawNoteWriteErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "RawNoteWriteError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}
