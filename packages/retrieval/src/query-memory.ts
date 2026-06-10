/**
 * queryMemory facade (SB-032): the `@sb/interfaces` query contract over the
 * sidecar transport. READ-ONLY — never writes events, never touches the
 * workspace beyond the sidecar reading `indexes/`.
 */
import type { QueryFilters, QueryMemoryResult, QueryMode, RetrievalHit } from "@sb/interfaces";

import { RetrievalError } from "./errors.js";
import { SidecarClient, type SidecarClientOptions } from "./sidecar-client.js";

export interface QueryMemoryOptions {
  /** Absolute workspace path (the sidecar reads `<workspace>/indexes/`). */
  workspace: string;
  /** Query text. */
  q: string;
  /** Max hits. */
  k?: number;
  /** Ranking mode; defaults to hybrid (since SB-049). */
  mode?: QueryMode;
  /** Graph-neighborhood / time-range filters (SB-055); compose with any mode. */
  filters?: QueryFilters;
  /** Sidecar spawn overrides (tests run a Node stub sidecar). */
  sidecar?: SidecarClientOptions;
}

function validate(opts: QueryMemoryOptions): void {
  if (typeof opts.workspace !== "string" || opts.workspace.length === 0) {
    throw new RetrievalError("invalid_args", "workspace (absolute path) is required");
  }
  if (typeof opts.q !== "string" || opts.q.trim().length === 0) {
    throw new RetrievalError("invalid_args", "q (non-empty query text) is required");
  }
  if (opts.k !== undefined && (!Number.isInteger(opts.k) || opts.k < 1)) {
    throw new RetrievalError("invalid_args", `k must be a positive integer: ${String(opts.k)}`);
  }
  if (opts.filters !== undefined && (typeof opts.filters !== "object" || opts.filters === null)) {
    throw new RetrievalError("invalid_args", "filters must be an object");
  }
}

function toHit(value: unknown): RetrievalHit {
  if (typeof value !== "object" || value === null) {
    throw new RetrievalError("protocol_error", "sidecar hit is not an object");
  }
  const hit = value as Record<string, unknown>;
  if (
    typeof hit["id"] !== "string" ||
    typeof hit["score"] !== "number" ||
    typeof hit["source_ref"] !== "string" ||
    (hit["snippet"] !== undefined && typeof hit["snippet"] !== "string")
  ) {
    throw new RetrievalError("protocol_error", "sidecar hit has an invalid shape", { hit });
  }
  return {
    id: hit["id"] as RetrievalHit["id"],
    score: hit["score"],
    source_ref: hit["source_ref"] as RetrievalHit["source_ref"],
    ...(hit["snippet"] !== undefined ? { snippet: hit["snippet"] } : {}),
  };
}

/** Query the L4 retrieval indexes. Read-only; returns ranked references. */
export async function queryMemory(opts: QueryMemoryOptions): Promise<QueryMemoryResult> {
  validate(opts);
  const client = new SidecarClient(opts.sidecar ?? {});
  let data: Record<string, unknown>;
  try {
    data = await client.request("query", {
      workspace: opts.workspace,
      q: opts.q,
      mode: opts.mode ?? "hybrid",
      ...(opts.k !== undefined ? { k: opts.k } : {}),
      ...(opts.filters !== undefined ? { filters: opts.filters } : {}),
    });
  } finally {
    await client.close();
  }
  const rawHits = data["hits"];
  if (!Array.isArray(rawHits)) {
    throw new RetrievalError("protocol_error", "sidecar query result has no hits array", { data });
  }
  return { hits: rawHits.map(toHit) };
}
