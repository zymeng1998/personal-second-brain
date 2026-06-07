/**
 * Tests for the SB-035 fact-store ADD-only write path. Each test uses a fresh
 * temp workspace. Asserts: one addFact => one fact_added event + one row;
 * provenance/confidence validation; ADD-only (no row ever updated/deleted);
 * and that the SQLite row matches the projector's view of the event (live==replay).
 */
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { projectEvents, currentFacts, openProjectionStore } from "@sb/memory-kernel";
import { validateMemoryEvent } from "@sb/event-log";
import type { Event } from "@sb/interfaces";
import { addFact, FactStoreError } from "../src/index.js";

const SRC = "01KT6C7GH0PM1K6XQH3K6ZG8BT";

const tmpDirs: string[] = [];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "sb-fact-store-"));
  tmpDirs.push(dir);
  return dir;
}

function base(ws: string) {
  return { workspace: ws, statement: "the sky is blue", source_ref: SRC, observed_at: "2026-06-05T09:00:00Z", confidence: 0.9 };
}

async function memoryEvents(ws: string): Promise<Event[]> {
  try {
    const text = await readFile(join(ws, "events", "memory_events.jsonl"), "utf8");
    return text.split("\n").filter((l) => l.length > 0).map((l) => JSON.parse(l) as Event);
  } catch {
    return [];
  }
}

function factRows(ws: string): Array<Record<string, unknown>> {
  const store = openProjectionStore(ws);
  try {
    return store.db.prepare("SELECT * FROM facts ORDER BY id").all() as Array<Record<string, unknown>>;
  } finally {
    store.close();
  }
}

after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

test("addFact appends exactly one fact_added event and inserts exactly one row", async () => {
  const ws = await makeWorkspace();
  const result = await addFact({ ...base(ws), now: "2026-06-05T10:00:00Z" });

  const events = await memoryEvents(ws);
  assert.equal(events.length, 1);
  const ev = events[0]!;
  validateMemoryEvent(ev); // valid v1 memory event
  assert.equal(ev.kind, "fact_added");
  assert.equal(ev.subject_id, result.fact.id);
  assert.equal((ev.payload as { confidence: number }).confidence, 0.9);

  const rows = factRows(ws);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.id, result.fact.id);
  assert.equal(rows[0]!.statement, "the sky is blue");
  assert.equal(rows[0]!.source_ref, SRC);
  assert.equal(rows[0]!.confidence, 0.9);
  assert.equal(rows[0]!.supersedes, null);
});

test("the SQLite row matches the projector's view of the event (live == replay)", async () => {
  const ws = await makeWorkspace();
  await addFact({ ...base(ws), now: "2026-06-05T10:00:00Z" });

  const projected = currentFacts(projectEvents(await memoryEvents(ws)));
  assert.equal(projected.length, 1);
  const row = factRows(ws)[0]!;
  assert.equal(projected[0]!.id, row.id);
  assert.equal(projected[0]!.statement, row.statement);
  assert.equal(projected[0]!.confidence, row.confidence);
});

test("rejects a missing/invalid source_ref (provenance required) and writes nothing", async () => {
  const ws = await makeWorkspace();
  await assert.rejects(
    () => addFact({ ...base(ws), source_ref: "not-a-ulid" }),
    (err: unknown) => err instanceof FactStoreError && err.code === "invalid_source_ref",
  );
  assert.deepEqual(await memoryEvents(ws), []);
});

test("rejects confidence outside [0,1]", async () => {
  const ws = await makeWorkspace();
  await assert.rejects(
    () => addFact({ ...base(ws), confidence: 1.5 }),
    (err: unknown) => err instanceof FactStoreError && err.code === "invalid_confidence",
  );
  await assert.rejects(
    () => addFact({ ...base(ws), confidence: -0.1 }),
    (err: unknown) => err instanceof FactStoreError && err.code === "invalid_confidence",
  );
});

test("rejects an empty statement", async () => {
  const ws = await makeWorkspace();
  await assert.rejects(
    () => addFact({ ...base(ws), statement: "   " }),
    (err: unknown) => err instanceof FactStoreError && err.code === "invalid_statement",
  );
});

test("ADD-only: two addFacts create two distinct rows; the first is never modified", async () => {
  const ws = await makeWorkspace();
  const first = await addFact({ ...base(ws), statement: "first", now: "2026-06-05T10:00:00Z" });
  const firstRowBefore = factRows(ws).find((r) => r.id === first.fact.id);

  const second = await addFact({ ...base(ws), statement: "second", now: "2026-06-05T11:00:00Z" });

  const rows = factRows(ws);
  assert.equal(rows.length, 2);
  assert.notEqual(first.fact.id, second.fact.id);
  // the first row is byte-for-byte unchanged (ADD-only, no UPDATE)
  const firstRowAfter = rows.find((r) => r.id === first.fact.id);
  assert.deepEqual(firstRowAfter, firstRowBefore);
  assert.equal((await memoryEvents(ws)).length, 2);
});
