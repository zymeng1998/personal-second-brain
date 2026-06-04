/**
 * Tests for the SB-014 capture-event append path. Append-only: each call adds
 * exactly one valid JSONL line, earlier lines are untouched, and ordering is
 * preserved. Built-in test runner; writes go to a fresh temp dir.
 */
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { appendCaptureEvent, EventLogError, validateCaptureEvent } from "../src/index.js";
import type { AppendCaptureEventInput } from "../src/index.js";

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

function baseInput(workspace: string, eventId: string): AppendCaptureEventInput {
  return {
    workspace,
    event_id: eventId,
    subject_id: SUBJECT,
    occurred_at: "2026-06-03T09:15:00Z",
    actor: "cli",
  };
}

function lines(text: string): string[] {
  return text.split("\n").filter((l) => l.length > 0);
}

after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

test("appends exactly one valid line carrying id, timestamp, actor, source_ref", async () => {
  const ws = await makeWorkspace();
  const result = await appendCaptureEvent({ ...baseInput(ws, EVENT_IDS[0]!), source_ref: SOURCE });

  assert.equal(result.path, join(ws, "events", "capture_events.jsonl"));
  const text = await readFile(result.path, "utf8");
  assert.equal(lines(text).length, 1);
  assert.equal(result.bytesAppended, Buffer.byteLength(text, "utf8"));

  const event = JSON.parse(lines(text)[0]!);
  validateCaptureEvent(event); // must pass v1 validation
  assert.equal(event.event_id, EVENT_IDS[0]);
  assert.equal(event.stream, "capture");
  assert.equal(event.kind, "captured");
  assert.equal(event.actor, "cli");
  assert.equal(event.subject_id, SUBJECT);
  assert.equal(event.source_ref, SOURCE);
  assert.ok(typeof event.occurred_at === "string");
  assert.ok(typeof event.recorded_at === "string", "recorded_at auto-stamped");
});

test("appends N events as N lines, ordered, with earlier lines unchanged", async () => {
  const ws = await makeWorkspace();
  const path = join(ws, "events", "capture_events.jsonl");

  await appendCaptureEvent(baseInput(ws, EVENT_IDS[0]!));
  const afterFirst = await readFile(path, "utf8");

  await appendCaptureEvent(baseInput(ws, EVENT_IDS[1]!));
  const afterSecond = await readFile(path, "utf8");
  // The first line must be byte-identical after the second append.
  assert.ok(afterSecond.startsWith(afterFirst), "earlier lines must be untouched");

  await appendCaptureEvent(baseInput(ws, EVENT_IDS[2]!));
  const text = await readFile(path, "utf8");

  const parsed = lines(text).map((l) => JSON.parse(l));
  assert.equal(parsed.length, 3);
  for (const event of parsed) validateCaptureEvent(event);
  assert.deepEqual(
    parsed.map((e) => e.event_id),
    EVENT_IDS,
    "append order is preserved",
  );
});

test("rejects an invalid event and writes nothing", async () => {
  const ws = await makeWorkspace();
  await assert.rejects(
    // @ts-expect-error — exercising a runtime-invalid actor
    () => appendCaptureEvent({ ...baseInput(ws, EVENT_IDS[0]!), actor: "robot" }),
    (err: unknown) => err instanceof EventLogError && err.code === "invalid_event",
  );
  await assert.rejects(
    () => stat(join(ws, "events", "capture_events.jsonl")),
    "no file should be created when validation fails",
  );
});

test("rejects a bad subject_id (must be a ULID)", async () => {
  const ws = await makeWorkspace();
  await assert.rejects(
    () => appendCaptureEvent({ ...baseInput(ws, EVENT_IDS[0]!), subject_id: "nope" }),
    (err: unknown) => err instanceof EventLogError && err.code === "invalid_event",
  );
});

test("rejects a relative / unsafe workspace path", async () => {
  await assert.rejects(
    () => appendCaptureEvent(baseInput("relative/ws", EVENT_IDS[0]!)),
    (err: unknown) => err instanceof EventLogError && err.code === "unsafe_path",
  );
});
