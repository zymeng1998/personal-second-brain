/**
 * SB-054 — the EPIC-CORE-009 "Done when" gate (mirrors SB-039 for L4):
 * populate -> index -> snapshot a fixed query set -> DELETE `indexes/` entirely
 * -> index again -> the same query set returns IDENTICAL ranked results, with
 * L0 raw + capture/memory streams byte-unchanged throughout.
 *
 * Env-gated (real Python sidecar + embedding model); part of `test:sidecar`,
 * never of root `pnpm test`. Skips visibly when the sidecar env is absent.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { DEFAULT_SIDECAR_CWD } from "@sb/retrieval";
import { runCapture } from "../src/capture-command.js";
import { runIndex } from "../src/index-command.js";
import { runQuery, type QueryResult } from "../src/query-command.js";

function sidecarEnvReady(): boolean {
  if (!existsSync(join(DEFAULT_SIDECAR_CWD, "pyproject.toml"))) return false;
  return spawnSync("uv", ["--version"], { stdio: "ignore" }).status === 0;
}

const skip = sidecarEnvReady() ? false : "SKIP: sidecar env absent (need uv + sidecars/retrieval)";
const SIDECAR = { timeoutMs: 180_000 };

const ENTITY = "01KTF8AAAA0000000000000000";
const TASK = "01KTF8TASK0000000000000000";

// fixed query set: exact-term, semantic paraphrase, and multi-word — across all modes
const QUERIES: ReadonlyArray<{ q: string; mode: "lexical" | "vector" | "hybrid" }> = [
  { q: "espresso grind", mode: "lexical" },
  { q: "espresso grind", mode: "hybrid" },
  { q: "automobile servicing", mode: "vector" },
  { q: "automobile servicing", mode: "hybrid" },
  { q: "quarterly planning budget", mode: "hybrid" },
];

const tmpDirs: string[] = [];

after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

async function seedNote(ws: string, folder: string, id: string, fm: string, body: string): Promise<void> {
  const dir = join(ws, "vault", folder);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${id}.md`), `---\n${fm}\n---\n\n${body}`, "utf8");
}

async function populate(ws: string): Promise<void> {
  await runCapture({ workspace: ws, content: "Notes about espresso extraction and grind size.", source: "paste", title: "Espresso brewing" });
  await runCapture({ workspace: ws, content: "Changing the engine oil and rotating tires regularly.", source: "paste", title: "Car upkeep" });
  await seedNote(ws, "50_Entities", ENTITY, `id: ${ENTITY}\ntype: entity\nlayer: 2\ntitle: "Acme"\ncreated: "2026-06-10T08:00:00Z"`, "Acme is the espresso machine vendor.");
  await seedNote(ws, "10_Projects", TASK, `id: ${TASK}\ntype: project\nlayer: 1\ntitle: "Quarterly plan"\nstatus: active\ncreated: "2026-06-10T08:00:00Z"`, "Quarterly planning discussion and machine budget.");
}

async function runQuerySet(ws: string): Promise<QueryResult[]> {
  const results: QueryResult[] = [];
  for (const { q, mode } of QUERIES) {
    results.push(await runQuery({ q, mode, k: 10, workspace: ws, sidecar: SIDECAR }));
  }
  return results;
}

async function snapshotProtected(ws: string): Promise<Record<string, string>> {
  const snapshot: Record<string, string> = {};
  const rawDir = join(ws, "vault", "00_Raw");
  for (const file of (await readdir(rawDir)).sort()) {
    snapshot[`raw:${file}`] = await readFile(join(rawDir, file), "utf8");
  }
  for (const stream of ["capture_events.jsonl", "memory_events.jsonl"]) {
    try {
      snapshot[`events:${stream}`] = await readFile(join(ws, "events", stream), "utf8");
    } catch {
      snapshot[`events:${stream}`] = "<absent>";
    }
  }
  return snapshot;
}

test("EPIC GATE: delete indexes/ and rebuild -> identical ranked results", { skip }, async () => {
  const ws = await mkdtemp(join(tmpdir(), "sb-gate-"));
  tmpDirs.push(ws);
  await populate(ws);

  const protectedBefore = await snapshotProtected(ws);

  const firstBuild = await runIndex({ workspace: ws, sidecar: SIDECAR });
  assert.equal(firstBuild.counts.notes, 4);
  assert.deepEqual(firstBuild.built, ["fts", "vector"]);
  const baseline = await runQuerySet(ws);
  assert.ok(
    baseline.some((r) => r.hits.length > 0),
    "baseline query set must produce hits",
  );

  // THE GATE: delete the entire indexes/ tree, rebuild, re-run the same queries.
  await rm(join(ws, "indexes"), { recursive: true, force: true });
  assert.equal(existsSync(join(ws, "indexes")), false);

  const secondBuild = await runIndex({ workspace: ws, sidecar: SIDECAR });
  assert.deepEqual(secondBuild.counts, firstBuild.counts);
  const rebuilt = await runQuerySet(ws);

  assert.deepEqual(rebuilt, baseline, "rebuild must be lossless: identical ranked results");

  // L0 + capture/memory streams byte-unchanged; projection stream = exactly the 2 indexed events.
  assert.deepEqual(await snapshotProtected(ws), protectedBefore);
  const projection = (await readFile(join(ws, "events", "projection_events.jsonl"), "utf8"))
    .split("\n")
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l));
  assert.deepEqual(projection.map((e) => e.kind), ["indexed", "indexed"]);
});
