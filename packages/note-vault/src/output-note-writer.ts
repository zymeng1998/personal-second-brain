/**
 * Output-note write primitive (SB-058). Creates an **L5 generated output**
 * note (`type: output`, `layer: 5`) under `vault/60_Outputs/`. L5 outputs
 * MUST cite their sources (docs/architecture/memory_layers.md): the schema
 * requires a `title` and a non-empty `sources` list, and this writer enforces
 * both before touching the filesystem.
 *
 * Hard guarantees (mirror the L1/L2 writers):
 *  - never writes under `vault/00_Raw/` (shared `isRawPath` guard);
 *  - exclusive-create by id ({ flag: "wx" }) — an existing id is never overwritten;
 *  - validation failure writes nothing.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { isUlid } from "@sb/interfaces";
import type { Ulid } from "@sb/interfaces";
import { OutputNoteWriteError } from "./errors.js";
import { isRawPath } from "./raw-paths.js";

/** Default workspace-relative home for generated output (L5) notes. */
export const OUTPUTS_RELATIVE_DIR = join("vault", "60_Outputs");

const SLUG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const SLUG_MAX_LENGTH = 200;

export interface WriteOutputNoteInput {
  /** Absolute path to the workspace root. */
  workspace: string;
  /** Canonical ULID note id (immutable). */
  id: string;
  /** Human title (schema-required for output notes). */
  title: string;
  /** Provenance the output cites (note/fact ids or links). Non-empty (schema-required). */
  sources: string[];
  /** Markdown body (the generated output). */
  body: string;
  /** ISO-8601 creation timestamp; defaults to now. */
  createdAt?: string;
  /** Optional tags. */
  tags?: string[];
  /** Optional NON-canonical filename slug. */
  slug?: string;
  /** Optional workspace-relative target dir (defaults to `vault/60_Outputs/`). */
  dirRelative?: string;
}

export interface WriteOutputNoteResult {
  id: Ulid;
  /** Absolute path of the written file. */
  path: string;
  /** The frontmatter `created` timestamp that was written. */
  created: string;
  bytesWritten: number;
}

function yamlScalar(value: string): string {
  return JSON.stringify(value);
}

function buildFrontmatter(input: WriteOutputNoteInput, created: string): string {
  const lines: string[] = ["---"];
  lines.push(`id: ${input.id}`);
  lines.push("type: output");
  lines.push("layer: 5");
  lines.push(`title: ${yamlScalar(input.title)}`);
  lines.push(`created: ${yamlScalar(created)}`);
  lines.push("sources:");
  for (const source of input.sources) lines.push(`  - ${yamlScalar(source)}`);
  if (input.tags !== undefined && input.tags.length > 0) {
    lines.push("tags:");
    for (const tag of input.tags) lines.push(`  - ${yamlScalar(tag)}`);
  }
  lines.push("---");
  return lines.join("\n");
}

/**
 * Write one L5 output note. Validates title + non-empty sources, refuses any
 * target under `00_Raw/`, and writes `<id>.md` (or `<id>--<slug>.md`) without
 * overwriting.
 */
export async function writeOutputNote(input: WriteOutputNoteInput): Promise<WriteOutputNoteResult> {
  const { workspace, id, slug } = input;

  if (typeof id !== "string" || !isUlid(id)) {
    throw new OutputNoteWriteError("invalid_ulid", `id is not a canonical ULID: ${String(id)}`, { id });
  }
  if (typeof workspace !== "string" || workspace.length === 0 || !isAbsolute(workspace)) {
    throw new OutputNoteWriteError(
      "unsafe_path",
      `workspace must be an absolute path: ${String(workspace)}`,
      { workspace },
    );
  }
  if (typeof input.title !== "string" || input.title.trim().length === 0) {
    throw new OutputNoteWriteError("invalid_title", "an output (L5) note requires a non-empty title");
  }
  if (
    !Array.isArray(input.sources) ||
    input.sources.length === 0 ||
    input.sources.some((s) => typeof s !== "string" || s.trim().length === 0)
  ) {
    throw new OutputNoteWriteError(
      "missing_sources",
      "an output (L5) note must cite at least one non-empty source",
      { sources: input.sources },
    );
  }
  if (typeof input.body !== "string") {
    throw new OutputNoteWriteError("invalid_body", "body must be a string");
  }
  if (slug !== undefined && (slug.length > SLUG_MAX_LENGTH || !SLUG_PATTERN.test(slug))) {
    throw new OutputNoteWriteError("unsafe_path", `slug is not filename-safe: ${String(slug)}`, { slug });
  }

  const dirRelative = input.dirRelative ?? OUTPUTS_RELATIVE_DIR;
  const targetDir = resolve(workspace, dirRelative);

  const rel = relative(resolve(workspace), targetDir);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new OutputNoteWriteError(
      "unsafe_path",
      `target directory escapes the workspace: ${dirRelative}`,
      { dirRelative },
    );
  }

  const filename = slug !== undefined ? `${id}--${slug}.md` : `${id}.md`;
  const filePath = join(targetDir, filename);

  if (isRawPath(workspace, filePath)) {
    throw new OutputNoteWriteError(
      "unsafe_path",
      `refusing to write an output note under 00_Raw: ${filePath}`,
      { path: filePath },
    );
  }

  const created = input.createdAt !== undefined && input.createdAt.length > 0
    ? input.createdAt
    : new Date().toISOString();

  await mkdir(targetDir, { recursive: true });

  const data = `${buildFrontmatter(input, created)}\n\n${input.body}`;

  try {
    await writeFile(filePath, data, { flag: "wx", encoding: "utf8" });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EEXIST") {
      throw new OutputNoteWriteError("already_exists", `output note already exists: ${filePath}`, {
        path: filePath,
      });
    }
    throw new OutputNoteWriteError("write_failed", `failed to write output note: ${filePath}`, {
      path: filePath,
      cause: code ?? String(err),
    });
  }

  return {
    id: id as Ulid,
    path: filePath,
    created,
    bytesWritten: Buffer.byteLength(data, "utf8"),
  };
}
