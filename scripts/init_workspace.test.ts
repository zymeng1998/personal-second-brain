/**
 * Tests for scripts/init_workspace.ts (SB-033). The initializer is exercised as
 * a real subprocess (its actual CLI surface) against temp workspaces via the
 * SECOND_BRAIN_WORKSPACE env var. Covers: dry-run writes nothing, real init,
 * --verify pass/fail, idempotent re-init (byte-identical), and the append-only
 * event-file invariant (an existing event file is never truncated).
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { appendFile, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { after, test } from "node:test";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(REPO_ROOT, "scripts", "init_workspace.ts");

const tmpDirs: string[] = [];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "sb-init-"));
  tmpDirs.push(dir);
  return dir;
}

function runInit(ws: string, ...flags: string[]): { status: number | null; stderr: string } {
  const result = spawnSync(process.execPath, ["--import", "tsx", SCRIPT, ...flags], {
    cwd: REPO_ROOT,
    env: { ...process.env, SECOND_BRAIN_WORKSPACE: ws },
    encoding: "utf8",
    timeout: 60_000,
  });
  return { status: result.status, stderr: result.stderr };
}

/** Map of workspace-relative file path -> bytes, for byte-identity assertions. */
async function snapshotFiles(root: string): Promise<Record<string, string>> {
  const snapshot: Record<string, string> = {};
  for (const entry of (await readdir(root, { recursive: true, withFileTypes: true }))) {
    if (!entry.isFile()) continue;
    const abs = join(entry.parentPath ?? (entry as { path?: string }).path ?? root, entry.name);
    snapshot[abs.slice(root.length + 1)] = await readFile(abs, "utf8");
  }
  return snapshot;
}

after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

test("--dry-run validates and writes nothing", async () => {
  const ws = await makeWorkspace();
  const { status } = runInit(ws, "--dry-run");
  assert.equal(status, 0);
  assert.deepEqual(await readdir(ws), []);
});

test("real run creates the tree + event files; --verify then passes", async () => {
  const ws = await makeWorkspace();
  assert.equal(runInit(ws).status, 0);
  assert.ok(existsSync(join(ws, "vault", "00_Raw")));
  assert.ok(existsSync(join(ws, "vault", "00_Inbox")));
  assert.ok(existsSync(join(ws, "events", "capture_events.jsonl")));
  assert.ok(existsSync(join(ws, "indexes")));
  assert.equal(runInit(ws, "--verify").status, 0);
});

test("--verify fails on an uninitialized workspace", async () => {
  const ws = await makeWorkspace();
  const { status } = runInit(ws, "--verify");
  assert.notEqual(status, 0);
});

test("re-init is idempotent: every file byte-identical, exit 0", async () => {
  const ws = await makeWorkspace();
  assert.equal(runInit(ws).status, 0);
  const before = await snapshotFiles(ws);
  assert.equal(runInit(ws).status, 0);
  assert.deepEqual(await snapshotFiles(ws), before);
});

test("append-only invariant: an existing event file is never truncated", async () => {
  const ws = await makeWorkspace();
  assert.equal(runInit(ws).status, 0);
  const eventFile = join(ws, "events", "capture_events.jsonl");
  const line = '{"event_id":"01KT6C7GH0PM1K6XQH3K6ZG8BT","stream":"capture","kind":"captured"}\n';
  await appendFile(eventFile, line, "utf8");
  assert.equal(runInit(ws).status, 0);
  assert.equal(await readFile(eventFile, "utf8"), line);
});

test("unknown flag is a hard error", async () => {
  const ws = await makeWorkspace();
  const { status } = runInit(ws, "--frobnicate");
  assert.notEqual(status, 0);
  assert.deepEqual(await readdir(ws), []);
});
