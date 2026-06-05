/**
 * Distillation proposal/result contract (v0 — Phase 1H). Types only, no behavior.
 * A distillation turns one or more L1 working notes (or L0 raw origins) into a
 * single curated L2 `distilled` note, but ONLY on explicit human accept. The
 * propose step is read-only and produces a scaffold; the skill fills it; the
 * accept step consumes a filled proposal and is the only writing step.
 *
 * Invariants (documented here, enforced by the writer/CLI in later stories):
 *  - never touches `vault/00_Raw/` and never mutates the L1 sources;
 *  - the resulting L2 note requires `title` + a `source_ref` to its origin id(s);
 *  - accept emits exactly one `distillation_accepted` memory event.
 */
import type { Ulid } from "./ids.js";

/** Selection of source notes to distill from (L1 working notes, or L0 raw origins). */
export interface ProposeDistillationInput {
  /** Origin note id(s) the proposed L2 note will derive from and reference. */
  source_ids: Ulid[];
}

/**
 * A distillation proposal: the L2 note a human is asked to confirm. Produced as a
 * scaffold by `proposeDistillation` and consumed (filled) by `acceptDistillation`.
 * Transport is plain JSON (stdin/file) so a skill can author it out-of-process.
 */
export interface DistillationProposal {
  /** Origin note id(s) this distillation derives from; becomes the L2 `source_ref`. */
  source_ids: Ulid[];
  /** Proposed L2 note title (required for curated notes). */
  title: string;
  /** Proposed L2 note body (Markdown). */
  body: string;
  /** Optional tags carried onto the L2 note. */
  tags?: string[];
  /** Human-readable justification for the distillation (why these sources → this note). */
  rationale: string;
}

/** Result of an accepted distillation: the new L2 note id and the emitted event id. */
export interface DistillationResult {
  /** id of the newly written L2 `distilled` note. */
  note_id: Ulid;
  /** event_id of the emitted `distillation_accepted` memory event. */
  event_id: Ulid;
}
