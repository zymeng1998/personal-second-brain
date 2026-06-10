/**
 * Retrieval + index contracts (Phase 3, EPIC-CORE-009). Types only — the Python
 * sidecar (sidecars/retrieval) and the TS facade (@sb/retrieval) implement them.
 *
 * Invariants (OQ #9–12, #17–20 resolved 2026-06-10):
 * - The sidecar reads the vault READ-ONLY and writes only under `<workspace>/indexes/`
 *   (single disposable `indexes/retrieval.duckdb`); deleting `indexes/` and
 *   rebuilding must be lossless.
 * - Events stay TS-owned: the CLI appends the `indexed` projection event after a
 *   successful build; the sidecar never writes events.
 * - Transport is stdio JSONL: one JSON object per line, request/response
 *   correlated by `req_id`; errors are structured, never thrown across the boundary.
 * - Chunking: ~512-token heading-aware chunks; chunk id `<note ULID>#<seq>`;
 *   every chunk carries `source_ref` = its note's ULID.
 */
import type { Ulid } from "./ids.js";

/** Index families the sidecar can build. Graph/temporal are a stretch (SB-055). */
export type IndexType = "fts" | "vector" | "graph" | "temporal";

/** Retrieval ranking mode. `hybrid` = vector+keyword merge (~70/30, tunable). */
export type QueryMode = "lexical" | "vector" | "hybrid";

/**
 * A chunk id: `<note ULID>#<seq>` (e.g. "01J…ZX#3"). Chunks are the retrieval
 * unit; the note ULID before `#` is the provenance root.
 */
export type ChunkId = `${string}#${number}`;

export interface IndexVaultInput {
  /** Absolute workspace path. The sidecar reads `vault/`, writes `indexes/` only. */
  workspace: string;
}

/** Counts per index type produced by one full (re)build. */
export interface IndexVaultResult {
  /** Notes scanned from `vault/**∕*.md`. */
  notes: number;
  /** Chunks produced (heading-aware, ~512 tokens). */
  chunks: number;
  /** Which index families were (re)built in `indexes/retrieval.duckdb`. */
  built: IndexType[];
}

/** Optional query filters (graph/temporal — SB-055 stretch; ignored until then). */
export interface QueryFilters {
  /** Restrict to the 1-hop graph neighborhood of a note. */
  near?: Ulid;
  /** Inclusive ISO-8601 lower time bound. */
  from?: string;
  /** Inclusive ISO-8601 upper time bound. */
  to?: string;
}

export interface QueryMemoryInput {
  /** The query text. */
  q: string;
  /** Max hits to return (default decided by the implementation). */
  k?: number;
  /** Ranking mode; implementations default to lexical until hybrid lands (SB-049). */
  mode?: QueryMode;
  filters?: QueryFilters;
}

/** One ranked retrieval result. References, never generated answers (Phase 4). */
export interface RetrievalHit {
  /** Chunk id (`<note ULID>#<seq>`). */
  id: ChunkId;
  /** Relevance score, descending; ties broken deterministically by id. */
  score: number;
  /** Optional matched-text excerpt. */
  snippet?: string;
  /** Provenance: the ULID of the note the chunk came from. */
  source_ref: Ulid;
}

export interface QueryMemoryResult {
  hits: RetrievalHit[];
}

// ---------------------------------------------------------------------------
// Sidecar stdio JSONL envelope (OQ #11). One JSON object per line.
// ---------------------------------------------------------------------------

/** A request line written to the sidecar's stdin. */
export interface SidecarRequest {
  /** Operation name, e.g. "ping" | "health" | "index_vault" | "query". */
  op: string;
  /** Caller-chosen correlation id, echoed verbatim in the response. */
  req_id: string;
  /** Operation arguments (operation-specific shape). */
  args?: Record<string, unknown>;
}

/** A structured sidecar error. Never an exception across the boundary. */
export interface SidecarError {
  code: string;
  message: string;
}

/** A response line read from the sidecar's stdout (stderr is logs only). */
export interface SidecarResponse {
  /** Echo of the request's `req_id`. */
  req_id: string;
  /** True iff the operation succeeded; then `data` is set, else `error`. */
  ok: boolean;
  data?: Record<string, unknown>;
  error?: SidecarError;
}
