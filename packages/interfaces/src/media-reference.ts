/**
 * Media-reference provenance for transcript intake (SB-070, EPIC-CORE-013).
 *
 * A `MediaReference` is the AUDITABLE, NON-LEAKING provenance block that rides
 * on a transcript capture (note frontmatter = the queryable idempotency/conflict
 * ledger; the capture event carries it for audit). It records:
 *  - `media_id`           — the transcriber's content hash (stable across rename),
 *  - `transcript_sha256`  — sha256 of the captured transcript text (idempotency +
 *                           conflict detection, amendment A),
 *  - `ref_class`          — WHY the original-media pointer was treated public/private
 *                           (amendment B: the class is stored, never the raw locator),
 *  - exactly one handle: `ref` (a non-sensitive public pointer) when
 *    `ref_class === "public_ref"`, else `secref` (a `secref_…` id whose opaque
 *    locator lives only inside the secure_ref pointer file).
 *
 * Mirrors `schemas/markdown/media_reference.schema.json`. The shape is strict
 * (`additionalProperties:false`): a raw URL/path/locator field is UNREPRESENTABLE
 * by construction, so a private locator can never be smuggled into a note or event.
 * The runtime validator below is dependency-free; Ajv stays test-only (parity).
 */
import { SECURE_REF_PATTERN } from "./ids.js";

/** Content-hash id from the transcriber (e.g. `54c63db258a34d84`). Stable, opaque, non-secret. */
export const MEDIA_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

/** Lowercase hex sha256 of the captured transcript text. */
export const TRANSCRIPT_SHA256_PATTERN = /^[a-f0-9]{64}$/;

/**
 * Lowercase hex sha256 of the normalized original-media pointer (amendment A
 * conflict comparator). A ONE-WAY hash — non-reversible, so it carries no
 * locator value (amendment B), yet lets re-ingest detect a changed media
 * reference exactly, even for private (secref) pointers whose locator is opaque.
 */
export const MEDIA_REF_FP_PATTERN = /^[a-f0-9]{64}$/;

/**
 * How the original-media pointer was classified (amendment B). Only the class is
 * ever stored/echoed — never the raw URL/path/locator value.
 * - `public_ref` — a non-sensitive external pointer; carried as a plain `ref`.
 * - `signed_url_detected` / `token_detected` / `local_private_path` — sensitive;
 *   forced to a secure_ref (opaque `secref`).
 * - `ambiguous_default_private` — could not be proven non-sensitive; private-by-default.
 */
export type MediaRefClass =
  | "public_ref"
  | "signed_url_detected"
  | "token_detected"
  | "local_private_path"
  | "ambiguous_default_private";

export const MEDIA_REF_CLASSES: readonly MediaRefClass[] = [
  "public_ref",
  "signed_url_detected",
  "token_detected",
  "local_private_path",
  "ambiguous_default_private",
];

/** Auditable, non-leaking media provenance carried by a transcript capture. */
export interface MediaReference {
  media_id: string;
  transcript_sha256: string;
  ref_class: MediaRefClass;
  /**
   * Optional one-way sha256 of the original-media pointer (conflict comparator).
   * Non-reversible: carries no locator value, but identifies the media reference
   * exactly across re-ingests (including private/secref pointers). Set by the
   * media-intake adapter; absent on non-transcript captures.
   */
  media_ref_fp?: string;
  /** Present iff `ref_class === "public_ref"`: a non-sensitive external pointer. */
  ref?: string;
  /** Present iff `ref_class !== "public_ref"`: a `secref_…` id (opaque locator in the pointer file). */
  secref?: string;
}

/** Input to the media-intake adapter's `ingest` (SB-085 consumes this). */
export interface MediaIngestInput {
  /** Verbatim transcript text to capture as L0. */
  transcript: string;
  media_id: string;
  ref_class: MediaRefClass;
  ref?: string;
  secref?: string;
  title?: string;
  tags?: string[];
}

export type MediaReferenceInvalidReason =
  | "not_object"
  | "unknown_property"
  | "media_id_invalid"
  | "transcript_sha256_invalid"
  | "media_ref_fp_invalid"
  | "ref_class_invalid"
  | "ref_required"
  | "ref_forbidden"
  | "ref_invalid"
  | "secref_required"
  | "secref_forbidden"
  | "secref_invalid";

/**
 * Fail-closed rejection. Audit-friendly + leak-free: names the reason + field
 * only (the block carries no secret values by construction, but we never echo
 * field values regardless).
 */
export class MediaReferenceError extends Error {
  readonly code = "media_reference_invalid";
  readonly details: { reason: MediaReferenceInvalidReason; field: string };

  constructor(reason: MediaReferenceInvalidReason, field: string) {
    super(`media reference invalid: ${reason} at ${field}`);
    this.name = "MediaReferenceError";
    this.details = { reason, field };
  }
}

const isString = (v: unknown): v is string => typeof v === "string";

/**
 * Parse + strictly validate a `MediaReference` (SB-070). Pure; no I/O;
 * dependency-free; mirrors `media_reference.schema.json` exactly, including the
 * class↔handle invariant (public_ref ⇒ `ref` present & `secref` absent; any
 * other class ⇒ `secref` present & `ref` absent). Throws `MediaReferenceError`
 * on any violation. The returned object is frozen.
 */
export function parseMediaReference(value: unknown): MediaReference {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new MediaReferenceError("not_object", "(root)");
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!["media_id", "transcript_sha256", "media_ref_fp", "ref_class", "ref", "secref"].includes(key)) {
      throw new MediaReferenceError("unknown_property", key);
    }
  }
  if (!isString(record.media_id) || !MEDIA_ID_PATTERN.test(record.media_id)) {
    throw new MediaReferenceError("media_id_invalid", "media_id");
  }
  if (!isString(record.transcript_sha256) || !TRANSCRIPT_SHA256_PATTERN.test(record.transcript_sha256)) {
    throw new MediaReferenceError("transcript_sha256_invalid", "transcript_sha256");
  }
  if ("media_ref_fp" in record && (!isString(record.media_ref_fp) || !MEDIA_REF_FP_PATTERN.test(record.media_ref_fp))) {
    throw new MediaReferenceError("media_ref_fp_invalid", "media_ref_fp");
  }
  if (!isString(record.ref_class) || !(MEDIA_REF_CLASSES as readonly string[]).includes(record.ref_class)) {
    throw new MediaReferenceError("ref_class_invalid", "ref_class");
  }
  const refClass = record.ref_class as MediaRefClass;
  const reference: MediaReference = {
    media_id: record.media_id,
    transcript_sha256: record.transcript_sha256,
    ref_class: refClass,
    ...(isString(record.media_ref_fp) ? { media_ref_fp: record.media_ref_fp } : {}),
  };
  if (refClass === "public_ref") {
    if (!("ref" in record)) throw new MediaReferenceError("ref_required", "ref");
    if ("secref" in record) throw new MediaReferenceError("secref_forbidden", "secref");
    if (!isString(record.ref) || record.ref.trim().length === 0) {
      throw new MediaReferenceError("ref_invalid", "ref");
    }
    reference.ref = record.ref;
  } else {
    if (!("secref" in record)) throw new MediaReferenceError("secref_required", "secref");
    if ("ref" in record) throw new MediaReferenceError("ref_forbidden", "ref");
    if (!isString(record.secref) || !SECURE_REF_PATTERN.test(record.secref)) {
      throw new MediaReferenceError("secref_invalid", "secref");
    }
    reference.secref = record.secref;
  }
  return Object.freeze(reference);
}
