/**
 * SB-076 — config threading at the CLI dispatch boundary (OQ #30):
 * `main(argv, io, caller)` loads the workspace `config/grants.json` ONLY for
 * `domain-app:*` callers; a config-granted read-only app can read through the
 * same enforced path while staying denied on writes; malformed config fails
 * closed for domain apps and is invisible to first-party callers.
 */
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { main } from "../src/index.js";

const APP = "domain-app:itest";
const tmpDirs: string[] = [];

after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

interface Capture {
  io: { out: (t: string) => void; err: (t: string) => void };
  stdout: () => string;
  stderr: () => string;
}

function captureIo(): Capture {
  let out = "";
  let err = "";
  return {
    io: { out: (t: string) => void (out += t), err: (t: string) => void (err += t) },
    stdout: () => out,
    stderr: () => err,
  };
}

async function makeWorkspaceWithNote(): Promise<{ ws: string; noteId: string }> {
  const ws = await mkdtemp(join(tmpdir(), "sb-domain-config-"));
  tmpDirs.push(ws);
  const c = captureIo();
  assert.equal(
    await main(
      ["capture", "--content", "domain boundary fixture", "--source", "paste", "--workspace", ws],
      c.io,
    ),
    0,
    c.stderr(),
  );
  const noteId = (JSON.parse(c.stdout()) as { note_id: string }).note_id;
  return { ws, noteId };
}

async function writeConfig(ws: string, content: string): Promise<void> {
  await mkdir(join(ws, "config"), { recursive: true });
  await writeFile(join(ws, "config", "grants.json"), content, "utf8");
}

const READONLY_CONFIG = JSON.stringify({
  version: 1,
  grants: [{ app: APP, allow: ["read:notes", "read:facts"] }],
});

test("config-granted domain app: reads succeed through the enforced dispatch, writes scope_denied", async () => {
  const { ws, noteId } = await makeWorkspaceWithNote();
  await writeConfig(ws, READONLY_CONFIG);

  // read:notes — list + get under the app's own identity
  let c = captureIo();
  assert.equal(await main(["note", "list", "--workspace", ws], c.io, APP), 0, c.stderr());
  assert.ok(c.stdout().includes(noteId), "the captured note is listed");
  c = captureIo();
  assert.equal(await main(["note", "get", noteId, "--workspace", ws], c.io, APP), 0, c.stderr());
  assert.ok(c.stdout().includes("domain boundary fixture"));

  // read:facts
  c = captureIo();
  assert.equal(await main(["fact", "list", "--workspace", ws], c.io, APP), 0, c.stderr());

  // writes: denied with the structured scope_denied envelope
  c = captureIo();
  assert.equal(
    await main(["capture", "--content", "nope", "--source", "paste", "--workspace", ws], c.io, APP),
    1,
  );
  assert.match(c.stderr(), /scope_denied/);
  c = captureIo();
  assert.equal(await main(["note", "promote", noteId, "--workspace", ws], c.io, APP), 1);
  assert.match(c.stderr(), /scope_denied/);
});

test("no config file: domain-app caller is denied everything (default-deny)", async () => {
  const { ws } = await makeWorkspaceWithNote();
  const c = captureIo();
  assert.equal(await main(["note", "list", "--workspace", ws], c.io, APP), 1);
  assert.match(c.stderr(), /scope_denied/);
});

test("malformed config fails closed for domain apps and is INVISIBLE to first-party callers", async () => {
  const { ws, noteId } = await makeWorkspaceWithNote();
  await writeConfig(ws, '{ "version": 1, "grants": [ { "app": "cli", "allow": [] } ] }');

  // domain app: the whole file is rejected → grant_config_invalid, nothing runs
  let c = captureIo();
  assert.equal(await main(["note", "list", "--workspace", ws], c.io, APP), 1);
  assert.match(c.stderr(), /grant_config_invalid/);

  // first-party cli: config never loaded — behavior byte-identical (reads + writes fine)
  c = captureIo();
  assert.equal(await main(["note", "list", "--workspace", ws], c.io), 0, c.stderr());
  assert.ok(c.stdout().includes(noteId));
  c = captureIo();
  assert.equal(
    await main(["capture", "--content", "still works", "--source", "paste", "--workspace", ws], c.io),
    0,
    c.stderr(),
  );
});

test("granted scopes do not leak across apps: a different domain app stays denied", async () => {
  const { ws } = await makeWorkspaceWithNote();
  await writeConfig(ws, READONLY_CONFIG);
  const c = captureIo();
  assert.equal(await main(["note", "list", "--workspace", ws], c.io, "domain-app:other"), 1);
  assert.match(c.stderr(), /scope_denied/);
});
