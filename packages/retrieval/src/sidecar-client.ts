/**
 * SidecarClient — stdio JSONL transport to the Python retrieval sidecar.
 *
 * One JSON request per stdin line, one JSON response per stdout line, correlated
 * by `req_id` (out-of-order responses are fine). Errors are structured
 * `RetrievalError`s; nothing from the sidecar is ever thrown raw. The sidecar's
 * stderr is log-only and never parsed.
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { SidecarRequest, SidecarResponse } from "@sb/interfaces";

import { RetrievalError } from "./errors.js";

export interface SidecarClientOptions {
  /** Spawn command. Default: `uv` (running the real sidecar). */
  command?: string;
  /** Spawn args. Default: `run --quiet python -m retrieval_sidecar`. */
  args?: string[];
  /** Working directory for the spawn. Default: `sidecars/retrieval` in this repo. */
  cwd?: string;
  /** Per-request timeout in milliseconds. Default 30_000. */
  timeoutMs?: number;
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** Repo-relative home of the Python sidecar (the default spawn cwd). */
export const DEFAULT_SIDECAR_CWD = path.resolve(HERE, "../../../sidecars/retrieval");
const DEFAULT_COMMAND = "uv";
const DEFAULT_ARGS = ["run", "--quiet", "python", "-m", "retrieval_sidecar"];
const DEFAULT_TIMEOUT_MS = 30_000;
const CLOSE_GRACE_MS = 2_000;

interface PendingRequest {
  resolve: (data: Record<string, unknown>) => void;
  reject: (error: RetrievalError) => void;
  timer: NodeJS.Timeout;
}

function isEnvelope(value: unknown): value is SidecarResponse {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate["req_id"] === "string" && typeof candidate["ok"] === "boolean";
}

export class SidecarClient {
  readonly #command: string;
  readonly #args: string[];
  readonly #cwd: string;
  readonly #timeoutMs: number;
  #child: ChildProcessWithoutNullStreams | null = null;
  #pending = new Map<string, PendingRequest>();
  #stdoutBuffer = "";
  #nextSeq = 0;
  #closed = false;

  constructor(options: SidecarClientOptions = {}) {
    this.#command = options.command ?? DEFAULT_COMMAND;
    this.#args = options.args ?? [...DEFAULT_ARGS];
    this.#cwd = options.cwd ?? DEFAULT_SIDECAR_CWD;
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** PID of the live sidecar process, if any (diagnostics/tests). */
  get pid(): number | undefined {
    return this.#child?.pid;
  }

  /** Send one request; resolves with the response `data` object. */
  request(op: string, args?: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (this.#closed) {
      return Promise.reject(
        new RetrievalError("spawn_failed", "client is closed", { op }),
      );
    }
    let child: ChildProcessWithoutNullStreams;
    try {
      child = this.#ensureSpawned();
    } catch (error: unknown) {
      return Promise.reject(toSpawnError(error, this.#command));
    }

    const reqId = `r${++this.#nextSeq}`;
    const requestLine: SidecarRequest = args === undefined
      ? { op, req_id: reqId }
      : { op, req_id: reqId, args };

    return new Promise<Record<string, unknown>>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(reqId);
        reject(
          new RetrievalError("timeout", `sidecar did not answer '${op}' within ${this.#timeoutMs}ms`, {
            op,
            req_id: reqId,
          }),
        );
      }, this.#timeoutMs);
      this.#pending.set(reqId, { resolve, reject, timer });
      child.stdin.write(JSON.stringify(requestLine) + "\n", (writeError) => {
        if (writeError) {
          this.#settle(reqId, undefined, toSpawnError(writeError, this.#command));
        }
      });
    });
  }

  /** Graceful shutdown: end stdin, wait for exit, SIGKILL after a grace period. */
  async close(): Promise<void> {
    this.#closed = true;
    const child = this.#child;
    this.#child = null;
    if (child === null || hasExited(child)) return;
    await new Promise<void>((resolve) => {
      const killTimer = setTimeout(() => child.kill("SIGKILL"), CLOSE_GRACE_MS);
      child.once("close", () => {
        clearTimeout(killTimer);
        resolve();
      });
      child.stdin.end();
    });
  }

  #ensureSpawned(): ChildProcessWithoutNullStreams {
    if (this.#child !== null && !hasExited(this.#child)) return this.#child;
    const child = spawn(this.#command, this.#args, {
      cwd: this.#cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => this.#onStdout(chunk));
    // stderr is log-only by contract; consume it so the pipe never back-pressures.
    child.stderr.resume();
    // A write racing the sidecar's death raises EPIPE on stdin as a stream
    // 'error' event (in addition to the write callback). Without a listener it
    // would crash the process; the write callback + 'close' do the real handling.
    child.stdin.on("error", () => {});
    child.on("error", (error) => {
      this.#failAllPending(toSpawnError(error, this.#command));
    });
    child.on("close", () => {
      this.#failAllPending(
        new RetrievalError("protocol_error", "sidecar exited with requests still pending"),
      );
    });
    this.#child = child;
    return child;
  }

  #onStdout(chunk: string): void {
    this.#stdoutBuffer += chunk;
    let newlineAt = this.#stdoutBuffer.indexOf("\n");
    while (newlineAt !== -1) {
      const line = this.#stdoutBuffer.slice(0, newlineAt);
      this.#stdoutBuffer = this.#stdoutBuffer.slice(newlineAt + 1);
      this.#onLine(line);
      newlineAt = this.#stdoutBuffer.indexOf("\n");
    }
  }

  #onLine(line: string): void {
    if (line.trim() === "") return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      this.#failAllPending(
        new RetrievalError("protocol_error", "sidecar wrote a non-JSON stdout line", {
          line: line.slice(0, 200),
        }),
      );
      return;
    }
    if (!isEnvelope(parsed)) {
      this.#failAllPending(
        new RetrievalError("protocol_error", "sidecar wrote a non-envelope stdout line", {
          line: line.slice(0, 200),
        }),
      );
      return;
    }
    const response = parsed;
    if (!this.#pending.has(response.req_id)) return; // late line after timeout — drop
    if (response.ok) {
      this.#settle(response.req_id, response.data ?? {}, undefined);
      return;
    }
    const code = response.error?.code ?? "unknown";
    const message = response.error?.message ?? "sidecar error without message";
    this.#settle(
      response.req_id,
      undefined,
      new RetrievalError("sidecar_error", message, { sidecarCode: code }),
    );
  }

  #settle(
    reqId: string,
    data: Record<string, unknown> | undefined,
    error: RetrievalError | undefined,
  ): void {
    const pending = this.#pending.get(reqId);
    if (pending === undefined) return;
    this.#pending.delete(reqId);
    clearTimeout(pending.timer);
    if (error !== undefined) pending.reject(error);
    else pending.resolve(data ?? {});
  }

  #failAllPending(error: RetrievalError): void {
    for (const [reqId] of this.#pending) {
      this.#settle(reqId, undefined, error);
    }
  }
}

/** A child killed by a signal has exitCode === null but signalCode set. */
function hasExited(child: ChildProcessWithoutNullStreams): boolean {
  return child.exitCode !== null || child.signalCode !== null;
}

function toSpawnError(error: unknown, command: string): RetrievalError {
  if (error instanceof RetrievalError) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new RetrievalError("spawn_failed", `failed to run '${command}': ${message}`);
}
