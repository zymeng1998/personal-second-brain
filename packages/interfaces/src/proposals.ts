/**
 * AI-workflow proposal contracts (Phase 4, EPIC-CORE-014 / SB-056). Types only —
 * aligned to `schemas/json/proposal.schema.json` (the shared envelope, OQ #22).
 *
 * Invariants (OQ #21–#25, resolved 2026-06-10):
 * - A proposal is a SUGGESTION: drafting one writes nothing anywhere.
 * - The human reviews the exact proposal; the accept command is the only writer
 *   (`sb fact accept --file`, `sb output create --file`) and validates against
 *   the JSON schema before any write.
 * - Provenance is mandatory: facts carry `source_ref` + `observed_at` +
 *   `confidence`; outputs carry non-empty `sources`.
 * - Duplicate handling is human-decided (OQ #23): the skill surfaces candidates,
 *   `supersedes` records a supersede choice — there is no auto-dedupe.
 */
import type { Ulid } from "./ids.js";

/** The Phase 4 AI workflows that emit proposals. */
export type ProposalWorkflow = "extract_facts" | "braindump" | "review" | "compose_output";

/** One proposed L3 fact (extract_facts items). */
export interface FactProposalItem {
  statement: string;
  /** Provenance: the note ULID the fact was extracted from. Required. */
  source_ref: Ulid;
  /** When the fact was observed (ISO-8601). */
  observed_at: string;
  /** Extraction confidence in [0, 1]. */
  confidence: number;
  /** Optional: an existing fact this one supersedes (human-picked, OQ #23). */
  supersedes?: Ulid;
}

/** The proposed L5 output note (compose_output item; exactly one per proposal in v1). */
export interface OutputProposalItem {
  title: string;
  /** Provenance the output cites (note/fact ids or links). Non-empty. */
  sources: string[];
  /** Drafted markdown body; every claim-bearing section maps to a cited source. */
  body: string;
  tags?: string[];
}

/** The shared proposal envelope (`proposal.schema.json` v1). */
export interface WorkflowProposal<TItem = Record<string, unknown>> {
  workflow: ProposalWorkflow;
  version: 1;
  /** When the proposal was drafted (ISO-8601). */
  proposed_at: string;
  items: TItem[];
}

export type ExtractFactsProposal = WorkflowProposal<FactProposalItem> & {
  workflow: "extract_facts";
};

export type ComposeOutputProposal = WorkflowProposal<OutputProposalItem> & {
  workflow: "compose_output";
};

/** Input to the `composeOutput` operation (one confirmed L5 output note). */
export interface ComposeOutputInput {
  title: string;
  /** Non-empty provenance; note ids are resolved before writing (OQ #24). */
  sources: string[];
  body: string;
  tags?: string[];
}

/** Result of `composeOutput`: the written L5 note + its memory event. */
export interface ComposeOutputResult {
  note_id: Ulid;
  /** Absolute path of the written note under `vault/60_Outputs/`. */
  note_path: string;
  /** The TS-emitted `note_created` memory event id. */
  event_id: Ulid;
}
