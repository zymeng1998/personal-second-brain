/**
 * Read-only `note list` / `note get <id>` commands (SB-015). Both call the
 * `@sb/note-vault` read API (no direct fs) and never write to the vault/events.
 * Proves a second consumer reads through the package surface.
 */
import { getNote, listNotes } from "@sb/note-vault";
import type { NoteSummary } from "@sb/note-vault";
import { CaptureCliError, resolveSafeWorkspace } from "./capture-command.js";

export interface NoteListResult {
  ok: true;
  count: number;
  notes: NoteSummary[];
}

export interface NoteGetResult {
  ok: true;
  id: string;
  path: string;
  content: string;
}

export interface NoteListOptions {
  workspace?: string;
  type?: string;
  repoRoot?: string;
}

export interface NoteGetOptions {
  id: string;
  workspace?: string;
  repoRoot?: string;
}

/** List vault notes (read-only). */
export async function runNoteList(opts: NoteListOptions = {}): Promise<NoteListResult> {
  const workspace = resolveSafeWorkspace(opts.workspace, opts.repoRoot);
  const notes = await listNotes(workspace, opts.type !== undefined ? { type: opts.type } : {});
  return { ok: true, count: notes.length, notes };
}

/** Get one note's verbatim content by id (read-only). */
export async function runNoteGet(opts: NoteGetOptions): Promise<NoteGetResult> {
  if (typeof opts.id !== "string" || opts.id.length === 0) {
    throw new CaptureCliError("bad_arguments", "note get requires an <id>");
  }
  const workspace = resolveSafeWorkspace(opts.workspace, opts.repoRoot);
  const note = await getNote(workspace, opts.id);
  return { ok: true, id: note.id, path: note.path, content: note.content };
}
