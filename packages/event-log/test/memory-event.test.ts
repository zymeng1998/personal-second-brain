/**
 * Tests for the SB-025 memory-event append path. Append-only: each call adds
 * exactly one valid JSONL line, earlier lines are untouched, and ordering is
 * preserved. Built-in test runner; writes go to a fresh temp dir.
 */
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { appendMemoryEvent, EventLogError, validateMemoryEvent } from "../src/index.js";
import type { AppendMemoryEventInput } from "../src/index.js";

const SUBJECT = "01KT6C7GH0PM1K6XQH3K6ZG8BT";
const SOURCE = "01KT6D5N163GSHGECNCA88NYPE";
const EVENT_IDS = [
  "01KT6S3G408VV6NHJDH0ZND8DK",
  "01KT6S78P0X3JCQ5ZPFTMS7FK5",
  "01KT6SB1804HZMDZTMSZZ0Q4SB",
];

const tmpDirs: string[] = [];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "sb-event-log-"));
  tmpDirs.push(dir);
  return dir;
}

function baseInput(workspace: string, eventId: string): AppendMemoryEventInput {
  return {
    workspace,
    event_id: eventId,
    kind: "note_created",
    subject_id: SUBJECT,
    occurred_at: "2026-06-05T10:00:00Z",
    actor: "cli",
  };
}

function lines(text: string): string[] {
  return text.split("\n").filter((l) => l.length > 0);
}

after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

test("appends one valid memory line, auto-stamping recorded_at + schema_version", async () => {
  const ws = await makeWorkspace();
  const result = await appendMemoryEvent({
    ...baseInput(ws, EVENT_IDS[0]!),
    kind: "distillation_accepted",
    source_ref: SOURCE,
  });

  assert.equal(result.path, join(ws, "events", "memory_events.jsonl"));
  const text = await readFile(result.path, "utf8");
  assert.equal(lines(text).length, 1);
  assert.equal(result.bytesAppended, Buffer.byteLength(text, "utf8"));

  const event = JSON.parse(lines(text)[0]!);
  validateMemoryEvent(event); // must pass v1 validation
  assert.equal(event.event_id, EVENT_IDS[0]);
  assert.equal(event.stream, "memory");
  assert.equal(event.kind, "distillation_accepted");
  assert.equal(event.subject_id, SUBJECT);
  assert.equal(event.source_ref, SOURCE);
  assert.equal(event.actor, "cli");
  assert.equal(event.schema_version, "1.0.0");
  assert.ok(typeof event.recorded_at === "string" && event.recorded_at.length > 0);
});

test("N appends produce N ordered lines, earlier lines unchanged", async () => {
  const ws = await makeWorkspace();
  await appendMemoryEvent(baseInput(ws, EVENT_IDS[0]!));
  const afterFirst = await readFile(join(ws, "events", "memory_events.jsonl"), "utf8");

  await appendMemoryEvent({ ...baseInput(ws, EVENT_IDS[1]!), kind: "distillation_accepted" });
  await appendMemoryEvent(baseInput(ws, EVENT_IDS[2]!));

  const text = await readFile(join(ws, "events", "memory_events.jsonl"), "utf8");
  const ls = lines(text);
  assert.equal(ls.length, 3);
  // the first line is byte-identical to what was written first (append-only).
  assert.ok(text.startsWith(afterFirst));
  assert.deepEqual(
    ls.map((l) => JSON.parse(l).event_id),
    EVENT_IDS,
  );
});

test("rejects a missing subject_id and writes nothing", async () => {
  const ws = await makeWorkspace();
  const bad = { ...baseInput(ws, EVENT_IDS[0]!) } as Partial<AppendMemoryEventInput>;
  delete bad.subject_id;

  await assert.rejects(
    () => appendMemoryEvent(bad as AppendMemoryEventInput),
    (err: unknown) => err instanceof EventLogError && err.code === "invalid_event",
  );
  // nothing was written
  await assert.rejects(() => readFile(join(ws, "events", "memory_events.jsonl"), "utf8"));
});

test("rejects an unknown kind and writes nothing", async () => {
  const ws = await makeWorkspace();
  const bad = { ...baseInput(ws, EVENT_IDS[0]!), kind: "captured" } as unknown as AppendMemoryEventInput;

  await assert.rejects(
    () => appendMemoryEvent(bad),
    (err: unknown) => err instanceof EventLogError && err.code === "invalid_event",
  );
  await assert.rejects(() => readFile(join(ws, "events", "memory_events.jsonl"), "utf8"));
});

test("rejects a non-ULID subject_id", async () => {
  const ws = await makeWorkspace();
  await assert.rejects(
    () => appendMemoryEvent({ ...baseInput(ws, EVENT_IDS[0]!), subject_id: "not-a-ulid" }),
    (err: unknown) => err instanceof EventLogError && err.code === "invalid_event",
  );
});

test("rejects a relative / non-absolute workspace path", async () => {
  await assert.rejects(
    () => appendMemoryEvent({ ...baseInput("relative/ws", EVENT_IDS[0]!) }),
    (err: unknown) => err instanceof EventLogError && err.code === "unsafe_path",
  );
});
