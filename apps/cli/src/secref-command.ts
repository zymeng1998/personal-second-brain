/**
 * `sb secref` command core (SB-067) — the CLI surface for the secure_refs
 * pointer pattern: record a metadata-only pointer to a sensitive document in
 * EXTERNAL secure storage (`secref add`), and list pointers (`secref list`).
 * The document bytes never enter the workspace; stdout echoes audit metadata
 * (id/kind/path/captured_at) but never the locator value.
 */
import { listSecureRefs, writeSecureRef } from "@sb/note-vault";
import type { ListSecureRefsResult } from "@sb/note-vault";
import { ulid } from "@sb/interfaces";
import { resolveSafeWorkspace } from "./capture-command.js";

export type SecrefCliErrorCode = "bad_arguments";

export class SecrefCliError extends Error {
  readonly code: SecrefCliErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: SecrefCliErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "SecrefCliError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

export interface SecrefAddOptions {
  /** Document category (metadata, e.g. identity_document). */
  kind: string;
  /** Opaque pointer into external secure storage — never the content. */
  locator: string;
  /** Optional one-line metadata annotation. */
  notes?: string;
  /** Optional explicit id (`secref_…`); defaults to `secref_<ULID>`. */
  id?: string;
  /** Injected timestamp (tests); defaults to now. */
  now?: string;
  workspace?: string;
  repoRoot?: string;
}

export interface SecrefAddResult {
  ok: true;
  /** Audit metadata only — the locator is deliberately NOT echoed. */
  id: string;
  kind: string;
  path: string;
  captured_at: string;
}

/** Record one metadata-only secure-ref pointer. */
export async function runSecrefAdd(opts: SecrefAddOptions): Promise<SecrefAddResult> {
  if (typeof opts.kind !== "string" || opts.kind.trim().length === 0) {
    throw new SecrefCliError("bad_arguments", "secref add requires --kind <category>");
  }
  if (typeof opts.locator !== "string" || opts.locator.trim().length === 0) {
    throw new SecrefCliError("bad_arguments", "secref add requires --locator <opaque pointer>");
  }
  const workspace = resolveSafeWorkspace(opts.workspace, opts.repoRoot);
  const result = await writeSecureRef({
    workspace,
    id: opts.id ?? `secref_${ulid()}`,
    kind: opts.kind,
    locator: opts.locator,
    ...(opts.notes !== undefined ? { notes: opts.notes } : {}),
    ...(opts.now !== undefined ? { capturedAt: opts.now } : {}),
  });
  return { ok: true, id: result.id, kind: opts.kind, path: result.path, captured_at: result.captured_at };
}

export interface SecrefListOptions {
  workspace?: string;
  repoRoot?: string;
}

/** Read-only: all pointers + any malformed files. */
export async function runSecrefList(
  opts: SecrefListOptions = {},
): Promise<{ ok: true; count: number } & ListSecureRefsResult> {
  const workspace = resolveSafeWorkspace(opts.workspace, opts.repoRoot);
  const list = await listSecureRefs(workspace);
  return { ok: true, count: list.refs.length, ...list };
}
