/**
 * @sb/entity-graph — domain-neutral entity graph as a rebuildable SQLite projection.
 * SB-021: project entity nodes from L2 entity notes. Edges + merges land in SB-037.
 */
export { projectEntities, listEntityNodes, insertEntityNode } from "./project-entities.js";
export type { ProjectEntitiesResult } from "./project-entities.js";
export { projectEdges, listEntityEdges, insertEntityEdge } from "./project-edges.js";
export type { ProjectEdgesResult } from "./project-edges.js";
export { mergeEntities } from "./merge-entities.js";
export type { MergeEntitiesOptions, MergeEntitiesResult } from "./merge-entities.js";
export { EntityGraphError } from "./errors.js";
export type { EntityGraphErrorCode } from "./errors.js";
