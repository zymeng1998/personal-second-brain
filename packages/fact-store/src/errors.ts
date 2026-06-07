/**
 * Structured errors for the fact-store write path. Callers branch on `code`.
 */

export type FactStoreErrorCode =
  | "invalid_statement"
  | "invalid_source_ref"
  | "invalid_observed_at"
  | "invalid_confidence"
  | "projection_write_failed";

export class FactStoreError extends Error {
  readonly code: FactStoreErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: FactStoreErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "FactStoreError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}
