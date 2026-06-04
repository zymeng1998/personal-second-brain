/**
 * `capture` command core (SB-013). The first end-to-end path:
 *   CLI input → writeRawNote() (L0 raw note) → appendCaptureEvent() (capture
 *   event) → structured result. Domain-neutral. No list/get, validation,
 *   retrieval, AI, or distillation here.
 *
 * Workspace path-safety reuses `resolveWorkspaceConfig` from the SB-002 helper
 * (absolute / outside-repo / creatable checks); the CLI adds a broad-path guard
 * (reject `/`, single-segment roots, the home dir, and any path containing the repo).
 */
import { homedir } from "node:os";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { RAW_SOURCE_KINDS, writeRawNote } from "@sb/note-vault";
import type { RawSourceKind } from "@sb/note-vault";
import { appendCaptureEvent } from "@sb/event-log";
import {
  resolveWorkspaceConfig,
  WorkspaceConfigError,
  WORKSPACE_ENV_VAR,
} from "../../../scripts/lib/workspace_env.js";
import { ulid } from "./ulid.js";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

export type CaptureCliErrorCode =
  | "bad_arguments"
  | "empty_content"
  | "invalid_source"
  | "unsafe_workspace"
  | "event_append_failed";

export class CaptureCliError extends Error {
  readonly code: CaptureCliErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: CaptureCliErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "CaptureCliError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

export interface CaptureOptions {
  content: string;
  source: string;
  title?: string;
  tags?: string[];
  ref?: string;
  slug?: string;
  /** Absolute workspace override; otherwise SECOND_BRAIN_WORKSPACE / .env is used. */
  workspace?: string;
  /** Injected timestamp (tests); defaults to now. */
  now?: string;
  /** Injected repo root (tests); defaults to the resolved repo root. */
  repoRoot?: string;
}

export interface CaptureCliResult {
  ok: true;
  note_id: string;
  /** Absolute path of the written raw note. */
  note_path: string;
  event_id: string;
  /** Absolute path of the capture event stream. */
  event_path: string;
  captured_at: string;
}

function isInside(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

/** Reject dangerously broad workspaces beyond the base path-safety checks. */
function assertSafeWorkspace(workspace: string, repoRoot: string): void {
  const resolved = resolve(workspace);
  const segments = resolved.split(sep).filter((s) => s.length > 0);
  if (resolved === sep || segments.length < 2) {
    throw new CaptureCliError("unsafe_workspace", `workspace path is too broad/shallow: ${resolved}`, {
      workspace: resolved,
    });
  }
  if (resolved === resolve(homedir())) {
    throw new CaptureCliError("unsafe_workspace", `workspace must not be your home directory: ${resolved}`, {
      workspace: resolved,
    });
  }
  if (isInside(resolved, repoRoot)) {
    throw new CaptureCliError("unsafe_workspace", `workspace must not contain the repository: ${resolved}`, {
      workspace: resolved,
    });
  }
}

function resolveSafeWorkspace(override: string | undefined, repoRoot: string): string {
  let workspace: string;
  try {
    if (override !== undefined) {
      // Reuse the env-based resolver by injecting the override, then restore.
      const previous = process.env[WORKSPACE_ENV_VAR];
      process.env[WORKSPACE_ENV_VAR] = override;
      try {
        workspace = resolveWorkspaceConfig(repoRoot).config.workspace;
      } finally {
        if (previous === undefined) delete process.env[WORKSPACE_ENV_VAR];
        else process.env[WORKSPACE_ENV_VAR] = previous;
      }
    } else {
      workspace = resolveWorkspaceConfig(repoRoot).config.workspace;
    }
  } catch (err) {
    if (err instanceof WorkspaceConfigError) {
      throw new CaptureCliError("unsafe_workspace", err.message);
    }
    throw err;
  }
  assertSafeWorkspace(workspace, repoRoot);
  return workspace;
}

function validateSource(source: string): RawSourceKind {
  if (!(RAW_SOURCE_KINDS as readonly string[]).includes(source)) {
    throw new CaptureCliError(
      "invalid_source",
      `unknown source kind "${source}": expected one of ${RAW_SOURCE_KINDS.join(", ")}`,
      { source },
    );
  }
  return source as RawSourceKind;
}

/** Run one capture: write the raw note, append the capture event, return the result. */
export async function runCapture(opts: CaptureOptions): Promise<CaptureCliResult> {
  const repoRoot = opts.repoRoot ?? REPO_ROOT;

  if (typeof opts.content !== "string" || opts.content.length === 0) {
    throw new CaptureCliError("empty_content", "no content to capture: pass --content <text> or pipe text via stdin");
  }
  const source = validateSource(opts.source);
  const workspace = resolveSafeWorkspace(opts.workspace, repoRoot);

  const noteId = ulid();
  const eventId = ulid();
  const capturedAt = opts.now ?? new Date().toISOString();

  const noteResult = await writeRawNote({
    workspace,
    id: noteId,
    content: opts.content,
    source,
    createdAt: capturedAt,
    ...(opts.title !== undefined ? { title: opts.title } : {}),
    ...(opts.tags !== undefined ? { tags: opts.tags } : {}),
    ...(opts.ref !== undefined ? { ref: opts.ref } : {}),
    ...(opts.slug !== undefined ? { slug: opts.slug } : {}),
  });

  const noteRelPath = relative(workspace, noteResult.path);

  let eventResult;
  try {
    eventResult = await appendCaptureEvent({
      workspace,
      event_id: eventId,
      subject_id: noteId,
      occurred_at: capturedAt,
      actor: "cli",
      payload: {
        note_id: noteId,
        note_path: noteRelPath,
        source,
        ...(opts.title !== undefined ? { title: opts.title } : {}),
        ...(opts.tags !== undefined && opts.tags.length > 0 ? { tags: opts.tags } : {}),
        ...(opts.ref !== undefined ? { ref: opts.ref } : {}),
      },
    });
  } catch (err) {
    // Partial failure: the raw note was written; do NOT delete it. Surface a clear error.
    throw new CaptureCliError(
      "event_append_failed",
      `raw note was written but the capture event failed to append; the raw note was kept (id ${noteId})`,
      { note_id: noteId, note_path: noteResult.path, cause: err instanceof Error ? err.message : String(err) },
    );
  }

  return {
    ok: true,
    note_id: noteId,
    note_path: noteResult.path,
    event_id: eventResult.event_id,
    event_path: eventResult.path,
    captured_at: capturedAt,
  };
}
