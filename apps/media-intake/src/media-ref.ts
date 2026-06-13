/**
 * Media reference recording (SB-072, OQ #39 + amendment B).
 *
 * Turns an original-media pointer (where the source video/audio actually lives)
 * into a citable HANDLE for the transcript capture:
 *  - a non-sensitive pointer ⇒ a plain `ref` (carried as public metadata), or
 *  - a private/signed/token-bearing/ambiguous pointer ⇒ an opaque `secref_…`
 *    (the raw locator goes ONLY inside the secure_ref pointer file, via the
 *    enforced `secref add`; it is never returned, stored in the note/event, or
 *    echoed in output/errors).
 *
 * Private-by-default: a pointer offered as public is FORCED to a secure_ref if
 * it looks signed / token-bearing / like a private local path, and an
 * unclassifiable pointer defaults to private. Only the CLASS is ever surfaced.
 */
import type { MediaRefClass } from "@sb/interfaces";
import { invoke } from "./invoke.js";

export class MediaRefError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "MediaRefError";
    this.code = code;
  }
}

/** The recorded handle the transcript capture cites. Never contains a raw locator. */
export interface MediaRefHandle {
  ref_class: MediaRefClass;
  /** Present iff `ref_class === "public_ref"`. */
  ref?: string;
  /** Present iff `ref_class !== "public_ref"`: a `secref_…` id. */
  secref?: string;
}

// Signed-URL credential params (AWS SigV4 / GCS / Azure SAS / generic).
const SIGNED_URL_RE =
  /[?&](x-amz-(signature|credential|security-token|expires)|signature|expires|sig|se|sv|sp|sr|st|skoid)=/i;
// Token / key / auth params.
const TOKEN_RE = /[?&](token|access_token|id_token|api[_-]?key|apikey|auth|bearer|key|password|secret)=/i;
// Looks like a local filesystem path (absolute POSIX, home, file://, Windows drive).
const PRIVATE_PATH_RE = /^(\/|~\/|file:\/\/|[A-Za-z]:[\\/])/;
// A clean http(s) URL (no detected signed/token params) is acceptable as public.
const HTTP_URL_RE = /^https?:\/\/[^\s]+$/i;

/**
 * Classify a media pointer. `intent` reflects the chosen flag
 * (`--media-ref` ⇒ "public", `--media-secref` ⇒ "private"). Pure: inspects the
 * pointer string only; returns the class. Public intent is OVERRIDDEN to a
 * private class when red flags are present; ambiguous ⇒ private-by-default.
 */
export function classifyMediaPointer(pointer: string, intent: "public" | "private"): MediaRefClass {
  if (typeof pointer !== "string" || pointer.trim().length === 0) {
    throw new MediaRefError("bad_pointer", "media pointer must be a non-empty string");
  }
  const p = pointer.trim();
  if (SIGNED_URL_RE.test(p)) return "signed_url_detected";
  if (TOKEN_RE.test(p)) return "token_detected";
  if (PRIVATE_PATH_RE.test(p)) return "local_private_path";
  if (intent === "public" && HTTP_URL_RE.test(p)) return "public_ref";
  // private intent without a more specific red flag, OR an unclassifiable
  // public pointer → private-by-default.
  return "ambiguous_default_private";
}

/**
 * Record a media pointer and return its handle. For a public classification the
 * pointer is returned as a plain `ref`; for any private classification the
 * pointer is written to a secure_ref via the enforced dispatch and only the
 * `secref_…` id is returned. The raw pointer never leaves this function for a
 * private classification (not returned, not logged).
 */
export async function recordMediaReference(args: {
  pointer: string;
  intent: "public" | "private";
  workspace: string;
  kind?: string;
}): Promise<MediaRefHandle> {
  const refClass = classifyMediaPointer(args.pointer, args.intent);
  if (refClass === "public_ref") {
    return { ref_class: refClass, ref: args.pointer.trim() };
  }
  // private: stash the opaque locator inside a secure_ref via secref add.
  const result = await invoke([
    "secref",
    "add",
    "--kind",
    args.kind ?? "media",
    "--locator",
    args.pointer,
    "--workspace",
    args.workspace,
  ]);
  if (result.exitCode !== 0) {
    // pass the structured envelope through (e.g. scope_denied) — locator is not in stderr
    throw new MediaRefError("secref_failed", result.stderr.trim());
  }
  const parsed = JSON.parse(result.stdout) as { id: string };
  return { ref_class: refClass, secref: parsed.id };
}
