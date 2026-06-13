/**
 * SB-090 — client-preference capture (broker, `write:capture`).
 *
 * Reads a LOCAL artifact (a pasted client chat export or a manual client note)
 * read-only with guardrails (extension allowlist, media-binary denylist, size
 * cap, must-be-a-file) and routes the verbatim text through the enforced
 * `capture` op as `domain-app:broker` → an immutable L0 raw note
 * (`source:"import"`). No new note type, no broker schema — generic capture.
 *
 * The original artifact is never mutated; the broker never reads a media
 * binary. Property media stays with `apps/media-intake` (OQ #46).
 */
import { readFile, stat } from "node:fs/promises";
import { extname } from "node:path";
import { invoke } from "./index.js";
import type { AppResult } from "./index.js";

const ALLOWED_EXT = new Set([".md", ".txt"]);
// Refused outright — the broker captures text only, never a media binary.
const MEDIA_BINARY_EXT = new Set([
  ".mov", ".mp4", ".m4v", ".m4a", ".wav", ".mp3", ".aac", ".flac",
  ".avi", ".mkv", ".webm", ".mpg", ".mpeg", ".wma", ".ogg", ".opus",
  ".png", ".jpg", ".jpeg", ".heic", ".gif", ".pdf",
]);
const MAX_ARTIFACT_BYTES = 1 * 1024 * 1024;

/** A generic, domain-neutral tag so client notes are findable without a core type. */
export const CLIENT_NOTE_TAG = "client-intake";

export type CaptureClientErrorCode =
  | "bad_arguments"
  | "refused_binary"
  | "bad_extension"
  | "not_found"
  | "too_large"
  | "empty";

export class CaptureClientError extends Error {
  readonly code: CaptureClientErrorCode;
  constructor(code: CaptureClientErrorCode, message: string) {
    super(message);
    this.name = "CaptureClientError";
    this.code = code;
  }
}

export interface CaptureClientArgs {
  workspace: string;
  /** Path to a local `.md`/`.txt` artifact (chat export or manual note). */
  file?: string;
  /** Inline text alternative (e.g. a small pasted snippet). */
  text?: string;
  /** Optional human title for the L0 note. */
  title?: string;
}

export interface CaptureClientResult extends AppResult {
  /** The L0 raw note id on success. */
  note_id?: string;
}

/** Read a local artifact file with the binary/extension/size/path guardrails. */
async function readArtifact(file: string): Promise<string> {
  const ext = extname(file).toLowerCase();
  if (MEDIA_BINARY_EXT.has(ext)) {
    throw new CaptureClientError(
      "refused_binary",
      `refusing to read a media binary (${ext}); client notes are text only — use apps/media-intake for media`,
    );
  }
  if (!ALLOWED_EXT.has(ext)) {
    throw new CaptureClientError("bad_extension", `artifact must be .md or .txt (got ${ext || "no extension"})`);
  }
  let info;
  try {
    info = await stat(file);
  } catch {
    throw new CaptureClientError("not_found", `artifact not found: ${file}`);
  }
  if (!info.isFile()) throw new CaptureClientError("not_found", `artifact is not a file: ${file}`);
  if (info.size > MAX_ARTIFACT_BYTES) {
    throw new CaptureClientError("too_large", `artifact exceeds ${MAX_ARTIFACT_BYTES} bytes`);
  }
  return readFile(file, "utf8");
}

/**
 * Capture a client note (from a file or inline text) as an L0 raw note via the
 * enforced dispatch. Returns the broker dispatch result plus the new note id.
 */
export async function captureClientNote(args: CaptureClientArgs): Promise<CaptureClientResult> {
  let content: string;
  if (args.file !== undefined) {
    content = await readArtifact(args.file);
  } else if (typeof args.text === "string") {
    content = args.text;
  } else {
    throw new CaptureClientError("bad_arguments", "provide --file <path> or --text <content>");
  }
  if (content.trim().length === 0) {
    throw new CaptureClientError("empty", "client note has no text content");
  }

  const argv = [
    "capture",
    "--content", content,
    "--source", "import",
    "--tag", CLIENT_NOTE_TAG,
    ...(args.title !== undefined && args.title.length > 0 ? ["--title", args.title] : []),
    "--workspace", args.workspace,
  ];
  const result = await invoke(argv);
  if (result.exitCode !== 0) return result;
  const note_id = (JSON.parse(result.stdout) as { note_id: string }).note_id;
  return { ...result, note_id };
}
