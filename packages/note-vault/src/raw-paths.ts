/**
 * Shared path helpers for the L0 raw area (`<workspace>/vault/00_Raw/`). Single
 * source of truth for the raw filename convention and the "is this path raw?"
 * test, used by both the writer (SB-011) and the immutability guard (SB-012).
 */
import { isAbsolute, join, relative, resolve } from "node:path";

/** Workspace-relative path of the raw area. */
export const RAW_RELATIVE_DIR = join("vault", "00_Raw");

/** Absolute path of the raw area inside a workspace. */
export function rawDir(workspace: string): string {
  return join(workspace, "vault", "00_Raw");
}

/** Raw note filename: `<ULID>.md`, or `<ULID>--<slug>.md` when a slug is given. */
export function rawNoteFilename(id: string, slug?: string): string {
  return slug !== undefined ? `${id}--${slug}.md` : `${id}.md`;
}

/** Absolute path of a raw note file. */
export function rawNotePath(workspace: string, id: string, slug?: string): string {
  return join(rawDir(workspace), rawNoteFilename(id, slug));
}

/** True if `targetPath` is the raw dir itself or any path inside it. */
export function isRawPath(workspace: string, targetPath: string): boolean {
  const dir = resolve(rawDir(workspace));
  const rel = relative(dir, resolve(targetPath));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}
