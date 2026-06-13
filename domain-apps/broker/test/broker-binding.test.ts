/**
 * SB-089 — the broker read-only BINDING smoke test:
 *  (a) with the CHECKED-IN broker sample grant config, reads (note list/get,
 *      fact list) succeed under `domain-app:broker` through the enforced
 *      dispatch — proving the sample is the real binding;
 *  (b) under a strict read-only `[read:notes, read:facts]` workspace config,
 *      EVERY write command form (plus every ungranted read) is scope_denied
 *      and the workspace stays byte-identical (zero filesystem writes);
 *  (c) ADR-001: a domain-term grep of packages/ + schemas/ sources stays
 *      clean — the broker app adds no domain vocabulary to the core.
 *
 * Synthetic data only (OQ #45): fictional clients, placeholder areas/budgets,
 * sentinel contact handles. No real names, numbers, addresses, or contacts.
 */
import { existsSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { main } from "@sb/cli";
import { BROKER_CALLER, getNote, invokeAs, listFacts, listNotes } from "../src/index.js";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const tmpDirs: string[] = [];

after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

function cliIo(): { io: { out: (t: string) => void; err: (t: string) => void }; text: () => string } {
  let buf = "";
  return { io: { out: (t: string) => void (buf += t), err: (t: string) => void (buf += t) }, text: () => buf };
}

/** Write a workspace `config/grants.json` granting the broker exactly `allow`. */
async function writeBrokerGrant(ws: string, allow: string[]): Promise<void> {
  await mkdir(join(ws, "config"), { recursive: true });
  await writeFile(
    join(ws, "config", "grants.json"),
    JSON.stringify({ version: 1, grants: [{ app: "domain-app:broker", allow }] }, null, 2),
  );
}

/** Populate a throwaway workspace AS THE HUMAN (cli): 2 synthetic notes + 1 fact. */
async function makePopulatedWorkspace(): Promise<{ ws: string; noteIds: string[] }> {
  const ws = await mkdtemp(join(tmpdir(), "sb-broker-binding-"));
  tmpDirs.push(ws);
  const noteIds: string[] = [];
  for (const content of [
    "Client A wants a 2-bedroom near the river district, budget around 2000/month, move-in next quarter",
    "Client B prefers a studio close to the metro, quiet building",
  ]) {
    const c = cliIo();
    assert.equal(
      await main(["capture", "--content", content, "--source", "import", "--workspace", ws], c.io),
      0,
      c.text(),
    );
    noteIds.push((JSON.parse(c.text()) as { note_id: string }).note_id);
  }
  const c = cliIo();
  assert.equal(
    await main(
      [
        "fact", "add",
        "--statement", "Client A target budget is around 2000/month",
        "--source-ref", noteIds[0] as string,
        "--confidence", "0.9",
        "--workspace", ws,
      ],
      c.io,
    ),
    0,
    c.text(),
  );
  return { ws, noteIds };
}

/** Map of every file in the workspace → base64 bytes (binary-safe snapshot). */
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

test("(a) reads succeed under domain-app:broker via the CHECKED-IN sample grant", async () => {
  const { ws, noteIds } = await makePopulatedWorkspace();
  // Copy the real checked-in sample — proves the sample is the binding.
  await mkdir(join(ws, "config"), { recursive: true });
  await copyFile(
    join(REPO_ROOT, "examples", "grants", "broker.sample.json"),
    join(ws, "config", "grants.json"),
  );

  const list = await listNotes(ws);
  assert.equal(list.exitCode, 0, list.stderr);
  for (const id of noteIds) assert.ok(list.stdout.includes(id), `note ${id} listed`);

  const note = await getNote(ws, noteIds[0] as string);
  assert.equal(note.exitCode, 0, note.stderr);
  assert.ok(note.stdout.includes("river district"));

  const facts = await listFacts(ws);
  assert.equal(facts.exitCode, 0, facts.stderr);
  assert.match(facts.stdout, /target budget is around 2000/);
});

test("(b) under a read-only grant, every write form + ungranted read is scope_denied, ZERO writes", async () => {
  const { ws, noteIds } = await makePopulatedWorkspace();
  const rawId = noteIds[0] as string;
  // Strict read-only binding (inline so this story's denial sweep never breaks
  // as later stories widen the checked-in sample).
  await writeBrokerGrant(ws, ["read:notes", "read:facts"]);
  const before = await snapshot(ws);

  const deniedForms: string[][] = [
    ["capture", "--content", "nope", "--source", "import", "--workspace", ws],
    ["note", "promote", rawId, "--workspace", ws],
    ["distill", "accept", "--file", join(ws, "no-such-proposal.json"), "--workspace", ws],
    ["fact", "add", "--statement", "x", "--source-ref", rawId, "--workspace", ws],
    ["fact", "accept", "--file", join(ws, "no-such-proposal.json"), "--workspace", ws],
    ["output", "create", "--file", join(ws, "no-such-proposal.json"), "--workspace", ws],
    ["secref", "add", "--kind", "k", "--locator", "external://x", "--workspace", ws],
    ["rebuild", "--workspace", ws],
    ["index", "--workspace", ws],
    ["query", "anything", "--workspace", ws], // read:index — not in the read-only grant
  ];

  for (const argv of deniedForms) {
    const result = await invokeAs(argv);
    assert.equal(result.exitCode, 1, `${argv.join(" ")} must fail`);
    assert.match(result.stderr, /scope_denied/, `${argv.join(" ")} must be scope_denied`);
    assert.ok(result.stderr.includes(BROKER_CALLER), "denial names the caller (audit-friendly)");
  }

  // `distill propose` is contractually a READ (read:notes, readOnly) — allowed;
  // the snapshot below proves it writes nothing.
  const propose = await invokeAs(["distill", "propose", "--workspace", ws]);
  assert.equal(propose.exitCode, 0, propose.stderr);

  const afterSweep = await snapshot(ws);
  assert.deepEqual([...afterSweep.keys()].sort(), [...before.keys()].sort(), "no file created or deleted");
  for (const [path, bytes] of before) {
    assert.equal(afterSweep.get(path), bytes, `byte change in ${path}`);
  }
});

test("(c) ADR-001: no broker/domain vocabulary enters the core (packages/ + schemas/ grep clean)", async () => {
  const DOMAIN_TERMS = /broker|landlord|commission|rental/i;
  const GUARD_LINE = /no broker|never broker|domain-neutral/i;
  const offenders: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "test" || entry.isSymbolicLink()) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(path);
      } else if (/\.(ts|json|sql)$/.test(entry.name)) {
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
