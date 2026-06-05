/**
 * `distill` command core (SB-026). Two subcommands:
 *
 *   distill propose  — READ-ONLY. Lists L1 working-note candidates and returns a
 *                      DistillationProposal *scaffold* for a human/skill to fill.
 *                      Writes nothing.
 *   distill accept   — HUMAN-CONFIRMED WRITE. Consumes a completed proposal JSON,
 *                      generates L2 + event ULIDs, calls writeDistilledNote()
 *                      (SB-024) then appendMemoryEvent('distillation_accepted')
 *                      (SB-025), and returns a structured result.
 *
 * `accept` is the only writing step and is always human-invoked. The LLM that
 * authors the proposal is the skill (SB-027), not this command. Domain-neutral.
 */
import { relative } from "node:path";
import { listNotes, writeDistilledNote } from "@sb/note-vault";
import { appendMemoryEvent } from "@sb/event-log";
import type { DistillationProposal } from "@sb/interfaces";
import { CaptureCliError, resolveSafeWorkspace } from "./capture-command.js";
import { ulid } from "./ulid.js";

export type DistillCliErrorCode = "bad_arguments" | "bad_proposal" | "event_append_failed";

export class DistillCliError extends Error {
  readonly code: DistillCliErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: DistillCliErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "DistillCliError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

export interface ProposeOptions {
  /** Absolute workspace override; else SECOND_BRAIN_WORKSPACE / .env. */
  workspace?: string;
  /** Max candidates to list (bounds an unbounded scan). */
  limit?: number;
  /** Injected repo root (tests). */
  repoRoot?: string;
}

export interface DistillCandidate {
  id: string;
  title?: string;
}

export interface ProposeResult {
  ok: true;
  /** L1 working-note candidates to distill from. */
  candidates: DistillCandidate[];
  /** A blank proposal scaffold for the skill/human to complete, then feed to `accept`. */
  proposal: DistillationProposal;
}

export interface AcceptOptions {
  /** The completed proposal (parsed from --file/stdin JSON). */
  proposal: unknown;
  workspace?: string;
  /** Injected timestamp (tests); defaults to now. */
  now?: string;
  repoRoot?: string;
}

export interface AcceptResult {
  ok: true;
  note_id: string;
  /** Absolute path of the written L2 distilled note. */
  note_path: string;
  event_id: string;
  /** Absolute path of the memory event stream. */
  event_path: string;
  /** The primary origin id recorded as the note's source_ref. */
  source_ref: string;
  /** All origin ids the proposal derived from (recorded in the event payload). */
  source_ids: string[];
  created_at: string;
}

/** Propose distillation: list L1 candidates + emit a scaffold. READ-ONLY. */
export async function runDistillPropose(opts: ProposeOptions = {}): Promise<ProposeResult> {
  const workspace = resolveSafeWorkspace(opts.workspace, opts.repoRoot);
  const working = await listNotes(workspace, { type: "working" });
  const limited = opts.limit !== undefined && opts.limit >= 0 ? working.slice(0, opts.limit) : working;

  const candidates: DistillCandidate[] = limited.map((n) => ({
    id: n.id,
    ...(n.title !== undefined ? { title: n.title } : {}),
  }));

  // A blank scaffold: the skill fills source_ids/title/body/tags/rationale, then `accept` consumes it.
  const proposal: DistillationProposal = {
    source_ids: [],
    title: "",
    body: "",
    tags: [],
    rationale: "",
  };

  return { ok: true, candidates, proposal };
}

/** Narrow an unknown parsed JSON value to a valid DistillationProposal, or throw. */
function validateProposal(value: unknown): DistillationProposal {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new DistillCliError("bad_proposal", "proposal must be a JSON object");
  }
  const p = value as Record<string, unknown>;

  if (!Array.isArray(p["source_ids"]) || p["source_ids"].length === 0) {
    throw new DistillCliError("bad_proposal", "proposal.source_ids must be a non-empty array of note ids");
  }
  const sourceIds = p["source_ids"];
  if (!sourceIds.every((s) => typeof s === "string" && s.length > 0)) {
    throw new DistillCliError("bad_proposal", "proposal.source_ids must contain non-empty string ids");
  }
  if (typeof p["title"] !== "string" || p["title"].trim().length === 0) {
    throw new DistillCliError("bad_proposal", "proposal.title must be a non-empty string");
  }
  if (typeof p["body"] !== "string") {
    throw new DistillCliError("bad_proposal", "proposal.body must be a string");
  }
  if (p["rationale"] !== undefined && typeof p["rationale"] !== "string") {
    throw new DistillCliError("bad_proposal", "proposal.rationale must be a string when present");
  }
  if (p["tags"] !== undefined) {
    if (!Array.isArray(p["tags"]) || !p["tags"].every((t) => typeof t === "string" && t.length > 0)) {
      throw new DistillCliError("bad_proposal", "proposal.tags must be an array of non-empty strings");
    }
  }

  return {
    source_ids: sourceIds as string[] as DistillationProposal["source_ids"],
    title: p["title"],
    body: p["body"],
    ...(p["tags"] !== undefined ? { tags: p["tags"] as string[] } : {}),
    rationale: typeof p["rationale"] === "string" ? p["rationale"] : "",
  };
}

/** Accept a human-confirmed proposal: write one L2 note + append one memory event. */
export async function runDistillAccept(opts: AcceptOptions): Promise<AcceptResult> {
  const proposal = validateProposal(opts.proposal);
  const workspace = resolveSafeWorkspace(opts.workspace, opts.repoRoot);

  const noteId = ulid();
  const eventId = ulid();
  const createdAt = opts.now ?? new Date().toISOString();
  const sourceIds = [...proposal.source_ids] as unknown as string[];
  const primarySourceRef = sourceIds[0] as string;

  const noteResult = await writeDistilledNote({
    workspace,
    id: noteId,
    title: proposal.title,
    body: proposal.body,
    source_ref: primarySourceRef,
    createdAt,
    ...(proposal.tags !== undefined && proposal.tags.length > 0 ? { tags: proposal.tags } : {}),
  });

  const noteRelPath = relative(workspace, noteResult.path);

  let eventResult;
  try {
    eventResult = await appendMemoryEvent({
      workspace,
      event_id: eventId,
      kind: "distillation_accepted",
      subject_id: noteId,
      occurred_at: createdAt,
      // Human-confirmed step (human-in-the-loop invariant): the human caused the accept.
      actor: "human",
      source_ref: primarySourceRef,
      payload: {
        note_id: noteId,
        note_path: noteRelPath,
        source_ids: sourceIds,
        ...(proposal.rationale.length > 0 ? { rationale: proposal.rationale } : {}),
      },
    });
  } catch (err) {
    // Partial failure: the L2 note was written; keep it. Surface a clear error.
    throw new DistillCliError(
      "event_append_failed",
      `L2 distilled note was written but the memory event failed to append; the note was kept (id ${noteId})`,
      { note_id: noteId, note_path: noteResult.path, cause: err instanceof Error ? err.message : String(err) },
    );
  }

  return {
    ok: true,
    note_id: noteId,
    note_path: noteResult.path,
    event_id: eventResult.event_id,
    event_path: eventResult.path,
    source_ref: primarySourceRef,
    source_ids: sourceIds,
    created_at: createdAt,
  };
}

// Re-export so the dispatcher can branch on a workspace-safety error uniformly.
export { CaptureCliError };
