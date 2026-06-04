/**
 * validate_notes.ts (SB-016) — read-only frontmatter validation.
 *
 * Scans every Markdown note under `<workspace>/vault/`, parses its YAML
 * frontmatter, and validates it against `schemas/markdown/frontmatter.schema.json`
 * (v1) using Ajv (2020 dialect) + ajv-formats. Reports per-file errors and a
 * summary. STRICTLY READ-ONLY: never writes, formats, or mutates anything.
 *
 * Exit codes: 0 = all valid · 1 = one or more invalid · 2 = operational error
 * (unsafe workspace, missing schema, unreadable/absent vault, bad arguments).
 *
 * Workspace resolution reuses the SB-002 helper (`resolveWorkspaceConfig`):
 * `SECOND_BRAIN_WORKSPACE` from env/.env, or an explicit `--workspace <path>`.
 */
import { readFileSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import type { ErrorObject, ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import { parse as parseYaml } from "yaml";
import { WORKSPACE_ENV_VAR, WorkspaceConfigError, resolveWorkspaceConfig } from "./lib/workspace_env.js";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMA_PATH = join(REPO_ROOT, "schemas", "markdown", "frontmatter.schema.json");

const USAGE = `validate_notes — read-only frontmatter validation against schema v1

Usage:
  pnpm validate:notes -- [--workspace <path>]
  pnpm validate:notes -- --help

Options:
  --workspace <path>   Absolute workspace override; else SECOND_BRAIN_WORKSPACE / .env.
  --help               Show this help.

Exit codes: 0 = all valid, 1 = invalid notes found, 2 = operational error.
Read-only: never writes, formats, or mutates notes.
`;

/** An operational failure (exit code 2) — distinct from a note being invalid (exit 1). */
class OperationalError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "OperationalError";
    this.code = code;
  }
}

export interface FileResult {
  path: string;
  ok: boolean;
  errors: string[];
}

export interface ValidationReport {
  vault: string;
  checked: number;
  valid: number;
  invalid: number;
  results: FileResult[];
}

interface CliIO {
  out: (text: string) => void;
  err: (text: string) => void;
}

function resolveWorkspace(override: string | undefined): string {
  try {
    if (override !== undefined) {
      const previous = process.env[WORKSPACE_ENV_VAR];
      process.env[WORKSPACE_ENV_VAR] = override;
      try {
        return resolveWorkspaceConfig(REPO_ROOT).config.workspace;
      } finally {
        if (previous === undefined) delete process.env[WORKSPACE_ENV_VAR];
        else process.env[WORKSPACE_ENV_VAR] = previous;
      }
    }
    return resolveWorkspaceConfig(REPO_ROOT).config.workspace;
  } catch (err) {
    if (err instanceof WorkspaceConfigError) {
      throw new OperationalError("unsafe_workspace", err.message);
    }
    throw err;
  }
}

function loadValidator(): ValidateFunction {
  let schemaText: string;
  try {
    schemaText = readFileSync(SCHEMA_PATH, "utf8");
  } catch {
    throw new OperationalError("missing_schema", `frontmatter schema not found: ${SCHEMA_PATH}`);
  }
  const schema = JSON.parse(schemaText) as Record<string, unknown>;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(schema);
}

type FrontmatterParse = { ok: true; data: unknown } | { ok: false; reason: string };

function extractFrontmatter(content: string): FrontmatterParse {
  if (!content.startsWith("---\n")) {
    return { ok: false, reason: "missing frontmatter block (file must start with '---')" };
  }
  const end = content.indexOf("\n---", 4);
  if (end === -1) {
    return { ok: false, reason: "unterminated frontmatter block (no closing '---')" };
  }
  const block = content.slice(4, end);
  try {
    const data = parseYaml(block) as unknown;
    if (data === null || typeof data !== "object" || Array.isArray(data)) {
      return { ok: false, reason: "frontmatter is empty or not a YAML mapping" };
    }
    return { ok: true, data };
  } catch (err) {
    return { ok: false, reason: `YAML parse error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

async function vaultMarkdownFiles(vault: string): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(vault, { recursive: true });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new OperationalError("vault_not_found", `vault not found: ${vault} (run init_workspace first)`);
    }
    throw new OperationalError("vault_unreadable", `cannot read vault: ${vault} (${code ?? String(err)})`);
  }
  return entries.filter((e) => e.endsWith(".md")).map((e) => join(vault, e)).sort();
}

function formatAjvError(error: ErrorObject): string {
  const where = error.instancePath === "" ? "/" : error.instancePath;
  const params = error.params && Object.keys(error.params).length > 0 ? ` ${JSON.stringify(error.params)}` : "";
  return `${where} ${error.message ?? "invalid"}${params}`;
}

/** Validate every vault note. Read-only. Throws OperationalError for operational failures. */
export async function validateWorkspaceNotes(opts: { workspace?: string } = {}): Promise<ValidationReport> {
  const workspace = resolveWorkspace(opts.workspace);
  const validate = loadValidator();
  const vault = join(workspace, "vault");
  const files = await vaultMarkdownFiles(vault);

  const results: FileResult[] = [];
  for (const file of files) {
    const content = await readFile(file, "utf8");
    const rel = relative(workspace, file);
    const parsed = extractFrontmatter(content);
    if (!parsed.ok) {
      results.push({ path: rel, ok: false, errors: [parsed.reason] });
      continue;
    }
    const valid = validate(parsed.data);
    if (valid) {
      results.push({ path: rel, ok: true, errors: [] });
    } else {
      results.push({ path: rel, ok: false, errors: (validate.errors ?? []).map(formatAjvError) });
    }
  }

  const invalid = results.filter((r) => !r.ok).length;
  return { vault, checked: results.length, valid: results.length - invalid, invalid, results };
}

/** CLI entry. Returns a process exit code. IO is injectable for tests. */
export async function main(argv: string[], io: Partial<CliIO> = {}): Promise<number> {
  const out = io.out ?? ((text: string) => void process.stdout.write(text));
  const err = io.err ?? ((text: string) => void process.stderr.write(text));

  let workspace: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    if (arg === "--" || arg === "") continue;
    if (arg === "--help" || arg === "-h") {
      out(USAGE);
      return 0;
    }
    if (arg === "--workspace") {
      const value = argv[++i];
      if (value === undefined) {
        err("error (bad_arguments): --workspace requires a value\n");
        return 2;
      }
      workspace = value;
      continue;
    }
    err(`error (bad_arguments): unknown argument: ${arg}\n`);
    return 2;
  }

  try {
    const report = await validateWorkspaceNotes(workspace !== undefined ? { workspace } : {});
    for (const result of report.results) {
      out(`${result.ok ? "PASS" : "FAIL"}  ${result.path}\n`);
      for (const error of result.errors) out(`      - ${error}\n`);
    }
    out(`\n${report.checked} checked, ${report.valid} valid, ${report.invalid} invalid (vault: ${report.vault})\n`);
    return report.invalid > 0 ? 1 : 0;
  } catch (e) {
    if (e instanceof OperationalError) {
      err(`error (${e.code}): ${e.message}\n`);
      return 2;
    }
    err(`error: ${e instanceof Error ? e.message : String(e)}\n`);
    return 2;
  }
}

// Auto-run only when executed directly (not when imported by tests).
const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  void main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
