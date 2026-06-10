/**
 * Structured errors for the sidecar transport. Callers branch on `code`.
 */

export type RetrievalErrorCode =
  | "spawn_failed"
  | "timeout"
  | "protocol_error"
  | "sidecar_error";

export class RetrievalError extends Error {
  readonly code: RetrievalErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: RetrievalErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "RetrievalError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}
