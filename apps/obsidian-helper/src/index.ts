/**
 * @sb/obsidian-helper entry (SB-079). Companion CLI, NOT an Obsidian plugin
 * (OQ #34): `check` is the read-only vault compat report; SB-080 adds
 * `templates install` and `capture --file`. Workspace resolution mirrors the
 * core CLI: `--workspace` override, else SECOND_BRAIN_WORKSPACE / .env.
 */
import { argv as processArgv } from "node:process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveWorkspaceConfig } from "../../../scripts/lib/workspace_env.js";
import { runCheck, CheckError } from "./check.js";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const USAGE = `obsidian-helper — Obsidian companion CLI (surface:obsidian-helper; never the writer of record)

Usage:
  obsidian-helper check [--workspace <path>]   # READ-ONLY Obsidian-compat report (exit 1 on findings)

Workspace: --workspace override, else SECOND_BRAIN_WORKSPACE / .env (like the core CLI).
`;

export interface HelperIO {
  out: (text: string) => void;
  err: (text: string) => void;
}

function errorEnvelope(err: unknown): string {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code: unknown }).code)
      : "error";
  const message = err instanceof Error ? err.message : String(err);
  return JSON.stringify({ ok: false, error: { code, message } });
}

function resolveWorkspace(override: string | undefined): string {
  if (override !== undefined) return override;
  return resolveWorkspaceConfig(REPO_ROOT).config.workspace;
}

export async function main(argv: string[], io: Partial<HelperIO> = {}): Promise<number> {
  const out = io.out ?? ((text: string) => void process.stdout.write(text));
  const err = io.err ?? ((text: string) => void process.stderr.write(text));

  const args = argv.filter((a) => a !== "--");
  const command = args[0];
  if (command === undefined || command === "--help" || command === "-h" || command === "help") {
    out(USAGE);
    return command === undefined ? 1 : 0;
  }

  let workspace: string | undefined;
  const rest = args.slice(1);
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i] as string;
    if (arg === "--workspace") {
      const value = rest[++i];
      if (value === undefined) {
        err(`${errorEnvelope(new CheckError("bad_arguments", "--workspace requires a value"))}\n`);
        return 1;
      }
      workspace = value;
      continue;
    }
    err(`${errorEnvelope(new CheckError("bad_arguments", `unknown argument: ${arg}`))}\n`);
    return 1;
  }

  try {
    if (command === "check") {
      const report = await runCheck(resolveWorkspace(workspace));
      out(`${JSON.stringify(report)}\n`);
      return report.ok ? 0 : 1;
    }
    err(`${errorEnvelope(new CheckError("bad_arguments", `unknown command: ${command}`))}\n`);
    return 1;
  } catch (e) {
    err(`${errorEnvelope(e)}\n`);
    return 1;
  }
}

const invokedDirectly =
  processArgv[1] !== undefined && resolve(processArgv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  void main(processArgv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
