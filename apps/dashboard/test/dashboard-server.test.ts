/**
 * SB-081 — read-only dashboard server: 127.0.0.1 binding, strict headers on
 * EVERY response, JSON API fronting the enforced dispatch, static UI, zero
 * workspace writes, scope_denied surfaced as a structured envelope.
 */
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { main as sbMain } from "@sb/cli";
import { SECURITY_HEADERS, startDashboard } from "../src/server.js";
import type { DashboardServer } from "../src/server.js";
import { invoke } from "../src/invoke.js";

const tmpDirs: string[] = [];
const servers: DashboardServer[] = [];

after(async () => {
  for (const dashboard of servers) dashboard.server.close();
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

function io(): { io: { out: (t: string) => void; err: (t: string) => void }; all: () => string } {
  let buf = "";
  return { io: { out: (t: string) => void (buf += t), err: (t: string) => void (buf += t) }, all: () => buf };
}

async function makeFixture(): Promise<{ ws: string; ids: string[]; dashboard: DashboardServer }> {
  const ws = await mkdtemp(join(tmpdir(), "sb-dashboard-"));
  tmpDirs.push(ws);
  const ids: string[] = [];
  for (const [title, content] of [
    ["Espresso Guide", "Dose 18g, yield 36g."],
    ["Reading List", "Three books queued."],
  ]) {
    const c = io();
    assert.equal(
      await sbMain(
        ["capture", "--content", content as string, "--source", "paste", "--title", title as string, "--workspace", ws],
        c.io,
      ),
      0,
      c.all(),
    );
    ids.push((JSON.parse(c.all()) as { note_id: string }).note_id);
  }
  const c = io();
  assert.equal(
    await sbMain(
      ["fact", "add", "--statement", "18g in, 36g out works best", "--source-ref", ids[0] as string, "--confidence", "0.9", "--workspace", ws],
      c.io,
    ),
    0,
    c.all(),
  );
  const dashboard = await startDashboard(ws, 0);
  servers.push(dashboard);
  return { ws, ids, dashboard };
}

function assertSecurityHeaders(res: Response, label: string): void {
  for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
    assert.equal(res.headers.get(header), value, `${label}: missing/wrong ${header}`);
  }
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

test("binds to 127.0.0.1 only and serves the API + static UI with strict headers everywhere", async () => {
  const { ws, ids, dashboard } = await makeFixture();
  const address = dashboard.server.address();
  assert.ok(typeof address === "object" && address !== null);
  assert.equal((address as { address: string }).address, "127.0.0.1");

  const before = await snapshot(ws);

  // notes list
  let res = await fetch(`${dashboard.url}api/notes`);
  assert.equal(res.status, 200);
  assertSecurityHeaders(res, "/api/notes");
  const notes = (await res.json()) as { ok: boolean; notes: Array<{ id: string; title: string | null }> };
  assert.equal(notes.ok, true);
  assert.deepEqual(notes.notes.map((n) => n.id).sort(), [...ids].sort());

  // type filter
  res = await fetch(`${dashboard.url}api/notes?type=raw`);
  assert.equal(((await res.json()) as { notes: unknown[] }).notes.length, 2);
  res = await fetch(`${dashboard.url}api/notes?type=working`);
  assert.equal(((await res.json()) as { notes: unknown[] }).notes.length, 0);

  // note content
  res = await fetch(`${dashboard.url}api/notes/${ids[0]}`);
  assert.equal(res.status, 200);
  assertSecurityHeaders(res, "/api/notes/:id");
  const note = (await res.json()) as { content: string };
  assert.ok(note.content.includes("Dose 18g, yield 36g."));

  // facts
  res = await fetch(`${dashboard.url}api/facts`);
  assert.equal(res.status, 200);
  assertSecurityHeaders(res, "/api/facts");
  assert.ok((await res.text()).includes("18g in, 36g out works best"));

  // static UI
  res = await fetch(dashboard.url);
  assert.equal(res.status, 200);
  assertSecurityHeaders(res, "/");
  assert.match(await res.text(), /Second Brain/);
  res = await fetch(`${dashboard.url}app.js`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /javascript/);
  assertSecurityHeaders(res, "/app.js");

  // errors carry headers + envelopes too
  res = await fetch(`${dashboard.url}api/unknown`);
  assert.equal(res.status, 404);
  assertSecurityHeaders(res, "404");
  assert.equal(((await res.json()) as { error: { code: string } }).error.code, "not_found");
  res = await fetch(`${dashboard.url}api/notes/not-a-ulid`);
  assert.equal(res.status, 400);
  res = await fetch(`${dashboard.url}no-such-page`);
  assert.equal(res.status, 404);
  assertSecurityHeaders(res, "static 404");

  // v1 is read-only: non-GET api calls are rejected
  res = await fetch(`${dashboard.url}api/notes`, { method: "POST" });
  assert.equal(res.status, 405);
  assertSecurityHeaders(res, "405");

  // the whole session performed ZERO workspace writes
  const afterAll = await snapshot(ws);
  assert.deepEqual([...afterAll.keys()].sort(), [...before.keys()].sort());
  for (const [path, bytes] of before) assert.equal(afterAll.get(path), bytes, path);
});

test("the dashboard identity is enforced: ungranted operations are scope_denied", async () => {
  const ws = await mkdtemp(join(tmpdir(), "sb-dashboard-denial-"));
  tmpDirs.push(ws);
  for (const argv of [
    ["rebuild", "--workspace", ws],
    ["distill", "accept", "--file", join(ws, "none.json"), "--workspace", ws],
    ["fact", "add", "--statement", "x", "--source-ref", "01ARZ3NDEKTSV4RRFFQ69G5FAV", "--workspace", ws],
    ["secref", "add", "--kind", "k", "--locator", "external://x", "--workspace", ws],
  ]) {
    const result = await invoke(argv);
    assert.equal(result.exitCode, 1, argv.join(" "));
    assert.match(result.stderr, /scope_denied/, argv.join(" "));
  }
});
