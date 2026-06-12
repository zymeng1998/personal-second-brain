/**
 * @sb/dashboard entry (SB-081): `dashboard [--port N] [--workspace <path>]`.
 * Workspace resolution mirrors the core CLI (`--workspace` override, else
 * SECOND_BRAIN_WORKSPACE / .env). The server stays up until Ctrl-C.
 */
import { argv as processArgv } from "node:process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveWorkspaceConfig } from "../../../scripts/lib/workspace_env.js";
import { startDashboard } from "./server.js";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

async function run(): Promise<void> {
  let workspace: string | undefined;
  let port = 8765;
  const args = processArgv.slice(2).filter((a) => a !== "--");
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] as string;
    if (arg === "--workspace") workspace = args[++i];
    else if (arg === "--port") {
      const value = Number.parseInt(args[++i] ?? "", 10);
      if (!Number.isInteger(value) || value < 0 || value > 65535) {
        throw new Error(`--port must be 0..65535`);
      }
      port = value;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  const ws = workspace ?? resolveWorkspaceConfig(REPO_ROOT).config.workspace;
  const dashboard = await startDashboard(ws, port);
  process.stdout.write(`${JSON.stringify({ ok: true, url: dashboard.url, workspace: ws })}\n`);
}

run().catch((err: unknown) => {
  process.stderr.write(
    `${JSON.stringify({ ok: false, error: { code: "startup_failed", message: err instanceof Error ? err.message : String(err) } })}\n`,
  );
  process.exitCode = 1;
});
