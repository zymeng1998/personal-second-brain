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

/** Structured errors for the L2 distilled-note write path (SB-024). */
export type DistilledNoteWriteErrorCode =
  | "invalid_ulid"
  | "unsafe_path"
  | "missing_title"
  | "missing_source_ref"
  | "invalid_links"
  | "already_exists"
  | "write_failed";

/** Structured errors for the L1 working-note write path (SB-029). */
export type WorkingNoteWriteErrorCode =
  | "invalid_ulid"
  | "unsafe_path"
  | "missing_source_ref"
  | "invalid_body"
  | "already_exists"
  | "write_failed";

export class WorkingNoteWriteError extends Error {
  readonly code: WorkingNoteWriteErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: WorkingNoteWriteErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "WorkingNoteWriteError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

/** Structured errors for the secure_refs pointer primitive (SB-050).
 * Messages NEVER echo locator/notes values — they may be sensitive. */
export type SecureRefErrorCode =
  | "invalid_id"
  | "invalid_field"
  | "not_a_container"
  | "unsafe_path"
  | "already_exists"
  | "write_failed"
  | "read_failed";

export class SecureRefError extends Error {
  readonly code: SecureRefErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: SecureRefErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "SecureRefError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

/** Structured errors for the L5 output-note write path (SB-058). */
export type OutputNoteWriteErrorCode =
  | "invalid_ulid"
  | "unsafe_path"
  | "invalid_title"
  | "missing_sources"
  | "invalid_body"
  | "already_exists"
  | "write_failed";

export class OutputNoteWriteError extends Error {
  readonly code: OutputNoteWriteErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: OutputNoteWriteErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "OutputNoteWriteError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

export class DistilledNoteWriteError extends Error {
  readonly code: DistilledNoteWriteErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: DistilledNoteWriteErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "DistilledNoteWriteError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

/** Raised when a mutation (overwrite/delete) is refused because the target is L0 raw. */
export type RawImmutabilityErrorCode = "overwrite_rejected" | "delete_rejected";

export class RawImmutabilityError extends Error {
  readonly code: RawImmutabilityErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: RawImmutabilityErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "RawImmutabilityError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

/** Raised by the read-only note API (list/get). */
export type NoteReadErrorCode = "unsafe_path" | "invalid_ulid" | "not_found" | "read_failed";

export class NoteReadError extends Error {
  readonly code: NoteReadErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: NoteReadErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "NoteReadError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}
