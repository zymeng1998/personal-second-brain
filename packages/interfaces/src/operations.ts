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
import type { AddFactInput, Fact, FactFilter, SupersedeFactInput } from "./fact.js";
import type { Ulid } from "./ids.js";
import type { Layer, Note, NoteType } from "./note.js";
import type { ComposeOutputInput, ComposeOutputResult } from "./proposals.js";
import type { RebuildProjectionsInput, RebuildProjectionsResult } from "./projection.js";
import type {
  IndexVaultInput,
  IndexVaultResult,
  QueryMemoryInput,
  QueryMemoryResult,
} from "./retrieval.js";
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
  /**
   * Add a new L3 fact (ADD-only). Appends a `fact_added` memory event (source of
   * truth) and projects it into the fact-store. Provenance + confidence required.
   */
  addFact(input: AddFactInput): Promise<Fact>;
  /**
   * Supersede an existing fact with a corrected one (ADD-only): appends a
   * `fact_superseded` event + a new fact referencing the old via `supersedes`.
   * The superseded fact row is never mutated.
   */
  supersedeFact(input: SupersedeFactInput): Promise<Fact>;
  /** List current (non-superseded) facts. Read-only. */
  listFacts(filter?: FactFilter): Promise<Fact[]>;
  /**
   * Rebuild the L3 projections (facts/entities/tasks) from the event log (+
   * L0–L2). `db/` is disposable; emits a `projection_rebuilt` event. Deterministic.
   */
  rebuildProjections(input?: RebuildProjectionsInput): Promise<RebuildProjectionsResult>;
  /**
   * Build the L4 retrieval indexes (`indexes/retrieval.duckdb`) from the vault
   * via the Python sidecar. The vault is read-only to the sidecar; writes go
   * only under `indexes/` (disposable/rebuildable). On success the TS caller
   * appends one `indexed` projection event — the sidecar never writes events.
   */
  indexVault(input: IndexVaultInput): Promise<IndexVaultResult>;
  /**
   * Query the L4 retrieval indexes (lexical/vector/hybrid). Read-only: returns
   * ranked references with provenance; writes nothing, emits no events.
   */
  queryMemory(input: QueryMemoryInput): Promise<QueryMemoryResult>;
  /**
   * Write one human-confirmed L5 output note (`vault/60_Outputs/`) citing its
   * sources (non-empty; note-id sources resolved first — OQ #24), then append
   * one TS-emitted `note_created` memory event. Never auto-invoked: the caller
   * is an accept step over a reviewed proposal (`proposal.schema.json`).
   */
  composeOutput(input: ComposeOutputInput): Promise<ComposeOutputResult>;
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
  addFact: {
    scope: "write:facts",
    errors: ["validation_failed", "scope_denied", "duplicate_id", "io_error"],
    readOnly: false,
  },
  supersedeFact: {
    scope: "write:facts",
    errors: ["validation_failed", "not_found", "scope_denied", "duplicate_id", "io_error"],
    readOnly: false,
  },
  listFacts: {
    scope: "read:facts",
    errors: ["scope_denied", "io_error"],
    readOnly: true,
  },
  rebuildProjections: {
    scope: "rebuild:projections",
    errors: ["validation_failed", "io_error"],
    readOnly: false,
  },
  indexVault: {
    scope: "write:index",
    errors: ["validation_failed", "scope_denied", "io_error"],
    readOnly: false,
  },
  queryMemory: {
    scope: "read:index",
    errors: ["validation_failed", "scope_denied", "io_error"],
    readOnly: true,
  },
  composeOutput: {
    scope: "write:outputs",
    errors: ["validation_failed", "not_found", "scope_denied", "duplicate_id", "io_error"],
    readOnly: false,
  },
} as const;
