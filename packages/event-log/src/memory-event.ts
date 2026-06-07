/**
 * Memory-event append (SB-025). Appends one schema-valid memory event as a
 * single JSONL line to `<workspace>/events/memory_events.jsonl`. APPEND-ONLY:
 * uses fs append mode, so earlier lines are never rewritten or truncated. The
 * event is validated against event v1 (memory-stream branch) before any bytes
 * are written.
 *
 * Phase 1H appends the two memory kinds the distillation flow needs
 * (`note_created`, `distillation_accepted`); the validator accepts the full
 * memory enum for forward compatibility.
 *
 * Out of scope (per card): projection events; replay; fact events (Phase 2).
 */
import { appendFile, mkdir } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import type { Actor, MemoryEvent, Ulid } from "@sb/interfaces";
import { EventLogError } from "./errors.js";
import { EVENT_SCHEMA_VERSION, validateMemoryEvent } from "./validate-event.js";

/** Workspace-relative path of the memory event stream. */
export const MEMORY_EVENTS_RELATIVE_PATH = join("events", "memory_events.jsonl");

/** Memory kinds the append path emits (subset of the schema's memory enum; widened per story). */
export type AppendableMemoryKind =
  | "note_created"
  | "distillation_accepted"
  | "fact_added"
  | "fact_superseded"
  | "entity_merged";

export interface AppendMemoryEventInput {
  /** Absolute workspace root. */
  workspace: string;
  /** ULID of this event (caller-generated). */
  event_id: string;
  /** Memory kind to append (Phase 1H subset). */
  kind: AppendableMemoryKind;
  /** ULID of the note/fact/entity this event concerns (required). */
  subject_id: string;
  /** ISO-8601 time the change occurred. */
  occurred_at: string;
  /** Who caused it: human | cli | skill:<name> | sidecar:<name>. */
  actor: Actor;
  /** Optional provenance pointer (ULID) — e.g. the L1/L0 origin a distillation derives from. */
  source_ref?: string;
  /** Optional kind-specific payload (domain-neutral). */
  payload?: Record<string, unknown>;
  /** Optional time the event was recorded; defaults to now. */
  recorded_at?: string;
}

export interface AppendMemoryEventResult {
  event_id: Ulid;
  /** Absolute path of the memory event stream. */
  path: string;
  bytesAppended: number;
}

/** Append one validated memory event to the memory stream. Append-only. */
export async function appendMemoryEvent(input: AppendMemoryEventInput): Promise<AppendMemoryEventResult> {
  if (typeof input.workspace !== "string" || input.workspace.length === 0 || !isAbsolute(input.workspace)) {
    throw new EventLogError("unsafe_path", `workspace must be an absolute path: ${String(input.workspace)}`, {
      workspace: input.workspace,
    });
  }

  const event: MemoryEvent = {
    event_id: input.event_id as Ulid,
    stream: "memory",
    kind: input.kind,
    occurred_at: input.occurred_at,
    recorded_at: input.recorded_at ?? new Date().toISOString(),
    actor: input.actor,
    subject_id: input.subject_id as Ulid,
    schema_version: EVENT_SCHEMA_VERSION,
    ...(input.source_ref !== undefined ? { source_ref: input.source_ref as Ulid } : {}),
    ...(input.payload !== undefined ? { payload: input.payload } : {}),
  };

  // Validate against event v1 (memory branch) BEFORE writing — nothing is appended on failure.
  validateMemoryEvent(event);

  const path = join(input.workspace, "events", "memory_events.jsonl");
  const line = `${JSON.stringify(event)}\n`;

  try {
    await mkdir(dirname(path), { recursive: true });
    // appendFile uses flag "a": creates if missing, appends, never truncates.
    await appendFile(path, line, { encoding: "utf8" });
  } catch (err) {
    throw new EventLogError("append_failed", `failed to append memory event: ${path}`, {
      path,
      cause: (err as NodeJS.ErrnoException).code ?? String(err),
    });
  }

  return { event_id: event.event_id, path, bytesAppended: Buffer.byteLength(line, "utf8") };
}
