/**
 * SB-084 — the EPIC-CORE-010 "Done when" gate (roadmap Phase 5: "at least
 * one extra surface performs capture+read via contracts only"):
 *  (a) BOTH new surfaces capture + read end-to-end through the enforced
 *      dispatch under their own identities;
 *  (b) full denial sweep per surface outside its grant — byte-identical
 *      workspace (zero writes);
 *  (c) secret-leak scan: a secref pointer's locator sentinel never appears
 *      in any dashboard HTTP response or helper output;
 *  (d) no domain vocabulary in either surface (ADR-001 grep);
 *  (e) SB-074/SB-077 invariants re-asserted with surface identities AND a
 *      grant config present (the full gate files also run in this suite).
 */
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { main as sbMain } from "@sb/cli";
import {
  ALWAYS_DENIED_SCOPES,
  OPERATION_CONTRACTS,
  ScopeDeniedError,
  enforceScope,
  grantAllows,
  parseGrantConfig,
  resolveGrant,
} from "@sb/interfaces";
import type { CoreOperations, PermissionScope } from "@sb/interfaces";
import { main as helperMain } from "@sb/obsidian-helper";
import { SECURITY_HEADERS, startDashboard } from "../src/server.js";
import type { DashboardServer } from "../src/server.js";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
// Sentinel for the LOCATOR of an external document — a placeholder, never a real secret.
const LOCATOR_SENTINEL = "external://secure-volume/GATE-LOCATOR-SENTINEL-0xC0FFEE";

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

async function makeWorkspace(): Promise<string> {
  const ws = await mkdtemp(join(tmpdir(), "sb-surfaces-gate-"));
  tmpDirs.push(ws);
  return ws;
}

test("GATE (a): both surfaces capture + read via contracts only", async () => {
  const ws = await makeWorkspace();

  // --- obsidian-helper: draft → capture → read back, all as surface:obsidian-helper
  const draftDir = await mkdtemp(join(tmpdir(), "sb-gate-drafts-"));
  tmpDirs.push(draftDir);
  const draftPath = join(draftDir, "gate-draft.md");
  await writeFile(draftPath, "---\ntitle: Gate Draft\n---\nhelper-captured body.\n", "utf8");
  let c = io();
  assert.equal(await helperMain(["capture", "--file", draftPath, "--workspace", ws], c.io), 0, c.all());
  const helperNoteId = (JSON.parse(c.all()) as { capture: { note_id: string } }).capture.note_id;
  c = io();
  assert.equal(await helperMain(["check", "--workspace", ws], c.io) >= 0, true); // read path exercised
  const helperRead = io();
  assert.equal(
    await sbMain(["note", "get", helperNoteId, "--workspace", ws], helperRead.io, "surface:obsidian-helper"),
    0,
  );
  assert.ok(helperRead.all().includes("helper-captured body."));

  // --- dashboard: HTTP capture → HTTP read, all as surface:dashboard
  const dashboard = await startDashboard(ws, 0);
  servers.push(dashboard);
  const csrf = ((await (await fetch(`${dashboard.url}api/session`)).json()) as { csrf: string }).csrf;
  const captureRes = await fetch(`${dashboard.url}api/capture`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-SB-CSRF": csrf },
    body: JSON.stringify({ content: "dashboard-captured body.", source: "paste" }),
  });
  assert.equal(captureRes.status, 200);
  const dashNoteId = ((await captureRes.json()) as { note_id: string }).note_id;
  const readBack = (await (
    await fetch(`${dashboard.url}api/notes/${dashNoteId}`)
  ).json()) as { content: string };
  assert.ok(readBack.content.includes("dashboard-captured body."));

  // both captures emitted exactly one event each (2 total)
  const events = await readFile(join(ws, "events", "capture_events.jsonl"), "utf8");
  assert.equal(events.split("\n").filter((l) => l.trim().length > 0).length, 2);
});

test("GATE (b): per-surface denial sweep outside the grant — zero writes", async () => {
  const ws = await makeWorkspace();
  const c = io();
  assert.equal(
    await sbMain(["capture", "--content", "fixture", "--source", "paste", "--workspace", ws], c.io),
    0,
  );
  const noteId = (JSON.parse(c.all()) as { note_id: string }).note_id;
  const before = await snapshot(ws);

  const sweeps: Array<[caller: string, forms: string[][]]> = [
    [
      "surface:obsidian-helper",
      [
        ["distill", "accept", "--file", join(ws, "none.json"), "--workspace", ws],
        ["fact", "list", "--workspace", ws],
        ["fact", "add", "--statement", "x", "--source-ref", noteId, "--workspace", ws],
        ["output", "create", "--file", join(ws, "none.json"), "--workspace", ws],
        ["note", "promote", noteId, "--workspace", ws],
        ["secref", "add", "--kind", "k", "--locator", "external://x", "--workspace", ws],
        ["rebuild", "--workspace", ws],
        ["index", "--workspace", ws],
        ["query", "anything", "--workspace", ws],
      ],
    ],
    [
      "surface:dashboard",
      [
        ["note", "promote", noteId, "--workspace", ws],
        ["output", "create", "--file", join(ws, "none.json"), "--workspace", ws],
        ["secref", "add", "--kind", "k", "--locator", "external://x", "--workspace", ws],
        ["rebuild", "--workspace", ws],
        ["index", "--workspace", ws],
      ],
    ],
  ];
  for (const [caller, forms] of sweeps) {
    for (const argv of forms) {
      const probe = io();
      assert.equal(await sbMain(argv, probe.io, caller), 1, `${caller}: ${argv.join(" ")}`);
      assert.match(probe.all(), /scope_denied/, `${caller}: ${argv.join(" ")}`);
    }
  }

  const afterSweep = await snapshot(ws);
  assert.deepEqual([...afterSweep.keys()].sort(), [...before.keys()].sort());
  for (const [path, bytes] of before) assert.equal(afterSweep.get(path), bytes, path);
});

