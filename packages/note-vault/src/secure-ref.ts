/**
 * secure_refs pointer primitive (SB-050, privacy_and_security.md pattern).
 * A secure ref is a REFERENCE, never a secret container: a frontmatter-only
 * file under `<workspace>/secure_refs/` holding metadata + an opaque locator
 * into external secure storage. The sensitive bytes never enter the workspace.
 *
 * Hard guarantees:
 *  - the written file is frontmatter ONLY — there is no body parameter and the
 *    writer emits nothing after the closing fence;
 *  - multi-line or oversized metadata is refused (single-line, length-capped —
 *    a pasted document cannot masquerade as metadata);
 *  - exclusive create ({ flag: "wx" }) — an existing ref is never overwritten;
 *  - fixed target dir: always `secure_refs/`, never under `vault/`;
 *  - errors never echo the locator/notes values (no leak via messages).
 */
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { SECURE_REF_PATTERN } from "@sb/interfaces";
import { SecureRefError } from "./errors.js";
import { parseFrontmatter } from "./frontmatter.js";

/** Workspace-relative home of secure-ref pointer files (fixed; never vault/). */
export const SECURE_REFS_RELATIVE_DIR = "secure_refs";

const METADATA_MAX_LENGTH = 500;

export interface WriteSecureRefInput {
  /** Absolute path to the workspace root. */
  workspace: string;
  /** Canonical secure-ref id (`secref_…`). */
  id: string;
  /** Document category (metadata only, e.g. identity_document). */
  kind: string;
  /** Opaque pointer into external secure storage — never the content itself. */
  locator: string;
  /** ISO-8601 capture timestamp; defaults to now. */
  capturedAt?: string;
  /** Optional one-line metadata annotation. */
  notes?: string;
}

export interface SecureRefRecord {
  id: string;
  kind: string;
  location: "external";
  locator: string;
  captured_at: string;
  notes?: string;
}

export interface WriteSecureRefResult {
  id: string;
  /** Absolute path of the written pointer file. */
  path: string;
  captured_at: string;
}

export interface ListSecureRefsResult {
  refs: SecureRefRecord[];
  /** Files under secure_refs/ that do not parse as valid pointers. */
  invalid: Array<{ file: string; reason: string }>;
}

function yamlScalar(value: string): string {
  return JSON.stringify(value);
}

/** Single-line, length-capped metadata — a document paste cannot pass as metadata. */
function assertMetadataField(field: string, value: string, required: boolean): void {
  if (typeof value !== "string" || (required && value.trim().length === 0)) {
    throw new SecureRefError("invalid_field", `${field} must be a non-empty string`);
  }
  if (value.length > METADATA_MAX_LENGTH || value.includes("\n")) {
    // deliberately does NOT echo the value: it may be sensitive material
    throw new SecureRefError(
      "not_a_container",
      `${field} must be single-line metadata (<=${METADATA_MAX_LENGTH} chars) — a secure ref is a reference, never a secret container`,
      { field, length: value.length },
    );
  }
}

