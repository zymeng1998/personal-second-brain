/**
 * @sb/interfaces — the stable boundary (v0).
 * TypeScript types + operation contracts aligned to the JSON schemas. Domain-neutral.
 * Nothing here implements behavior; implementations depend on these contracts.
 */
export type { Ulid, SecureRef } from "./ids.js";
export { ULID_PATTERN, SECURE_REF_PATTERN, isUlid } from "./ids.js";

export type {
  Layer,
  NoteType,
  IsoDateTime,
  RawFrontmatter,
  WorkingFrontmatter,
  DailyFrontmatter,
  CuratedFrontmatter,
  ProjectFrontmatter,
  OutputFrontmatter,
  NoteFrontmatter,
  Note,
} from "./note.js";

export type {
  Stream,
  CaptureKind,
  MemoryKind,
  ProjectionKind,
  Actor,
  CaptureEvent,
  MemoryEvent,
  ProjectionEvent,
  Event,
} from "./event.js";

export type { CaptureSource, CaptureRequest, CaptureResult } from "./capture.js";

export type {
  ProposeDistillationInput,
  DistillationProposal,
  DistillationResult,
} from "./distillation.js";

export type { PermissionScope, CapabilityGrant } from "./scope.js";
export { ALWAYS_DENIED_SCOPES } from "./scope.js";

export type {
  GetNoteInput,
  NoteFilter,
  ListNotesInput,
  AppendEventResult,
  InterfaceErrorCode,
  InterfaceError,
  CoreOperations,
  OperationContract,
} from "./operations.js";
export { OPERATION_CONTRACTS } from "./operations.js";
