/**
 * @sb/media-intake entry (EPIC-CORE-013). SB-072 ships the media-reference
 * recorder; the `ingest` CLI (transcript → L0) lands in SB-085. Re-exports the
 * adapter API so the package is importable now.
 */
export { invoke, MEDIA_INTAKE_CALLER } from "./invoke.js";
export type { InvokeResult } from "./invoke.js";
export {
  classifyMediaPointer,
  recordMediaReference,
  MediaRefError,
} from "./media-ref.js";
export type { MediaRefHandle } from "./media-ref.js";
