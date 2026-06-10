/**
 * SidecarClient unit tests against the Node stub sidecar — Python-free, so they
 * run under root `pnpm test` (OQ #18).
 */
import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { RetrievalError, SidecarClient } from "../src/index.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUB = path.join(HERE, "stub-sidecar.mjs");

function stubClient(timeoutMs = 5_000): SidecarClient {
  return new SidecarClient({
    command: process.execPath,
    args: [STUB],
    cwd: HERE,
    timeoutMs,
  });
}

async function expectRetrievalError(
  promise: Promise<unknown>,
  code: RetrievalError["code"],
): Promise<RetrievalError> {
  try {
    await promise;
  } catch (error: unknown) {
    assert.ok(error instanceof RetrievalError, `expected RetrievalError, got ${String(error)}`);
    assert.equal(error.code, code);
    return error;
  }
  assert.fail(`expected RetrievalError(${code}) but the promise resolved`);
}

test("ping round-trip resolves with the response data", async () => {
  const client = stubClient();
  try {
    assert.deepEqual(await client.request("ping"), { pong: true });
  } finally {
    await client.close();
  }
});

test("request args reach the sidecar verbatim", async () => {
  const client = stubClient();
  try {
    const data = await client.request("echo", { a: 1, nested: { b: "x" } });
    assert.deepEqual(data, { a: 1, nested: { b: "x" } });
  } finally {
    await client.close();
  }
});

test("out-of-order responses correlate by req_id", async () => {
  const client = stubClient();
  try {
    const slow = client.request("delay", { ms: 150, value: "slow" });
    const fast = client.request("ping");
    const [slowData, fastData] = await Promise.all([slow, fast]);
    assert.deepEqual(slowData, { value: "slow" });
    assert.deepEqual(fastData, { pong: true });
  } finally {
    await client.close();
  }
});

test("unanswered request rejects with timeout", async () => {
  const client = stubClient(200);
  try {
    await expectRetrievalError(client.request("silent"), "timeout");
  } finally {
    await client.close();
  }
});

test("non-JSON sidecar line rejects pending requests with protocol_error", async () => {
  const client = stubClient();
  try {
    await expectRetrievalError(client.request("garbage"), "protocol_error");
  } finally {
    await client.close();
  }
});

test("sidecar {ok:false} rejects with sidecar_error and code passthrough", async () => {
  const client = stubClient();
  try {
    const error = await expectRetrievalError(client.request("fail"), "sidecar_error");
    assert.equal(error.details?.["sidecarCode"], "boom");
    assert.equal(error.message, "kaboom");
  } finally {
    await client.close();
  }
});

test("spawn failure rejects with spawn_failed", async () => {
  const client = new SidecarClient({
    command: "definitely-not-a-real-binary-xyz",
    args: [],
    timeoutMs: 5_000,
  });
  try {
    await expectRetrievalError(client.request("ping"), "spawn_failed");
  } finally {
    await client.close();
  }
});

test("close() is a clean shutdown and later requests are rejected", async () => {
  const client = stubClient();
  assert.deepEqual(await client.request("ping"), { pong: true });
  await client.close();
  await expectRetrievalError(client.request("ping"), "spawn_failed");
});

test("sidecar exit with pending requests rejects them with protocol_error", async () => {
  // stdin EOF makes the stub exit 0 while "silent" is still pending.
  const client = stubClient(10_000);
  const pending = client.request("silent");
  const closed = client.close();
  await expectRetrievalError(pending, "protocol_error");
  await closed;
});

test("a write racing the sidecar's death rejects structured (no EPIPE crash)", async () => {
  // Regression (review MEDIUM #1): EPIPE from writing to a just-killed sidecar
  // fires the write callback AND a stream 'error' event on child.stdin; without
  // a listener the event crashes the whole process instead of rejecting.
  const client = stubClient(5_000);
  try {
    assert.deepEqual(await client.request("ping"), { pong: true });
    const pending = client.request("silent"); // in flight across the death
    process.kill(client.pid as number, "SIGKILL");
    const racing = client.request("ping"); // write hits the closed pipe -> EPIPE
    for (const promise of [pending, racing]) {
      const error = await promise.then(
        () => assert.fail("expected a rejection after the sidecar died"),
        (e: unknown) => e,
      );
      assert.ok(error instanceof RetrievalError, `expected RetrievalError, got ${String(error)}`);
    }
  } finally {
    await client.close();
  }
});
