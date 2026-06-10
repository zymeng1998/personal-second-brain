/**
 * queryMemory facade unit tests against the Node stub sidecar (Python-free).
 */
import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

import { RetrievalError, SidecarClient, queryMemory } from "../src/index.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUB = path.join(HERE, "stub-sidecar.mjs");
const SIDECAR = { command: process.execPath, args: [STUB], cwd: HERE, timeoutMs: 5_000 };

const tmpDirs: string[] = [];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "sb-qm-"));
  tmpDirs.push(dir);
  return dir;
}

after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

async function expectError(promise: Promise<unknown>, code: RetrievalError["code"]): Promise<void> {
  await assert.rejects(promise, (e: unknown) => e instanceof RetrievalError && e.code === code);
}

test("maps hits and defaults mode to hybrid", async () => {
  const ws = await makeWorkspace();
  const result = await queryMemory({ workspace: ws, q: "espresso", sidecar: SIDECAR });
  assert.equal(result.hits.length, 1);
  const hit = result.hits[0];
  assert.equal(hit?.id, "01ARZ3NDEKTSV4RRFFQ69G5FAV#0");
  assert.equal(hit?.source_ref, "01ARZ3NDEKTSV4RRFFQ69G5FAV");
  assert.equal(hit?.score, 1.5);
  assert.equal(hit?.snippet, "hybrid|espresso|none"); // mode defaulted (SB-049), k omitted
});

test("k and mode pass through to the sidecar", async () => {
  const ws = await makeWorkspace();
  const result = await queryMemory({ workspace: ws, q: "x", k: 3, mode: "hybrid", sidecar: SIDECAR });
  assert.equal(result.hits[0]?.snippet, "hybrid|x|3");
});

test("filters pass through to the sidecar verbatim (SB-055)", async () => {
  const ws = await makeWorkspace();
  const filters = { from: "2026-01-01T00:00:00Z", to: "2026-12-31T00:00:00Z" };
  const result = await queryMemory({ workspace: ws, q: "x", filters, sidecar: SIDECAR });
  assert.equal(result.hits[0]?.snippet, `hybrid|x|none|${JSON.stringify(filters)}`);
});

test("arg validation rejects empty q / bad k / missing workspace", async () => {
  const ws = await makeWorkspace();
  await expectError(queryMemory({ workspace: ws, q: "  ", sidecar: SIDECAR }), "invalid_args");
  await expectError(queryMemory({ workspace: ws, q: "x", k: 0, sidecar: SIDECAR }), "invalid_args");
  await expectError(queryMemory({ workspace: "", q: "x", sidecar: SIDECAR }), "invalid_args");
});

test("sidecar error passes through as sidecar_error", async () => {
  const ws = await makeWorkspace();
  await expectError(queryMemory({ workspace: ws, q: "boom", sidecar: SIDECAR }), "sidecar_error");
});

test("malformed hits are a protocol_error", async () => {
  const ws = await makeWorkspace();
  await expectError(queryMemory({ workspace: ws, q: "badshape", sidecar: SIDECAR }), "protocol_error");
  await expectError(queryMemory({ workspace: ws, q: "nohits", sidecar: SIDECAR }), "protocol_error");
});

test("query writes nothing into the workspace", async () => {
  const ws = await makeWorkspace();
  await queryMemory({ workspace: ws, q: "espresso", sidecar: SIDECAR });
  assert.deepEqual(await readdir(ws), []);
});

test("an injected client is reused across calls and left open (caller owns it)", async () => {
  // Review MEDIUM #4: batch callers pay the sidecar spawn + model load once.
  const ws = await makeWorkspace();
  const client = new SidecarClient(SIDECAR);
  try {
    const first = await queryMemory({ workspace: ws, q: "alpha", client });
    const second = await queryMemory({ workspace: ws, q: "beta", mode: "lexical", client });
    assert.equal(first.hits[0]?.snippet, "hybrid|alpha|none");
    assert.equal(second.hits[0]?.snippet, "lexical|beta|none");
    // still open after queryMemory: a direct request on the same transport works
    assert.deepEqual(await client.request("ping"), { pong: true });
  } finally {
    await client.close();
  }
});
