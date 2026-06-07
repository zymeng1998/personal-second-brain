/**
 * fact-store ADD-only write path (SB-035). `addFact()` records a new L3 fact by:
 *   1. validating provenance (`source_ref`) + `confidence` (0–1) + statement,
 *   2. appending a `fact_added` memory event (the source of truth), then
 *   3. projecting it into the SQLite fact-store as a new row.
 *
 * ADD-only (ADR-004): facts are never UPDATEd or DELETEd. Corrections are new
 * facts that supersede earlier ones (SB-036). The SQLite projection is
 * rebuildable from the event log (the `fact_added` events) — see SB-038.
 *
 * `insertFact()` is the single INSERT path, shared by the live write here and
 * (later) the replay rebuild, so live and replayed projections stay identical.
 */
import { appendMemoryEvent } from "@sb/event-log";
import { isUlid, ulid } from "@sb/interfaces";
import type { Actor, Fact, Ulid } from "@sb/interfaces";
import { openProjectionStore } from "@sb/memory-kernel";
import type { ProjectionStore } from "@sb/memory-kernel";
import { FactStoreError } from "./errors.js";

export interface AddFactOptions {
  /** Absolute workspace root. */
  workspace: string;
  /** The asserted statement (non-empty). Domain-neutral. */
  statement: string;
  /** Provenance: ULID of the note/event this fact derives from (required). */
  source_ref: string;
  /** When the fact was observed to hold (ISO-8601). */
  observed_at: string;
  /** Confidence in [0, 1]. */
  confidence: number;
  /** When the fact entered the system; defaults to now. */
  captured_at?: string;
  /** Who asserted it; defaults to "cli". Pass "human"/"skill:<name>" as appropriate. */
  actor?: Actor;
  /** Injected clock for tests; defaults to now. */
  now?: string;
}

export interface AddFactResult {
  fact: Fact;
  /** event_id of the emitted `fact_added` memory event. */
  event_id: Ulid;
  /** Absolute path of the memory event stream. */
  event_path: string;
}

/** ADD-only INSERT of a fact row. Shared by live writes and replay rebuild. Never updates/deletes. */
export function insertFact(store: ProjectionStore, fact: Fact): void {
  store.db
    .prepare(
      "INSERT INTO facts (id, statement, source_ref, captured_at, observed_at, confidence, supersedes) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      fact.id,
      fact.statement,
      fact.source_ref,
      fact.captured_at,
      fact.observed_at,
      fact.confidence,
      fact.supersedes ?? null,
    );
}

/** Record a new L3 fact (ADD-only): append a `fact_added` event, then project one row. */
export async function addFact(opts: AddFactOptions): Promise<AddFactResult> {
  if (typeof opts.statement !== "string" || opts.statement.trim().length === 0) {
    throw new FactStoreError("invalid_statement", "a fact requires a non-empty statement");
  }
  if (typeof opts.source_ref !== "string" || !isUlid(opts.source_ref)) {
    throw new FactStoreError("invalid_source_ref", `source_ref must be a ULID (provenance is required): ${String(opts.source_ref)}`, {
      source_ref: opts.source_ref,
    });
  }
  if (typeof opts.observed_at !== "string" || opts.observed_at.length === 0) {
    throw new FactStoreError("invalid_observed_at", "observed_at must be a non-empty ISO-8601 string");
  }
  if (typeof opts.confidence !== "number" || Number.isNaN(opts.confidence) || opts.confidence < 0 || opts.confidence > 1) {
    throw new FactStoreError("invalid_confidence", `confidence must be a number in [0, 1]: ${String(opts.confidence)}`, {
      confidence: opts.confidence,
    });
  }

  const now = opts.now ?? new Date().toISOString();
  const capturedAt = opts.captured_at ?? now;
  const id = ulid();
  const eventId = ulid();
  const actor: Actor = opts.actor ?? "cli";
  const sourceRef = opts.source_ref as Ulid;

  const fact: Fact = {
    id,
    statement: opts.statement,
    source_ref: sourceRef,
    captured_at: capturedAt,
    observed_at: opts.observed_at,
    confidence: opts.confidence,
  };

  // 1. Append the fact_added event (source of truth). EventLogError propagates on failure.
  const eventResult = await appendMemoryEvent({
    workspace: opts.workspace,
    event_id: eventId,
    kind: "fact_added",
    subject_id: id,
    occurred_at: opts.observed_at,
    actor,
    source_ref: sourceRef,
    payload: {
      statement: fact.statement,
      source_ref: sourceRef,
      captured_at: capturedAt,
      observed_at: opts.observed_at,
      confidence: opts.confidence,
    },
  });

  // 2. Project into SQLite (ADD-only). If this fails, the event is still the source
  //    of truth and the projection is rebuildable (SB-038) — surface a clear error.
  const store = openProjectionStore(opts.workspace);
  try {
    insertFact(store, fact);
  } catch (err) {
    throw new FactStoreError(
      "projection_write_failed",
      `fact_added event recorded (${eventId}) but the projection insert failed; rebuildable via replay`,
      { event_id: eventId, cause: err instanceof Error ? err.message : String(err) },
    );
  } finally {
    store.close();
  }

  return { fact, event_id: eventResult.event_id, event_path: eventResult.path };
}
