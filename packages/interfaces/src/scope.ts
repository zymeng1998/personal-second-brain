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
  | "write:outputs"
  | "write:notes"
  | "read:facts"
  | "rebuild:projections"
  | "write:index"
  | "read:index"
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

/**
 * Does `pattern` cover `scope`? Segments are colon-separated; `*` matches one
 * segment; a SHORTER pattern is a hierarchical prefix grant (e.g. `read:notes`
 * covers `read:notes:projects`; `delete:*` covers `delete:a` and `delete:a:b`).
 * A pattern longer than the scope never matches.
 */
function scopeMatches(pattern: string, scope: string): boolean {
  const patternSegments = pattern.split(":");
  const scopeSegments = scope.split(":");
  if (patternSegments.length > scopeSegments.length) return false;
  return patternSegments.every((segment, i) => segment === "*" || segment === scopeSegments[i]);
}

/**
 * The single grant resolver (SB-068, OQ #27): EVERY caller — including the
 * CLI — is resolved through this function. Pure; no I/O; no environment
 * inspection, so there is nothing an env/test/dev flag could bypass.
 * Precedence: `ALWAYS_DENIED_SCOPES` (hard deny, even if explicitly allowed)
 * → `grant.deny` → `grant.allow`. An empty/missing grant allows nothing.
 */
export function grantAllows(grant: CapabilityGrant, scope: PermissionScope): boolean {
  if (ALWAYS_DENIED_SCOPES.some((denied) => scopeMatches(denied, scope))) return false;
  if ((grant.deny ?? []).some((denied) => scopeMatches(denied, scope))) return false;
  return Array.isArray(grant.allow) && grant.allow.some((allowed) => scopeMatches(allowed, scope));
}
