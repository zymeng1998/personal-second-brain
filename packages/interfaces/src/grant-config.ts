/**
 * Domain-app grant config contract (SB-060, OQ #29/#31) — TYPES ONLY in this
 * story; the fail-closed parser/loader is SB-075 and resolution is SB-076.
 *
 * `config/grants.json` declares capability grants for DOMAIN APPS ONLY.
 * Mirrors `schemas/json/grant_config.schema.json` (the published contract);
 * the SB-075 runtime validator stays dependency-free and is kept in lock-step
 * with the schema by an Ajv test-only parity check (OQ #29).
 *
 * Security invariants carried by this contract:
 * - `app` must match `domain-app:<name>` — first-party identities (`cli`,
 *   `sidecar:*`, `skill:*`) are unrepresentable, so config can never declare
 *   (let alone override) a first-party grant.
 * - `GRANTABLE_SCOPES` structurally excludes the `ALWAYS_DENIED_SCOPES`
 *   (`write:raw`, `delete:*`, `read:secure_refs`); the `satisfies` check below
 *   proves at compile time that everything grantable is a real operational
 *   `PermissionScope` — and the runtime resolver hard-denies the always-denied
 *   set anyway (defense in depth).
 */
import type { PermissionScope } from "./scope.js";

/** Caller-identity namespace for config-granted apps (reserved ids excluded by construction). */
export const DOMAIN_APP_ID_PATTERN = /^domain-app:[a-z0-9][a-z0-9-]*$/;

/** A domain-app caller identity, e.g. `domain-app:example-readonly`. */
export type DomainAppId = `domain-app:${string}`;

/**
 * Exactly the fixed operational scopes a domain app may be granted or denied
 * (the same set the `cli` grant holds — everything minus `ALWAYS_DENIED_SCOPES`).
 * `write:raw`, `delete:*`, and `read:secure_refs` are deliberately absent.
 */
export const GRANTABLE_SCOPES = [
  "write:capture",
  "write:distill",
  "write:facts",
  "write:outputs",
  "write:notes",
  "write:secure_refs",
  "read:facts",
  "rebuild:projections",
  "write:index",
  "read:index",
  "append:events",
  "read:notes",
] as const satisfies readonly PermissionScope[];

/** Sub-tree read scopes (`read:notes:<sub>`) are also grantable, per the schema pattern. */
export const SCOPED_READ_NOTES_PATTERN = /^read:notes:[a-z0-9_-]+$/;

/** A scope expressible in `config/grants.json`: fixed grantable scope or scoped note read. */
export type GrantableScope = (typeof GRANTABLE_SCOPES)[number] | `read:notes:${string}`;

/** One domain app's declared grant. Default-deny: anything not in `allow` is denied. */
export interface GrantConfigEntry {
  app: DomainAppId;
  allow: GrantableScope[];
  /** Optional explicit denies; deny overrides allow in the resolver. */
  deny?: GrantableScope[];
}

/** The validated shape of `config/grants.json` (version 1). */
export interface GrantConfig {
  version: 1;
  grants: GrantConfigEntry[];
}
