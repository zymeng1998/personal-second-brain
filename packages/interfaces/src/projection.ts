/**
 * L3 projection contracts (Phase 2 — EPIC-CORE-008): entity-graph + task-store
 * shapes, plus the replay/rebuild descriptor. Types only, no behavior.
 *
 * Projections live in `db/memory.sqlite` and are **disposable/rebuildable**: the
 * append-only event log (+ L0–L2) is the source of truth. A pure projector folds
 * events into these shapes; replay reproduces them deterministically.
 */
import type { Ulid } from "./ids.js";
import type { IsoDateTime } from "./note.js";

/** A node in the entity graph — projection of an entity (L2) note. */
export interface EntityNode {
  id: Ulid;
  title: string;
  aliases?: string[];
  /** Provenance: id of the entity note this node projects. */
  source_ref: Ulid;
}

/** A directed relation between two entities (derived from links/`entities` refs). */
export interface EntityEdge {
  from: Ulid;
  to: Ulid;
  /** Relation kind. Free-form, domain-neutral. */
  kind: string;
  /** Provenance: id of the note/event the edge was derived from. */
  source_ref: Ulid;
}

/** A task projected from a note (source convention finalized in SB-022). */
export interface Task {
  id: Ulid;
  title: string;
  status: string;
  /** Provenance: id of the source note. */
  source_ref: Ulid;
  updated_at?: IsoDateTime;
}

/** The named L3 projections. */
export type ProjectionName = "facts" | "entities" | "tasks";

/** Input to a rebuild; `only` limits scope, default = all projections. */
export interface RebuildProjectionsInput {
  only?: ProjectionName[];
}

/** Result of a rebuild: rows written per projection + the emitted event id. */
export interface RebuildProjectionsResult {
  counts: Readonly<Record<ProjectionName, number>>;
  /** event_id of the emitted `projection_rebuilt` event. */
  event_id: Ulid;
}
