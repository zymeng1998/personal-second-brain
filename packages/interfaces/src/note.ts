/**
 * Note frontmatter + stored note. Aligns field-for-field with
 * schemas/markdown/frontmatter.schema.json (v1). The discriminated union on
 * `type` encodes the per-type rules the schema enforces via allOf.
 */
import type { Ulid, SecureRef } from "./ids.js";

/** Memory layers L0-L5 (L4 indexes are not notes). */
export type Layer = 0 | 1 | 2 | 3 | 4 | 5;

export type NoteType =
  | "raw"
  | "working"
  | "distilled"
  | "entity"
  | "project"
  | "concept"
  | "case"
  | "daily"
  | "output";

/** ISO-8601 date-time string (UTC recommended). */
export type IsoDateTime = string;

/** Fields common to every note. `id`, `type`, `layer`, `created` are required. */
interface FrontmatterBase {
  id: Ulid;
  type: NoteType;
  layer: Layer;
  created: IsoDateTime;
  title?: string;
  tags?: string[];
  aliases?: string[];
  links?: string[];
  entities?: Ulid[];
  status?: string;
  secure_ref?: SecureRef;
}

/** raw (L0) — immutable source; no `updated`, no derived provenance. */
export interface RawFrontmatter extends FrontmatterBase {
  type: "raw";
  layer: 0;
}

/** working (L1) — must reference its L0 source. */
export interface WorkingFrontmatter extends FrontmatterBase {
  type: "working";
  layer: 1;
  source_ref: Ulid;
  updated?: IsoDateTime;
}

/** daily (L1) — daily log/journal. */
export interface DailyFrontmatter extends FrontmatterBase {
  type: "daily";
  layer: 1;
  updated?: IsoDateTime;
}

/** Curated L2 notes (distilled/entity/concept/case) — `title` required. */
export interface CuratedFrontmatter extends FrontmatterBase {
  type: "distilled" | "entity" | "concept" | "case";
  layer: 2;
  title: string;
  source_ref?: Ulid;
  updated?: IsoDateTime;
}

/** project (L1 or L2) — organizing PARA note; `title` required. */
export interface ProjectFrontmatter extends FrontmatterBase {
  type: "project";
  layer: 1 | 2;
  title: string;
  updated?: IsoDateTime;
}

/** output (L5) — generated; must cite its sources. */
export interface OutputFrontmatter extends FrontmatterBase {
  type: "output";
  layer: 5;
  title: string;
  sources: Ulid[];
  updated?: IsoDateTime;
}

export type NoteFrontmatter =
  | RawFrontmatter
  | WorkingFrontmatter
  | DailyFrontmatter
  | CuratedFrontmatter
  | ProjectFrontmatter
  | OutputFrontmatter;

/** A note as read from the vault: frontmatter + verbatim body + workspace-relative path. */
export interface Note {
  frontmatter: NoteFrontmatter;
  /** Markdown body after the frontmatter block. */
  body: string;
  /** Path relative to the workspace root, e.g. `vault/00_Raw/<id>--slug.md`. */
  path: string;
}
