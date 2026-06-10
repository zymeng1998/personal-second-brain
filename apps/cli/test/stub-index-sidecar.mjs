/**
 * Stub sidecar (Node) for the `sb index`/`sb query` CLI tests — Python-free.
 * Behavior switches on STUB_SIDECAR_MODE:
 *   ok (default) -> index_vault: {notes:2, chunks:3, built:["fts"]};
 *                   query: two ranked hits
 *   fail         -> every op: {ok:false, error:{code:"index_build_failed", ...}}
 * The stub NEVER touches the filesystem (asserting the CLI's own writes only).
 */
import readline from "node:readline";

const mode = process.env.STUB_SIDECAR_MODE ?? "ok";
const rl = readline.createInterface({ input: process.stdin });

function respond(envelope) {
  process.stdout.write(JSON.stringify(envelope) + "\n");
}

rl.on("line", (line) => {
  if (line.trim() === "") return;
  let request;
  try {
    request = JSON.parse(line);
  } catch {
    respond({ req_id: "", ok: false, error: { code: "malformed_request", message: "bad json" } });
    return;
  }
  const { op, req_id } = request;
  if (mode === "fail") {
    respond({ req_id, ok: false, error: { code: "index_build_failed", message: "stub failure" } });
    return;
  }
  if (op === "index_vault") {
    respond({ req_id, ok: true, data: { notes: 2, chunks: 3, built: ["fts"] } });
    return;
  }
  if (op === "query") {
    respond({
      req_id,
      ok: true,
      data: {
        hits: [
          { id: "01ARZ3NDEKTSV4RRFFQ69G5FAV#0", score: 2.5, snippet: "alpha", source_ref: "01ARZ3NDEKTSV4RRFFQ69G5FAV" },
          { id: "01BX5ZZKBKACTAV9WEVGEMMVRY#1", score: 1.25, snippet: "beta", source_ref: "01BX5ZZKBKACTAV9WEVGEMMVRY" },
        ],
      },
    });
    return;
  }
  respond({ req_id, ok: false, error: { code: "unknown_op", message: `unknown op: ${op}` } });
});

rl.on("close", () => process.exit(0));