/** Write one frontmatter-only secure-ref pointer file. Never stores content. */
export async function writeSecureRef(input: WriteSecureRefInput): Promise<WriteSecureRefResult> {
  const { workspace, id } = input;
  if (typeof workspace !== "string" || workspace.length === 0 || !isAbsolute(workspace)) {
    throw new SecureRefError("unsafe_path", `workspace must be an absolute path: ${String(workspace)}`);
  }
  if (typeof id !== "string" || !SECURE_REF_PATTERN.test(id)) {
    throw new SecureRefError("invalid_id", `id is not a canonical secure-ref id (secref_…): ${String(id)}`, { id });
  }
  assertMetadataField("kind", input.kind, true);
  assertMetadataField("locator", input.locator, true);
  if (input.notes !== undefined) assertMetadataField("notes", input.notes, false);

  const capturedAt =
    input.capturedAt !== undefined && input.capturedAt.length > 0
      ? input.capturedAt
      : new Date().toISOString();
  if (Number.isNaN(Date.parse(capturedAt))) {
    throw new SecureRefError("invalid_field", "capturedAt must be an ISO-8601 timestamp");
  }

  const targetDir = resolve(workspace, SECURE_REFS_RELATIVE_DIR);
  const filePath = join(targetDir, `${id}.md`);

  const lines = [
    "---",
    `id: ${id}`,
    `kind: ${yamlScalar(input.kind)}`,
    "location: external",
    `locator: ${yamlScalar(input.locator)}`,
    `captured_at: ${yamlScalar(capturedAt)}`,
    ...(input.notes !== undefined && input.notes.trim().length > 0
      ? [`notes: ${yamlScalar(input.notes)}`]
      : []),
    "---",
    "", // frontmatter only — nothing after the closing fence
  ];

  await mkdir(targetDir, { recursive: true });
  try {
    await writeFile(filePath, lines.join("\n"), { flag: "wx", encoding: "utf8" });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EEXIST") {
      throw new SecureRefError("already_exists", `secure ref already exists: ${id}`, { id });
    }
    throw new SecureRefError("write_failed", `failed to write secure ref: ${id}`, {
      id,
      cause: code ?? "unknown",
    });
  }

  return { id, path: filePath, captured_at: capturedAt };
}

function toRecord(frontmatter: Record<string, unknown>): SecureRefRecord | string {
  const id = frontmatter["id"];
  if (typeof id !== "string" || !SECURE_REF_PATTERN.test(id)) return "invalid or missing id";
  if (typeof frontmatter["kind"] !== "string" || frontmatter["kind"].length === 0) return "missing kind";
  if (frontmatter["location"] !== "external") return "location must be 'external'";
  if (typeof frontmatter["locator"] !== "string" || frontmatter["locator"].length === 0) return "missing locator";
  const capturedAt = frontmatter["captured_at"];
  const capturedAtString = capturedAt instanceof Date ? capturedAt.toISOString() : capturedAt;
  if (typeof capturedAtString !== "string" || Number.isNaN(Date.parse(capturedAtString))) {
    return "missing/invalid captured_at";
  }
  return {
    id,
    kind: frontmatter["kind"],
    location: "external",
    locator: frontmatter["locator"],
    captured_at: capturedAtString,
    ...(typeof frontmatter["notes"] === "string" ? { notes: frontmatter["notes"] } : {}),
  };
}

/** Read-only: every pointer under secure_refs/, with malformed files reported. */
export async function listSecureRefs(workspace: string): Promise<ListSecureRefsResult> {
  if (typeof workspace !== "string" || workspace.length === 0 || !isAbsolute(workspace)) {
    throw new SecureRefError("unsafe_path", `workspace must be an absolute path: ${String(workspace)}`);
  }
  const dir = resolve(workspace, SECURE_REFS_RELATIVE_DIR);
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".md") && f !== "README.md").sort();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { refs: [], invalid: [] };
    throw new SecureRefError("read_failed", "failed to read secure_refs directory", {
      cause: (err as NodeJS.ErrnoException).code ?? "unknown",
    });
  }

  const refs: SecureRefRecord[] = [];
  const invalid: ListSecureRefsResult["invalid"] = [];
  for (const file of files) {
    let text: string;
    try {
      text = await readFile(join(dir, file), "utf8");
    } catch {
      invalid.push({ file, reason: "unreadable" });
      continue;
    }
    const parsed = parseFrontmatter(text);
    if (!parsed.ok) {
      invalid.push({ file, reason: `frontmatter: ${parsed.reason}` });
      continue;
    }
    if (parsed.body.trim().length > 0) {
      invalid.push({ file, reason: "body must be empty (pointer files carry no content)" });
      continue;
    }
    const record = toRecord(parsed.frontmatter);
    if (typeof record === "string") {
      invalid.push({ file, reason: record });
      continue;
    }
    refs.push(record);
  }
  return { refs, invalid };
}
