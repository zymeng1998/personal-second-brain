/**
 * Distilled-note write primitive (SB-024). Creates a curated, **mutable** L2
 * note (`type: distilled`, `layer: 2`) under a non-raw vault folder
 * (default `vault/80_Wiki/` — the documented L2 home, see
 * docs/architecture/memory_layers.md). Unlike L0 raw, L2 notes are editable;
 * this story covers create only (no edit/supersede — later stories).
 *
 * Hard guarantees:
 *  - never writes under `vault/00_Raw/` (reuses the shared `isRawPath` guard);
 *  - never reads or mutates any L1/L0 source file — it only records the origin
 *    id as frontmatter `source_ref` provenance;
 *  - exclusive-create by id ({ flag: "wx" }) so an existing note id is never
 *    silently overwritten.
 *
 * Frontmatter is schema-exact for the `distilled` branch of
 * schemas/markdown/frontmatter.schema.json (v1): requires `title`; this writer
 * additionally requires `source_ref` (the distillation contract's provenance
 * rule, stricter than the schema).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { isUlid } from "@sb/interfaces";
import type { Ulid } from "@sb/interfaces";
import { DistilledNoteWriteError } from "./errors.js";
import { isRawPath } from "./raw-paths.js";

/** Default workspace-relative home for distilled (L2) notes. */
export const DISTILLED_RELATIVE_DIR = join("vault", "80_Wiki");

/** Filename-safe slug: starts alphanumeric, then alphanumerics / `.`/`_`/`-`. No path separators or `..`. */
const SLUG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const SLUG_MAX_LENGTH = 200;

export interface WriteDistilledNoteInput {
  /** Absolute path to the workspace root. */
  workspace: string;
  /** Canonical ULID note id (source of truth; immutable). */
  id: string;
  /** Human-readable title (required for curated L2 notes). */
  title: string;
  /** Markdown body of the distilled note. */
  body: string;
  /** Provenance: id of the L1/L0 origin this note derives from (required). */
  source_ref: string;
  /** ISO-8601 creation timestamp; becomes frontmatter `created`. Defaults to now. */
  createdAt?: string;
  /** Optional tags. */
  tags?: string[];
  /**
   * Optional outgoing link targets (note ids or titles) written as frontmatter
   * `links`. SB-028: the distillation accept path records the non-primary
   * source ids here, so multi-source provenance is reconstructable from the
   * note itself (the schema's single `source_ref` stays the primary origin).
   */
  links?: string[];
  /** Optional human-readable, NON-canonical filename slug. The id never changes. */
  slug?: string;
  /**
   * Optional workspace-relative target directory (defaults to `vault/80_Wiki/`).
   * Must stay inside the workspace and must NOT resolve under `vault/00_Raw/`.
   */
  dirRelative?: string;
}

export interface WriteDistilledNoteResult {
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

function buildFrontmatter(input: WriteDistilledNoteInput, created: string): string {
  const lines: string[] = ["---"];
  lines.push(`id: ${input.id}`);
  lines.push("type: distilled");
  lines.push("layer: 2");
  lines.push(`title: ${yamlScalar(input.title)}`);
  lines.push(`created: ${yamlScalar(created)}`);
  lines.push(`source_ref: ${input.source_ref}`);
  if (input.tags !== undefined && input.tags.length > 0) {
    lines.push("tags:");
    for (const tag of input.tags) lines.push(`  - ${yamlScalar(tag)}`);
  }
  const links = input.links !== undefined ? [...new Set(input.links)] : [];
  if (links.length > 0) {
    lines.push("links:");
    for (const link of links) lines.push(`  - ${yamlScalar(link)}`);
  }
  lines.push("---");
  return lines.join("\n");
}

/**
 * Write one L2 distilled note. Validates inputs, refuses any target under
 * `00_Raw/`, creates the target folder if needed, and writes `<id>.md`
 * (or `<id>--<slug>.md`) without ever overwriting an existing id.
 */
export async function writeDistilledNote(
  input: WriteDistilledNoteInput,
): Promise<WriteDistilledNoteResult> {
  const { workspace, id, title, body, source_ref, slug } = input;

  if (typeof id !== "string" || !isUlid(id)) {
    throw new DistilledNoteWriteError("invalid_ulid", `id is not a canonical ULID: ${String(id)}`, { id });
  }
  if (typeof workspace !== "string" || workspace.length === 0 || !isAbsolute(workspace)) {
    throw new DistilledNoteWriteError(
      "unsafe_path",
      `workspace must be an absolute path: ${String(workspace)}`,
      { workspace },
    );
  }
  if (typeof title !== "string" || title.trim().length === 0) {
    throw new DistilledNoteWriteError("missing_title", "a distilled (L2) note requires a non-empty title");
  }
  if (source_ref === undefined || source_ref === null || source_ref === "") {
    throw new DistilledNoteWriteError(
      "missing_source_ref",
      "a distilled (L2) note requires a source_ref to its L1/L0 origin",
    );
  }
  if (typeof source_ref !== "string" || !isUlid(source_ref)) {
    throw new DistilledNoteWriteError(
      "invalid_ulid",
      `source_ref is not a canonical ULID: ${String(source_ref)}`,
      { source_ref },
    );
  }
  if (typeof body !== "string") {
    throw new DistilledNoteWriteError("missing_title", "body must be a string");
  }
  if (slug !== undefined && (slug.length > SLUG_MAX_LENGTH || !SLUG_PATTERN.test(slug))) {
    throw new DistilledNoteWriteError("unsafe_path", `slug is not filename-safe: ${String(slug)}`, { slug });
  }
  if (
    input.links !== undefined &&
    (!Array.isArray(input.links) || !input.links.every((l) => typeof l === "string" && l.length > 0))
  ) {
    throw new DistilledNoteWriteError(
      "invalid_links",
      "links must be an array of non-empty strings (note ids or titles)",
      { links: input.links },
    );
  }

  const dirRelative = input.dirRelative ?? DISTILLED_RELATIVE_DIR;
  const targetDir = resolve(workspace, dirRelative);

  // The target directory must stay inside the workspace (no traversal escape).
  const rel = relative(resolve(workspace), targetDir);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new DistilledNoteWriteError(
      "unsafe_path",
      `target directory escapes the workspace: ${dirRelative}`,
      { dirRelative },
    );
  }

  const filename = slug !== undefined ? `${id}--${slug}.md` : `${id}.md`;
  const filePath = join(targetDir, filename);

  // Never write a distilled note under the immutable L0 raw area.
  if (isRawPath(workspace, filePath)) {
    throw new DistilledNoteWriteError(
      "unsafe_path",
      `refusing to write a distilled note under 00_Raw: ${filePath}`,
      { path: filePath },
    );
  }

  const created = input.createdAt !== undefined && input.createdAt.length > 0
    ? input.createdAt
    : new Date().toISOString();

  await mkdir(targetDir, { recursive: true });

  const data = `${buildFrontmatter(input, created)}\n\n${body}`;

  try {
    // Exclusive create: fails if a note with this id already exists.
    await writeFile(filePath, data, { flag: "wx", encoding: "utf8" });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EEXIST") {
      throw new DistilledNoteWriteError("already_exists", `distilled note already exists: ${filePath}`, {
        path: filePath,
      });
    }
    throw new DistilledNoteWriteError("write_failed", `failed to write distilled note: ${filePath}`, {
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
