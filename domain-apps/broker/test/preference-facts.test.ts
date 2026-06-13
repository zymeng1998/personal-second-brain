/**
 * SB-092 — client-preference facts via the unchanged `fact accept` path
 * (`write:facts` + `read:index`).
 *  - a human-reviewed preference proposal (built by the broker vocabulary) is
 *    accepted through `fact accept` → generic L3 facts with provenance,
 *    readable via `fact list`;
 *  - a malformed proposal is rejected whole-file → ZERO facts written, vault
 *    byte-unchanged (confirmation-gated; no partial/auto extraction);
 *  - WITHOUT `write:facts`, accept is scope_denied with zero writes;
 *  - `read:index` is granted (SB-093 match prerequisite) — proven via the real
 *    enforcer without spawning the sidecar.
 *
 * Synthetic data only (OQ #45).
 */
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { enforceScope, loadGrantConfig, ScopeDeniedError } from "@sb/interfaces";
import {
  acceptPreferenceFacts,
  buildPreferenceProposal,
  captureClientNote,
  listFacts,
  promoteClient,
} from "../src/index.js";
import type { ClientPreference } from "../src/index.js";

const FULL_GRANT = ["read:notes", "read:facts", "read:index", "write:capture", "write:notes", "write:facts"];
const tmpDirs: string[] = [];
after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

async function freshWorkspace(allow: string[]): Promise<string> {
  const ws = await mkdtemp(join(tmpdir(), "sb-broker-facts-"));
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

/** Capture + promote a synthetic client note; return the L1 working-note id (the provenance source_ref). */
async function seedClientNote(ws: string): Promise<string> {
  const cap = await captureClientNote({
    workspace: ws,
    text: "Client A — 2 bedrooms, river district, budget ~2000/month, move-in next quarter",
    title: "Client A brief",
  });
  assert.equal(cap.exitCode, 0, cap.stderr);
  const promoted = await promoteClient(ws, cap.note_id as string);
  assert.equal(promoted.exitCode, 0, promoted.stderr);
  return promoted.note_id as string;
}

function synthPreferences(sourceRef: string): ClientPreference[] {
  return [
    { kind: "budget", statement: "Client A target budget is around 2000/month", source_ref: sourceRef, observed_at: "2026-06-13T10:00:00Z", confidence: 0.9 },
    { kind: "bedrooms", statement: "Client A needs at least 2 bedrooms", source_ref: sourceRef, observed_at: "2026-06-13T10:00:00Z", confidence: 0.95 },
    { kind: "area", statement: "Client A prefers the river district", source_ref: sourceRef, observed_at: "2026-06-13T10:00:00Z", confidence: 0.8 },
  ];
}

test("human-reviewed preference proposal → generic L3 facts with provenance", async () => {
  const ws = await freshWorkspace(FULL_GRANT);
  const sourceRef = await seedClientNote(ws);

  // Broker builds the proposal; the human reviews it (written to a tmp file OUTSIDE the workspace).
  const proposal = buildPreferenceProposal(synthPreferences(sourceRef));
  const proposalPath = join(tmpdir(), `broker-proposal-${Date.now()}.json`);
  await writeFile(proposalPath, JSON.stringify(proposal));
  tmpDirs.push(proposalPath);

  const accepted = await acceptPreferenceFacts(ws, proposalPath);
  assert.equal(accepted.exitCode, 0, accepted.stderr);
  assert.equal(accepted.written, 3, "exactly three facts written");

  const facts = await listFacts(ws);
  assert.equal(facts.exitCode, 0, facts.stderr);
  assert.match(facts.stdout, /target budget is around 2000/);
  assert.match(facts.stdout, /at least 2 bedrooms/);
});

test("a malformed proposal writes ZERO facts and leaves the vault byte-unchanged", async () => {
  const ws = await freshWorkspace(FULL_GRANT);
  await seedClientNote(ws);
  const before = await snapshot(ws);

  // Garbled: wrong workflow + a non-ULID source_ref. Whole-file validation must reject it.
  const badPath = join(tmpdir(), `broker-bad-${Date.now()}.json`);
  await writeFile(
    badPath,
    JSON.stringify({
      workflow: "extract_facts",
      version: 1,
      proposed_at: "2026-06-13T10:00:00Z",
      items: [{ statement: "x", source_ref: "not-a-ulid", observed_at: "2026-06-13T10:00:00Z", confidence: 0.5 }],
    }),
  );
  tmpDirs.push(badPath);

  const accepted = await acceptPreferenceFacts(ws, badPath);
  assert.notEqual(accepted.exitCode, 0, "malformed proposal must fail");

  const after = await snapshot(ws);
  assert.deepEqual([...after.keys()].sort(), [...before.keys()].sort(), "no file created or deleted");
  for (const [path, bytes] of before) assert.equal(after.get(path), bytes, `byte change in ${path}`);
});

test("WITHOUT write:facts, accept is scope_denied with ZERO writes", async () => {
  const ws = await freshWorkspace(["read:notes", "read:facts", "read:index", "write:capture", "write:notes"]);
  const sourceRef = await seedClientNote(ws);
  const proposal = buildPreferenceProposal(synthPreferences(sourceRef));
  const proposalPath = join(tmpdir(), `broker-denied-${Date.now()}.json`);
  await writeFile(proposalPath, JSON.stringify(proposal));
  tmpDirs.push(proposalPath);
  const before = await snapshot(ws);

  const accepted = await acceptPreferenceFacts(ws, proposalPath);
  assert.equal(accepted.exitCode, 1);
  assert.match(accepted.stderr, /scope_denied/);
  assert.match(accepted.stderr, /domain-app:broker/);

  const after = await snapshot(ws);
  assert.deepEqual([...after.keys()].sort(), [...before.keys()].sort(), "no file created or deleted");
  for (const [path, bytes] of before) assert.equal(after.get(path), bytes, `byte change in ${path}`);
});

test("read:index is granted (SB-093 match prerequisite) via the real enforcer — denied without it", async () => {
  const wsFull = await freshWorkspace(FULL_GRANT);
  const cfgFull = await loadGrantConfig(wsFull);
  assert.doesNotThrow(() => enforceScope("domain-app:broker", "queryMemory", cfgFull), "read:index granted");

  const wsNoIndex = await freshWorkspace(["read:notes", "read:facts", "write:capture", "write:notes", "write:facts"]);
  const cfgNoIndex = await loadGrantConfig(wsNoIndex);
  assert.throws(
    () => enforceScope("domain-app:broker", "queryMemory", cfgNoIndex),
    (e: unknown) => e instanceof ScopeDeniedError,
    "read:index denied when not granted",
  );
});
