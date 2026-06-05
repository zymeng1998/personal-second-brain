/**
 * Focused runtime validators for v1 events, enforcing the envelope rules from
 * schemas/json/event.schema.json (capture-stream and memory-stream branches).
 * Kept dependency-free and aligned field-for-field with the schema; an event
 * must pass the matching validator before it is appended to the log.
 */
import { isUlid } from "@sb/interfaces";
import type { CaptureEvent, MemoryEvent, MemoryKind } from "@sb/interfaces";
import { EventLogError } from "./errors.js";

const ACTOR_PATTERN = /^(human|cli|skill:[a-z0-9][a-z0-9-]*|sidecar:[a-z0-9][a-z0-9-]*)$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

/** The memory-stream `kind` enum, mirroring the schema's memory branch. */
const MEMORY_KINDS: readonly MemoryKind[] = [
  "note_created",
  "note_updated",
  "fact_added",
  "fact_superseded",
  "entity_merged",
  "distillation_accepted",
];

function isIsoDateTime(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function fail(field: string, reason: string): never {
  throw new EventLogError("invalid_event", `${field}: ${reason}`, { field });
}

/** Assert that `event` is a valid v1 capture event. Throws EventLogError("invalid_event") otherwise. */
export function validateCaptureEvent(event: unknown): asserts event is CaptureEvent {
  if (typeof event !== "object" || event === null) {
    fail("event", "must be an object");
  }
  const e = event as Record<string, unknown>;

  if (typeof e["event_id"] !== "string" || !isUlid(e["event_id"])) fail("event_id", "must be a ULID");
  if (e["stream"] !== "capture") fail("stream", 'must be "capture"');
  if (e["kind"] !== "captured") fail("kind", 'must be "captured"');
  if (!isIsoDateTime(e["occurred_at"])) fail("occurred_at", "must be an ISO-8601 date-time");
  if (typeof e["actor"] !== "string" || !ACTOR_PATTERN.test(e["actor"])) {
    fail("actor", "must be human | cli | skill:<name> | sidecar:<name>");
  }
  if (typeof e["subject_id"] !== "string" || !isUlid(e["subject_id"])) {
    fail("subject_id", "must be a ULID (required for capture events)");
  }

  if (e["recorded_at"] !== undefined && !isIsoDateTime(e["recorded_at"])) {
    fail("recorded_at", "must be an ISO-8601 date-time when present");
  }
  if (e["source_ref"] !== undefined && (typeof e["source_ref"] !== "string" || !isUlid(e["source_ref"]))) {
    fail("source_ref", "must be a ULID when present");
  }
  if (e["schema_version"] !== undefined && (typeof e["schema_version"] !== "string" || !SEMVER_PATTERN.test(e["schema_version"]))) {
    fail("schema_version", "must be semver (x.y.z) when present");
  }
  if (e["payload"] !== undefined && (typeof e["payload"] !== "object" || e["payload"] === null || Array.isArray(e["payload"]))) {
    fail("payload", "must be an object when present");
  }
}

/** Validate the optional envelope fields shared by every event stream. */
function validateOptionalEnvelope(e: Record<string, unknown>): void {
  if (e["recorded_at"] !== undefined && !isIsoDateTime(e["recorded_at"])) {
    fail("recorded_at", "must be an ISO-8601 date-time when present");
  }
  if (e["source_ref"] !== undefined && (typeof e["source_ref"] !== "string" || !isUlid(e["source_ref"]))) {
    fail("source_ref", "must be a ULID when present");
  }
  if (e["schema_version"] !== undefined && (typeof e["schema_version"] !== "string" || !SEMVER_PATTERN.test(e["schema_version"]))) {
    fail("schema_version", "must be semver (x.y.z) when present");
  }
  if (e["payload"] !== undefined && (typeof e["payload"] !== "object" || e["payload"] === null || Array.isArray(e["payload"]))) {
    fail("payload", "must be an object when present");
  }
}

/** Assert that `event` is a valid v1 memory event. Throws EventLogError("invalid_event") otherwise. */
export function validateMemoryEvent(event: unknown): asserts event is MemoryEvent {
  if (typeof event !== "object" || event === null) {
    fail("event", "must be an object");
  }
  const e = event as Record<string, unknown>;

  if (typeof e["event_id"] !== "string" || !isUlid(e["event_id"])) fail("event_id", "must be a ULID");
  if (e["stream"] !== "memory") fail("stream", 'must be "memory"');
  if (typeof e["kind"] !== "string" || !MEMORY_KINDS.includes(e["kind"] as MemoryKind)) {
    fail("kind", `must be one of: ${MEMORY_KINDS.join(", ")}`);
  }
  if (!isIsoDateTime(e["occurred_at"])) fail("occurred_at", "must be an ISO-8601 date-time");
  if (typeof e["actor"] !== "string" || !ACTOR_PATTERN.test(e["actor"])) {
    fail("actor", "must be human | cli | skill:<name> | sidecar:<name>");
  }
  if (typeof e["subject_id"] !== "string" || !isUlid(e["subject_id"])) {
    fail("subject_id", "must be a ULID (required for memory events)");
  }

  validateOptionalEnvelope(e);
}
