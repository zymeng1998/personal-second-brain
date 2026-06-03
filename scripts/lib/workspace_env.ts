/**
 * workspace_env.ts — environment loading & path-safety for the workspace initializer.
 *
 * Story: SB-002 (Phase 1A, EPIC-CORE-001).
 *
 * Domain-neutral helper that resolves the external workspace root from the
 * `SECOND_BRAIN_WORKSPACE` environment variable (or a local `.env` file) and
 * enforces defensive checks BEFORE anything is ever created:
 *   - the variable must be present and non-empty;
 *   - the path must be ABSOLUTE;
 *   - the path must live OUTSIDE this repository (never store real data in the repo);
 *   - the path must be creatable (some existing ancestor directory is a real dir);
 *   - if the workspace already exists it must be a directory; a non-empty one warns.
 *
 * This module performs NO filesystem writes — it only reads (existence/stat/dir
 * listing) to validate. Directory creation lands in SB-003.
 *
 * Derived paths (vault/events/db/indexes) are computed deterministically from the
 * workspace root. Note: Node's `.env` loader does NOT expand `${VAR}` templates,
 * so the `${SECOND_BRAIN_WORKSPACE}/...` lines in `.env.example` are documentation
 * only; we never trust them literally.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

/** Environment variable naming the external workspace root. */
export const WORKSPACE_ENV_VAR = "SECOND_BRAIN_WORKSPACE";

/** Where the workspace value was read from. */
export type WorkspaceSource = "process.env" | ".env file";

/** Resolved, absolute workspace paths. Derived deterministically from the root. */
export interface WorkspaceConfig {
  readonly workspace: string;
  readonly vault: string;
  readonly events: string;
  readonly db: string;
  readonly indexes: string;
}

/** Result of a successful resolution: config + non-fatal warnings + source. */
export interface WorkspaceResolution {
  readonly config: WorkspaceConfig;
  readonly warnings: ReadonlyArray<string>;
  readonly source: WorkspaceSource;
}

/** Raised for any actionable path-safety / configuration failure. */
export class WorkspaceConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceConfigError";
  }
}

/**
 * Minimal, dependency-free `.env` parser. Supports `KEY=value`, `#` comments,
 * blank lines, and single/double-quoted values. Does NOT expand `${VAR}`.
 */
function parseDotEnv(content: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) {
      continue;
    }
    const eq = line.indexOf("=");
    if (eq === -1) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    if (key === "") {
      continue;
    }
    let value = line.slice(eq + 1).trim();
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));
    if (quoted && value.length >= 2) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

/**
 * Read the raw workspace value. `process.env` wins: if the variable is present
 * there at all (even empty), it is authoritative and we do NOT fall back to
 * `.env` — an explicit empty value is an explicit (invalid) choice. Only when the
 * variable is entirely absent from `process.env` do we consult the local `.env`.
 */
function readRawWorkspaceValue(repoRoot: string): {
  value: string | undefined;
  source: WorkspaceSource;
} {
  const fromProcess = process.env[WORKSPACE_ENV_VAR];
  if (fromProcess !== undefined) {
    return { value: fromProcess, source: "process.env" };
  }

  const envPath = join(repoRoot, ".env");
  if (existsSync(envPath)) {
    const parsed = parseDotEnv(readFileSync(envPath, "utf8"));
    const fromFile = parsed[WORKSPACE_ENV_VAR];
    if (fromFile !== undefined) {
      return { value: fromFile, source: ".env file" };
    }
  }

  return { value: undefined, source: "process.env" };
}

/** True when `child` is the same as, or nested inside, `parent`. */
function isInside(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

/**
 * Verify the target path is creatable without creating anything: walk up to the
 * nearest existing ancestor and require it to be a real directory.
 */
function assertCreatable(target: string): void {
  let dir = dirname(target);
  while (!existsSync(dir)) {
    const parent = dirname(dir);
    if (parent === dir) {
      break; // reached filesystem root
    }
    dir = parent;
  }
  if (!existsSync(dir)) {
    throw new WorkspaceConfigError(
      `Cannot create "${target}": no existing ancestor directory was found.`,
    );
  }
  if (!statSync(dir).isDirectory()) {
    throw new WorkspaceConfigError(
      `Cannot create "${target}": ancestor "${dir}" exists but is not a directory.`,
    );
  }
}

/**
 * Resolve and validate the workspace configuration. Throws WorkspaceConfigError
 * with an actionable message on any failure. Returns the resolved config plus any
 * non-fatal warnings (e.g. a pre-existing non-empty workspace). Performs no writes.
 *
 * @param repoRoot Absolute path to this repository's root (used for the
 *                 "outside the repo" safety check and to locate `.env`).
 */
export function resolveWorkspaceConfig(repoRoot: string): WorkspaceResolution {
  const repoRootAbs = resolve(repoRoot);
  const { value, source } = readRawWorkspaceValue(repoRootAbs);

  if (value === undefined) {
    throw new WorkspaceConfigError(
      `${WORKSPACE_ENV_VAR} is not set. Set it to an ABSOLUTE path OUTSIDE this ` +
        `repository — e.g. in a local .env file:\n` +
        `  ${WORKSPACE_ENV_VAR}=/Users/you/PersonalSecondBrainWorkspace\n` +
        `See .env.example for the template.`,
    );
  }

  const raw = value.trim();
  if (raw === "") {
    throw new WorkspaceConfigError(
      `${WORKSPACE_ENV_VAR} is empty. Set it to an ABSOLUTE path OUTSIDE this ` +
        `repository (see .env.example).`,
    );
  }

  if (!isAbsolute(raw)) {
    throw new WorkspaceConfigError(
      `${WORKSPACE_ENV_VAR} must be an ABSOLUTE path, but got a relative path: ` +
        `"${raw}". Use a full path such as /Users/you/PersonalSecondBrainWorkspace.`,
    );
  }

  const workspace = resolve(raw);

  if (isInside(repoRootAbs, workspace)) {
    throw new WorkspaceConfigError(
      `${WORKSPACE_ENV_VAR} ("${workspace}") must live OUTSIDE this repository ` +
        `("${repoRootAbs}"). Real personal data must never be stored inside the ` +
        `repo. Choose a path in a different location.`,
    );
  }

  assertCreatable(workspace);

  const warnings: string[] = [];
  if (existsSync(workspace)) {
    if (!statSync(workspace).isDirectory()) {
      throw new WorkspaceConfigError(
        `${WORKSPACE_ENV_VAR} ("${workspace}") already exists but is not a ` +
          `directory. Point it at a directory path.`,
      );
    }
    const entries = readdirSync(workspace);
    if (entries.length > 0) {
      warnings.push(
        `Workspace "${workspace}" already exists and is not empty ` +
          `(${entries.length} ${entries.length === 1 ? "entry" : "entries"}). ` +
          `Initialization is non-destructive: existing data is never overwritten.`,
      );
    }
  }

  const config: WorkspaceConfig = {
    workspace,
    vault: join(workspace, "vault"),
    events: join(workspace, "events"),
    db: join(workspace, "db"),
    indexes: join(workspace, "indexes"),
  };

  return { config, warnings, source };
}
