/**
 * SB-091 — client working note via `note promote` (broker, `write:notes`).
 *
 * Reuses the enforced `note promote` (NO new writer path) to seed an editable
 * L1 working note in `00_Inbox` from a captured L0 client note, so the client
 * note enters the existing capture → distill / review flow. The L0 origin is
 * recorded as the working note's `source_ref` and is never mutated.
 */
import { invoke } from "./index.js";
import type { AppResult } from "./index.js";

export interface PromoteClientResult extends AppResult {
  /** The new L1 working note id on success. */
  note_id?: string;
  /** The L0 origin recorded as the working note's source_ref. */
  source_ref?: string;
}

/**
 * Promote a captured L0 client note to an L1 working note via the enforced
 * dispatch. Returns the broker dispatch result plus the new note id + origin.
 */
export async function promoteClient(
  workspace: string,
  l0Id: string,
  title?: string,
): Promise<PromoteClientResult> {
  const argv = [
    "note", "promote", l0Id,
    ...(title !== undefined && title.length > 0 ? ["--title", title] : []),
    "--workspace", workspace,
  ];
  const result = await invoke(argv);
  if (result.exitCode !== 0) return result;
  const parsed = JSON.parse(result.stdout) as { note_id: string; source_ref: string };
  return { ...result, note_id: parsed.note_id, source_ref: parsed.source_ref };
}
