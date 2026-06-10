/**
 * `query` command core (SB-032). READ-ONLY retrieval over the L4 indexes via
 * the `@sb/retrieval` facade: never writes events, never touches the workspace
 * beyond the sidecar reading `indexes/`.
 */
import type { QueryMemoryResult, QueryMode } from "@sb/interfaces";
import { queryMemory, type SidecarClientOptions } from "@sb/retrieval";
import { resolveSafeWorkspace } from "./capture-command.js";

export type QueryCliErrorCode = "bad_arguments";

export class QueryCliError extends Error {
  readonly code: QueryCliErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: QueryCliErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "QueryCliError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

/** Default mode stays lexical until SB-049 lands hybrid. */
export const DEFAULT_QUERY_MODE: QueryMode = "lexical";
const KNOWN_MODES: readonly QueryMode[] = ["lexical", "vector", "hybrid"];

export interface QueryOptions {
  /** Query text (required). */
  q: string;
  /** Max hits. */
  k?: number;
  /** Ranking mode; default lexical. */
  mode?: string;
  /** Absolute workspace override; else SECOND_BRAIN_WORKSPACE / .env. */
  workspace?: string;
  /** Injected repo root (tests). */
  repoRoot?: string;
  /** Sidecar spawn overrides (tests run a Node stub sidecar). */
  sidecar?: SidecarClientOptions;
}

export interface QueryResult extends QueryMemoryResult {
  ok: true;
}

/** Query the L4 retrieval indexes. Read-only; returns ranked references. */
export async function runQuery(opts: QueryOptions): Promise<QueryResult> {
  if (typeof opts.q !== "string" || opts.q.trim().length === 0) {
    throw new QueryCliError("bad_arguments", "a non-empty query is required: sb query \"<text>\"");
  }
  if (opts.k !== undefined && (!Number.isInteger(opts.k) || opts.k < 1)) {
    throw new QueryCliError("bad_arguments", `--k must be a positive integer: ${String(opts.k)}`);
  }
  const mode = opts.mode ?? DEFAULT_QUERY_MODE;
  if (!KNOWN_MODES.includes(mode as QueryMode)) {
    throw new QueryCliError("bad_arguments", `unknown --mode: ${mode} (lexical|vector|hybrid)`);
  }
  const workspace = resolveSafeWorkspace(opts.workspace, opts.repoRoot);
  const result = await queryMemory({
    workspace,
    q: opts.q,
    mode: mode as QueryMode,
    ...(opts.k !== undefined ? { k: opts.k } : {}),
    ...(opts.sidecar !== undefined ? { sidecar: opts.sidecar } : {}),
  });
  return { ok: true, hits: result.hits };
}
