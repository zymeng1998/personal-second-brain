/**
 * @sb/fact-store — L3 structured facts as a rebuildable SQLite projection.
 * SB-035: ADD-only `addFact()` (append `fact_added` event → project one row).
 */
export { addFact, recordFact, insertFact, validateFactInput } from "./add-fact.js";
export type { AddFactOptions, AddFactResult } from "./add-fact.js";
export { supersedeFact } from "./supersede-fact.js";
export type { SupersedeFactOptions } from "./supersede-fact.js";
export { listCurrentFacts } from "./query.js";
export type { ListFactsOptions } from "./query.js";
export { FactStoreError } from "./errors.js";
export type { FactStoreErrorCode } from "./errors.js";
