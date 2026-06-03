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

import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  WORKSPACE_ENV_VAR,
  WorkspaceConfigError,
  resolveWorkspaceConfig,
  type WorkspaceConfig,
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

type LogLevel = "info" | "warn" | "error" | "step";

/**
 * Structured logger. All diagnostics go to stderr so that machine-readable output
 * (e.g. usage text) can own stdout without interleaving.
 */
function log(level: LogLevel, message: string): void {
  process.stderr.write(`[${PROGRAM}] ${level.toUpperCase()}: ${message}\n`);
}

/** A directory the initializer creates (path relative to the workspace root). */
interface PlannedDir {
  readonly rel: string;
  readonly note?: string;
}

/** A file the initializer creates (path relative to the workspace root). */
interface PlannedFile {
  readonly rel: string;
  readonly note: string;
  /** Backlog story that implements creation of this file. */
  readonly story: string;
}

/** The full, ordered plan of what a complete initializer run creates. */
interface WorkspacePlan {
  readonly directories: ReadonlyArray<PlannedDir>;
  readonly files: ReadonlyArray<PlannedFile>;
}

/**
 * Canonical workspace plan — the SINGLE SOURCE OF TRUTH mirroring
 * docs/planning/repo_structure.md. Both `--dry-run` (SB-006) and the real
 * creation path (SB-003 dirs, SB-004 event files, SB-005 READMEs) consume this
 * exact data, so the preview can never drift from actual behavior. Paths are
 * workspace-relative; absolute paths are derived by joining the resolved root.
 */
const WORKSPACE_PLAN: WorkspacePlan = {
  directories: [
    { rel: "vault" },
    { rel: "vault/00_Raw", note: "L0 immutable source — AI never overwrites/deletes" },
    { rel: "vault/00_Inbox", note: "processing queue" },
    { rel: "vault/10_Projects" },
    { rel: "vault/20_Areas" },
    { rel: "vault/30_Resources" },
    { rel: "vault/40_Archives" },
    { rel: "vault/50_Entities" },
    { rel: "vault/60_Outputs", note: "L5 generated outputs (must cite sources)" },
    { rel: "vault/70_Daily" },
    { rel: "vault/80_Wiki" },
    { rel: "vault/90_System", note: "templates, config, schema copies" },
    { rel: "events", note: "source of truth (append-only JSONL); not disposable" },
    { rel: "db" },
    { rel: "db/backups" },
    { rel: "indexes", note: "L4 — disposable / rebuildable" },
    { rel: "indexes/full_text" },
    { rel: "indexes/vector" },
    { rel: "indexes/graph" },
    { rel: "indexes/temporal" },
    { rel: "attachments" },
    { rel: "attachments/non_sensitive", note: "sensitive docs never stored here" },
    { rel: "secure_refs", note: "metadata + pointers to external secure storage" },
    { rel: "logs", note: "technical/debug logs only — disposable" },
    { rel: "logs/capture_logs" },
    { rel: "logs/extraction_logs" },
    { rel: "logs/indexing_logs" },
  ],
  files: [
    { rel: "events/capture_events.jsonl", note: "append-only capture events", story: "SB-004" },
    { rel: "events/memory_events.jsonl", note: "append-only memory events", story: "SB-004" },
    { rel: "events/projection_events.jsonl", note: "append-only projection events", story: "SB-004" },
    { rel: "README.md", note: "workspace authority & safety notes", story: "SB-005" },
    { rel: "secure_refs/README.md", note: "secure_refs pointer-pattern notes", story: "SB-005" },
  ],
};

const USAGE = `${PROGRAM} — initialize the Personal Second Brain workspace.

USAGE:
  pnpm tsx scripts/init_workspace.ts [options]
  pnpm init:workspace -- [options]

OPTIONS:
  --dry-run    Validate config + list every directory and file the real run would
               create, in order; make no filesystem changes. Exits 0.
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

/** Absolute path for a plan entry, joined onto the resolved workspace root. */
function planPath(config: WorkspaceConfig, rel: string): string {
  return join(config.workspace, rel);
}

/**
 * Render the full, ordered workspace plan (directories then files) as absolute
 * paths. Used by both `--dry-run` and the real run so the preview matches behavior.
 * Rendering itself performs no filesystem access.
 */
function renderPlan(config: WorkspaceConfig): void {
  const { directories, files } = WORKSPACE_PLAN;

  log("info", `Plan — workspace root: ${config.workspace}`);

  log("info", `Directories to create (${directories.length}):`);
  directories.forEach((dir, index) => {
    const suffix = dir.note ? `  — ${dir.note}` : "";
    log("step", `${index + 1}. ${planPath(config, dir.rel)}${suffix}`);
  });

  log("info", `Files to create (${files.length}):`);
  files.forEach((file, index) => {
    log(
      "step",
      `${index + 1}. ${planPath(config, file.rel)}  — ${file.note} (${file.story})`,
    );
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

  renderPlan(config);

  if (options.dryRun) {
    log(
      "info",
      "Dry run: configuration validated; no filesystem changes made.",
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
