/**
 * Tests for the SB-015 read-only note API (listNotes / getNote). Reads notes
 * written by writeRawNote; asserts read-only behavior. Temp workspaces only.
 */
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { NoteReadError, getNote, listNotes, writeRawNote } from "../src/index.js";

const ID = "01KT6C7GH0PM1K6XQH3K6ZG8BT";
const ID2 = "01KT6D5N163GSHGECNCA88NYPE";
const ABSENT = "01KT6ZZZZZZZZZZZZZZZZZZZZZ";

const tmpDirs: string[] = [];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "sb-read-notes-"));
  tmpDirs.push(dir);
  return dir;
}

after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

test("listNotes returns a summary (id/type/title/layer) per note, sorted by id", async () => {
  const ws = await makeWorkspace();
  await writeRawNote({ workspace: ws, id: ID2, content: "second", source: "paste", createdAt: "2026-06-03T09:25:00Z", title: "Second" });
  await writeRawNote({ workspace: ws, id: ID, content: "first", source: "paste", createdAt: "2026-06-03T09:15:00Z", title: "First" });

  const notes = await listNotes(ws);
  assert.equal(notes.length, 2);
  assert.deepEqual(notes.map((n) => n.id), [ID, ID2]); // ULID-sorted
  assert.equal(notes[0]!.type, "raw");
  assert.equal(notes[0]!.layer, 0);
  assert.equal(notes[0]!.title, "First");
});

test("listNotes filters by type", async () => {
  const ws = await makeWorkspace();
  await writeRawNote({ workspace: ws, id: ID, content: "x", source: "paste", createdAt: "2026-06-03T09:15:00Z" });
  assert.equal((await listNotes(ws, { type: "raw" })).length, 1);
  assert.equal((await listNotes(ws, { type: "working" })).length, 0);
});

test("listNotes attaches verbatim content iff includeContent is set (SB-046)", async () => {
  const ws = await makeWorkspace();
  await writeRawNote({ workspace: ws, id: ID, content: "single-pass body", source: "paste", createdAt: "2026-06-03T09:15:00Z", title: "First" });

  const without = await listNotes(ws);
  assert.equal(without[0]!.content, undefined, "content must be absent by default");

  const withContent = await listNotes(ws, { includeContent: true });
  const fileBytes = await readFile(withContent[0]!.path, "utf8");
  assert.equal(withContent[0]!.content, fileBytes, "content must be the verbatim file bytes");
});

test("getNote returns verbatim content for an existing id", async () => {
  const ws = await makeWorkspace();
  await writeRawNote({ workspace: ws, id: ID, content: "hello body", source: "paste", createdAt: "2026-06-03T09:15:00Z" });
  const note = await getNote(ws, ID);
  assert.equal(note.id, ID);
  assert.ok(note.content.includes("hello body"));
  assert.ok(note.content.includes("type: raw"));
});

test("getNote rejects an invalid ULID and reports not_found for an absent id", async () => {
  const ws = await makeWorkspace();
  await writeRawNote({ workspace: ws, id: ID, content: "x", source: "paste", createdAt: "2026-06-03T09:15:00Z" });
  await assert.rejects(
    () => getNote(ws, "not-a-ulid"),
    (err: unknown) => err instanceof NoteReadError && err.code === "invalid_ulid",
  );
  await assert.rejects(
    () => getNote(ws, ABSENT),
    (err: unknown) => err instanceof NoteReadError && err.code === "not_found",
  );
});

test("read API never writes (vault unchanged) and an empty workspace lists nothing", async () => {
  const ws = await makeWorkspace();
  assert.deepEqual(await listNotes(ws), []); // no vault yet

  await writeRawNote({ workspace: ws, id: ID, content: "x", source: "paste", createdAt: "2026-06-03T09:15:00Z" });
  const before = (await readdir(join(ws, "vault", "00_Raw"))).sort();
  const bytesBefore = await readFile(join(ws, "vault", "00_Raw", `${ID}.md`));

  await listNotes(ws);
  await getNote(ws, ID);

  const after = (await readdir(join(ws, "vault", "00_Raw"))).sort();
  assert.deepEqual(after, before, "read API must not add/remove files");
  assert.deepEqual(await readFile(join(ws, "vault", "00_Raw", `${ID}.md`)), bytesBefore, "read API must not modify bytes");
});
