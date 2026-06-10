/**
 * query_memory.ts — thin delegation to the CLI `query` command (SB-032).
 *
 * Queries the L4 retrieval indexes via the @sb/retrieval facade and prints
 * ranked hits with source_ref provenance. READ-ONLY.
 *
 * Usage: pnpm run query:memory -- "<query text>" [--k <n>] [--mode lexical|vector|hybrid] [--workspace <path>]
 */
import { runQuery } from "../apps/cli/src/query-command.js";

const args = process.argv.slice(2).filter((a) => a !== "--");
let q: string | undefined;
let k: number | undefined;
let mode: string | undefined;
let workspace: string | undefined;
for (let i = 0; i < args.length; i++) {
  const arg = args[i] as string;
  if (arg === "--workspace") {
    workspace = args[++i];
    continue;
  }
  if (arg === "--mode") {
    mode = args[++i];
    continue;
  }
  if (arg === "--k") {
    k = Number.parseInt(args[++i] ?? "", 10);
    continue;
  }
  if (!arg.startsWith("--") && q === undefined) {
    q = arg;
    continue;
  }
  console.error(`[query_memory] unknown argument: ${arg}`);
  process.exit(1);
}

try {
  const result = await runQuery({
    q: q ?? "",
    ...(k !== undefined ? { k } : {}),
    ...(mode !== undefined ? { mode } : {}),
    ...(workspace !== undefined ? { workspace } : {}),
  });
  console.log(JSON.stringify(result));
} catch (e) {
  const code = typeof e === "object" && e !== null && "code" in e ? (e as { code: unknown }).code : "error";
  console.error(`[query_memory] ${String(code)}: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}
