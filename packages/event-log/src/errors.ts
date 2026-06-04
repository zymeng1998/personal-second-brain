/**
 * Structured errors for the event-log append path. Callers branch on `code`.
 */

export type EventLogErrorCode = "unsafe_path" | "invalid_event" | "append_failed";

export class EventLogError extends Error {
  readonly code: EventLogErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: EventLogErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "EventLogError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}
