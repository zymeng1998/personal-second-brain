/**
 * index_vault.ts — thin delegation to the CLI `index` command (SB-053).
 *
 * Builds the L4 retrieval indexes (`indexes/retrieval.duckdb`) via the Python
 * sidecar and appends one TS-emitted `indexed` projection event. Indexes are
 * disposable; rebuilding is lossless.
 *
 * Usage: pnpm run index:vault [-- --workspace <absolute path>]
 */
import { runIndex } from "../apps/cli/src/index-command.js";

const args = process.argv.slice(2).filter((a) => a !== "--");
let workspace: string | undefined;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--workspace") {
    workspace = args[++i];
    continue;
  }
  console.error(`[index_vault] unknown argument: ${args[i]}`);
  process.exit(1);
}

try {
  const result = await runIndex(workspace !== undefined ? { workspace } : {});
  console.log(JSON.stringify(result));
} catch (e) {
  const code = typeof e === "object" && e !== null && "code" in e ? (e as { code: unknown }).code : "error";
  console.error(`[index_vault] ${String(code)}: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}
