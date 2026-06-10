/**
 * Read-only note API (SB-015). `listNotes` enumerates vault notes (id/type/title/
 * layer); `getNote` returns one note's raw markdown by id. Strictly read-only —
 * only reads the filesystem, never writes. Targeted frontmatter field-extraction
 * is used (no YAML dependency); `getNote` returns verbatim content so it is
 * correct regardless of frontmatter complexity.
 *
 * Out of scope (per card): search/retrieval (Phase 3); facts query.
 */
import { readFile, readdir } from "node:fs/promises";
import { basename, isAbsolute, join } from "node:path";
import { isUlid } from "@sb/interfaces";
import { NoteReadError } from "./errors.js";

const VAULT_DIR = "vault";
const ULID_PREFIX = /^([0-7][0-9A-HJKMNP-TV-Z]{25})/;

export interface NoteSummary {
  id: string;
  type?: string;
  title?: string;
  layer?: number;
  /** Absolute path of the note file. */
  path: string;
  /** Verbatim file content; present iff requested via `includeContent` (SB-046). */
  content?: string;
}

export interface NoteFile {
  id: string;
  /** Absolute path of the note file. */
  path: string;
  /** Verbatim file content. */
  content: string;
}

export interface ListNotesOptions {
  /** Filter by note type (e.g. "raw"). */
  type?: string;
  /**
   * Attach each note's verbatim content to its summary (SB-046). `listNotes`
   * already reads every file to summarize it; this lets single-pass consumers
   * (projections) avoid a second `getNote` read per note.
   */
  includeContent?: boolean;
}

function assertWorkspace(workspace: string): void {
  if (typeof workspace !== "string" || workspace.length === 0 || !isAbsolute(workspace)) {
    throw new NoteReadError("unsafe_path", `workspace must be an absolute path: ${String(workspace)}`, { workspace });
  }
}

function frontmatterBlock(content: string): string {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  return match ? (match[1] as string) : "";
}

function field(block: string, key: string): string | undefined {
  const match = block.match(new RegExp(`^${key}:[ \\t]*(.+)$`, "m"));
  return match ? (match[1] as string).trim() : undefined;
}

function unquote(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (value.startsWith('"')) {
    try {
      return JSON.parse(value) as string;
    } catch {
      return value;
    }
  }
  return value;
}

function summarize(absPath: string, content: string): NoteSummary {
  const block = frontmatterBlock(content);
  const fileId = ULID_PREFIX.exec(basename(absPath))?.[1];
  const id = fileId ?? field(block, "id") ?? basename(absPath);
  const type = field(block, "type");
  const title = unquote(field(block, "title"));
  const layerRaw = field(block, "layer");
  const layer = layerRaw !== undefined && /^\d+$/.test(layerRaw) ? Number(layerRaw) : undefined;

  const summary: NoteSummary = { id, path: absPath };
  if (type !== undefined) summary.type = type;
  if (title !== undefined) summary.title = title;
  if (layer !== undefined) summary.layer = layer;
  return summary;
}

async function vaultMarkdownFiles(workspace: string): Promise<string[]> {
  const vault = join(workspace, VAULT_DIR);
  let entries: string[];
  try {
    entries = await readdir(vault, { recursive: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw new NoteReadError("read_failed", `failed to read vault: ${vault}`, {
      cause: (err as NodeJS.ErrnoException).code ?? String(err),
    });
  }
  return entries.filter((e) => e.endsWith(".md")).map((e) => join(vault, e));
}

/** List vault notes (sorted by id, which is time-sortable for ULIDs). Read-only. */
export async function listNotes(workspace: string, options: ListNotesOptions = {}): Promise<NoteSummary[]> {
  assertWorkspace(workspace);
  const files = await vaultMarkdownFiles(workspace);
  const summaries: NoteSummary[] = [];
  for (const file of files) {
    const content = await readFile(file, "utf8");
    const summary = summarize(file, content);
    if (options.type !== undefined && summary.type !== options.type) continue;
    if (options.includeContent === true) summary.content = content;
    summaries.push(summary);
  }
  summaries.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return summaries;
}

/** Get one note's verbatim content by id. Read-only. Throws NoteReadError on bad id / not found. */
export async function getNote(workspace: string, id: string): Promise<NoteFile> {
  assertWorkspace(workspace);
  if (typeof id !== "string" || !isUlid(id)) {
    throw new NoteReadError("invalid_ulid", `id is not a canonical ULID: ${String(id)}`, { id });
  }
  const files = await vaultMarkdownFiles(workspace);
  const match = files.find((file) => basename(file).startsWith(id));
  if (match === undefined) {
    throw new NoteReadError("not_found", `no note found for id ${id}`, { id });
  }
  const content = await readFile(match, "utf8");
  return { id, path: match, content };
}
