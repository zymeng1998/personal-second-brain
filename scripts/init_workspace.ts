/**
 * init_workspace.ts — Workspace initializer (entry point + env/path safety).
 *
 * Stories: SB-001 (entry + skeleton), SB-002 (env loading & path-safety checks),
 * SB-006 (dry-run plan), SB-003 (create the directory tree), SB-004 (create empty
 * append-only event files), SB-005 (write workspace READMEs), SB-007 (`--verify`
 * read-only workspace check) — Phase 1A, EPIC-CORE-001.
 *
 * Entry point: argument parsing (`--dry-run`, `--verify`, `--help`), structured
 * logging, and a top-level `main()` that resolves + validates the external workspace
 * configuration, then either verifies it (`--verify`), previews the plan (`--dry-run`),
 * or (real run) creates the directory tree, the empty append-only event files, and the
 * workspace READMEs — all idempotently.
 *
 * Safety: `--dry-run` never writes. A real run creates directories and empty event
 * files; it never overwrites or truncates an existing file (append-only invariant),
 * so re-running is a safe no-op.
 */

import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  WORKSPACE_ENV_VAR,
  WorkspaceConfigError,
  resolveWorkspaceConfig,
  type WorkspaceConfig,
  type WorkspaceResolution,
} from "./lib/workspace_env.ts";
import { readmeContentFor } from "./lib/workspace_readmes.ts";

const PROGRAM = "init_workspace";

/** Absolute path to this repository's root (this file lives in <repo>/scripts/). */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Parsed command-line options for the initializer. */
interface CliOptions {
  help: boolean;
  dryRun: boolean;
  verify: boolean;
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

/** Category of a planned file (drives how/when it is created). */
type PlannedFileKind = "event-log" | "readme";

/** A file the initializer creates (path relative to the workspace root). */
interface PlannedFile {
  readonly rel: string;
  readonly note: string;
  readonly kind: PlannedFileKind;
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
    { rel: "events/capture_events.jsonl", note: "append-only capture events", kind: "event-log", story: "SB-004" },
    { rel: "events/memory_events.jsonl", note: "append-only memory events", kind: "event-log", story: "SB-004" },
    { rel: "events/projection_events.jsonl", note: "append-only projection events", kind: "event-log", story: "SB-004" },
    { rel: "README.md", note: "workspace authority & safety notes", kind: "readme", story: "SB-005" },
    { rel: "secure_refs/README.md", note: "secure_refs pointer-pattern notes", kind: "readme", story: "SB-005" },
  ],
};

const USAGE = `${PROGRAM} — initialize the Personal Second Brain workspace.

USAGE:
  pnpm tsx scripts/init_workspace.ts [options]
  pnpm init:workspace -- [options]

OPTIONS:
  --dry-run    Validate config + list every directory and file the real run would
               create, in order; make no filesystem changes. Exits 0.
  --verify     Read-only check that the workspace matches the canonical plan (all
               directories + files present, no unexpected top-level entries). Exits
               0 if OK, non-zero with details otherwise. Makes no changes.
  -h, --help   Show this help and exit 0.

ENVIRONMENT:
  ${WORKSPACE_ENV_VAR}   Absolute path to the external workspace (OUTSIDE this repo).
                           Read from the environment or a local .env file. Required
                           for every run except --help. See .env.example.

BEHAVIOR:
  - With --help:    prints this usage and exits 0 (no env required).
  - Otherwise:      resolves + validates ${WORKSPACE_ENV_VAR} and path safety first.
                      * invalid/missing config → actionable error, exits non-zero.
                      * --verify  (valid)       → checks the workspace, makes no changes.
                      * --dry-run (valid)       → lists the plan, makes no changes, exits 0.
                      * no flags  (valid)       → creates the directory tree, empty event
                                                  files, and workspace READMEs (idempotent), exits 0.

The real data workspace lives OUTSIDE this repository. A real run creates directories
and empty append-only event files; it never overwrites or truncates an existing file.`;

