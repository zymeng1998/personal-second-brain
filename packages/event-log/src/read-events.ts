/**
 * Read-only event-stream readers (SB-037). The event log is the source of truth;
 * projections (entity merges, replay rebuild) read it back through these helpers
 * rather than touching the filesystem directly. Read-only — never writes.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { MemoryEvent } from "@sb/interfaces";
import { EventLogError } from "./errors.js";

/** Read all memory events (parsed JSONL) from `<workspace>/events/memory_events.jsonl`. */
export async function readMemoryEvents(workspace: string): Promise<MemoryEvent[]> {
  const path = join(workspace, "events", "memory_events.jsonl");
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return [];
    throw new EventLogError("read_failed", `failed to read memory events: ${path}`, {
      path,
      cause: code ?? String(err),
    });
  }
  return text
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as MemoryEvent);
}
