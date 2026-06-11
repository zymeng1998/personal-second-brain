/**
 * First-party caller grants registry (SB-069, OQ #26/#27). Static and
 * in-code for this phase; workspace `config/grants.json` is reserved for
 * domain apps (EPIC-CORE-012) and intentionally NOT loaded here.
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
 * - unknown callers — empty grant; everything denied.
 */
import type { CapabilityGrant, PermissionScope } from "./scope.js";

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

const FIRST_PARTY_GRANTS: ReadonlyArray<CapabilityGrant> = [
  { app: "cli", allow: CLI_SCOPES },
  { app: "sidecar:retrieval", allow: ["read:notes", "write:index", "read:index"] },
];

/**
 * Resolve a caller's grant. Unknown callers (including every `skill:<name>`)
 * get an EMPTY grant — denied everything until explicitly registered.
 */
export function grantFor(caller: string): CapabilityGrant {
  const found = FIRST_PARTY_GRANTS.find((grant) => grant.app === caller);
  return found ?? { app: caller, allow: [] };
}
