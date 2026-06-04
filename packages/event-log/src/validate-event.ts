/**
 * Focused runtime validator for a capture event, enforcing the v1 envelope
 * rules from schemas/json/event.schema.json (capture-stream branch). Kept
 * dependency-free and aligned field-for-field with the schema; an event must
 * pass this before it is appended to the log.
 */
import { isUlid } from "@sb/interfaces";
import type { CaptureEvent } from "@sb/interfaces";
import { EventLogError } from "./errors.js";

const ACTOR_PATTERN = /^(human|cli|skill:[a-z0-9][a-z0-9-]*|sidecar:[a-z0-9][a-z0-9-]*)$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

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
