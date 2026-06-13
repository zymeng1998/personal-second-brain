/**
 * SB-091 — client working note via `note promote` (`write:notes`).
 *  - capture an L0 client note, then promote it → an L1 working note in
 *    00_Inbox whose source_ref resolves to the L0; the L0 stays byte-unchanged;
 *  - WITHOUT `write:notes`, promote is scope_denied with zero filesystem writes.
 *
 * Synthetic data only (OQ #45).
 */
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { captureClientNote, getNote, promoteClient } from "../src/index.js";

const tmpDirs: string[] = [];
after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

async function freshWorkspace(allow: string[]): Promise<string> {
  const ws = await mkdtemp(join(tmpdir(), "sb-broker-promote-"));
  tmpDirs.push(ws);
  await mkdir(join(ws, "config"), { recursive: true });
  await writeFile(
    join(ws, "config", "grants.json"),
    JSON.stringify({ version: 1, grants: [{ app: "domain-app:broker", allow }] }, null, 2),
  );
  return ws;
}

async function snapshot(root: string): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  const walk = async (dir: string): Promise<void> => {
    if (!existsSync(dir)) return;
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else files.set(relative(root, path), (await readFile(path)).toString("base64"));
    }
  };
  await walk(root);
  return files;
}

test("promotes a captured L0 client note → L1 working note citing the L0; L0 unchanged", async () => {
  const ws = await freshWorkspace(["read:notes", "read:facts", "write:capture", "write:notes"]);
  const cap = await captureClientNote({
    workspace: ws,
    text: "Client A wants a 2-bedroom near the river district, budget around 2000/month",
    title: "Client A brief",
  });
  assert.equal(cap.exitCode, 0, cap.stderr);
  const l0Id = cap.note_id as string;
  const l0Before = await getNote(ws, l0Id);
  assert.equal(l0Before.exitCode, 0);

  const promoted = await promoteClient(ws, l0Id);
  assert.equal(promoted.exitCode, 0, promoted.stderr);
  assert.ok(promoted.note_id, "an L1 note id is returned");
  assert.equal(promoted.source_ref, l0Id, "L1 source_ref resolves to the L0 origin");

  const l1 = await getNote(ws, promoted.note_id as string);
  assert.equal(l1.exitCode, 0, l1.stderr);
  assert.ok(l1.stdout.includes(l0Id), "L1 frontmatter cites the L0 source_ref");
  assert.ok(l1.stdout.includes("river district"), "working body seeded from the L0 content");

  // L0 immutable across the promote.
  const l0After = await getNote(ws, l0Id);
  assert.equal(l0After.stdout, l0Before.stdout, "L0 raw note is byte-unchanged");
});

test("WITHOUT write:notes, promote is scope_denied with ZERO writes", async () => {
  const ws = await freshWorkspace(["read:notes", "read:facts", "write:capture"]);
  const cap = await captureClientNote({ workspace: ws, text: "Client B wants a studio near the metro" });
  assert.equal(cap.exitCode, 0, cap.stderr);
  const before = await snapshot(ws);

  const promoted = await promoteClient(ws, cap.note_id as string);
  assert.equal(promoted.exitCode, 1);
  assert.match(promoted.stderr, /scope_denied/);
  assert.match(promoted.stderr, /domain-app:broker/);

  const after = await snapshot(ws);
  assert.deepEqual([...after.keys()].sort(), [...before.keys()].sort(), "no file created or deleted");
  for (const [path, bytes] of before) assert.equal(after.get(path), bytes, `byte change in ${path}`);
});
