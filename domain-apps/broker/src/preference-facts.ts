/**
 * SB-092 — client-preference facts (broker, `write:facts` + `read:index`).
 *
 * The broker owns the client-preference VOCABULARY (here, under
 * domain-apps/broker/) but writes nothing of its own: structured preferences
 * are shaped into the EXISTING `extract_facts` proposal envelope and accepted
 * through the UNCHANGED, confirmation-gated `fact accept` path (whole-file
 * validation before any write). There is no auto-extraction, no new fact
 * writer, and no broker-specific core fact schema — the core stores generic
 * L3 facts with provenance (source_ref + observed_at + confidence).
 *
 * `read:index` is granted here because the SB-093 match/dedup read-back queries
 * the index; it is never used to bypass the confirmation gate.
 */
import { invoke } from "./index.js";
import type { AppResult } from "./index.js";

/** Broker preference vocabulary — organizes the human-reviewed brief; never stored in the core. */
export const PREFERENCE_KINDS = ["budget", "area", "bedrooms", "move_in", "constraint"] as const;
export type PreferenceKind = (typeof PREFERENCE_KINDS)[number];

/** One human-reviewed client preference. `source_ref` is the ULID of the client note (L1/L0). */
export interface ClientPreference {
  kind: PreferenceKind;
  /** The reviewed, human-readable statement stored as a generic fact. */
  statement: string;
  source_ref: string;
  observed_at: string;
  confidence: number;
  /** Optional ULID of a prior fact this preference supersedes. */
  supersedes?: string;
}

/** The shared `extract_facts` proposal envelope (proposal.schema.json). */
export interface ExtractFactsProposal {
  workflow: "extract_facts";
  version: 1;
  proposed_at: string;
  items: Array<{
    statement: string;
    source_ref: string;
    observed_at: string;
    confidence: number;
    supersedes?: string;
  }>;
}

export class PreferenceProposalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PreferenceProposalError";
  }
}

const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/**
 * Build (but do NOT write) an `extract_facts` proposal from human-reviewed
 * client preferences. Pure: the caller persists/reviews the proposal and then
 * passes it to `acceptPreferenceFacts`, which is the only write.
 */
export function buildPreferenceProposal(
  preferences: readonly ClientPreference[],
  proposedAt: string = new Date().toISOString(),
): ExtractFactsProposal {
  if (preferences.length === 0) {
    throw new PreferenceProposalError("at least one client preference is required");
  }
  const items = preferences.map((p, i) => {
    if (!PREFERENCE_KINDS.includes(p.kind)) {
      throw new PreferenceProposalError(`preferences[${i}].kind must be one of ${PREFERENCE_KINDS.join(", ")}`);
    }
    if (typeof p.statement !== "string" || p.statement.trim().length === 0) {
      throw new PreferenceProposalError(`preferences[${i}].statement must be a non-empty string`);
    }
    if (!ULID_RE.test(p.source_ref)) {
      throw new PreferenceProposalError(`preferences[${i}].source_ref must be a ULID (provenance is mandatory)`);
    }
    if (typeof p.confidence !== "number" || p.confidence < 0 || p.confidence > 1) {
      throw new PreferenceProposalError(`preferences[${i}].confidence must be between 0 and 1`);
    }
    return {
      statement: p.statement,
      source_ref: p.source_ref,
      observed_at: p.observed_at,
      confidence: p.confidence,
      ...(p.supersedes !== undefined ? { supersedes: p.supersedes } : {}),
    };
  });
  return { workflow: "extract_facts", version: 1, proposed_at: proposedAt, items };
}

export interface AcceptFactsResult extends AppResult {
  written?: number;
  fact_ids?: string[];
}

/**
 * Accept a human-reviewed preference proposal FILE through the enforced
 * `fact accept` path (whole-file validation; nothing is written if any item is
 * invalid). The proposal file is authored/reviewed by the human — the broker
 * never auto-extracts facts from note text.
 */
export async function acceptPreferenceFacts(
  workspace: string,
  proposalPath: string,
): Promise<AcceptFactsResult> {
  const result = await invoke(["fact", "accept", "--file", proposalPath, "--workspace", workspace]);
  if (result.exitCode !== 0) return result;
  const parsed = JSON.parse(result.stdout) as { written?: number; fact_ids?: string[] };
  return {
    ...result,
    ...(parsed.written !== undefined ? { written: parsed.written } : {}),
    ...(parsed.fact_ids !== undefined ? { fact_ids: parsed.fact_ids } : {}),
  };
}
