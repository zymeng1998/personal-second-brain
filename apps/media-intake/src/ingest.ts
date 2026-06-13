/**
 * Transcript ingest → L0 (SB-085, amendment A).
 *
 * Reads a transcript TEXT file (never a media binary) and routes it through the
 * enforced `capture` op as `source:"transcript"`, carrying an auditable,
 * non-leaking media-reference block. STRICT idempotency on `media_id`:
 *  - same media_id + same transcript hash + same media-ref fingerprint ⇒ no-op
 *    (reports the existing note, ZERO writes);
 *  - same media_id with a different transcript hash OR media reference ⇒
 *    `media_id_conflict`, ZERO writes.
 * The idempotency/conflict check runs BEFORE any secref mint or capture, so a
 * conflict or no-op performs no writes at all.
 */
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { MEDIA_ID_PATTERN } from "@sb/interfaces";
import type { MediaReference } from "@sb/interfaces";
import { invoke } from "./invoke.js";
import { recordMediaReference } from "./media-ref.js";
import { normalizeTimedTranscript } from "./normalize.js";

export class IngestError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "IngestError";
    this.code = code;
  }
}

const ALLOWED_TRANSCRIPT_EXT = new Set([".md", ".txt", ".srt", ".vtt"]);
// Refused outright — the core never reads a media binary.
const MEDIA_BINARY_EXT = new Set([
  ".mov", ".mp4", ".m4v", ".m4a", ".wav", ".mp3", ".aac", ".flac",
  ".avi", ".mkv", ".webm", ".mpg", ".mpeg", ".wma", ".ogg", ".opus",
]);
const MAX_TRANSCRIPT_BYTES = 5 * 1024 * 1024;

export interface IngestArgs {
  workspace: string;
  /** `<dir>/transcript.md` + media_id = basename(dir). */
  artifactDir?: string;
  /** Explicit transcript file (with `mediaId`). */
  transcript?: string;
  mediaId?: string;
  /** Original-media pointer + intent (exactly one of these is required). */
  mediaRef?: string;
  mediaSecref?: string;
  title?: string;
  /**
   * SB-086: also seed an L1 working note in 00_Inbox (reuses the enforced
   * `note promote`) so the transcript enters the capture → distill / review
   * flow. Only promotes on a FRESH ingest; an idempotent no-op never duplicates.
   */
  review?: boolean;
}

export interface IngestResult {
  ok: true;
  idempotent: boolean;
  note_id: string;
  media_id: string;
  /** The L1 working note id, when `review` promoted one (fresh ingest only). */
  working_note_id?: string;
}

function sha256hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function frontmatterOf(noteText: string): string {
  if (!noteText.startsWith("---\n")) return "";
  const end = noteText.indexOf("\n---", 3);
  return end === -1 ? "" : noteText.slice(4, end);
}

interface ExistingMedia {
  id: string;
  transcript_sha256?: string;
  media_ref_fp?: string;
}

/** Resolve the transcript path + media_id from the two input modes. */
function resolveSource(args: IngestArgs): { transcriptPath: string; mediaId: string } {
  if (args.artifactDir !== undefined) {
    const mediaId = basename(args.artifactDir.replace(/[/\\]+$/, ""));
    return { transcriptPath: join(args.artifactDir, "transcript.md"), mediaId };
  }
  if (args.transcript !== undefined && args.mediaId !== undefined) {
    return { transcriptPath: args.transcript, mediaId: args.mediaId };
  }
  throw new IngestError(
    "bad_arguments",
    "provide --artifact-dir <dir>, or --transcript <file> with --media-id <hash>",
  );
}

/** Read the transcript text with the binary/extension/size/path guardrails. */
async function readTranscript(transcriptPath: string): Promise<string> {
  const ext = extname(transcriptPath).toLowerCase();
  if (MEDIA_BINARY_EXT.has(ext)) {
    throw new IngestError("refused_binary", `refusing to read a media binary (${ext}); transcripts are text only`);
  }
  if (!ALLOWED_TRANSCRIPT_EXT.has(ext)) {
    throw new IngestError("bad_extension", `transcript must be .md or .txt (got ${ext || "no extension"})`);
  }
  let info;
  try {
    info = await stat(transcriptPath);
  } catch {
    throw new IngestError("not_found", `transcript not found: ${transcriptPath}`);
  }
  if (!info.isFile()) throw new IngestError("not_found", `transcript is not a file: ${transcriptPath}`);
  if (info.size > MAX_TRANSCRIPT_BYTES) {
    throw new IngestError("too_large", `transcript exceeds ${MAX_TRANSCRIPT_BYTES} bytes`);
  }
  const raw = await readFile(transcriptPath, "utf8");
  // SB-088: timed-caption formats are normalized to prose BEFORE capture
  // (no timestamps in the note body); the captured content is the prose.
  let text = raw;
  if (ext === ".srt" || ext === ".vtt") {
    try {
      text = normalizeTimedTranscript(raw, ext === ".srt" ? "srt" : "vtt");
    } catch (e) {
      throw new IngestError("bad_transcript", e instanceof Error ? e.message : "could not normalize transcript");
    }
  }
  if (text.trim().length === 0) throw new IngestError("empty_transcript", "transcript has no text content");
  return text;
}

