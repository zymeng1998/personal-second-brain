/**
 * @sb/event-log — append-only JSONL event store (audit + replay spine).
 * SB-014: capture-event append. SB-025: memory-event append.
 */
export { appendCaptureEvent, CAPTURE_EVENTS_RELATIVE_PATH } from "./capture-event.js";
export type { AppendCaptureEventInput, AppendCaptureEventResult } from "./capture-event.js";
export { appendMemoryEvent, MEMORY_EVENTS_RELATIVE_PATH } from "./memory-event.js";
export type {
  AppendMemoryEventInput,
  AppendMemoryEventResult,
  AppendableMemoryKind,
} from "./memory-event.js";
export { appendProjectionEvent, PROJECTION_EVENTS_RELATIVE_PATH } from "./projection-event.js";
export type {
  AppendProjectionEventInput,
  AppendProjectionEventResult,
  AppendableProjectionKind,
} from "./projection-event.js";
export { readMemoryEvents } from "./read-events.js";
export { validateCaptureEvent, validateMemoryEvent, validateProjectionEvent } from "./validate-event.js";
export { EventLogError } from "./errors.js";
export type { EventLogErrorCode } from "./errors.js";
