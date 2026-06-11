/**
 * Tests for the SB-057 `sb fact` command: the human-confirmed L3 write path.
 * add = one event + one row; accept = batch from a reviewed proposal file
 * (invalid file writes NOTHING); list = read-only current facts.
 */
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { MEMORY_EVENTS_RELATIVE_PATH } from "@sb/event-log";
import { FactCliError, runFactAccept, runFactAdd, runFactList } from "../src/fact-command.js";
import { main } from "../src/index.js";

const SRC_A = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const SRC_B = "01BX5ZZKBKACTAV9WEVGEMMVRY";

const tmpDirs: string[] = [];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "sb-fact-"));
  tmpDirs.push(dir);
  return dir;
}

after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

async function memoryEventLines(ws: string): Promise<string[]> {
  const path = join(ws, MEMORY_EVENTS_RELATIVE_PATH);
  if (!existsSync(path)) return [];
  const raw = await readFile(path, "utf8");
  return raw.split("\n").filter((line) => line.trim().length > 0);
}

function proposal(items: unknown[]): Record<string, unknown> {
  return { workflow: "extract_facts", version: 1, proposed_at: "2026-06-10T12:00:00Z", items };
}

function factItem(statement: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    statement,
    source_ref: SRC_A,
    observed_at: "2026-06-10T11:00:00Z",
    confidence: 0.8,
    ...extra,
  };
}

test("fact add writes exactly one event + one current fact with provenance", async () => {
  const ws = await makeWorkspace();
  const result = await runFactAdd({
    statement: "The descale cycle takes 25 minutes.",
    sourceRef: SRC_A,
    observedAt: "2026-06-10T11:00:00Z",
    confidence: 0.9,
    workspace: ws,
  });
  assert.equal(result.ok, true);

  const events = await memoryEventLines(ws);
  assert.equal(events.length, 1);
  const event = JSON.parse(events[0] as string) as Record<string, unknown>;
  assert.equal(event["kind"], "fact_added");
  assert.equal(event["event_id"], result.event_id);

  const list = await runFactList({ workspace: ws });
  assert.equal(list.count, 1);
  const fact = list.facts[0] as Record<string, unknown>;
  assert.equal(fact["id"], result.fact_id);
  assert.equal(fact["source_ref"], SRC_A);
  assert.equal(fact["confidence"], 0.9);
});

test("fact accept writes every item of a reviewed 3-item proposal", async () => {
  const ws = await makeWorkspace();
  const result = await runFactAccept({
    proposal: proposal([
      factItem("Fact one."),
      factItem("Fact two.", { source_ref: SRC_B, confidence: 0.5 }),
      factItem("Fact three."),
    ]),
    workspace: ws,
  });
  assert.equal(result.ok, true);
  assert.equal(result.written, 3);
  assert.equal(result.failed.length, 0);
  assert.equal((await memoryEventLines(ws)).length, 3);
  const list = await runFactList({ workspace: ws });
  assert.equal(list.count, 3);
  for (const fact of list.facts as Array<Record<string, unknown>>) {
    assert.ok(typeof fact["source_ref"] === "string" && (fact["source_ref"] as string).length === 26);
    assert.ok(typeof fact["confidence"] === "number");
  }
});

test("an invalid proposal file is rejected writing NOTHING", async () => {
  const ws = await makeWorkspace();
  const bad: Array<unknown> = [
    proposal([factItem("ok"), factItem("bad", { confidence: 1.5 })]), // one bad item poisons the file
    proposal([factItem("bad", { source_ref: "not-a-ulid" })]),
    proposal([]),
    { ...proposal([factItem("x")]), workflow: "compose_output" },
    { ...proposal([factItem("x")]), version: 2 },
  ];
  for (const p of bad) {
    await assert.rejects(
      runFactAccept({ proposal: p, workspace: ws }),
      (e: unknown) => e instanceof FactCliError && e.code === "invalid_proposal",
    );
  }
  assert.equal((await memoryEventLines(ws)).length, 0, "no events for invalid proposals");
  assert.equal(existsSync(join(ws, "vault")), false, "facts never touch the vault");
  assert.equal((await runFactList({ workspace: ws })).count, 0);
});

test("supersede via accept repoints the current view; old fact row is retained", async () => {
  const ws = await makeWorkspace();
  const first = await runFactAdd({ statement: "Takes 25 minutes.", sourceRef: SRC_A, workspace: ws });
  const result = await runFactAccept({
    proposal: proposal([factItem("Takes 30 minutes.", { supersedes: first.fact_id })]),
    workspace: ws,
  });
  assert.equal(result.ok, true);
  const list = await runFactList({ workspace: ws });
  assert.equal(list.count, 1);
  assert.equal((list.facts[0] as Record<string, unknown>)["statement"], "Takes 30 minutes.");
  const events = await memoryEventLines(ws);
  assert.equal(events.length, 2);
  assert.equal((JSON.parse(events[1] as string) as Record<string, unknown>)["kind"], "fact_superseded");
});

test("a runtime per-item failure (missing supersede target) is reported; others still write", async () => {
  const ws = await makeWorkspace();
  const result = await runFactAccept({
    proposal: proposal([
      factItem("Good fact."),
      factItem("Bad supersede.", { supersedes: SRC_B }), // SRC_B is not an existing fact id
    ]),
    workspace: ws,
  });
  assert.equal(result.ok, false);
  assert.equal(result.written, 1);
  assert.equal(result.failed.length, 1);
  assert.equal(result.failed[0]?.index, 1);
  assert.equal((await runFactList({ workspace: ws })).count, 1);
});

test("fact list filters by source_ref and min-confidence", async () => {
  const ws = await makeWorkspace();
  await runFactAdd({ statement: "A.", sourceRef: SRC_A, confidence: 0.9, workspace: ws });
  await runFactAdd({ statement: "B.", sourceRef: SRC_B, confidence: 0.4, workspace: ws });
  assert.equal((await runFactList({ workspace: ws, sourceRef: SRC_A })).count, 1);
  assert.equal((await runFactList({ workspace: ws, minConfidence: 0.5 })).count, 1);
  assert.equal((await runFactList({ workspace: ws, limit: 1 })).count, 1);
});

test("main() round-trip: fact add / accept --file / list through the CLI surface", async () => {
  const ws = await makeWorkspace();
  let stdout = "";
  const io = { out: (t: string) => void (stdout += t), err: (t: string) => void (stdout += t) };

  assert.equal(
    await main(
      ["fact", "add", "--statement", "CLI fact.", "--source-ref", SRC_A, "--confidence", "0.7", "--workspace", ws],
      io,
    ),
    0,
  );

  const file = join(ws, "proposal.json");
  await writeFile(file, JSON.stringify(proposal([factItem("Accepted fact.")])), "utf8");
  assert.equal(await main(["fact", "accept", "--file", file, "--workspace", ws], io), 0);

  stdout = "";
  assert.equal(await main(["fact", "list", "--workspace", ws], io), 0);
  const list = JSON.parse(stdout) as { ok: boolean; count: number };
  assert.equal(list.ok, true);
  assert.equal(list.count, 2);

  // bad arguments surface as structured envelopes with exit 1
  stdout = "";
  assert.equal(await main(["fact", "add", "--statement", "no provenance", "--workspace", ws], io), 1);
  assert.match(stdout, /bad_arguments/);
});