/** Scan existing raw notes (via the enforced dispatch) for one carrying this media_id. */
async function findExistingByMediaId(workspace: string, mediaId: string): Promise<ExistingMedia | undefined> {
  const list = await invoke(["note", "list", "--type", "raw", "--workspace", workspace]);
  if (list.exitCode !== 0) throw new IngestError("scan_failed", list.stderr.trim());
  const ids = list.stdout
    .split("\n")
    .map((line) => line.split("\t")[0]?.trim() ?? "")
    .filter((id) => id.length > 0);
  for (const id of ids) {
    const got = await invoke(["note", "get", id, "--workspace", workspace]);
    if (got.exitCode !== 0) continue;
    const fm = frontmatterOf(got.stdout);
    const idMatch = /\bmedia_id:\s*"([^"]+)"/.exec(fm);
    if (idMatch?.[1] === mediaId) {
      const sha = /\btranscript_sha256:\s*"([^"]+)"/.exec(fm)?.[1];
      const fp = /\bmedia_ref_fp:\s*"([^"]+)"/.exec(fm)?.[1];
      return {
        id,
        ...(sha !== undefined ? { transcript_sha256: sha } : {}),
        ...(fp !== undefined ? { media_ref_fp: fp } : {}),
      };
    }
  }
  return undefined;
}

export async function runIngest(args: IngestArgs): Promise<IngestResult> {
  const { transcriptPath, mediaId } = resolveSource(args);
  if (!MEDIA_ID_PATTERN.test(mediaId)) {
    throw new IngestError("bad_media_id", `media_id must match ${MEDIA_ID_PATTERN} (got "${mediaId}")`);
  }
  const intent: "public" | "private" =
    args.mediaRef !== undefined ? "public" : args.mediaSecref !== undefined ? "private" : "public";
  const pointer = args.mediaRef ?? args.mediaSecref;
  if (pointer === undefined) {
    throw new IngestError("bad_arguments", "provide --media-ref <pointer> (public) or --media-secref <pointer> (private)");
  }
  if (args.mediaRef !== undefined && args.mediaSecref !== undefined) {
    throw new IngestError("bad_arguments", "use only one of --media-ref / --media-secref");
  }

  const text = await readTranscript(transcriptPath);
  const transcriptSha = sha256hex(text);
  const mediaRefFp = sha256hex(pointer.trim());

  // STRICT idempotency / conflict — BEFORE any write (no secref mint, no capture).
  const existing = await findExistingByMediaId(args.workspace, mediaId);
  if (existing !== undefined) {
    if (existing.transcript_sha256 === transcriptSha && existing.media_ref_fp === mediaRefFp) {
      return { ok: true, idempotent: true, note_id: existing.id, media_id: mediaId };
    }
    throw new IngestError(
      "media_id_conflict",
      `media_id ${mediaId} already ingested with a different transcript or media reference; nothing was written`,
    );
  }

  // Fresh ingest: record the media reference (mints a secref for private), then capture.
  const handle = await recordMediaReference({ pointer, intent, workspace: args.workspace });
  const media: MediaReference = {
    media_id: mediaId,
    transcript_sha256: transcriptSha,
    ref_class: handle.ref_class,
    media_ref_fp: mediaRefFp,
    ...(handle.ref !== undefined ? { ref: handle.ref } : {}),
    ...(handle.secref !== undefined ? { secref: handle.secref } : {}),
  };
  const argv = ["capture", "--source", "transcript", "--content", text];
  if (args.title !== undefined) argv.push("--title", args.title);
  argv.push("--media", JSON.stringify(media), "--workspace", args.workspace);
  const captured = await invoke(argv);
  if (captured.exitCode !== 0) throw new IngestError("capture_failed", captured.stderr.trim());
  const noteId = (JSON.parse(captured.stdout) as { note_id: string }).note_id;

  if (args.review === true) {
    // Reuse the enforced `note promote` (no new writer): L0 → L1 working note
    // in 00_Inbox, citing the L0 as source_ref. The transcript thus enters the
    // existing capture → distill / review flow; the L0 is never mutated.
    const promoted = await invoke(["note", "promote", noteId, "--workspace", args.workspace]);
    if (promoted.exitCode !== 0) throw new IngestError("promote_failed", promoted.stderr.trim());
    const workingId = (JSON.parse(promoted.stdout) as { note_id: string }).note_id;
    return { ok: true, idempotent: false, note_id: noteId, media_id: mediaId, working_note_id: workingId };
  }
  return { ok: true, idempotent: false, note_id: noteId, media_id: mediaId };
}
