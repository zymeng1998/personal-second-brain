/**
 * Event envelope. Aligns field-for-field with schemas/json/event.schema.json (v1).
 * Append-only: events are never rewritten; corrections are new events. The
 * discriminated union on `stream` encodes the per-stream `kind` sets.
 */
import type { Ulid } from "./ids.js";
import type { IsoDateTime } from "./note.js";

export type Stream = "capture" | "memory" | "projection";

export type CaptureKind = "captured";

export type MemoryKind =
  | "note_created"
  | "note_updated"
  | "fact_added"
  | "fact_superseded"
  | "entity_merged"
  | "distillation_accepted";

export type ProjectionKind = "indexed" | "projection_rebuilt" | "projection_reset";

/** Who caused an event. Never silent/anonymous. */
export type Actor = "human" | "cli" | `skill:${string}` | `sidecar:${string}`;

interface EventBase {
  event_id: Ulid;
  occurred_at: IsoDateTime;
  actor: Actor;
  recorded_at?: IsoDateTime;
  source_ref?: Ulid;
  schema_version?: string;
  payload?: Record<string, unknown>;
}

/** capture events concern a single subject (the raw note id). */
export interface CaptureEvent extends EventBase {
  stream: "capture";
  kind: CaptureKind;
  subject_id: Ulid;
}

/** memory events concern a single subject (note/fact/entity id). */
export interface MemoryEvent extends EventBase {
  stream: "memory";
  kind: MemoryKind;
  subject_id: Ulid;
}

/** projection events may be vault-wide (subject optional). */
export interface ProjectionEvent extends EventBase {
  stream: "projection";
  kind: ProjectionKind;
  subject_id?: Ulid;
}

export type Event = CaptureEvent | MemoryEvent | ProjectionEvent;
