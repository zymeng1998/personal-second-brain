/**
 * Working-note write primitive (SB-029). Creates an editable **L1 working**
 * note (`type: working`, `layer: 1`) under `vault/00_Inbox/` (the documented
 * L1 processing queue, see docs/architecture/memory_layers.md) — the
 * Capture→Organize step that gives `distill propose` real candidates.
 *
 * Hard guarantees (mirror the L2 writer):
 *  - never writes under `vault/00_Raw/` (shared `isRawPath` guard);
 *  - never reads or mutates the L0 source — it only records the origin id as
 *    the schema-required frontmatter `source_ref`;
 *  - exclusive-create by id ({ flag: "wx" }) — an existing id is never overwritten.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { isUlid } from "@sb/interfaces";
import type { Ulid } from "@sb/interfaces";
import { WorkingNoteWriteError } from "./errors.js";
import { isRawPath } from "./raw-paths.js";

/** Default workspace-relative home for working (L1) notes. */
export const WORKING_RELATIVE_DIR = join("vault", "00_Inbox");

const SLUG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const SLUG_MAX_LENGTH = 200;

export interface WriteWorkingNoteInput {
  /** Absolute path to the workspace root. */
  workspace: string;
  /** Canonical ULID note id (immutable). */
  id: string;
  /** Provenance: id of the L0 raw origin (schema-required for working notes). */
  source_ref: string;
  /** Markdown body (typically seeded from the raw content for editing). */
  body: string;
  /** Optional human-readable title. */
  title?: string;
  /** ISO-8601 creation timestamp; defaults to now. */
  createdAt?: string;
  /** Optional tags. */
  tags?: string[];
  /** Optional NON-canonical filename slug. */
  slug?: string;
  /** Optional workspace-relative target dir (defaults to `vault/00_Inbox/`). */
  dirRelative?: string;
}

export interface WriteWorkingNoteResult {
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

function buildFrontmatter(input: WriteWorkingNoteInput, created: string): string {
  const lines: string[] = ["---"];
  lines.push(`id: ${input.id}`);
  lines.push("type: working");
  lines.push("layer: 1");
  if (input.title !== undefined && input.title.trim().length > 0) {
    lines.push(`title: ${yamlScalar(input.title)}`);
  }
  lines.push(`created: ${yamlScalar(created)}`);
  lines.push(`source_ref: ${input.source_ref}`);
  if (input.tags !== undefined && input.tags.length > 0) {
    lines.push("tags:");
    for (const tag of input.tags) lines.push(`  - ${yamlScalar(tag)}`);
  }
  lines.push("---");
  return lines.join("\n");
}

/**
 * Write one L1 working note. Validates inputs, refuses any target under
 * `00_Raw/`, and writes `<id>.md` (or `<id>--<slug>.md`) without overwriting.
 */
export async function writeWorkingNote(
  input: WriteWorkingNoteInput,
): Promise<WriteWorkingNoteResult> {
  const { workspace, id, source_ref, slug } = input;

  if (typeof id !== "string" || !isUlid(id)) {
    throw new WorkingNoteWriteError("invalid_ulid", `id is not a canonical ULID: ${String(id)}`, { id });
  }
  if (typeof workspace !== "string" || workspace.length === 0 || !isAbsolute(workspace)) {
    throw new WorkingNoteWriteError(
      "unsafe_path",
      `workspace must be an absolute path: ${String(workspace)}`,
      { workspace },
    );
  }
  if (source_ref === undefined || source_ref === null || source_ref === "") {
    throw new WorkingNoteWriteError(
      "missing_source_ref",
      "a working (L1) note requires a source_ref to its L0 origin",
    );
  }
  if (typeof source_ref !== "string" || !isUlid(source_ref)) {
    throw new WorkingNoteWriteError(
      "invalid_ulid",
      `source_ref is not a canonical ULID: ${String(source_ref)}`,
      { source_ref },
    );
  }
  if (typeof input.body !== "string") {
    throw new WorkingNoteWriteError("invalid_body", "body must be a string");
  }
  if (slug !== undefined && (slug.length > SLUG_MAX_LENGTH || !SLUG_PATTERN.test(slug))) {
    throw new WorkingNoteWriteError("unsafe_path", `slug is not filename-safe: ${String(slug)}`, { slug });
  }

  const dirRelative = input.dirRelative ?? WORKING_RELATIVE_DIR;
  const targetDir = resolve(workspace, dirRelative);

  const rel = relative(resolve(workspace), targetDir);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new WorkingNoteWriteError(
      "unsafe_path",
      `target directory escapes the workspace: ${dirRelative}`,
      { dirRelative },
    );
  }

  const filename = slug !== undefined ? `${id}--${slug}.md` : `${id}.md`;
  const filePath = join(targetDir, filename);

  if (isRawPath(workspace, filePath)) {
    throw new WorkingNoteWriteError(
      "unsafe_path",
      `refusing to write a working note under 00_Raw: ${filePath}`,
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
      throw new WorkingNoteWriteError("already_exists", `working note already exists: ${filePath}`, {
        path: filePath,
      });
    }
    throw new WorkingNoteWriteError("write_failed", `failed to write working note: ${filePath}`, {
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
