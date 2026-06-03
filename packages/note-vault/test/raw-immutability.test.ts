/**
 * Tests for the SB-012 raw immutability guard. Overwrite and delete of an L0
 * raw note are rejected and the bytes are unchanged; creating a new raw note
 * still works. Built-in test runner; all writes go to a fresh temp dir.
 */
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import {
  deleteRawNote,
  isRawPath,
  RawImmutabilityError,
  RawNoteWriteError,
  updateRawNote,
  writeRawNote,
} from "../src/index.js";
import type { WriteRawNoteInput } from "../src/index.js";

const ID = "01KT6C7GH0PM1K6XQH3K6ZG8BT";
const ID2 = "01KT6D5N163GSHGECNCA88NYPE";

const tmpDirs: string[] = [];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "sb-raw-immut-"));
  tmpDirs.push(dir);
  return dir;
}

function baseInput(workspace: string): WriteRawNoteInput {
  return {
    workspace,
    id: ID,
    content: "Original immutable content.\nWith: a colon.",
    source: "paste",
    createdAt: "2026-06-03T09:15:00Z",
  };
}

after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

test("overwriting an existing raw note is rejected and bytes are unchanged", async () => {
  const ws = await makeWorkspace();
  const { path } = await writeRawNote(baseInput(ws));
  const before = await readFile(path);

  await assert.rejects(
    () => writeRawNote({ ...baseInput(ws), content: "TAMPERED" }),
    (err: unknown) => err instanceof RawNoteWriteError && err.code === "already_exists",
  );

  const after2 = await readFile(path);
  assert.deepEqual(after2, before, "raw bytes must be unchanged after a rejected overwrite");
});

test("updateRawNote is always rejected (overwrite_rejected) and bytes are unchanged", async () => {
  const ws = await makeWorkspace();
  const { path } = await writeRawNote(baseInput(ws));
  const before = await readFile(path);

  await assert.rejects(
    () => updateRawNote({ workspace: ws, id: ID }),
    (err: unknown) => err instanceof RawImmutabilityError && err.code === "overwrite_rejected",
  );

  assert.deepEqual(await readFile(path), before);
});

test("deleting a raw note via the vault API is rejected and the file remains", async () => {
  const ws = await makeWorkspace();
  const { path } = await writeRawNote(baseInput(ws));
  const before = await readFile(path);

  await assert.rejects(
    () => deleteRawNote({ workspace: ws, id: ID }),
    (err: unknown) => err instanceof RawImmutabilityError && err.code === "delete_rejected",
  );

  assert.ok((await stat(path)).isFile(), "raw file must still exist after a rejected delete");
  assert.deepEqual(await readFile(path), before, "raw bytes must be unchanged after a rejected delete");
});

test("creating a new (different) raw note still works", async () => {
  const ws = await makeWorkspace();
  await writeRawNote(baseInput(ws));
  const result = await writeRawNote({ ...baseInput(ws), id: ID2, content: "second note" });
  assert.equal(result.path, join(ws, "vault", "00_Raw", `${ID2}.md`));
  assert.ok((await stat(result.path)).isFile());
});

test("isRawPath flags 00_Raw paths and clears non-raw paths", async () => {
  const ws = await makeWorkspace();
  assert.equal(isRawPath(ws, join(ws, "vault", "00_Raw", `${ID}.md`)), true);
  assert.equal(isRawPath(ws, join(ws, "vault", "00_Inbox", `${ID}.md`)), false);
  assert.equal(isRawPath(ws, join(ws, "events", "capture_events.jsonl")), false);
});
