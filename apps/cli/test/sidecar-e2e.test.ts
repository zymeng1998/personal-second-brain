/**
 * Env-gated E2E (SB-032, OQ #18): capture → sb index → sb query against the
 * REAL Python sidecar. Runs only under `pnpm run test:sidecar`; skips visibly
 * when the sidecar env (uv) is absent. Never part of root `pnpm test`.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { DEFAULT_SIDECAR_CWD } from "@sb/retrieval";
import { runCapture } from "../src/capture-command.js";
import { runIndex } from "../src/index-command.js";
import { runQuery } from "../src/query-command.js";

function sidecarEnvReady(): boolean {
  if (!existsSync(join(DEFAULT_SIDECAR_CWD, "pyproject.toml"))) return false;
  return spawnSync("uv", ["--version"], { stdio: "ignore" }).status === 0;
}

const skip = sidecarEnvReady() ? false : "SKIP: sidecar env absent (need uv + sidecars/retrieval)";
const SIDECAR = { timeoutMs: 120_000 }; // first uv run may sync the env

const tmpDirs: string[] = [];

after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

test("E2E: capture -> index -> query returns the captured note with provenance", { skip }, async () => {
  const ws = await mkdtemp(join(tmpdir(), "sb-e2e-"));
  tmpDirs.push(ws);

  const captured = await runCapture({
    workspace: ws,
    content: "The xylophone maintenance schedule lives in the workshop binder.",
    source: "paste",
    title: "Xylophone upkeep",
  });

  const indexed = await runIndex({ workspace: ws, sidecar: SIDECAR });
  assert.equal(indexed.counts.notes, 1);
  assert.ok(indexed.counts.chunks >= 1);

  const result = await runQuery({ q: "xylophone", workspace: ws, sidecar: SIDECAR });
  assert.ok(result.hits.length >= 1, "expected the captured note to be found");
  assert.equal(result.hits[0]?.source_ref, captured.note_id);
  assert.ok(result.hits[0]?.id.startsWith(`${captured.note_id}#`));
  assert.ok((result.hits[0]?.snippet ?? "").toLowerCase().includes("xylophone"));

  // exactly one indexed event, and query appended nothing
  const lines = (await readFile(join(ws, "events", "projection_events.jsonl"), "utf8"))
    .split("\n")
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l));
  assert.deepEqual(lines.map((e) => e.kind), ["indexed"]);
});
