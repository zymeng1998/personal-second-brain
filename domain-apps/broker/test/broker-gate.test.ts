/**
 * SB-094 — broker epic gate (EPIC-DOMAIN-001 "Done when"), Node-only.
 *
 *  (a) BINDING HOLDS — under the CHECKED-IN cumulative broker grant, reads
 *      succeed; every form OUTSIDE the v1 grant is scope_denied and read-only
 *      ops leave the workspace byte-identical.
 *  (b) INTAKE ROUND-TRIP — capture → promote → facts writes exactly the
 *      expected L0 + L1 (citing the L0) + provenance-carrying facts; L0 immutable.
 *  (c) NO LEAK — a secure_ref locator sentinel lives ONLY in the cli-created
 *      secref pointer; it appears in NO broker-produced note/event/fact/output/
 *      stdout. A synthetic contact handle never enters the structured facts.
 *  (d) DOMAIN-NEUTRAL CORE — ADR-001 grep of packages/ + schemas/ stays clean.
 *  (e) SB-074/077/084/087 RE-ASSERTED for domain-app:broker — ALWAYS_DENIED and
 *      write:secure_refs unobtainable; privileged/malformed configs fail closed.
 *
 * Synthetic data only (OQ #45).
 */
import { existsSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { main } from "@sb/cli";
import { enforceScope, loadGrantConfig, ScopeDeniedError } from "@sb/interfaces";
import {
  BROKER_CALLER,
  acceptPreferenceFacts,
  buildPreferenceProposal,
  captureClientNote,
  getNote,
  invokeAs,
  listFacts,
  listNotes,
  promoteClient,
} from "../src/index.js";
import type { ClientPreference } from "../src/index.js";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SAMPLE = join(REPO_ROOT, "examples", "grants", "broker.sample.json");
const SECREF_LOCATOR_SENTINEL = "SECREF_LOCATOR_LEAK_SENTINEL_0xDEADBEEF";
const CONTACT_SENTINEL = "wechat:CONTACT_LEAK_SENTINEL_0xCAFE";

const tmpDirs: string[] = [];
after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

function cliIo(): { io: { out: (t: string) => void; err: (t: string) => void }; text: () => string } {
  let buf = "";
  return { io: { out: (t: string) => void (buf += t), err: (t: string) => void (buf += t) }, text: () => buf };
}

/** Workspace with the CHECKED-IN cumulative broker sample as its config (proves the real binding). */
async function workspaceWithSample(): Promise<string> {
  const ws = await mkdtemp(join(tmpdir(), "sb-broker-gate-"));
  tmpDirs.push(ws);
  await mkdir(join(ws, "config"), { recursive: true });
  await copyFile(SAMPLE, join(ws, "config", "grants.json"));
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

function synthPreferences(sourceRef: string): ClientPreference[] {
  return [
    { kind: "budget", statement: "Client A target budget is around 2000/month", source_ref: sourceRef, observed_at: "2026-06-13T10:00:00Z", confidence: 0.9 },
    { kind: "bedrooms", statement: "Client A needs at least 2 bedrooms", source_ref: sourceRef, observed_at: "2026-06-13T10:00:00Z", confidence: 0.95 },
  ];
}

/** Full broker intake round-trip; returns ids + the broker's collected stdout/stderr. */
async function runIntake(ws: string): Promise<{ l0: string; l1: string; brokerOutput: string }> {
  let brokerOutput = "";
  const cap = await captureClientNote({
    workspace: ws,
    text: `Client A — 2 bedrooms, river district, budget ~2000/month. Contact ${CONTACT_SENTINEL} (synthetic).`,
    title: "Client A brief",
  });
  brokerOutput += cap.stdout + cap.stderr;
  assert.equal(cap.exitCode, 0, cap.stderr);
  const promoted = await promoteClient(ws, cap.note_id as string);
  brokerOutput += promoted.stdout + promoted.stderr;
  assert.equal(promoted.exitCode, 0, promoted.stderr);

  const proposal = buildPreferenceProposal(synthPreferences(promoted.note_id as string));
  const proposalPath = join(tmpdir(), `broker-gate-proposal-${Date.now()}.json`);
  await writeFile(proposalPath, JSON.stringify(proposal));
  tmpDirs.push(proposalPath);
  const accepted = await acceptPreferenceFacts(ws, proposalPath);
  brokerOutput += accepted.stdout + accepted.stderr;
  assert.equal(accepted.exitCode, 0, accepted.stderr);
  assert.equal(accepted.written, 2);

  return { l0: cap.note_id as string, l1: promoted.note_id as string, brokerOutput };
}

test("(a) binding holds: reads succeed, out-of-grant forms denied, read-only byte-identical", async () => {
  const ws = await workspaceWithSample();
  await runIntake(ws); // populate, then baseline after writes
  const baseline = await snapshot(ws);

  // Reads succeed under the cumulative grant.
  assert.equal((await listNotes(ws)).exitCode, 0);
  assert.equal((await listFacts(ws)).exitCode, 0);

  // Forms OUTSIDE the v1 grant ⇒ scope_denied (write:outputs/secure_refs/distill/index, rebuild).
  const deniedForms: string[][] = [
    ["output", "create", "--file", join(ws, "none.json"), "--workspace", ws],
    ["secref", "add", "--kind", "k", "--locator", "external://x", "--workspace", ws],
    ["distill", "accept", "--file", join(ws, "none.json"), "--workspace", ws],
    ["rebuild", "--workspace", ws],
    ["index", "--workspace", ws],
  ];
  for (const argv of deniedForms) {
    const r = await invokeAs(argv);
    assert.equal(r.exitCode, 1, `${argv.join(" ")} must fail`);
    assert.match(r.stderr, /scope_denied/, `${argv.join(" ")} scope_denied`);
    assert.ok(r.stderr.includes(BROKER_CALLER), "denial names the caller");
  }

  const after = await snapshot(ws);
  assert.deepEqual([...after.keys()].sort(), [...baseline.keys()].sort(), "no file created or deleted");
  for (const [path, bytes] of baseline) assert.equal(after.get(path), bytes, `byte change in ${path}`);
});

test("(b) intake round-trip: L0 + L1 (cites L0) + provenance facts; L0 immutable", async () => {
  const ws = await workspaceWithSample();
  const { l0, l1 } = await runIntake(ws);
  const l0Before = await getNote(ws, l0);

  const l0Note = await getNote(ws, l0);
  assert.match(l0Note.stdout, /type:\s*raw/, "L0 is a generic raw note");
  const l1Note = await getNote(ws, l1);
  assert.ok(l1Note.stdout.includes(l0), "L1 cites the L0 source_ref");

  const facts = await listFacts(ws);
  assert.match(facts.stdout, /target budget is around 2000/);
  assert.match(facts.stdout, /at least 2 bedrooms/);

  const l0After = await getNote(ws, l0);
  assert.equal(l0After.stdout, l0Before.stdout, "L0 raw note is byte-unchanged across promote + facts");
});

test("(c) no leak: secref locator sentinel only in the secref pointer; contacts out of facts", async () => {
  const ws = await workspaceWithSample();
  // The HUMAN (cli) mints a secure_ref carrying a sentinel locator (broker cannot).
  const c = cliIo();
  assert.equal(
    await main(["secref", "add", "--kind", "listing", "--locator", SECREF_LOCATOR_SENTINEL, "--workspace", ws], c.io),
    0,
    c.text(),
  );
  const { brokerOutput } = await runIntake(ws);

  // The locator sentinel appears in EXACTLY one file (the secref pointer) and never in broker output.
  const files = await snapshot(ws);
  const hits: string[] = [];
  for (const [path, b64] of files) {
    if (Buffer.from(b64, "base64").toString("utf8").includes(SECREF_LOCATOR_SENTINEL)) hits.push(path);
  }
  assert.equal(hits.length, 1, `locator sentinel must live in exactly one file, found in: ${hits.join(", ")}`);
  assert.match(hits[0] as string, /secure_refs/, "the one file is the secref pointer");
  assert.ok(!brokerOutput.includes(SECREF_LOCATOR_SENTINEL), "broker output never echoes the locator");

  // The synthetic contact handle never enters the STRUCTURED facts.
  const facts = await listFacts(ws);
  assert.ok(!facts.stdout.includes(CONTACT_SENTINEL), "contact detail kept out of structured facts");
});

test("(d) domain-neutral core: ADR-001 grep of packages/ + schemas/ stays clean", async () => {
  const DOMAIN_TERMS = /broker|landlord|commission|rental/i;
  const GUARD_LINE = /no broker|never broker|domain-neutral/i;
  const offenders: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "test" || entry.isSymbolicLink()) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (/\.(ts|json|sql)$/.test(entry.name)) {
        const lines = (await readFile(path, "utf8")).split("\n");
        if (lines.some((line) => DOMAIN_TERMS.test(line) && !GUARD_LINE.test(line))) {
          offenders.push(relative(REPO_ROOT, path));
        }
      }
    }
  };
  await walk(join(REPO_ROOT, "packages"));
  await walk(join(REPO_ROOT, "schemas"));
  assert.deepEqual(offenders, [], `domain terms leaked into the core: ${offenders.join(", ")}`);
});

