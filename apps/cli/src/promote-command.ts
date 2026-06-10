/**
 * `note promote` command core (SB-029). Promotes one L0 raw note into an
 * editable **L1 working** note under `vault/00_Inbox/` (Capture→Organize):
 * the working note's body is seeded from the raw content and its frontmatter
 * `source_ref` points at the L0 origin. The raw source is NEVER mutated —
 * this gives `distill propose` real candidates end-to-end.
 */
import { frontmatterOf, getNote, writeWorkingNote } from "@sb/note-vault";
import { ulid } from "@sb/interfaces";
import { CaptureCliError, resolveSafeWorkspace } from "./capture-command.js";

export type PromoteCliErrorCode = "bad_arguments" | "not_raw";

export class PromoteCliError extends Error {
  readonly code: PromoteCliErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: PromoteCliErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "PromoteCliError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

export interface PromoteOptions {
  /** ULID of the L0 raw note to promote. */
  id: string;
  /** Optional title override (defaults to the raw note's title, if any). */
  title?: string;
  /** Absolute workspace override; else SECOND_BRAIN_WORKSPACE / .env. */
  workspace?: string;
  /** Injected timestamp (tests); defaults to now. */
  now?: string;
  /** Injected repo root (tests). */
  repoRoot?: string;
}

export interface PromoteResult {
  ok: true;
  note_id: string;
  /** Absolute path of the written L1 working note. */
  note_path: string;
  /** The L0 origin recorded as the working note's source_ref. */
  source_ref: string;
  created_at: string;
}

/** Strip the frontmatter block; return the body that follows it. */
function bodyOf(content: string): string {
  if (!content.startsWith("---\n")) return content;
  const end = content.indexOf("\n---", 4);
  if (end === -1) return content;
  const afterFence = content.indexOf("\n", end + 1);
  return afterFence === -1 ? "" : content.slice(afterFence + 1).replace(/^\n+/, "");
}

/** Promote an L0 raw note to a new L1 working note. Never mutates the source. */
export async function runNotePromote(opts: PromoteOptions): Promise<PromoteResult> {
  if (typeof opts.id !== "string" || opts.id.length === 0) {
    throw new CaptureCliError("bad_arguments", "note promote requires a raw note <id>");
  }
  const workspace = resolveSafeWorkspace(opts.workspace, opts.repoRoot);

  const source = await getNote(workspace, opts.id); // read-only; throws not_found
  const frontmatter = frontmatterOf(source.content);
  if (frontmatter["type"] !== "raw") {
    throw new PromoteCliError(
      "not_raw",
      `note promote only promotes L0 raw notes; ${opts.id} has type '${String(frontmatter["type"])}'`,
      { id: opts.id, type: frontmatter["type"] },
    );
  }

  const title = opts.title ?? (typeof frontmatter["title"] === "string" ? frontmatter["title"] : undefined);
  const createdAt = opts.now ?? new Date().toISOString();

  const result = await writeWorkingNote({
    workspace,
    id: ulid(),
    source_ref: opts.id,
    body: bodyOf(source.content),
    createdAt,
    ...(title !== undefined && title.length > 0 ? { title } : {}),
  });

  return {
    ok: true,
    note_id: result.id,
    note_path: result.path,
    source_ref: opts.id,
    created_at: result.created,
  };
}
