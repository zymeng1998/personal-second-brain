/**
 * domain-apps/example-readonly — the GENERIC read-only example domain app
 * (SB-061, OQ #14/#30). This package is the binding TEMPLATE for every future
 * domain app; it is deliberately domain-neutral (never broker — ADR-001).
 *
 * The binding pattern (see README.md):
 * 1. FIXED identity: every call runs as `domain-app:example-readonly` —
 *    never `cli`, never configurable.
 * 2. Grants come ONLY from the target workspace's `config/grants.json`
 *    (strict, fail-closed — see `grant_config.schema.json`). This app needs
 *    exactly `read:notes` + `read:facts`; no write scope exists here.
 * 3. Invocation goes ONLY through the enforced CLI dispatch —
 *    programmatic `main(argv, io, caller)` (OQ #30). No core package is
 *    imported, no second enforcement path exists.
 */
import { main } from "@sb/cli";
import { DOMAIN_APP_ID_PATTERN } from "@sb/interfaces";

/** The app's fixed caller identity. */
export const EXAMPLE_READONLY_CALLER = "domain-app:example-readonly";

// Template invariant, checked at load: the identity stays inside the
// config-grantable namespace (reserved first-party ids never match).
if (!DOMAIN_APP_ID_PATTERN.test(EXAMPLE_READONLY_CALLER)) {
  throw new Error(`invalid domain-app identity: ${EXAMPLE_READONLY_CALLER}`);
}

/** Outcome of one invocation through the enforced dispatch. */
export interface AppResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Run one CLI command under the app's own identity. EVERY operation this app
 * performs goes through here — the same resolver/enforcer path as every other
 * caller. A scope the workspace config does not grant ⇒ structured
 * `scope_denied` on stderr and a non-zero exit, nothing performed.
 */
async function invoke(argv: string[]): Promise<AppResult> {
  let stdout = "";
  let stderr = "";
  const exitCode = await main(
    argv,
    {
      out: (text: string) => {
        stdout += text;
      },
      err: (text: string) => {
        stderr += text;
      },
    },
    EXAMPLE_READONLY_CALLER,
  );
  return { exitCode, stdout, stderr };
}

/** Read-only: list notes in the workspace (`read:notes`). */
export async function listNotes(workspace: string): Promise<AppResult> {
  return invoke(["note", "list", "--workspace", workspace]);
}

/** Read-only: fetch one note's verbatim content by id (`read:notes`). */
export async function getNote(workspace: string, id: string): Promise<AppResult> {
  return invoke(["note", "get", id, "--workspace", workspace]);
}

/** Read-only: list current facts (`read:facts`). */
export async function listFacts(workspace: string): Promise<AppResult> {
  return invoke(["fact", "list", "--workspace", workspace]);
}

/**
 * Escape hatch used by the smoke test to prove denial: forward an arbitrary
 * command under the app identity. Exported so tests exercise the EXACT same
 * path the read helpers use — there is no privileged variant.
 */
export async function invokeAs(argv: string[]): Promise<AppResult> {
  return invoke(argv);
}
