/**
 * SB-083 — confirmation-gated review queue over the UNCHANGED accept paths:
 * read-only candidates; verbatim proposal passthrough into whole-file
 * validation (invalid ⇒ nothing written, re-asserted over HTTP); the write
 * guard applies; the endpoints' power comes solely from the dashboard grant
 * (another surface identity stays scope_denied on the same op).
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

async function cliJson(argv: string[]): Promise<Record<string, unknown>> {
  const c = io();
  assert.equal(await sbMain(argv, c.io), 0, c.all());
  return JSON.parse(c.all()) as Record<string, unknown>;
}

/** Workspace with one promoted L1 working note (a real distill candidate). */
async function makeFixture(): Promise<{
  ws: string;
  rawId: string;
  workingId: string;
  dashboard: DashboardServer;
  csrf: string;
}> {
  const ws = await mkdtemp(join(tmpdir(), "sb-dashboard-review-"));
  tmpDirs.push(ws);
  const captured = await cliJson([
    "capture", "--content", "Long braindump about espresso ratios.", "--source", "paste",
    "--title", "Espresso Braindump", "--workspace", ws,
  ]);
  const rawId = captured.note_id as string;
  const promoted = await cliJson(["note", "promote", rawId, "--workspace", ws]);
  const workingId = (promoted.note_id ?? promoted.id) as string;
  const dashboard = await startDashboard(ws, 0);
  servers.push(dashboard);
  const session = (await (await fetch(`${dashboard.url}api/session`)).json()) as { csrf: string };
  return { ws, rawId, workingId, dashboard, csrf: session.csrf };
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

function postAccept(
  dashboard: DashboardServer,
  kind: "distill" | "fact",
  body: string,
  headers: Record<string, string>,
): Promise<Response> {
  return fetch(`${dashboard.url}api/${kind}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });
}

test("candidates view is read-only and lists the promoted L1 note", async () => {
  const { ws, workingId, dashboard } = await makeFixture();
  const before = await snapshot(ws);
  const res = await fetch(`${dashboard.url}api/distill/candidates`);
  assert.equal(res.status, 200);
  for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
    assert.equal(res.headers.get(header), value, header);
  }
  const body = await res.text();
  assert.ok(body.includes(workingId), "the working note is a candidate");
  const afterRead = await snapshot(ws);
  assert.deepEqual([...afterRead.keys()].sort(), [...before.keys()].sort());
  for (const [path, bytes] of before) assert.equal(afterRead.get(path), bytes, path);
});

test("distill accept: reviewed proposal lands as L2 + memory event; provenance intact", async () => {
  const { ws, workingId, dashboard, csrf } = await makeFixture();
  const proposal = JSON.stringify({
    source_ids: [workingId],
    title: "Espresso Ratio Principle",
    body: "The 1:2 ratio is the dependable default.",
    rationale: "one coherent idea",
  });
  const res = await postAccept(dashboard, "distill", proposal, { "X-SB-CSRF": csrf });
  const text = await res.text();
  assert.equal(res.status, 200, text);
  const accepted = JSON.parse(text) as { ok: boolean; note_id?: string };
  assert.equal(accepted.ok, true);

  // the L2 note exists and cites its source (provenance)
  const note = (await (
    await fetch(`${dashboard.url}api/notes/${accepted.note_id}`)
  ).json()) as { content: string };
  assert.ok(note.content.includes(workingId), "L2 cites its L1 source");

  // exactly one memory event appended
  const memory = await readFile(join(ws, "events", "memory_events.jsonl"), "utf8");
  const lines = memory.split("\n").filter((l) => l.trim().length > 0);
  assert.equal(lines.length, 1);
  assert.match(lines[0] ?? "", /distillation_accepted/);
});

test("fact accept: reviewed extract_facts proposal lands with provenance; facts visible", async () => {
  const { rawId, dashboard, csrf } = await makeFixture();
  const proposal = JSON.stringify({
    workflow: "extract_facts",
    version: 1,
    proposed_at: "2026-06-11T00:00:00Z",
    items: [
      {
        statement: "the 1:2 espresso ratio is the default",
        source_ref: rawId,
        observed_at: "2026-06-11T00:00:00Z",
        confidence: 0.9,
      },
    ],
  });
  const res = await postAccept(dashboard, "fact", proposal, { "X-SB-CSRF": csrf });
  const text = await res.text();
  assert.equal(res.status, 200, text);
  const facts = await (await fetch(`${dashboard.url}api/facts`)).text();
  assert.ok(facts.includes("the 1:2 espresso ratio is the default"));
});

test("invalid proposals + missing token write NOTHING (whole-file validation over HTTP)", async () => {
  const { ws, workingId, dashboard, csrf } = await makeFixture();
  const before = await snapshot(ws);

  // garbled JSON, schema-invalid distill proposal, schema-invalid fact proposal — all with a valid token
  for (const [kind, body] of [
    ["distill", "{ not json"],
    ["distill", JSON.stringify({ source_ids: [], title: "", body: "" })],
    ["fact", JSON.stringify({ workflow: "extract_facts", version: 1, items: [] })],
    ["fact", JSON.stringify({ workflow: "extract_facts", version: 1, proposed_at: "2026-06-11T00:00:00Z", items: [{ statement: "no provenance" }] })],
  ] as const) {
    const res = await postAccept(dashboard, kind, body, { "X-SB-CSRF": csrf });
    assert.ok(res.status >= 400, `${kind}: ${body.slice(0, 40)} → ${res.status}`);
  }

  // valid proposal but NO token / cross-site origin → csrf_rejected
  const good = JSON.stringify({ source_ids: [workingId], title: "t", body: "b" });
  let res = await postAccept(dashboard, "distill", good, {});
  assert.equal(res.status, 403);
  assert.equal(((await res.json()) as { error: { code: string } }).error.code, "csrf_rejected");
  res = await postAccept(dashboard, "distill", good, { "X-SB-CSRF": csrf, Origin: "http://evil.example" });
  assert.equal(res.status, 403);

  const afterAttempts = await snapshot(ws);
  assert.deepEqual([...afterAttempts.keys()].sort(), [...before.keys()].sort(), "no file appeared");
  for (const [path, bytes] of before) assert.equal(afterAttempts.get(path), bytes, path);
});

test("the accept power comes from the grant alone: another surface identity is scope_denied", async () => {
  const { main } = await import("@sb/cli");
  const c = io();
  const code = await main(
    ["distill", "accept", "--file", join(tmpdir(), "none.json"), "--workspace", tmpdir()],
    c.io,
    "surface:obsidian-helper",
  );
  assert.equal(code, 1);
  assert.match(c.all(), /scope_denied/);
});
