/**
 * domain-apps/broker — the FIRST real domain app (rental broker),
 * EPIC-DOMAIN-001. It follows the `example-readonly` binding template exactly
 * (SB-061 / OQ #30): every operation runs as a FIXED `domain-app:broker`
 * identity through the enforced CLI dispatch, grants come ONLY from the target
 * workspace's `config/grants.json`, and no core package is imported directly.
 *
 * SB-089 (this file) is the READ-ONLY BINDING: identity + invoke wrapper +
 * read helpers, nothing more. The v1 grant is staged across stories
 * (read-only here → `write:capture` → `write:notes` → `write:facts`); each
 * write helper lands in its own module in the story that adds its scope.
 *
 * Hard boundary (ADR-001/006): all broker vocabulary, parsing, and structure
 * live here under `domain-apps/broker/`. The core (`packages/`, `schemas/`,
 * the vault) stays domain-neutral — broker captures generic L0/L1 notes and
 * generic L3 facts, never a "broker" note type or schema.
 */
import { main } from "@sb/cli";
import { DOMAIN_APP_ID_PATTERN } from "@sb/interfaces";

/** The app's fixed caller identity — never `cli`, never `surface:*`, never configurable. */
export const BROKER_CALLER = "domain-app:broker";

// Template invariant, checked at load: the identity stays inside the
// config-grantable namespace (reserved first-party ids never match).
if (!DOMAIN_APP_ID_PATTERN.test(BROKER_CALLER)) {
  throw new Error(`invalid domain-app identity: ${BROKER_CALLER}`);
}

/** Outcome of one invocation through the enforced dispatch. */
export interface AppResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Run one CLI command under the broker's own identity. EVERY operation the
 * broker performs goes through here — the same resolver/enforcer path as every
 * other caller. A scope the workspace config does not grant ⇒ structured
 * `scope_denied` on stderr and a non-zero exit, nothing performed.
 */
export async function invoke(argv: string[]): Promise<AppResult> {
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
    BROKER_CALLER,
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
 * Escape hatch used by the smoke/gate tests to prove denial: forward an
 * arbitrary command under the broker identity. Exported so tests exercise the
 * EXACT same path the helpers use — there is no privileged variant.
 */
export async function invokeAs(argv: string[]): Promise<AppResult> {
  return invoke(argv);
}

// Workflow modules (each lands in the story that adds its grant scope).
export { captureClientNote, CaptureClientError, CLIENT_NOTE_TAG } from "./client-capture.js";
export type { CaptureClientArgs, CaptureClientResult } from "./client-capture.js";
export { promoteClient } from "./client-promote.js";
export type { PromoteClientResult } from "./client-promote.js";
export {
  buildPreferenceProposal,
  acceptPreferenceFacts,
  PreferenceProposalError,
  PREFERENCE_KINDS,
} from "./preference-facts.js";
export type {
  ClientPreference,
  PreferenceKind,
  ExtractFactsProposal,
  AcceptFactsResult,
} from "./preference-facts.js";
export { matchClient, renderMatchSummary, PROPERTY_NOTE_TAG } from "./match.js";
export type { MatchResult, PropertyMatch } from "./match.js";
