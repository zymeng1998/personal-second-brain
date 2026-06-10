/**
 * Tests for the SB-032 `query` command. Python-free (Node stub sidecar).
 * Read-only is the core guarantee: no events, no workspace writes.
 */
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { RetrievalError } from "@sb/retrieval";
import { QueryCliError, runQuery } from "../src/query-command.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const STUB = join(HERE, "stub-index-sidecar.mjs");

const tmpDirs: string[] = [];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "sb-query-"));
  tmpDirs.push(dir);
  return dir;
}

function stubSidecar(mode: "ok" | "fail" = "ok") {
  if (mode !== "ok") process.env["STUB_SIDECAR_MODE"] = mode;
  else delete process.env["STUB_SIDECAR_MODE"];
  return { command: process.execPath, args: [STUB], cwd: HERE, timeoutMs: 5_000 };
}

after(async () => {
  delete process.env["STUB_SIDECAR_MODE"];
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

test("query maps ranked hits with provenance", async () => {
  const ws = await makeWorkspace();
  const result = await runQuery({ q: "espresso", workspace: ws, sidecar: stubSidecar() });
  assert.equal(result.ok, true);
  assert.equal(result.hits.length, 2);
  assert.equal(result.hits[0]?.id, "01ARZ3NDEKTSV4RRFFQ69G5FAV#0");
  assert.equal(result.hits[0]?.source_ref, "01ARZ3NDEKTSV4RRFFQ69G5FAV");
  assert.ok((result.hits[0]?.score ?? 0) > (result.hits[1]?.score ?? 0));
});

test("argument validation: empty q, bad k, unknown mode", async () => {
  const ws = await makeWorkspace();
  const base = { workspace: ws, sidecar: stubSidecar() };
  await assert.rejects(
    runQuery({ ...base, q: "  " }),
    (e: unknown) => e instanceof QueryCliError && e.code === "bad_arguments",
  );
  await assert.rejects(
    runQuery({ ...base, q: "x", k: 0 }),
    (e: unknown) => e instanceof QueryCliError && e.code === "bad_arguments",
  );
  await assert.rejects(
    runQuery({ ...base, q: "x", mode: "psychic" }),
    (e: unknown) => e instanceof QueryCliError && e.code === "bad_arguments",
  );
});

test("sidecar errors pass through structured", async () => {
  const ws = await makeWorkspace();
  await assert.rejects(
    runQuery({ q: "x", workspace: ws, sidecar: stubSidecar("fail") }),
    (e: unknown) => e instanceof RetrievalError && e.code === "sidecar_error",
  );
});

test("query writes nothing: no events dir, empty workspace untouched", async () => {
  const ws = await makeWorkspace();
  await runQuery({ q: "espresso", workspace: ws, sidecar: stubSidecar() });
  assert.deepEqual(await readdir(ws), []);
});
