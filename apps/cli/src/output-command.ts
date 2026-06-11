/**
 * `sb output create` command core (SB-059) — the human-confirmed write path for
 * L5 generated outputs: consume a REVIEWED `compose_output` proposal file
 * (OQ #22), resolve its cited sources (OQ #24), write exactly one output note
 * under `vault/60_Outputs/` via the SB-058 writer, then append one TS-emitted
 * `note_created` memory event. Validation/resolution failure writes NOTHING.
 *
 * Source resolution (OQ #24): every ULID source must resolve to an existing
 * note (`getNote`) or a current fact id; non-ULID sources (links/titles) are
 * accepted as-is.
 */
import { appendMemoryEvent } from "@sb/event-log";
import { listCurrentFacts } from "@sb/fact-store";
import { isUlid, ulid } from "@sb/interfaces";
import type { OutputProposalItem, Ulid } from "@sb/interfaces";
import { writeOutputNote, getNote } from "@sb/note-vault";
import { resolveSafeWorkspace } from "./capture-command.js";

export type OutputCliErrorCode =
  | "bad_arguments"
  | "invalid_proposal"
  | "source_not_found"
  | "event_append_failed";

export class OutputCliError extends Error {
  readonly code: OutputCliErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: OutputCliErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "OutputCliError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function invalid(message: string): OutputCliError {
  return new OutputCliError("invalid_proposal", message);
}

/**
 * Structural validation mirroring `schemas/json/proposal.schema.json`
 * (`compose_output` branch: exactly one item in v1) — same typed approach as
 * `distill accept` / `fact accept`.
 */
export function validateComposeOutputProposal(proposal: unknown): OutputProposalItem {
  if (typeof proposal !== "object" || proposal === null || Array.isArray(proposal)) {
    throw invalid("proposal must be a JSON object");
  }
  const p = proposal as Record<string, unknown>;
  if (p["workflow"] !== "compose_output") {
    throw invalid(`proposal.workflow must be "compose_output": ${String(p["workflow"])}`);
  }
  if (p["version"] !== 1) {
    throw invalid(`proposal.version must be 1: ${String(p["version"])}`);
  }
  if (typeof p["proposed_at"] !== "string" || Number.isNaN(Date.parse(p["proposed_at"]))) {
    throw invalid("proposal.proposed_at must be an ISO-8601 timestamp");
  }
  const items = p["items"];
  if (!Array.isArray(items) || items.length !== 1) {
    throw invalid("proposal.items must contain exactly one output item (v1)");
  }
  const item = items[0];
  if (typeof item !== "object" || item === null || Array.isArray(item)) {
    throw invalid("items[0] must be an object");
  }
  const i = item as Record<string, unknown>;
  if (typeof i["title"] !== "string" || i["title"].trim().length === 0) {
    throw invalid("items[0].title must be a non-empty string");
  }
  const sources = i["sources"];
  if (
    !Array.isArray(sources) ||
    sources.length === 0 ||
    sources.some((s) => typeof s !== "string" || s.trim().length === 0)
  ) {
    throw invalid("items[0].sources must be a non-empty array of non-empty strings (must cite)");
  }
  if (typeof i["body"] !== "string") {
    throw invalid("items[0].body must be a string");
  }
  if (
    i["tags"] !== undefined &&
    (!Array.isArray(i["tags"]) || i["tags"].some((t) => typeof t !== "string" || t.length === 0))
  ) {
    throw invalid("items[0].tags must be an array of non-empty strings when present");
  }
  return {
    title: i["title"],
    sources: sources as string[],
    body: i["body"],
    ...(i["tags"] !== undefined ? { tags: i["tags"] as string[] } : {}),
  };
}

/** Every ULID source must exist as a note or a current fact (OQ #24). */
async function assertSourcesResolve(workspace: string, sources: string[]): Promise<void> {
  const ulidSources = sources.filter((s) => isUlid(s));
  if (ulidSources.length === 0) return;
  let factIds: Set<string> | undefined;
  for (const source of ulidSources) {
    try {
      await getNote(workspace, source);
      continue; // resolves as a note
    } catch {
      // not a note — fall through to the fact check
    }
    if (factIds === undefined) {
      const facts = (await listCurrentFacts({ workspace })) as Array<{ id: string }>;
      factIds = new Set(facts.map((fact) => fact.id));
    }
    if (!factIds.has(source)) {
      throw new OutputCliError(
        "source_not_found",
        `cited source resolves to neither a note nor a current fact: ${source}`,
        { source },
      );
    }
  }
}

export interface OutputCreateOptions {
  /** Parsed proposal JSON (a `compose_output` envelope per proposal.schema.json). */
  proposal: unknown;
  workspace?: string;
  /** Injected timestamp (tests); defaults to now. */
  now?: string;
  repoRoot?: string;
}

export interface OutputCreateResult {
  ok: true;
  note_id: Ulid;
  /** Absolute path of the written L5 note. */
  note_path: string;
  /** event_id of the emitted `note_created` memory event. */
  event_id: Ulid;
  created_at: string;
}

/** Create one human-confirmed L5 output note + its `note_created` memory event. */
export async function runOutputCreate(opts: OutputCreateOptions): Promise<OutputCreateResult> {
  const workspace = resolveSafeWorkspace(opts.workspace, opts.repoRoot);
  const item = validateComposeOutputProposal(opts.proposal);
  await assertSourcesResolve(workspace, item.sources); // throws before any write

  const noteId = ulid();
  const createdAt = opts.now ?? new Date().toISOString();
  const written = await writeOutputNote({
    workspace,
    id: noteId,
    title: item.title,
    sources: item.sources,
    body: item.body,
    createdAt,
    ...(item.tags !== undefined ? { tags: item.tags } : {}),
  });

  const eventId = ulid();
  try {
    await appendMemoryEvent({
      workspace,
      event_id: eventId,
      kind: "note_created",
      subject_id: noteId,
      occurred_at: createdAt,
      // Human-confirmed step: the human approved the proposal; the CLI writes.
      actor: "cli",
      payload: { note_id: noteId, title: item.title, sources: item.sources },
    });
  } catch (e) {
    // mirror SB-053 semantics: the note is kept; the failure is structured
    throw new OutputCliError(
      "event_append_failed",
      "output note written but the note_created event append failed",
      { note_path: written.path, cause: e instanceof Error ? e.message : String(e) },
    );
  }

  return {
    ok: true,
    note_id: noteId,
    note_path: written.path,
    event_id: eventId,
    created_at: written.created,
  };
}
