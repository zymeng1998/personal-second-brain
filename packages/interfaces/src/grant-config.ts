/**
 * Domain-app grant config contract (SB-060) + fail-closed parser/loader
 * (SB-075, OQ #29/#31); resolution is SB-076.
 *
 * `config/grants.json` declares capability grants for DOMAIN APPS ONLY.
 * Mirrors `schemas/json/grant_config.schema.json` (the published contract);
 * the runtime validator below is dependency-free and is kept in lock-step
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

/** Why a grant config was rejected. Reasons are codes, never payload values. */
export type GrantConfigInvalidReason =
  | "unreadable"
  | "invalid_json"
  | "not_object"
  | "bad_version"
  | "grants_not_array"
  | "entry_not_object"
  | "unknown_property"
  | "app_invalid"
  | "app_reserved"
  | "duplicate_app"
  | "allow_not_array"
  | "deny_not_array"
  | "scope_not_grantable"
  | "duplicate_scope";

/**
 * Fail-closed rejection (OQ #31): ANY invalid content rejects the WHOLE file —
 * nothing partial ever loads. Audit-friendly and leak-free: the message names
 * the reason code + the offending KEY PATH only, never grant payload values.
 */
export class GrantConfigError extends Error {
  readonly code = "grant_config_invalid";
  readonly details: { reason: GrantConfigInvalidReason; path: string };

  constructor(reason: GrantConfigInvalidReason, path: string) {
    super(`grant config invalid: ${reason} at ${path}`);
    this.name = "GrantConfigError";
    this.details = { reason, path };
  }
}

/** Is `value` a scope expressible in config? (fixed grantable set or scoped note read) */
function isGrantableScope(value: unknown): value is GrantableScope {
  if (typeof value !== "string") return false;
  return (
    (GRANTABLE_SCOPES as readonly string[]).includes(value) ||
    SCOPED_READ_NOTES_PATTERN.test(value)
  );
}

/** Reserved first-party identities — never declarable in config, even if the pattern evolved. */
function isReservedCaller(value: string): boolean {
  return value === "cli" || value.startsWith("sidecar:") || value.startsWith("skill:");
}

function parseScopeList(
  value: unknown,
  path: string,
  missingReason: "allow_not_array" | "deny_not_array",
): GrantableScope[] {
  if (!Array.isArray(value)) throw new GrantConfigError(missingReason, path);
  const seen = new Set<string>();
  const scopes: GrantableScope[] = [];
  value.forEach((item, i) => {
    if (!isGrantableScope(item)) {
      throw new GrantConfigError("scope_not_grantable", `${path}[${i}]`);
    }
    if (seen.has(item)) throw new GrantConfigError("duplicate_scope", `${path}[${i}]`);
    seen.add(item);
    scopes.push(item);
  });
  return Object.freeze(scopes) as GrantableScope[];
}

function parseEntry(value: unknown, path: string): GrantConfigEntry {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new GrantConfigError("entry_not_object", path);
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key !== "app" && key !== "allow" && key !== "deny") {
      throw new GrantConfigError("unknown_property", `${path}.${key}`);
    }
  }
  const app = record.app;
  if (typeof app !== "string" || !DOMAIN_APP_ID_PATTERN.test(app)) {
    // distinguish a reserved first-party identity for the audit trail; both fail closed
    const reason =
      typeof app === "string" && isReservedCaller(app) ? "app_reserved" : "app_invalid";
    throw new GrantConfigError(reason, `${path}.app`);
  }
  const entry: GrantConfigEntry = {
    app: app as DomainAppId,
    allow: parseScopeList(record.allow, `${path}.allow`, "allow_not_array"),
  };
  if ("deny" in record) {
    entry.deny = parseScopeList(record.deny, `${path}.deny`, "deny_not_array");
  }
  return Object.freeze(entry);
}

/**
 * Parse + strictly validate `config/grants.json` content (SB-075). Pure; no
 * I/O; dependency-free; mirrors `grant_config.schema.json` exactly, PLUS the
 * loader-level semantic check JSON Schema cannot express: duplicate
 * `domain-app:*` entries fail closed (never merged, never last-write-wins).
 * Any violation throws `GrantConfigError` — the whole file is rejected and
 * nothing partial loads. The returned config is deep-frozen: config-loaded
 * grants can never be mutated after validation.
 */
export function parseGrantConfig(text: string): GrantConfig {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new GrantConfigError("invalid_json", "(file)");
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new GrantConfigError("not_object", "(root)");
  }
  const record = raw as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key !== "version" && key !== "grants") {
      throw new GrantConfigError("unknown_property", key);
    }
  }
  if (record.version !== 1) throw new GrantConfigError("bad_version", "version");
  if (!Array.isArray(record.grants)) throw new GrantConfigError("grants_not_array", "grants");

  const seenApps = new Set<string>();
  const grants = record.grants.map((value, i) => {
    const entry = parseEntry(value, `grants[${i}]`);
    if (seenApps.has(entry.app)) {
      throw new GrantConfigError("duplicate_app", `grants[${i}].app`);
    }
    seenApps.add(entry.app);
    return entry;
  });

  return Object.freeze({ version: 1, grants: Object.freeze(grants) }) as GrantConfig;
}

/** The valid empty config: no external grants, everything non-first-party denied. */
export const EMPTY_GRANT_CONFIG: GrantConfig = Object.freeze({
  version: 1,
  grants: Object.freeze([]) as unknown as GrantConfigEntry[],
});

/** Relative location of the grant config inside a workspace. */
export const GRANT_CONFIG_RELATIVE_PATH = "config/grants.json";

/**
 * Load `config/grants.json` from a workspace (SB-075). Missing file is VALID
 * and means "no external grants" (default-deny — OQ #31). Any other read
 * failure, and any validation failure, throws `GrantConfigError` (fail
 * closed). Thin fs wrapper over the pure `parseGrantConfig`.
 */
export async function loadGrantConfig(workspaceDir: string): Promise<GrantConfig> {
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  let text: string;
  try {
    text = await readFile(join(workspaceDir, "config", "grants.json"), "utf8");
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return EMPTY_GRANT_CONFIG;
    throw new GrantConfigError("unreadable", GRANT_CONFIG_RELATIVE_PATH);
  }
  return parseGrantConfig(text);
}
