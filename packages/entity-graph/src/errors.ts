/**
 * Structured errors for the entity-graph projection. Callers branch on `code`.
 */

export type EntityGraphErrorCode = "invalid_entity_note" | "projection_write_failed";

export class EntityGraphError extends Error {
  readonly code: EntityGraphErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: EntityGraphErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "EntityGraphError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}
