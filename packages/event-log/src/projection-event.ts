/**
 * Projection-event append (SB-038). Appends one schema-valid projection event as
 * a single JSONL line to `<workspace>/events/projection_events.jsonl`. APPEND-ONLY.
 * Projection events record disposable L3/L4 state changes (rebuilds/resets) and
 * may be vault-wide (`subject_id` optional). Validated before any bytes are written.
 */
import { appendFile, mkdir } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import type { Actor, ProjectionEvent, Ulid } from "@sb/interfaces";
import { EventLogError } from "./errors.js";
import { EVENT_SCHEMA_VERSION, validateProjectionEvent } from "./validate-event.js";

/** Workspace-relative path of the projection event stream. */
export const PROJECTION_EVENTS_RELATIVE_PATH = join("events", "projection_events.jsonl");

/** Projection kinds the append path emits. */
export type AppendableProjectionKind = "indexed" | "projection_rebuilt" | "projection_reset";

export interface AppendProjectionEventInput {
  /** Absolute workspace root. */
  workspace: string;
  /** ULID of this event (caller-generated). */
  event_id: string;
  /** Projection kind. */
  kind: AppendableProjectionKind;
  /** ISO-8601 time the change occurred. */
  occurred_at: string;
  /** Who caused it: human | cli | skill:<name> | sidecar:<name>. */
  actor: Actor;
  /** Optional subject (projection events may be vault-wide). */
  subject_id?: string;
  /** Optional kind-specific payload (e.g. rebuild counts). */
  payload?: Record<string, unknown>;
  /** Optional time the event was recorded; defaults to now. */
  recorded_at?: string;
}

export interface AppendProjectionEventResult {
  event_id: Ulid;
  /** Absolute path of the projection event stream. */
  path: string;
  bytesAppended: number;
}

/** Append one validated projection event to the projection stream. Append-only. */
export async function appendProjectionEvent(
  input: AppendProjectionEventInput,
): Promise<AppendProjectionEventResult> {
  if (typeof input.workspace !== "string" || input.workspace.length === 0 || !isAbsolute(input.workspace)) {
    throw new EventLogError("unsafe_path", `workspace must be an absolute path: ${String(input.workspace)}`, {
      workspace: input.workspace,
    });
  }

  const event: ProjectionEvent = {
    event_id: input.event_id as Ulid,
    stream: "projection",
    kind: input.kind,
    occurred_at: input.occurred_at,
    recorded_at: input.recorded_at ?? new Date().toISOString(),
    actor: input.actor,
    schema_version: EVENT_SCHEMA_VERSION,
    ...(input.subject_id !== undefined ? { subject_id: input.subject_id as Ulid } : {}),
    ...(input.payload !== undefined ? { payload: input.payload } : {}),
  };

  validateProjectionEvent(event);

  const path = join(input.workspace, "events", "projection_events.jsonl");
  const line = `${JSON.stringify(event)}\n`;

  try {
    await mkdir(dirname(path), { recursive: true });
    await appendFile(path, line, { encoding: "utf8" });
  } catch (err) {
    throw new EventLogError("append_failed", `failed to append projection event: ${path}`, {
      path,
      cause: (err as NodeJS.ErrnoException).code ?? String(err),
    });
  }

  return { event_id: event.event_id, path, bytesAppended: Buffer.byteLength(line, "utf8") };
}