/** Parse argv into options. Unknown flags are a hard error (fail fast). */
function parseArgs(argv: ReadonlyArray<string>): CliOptions {
  const options: CliOptions = { help: false, dryRun: false, verify: false };
  for (const arg of argv) {
    switch (arg) {
      case "-h":
      case "--help":
        options.help = true;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--verify":
        options.verify = true;
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

/** Outcome of directory creation: which were newly made vs already present. */
interface CreateDirsResult {
  readonly created: ReadonlyArray<string>;
  readonly existed: ReadonlyArray<string>;
}

/**
 * Create the workspace root and every planned directory (SB-003). Idempotent:
 * existing directories are left untouched, so re-running is a safe no-op. Creates
 * directories ONLY — never data files (event files: SB-004; READMEs: SB-005).
 * Parent-before-child ordering in WORKSPACE_PLAN keeps the created/existed tally
 * accurate; `recursive: true` is belt-and-suspenders.
 */
function createDirectories(config: WorkspaceConfig): CreateDirsResult {
  const created: string[] = [];
  const existed: string[] = [];

  const targets = [
    config.workspace,
    ...WORKSPACE_PLAN.directories.map((dir) => planPath(config, dir.rel)),
  ];

  for (const target of targets) {
    if (existsSync(target)) {
      existed.push(target);
      continue;
    }
    mkdirSync(target, { recursive: true });
    created.push(target);
  }

  return { created, existed };
}

/** Outcome of file creation: which were newly made vs already present. */
interface CreateFilesResult {
  readonly created: ReadonlyArray<string>;
  readonly existed: ReadonlyArray<string>;
}

/**
 * Create the empty append-only event-log files (SB-004): the three
 * `events/*.jsonl` streams. CRITICAL append-only invariant: an existing event
 * file is NEVER truncated or modified — it is left exactly as-is. New files are
 * created empty using the exclusive `wx` flag (create-only; fails rather than
 * truncates if the file races into existence). The parent directory is ensured
 * defensively, though SB-003 already creates `events/`.
 */
function createEventFiles(config: WorkspaceConfig): CreateFilesResult {
  const created: string[] = [];
  const existed: string[] = [];

  const eventFiles = WORKSPACE_PLAN.files.filter(
    (file) => file.kind === "event-log",
  );

  for (const file of eventFiles) {
    const target = planPath(config, file.rel);
    if (existsSync(target)) {
      existed.push(target); // preserve existing content untouched
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, "", { flag: "wx" });
    created.push(target);
  }

  return { created, existed };
}

/**
 * Write the workspace README files (SB-005): the top-level `README.md` and
 * `secure_refs/README.md`. Non-destructive: an existing README is left untouched
 * (the user may have customized it), so re-running is a safe no-op. Uses the
 * exclusive `wx` flag so an existing file is never overwritten.
 */
function createReadmeFiles(config: WorkspaceConfig): CreateFilesResult {
  const created: string[] = [];
  const existed: string[] = [];

  const readmeFiles = WORKSPACE_PLAN.files.filter(
    (file) => file.kind === "readme",
  );

  for (const file of readmeFiles) {
    const target = planPath(config, file.rel);
    if (existsSync(target)) {
      existed.push(target);
      continue;
    }
    const content = readmeContentFor(file.rel);
    if (content === undefined) {
      throw new Error(`No README template defined for "${file.rel}".`);
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content, { flag: "wx" });
    created.push(target);
  }

  return { created, existed };
}

/** Result of a read-only workspace verification. */
interface VerifyResult {
  readonly ok: boolean;
  readonly problems: ReadonlyArray<string>;
  readonly dirCount: number;
  readonly fileCount: number;
}

/** The expected set of top-level entry names, derived from the plan. */
function expectedTopLevelNames(): ReadonlySet<string> {
  const names = new Set<string>();
  for (const dir of WORKSPACE_PLAN.directories) {
    names.add(dir.rel.split("/")[0]);
  }
  for (const file of WORKSPACE_PLAN.files) {
    names.add(file.rel.split("/")[0]);
  }
  return names;
}

/**
 * Read-only verification (SB-007): assert the workspace matches the canonical plan —
 * every planned directory and file is present (correct type), and there are no
 * unexpected top-level entries. Dotfiles (e.g. macOS `.DS_Store`) are ignored.
 * Performs NO writes.
 */
function verifyWorkspace(config: WorkspaceConfig): VerifyResult {
  const problems: string[] = [];

  if (!existsSync(config.workspace) || !statSync(config.workspace).isDirectory()) {
    return {
      ok: false,
      problems: [`Workspace root missing or not a directory: ${config.workspace}`],
      dirCount: 0,
      fileCount: 0,
    };
  }

  for (const dir of WORKSPACE_PLAN.directories) {
    const target = planPath(config, dir.rel);
    if (!existsSync(target)) {
      problems.push(`Missing directory: ${target}`);
    } else if (!statSync(target).isDirectory()) {
      problems.push(`Expected a directory but found a file: ${target}`);
    }
  }

  for (const file of WORKSPACE_PLAN.files) {
    const target = planPath(config, file.rel);
    if (!existsSync(target)) {
      problems.push(`Missing file: ${target}`);
    } else if (!statSync(target).isFile()) {
      problems.push(`Expected a file but found a directory: ${target}`);
    }
  }

  const expected = expectedTopLevelNames();
  for (const entry of readdirSync(config.workspace)) {
    if (entry.startsWith(".")) {
      continue; // ignore dotfiles (e.g. macOS .DS_Store)
    }
    if (!expected.has(entry)) {
      problems.push(`Unexpected top-level entry: ${join(config.workspace, entry)}`);
    }
  }

  return {
    ok: problems.length === 0,
    problems,
    dirCount: WORKSPACE_PLAN.directories.length,
    fileCount: WORKSPACE_PLAN.files.length,
  };
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

  if (options.verify) {
    const result = verifyWorkspace(config);
    if (result.ok) {
      log(
        "info",
        `Workspace OK: ${result.dirCount} directories and ${result.fileCount} files present; ` +
          "no unexpected top-level entries.",
      );
      return 0;
    }
    for (const problem of result.problems) {
      log("error", problem);
    }
    log(
      "error",
      `Workspace verification FAILED: ${result.problems.length} problem(s). ` +
        "Re-run init (no flags) to create missing entries.",
    );
    return 1;
  }

  renderPlan(config);

  if (options.dryRun) {
    log("info", "Dry run: configuration validated; no filesystem changes made.");
    return 0;
  }

  let dirs: CreateDirsResult;
  let events: CreateFilesResult;
  let readmes: CreateFilesResult;
  try {
    dirs = createDirectories(config);
    events = createEventFiles(config);
    readmes = createReadmeFiles(config);
  } catch (error: unknown) {
    log(
      "error",
      `Failed to initialize the workspace: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
    return 1;
  }

  for (const dir of dirs.created) {
    log("step", `created dir    ${dir}`);
  }
  for (const file of [...events.created, ...readmes.created]) {
    log("step", `created file   ${file}`);
  }
  log(
    "info",
    `Directory tree ready: ${dirs.created.length} created, ${dirs.existed.length} already existed.`,
  );
  log(
    "info",
    `Event files ready: ${events.created.length} created, ${events.existed.length} already existed ` +
      "(existing files left untouched — append-only).",
  );
  log(
    "info",
    `READMEs ready: ${readmes.created.length} created, ${readmes.existed.length} already existed.`,
  );
  log("info", "Workspace initialized.");
  return 0;
}

const exitCode = main(process.argv.slice(2));
process.exit(exitCode);
