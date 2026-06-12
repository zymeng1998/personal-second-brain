/**
 * @sb/interfaces — the stable boundary (v0).
 * TypeScript types + operation contracts aligned to the JSON schemas. Domain-neutral.
 * Nothing here implements behavior; implementations depend on these contracts.
 */
export type { Ulid, SecureRef } from "./ids.js";
export { ULID_PATTERN, SECURE_REF_PATTERN, isUlid } from "./ids.js";
export { ulid } from "./ulid.js";

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

export type {
  Confidence,
  Fact,
  AddFactInput,
  SupersedeFactInput,
  FactFilter,
} from "./fact.js";

export type {
  EntityNode,
  EntityEdge,
  Task,
  ProjectionName,
  RebuildProjectionsInput,
  RebuildProjectionsResult,
} from "./projection.js";

export type {
  IndexType,
  QueryMode,
  ChunkId,
  IndexVaultInput,
  IndexVaultResult,
  QueryFilters,
  QueryMemoryInput,
  RetrievalHit,
  QueryMemoryResult,
  SidecarRequest,
  SidecarError,
  SidecarResponse,
} from "./retrieval.js";

export type {
  ProposalWorkflow,
  FactProposalItem,
  OutputProposalItem,
  WorkflowProposal,
  ExtractFactsProposal,
  ComposeOutputProposal,
  ComposeOutputInput,
  ComposeOutputResult,
} from "./proposals.js";

export type { PermissionScope, CapabilityGrant } from "./scope.js";
export { ALWAYS_DENIED_SCOPES, grantAllows } from "./scope.js";
export { grantFor } from "./grants.js";
export { enforceScope, ScopeDeniedError } from "./enforce.js";

export type {
  DomainAppId,
  GrantableScope,
  GrantConfigEntry,
  GrantConfig,
  GrantConfigInvalidReason,
} from "./grant-config.js";
export {
  DOMAIN_APP_ID_PATTERN,
  SCOPED_READ_NOTES_PATTERN,
  GRANTABLE_SCOPES,
  GrantConfigError,
  parseGrantConfig,
  loadGrantConfig,
  EMPTY_GRANT_CONFIG,
  GRANT_CONFIG_RELATIVE_PATH,
} from "./grant-config.js";

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
