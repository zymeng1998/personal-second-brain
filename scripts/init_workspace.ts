/**
 * init_workspace.ts — Workspace initializer (entry point + skeleton).
 *
 * Story: SB-001 (Phase 1A, EPIC-CORE-001).
 *
 * This is the THIN, SAFE skeleton: argument parsing (`--dry-run`, `--help`),
 * structured logging, and a top-level `main()` that wires the (not-yet-built)
 * initialization steps in a clear, fixed order. The steps are intentionally
 * stubs that only LOG their intent — they perform NO filesystem writes.
 *
 * Real behavior arrives in later Phase 1A stories:
 *   - SB-002: environment loading & path-safety checks
 *   - SB-003: create the workspace directory tree (see docs/planning/repo_structure.md)
 *   - SB-004: create empty, append-only event files
 *   - SB-005: write the workspace README & secure_refs README
 *   - SB-006: full `--dry-run` plan/output parity with the real run
 *   - SB-007: `--verify` workspace check
 *
 * SB-001 guarantee: running this script never touches the filesystem.
 */

const PROGRAM = "init_workspace";

/** Parsed command-line options for the initializer. */
interface CliOptions {
  help: boolean;
  dryRun: boolean;
}

/** A single ordered initialization step. SB-001 ships these as logging stubs. */
interface InitStep {
  /** Stable id, mirrors the backlog story that will implement it. */
  id: string;
  /** Human-readable one-line description of what the step will do. */
  description: string;
}

type LogLevel = "info" | "warn" | "error" | "step";

/**
 * Structured logger. Diagnostics go to stderr so that any future machine-readable
 * output (e.g. a dry-run plan) can own stdout without interleaving.
 */
function log(level: LogLevel, message: string): void {
  const line = `[${PROGRAM}] ${level.toUpperCase()}: ${message}`;
  if (level === "error" || level === "warn") {
    process.stderr.write(`${line}\n`);
  } else {
    process.stderr.write(`${line}\n`);
  }
}

/**
 * The fixed, ordered plan the initializer will execute. Declared in one place so
 * the eventual `--dry-run` (SB-006) and the real run cannot drift apart.
 */
const INIT_STEPS: ReadonlyArray<InitStep> = [
  {
    id: "SB-002",
    description:
      "Load SECOND_BRAIN_WORKSPACE & derived paths; enforce path safety (absolute, outside repo, no overwrite).",
  },
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
  --dry-run    Print the ordered plan of what WOULD be created; make no changes. Exits 0.
  -h, --help   Show this help and exit 0.

BEHAVIOR (SB-001 skeleton):
  - With --help:    prints this usage and exits 0.
  - With --dry-run: prints the ordered plan and exits 0 (no filesystem writes).
  - With no flags:  prints the plan, reports that nothing is created yet
                    (real creation lands in SB-003), and exits non-zero.

The real data workspace lives OUTSIDE this repository (see .env / SECOND_BRAIN_WORKSPACE).
This skeleton performs NO filesystem writes; later Phase 1A stories add real behavior.`;

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

  printPlan();

  if (options.dryRun) {
    log(
      "info",
      "Dry run: no filesystem changes made. Detailed per-file dry-run output arrives in SB-006.",
    );
    return 0;
  }

  log(
    "warn",
    "Not yet creating anything: workspace creation is not implemented until SB-003.",
  );
  log(
    "info",
    "Re-run with --dry-run to preview the plan, or --help for usage.",
  );
  return 1;
}

const exitCode = main(process.argv.slice(2));
process.exit(exitCode);
