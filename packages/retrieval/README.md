# @sb/retrieval

TypeScript **facade** over the Python retrieval sidecar (`sidecars/retrieval`). The actual
embedding/indexing/search happens in Python; this package owns the **stdio JSONL transport**
and (from SB-053/SB-032) the `indexVault`/`queryMemory` facade operations from `@sb/interfaces`.

- Indexes are **L4 — disposable / rebuildable**. This package never owns the source of truth.
- Events stay TS-owned: the CLI (not the sidecar, not this client) appends the `indexed` event.
- See [`docs/architecture/retrieval_strategy.md`](../../docs/architecture/retrieval_strategy.md) and
  [`docs/architecture/sidecar_contract.md`](../../docs/architecture/sidecar_contract.md).

## SidecarClient (SB-048)

```ts
import { SidecarClient } from "@sb/retrieval";

const client = new SidecarClient(); // spawns `uv run python -m retrieval_sidecar` on first request
const data = await client.request("ping"); // { pong: true }
await client.close();
```

- One JSON request per stdin line; responses correlate by `req_id` (out-of-order safe).
- Per-request timeout (default 30s) → `RetrievalError("timeout")`.
- Structured failures: `spawn_failed` (command missing / client closed), `protocol_error`
  (non-envelope stdout line, unexpected exit), `sidecar_error` (sidecar `{ok:false}`;
  the sidecar's own code is in `details.sidecarCode`).
- `close()` is graceful: stdin EOF → wait → SIGKILL after a grace period.
- Spawn defaults are overridable (`command`/`args`/`cwd`) — the unit tests run against a
  Node stub sidecar so root `pnpm test` stays Python-free.

## Tests

- `pnpm --filter @sb/retrieval test` — stub-sidecar unit tests (Python-free, in root `pnpm test`).
- `pnpm run test:sidecar` (root) — env-gated integration: real `ping`/`health` round-trip via
  `uv run`; **visible SKIP** when uv or the sidecar env is absent.
