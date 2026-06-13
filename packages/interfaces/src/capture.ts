/**
 * Capture request/result. CaptureRequest aligns field-for-field with
 * schemas/json/capture.schema.json (v1). The system assigns the note id;
 * callers never supply it.
 */
import type { Ulid } from "./ids.js";
import type { IsoDateTime } from "./note.js";
import type { MediaReference } from "./media-reference.js";

export type CaptureSource =
  | "paste"
  | "email"
  | "wechat"
  | "ocr"
  | "voice"
  | "clip"
  | "import"
  | "transcript";

export interface CaptureRequest {
  /** Verbatim content stored byte-faithfully in vault/00_Raw/. */
  content: string;
  /** Adapter/source kind. MVP implements `paste` only. */
  source: CaptureSource;
  /** Optional human title; otherwise a slug is derived. */
  title?: string;
  tags?: string[];
  /** Optional external reference (URL, message id). Metadata only. */
  ref?: string;
  /**
   * Optional auditable, non-leaking media provenance (EPIC-CORE-013): set by
   * the media-intake adapter on `source: "transcript"` captures. Never carries
   * a raw locator (see `MediaReference`).
   */
  media?: MediaReference;
  /** Optional client capture time; defaults to now. */
  captured_at?: IsoDateTime;
}

/** Result of a successful capture: the new raw note id, its path, and the emitted event id. */
export interface CaptureResult {
  id: Ulid;
  /** Workspace-relative path of the written raw note. */
  raw_path: string;
  /** event_id of the emitted `captured` event. */
  event_id: Ulid;
}
