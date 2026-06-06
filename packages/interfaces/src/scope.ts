/**
 * Permission/scope model (design-level for v0; enforcement is post-MVP, ADR-006).
 * Callers (surfaces, sidecars, domain apps) act under least-privilege scopes.
 * Defaults: no unrestricted read; never `write:raw`; never `delete:*`;
 * `read:secure_refs` is never granted by default.
 */

/** A capability scope string. Hierarchical, colon-separated; `*` is a wildcard segment. */
export type PermissionScope =
  | "write:capture"
  | "write:distill"
  | "write:facts"
  | "read:facts"
  | "rebuild:projections"
  | "append:events"
  | "read:notes"
  | `read:notes:${string}`
  | "read:secure_refs"
  | "write:raw"
  | `delete:${string}`;

/** Scopes that must never be granted to a caller (hard deny, even if requested). */
export const ALWAYS_DENIED_SCOPES = ["write:raw", "delete:*", "read:secure_refs"] as const;

/** A capability grant attached to a caller. */
export interface CapabilityGrant {
  /** Caller identity, e.g. "cli", "domain-apps/example-readonly". */
  app: string;
  allow: PermissionScope[];
  deny?: PermissionScope[];
}
