/**
 * Tests for the SB-036 current-facts query (listCurrentFacts): excludes
 * superseded facts and applies source_ref / minConfidence / limit filters.
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { addFact, supersedeFact, listCurrentFacts } from "../src/index.js";

const SRC_A = "01KT6C7GH0PM1K6XQH3K6ZG8BT";
const SRC_B = "01KT6D5N163GSHGECNCA88NYPE";
const tmpDirs: string[] = [];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "sb-fact-query-"));
  tmpDirs.push(dir);
  return dir;
}

after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

test("lists all current facts when none are superseded", async () => {
  const ws = await makeWorkspace();
  await addFact({ workspace: ws, statement: "a", source_ref: SRC_A, observed_at: "2026-06-05T09:00:00Z", confidence: 0.5, now: "2026-06-05T10:00:00Z" });
  await addFact({ workspace: ws, statement: "b", source_ref: SRC_B, observed_at: "2026-06-05T09:00:00Z", confidence: 0.9, now: "2026-06-05T10:01:00Z" });
  assert.equal(listCurrentFacts({ workspace: ws }).length, 2);
});

test("filters by source_ref", async () => {
  const ws = await makeWorkspace();
  await addFact({ workspace: ws, statement: "a", source_ref: SRC_A, observed_at: "2026-06-05T09:00:00Z", confidence: 0.5, now: "2026-06-05T10:00:00Z" });
  await addFact({ workspace: ws, statement: "b", source_ref: SRC_B, observed_at: "2026-06-05T09:00:00Z", confidence: 0.9, now: "2026-06-05T10:01:00Z" });
  const facts = listCurrentFacts({ workspace: ws, source_ref: SRC_B });
  assert.equal(facts.length, 1);
  assert.equal(facts[0]!.statement, "b");
});

test("filters by minConfidence", async () => {
  const ws = await makeWorkspace();
  await addFact({ workspace: ws, statement: "low", source_ref: SRC_A, observed_at: "2026-06-05T09:00:00Z", confidence: 0.3, now: "2026-06-05T10:00:00Z" });
  await addFact({ workspace: ws, statement: "high", source_ref: SRC_A, observed_at: "2026-06-05T09:00:00Z", confidence: 0.95, now: "2026-06-05T10:01:00Z" });
  const facts = listCurrentFacts({ workspace: ws, minConfidence: 0.9 });
  assert.deepEqual(facts.map((f) => f.statement), ["high"]);
});

test("respects limit", async () => {
  const ws = await makeWorkspace();
  await addFact({ workspace: ws, statement: "a", source_ref: SRC_A, observed_at: "2026-06-05T09:00:00Z", confidence: 0.5, now: "2026-06-05T10:00:00Z" });
  await addFact({ workspace: ws, statement: "b", source_ref: SRC_A, observed_at: "2026-06-05T09:00:00Z", confidence: 0.5, now: "2026-06-05T10:01:00Z" });
  assert.equal(listCurrentFacts({ workspace: ws, limit: 1 }).length, 1);
});

test("excludes superseded facts", async () => {
  const ws = await makeWorkspace();
  const a = await addFact({ workspace: ws, statement: "a", source_ref: SRC_A, observed_at: "2026-06-05T09:00:00Z", confidence: 0.5, now: "2026-06-05T10:00:00Z" });
  await supersedeFact({ workspace: ws, statement: "a2", source_ref: SRC_A, observed_at: "2026-06-05T09:00:00Z", confidence: 0.8, supersedes: a.fact.id, now: "2026-06-05T11:00:00Z" });
  const current = listCurrentFacts({ workspace: ws });
  assert.equal(current.length, 1);
  assert.equal(current[0]!.statement, "a2");
  assert.equal(current[0]!.supersedes, a.fact.id);
});
