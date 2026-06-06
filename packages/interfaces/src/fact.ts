/**
 * L3 structured-fact contract (Phase 2 — EPIC-CORE-008). Types only, no behavior.
 *
 * Facts are a **projection** (rebuildable from the memory event log + L0–L2) and
 * are **ADD-only** (mem0-style, ADR-004): a fact row is never mutated in place;
 * a correction is a NEW fact whose `supersedes` points at the one it replaces.
 * Every fact carries provenance (`source_ref`) + timestamps + confidence.
 */
import type { Ulid } from "./ids.js";
import type { IsoDateTime } from "./note.js";

/** Confidence in a fact, constrained to the inclusive range [0, 1]. */
export type Confidence = number;

/** A single L3 fact. The `id` is assigned by the store (never supplied by callers). */
export interface Fact {
  id: Ulid;
  /** The asserted statement (natural-language or normalized). Domain-neutral. */
  statement: string;
  /** Provenance: id of the note/event this fact was derived from. */
  source_ref: Ulid;
  /** When the underlying observation entered the system. */
  captured_at: IsoDateTime;
  /** When the fact was observed to hold (may differ from `captured_at`). */
  observed_at: IsoDateTime;
  /** Confidence in [0, 1]. */
  confidence: Confidence;
  /** If this fact supersedes an earlier one, that fact's id. ADD-only correction. */
  supersedes?: Ulid;
}

/** Input to add a new fact. The store assigns the `id` and stamps `captured_at` if absent. */
export interface AddFactInput {
  statement: string;
  source_ref: Ulid;
  observed_at: IsoDateTime;
  confidence: Confidence;
  /** Optional client capture time; defaults to now. */
  captured_at?: IsoDateTime;
}

/** Input to supersede an existing fact with a corrected one (ADD-only; old fact untouched). */
export interface SupersedeFactInput extends AddFactInput {
  /** Id of the fact being superseded. */
  supersedes: Ulid;
}

/** Filter for listing current (non-superseded) facts. Readers should bound scans. */
export interface FactFilter {
  source_ref?: Ulid;
  /** Minimum confidence (inclusive). */
  minConfidence?: Confidence;
  limit?: number;
}
