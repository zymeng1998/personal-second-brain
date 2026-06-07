/**
 * Structured errors for the memory-kernel projection store. Callers branch on `code`.
 */

export type MemoryKernelErrorCode = "unsafe_path" | "open_failed" | "migration_failed";

export class MemoryKernelError extends Error {
  readonly code: MemoryKernelErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: MemoryKernelErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "MemoryKernelError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}
