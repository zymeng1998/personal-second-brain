/**
 * @sb/fact-store — L3 structured facts as a rebuildable SQLite projection.
 * SB-035: ADD-only `addFact()` (append `fact_added` event → project one row).
 */
export { addFact, insertFact } from "./add-fact.js";
export type { AddFactOptions, AddFactResult } from "./add-fact.js";
export { FactStoreError } from "./errors.js";
export type { FactStoreErrorCode } from "./errors.js";
