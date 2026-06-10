/**
 * Env-gated integration test (OQ #18): a real ping/health round-trip against the
 * Python sidecar via `uv run`. Skips VISIBLY when the sidecar env is absent so
 * `pnpm run test:sidecar` is safe on any machine. Never wired into root `pnpm test`.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { DEFAULT_SIDECAR_CWD, SidecarClient } from "../src/index.js";

function sidecarEnvReady(): boolean {
  if (!existsSync(path.join(DEFAULT_SIDECAR_CWD, "pyproject.toml"))) return false;
  const uv = spawnSync("uv", ["--version"], { stdio: "ignore" });
  return uv.status === 0;
}

const ready = sidecarEnvReady();
const skip = ready ? false : "SKIP: sidecar env absent (need uv + sidecars/retrieval)";

test("real sidecar: ping + health round-trip over stdio JSONL", { skip }, async () => {
  // generous timeout: the first `uv run` may have to sync the environment
  const client = new SidecarClient({ timeoutMs: 120_000 });
  try {
    assert.deepEqual(await client.request("ping"), { pong: true });
    const health = await client.request("health");
    assert.equal(typeof health["version"], "string");
    assert.match(String(health["python"]), /^3\.(1[1-9]|[2-9][0-9])\./);
  } finally {
    await client.close();
  }
});
