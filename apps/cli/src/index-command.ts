/**
 * `index` command core (SB-053). Drives the Python retrieval sidecar's
 * `index_vault` op over stdio JSONL, then — only on success — appends one
 * TS-emitted `indexed` projection event with the build counts. The sidecar
 * never writes events (events stay TS-owned); the build writes only under
 * `indexes/` (L4 — disposable/rebuildable).
 */
import { appendProjectionEvent } from "@sb/event-log";
import { ulid } from "@sb/interfaces";
import { SidecarClient, type SidecarClientOptions } from "@sb/retrieval";
import { resolveSafeWorkspace } from "./capture-command.js";

export type IndexCliErrorCode = "bad_arguments" | "bad_sidecar_result" | "event_append_failed";

export class IndexCliError extends Error {
  readonly code: IndexCliErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: IndexCliErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "IndexCliError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

export interface IndexOptions {
  /** Absolute workspace override; else SECOND_BRAIN_WORKSPACE / .env. */
  workspace?: string;
  /** Injected timestamp (tests); defaults to now. */
  now?: string;
  /** Injected repo root (tests). */
  repoRoot?: string;
  /** Sidecar spawn overrides (tests run a Node stub sidecar). */
  sidecar?: SidecarClientOptions;
}

export interface IndexResult {
  ok: true;
  counts: { notes: number; chunks: number };
  built: string[];
  /** event_id of the emitted `indexed` projection event. */
  event_id: string;
}

function requireCount(data: Record<string, unknown>, field: string): number {
  const value = data[field];
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new IndexCliError("bad_sidecar_result", `sidecar returned no valid '${field}' count`, {
      data,
    });
  }
  return value;
}

/** Build the L4 retrieval indexes, then record one `indexed` projection event. */
export async function runIndex(opts: IndexOptions = {}): Promise<IndexResult> {
  const workspace = resolveSafeWorkspace(opts.workspace, opts.repoRoot);
  const now = opts.now ?? new Date().toISOString();

  // 1. Sidecar build. A sidecar failure throws RetrievalError here — and then
  //    no event is appended (events record only committed outcomes).
  const client = new SidecarClient(opts.sidecar ?? {});
  let data: Record<string, unknown>;
  try {
    data = await client.request("index_vault", { workspace });
  } finally {
    await client.close();
  }
  const notes = requireCount(data, "notes");
  const chunks = requireCount(data, "chunks");
  const built = Array.isArray(data["built"]) ? data["built"].map(String) : [];

  // 2. TS-emitted `indexed` projection event (the sidecar never writes events).
  const eventId = ulid();
  try {
    await appendProjectionEvent({
      workspace,
      event_id: eventId,
      kind: "indexed",
      occurred_at: now,
      actor: "cli",
      payload: { notes, chunks, built },
    });
  } catch (e) {
    throw new IndexCliError("event_append_failed", "index built but the indexed event append failed", {
      cause: e instanceof Error ? e.message : String(e),
    });
  }

  return { ok: true, counts: { notes, chunks }, built, event_id: eventId };
}
