/**
 * Tests for the SB-038 replay rebuild command. `runRebuild` reconstructs all L3
 * projections from the event log (facts) + the vault (entities/edges/tasks),
 * emits projection_reset + projection_rebuilt, and never touches 00_Raw or the
 * capture/memory event streams.
 */
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { addFact, listCurrentFacts } from "@sb/fact-store";
import { listEntityNodes, listEntityEdges } from "@sb/entity-graph";
import { listTasks } from "@sb/task-store";
import { runCapture } from "../src/capture-command.js";
import { runRebuild } from "../src/rebuild-command.js";

const SRC = "01KTF8SRC00000000000000000";
const A_ENT = "01KTF8AAAA0000000000000000";
const B_ENT = "01KTF8BBBB0000000000000000";
const TASK = "01KTF8TASK0000000000000000";

const tmpDirs: string[] = [];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "sb-rebuild-"));
  tmpDirs.push(dir);
  return dir;
}

async function seedNote(ws: string, folder: string, id: string, fm: string): Promise<void> {
  const dir = join(ws, "vault", folder);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${id}.md`), `---\n${fm}\n---\n\nbody`, "utf8");
}

async function readMaybe(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

/** Populate a workspace with L0 (capture), L3 fact events, entity notes, and a task note. */
async function populate(ws: string): Promise<void> {
  await runCapture({ workspace: ws, content: "raw material", source: "paste" });
  await addFact({ workspace: ws, statement: "fact one", source_ref: SRC, observed_at: "2026-06-05T09:00:00Z", confidence: 0.8, now: "2026-06-05T10:00:00Z" });
  await addFact({ workspace: ws, statement: "fact two", source_ref: SRC, observed_at: "2026-06-05T09:00:00Z", confidence: 0.6, now: "2026-06-05T10:01:00Z" });
  await seedNote(ws, "50_Entities", A_ENT, `id: ${A_ENT}\ntype: entity\nlayer: 2\ntitle: "Acme"\nentities:\n  - ${JSON.stringify(B_ENT)}\ncreated: "2026-06-05T08:00:00Z"`);
  await seedNote(ws, "50_Entities", B_ENT, `id: ${B_ENT}\ntype: entity\nlayer: 2\ntitle: "Beta"\ncreated: "2026-06-05T08:00:00Z"`);
  await seedNote(ws, "10_Projects", TASK, `id: ${TASK}\ntype: project\nlayer: 1\ntitle: "Ship it"\nstatus: active\ncreated: "2026-06-05T08:00:00Z"`);
}

after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

test("rebuild reconstructs facts/entities/edges/tasks and emits projection events", async () => {
  const ws = await makeWorkspace();
  await populate(ws);

  const result = await runRebuild({ workspace: ws, now: "2026-06-05T12:00:00Z" });
  assert.deepEqual(result.counts, { facts: 2, entities: 2, edges: 1, tasks: 1 });

  assert.equal(listCurrentFacts({ workspace: ws }).length, 2);
  assert.equal(listEntityNodes(ws).length, 2);
  assert.equal(listEntityEdges(ws).length, 1);
  assert.equal(listTasks(ws).length, 1);

  // projection stream has projection_reset then projection_rebuilt
  const lines = (await readFile(join(ws, "events", "projection_events.jsonl"), "utf8"))
    .split("\n")
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l));
  assert.deepEqual(lines.map((e) => e.kind), ["projection_reset", "projection_rebuilt"]);
  assert.deepEqual(lines[1].payload, { facts: 2, entities: 2, edges: 1, tasks: 1 });
});

test("rebuild never modifies 00_Raw or the capture/memory event streams", async () => {
  const ws = await makeWorkspace();
  await populate(ws);

  const rawDir = join(ws, "vault", "00_Raw");
  const rawFiles = await readdir(rawDir);
  const rawBytes = await Promise.all(rawFiles.map((f) => readFile(join(rawDir, f))));
  const captureBefore = await readMaybe(join(ws, "events", "capture_events.jsonl"));
  const memoryBefore = await readMaybe(join(ws, "events", "memory_events.jsonl"));

  await runRebuild({ workspace: ws, now: "2026-06-05T12:00:00Z" });

  assert.deepEqual(await readdir(rawDir), rawFiles, "raw file set changed");
  const rawAfter = await Promise.all(rawFiles.map((f) => readFile(join(rawDir, f))));
  rawAfter.forEach((buf, i) => assert.ok(buf.equals(rawBytes[i]!), "raw bytes changed"));
  assert.equal(await readMaybe(join(ws, "events", "capture_events.jsonl")), captureBefore);
  assert.equal(await readMaybe(join(ws, "events", "memory_events.jsonl")), memoryBefore);
});

test("a failed rebuild rolls back: projections and events exactly as before (SB-043)", async () => {
  const BAD_ENT = "01KTF8BADC0000000000000000";
  const ws = await makeWorkspace();
  await populate(ws);

  // Baseline: one good rebuild, then snapshot projections + the projection stream.
  await runRebuild({ workspace: ws, now: "2026-06-09T12:00:00Z" });
  const factsBefore = listCurrentFacts({ workspace: ws });
  const nodesBefore = listEntityNodes(ws);
  const edgesBefore = listEntityEdges(ws);
  const tasksBefore = listTasks(ws);
  const eventsPath = join(ws, "events", "projection_events.jsonl");
  const eventsBefore = await readFile(eventsPath, "utf8");

  // Fault injection: a title-less entity note makes projectEntities throw
  // mid-rebuild — after the table reset and the fact re-inserts.
  await seedNote(ws, "50_Entities", BAD_ENT, `id: ${BAD_ENT}\ntype: entity\nlayer: 2\ncreated: "2026-06-09T08:00:00Z"`);
  await assert.rejects(runRebuild({ workspace: ws, now: "2026-06-09T13:00:00Z" }), /has no title/);

  // Rolled back: every projection table is row-identical to the baseline …
  assert.deepEqual(listCurrentFacts({ workspace: ws }), factsBefore);
  assert.deepEqual(listEntityNodes(ws), nodesBefore);
  assert.deepEqual(listEntityEdges(ws), edgesBefore);
  assert.deepEqual(listTasks(ws), tasksBefore);
  // … and the failed run appended no projection events (no reset, no rebuilt).
  assert.equal(await readFile(eventsPath, "utf8"), eventsBefore);
});

test("rebuild is idempotent (same projection rows on a second run)", async () => {
  const ws = await makeWorkspace();
  await populate(ws);
  const first = await runRebuild({ workspace: ws, now: "2026-06-05T12:00:00Z" });
  const second = await runRebuild({ workspace: ws, now: "2026-06-05T13:00:00Z" });
  assert.deepEqual(second.counts, first.counts);
  assert.equal(listCurrentFacts({ workspace: ws }).length, 2);
  assert.equal(listEntityNodes(ws).length, 2);
});
