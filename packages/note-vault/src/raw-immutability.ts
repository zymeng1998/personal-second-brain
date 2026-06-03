/**
 * Raw immutability guard (SB-012). L0 raw (`vault/00_Raw/`) is the source of
 * truth and is never overwritten or deleted via the vault API. All raw
 * mutations route through `guardRawImmutable`, which refuses them. Creation is
 * the only allowed raw mutation and lives in the writer (SB-011), whose
 * exclusive-create already rejects overwrites at write time.
 *
 * Out of scope (per SB-012): OS-level filesystem permissions; guarding non-raw
 * folders (L1+ are editable).
 */
import { isAbsolute } from "node:path";
import { isUlid } from "@sb/interfaces";
import { RawImmutabilityError, RawNoteWriteError } from "./errors.js";
import { isRawPath, rawNotePath } from "./raw-paths.js";

export { isRawPath, rawNotePath } from "./raw-paths.js";

/** Throw if `targetPath` is inside the L0 raw area. The single guarded path for raw mutations. */
export function guardRawImmutable(
  workspace: string,
  targetPath: string,
  operation: "overwrite" | "delete",
): void {
  if (isRawPath(workspace, targetPath)) {
    const code = operation === "delete" ? "delete_rejected" : "overwrite_rejected";
    throw new RawImmutabilityError(
      code,
      `L0 raw is immutable: refusing to ${operation} ${targetPath}`,
      { path: targetPath, operation },
    );
  }
}

export interface RawMutationInput {
  /** Absolute workspace root. */
  workspace: string;
  /** Canonical ULID of the raw note. */
  id: string;
  /** Optional slug used in the filename. */
  slug?: string;
}

function assertInput(workspace: string, id: string): void {
  if (typeof id !== "string" || !isUlid(id)) {
    throw new RawNoteWriteError("invalid_ulid", `id is not a canonical ULID: ${String(id)}`, { id });
  }
  if (typeof workspace !== "string" || workspace.length === 0 || !isAbsolute(workspace)) {
    throw new RawNoteWriteError("unsafe_path", `workspace must be an absolute path: ${String(workspace)}`, {
      workspace,
    });
  }
}

/** Attempt to overwrite/update an existing raw note — always refused (raw is immutable). */
export async function updateRawNote(input: RawMutationInput): Promise<never> {
  assertInput(input.workspace, input.id);
  guardRawImmutable(input.workspace, rawNotePath(input.workspace, input.id, input.slug), "overwrite");
  // guardRawImmutable always throws for a raw path; this is defensive only.
  throw new RawImmutabilityError("overwrite_rejected", "L0 raw is immutable");
}

/** Attempt to delete a raw note — always refused (raw is immutable). The file is never touched. */
export async function deleteRawNote(input: RawMutationInput): Promise<never> {
  assertInput(input.workspace, input.id);
  guardRawImmutable(input.workspace, rawNotePath(input.workspace, input.id, input.slug), "delete");
  throw new RawImmutabilityError("delete_rejected", "L0 raw is immutable");
}
