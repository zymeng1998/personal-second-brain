/**
 * fact-store read API (SB-036). `listCurrentFacts()` returns the current
 * (non-superseded) facts from the SQLite projection — every fact whose id is not
 * referenced by another fact's `supersedes`. Read-only.
 */
import { openProjectionStore } from "@sb/memory-kernel";
import type { Fact, Ulid } from "@sb/interfaces";

export interface ListFactsOptions {
  /** Absolute workspace root. */
  workspace: string;
  /** Only facts derived from this source note/event. */
  source_ref?: string;
  /** Minimum confidence (inclusive). */
  minConfidence?: number;
  /** Max rows (bounds the scan). */
  limit?: number;
}

function rowToFact(row: Record<string, unknown>): Fact {
  return {
    id: row.id as Ulid,
    statement: row.statement as string,
    source_ref: row.source_ref as Ulid,
    captured_at: row.captured_at as string,
    observed_at: row.observed_at as string,
    confidence: row.confidence as number,
    ...(row.supersedes !== null && row.supersedes !== undefined ? { supersedes: row.supersedes as Ulid } : {}),
  };
}

/**
 * List current (non-superseded) facts, ordered by id (ULID = time-sortable),
 * with optional `source_ref` / `minConfidence` / `limit` filters. Read-only.
 */
export function listCurrentFacts(opts: ListFactsOptions): Fact[] {
  const store = openProjectionStore(opts.workspace);
  try {
    let sql = "SELECT * FROM facts WHERE id NOT IN (SELECT supersedes FROM facts WHERE supersedes IS NOT NULL)";
    const params: Array<string | number> = [];
    if (opts.source_ref !== undefined) {
      sql += " AND source_ref = ?";
      params.push(opts.source_ref);
    }
    if (opts.minConfidence !== undefined) {
      sql += " AND confidence >= ?";
      params.push(opts.minConfidence);
    }
    sql += " ORDER BY id";
    if (opts.limit !== undefined) {
      sql += " LIMIT ?";
      params.push(opts.limit);
    }
    const rows = store.db.prepare(sql).all(...params) as Array<Record<string, unknown>>;
    return rows.map(rowToFact);
  } finally {
    store.close();
  }
}
