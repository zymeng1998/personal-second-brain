/**
 * Tests for the SB-011 raw note write primitive. Uses Node's built-in test
 * runner + assert (no heavy framework). All writes go to a fresh temp dir.
 */
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { RawNoteWriteError, writeRawNote } from "../src/index.js";
import type { WriteRawNoteInput } from "../src/index.js";

const ID = "01KT6C7GH0PM1K6XQH3K6ZG8BT";

const tmpDirs: string[] = [];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "sb-note-vault-"));
  tmpDirs.push(dir);
  return dir;
}

function baseInput(workspace: string): WriteRawNoteInput {
  return {
    workspace,
    id: ID,
    content: "Verbatim raw capture line one.\nLine two with: a colon.",
    source: "paste",
    createdAt: "2026-06-03T09:15:00Z",
  };
}

after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

test("creates a raw note under vault/00_Raw with the ULID filename", async () => {
  const ws = await makeWorkspace();
  const result = await writeRawNote(baseInput(ws));

  const expectedPath = join(ws, "vault", "00_Raw", `${ID}.md`);
  assert.equal(result.path, expectedPath);
  assert.equal(result.id, ID);
  assert.equal(result.created, "2026-06-03T09:15:00Z");
  assert.ok((await stat(expectedPath)).isFile(), "file should exist");
  assert.equal(result.bytesWritten, Buffer.byteLength(await readFile(expectedPath, "utf8"), "utf8"));
});

test("uses <ULID>--<slug>.md when a slug is provided", async () => {
  const ws = await makeWorkspace();
  const result = await writeRawNote({ ...baseInput(ws), slug: "meeting-jot" });
  assert.equal(result.path, join(ws, "vault", "00_Raw", `${ID}--meeting-jot.md`));
  assert.ok((await stat(result.path)).isFile());
});

test("frontmatter has type: raw and layer: 0 and the id", async () => {
  const ws = await makeWorkspace();
  const { path } = await writeRawNote({ ...baseInput(ws), title: "Quick jot", tags: ["capture", "voice"] });
  const text = await readFile(path, "utf8");
  assert.match(text, /^---\n/);
  assert.match(text, /\ntype: raw\n/);
  assert.match(text, /\nlayer: 0\n/);
  assert.match(text, new RegExp(`\\nid: ${ID}\\n`));
  assert.match(text, /\nsource:\n {2}kind: "paste"\n/);
  assert.doesNotMatch(text, /\nupdated:/, "raw (L0) notes must not carry updated");
});

test("body preserves raw content verbatim", async () => {
  const ws = await makeWorkspace();
  const input = baseInput(ws);
  const { path } = await writeRawNote(input);
  const text = await readFile(path, "utf8");
  const body = text.slice(text.indexOf("\n---\n") + "\n---\n".length).replace(/^\n/, "");
  assert.equal(body, input.content);
});

test("never overwrites an existing file (already_exists)", async () => {
  const ws = await makeWorkspace();
  await writeRawNote(baseInput(ws));
  await assert.rejects(
    () => writeRawNote({ ...baseInput(ws), content: "DIFFERENT" }),
    (err: unknown) => err instanceof RawNoteWriteError && err.code === "already_exists",
  );
  // Original bytes unchanged.
  const text = await readFile(join(ws, "vault", "00_Raw", `${ID}.md`), "utf8");
  assert.ok(text.includes("Verbatim raw capture line one."));
  assert.ok(!text.includes("DIFFERENT"));
});

test("rejects an invalid ULID", async () => {
  const ws = await makeWorkspace();
  await assert.rejects(
    () => writeRawNote({ ...baseInput(ws), id: "not-a-ulid" }),
    (err: unknown) => err instanceof RawNoteWriteError && err.code === "invalid_ulid",
  );
});

test("rejects a relative / unsafe workspace path", async () => {
  await assert.rejects(
    () => writeRawNote({ ...baseInput("relative/workspace"), workspace: "relative/workspace" }),
    (err: unknown) => err instanceof RawNoteWriteError && err.code === "unsafe_path",
  );
});

test("rejects an unsafe slug and an unknown source", async () => {
  const ws = await makeWorkspace();
  await assert.rejects(
    () => writeRawNote({ ...baseInput(ws), slug: "../escape" }),
    (err: unknown) => err instanceof RawNoteWriteError && err.code === "invalid_slug",
  );
  await assert.rejects(
    // @ts-expect-error — exercising a runtime-invalid source kind
    () => writeRawNote({ ...baseInput(ws), source: "broker" }),
    (err: unknown) => err instanceof RawNoteWriteError && err.code === "invalid_source",
  );
});
