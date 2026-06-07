/**
 * fact-store supersede path (SB-036). `supersedeFact()` records a correction as a
 * NEW fact that references the one it replaces via `supersedes` — ADD-only, the
 * superseded row is never modified or deleted. The current-facts view
 * (`listCurrentFacts`) excludes anything referenced by a `supersedes`.
 */
import { isUlid } from "@sb/interfaces";
import type { Ulid } from "@sb/interfaces";
import { recordFact } from "./add-fact.js";
import type { AddFactOptions, AddFactResult } from "./add-fact.js";
import { FactStoreError } from "./errors.js";

export interface SupersedeFactOptions extends AddFactOptions {
  /** id of the fact being superseded (must already exist). */
  supersedes: string;
}

/** Supersede an existing fact with a corrected one (ADD-only). The old fact is never mutated. */
export async function supersedeFact(opts: SupersedeFactOptions): Promise<AddFactResult> {
  if (typeof opts.supersedes !== "string" || !isUlid(opts.supersedes)) {
    throw new FactStoreError("invalid_supersedes", `supersedes must be a ULID: ${String(opts.supersedes)}`, {
      supersedes: opts.supersedes,
    });
  }
  return recordFact(opts, opts.supersedes as Ulid);
}
