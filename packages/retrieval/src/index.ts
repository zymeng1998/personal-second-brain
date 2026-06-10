/**
 * @sb/retrieval — TypeScript facade over the Python retrieval sidecar.
 * Transport: stdio JSONL (SB-048). Query/index facade ops land with SB-053/SB-032.
 */
export { SidecarClient, DEFAULT_SIDECAR_CWD } from "./sidecar-client.js";
export type { SidecarClientOptions } from "./sidecar-client.js";
export { RetrievalError } from "./errors.js";
export type { RetrievalErrorCode } from "./errors.js";
