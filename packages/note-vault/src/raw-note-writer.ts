/**
 * Raw note write primitive (SB-011). Safely creates an immutable L0 raw Markdown
 * note under `<workspace>/vault/00_Raw/`. This is the low-level write contract;
 * higher-level orchestration (inbox stub, capture event, CLI) is intentionally
 * NOT here — see SB-012 (immutability guard), SB-014 (events), SB-013 (CLI).
 *
 * The file is created with exclusive semantics ({ flag: "wx" }) so an existing
 * file is never overwritten. Body content is written verbatim (byte-faithful);
 * the writer never rewrites it.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { isUlid } from "@sb/interfaces";
import type { Ulid } from "@sb/interfaces";
import { RawNoteWriteError } from "./errors.js";
import { rawDir, rawNotePath } from "./raw-paths.js";

/**
 * Capture source kinds. Mirrors the `source` enum in
 * schemas/json/capture.schema.json (and `CaptureSource` in @sb/interfaces),
 * kept here as a runtime list for validation. Domain-neutral.
 */
export type RawSourceKind =
  | "paste"
  | "email"
  | "wechat"
  | "ocr"
  | "voice"
  | "clip"
  | "import"
  | "transcript";

export const RAW_SOURCE_KINDS: readonly RawSourceKind[] = [
  "paste",
  "email",
  "wechat",
  "ocr",
  "voice",
  "clip",
  "import",
  "transcript",
];

/**
 * Auditable, non-leaking media provenance written into a transcript L0 note's
 * `media:` frontmatter block (EPIC-CORE-013). Mirrors `MediaReference` in
 * `@sb/interfaces`; carries no raw locator by construction.
 */
export interface RawMediaReference {
  media_id: string;
  transcript_sha256: string;
  ref_class: string;
  ref?: string;
  secref?: string;
}

/** Filename-safe slug: starts alphanumeric, then alphanumerics / `.`/`_`/`-`. No path separators or `..`. */
const SLUG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const SLUG_MAX_LENGTH = 200;

export interface WriteRawNoteInput {
  /** Absolute path to the workspace root (the file goes to `<workspace>/vault/00_Raw/`). */
  workspace: string;
  /** Canonical ULID note id (source of truth; immutable). */
  id: string;
  /** Verbatim raw content stored byte-faithfully in the note body. */
  content: string;
  /** Capture source kind (see RAW_SOURCE_KINDS). */
  source: RawSourceKind;
  /** ISO-8601 captured timestamp; becomes frontmatter `created`. */
  createdAt: string;
  /** Optional human title. */
  title?: string;
  /** Optional tags. */
  tags?: string[];
  /** Optional external reference (URL, message id). Metadata only — never sensitive content. */
  ref?: string;
  /** Optional media provenance block (EPIC-CORE-013); written under `media:`. Never a raw locator. */
  media?: RawMediaReference;
  /** Optional human-readable, NON-canonical filename slug. May change later; the id never does. */
  slug?: string;
}

export interface WriteRawNoteResult {
  id: Ulid;
  /** Absolute path of the written file. */
  path: string;
  /** The frontmatter `created` timestamp that was written. */
  created: string;
  bytesWritten: number;
}

/** Serialize a string as a double-quoted YAML scalar (handles colons, Unicode, quotes, newlines). */
function yamlScalar(value: string): string {
  return JSON.stringify(value);
}

function buildFrontmatter(input: WriteRawNoteInput): string {
  const lines: string[] = ["---"];
  lines.push(`id: ${input.id}`);
  lines.push("type: raw");
  lines.push("layer: 0");
  if (input.title !== undefined) lines.push(`title: ${yamlScalar(input.title)}`);
  lines.push(`created: ${yamlScalar(input.createdAt)}`);
  lines.push("source:");
  lines.push(`  kind: ${yamlScalar(input.source)}`);
  if (input.ref !== undefined) lines.push(`  ref: ${yamlScalar(input.ref)}`);
  if (input.media !== undefined) {
    const media = input.media;
    lines.push("media:");
    lines.push(`  media_id: ${yamlScalar(media.media_id)}`);
    lines.push(`  transcript_sha256: ${yamlScalar(media.transcript_sha256)}`);
    lines.push(`  ref_class: ${yamlScalar(media.ref_class)}`);
    if (media.ref !== undefined) lines.push(`  ref: ${yamlScalar(media.ref)}`);
    if (media.secref !== undefined) lines.push(`  secref: ${yamlScalar(media.secref)}`);
  }
  if (input.tags !== undefined && input.tags.length > 0) {
    lines.push("tags:");
    for (const tag of input.tags) lines.push(`  - ${yamlScalar(tag)}`);
  }
  lines.push("---");
  return lines.join("\n");
}

/**
 * Write one immutable L0 raw note. Validates inputs, creates `vault/00_Raw/` if
 * needed, and writes `<id>.md` (or `<id>--<slug>.md`) without ever overwriting.
 */
export async function writeRawNote(input: WriteRawNoteInput): Promise<WriteRawNoteResult> {
  const { workspace, id, content, source, createdAt, slug } = input;

  if (typeof id !== "string" || !isUlid(id)) {
    throw new RawNoteWriteError("invalid_ulid", `id is not a canonical ULID: ${String(id)}`, { id });
  }
  if (typeof workspace !== "string" || workspace.length === 0 || !isAbsolute(workspace)) {
    throw new RawNoteWriteError("unsafe_path", `workspace must be an absolute path: ${String(workspace)}`, {
      workspace,
    });
  }
  if (typeof content !== "string") {
    throw new RawNoteWriteError("invalid_content", "content must be a string");
  }
  if (typeof createdAt !== "string" || createdAt.length === 0) {
    throw new RawNoteWriteError("invalid_content", "createdAt must be a non-empty ISO-8601 string");
  }
  if (!RAW_SOURCE_KINDS.includes(source)) {
    throw new RawNoteWriteError("invalid_source", `unknown source kind: ${String(source)}`, { source });
  }
  if (slug !== undefined && (slug.length > SLUG_MAX_LENGTH || !SLUG_PATTERN.test(slug))) {
    throw new RawNoteWriteError("invalid_slug", `slug is not filename-safe: ${String(slug)}`, { slug });
  }

  const filePath = rawNotePath(workspace, id, slug);

  // Ensure the target directory exists (idempotent; never touches existing files).
  await mkdir(rawDir(workspace), { recursive: true });

  // Verbatim body: frontmatter, one blank line, then the exact content (no trailing rewrite).
  const data = `${buildFrontmatter(input)}\n\n${content}`;

  try {
    // Exclusive create: fails if the file already exists — L0 is never overwritten.
    await writeFile(filePath, data, { flag: "wx", encoding: "utf8" });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EEXIST") {
      throw new RawNoteWriteError("already_exists", `raw note already exists: ${filePath}`, { path: filePath });
    }
    throw new RawNoteWriteError("write_failed", `failed to write raw note: ${filePath}`, {
      path: filePath,
      cause: code ?? String(err),
    });
  }

  return {
    id: id as Ulid,
    path: filePath,
    created: createdAt,
    bytesWritten: Buffer.byteLength(data, "utf8"),
  };
}
