/**
 * Tests for the SB-023 pure replay projector. Folds memory events into L3
 * projection state deterministically; ADD-only fact semantics; forward-compatible
 * with unhandled kinds / non-memory streams. No I/O.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { CaptureEvent, Fact, MemoryEvent, Ulid } from "@sb/interfaces";
import {
  applyEvent,
  currentFacts,
  emptyState,
  MemoryKernelError,
  projectEvents,
} from "../src/index.js";

const E1 = "01KT6S3G408VV6NHJDH0ZND8DK" as Ulid;
const E2 = "01KT6S78P0X3JCQ5ZPFTMS7FK5" as Ulid;
const E3 = "01KT6SB1804HZMDZTMSZZ0Q4SB" as Ulid;
const F1 = "01KTAAAAAAAAAAAAAAAAAAAAAA" as Ulid;
const F2 = "01KTBBBBBBBBBBBBBBBBBBBBBB" as Ulid;
const F3 = "01KTCCCCCCCCCCCCCCCCCCCCCC" as Ulid;
const SRC = "01KTDDDDDDDDDDDDDDDDDDDDDD" as Ulid;

function factAdded(eventId: Ulid, factId: Ulid, statement: string, supersedes?: Ulid): MemoryEvent {
  return {
    event_id: eventId,
    stream: "memory",
    kind: supersedes !== undefined ? "fact_superseded" : "fact_added",
    occurred_at: "2026-06-05T10:00:00Z",
    actor: "cli",
    subject_id: factId,
    payload: {
      statement,
      source_ref: SRC,
      captured_at: "2026-06-05T10:00:00Z",
      observed_at: "2026-06-05T09:00:00Z",
      confidence: 0.9,
      ...(supersedes !== undefined ? { supersedes } : {}),
    },
  };
}

test("empty event stream yields empty state", () => {
  const s = projectEvents([]);
  assert.equal(s.facts.size, 0);
  assert.deepEqual(currentFacts(s), []);
});

test("fact_added inserts a fact; currentFacts includes it", () => {
  const s = projectEvents([factAdded(E1, F1, "the sky is blue")]);
  assert.equal(s.facts.size, 1);
  const f = s.facts.get(F1) as Fact;
  assert.equal(f.statement, "the sky is blue");
  assert.equal(f.source_ref, SRC);
  assert.equal(f.confidence, 0.9);
  assert.deepEqual(currentFacts(s).map((x) => x.id), [F1]);
});

test("ADD-only: fact_superseded keeps the old fact and supersedes it", () => {
  const s = projectEvents([
    factAdded(E1, F1, "v1"),
    factAdded(E2, F2, "v2", F1),
  ]);
  // both facts retained (never deleted)
  assert.equal(s.facts.size, 2);
  assert.ok(s.facts.has(F1) && s.facts.has(F2));
  // only the latest is current
  assert.deepEqual(currentFacts(s).map((x) => x.id), [F2]);
});

test("supersede chains resolve to the latest (A<-B<-C => only C current)", () => {
  const s = projectEvents([
    factAdded(E1, F1, "a"),
    factAdded(E2, F2, "b", F1),
    factAdded(E3, F3, "c", F2),
  ]);
  assert.equal(s.facts.size, 3);
  assert.deepEqual(currentFacts(s).map((x) => x.id), [F3]);
});

test("projection is deterministic: replaying the same events twice is identical", () => {
  const events = [factAdded(E1, F1, "a"), factAdded(E2, F2, "b", F1)];
  const a = projectEvents(events);
  const b = projectEvents(events);
  assert.deepEqual([...a.facts.entries()], [...b.facts.entries()]);
  assert.deepEqual(currentFacts(a), currentFacts(b));
});

test("applyEvent is pure: the input state is not mutated", () => {
  const s0 = emptyState();
  const s1 = applyEvent(s0, factAdded(E1, F1, "a"));
  assert.equal(s0.facts.size, 0, "original state must be unchanged");
  assert.equal(s1.facts.size, 1);
});

test("non-memory streams are ignored (forward-compatible)", () => {
  const capture: CaptureEvent = {
    event_id: E1,
    stream: "capture",
    kind: "captured",
    occurred_at: "2026-06-05T10:00:00Z",
    actor: "cli",
    subject_id: F1,
  };
  const s = projectEvents([capture]);
  assert.equal(s.facts.size, 0);
});

test("unhandled memory kinds leave state unchanged (no crash)", () => {
  const noteCreated: MemoryEvent = {
    event_id: E1,
    stream: "memory",
    kind: "note_created",
    occurred_at: "2026-06-05T10:00:00Z",
    actor: "cli",
    subject_id: F1,
    payload: { title: "x", extra_future_field: 123 },
  };
  const s = projectEvents([noteCreated]);
  assert.equal(s.facts.size, 0);
  assert.equal(s.entities.size, 0);
  assert.equal(s.tasks.size, 0);
});

test("malformed fact payload throws invalid_projection_event", () => {
  const bad: MemoryEvent = {
    event_id: E1,
    stream: "memory",
    kind: "fact_added",
    occurred_at: "2026-06-05T10:00:00Z",
    actor: "cli",
    subject_id: F1,
    payload: { statement: "missing source_ref + confidence" },
  };
  assert.throws(
    () => projectEvents([bad]),
    (err: unknown) => err instanceof MemoryKernelError && err.code === "invalid_projection_event",
  );
});
