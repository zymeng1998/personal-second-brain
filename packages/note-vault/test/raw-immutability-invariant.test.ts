/**
 * SB-017 — checks/tests locking in the L0 raw-immutability invariant.
 *
 * SB-012 already proved overwrite/delete via the vault API are rejected and the
 * bytes stay unchanged. This suite hardens the guarantee at the points an
 * attacker or a future regression would actually reach:
 *   - the guard primitive (`guardRawImmutable`) directly, including the
 *     non-raw pass-through that must NOT throw;
 *   - path traversal that resolves into / escapes the raw area;
 *   - slugged raw filenames (`<ULID>--<slug>.md`);
 *   - a single consolidated invariant: after a real write, every mutation path
 *     (re-write, update, delete) is refused and the bytes are byte-identical.
 *
 * Out of scope (per SB-017): OS-level filesystem permissions. Built-in test
 * runner; all writes go to a fresh temp dir.
 */
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import {
  deleteRawNote,
  guardRawImmutable,
  isRawPath,
  RawImmutabilityError,
  rawNotePath,
  updateRawNote,
  writeRawNote,
} from "../src/index.js";
import type { WriteRawNoteInput } from "../src/index.js";

const ID = "01KT6C7GH0PM1K6XQH3K6ZG8BT";
const SLUG = "first-capture";

const tmpDirs: string[] = [];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "sb-raw-invariant-"));
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

test("guardRawImmutable throws the operation-specific code for a raw path", async () => {
  const ws = await makeWorkspace();
  const raw = rawNotePath(ws, ID);

  assert.throws(
    () => guardRawImmutable(ws, raw, "overwrite"),
    (err: unknown) => err instanceof RawImmutabilityError && err.code === "overwrite_rejected",
  );
  assert.throws(
    () => guardRawImmutable(ws, raw, "delete"),
    (err: unknown) => err instanceof RawImmutabilityError && err.code === "delete_rejected",
  );
});

test("guardRawImmutable is a no-op for non-raw paths (L1+ stays editable)", async () => {
  const ws = await makeWorkspace();
  // Editable areas and the append-only event log must NOT be guarded as raw.
  for (const p of [
    join(ws, "vault", "00_Inbox", `${ID}.md`),
    join(ws, "vault", "10_Working", `${ID}.md`),
    join(ws, "events", "capture_events.jsonl"),
  ]) {
    assert.equal(isRawPath(ws, p), false, `${p} must not be raw`);
    assert.doesNotThrow(() => guardRawImmutable(ws, p, "overwrite"));
    assert.doesNotThrow(() => guardRawImmutable(ws, p, "delete"));
  }
});

test("path traversal that resolves into the raw area is still guarded", async () => {
  const ws = await makeWorkspace();
  const sneaky = join(ws, "vault", "00_Raw", "..", "00_Raw", `${ID}.md`);
  assert.equal(isRawPath(ws, sneaky), true);
  assert.throws(
    () => guardRawImmutable(ws, sneaky, "overwrite"),
    (err: unknown) => err instanceof RawImmutabilityError && err.code === "overwrite_rejected",
  );
});

test("path traversal that escapes the raw area is not guarded", async () => {
  const ws = await makeWorkspace();
  // Resolves to vault/10_Working/... — outside L0, so editing must be allowed.
  const escaped = join(ws, "vault", "00_Raw", "..", "10_Working", `${ID}.md`);
  assert.equal(isRawPath(ws, escaped), false);
  assert.doesNotThrow(() => guardRawImmutable(ws, escaped, "delete"));
});

test("slugged raw notes are immutable too (update + delete refused, bytes unchanged)", async () => {
  const ws = await makeWorkspace();
  const { path } = await writeRawNote({ ...baseInput(ws), slug: SLUG });
  assert.equal(path, rawNotePath(ws, ID, SLUG));
  const before = await readFile(path);

  await assert.rejects(
    () => updateRawNote({ workspace: ws, id: ID, slug: SLUG }),
    (err: unknown) => err instanceof RawImmutabilityError && err.code === "overwrite_rejected",
  );
  await assert.rejects(
    () => deleteRawNote({ workspace: ws, id: ID, slug: SLUG }),
    (err: unknown) => err instanceof RawImmutabilityError && err.code === "delete_rejected",
  );

  assert.ok((await stat(path)).isFile(), "slugged raw file must still exist");
  assert.deepEqual(await readFile(path), before, "slugged raw bytes must be unchanged");
});

test("invariant: after a write, every mutation path is refused and bytes are byte-identical", async () => {
  const ws = await makeWorkspace();
  const { path } = await writeRawNote(baseInput(ws));
  const before = await readFile(path);

  // 1. Re-writing the same id (writer's exclusive-create) is refused.
  await assert.rejects(() => writeRawNote({ ...baseInput(ws), content: "TAMPERED" }));
  // 2. The vault update API is refused.
  await assert.rejects(() => updateRawNote({ workspace: ws, id: ID }));
  // 3. The vault delete API is refused.
  await assert.rejects(() => deleteRawNote({ workspace: ws, id: ID }));
  // 4. A direct fs tamper would be caught by this same byte comparison — assert
  //    none of the refused operations leaked a partial write.
  assert.deepEqual(await readFile(path), before, "raw bytes must survive every refused mutation");

  // Sanity: the comparison would actually catch a change (guards the assertion itself).
  await writeFile(join(ws, "control.txt"), before);
  await writeFile(join(ws, "control.txt"), Buffer.concat([before, Buffer.from("X")]));
  assert.notDeepEqual(await readFile(join(ws, "control.txt")), before);
});