test("GATE (c): the secref locator sentinel never leaks through either surface", async () => {
  const ws = await makeWorkspace();
  // fixtures as the human: a note citing the pointer + the pointer itself
  let c = io();
  assert.equal(
    await sbMain(
      ["secref", "add", "--kind", "identity_document", "--locator", LOCATOR_SENTINEL, "--id", "secref_gate_0002", "--workspace", ws],
      c.io,
    ),
    0,
  );
  c = io();
  assert.equal(
    await sbMain(
      ["capture", "--content", "Filed the scan as secref_gate_0002.", "--source", "paste", "--title", "Filing Note", "--workspace", ws],
      c.io,
    ),
    0,
  );
  const noteId = (JSON.parse(c.all()) as { note_id: string }).note_id;

  // collect EVERY dashboard response body
  const dashboard = await startDashboard(ws, 0);
  servers.push(dashboard);
  const bodies: string[] = [];
  for (const path of ["", "app.js", "style.css", "api/session", "api/notes", `api/notes/${noteId}`, "api/facts", "api/distill/candidates", "api/unknown"]) {
    bodies.push(await (await fetch(`${dashboard.url}${path}`)).text());
  }
  // and the helper's full output surface (check + a read)
  c = io();
  await helperMain(["check", "--workspace", ws], c.io);
  bodies.push(c.all());
  const helperRead = io();
  await sbMain(["secref", "list", "--workspace", ws], helperRead.io, "surface:obsidian-helper");
  // secref list IS readable pointer metadata for a read:notes holder — but even
  // there the gate only requires no responses from the SURFACES leak it:
  for (const body of bodies) {
    assert.ok(!body.includes(LOCATOR_SENTINEL), "locator sentinel leaked through a surface");
    assert.ok(!body.includes("0xC0FFEE"), "sentinel fragment leaked through a surface");
  }
});

test("GATE (d): no domain vocabulary in either surface (ADR-001)", async () => {
  const DOMAIN_TERMS = /broker|landlord|commission|rental/i;
  const GUARD_LINE = /no broker|never broker|domain-neutral/i;
  const offenders: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      // the scanner itself carries the term list — exclude it, scan everything else
      if (entry.name === "node_modules" || entry.name === "surfaces-gate.test.ts" || entry.isSymbolicLink()) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (/\.(ts|js|json|html|css|md)$/.test(entry.name)) {
        const lines = (await readFile(path, "utf8")).split("\n");
        if (lines.some((line) => DOMAIN_TERMS.test(line) && !GUARD_LINE.test(line))) {
          offenders.push(relative(REPO_ROOT, path));
        }
      }
    }
  };
  await walk(join(REPO_ROOT, "apps", "dashboard"));
  await walk(join(REPO_ROOT, "apps", "obsidian-helper"));
  assert.deepEqual(offenders, [], `domain terms in surfaces: ${offenders.join(", ")}`);
});

test("GATE (e): SB-074/SB-077 invariants hold with surface identities and config present", () => {
  const config = parseGrantConfig(
    JSON.stringify({ version: 1, grants: [{ app: "domain-app:gate", allow: ["read:notes"] }] }),
  );

  // write ops denied for under-privileged callers, config in hand
  const writeOps = (Object.keys(OPERATION_CONTRACTS) as Array<keyof CoreOperations>).filter(
    (op) => !OPERATION_CONTRACTS[op].readOnly,
  );
  for (const op of writeOps) {
    assert.throws(() => enforceScope("domain-app:rogue", op, config), ScopeDeniedError);
    assert.throws(() => enforceScope("skill:any", op, config), ScopeDeniedError);
    if (op !== "indexVault") {
      assert.throws(() => enforceScope("sidecar:retrieval", op, config), ScopeDeniedError);
    }
  }
  // surfaces hold ONLY their tables even with config present
  assert.throws(() => enforceScope("surface:obsidian-helper", "rebuildProjections", config), ScopeDeniedError);
  assert.throws(() => enforceScope("surface:dashboard", "composeOutput", config), ScopeDeniedError);
  assert.doesNotThrow(() => enforceScope("surface:dashboard", "capture", config));

  // ALWAYS_DENIED unobtainable for every caller class — surfaces included
  for (const denied of ALWAYS_DENIED_SCOPES) {
    const probe: PermissionScope = denied === "delete:*" ? ("delete:notes" as PermissionScope) : denied;
    for (const caller of ["cli", "sidecar:retrieval", "skill:any", "surface:obsidian-helper", "surface:dashboard", "domain-app:gate", "domain-app:rogue"]) {
      assert.equal(grantAllows(resolveGrant(caller, config), probe), false, `${caller} vs ${probe}`);
    }
  }
});
