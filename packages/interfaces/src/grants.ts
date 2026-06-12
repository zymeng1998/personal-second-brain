/**
 * Caller grant resolution (SB-069 first-party registry, SB-076 config-aware
 * resolution; OQ #26/#27/#30).
 *
 * Least-privilege rationale per caller:
 * - `cli` — the human's proxy. Holds every operational scope EXCEPT the
 *   `ALWAYS_DENIED_SCOPES` (`write:raw` belongs to the capture op internals,
 *   `delete:*` never exists, `read:secure_refs` means reading the EXTERNAL
 *   documents — the CLI only handles pointer metadata). The CLI still goes
 *   through the same `grantAllows` resolver as everyone else (OQ #27).
 * - `sidecar:retrieval` — reads the vault, builds/queries disposable indexes.
 *   Never events, facts, distillation, capture, or outputs.
 * - `skill:*` — skills are the agent WORKFLOW layer, never the backend: they
 *   hold no scopes of their own and act only by invoking the human-confirmed
 *   CLI commands (which run as `cli`).
 * - `domain-app:*` — resolved ONLY from a validated workspace
 *   `config/grants.json` (SB-075: strict, fail-closed, deep-frozen). No
 *   config entry ⇒ empty grant (default-deny).
 * - unknown callers — empty grant; everything denied.
 *
 * Precedence is ABSOLUTE: the in-code first-party registry is consulted
 * first, and for a first-party caller the config is ignored entirely — a
 * hostile config entry can never override, shadow, or mutate these grants
 * (the parser already makes first-party ids unrepresentable; this is the
 * defense-in-depth layer behind it). Registry grants are deep-frozen.
 */
import type { CapabilityGrant, PermissionScope } from "./scope.js";
import type { GrantConfig } from "./grant-config.js";
import { DOMAIN_APP_ID_PATTERN } from "./grant-config.js";

/** Every operational scope the CLI may hold (everything minus ALWAYS_DENIED). */
const CLI_SCOPES: PermissionScope[] = [
  "write:capture",
  "write:distill",
  "write:facts",
  "write:outputs",
  "write:notes",
  "write:secure_refs", // pointer METADATA only; read:secure_refs (external docs) stays hard-denied
  "read:facts",
  "rebuild:projections",
  "write:index",
  "read:index",
  "append:events",
  "read:notes",
];

const freezeGrant = (grant: CapabilityGrant): CapabilityGrant =>
  Object.freeze({ ...grant, allow: Object.freeze([...grant.allow]) as PermissionScope[] });

const FIRST_PARTY_GRANTS: ReadonlyArray<CapabilityGrant> = Object.freeze([
  freezeGrant({ app: "cli", allow: CLI_SCOPES }),
  freezeGrant({ app: "sidecar:retrieval", allow: ["read:notes", "write:index", "read:index"] }),
]);

/**
 * Resolve a caller's grant (SB-076). First-party registry FIRST — for a
 * registry caller `config` is ignored entirely (absolute precedence). A
 * `domain-app:*` caller resolves from the validated config, if any; the
 * entry's scope lists are copied so not even the returned grant aliases the
 * config object. Everyone else — including every `skill:<name>` and every
 * non-`domain-app:*` identity a config could never declare anyway — gets an
 * EMPTY grant: denied everything (fail closed).
 */
export function resolveGrant(caller: string, config?: GrantConfig): CapabilityGrant {
  const firstParty = FIRST_PARTY_GRANTS.find((grant) => grant.app === caller);
  if (firstParty !== undefined) return firstParty;
  if (config !== undefined && DOMAIN_APP_ID_PATTERN.test(caller)) {
    const entry = config.grants.find((grant) => grant.app === caller);
    if (entry !== undefined) {
      return {
        app: entry.app,
        allow: [...entry.allow] as PermissionScope[],
        ...(entry.deny !== undefined ? { deny: [...entry.deny] as PermissionScope[] } : {}),
      };
    }
  }
  return { app: caller, allow: [] };
}

/**
 * Resolve a caller's grant from the first-party registry only (SB-069).
 * Equivalent to `resolveGrant(caller)` with no config — kept as the
 * config-free entry point so existing callers stay unchanged.
 */
export function grantFor(caller: string): CapabilityGrant {
  return resolveGrant(caller);
}
