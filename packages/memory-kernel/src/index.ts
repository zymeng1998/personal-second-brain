/**
 * @sb/memory-kernel — projection store + (later) cross-layer coordination.
 * SB-034: SQLite (node:sqlite) bootstrap for the rebuildable L3 projections.
 */
export {
  openProjectionStore,
  projectionDbPath,
  DB_RELATIVE_PATH,
  SCHEMA_VERSION,
} from "./store.js";
export type { ProjectionStore } from "./store.js";
export { MemoryKernelError } from "./errors.js";
export type { MemoryKernelErrorCode } from "./errors.js";
