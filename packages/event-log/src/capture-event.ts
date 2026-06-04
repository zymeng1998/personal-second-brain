/**
 * Capture-event append (SB-014). Appends one schema-valid capture event as a
 * single JSONL line to `<workspace>/events/capture_events.jsonl`. APPEND-ONLY:
 * uses fs append mode, so earlier lines are never rewritten or truncated. The
 * event is validated against event v1 before any bytes are written.
 *
 * Out of scope (per card): memory/projection events; replay.
 */
import { appendFile, mkdir } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import type { Actor, CaptureEvent, Ulid } from "@sb/interfaces";
import { EventLogError } from "./errors.js";
import { validateCaptureEvent } from "./validate-event.js";

/** Workspace-relative path of the capture event stream. */
export const CAPTURE_EVENTS_RELATIVE_PATH = join("events", "capture_events.jsonl");

const EVENT_SCHEMA_VERSION = "1.0.0";

export interface AppendCaptureEventInput {
  /** Absolute workspace root. */
  workspace: string;
  /** ULID of this event (caller-generated). */
  event_id: string;
  /** ULID of the raw note this capture concerns. */
  subject_id: string;
  /** ISO-8601 time the capture occurred. */
  occurred_at: string;
  /** Who caused it: human | cli | skill:<name> | sidecar:<name>. */
  actor: Actor;
  /** Optional provenance pointer (ULID). */
  source_ref?: string;
  /** Optional kind-specific payload (domain-neutral). */
  payload?: Record<string, unknown>;
  /** Optional time the event was recorded; defaults to now. */
  recorded_at?: string;
}

export interface AppendCaptureEventResult {
  event_id: Ulid;
  /** Absolute path of the capture event stream. */
  path: string;
  bytesAppended: number;
}

/** Append one validated capture event to the capture stream. Append-only. */
export async function appendCaptureEvent(input: AppendCaptureEventInput): Promise<AppendCaptureEventResult> {
  if (typeof input.workspace !== "string" || input.workspace.length === 0 || !isAbsolute(input.workspace)) {
    throw new EventLogError("unsafe_path", `workspace must be an absolute path: ${String(input.workspace)}`, {
      workspace: input.workspace,
    });
  }

  const event: CaptureEvent = {
    event_id: input.event_id as Ulid,
    stream: "capture",
    kind: "captured",
    occurred_at: input.occurred_at,
    recorded_at: input.recorded_at ?? new Date().toISOString(),
    actor: input.actor,
    subject_id: input.subject_id as Ulid,
    schema_version: EVENT_SCHEMA_VERSION,
    ...(input.source_ref !== undefined ? { source_ref: input.source_ref as Ulid } : {}),
    ...(input.payload !== undefined ? { payload: input.payload } : {}),
  };

  // Validate against event v1 BEFORE writing — nothing is appended on failure.
  validateCaptureEvent(event);

  const path = join(input.workspace, "events", "capture_events.jsonl");
  const line = `${JSON.stringify(event)}\n`;

  try {
    await mkdir(dirname(path), { recursive: true });
    // appendFile uses flag "a": creates if missing, appends, never truncates.
    await appendFile(path, line, { encoding: "utf8" });
  } catch (err) {
    throw new EventLogError("append_failed", `failed to append capture event: ${path}`, {
      path,
      cause: (err as NodeJS.ErrnoException).code ?? String(err),
    });
  }

  return { event_id: event.event_id, path, bytesAppended: Buffer.byteLength(line, "utf8") };
}
