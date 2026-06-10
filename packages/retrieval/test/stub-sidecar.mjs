/**
 * Stub sidecar (Node) implementing the stdio JSONL protocol, so the transport
 * unit tests stay Python-free. Behavior is selected per request `op`:
 *   ping            -> {pong:true}
 *   echo            -> data = args
 *   delay {ms,value}-> responds after ms (drives the out-of-order test)
 *   fail            -> {ok:false, error:{code:"boom", message:"kaboom"}}
 *   garbage         -> writes a non-JSON stdout line (protocol violation)
 *   silent          -> never responds (drives the timeout test)
 * EOF on stdin -> exit 0.
 */
import readline from "node:readline";

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
  const { op, req_id, args = {} } = request;
  switch (op) {
    case "ping":
      respond({ req_id, ok: true, data: { pong: true } });
      break;
    case "echo":
      respond({ req_id, ok: true, data: args });
      break;
    case "delay":
      setTimeout(() => respond({ req_id, ok: true, data: { value: args.value } }), args.ms);
      break;
    case "fail":
      respond({ req_id, ok: false, error: { code: "boom", message: "kaboom" } });
      break;
    case "garbage":
      process.stdout.write("this is not json\n");
      break;
    case "silent":
      break;
    case "query": {
      // facade tests: snippet encodes the received args; magic q values force errors
      if (args.q === "boom") {
        respond({ req_id, ok: false, error: { code: "query_failed", message: "stub query failure" } });
        break;
      }
      if (args.q === "badshape") {
        respond({ req_id, ok: true, data: { hits: [{ wrong: true }] } });
        break;
      }
      if (args.q === "nohits") {
        respond({ req_id, ok: true, data: {} });
        break;
      }
      respond({
        req_id,
        ok: true,
        data: {
          hits: [
            {
              id: "01ARZ3NDEKTSV4RRFFQ69G5FAV#0",
              score: 1.5,
              snippet:
                `${args.mode}|${args.q}|${args.k ?? "none"}` +
                (args.filters !== undefined ? `|${JSON.stringify(args.filters)}` : ""),
              source_ref: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
            },
          ],
        },
      });
      break;
    }
    default:
      respond({ req_id, ok: false, error: { code: "unknown_op", message: `unknown op: ${op}` } });
  }
});

rl.on("close", () => process.exit(0));
