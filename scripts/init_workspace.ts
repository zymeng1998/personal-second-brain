/**
 * init_workspace.ts — Workspace initializer (entry point + env/path safety).
 *
 * Stories: SB-001 (entry + skeleton), SB-002 (env loading & path-safety checks)
 * — Phase 1A, EPIC-CORE-001.
 *
 * Entry point: argument parsing (`--dry-run`, `--help`), structured logging, and
 * a top-level `main()` that (SB-002) resolves + validates the external workspace
 * configuration before wiring the (not-yet-built) creation steps in a fixed order.
 *
 * Real behavior arrives in later Phase 1A stories:
 *   - SB-003: create the workspace directory tree (see docs/planning/repo_structure.md)
 *   - SB-004: create empty, append-only event files
 *   - SB-005: write the workspace README & secure_refs README
 *   - SB-006: full `--dry-run` plan/output parity with the real run
 *   - SB-007: `--verify` workspace check
 *
 * Guarantee through SB-002: running this script never WRITES to the filesystem.
 * It only reads (existence/stat/dir listing) to validate the configured workspace.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  WORKSPACE_ENV_VAR,
  WorkspaceConfigError,
  resolveWorkspaceConfig,
  type WorkspaceResolution,
} from "./lib/workspace_env.ts";

const PROGRAM = "init_workspace";

/** Absolute path to this repository's root (this file lives in <repo>/scripts/). */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Parsed command-line options for the initializer. */
interface CliOptions {
  help: boolean;
  dryRun: boolean;
}

/** A single ordered initialization step. Still logging stubs until SB-003+. */
interface InitStep {
  /** Stable id, mirrors the backlog story that will implement it. */
  id: string;
  /** Human-readable one-line description of what the step will do. */
  description: string;
}

type LogLevel = "info" | "warn" | "error" | "step";

/**
 * Structured logger. All diagnostics go to stderr so that machine-readable output
 * (e.g. usage text, or a future dry-run plan) can own stdout without interleaving.
 */
function log(level: LogLevel, message: string): void {
  process.stderr.write(`[${PROGRAM}] ${level.toUpperCase()}: ${message}\n`);
}

/**
 * The fixed, ordered plan of CREATION steps the initializer will execute (after
 * config resolution, which already ran by this point). Declared in one place so
 * the eventual `--dry-run` (SB-006) and the real run cannot drift apart.
 */
const INIT_STEPS: ReadonlyArray<InitStep> = [
  {
    id: "SB-003",
    description:
      "Create the workspace directory tree exactly per docs/planning/repo_structure.md (idempotent).",
  },
  {
    id: "SB-004",
    description:
      "Create empty append-only event files (capture/memory/projection .jsonl) if absent; never truncate.",
  },
  {
    id: "SB-005",
    description:
      "Write workspace README.md and secure_refs/README.md (safety & authority notes).",
  },
  {
    id: "SB-007",
    description:
      "Verify the workspace matches repo_structure.md (read-only check).",
  },
];

const USAGE = `${PROGRAM} — initialize the Personal Second Brain workspace.

USAGE:
  pnpm tsx scripts/init_workspace.ts [options]
  pnpm init:workspace -- [options]

OPTIONS:
  --dry-run    Validate config + print the ordered plan; make no changes. Exits 0.
  -h, --help   Show this help and exit 0.

ENVIRONMENT:
  ${WORKSPACE_ENV_VAR}   Absolute path to the external workspace (OUTSIDE this repo).
                           Read from the environment or a local .env file. Required
                           for every run except --help. See .env.example.

BEHAVIOR:
  - With --help:    prints this usage and exits 0 (no env required).
  - Otherwise:      resolves + validates ${WORKSPACE_ENV_VAR} and path safety first.
                      * invalid/missing config → actionable error, exits non-zero.
                      * --dry-run (valid)       → prints the plan, exits 0.
                      * no flags  (valid)       → prints the plan, reports nothing is
                                                  created yet (creation lands in SB-003),
                                                  exits non-zero.

The real data workspace lives OUTSIDE this repository. This script performs NO
filesystem writes (through SB-002); it only reads to validate the workspace path.`;

/** Parse argv into options. Unknown flags are a hard error (fail fast). */
function parseArgs(argv: ReadonlyArray<string>): CliOptions {
  const options: CliOptions = { help: false, dryRun: false };
  for (const arg of argv) {
    switch (arg) {
      case "-h":
      case "--help":
        options.help = true;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      default:
        throw new Error(
          `Unknown argument: "${arg}". Run with --help to see available options.`,
        );
    }
  }
  return options;
}

/** Print the ordered initialization plan (steps only log intent in SB-001). */
function printPlan(): void {
  log("info", `Planned initialization steps (${INIT_STEPS.length}):`);
  INIT_STEPS.forEach((step, index) => {
    log("step", `${index + 1}. [${step.id}] ${step.description}`);
  });
}

/** Print usage to stdout (so `--help` output can be piped/grepped cleanly). */
function printUsage(): void {
  process.stdout.write(`${USAGE}\n`);
}

/**
 * Entry point. Returns the intended process exit code instead of calling
 * process.exit directly, so it is testable and has a single exit site.
 */
function main(argv: ReadonlyArray<string>): number {
  let options: CliOptions;
  try {
    options = parseArgs(argv);
  } catch (error: unknown) {
    log("error", error instanceof Error ? error.message : "Failed to parse arguments.");
    return 2;
  }

  if (options.help) {
    printUsage();
    return 0;
  }

  let resolution: WorkspaceResolution;
  try {
    resolution = resolveWorkspaceConfig(REPO_ROOT);
  } catch (error: unknown) {
    if (error instanceof WorkspaceConfigError) {
      log("error", error.message);
    } else {
      log(
        "error",
        error instanceof Error
          ? error.message
          : "Unexpected error while resolving the workspace configuration.",
      );
    }
    return 1;
  }

  const { config, warnings, source } = resolution;
  log("info", `Workspace (from ${source}): ${config.workspace}`);
  log(
    "info",
    `Derived paths → vault: ${config.vault} · events: ${config.events} · ` +
      `db: ${config.db} · indexes: ${config.indexes}`,
  );
  for (const warning of warnings) {
    log("warn", warning);
  }

  printPlan();

  if (options.dryRun) {
    log(
      "info",
      "Dry run: configuration validated; no filesystem changes made. " +
        "Detailed per-file dry-run output arrives in SB-006.",
    );
    return 0;
  }

  log(
    "warn",
    "Validation only: workspace not yet created (directory creation lands in SB-003).",
  );
  log("info", "Re-run with --dry-run to preview the plan, or --help for usage.");
  return 1;
}

const exitCode = main(process.argv.slice(2));
process.exit(exitCode);
