/**
 * @sb/task-store — tasks as a rebuildable SQLite projection.
 * SB-022: derive tasks from note frontmatter `status` (vault-derived, rebuildable).
 */
export { projectTasks, listTasks, insertTask } from "./project-tasks.js";
export type { ProjectTasksResult } from "./project-tasks.js";
