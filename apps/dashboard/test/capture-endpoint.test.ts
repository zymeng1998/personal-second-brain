/**
 * SB-082 — `POST /api/capture` behind the same-origin write guard
 * (approved amendment): valid token ⇒ exactly one L0 note + one capture
 * event; missing/wrong token or foreign Origin ⇒ 403 `csrf_rejected` with
 * ZERO filesystem writes; invalid input ⇒ 4xx, zero writes.
 */
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { SECURITY_HEADERS, startDashboard } from "../src/server.js";
import type { DashboardServer } from "../src/server.js";

const tmpDirs: string[] = [];
const servers: DashboardServer[] = [];

after(async () => {
  for (const dashboard of servers) dashboard.server.close();
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

async function makeDashboard(): Promise<{ ws: string; dashboard: DashboardServer; csrf: string }> {
  const ws = await mkdtemp(join(tmpdir(), "sb-dashboard-capture-"));
  tmpDirs.push(ws);
  const dashboard = await startDashboard(ws, 0);
  servers.push(dashboard);
  const session = (await (await fetch(`${dashboard.url}api/session`)).json()) as { csrf: string };
  return { ws, dashboard, csrf: session.csrf };
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

async function captureEventCount(ws: string): Promise<number> {
  const raw = await readFile(join(ws, "events", "capture_events.jsonl"), "utf8").catch(() => "");
  return raw.split("\n").filter((line) => line.trim().length > 0).length;
}

function post(url: string, body: unknown, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(`${url}api/capture`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

test("valid token: exactly one L0 note + one capture event; note readable over the API", async () => {
  const { ws, dashboard, csrf } = await makeDashboard();
  const eventsBefore = await captureEventCount(ws);

  const res = await post(
    dashboard.url,
    { content: "captured from the dashboard", source: "paste", title: "Dash Note", tags: ["ui"] },
    { "X-SB-CSRF": csrf },
  );
  const resText = await res.text();
  assert.equal(res.status, 200, resText);
  for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
    assert.equal(res.headers.get(header), value, header);
  }
  const result = JSON.parse(resText) as { note_id: string };
  assert.ok(result.note_id.length > 0);

  // exactly one event + one raw note
  assert.equal(await captureEventCount(ws), eventsBefore + 1);
  const rawFiles = await readdir(join(ws, "vault", "00_Raw"));
  assert.equal(rawFiles.filter((f) => f.endsWith(".md")).length, 1);

  // readable back over the API
  const note = (await (await fetch(`${dashboard.url}api/notes/${result.note_id}`)).json()) as {
    content: string;
  };
  assert.ok(note.content.includes("captured from the dashboard"));

  // a browser-shaped request (same-origin Origin header) also passes
  const res2 = await post(
    dashboard.url,
    { content: "second capture", source: "paste" },
    { "X-SB-CSRF": csrf, Origin: `http://127.0.0.1:${dashboard.port}` },
  );
  assert.equal(res2.status, 200);
});

test("missing token, wrong token, and cross-site Origin all fail closed with ZERO writes", async () => {
  const { ws, dashboard, csrf } = await makeDashboard();
  const before = await snapshot(ws);

  const rejected: Array<[string, Record<string, string>]> = [
    ["missing token", {}],
    ["wrong token", { "X-SB-CSRF": "0".repeat(64) }],
    ["valid token but cross-site Origin", { "X-SB-CSRF": csrf, Origin: "http://evil.example" }],
  ];
  for (const [label, headers] of rejected) {
    const res = await post(dashboard.url, { content: "smuggled", source: "paste" }, headers);
    assert.equal(res.status, 403, label);
    const body = (await res.json()) as { error: { code: string } };
    assert.equal(body.error.code, "csrf_rejected", label);
    for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
      assert.equal(res.headers.get(header), value, `${label}: ${header}`);
    }
  }

  const afterAttempts = await snapshot(ws);
  assert.deepEqual([...afterAttempts.keys()].sort(), [...before.keys()].sort(), "no file appeared");
  for (const [path, bytes] of before) assert.equal(afterAttempts.get(path), bytes, path);
});

test("invalid input fails closed AFTER the guard: 4xx envelope, zero writes", async () => {
  const { ws, dashboard, csrf } = await makeDashboard();
  const before = await snapshot(ws);

  const bad: Array<[string, unknown]> = [
    ["empty content", { content: "   ", source: "paste" }],
    ["missing source", { content: "x" }],
    ["non-string content", { content: 42, source: "paste" }],
    ["unknown source kind", { content: "x", source: "carrier-pigeon" }],
  ];
  for (const [label, body] of bad) {
    const res = await post(dashboard.url, body, { "X-SB-CSRF": csrf });
    assert.ok(res.status >= 400 && res.status < 500, `${label}: ${res.status}`);
    assert.equal(((await res.json()) as { ok: boolean }).ok, false, label);
  }
  // malformed JSON body
  const res = await fetch(`${dashboard.url}api/capture`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-SB-CSRF": csrf },
    body: "{ not json",
  });
  assert.equal(res.status, 400);

  const afterAttempts = await snapshot(ws);
  assert.deepEqual([...afterAttempts.keys()].sort(), [...before.keys()].sort());
  for (const [path, bytes] of before) assert.equal(afterAttempts.get(path), bytes, path);
});
