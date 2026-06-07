/**
 * Tests for the SB-036 supersede path. supersedeFact records a correction as a
 * NEW fact referencing the old via `supersedes`; the old row is never modified;
 * the current view excludes superseded facts; chains resolve to the latest.
 */
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { openProjectionStore } from "@sb/memory-kernel";
import { addFact, supersedeFact, listCurrentFacts, FactStoreError } from "../src/index.js";

const SRC = "01KT6C7GH0PM1K6XQH3K6ZG8BT";
const tmpDirs: string[] = [];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "sb-fact-supersede-"));
  tmpDirs.push(dir);
  return dir;
}

function base(ws: string) {
  return { workspace: ws, statement: "v1", source_ref: SRC, observed_at: "2026-06-05T09:00:00Z", confidence: 0.6 };
}

function factRows(ws: string): Array<Record<string, unknown>> {
  const store = openProjectionStore(ws);
  try {
    return store.db.prepare("SELECT * FROM facts ORDER BY id").all() as Array<Record<string, unknown>>;
  } finally {
    store.close();
  }
}

async function memoryEventKinds(ws: string): Promise<string[]> {
  try {
    const text = await readFile(join(ws, "events", "memory_events.jsonl"), "utf8");
    return text.split("\n").filter((l) => l.length > 0).map((l) => JSON.parse(l).kind as string);
  } catch {
    return [];
  }
}

after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

test("supersede adds a new fact + fact_superseded event; old row is unchanged and retained", async () => {
  const ws = await makeWorkspace();
  const first = await addFact({ ...base(ws), statement: "v1", now: "2026-06-05T10:00:00Z" });
  const oldRowBefore = factRows(ws).find((r) => r.id === first.fact.id);

  const second = await supersedeFact({
    ...base(ws),
    statement: "v2 (corrected)",
    confidence: 0.95,
    supersedes: first.fact.id,
    now: "2026-06-05T11:00:00Z",
  });

  // both facts retained (ADD-only); the old row is byte-for-byte unchanged
  const rows = factRows(ws);
  assert.equal(rows.length, 2);
  const oldRowAfter = rows.find((r) => r.id === first.fact.id);
  assert.deepEqual(oldRowAfter, oldRowBefore);
  // the new fact references the old
  const newRow = rows.find((r) => r.id === second.fact.id);
  assert.equal(newRow!.supersedes, first.fact.id);
  // events: fact_added then fact_superseded
  assert.deepEqual(await memoryEventKinds(ws), ["fact_added", "fact_superseded"]);

  // current view excludes the superseded fact
  const current = listCurrentFacts({ workspace: ws });
  assert.deepEqual(current.map((f) => f.id), [second.fact.id]);
  assert.equal(current[0]!.statement, "v2 (corrected)");
});

test("supersede chains resolve to the latest (A<-B<-C => only C current); all rows retained", async () => {
  const ws = await makeWorkspace();
  const a = await addFact({ ...base(ws), statement: "a", now: "2026-06-05T10:00:00Z" });
  const b = await supersedeFact({ ...base(ws), statement: "b", supersedes: a.fact.id, now: "2026-06-05T11:00:00Z" });
  const c = await supersedeFact({ ...base(ws), statement: "c", supersedes: b.fact.id, now: "2026-06-05T12:00:00Z" });

  assert.equal(factRows(ws).length, 3);
  const current = listCurrentFacts({ workspace: ws });
  assert.deepEqual(current.map((f) => f.id), [c.fact.id]);
});

test("rejects superseding a non-existent fact and writes nothing", async () => {
  const ws = await makeWorkspace();
  await assert.rejects(
    () => supersedeFact({ ...base(ws), supersedes: "01KTZZZZZZZZZZZZZZZZZZZZZZ" }),
    (err: unknown) => err instanceof FactStoreError && err.code === "supersede_target_not_found",
  );
  assert.deepEqual(await memoryEventKinds(ws), []);
});

test("rejects a non-ULID supersedes", async () => {
  const ws = await makeWorkspace();
  await assert.rejects(
    () => supersedeFact({ ...base(ws), supersedes: "nope" }),
    (err: unknown) => err instanceof FactStoreError && err.code === "invalid_supersedes",
  );
});
