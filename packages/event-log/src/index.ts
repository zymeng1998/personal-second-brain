/**
 * @sb/event-log — append-only JSONL event store (audit + replay spine).
 * SB-014 ships the capture-event append path only.
 */
export { appendCaptureEvent, CAPTURE_EVENTS_RELATIVE_PATH } from "./capture-event.js";
export type { AppendCaptureEventInput, AppendCaptureEventResult } from "./capture-event.js";
export { validateCaptureEvent } from "./validate-event.js";
export { EventLogError } from "./errors.js";
export type { EventLogErrorCode } from "./errors.js";
