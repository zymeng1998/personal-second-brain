/**
 * Tests for the SB-053 `index` command. Python-free: the sidecar is a Node stub.
 * Asserts the TS-emitted `indexed` event, failure -> no event, and the read-only
 * guarantees over raw + capture/memory streams.
 */
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { RetrievalError } from "@sb/retrieval";
import { runCapture } from "../src/capture-command.js";
import { IndexCliError, runIndex } from "../src/index-command.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const STUB = join(HERE, "stub-index-sidecar.mjs");

const tmpDirs: string[] = [];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "sb-index-"));
  tmpDirs.push(dir);
  return dir;
}

function stubSidecar(mode: "ok" | "fail" = "ok") {
  if (mode !== "ok") process.env["STUB_SIDECAR_MODE"] = mode;
  else delete process.env["STUB_SIDECAR_MODE"];
  return { command: process.execPath, args: [STUB], cwd: HERE, timeoutMs: 5_000 };
}

async function readMaybe(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

after(async () => {
  delete process.env["STUB_SIDECAR_MODE"];
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

test("one successful run appends exactly one indexed event with counts", async () => {
  const ws = await makeWorkspace();
  const result = await runIndex({ workspace: ws, now: "2026-06-10T12:00:00Z", sidecar: stubSidecar() });

  assert.equal(result.ok, true);
  assert.deepEqual(result.counts, { notes: 2, chunks: 3 });
  assert.deepEqual(result.built, ["fts"]);

  const lines = (await readFile(join(ws, "events", "projection_events.jsonl"), "utf8"))
    .split("\n")
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l));
  assert.equal(lines.length, 1);
  assert.equal(lines[0].kind, "indexed");
  assert.equal(lines[0].actor, "cli");
  assert.equal(lines[0].event_id, result.event_id);
  assert.deepEqual(lines[0].payload, { notes: 2, chunks: 3, built: ["fts"] });
});

test("sidecar failure -> structured error and NO event", async () => {
  const ws = await makeWorkspace();
  await assert.rejects(
    runIndex({ workspace: ws, sidecar: stubSidecar("fail") }),
    (e: unknown) => e instanceof RetrievalError && e.code === "sidecar_error",
  );
  assert.equal(await readMaybe(join(ws, "events", "projection_events.jsonl")), null);
});

test("invalid sidecar counts -> bad_sidecar_result and NO event", async () => {
  const ws = await makeWorkspace();
  // inline stub that answers every op with ok:true but an empty data object
  const inline = [
    "-e",
    `const rl=require('readline').createInterface({input:process.stdin});
     rl.on('line',(l)=>{const r=JSON.parse(l);process.stdout.write(JSON.stringify({req_id:r.req_id,ok:true,data:{}})+'\\n')});
     rl.on('close',()=>process.exit(0));`,
  ];
  await assert.rejects(
    runIndex({ workspace: ws, sidecar: { command: process.execPath, args: inline, timeoutMs: 5_000 } }),
    (e: unknown) => e instanceof IndexCliError && e.code === "bad_sidecar_result",
  );
  assert.equal(await readMaybe(join(ws, "events", "projection_events.jsonl")), null);
});

test("index never modifies raw notes or the capture/memory event streams", async () => {
  const ws = await makeWorkspace();
  await runCapture({ workspace: ws, content: "raw material to protect", source: "paste" });

  const rawDir = join(ws, "vault", "00_Raw");
  const rawFilesBefore = await readdir(rawDir);
  const rawBytesBefore = await readFile(join(rawDir, rawFilesBefore[0] as string), "utf8");
  const captureBefore = await readMaybe(join(ws, "events", "capture_events.jsonl"));
  const memoryBefore = await readMaybe(join(ws, "events", "memory_events.jsonl"));

  await runIndex({ workspace: ws, sidecar: stubSidecar() });

  assert.deepEqual(await readdir(rawDir), rawFilesBefore);
  assert.equal(await readFile(join(rawDir, rawFilesBefore[0] as string), "utf8"), rawBytesBefore);
  assert.equal(await readMaybe(join(ws, "events", "capture_events.jsonl")), captureBefore);
  assert.equal(await readMaybe(join(ws, "events", "memory_events.jsonl")), memoryBefore);
});

test("repeated runs append (never rewrite) the projection stream", async () => {
  const ws = await makeWorkspace();
  const first = await runIndex({ workspace: ws, sidecar: stubSidecar() });
  const afterFirst = await readFile(join(ws, "events", "projection_events.jsonl"), "utf8");
  const second = await runIndex({ workspace: ws, sidecar: stubSidecar() });
  const afterSecond = await readFile(join(ws, "events", "projection_events.jsonl"), "utf8");

  assert.notEqual(first.event_id, second.event_id);
  assert.ok(afterSecond.startsWith(afterFirst), "earlier lines must be byte-unchanged");
  assert.equal(afterSecond.trim().split("\n").length, 2);
});
