/**
 * Replay projector core (SB-023). A **pure, deterministic** fold of memory
 * events into in-memory L3 projection state. No I/O — the same engine runs on
 * live writes and on full replay (OQ #8 determinism). Persisting the folded
 * state to SQLite is a later story (SB-038); reading the event log from disk is
 * out of scope here.
 *
 * This story implements the **fact** fold (what SB-035 builds on). Entity-node
 * folding (from note events) lands in SB-021, entity merges in SB-037, and tasks
 * in SB-022 — each extends `applyEvent` for its kind. Unhandled/forward-compatible
 * kinds (and non-memory streams) leave the state unchanged.
 *
 * ADD-only (ADR-004): facts are never deleted. A `fact_superseded` event adds a
 * NEW fact whose `supersedes` points at the one it replaces; both rows are
 * retained. `currentFacts()` derives the non-superseded view.
 */
import type { EntityEdge, EntityNode, Event, Fact, MemoryEvent, Task, Ulid } from "@sb/interfaces";
import { MemoryKernelError } from "./errors.js";

/** In-memory L3 projection state. Read-only views; folds return new state. */
export interface ProjectionState {
  readonly facts: ReadonlyMap<Ulid, Fact>;
  readonly entities: ReadonlyMap<Ulid, EntityNode>;
  readonly edges: readonly EntityEdge[];
  readonly tasks: ReadonlyMap<Ulid, Task>;
}

/** A fresh, empty projection state. */
export function emptyState(): ProjectionState {
  return { facts: new Map(), entities: new Map(), edges: [], tasks: new Map() };
}

interface FactPayload {
  statement?: unknown;
  source_ref?: unknown;
  captured_at?: unknown;
  observed_at?: unknown;
  confidence?: unknown;
  supersedes?: unknown;
}

function invalid(event: MemoryEvent, field: string): MemoryKernelError {
  return new MemoryKernelError(
    "invalid_projection_event",
    `${event.kind} event ${event.event_id}: payload.${field} is missing or invalid`,
    { event_id: event.event_id, kind: event.kind, field },
  );
}

function reqString(value: unknown, event: MemoryEvent, field: string): string {
  if (typeof value !== "string" || value.length === 0) throw invalid(event, field);
  return value;
}

function reqNumber(value: unknown, event: MemoryEvent, field: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) throw invalid(event, field);
  return value;
}

/** Build a Fact from a fact_added / fact_superseded event. Throws on a malformed payload. */
function factFromEvent(event: MemoryEvent): Fact {
  const p = (event.payload ?? {}) as FactPayload;
  return {
    id: event.subject_id,
    statement: reqString(p.statement, event, "statement"),
    source_ref: reqString(p.source_ref, event, "source_ref") as Ulid,
    captured_at: reqString(p.captured_at, event, "captured_at"),
    observed_at: reqString(p.observed_at, event, "observed_at"),
    confidence: reqNumber(p.confidence, event, "confidence"),
    ...(typeof p.supersedes === "string" ? { supersedes: p.supersedes as Ulid } : {}),
  };
}

/**
 * Apply one event to the projection state, returning a NEW state (pure; the input
 * is never mutated). Only memory-stream events build projections; other streams
 * and unhandled kinds are ignored (forward-compatible).
 */
export function applyEvent(state: ProjectionState, event: Event): ProjectionState {
  if (event.stream !== "memory") return state;

  switch (event.kind) {
    case "fact_added":
    case "fact_superseded": {
      // ADD-only: both add a fact; `fact_superseded` simply carries `supersedes`.
      const fact = factFromEvent(event);
      const facts = new Map(state.facts);
      facts.set(fact.id, fact);
      return { ...state, facts };
    }
    // SB-021 (entity nodes from note_created/updated), SB-037 (entity_merged),
    // SB-022 (tasks) extend this switch. Until then they are no-ops:
    default:
      return state;
  }
}

/** Fold an ordered event stream into projection state. Deterministic + pure. */
export function projectEvents(events: Iterable<Event>): ProjectionState {
  let state = emptyState();
  for (const event of events) state = applyEvent(state, event);
  return state;
}

/**
 * The current (non-superseded) facts: every fact whose id is not referenced by
 * another fact's `supersedes`. Resolves supersede chains (A←B←C → only C).
 */
export function currentFacts(state: ProjectionState): Fact[] {
  const superseded = new Set<Ulid>();
  for (const fact of state.facts.values()) {
    if (fact.supersedes !== undefined) superseded.add(fact.supersedes);
  }
  return [...state.facts.values()].filter((fact) => !superseded.has(fact.id));
}
