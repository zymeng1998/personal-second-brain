/**
 * Core operation contracts (v0 — capture/read subset). Types + a design-level
 * descriptor only; no implementation lives here. Each operation documents its
 * input, output, error codes, and the permission scope it requires.
 */
import type { CaptureRequest, CaptureResult } from "./capture.js";
import type {
  DistillationProposal,
  DistillationResult,
  ProposeDistillationInput,
} from "./distillation.js";
import type { Event } from "./event.js";
import type { Ulid } from "./ids.js";
import type { Layer, Note, NoteType } from "./note.js";
import type { PermissionScope } from "./scope.js";

export interface GetNoteInput {
  id: Ulid;
}

export interface NoteFilter {
  type?: NoteType;
  layer?: Layer;
  tag?: string;
  /** Max results; readers should bound unbounded scans. */
  limit?: number;
}

export interface ListNotesInput {
  filter?: NoteFilter;
}

export interface AppendEventResult {
  event_id: Ulid;
}

/** Stable error codes surfaced across the boundary. */
export type InterfaceErrorCode =
  | "validation_failed"
  | "not_found"
  | "raw_immutable"
  | "scope_denied"
  | "duplicate_id"
  | "io_error";

export interface InterfaceError {
  code: InterfaceErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * The v0 core operation surface. Implementations live in other packages
 * (note-vault, event-log, cli); this is only the contract they satisfy.
 */
export interface CoreOperations {
  /** Write an immutable L0 raw note + emit a `captured` event. */
  capture(input: CaptureRequest): Promise<CaptureResult>;
  /** Read a single note by id. Read-only. */
  getNote(input: GetNoteInput): Promise<Note>;
  /** List notes via interfaces (no direct fs). Read-only. */
  listNotes(input?: ListNotesInput): Promise<Note[]>;
  /** Append one event. Append-only; never rewrites earlier lines. */
  appendEvent(input: Event): Promise<AppendEventResult>;
  /**
   * Propose an L2 distilled note from L1/L0 source notes. Read-only: returns a
   * proposal scaffold for a human/skill to fill; writes nothing.
   */
  proposeDistillation(input: ProposeDistillationInput): Promise<DistillationProposal>;
  /**
   * Accept a (human-confirmed) distillation proposal: write exactly one L2
   * `distilled` note and emit one `distillation_accepted` memory event. Never
   * touches L0 raw and never mutates the L1 sources.
   */
  acceptDistillation(proposal: DistillationProposal): Promise<DistillationResult>;
}

/** Design-level documentation of each operation's required scope + possible errors. */
export interface OperationContract {
  readonly scope: PermissionScope;
  readonly errors: readonly InterfaceErrorCode[];
  readonly readOnly: boolean;
}

export const OPERATION_CONTRACTS: Readonly<Record<keyof CoreOperations, OperationContract>> = {
  capture: {
    scope: "write:capture",
    errors: ["validation_failed", "duplicate_id", "io_error"],
    readOnly: false,
  },
  getNote: {
    scope: "read:notes",
    errors: ["not_found", "scope_denied", "io_error"],
    readOnly: true,
  },
  listNotes: {
    scope: "read:notes",
    errors: ["scope_denied", "io_error"],
    readOnly: true,
  },
  appendEvent: {
    scope: "append:events",
    errors: ["validation_failed", "io_error"],
    readOnly: false,
  },
  proposeDistillation: {
    scope: "read:notes",
    errors: ["not_found", "scope_denied", "io_error"],
    readOnly: true,
  },
  acceptDistillation: {
    scope: "write:distill",
    errors: ["validation_failed", "not_found", "raw_immutable", "scope_denied", "duplicate_id", "io_error"],
    readOnly: false,
  },
} as const;
