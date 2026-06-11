/**
 * `sb fact` command core (SB-057) — the human-confirmed write path for L3 facts:
 *   fact add     — one fact via flags (used directly by a human)
 *   fact accept  — batch from a REVIEWED `extract_facts` proposal file (OQ #22):
 *                  the whole file is validated first; an invalid file writes NOTHING
 *   fact list    — read-only current (non-superseded) facts
 * Writes go through `@sb/fact-store` (each fact = one `fact_added`/`fact_superseded`
 * memory event + one projection row). Provenance is mandatory on every path.
 */
import { addFact, listCurrentFacts, supersedeFact } from "@sb/fact-store";
import { isUlid } from "@sb/interfaces";
import type { FactProposalItem, Ulid } from "@sb/interfaces";
import { resolveSafeWorkspace } from "./capture-command.js";

export type FactCliErrorCode = "bad_arguments" | "invalid_proposal";

export class FactCliError extends Error {
  readonly code: FactCliErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: FactCliErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "FactCliError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

export interface FactAddOptions {
  statement: string;
  /** Provenance: ULID of the note/event the fact derives from (required). */
  sourceRef: string;
  /** ISO-8601; defaults to now. */
  observedAt?: string;
  /** [0,1]; defaults to 1 (a direct human assertion). */
  confidence?: number;
  /** Supersede an existing fact instead of plain add. */
  supersedes?: string;
  workspace?: string;
  repoRoot?: string;
}

export interface FactWriteResult {
  ok: true;
  fact_id: Ulid;
  event_id: Ulid;
}

/** Add (or supersede with) one fact. Exactly one event + one row on success. */
export async function runFactAdd(opts: FactAddOptions): Promise<FactWriteResult> {
  const workspace = resolveSafeWorkspace(opts.workspace, opts.repoRoot);
  const common = {
    workspace,
    statement: opts.statement,
    source_ref: opts.sourceRef,
    observed_at: opts.observedAt ?? new Date().toISOString(),
    confidence: opts.confidence ?? 1,
  };
  const result =
    opts.supersedes !== undefined
      ? await supersedeFact({ ...common, supersedes: opts.supersedes })
      : await addFact(common);
  return { ok: true, fact_id: result.fact.id, event_id: result.event_id };
}

export interface FactAcceptOptions {
  /** Parsed proposal JSON (an `extract_facts` envelope per proposal.schema.json). */
  proposal: unknown;
  workspace?: string;
  repoRoot?: string;
}

export interface FactAcceptResult {
  ok: boolean;
  written: number;
  fact_ids: Ulid[];
  /** Per-item write failures (validation failures never reach here — they reject the file). */
  failed: Array<{ index: number; code: string; message: string }>;
}

function invalid(message: string, details?: Record<string, unknown>): FactCliError {
  return new FactCliError("invalid_proposal", message, details);
}

/**
 * Structural validation mirroring `schemas/json/proposal.schema.json`
 * (`extract_facts` branch) — the same typed-validation approach as
 * `distill accept`. The WHOLE file must pass before any write happens.
 */
export function validateExtractFactsProposal(proposal: unknown): FactProposalItem[] {
  if (typeof proposal !== "object" || proposal === null || Array.isArray(proposal)) {
    throw invalid("proposal must be a JSON object");
  }
  const p = proposal as Record<string, unknown>;
  if (p["workflow"] !== "extract_facts") {
    throw invalid(`proposal.workflow must be "extract_facts": ${String(p["workflow"])}`);
  }
  if (p["version"] !== 1) {
    throw invalid(`proposal.version must be 1: ${String(p["version"])}`);
  }
  if (typeof p["proposed_at"] !== "string" || Number.isNaN(Date.parse(p["proposed_at"]))) {
    throw invalid("proposal.proposed_at must be an ISO-8601 timestamp");
  }
  const items = p["items"];
  if (!Array.isArray(items) || items.length === 0) {
    throw invalid("proposal.items must be a non-empty array");
  }
  return items.map((item, index) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw invalid(`items[${index}] must be an object`);
    }
    const i = item as Record<string, unknown>;
    if (typeof i["statement"] !== "string" || i["statement"].trim().length === 0) {
      throw invalid(`items[${index}].statement must be a non-empty string`);
    }
    if (typeof i["source_ref"] !== "string" || !isUlid(i["source_ref"])) {
      throw invalid(`items[${index}].source_ref must be a ULID (provenance is mandatory)`);
    }
    if (typeof i["observed_at"] !== "string" || Number.isNaN(Date.parse(i["observed_at"]))) {
      throw invalid(`items[${index}].observed_at must be an ISO-8601 timestamp`);
    }
    const confidence = i["confidence"];
    if (typeof confidence !== "number" || !(confidence >= 0 && confidence <= 1)) {
      throw invalid(`items[${index}].confidence must be a number in [0, 1]`);
    }
    if (i["supersedes"] !== undefined && (typeof i["supersedes"] !== "string" || !isUlid(i["supersedes"]))) {
      throw invalid(`items[${index}].supersedes must be a ULID when present`);
    }
    return {
      statement: i["statement"],
      source_ref: i["source_ref"] as Ulid,
      observed_at: i["observed_at"],
      confidence,
      ...(i["supersedes"] !== undefined ? { supersedes: i["supersedes"] as Ulid } : {}),
    };
  });
}

/**
 * Accept a reviewed extract_facts proposal: validate the WHOLE file (nothing is
 * written if any item is structurally invalid), then write items sequentially.
 * Runtime per-item failures (e.g. a missing supersede target) are reported and
 * do not abort the remaining items.
 */
export async function runFactAccept(opts: FactAcceptOptions): Promise<FactAcceptResult> {
  const workspace = resolveSafeWorkspace(opts.workspace, opts.repoRoot);
  const items = validateExtractFactsProposal(opts.proposal);

  const factIds: Ulid[] = [];
  const failed: FactAcceptResult["failed"] = [];
  for (const [index, item] of items.entries()) {
    const common = {
      workspace,
      statement: item.statement,
      source_ref: item.source_ref,
      observed_at: item.observed_at,
      confidence: item.confidence,
    };
    try {
      const result =
        item.supersedes !== undefined
          ? await supersedeFact({ ...common, supersedes: item.supersedes })
          : await addFact(common);
      factIds.push(result.fact.id);
    } catch (e) {
      const code = typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : "error";
      failed.push({ index, code, message: e instanceof Error ? e.message : String(e) });
    }
  }
  return { ok: failed.length === 0, written: factIds.length, fact_ids: factIds, failed };
}

export interface FactListOptions {
  sourceRef?: string;
  minConfidence?: number;
  limit?: number;
  workspace?: string;
  repoRoot?: string;
}

/** Read-only: current (non-superseded) facts from the projection. */
export async function runFactList(
  opts: FactListOptions = {},
): Promise<{ ok: true; count: number; facts: unknown[] }> {
  const workspace = resolveSafeWorkspace(opts.workspace, opts.repoRoot);
  const facts = await listCurrentFacts({
    workspace,
    ...(opts.sourceRef !== undefined ? { source_ref: opts.sourceRef } : {}),
    ...(opts.minConfidence !== undefined ? { minConfidence: opts.minConfidence } : {}),
    ...(opts.limit !== undefined ? { limit: opts.limit } : {}),
  });
  return { ok: true, count: facts.length, facts };
}