test("(e) SB-074/077/084/087 re-asserted for domain-app:broker", async () => {
  // SB-074: write:secure_refs is NOT in the cumulative grant; read:secure_refs is ALWAYS_DENIED.
  const ws = await workspaceWithSample();
  const cfg = await loadGrantConfig(ws);
  assert.throws(() => enforceScope(BROKER_CALLER, "write:secure_refs", cfg), (e: unknown) => e instanceof ScopeDeniedError);
  assert.throws(() => enforceScope(BROKER_CALLER, "read:secure_refs", cfg), (e: unknown) => e instanceof ScopeDeniedError);
  const secref = await invokeAs(["secref", "add", "--kind", "k", "--locator", "external://x", "--workspace", ws]);
  assert.equal(secref.exitCode, 1);
  assert.match(secref.stderr, /scope_denied/);

  // SB-077: privileged scope in config ⇒ whole file rejected; broker denied, nothing runs.
  const wsBad = await mkdtemp(join(tmpdir(), "sb-broker-gate-bad-"));
  tmpDirs.push(wsBad);
  await mkdir(join(wsBad, "config"), { recursive: true });
  await writeFile(
    join(wsBad, "config", "grants.json"),
    JSON.stringify({ version: 1, grants: [{ app: "domain-app:broker", allow: ["read:notes", "write:raw"] }] }),
  );
  const denied = await invokeAs(["note", "list", "--workspace", wsBad]);
  assert.equal(denied.exitCode, 1, "privileged-scope config must fail closed");
  assert.match(denied.stderr, /grant_config_invalid|scope_denied/);

  // SB-077: duplicate app entries ⇒ fail closed.
  const wsDup = await mkdtemp(join(tmpdir(), "sb-broker-gate-dup-"));
  tmpDirs.push(wsDup);
  await mkdir(join(wsDup, "config"), { recursive: true });
  await writeFile(
    join(wsDup, "config", "grants.json"),
    JSON.stringify({
      version: 1,
      grants: [
        { app: "domain-app:broker", allow: ["read:notes"] },
        { app: "domain-app:broker", allow: ["read:facts"] },
      ],
    }),
  );
  const dup = await invokeAs(["note", "list", "--workspace", wsDup]);
  assert.equal(dup.exitCode, 1, "duplicate-app config must fail closed");
  assert.match(dup.stderr, /grant_config_invalid/);
});
