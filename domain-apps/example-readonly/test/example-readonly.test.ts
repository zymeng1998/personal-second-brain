/**
 * SB-061 — the example-readonly smoke test:
 *  (a) with the CHECKED-IN sample grant config, reads (note list/get, fact
 *      list) succeed under the app's own identity through the enforced
 *      dispatch;
 *  (b) EVERY write command form (plus every ungranted read) is scope_denied
 *      and the workspace stays byte-identical (zero filesystem writes);
 *  (c) ADR-001: a domain-term grep of packages/ + schemas/ sources stays
 *      clean — this app adds no domain vocabulary to the core.
 */
import { existsSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { main } from "@sb/cli";
import { EXAMPLE_READONLY_CALLER, getNote, invokeAs, listFacts, listNotes } from "../src/index.js";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const tmpDirs: string[] = [];

after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

function cliIo(): { io: { out: (t: string) => void; err: (t: string) => void }; text: () => string } {
  let buf = "";
  return { io: { out: (t: string) => void (buf += t), err: (t: string) => void (buf += t) }, text: () => buf };
}

/** Populate a throwaway workspace AS THE HUMAN (cli): 2 notes + 1 fact. */
async function makePopulatedWorkspace(): Promise<{ ws: string; noteIds: string[] }> {
  const ws = await mkdtemp(join(tmpdir(), "sb-example-readonly-"));
  tmpDirs.push(ws);
  const noteIds: string[] = [];
  for (const content of ["espresso ratio observations", "garden irrigation schedule"]) {
    const c = cliIo();
    assert.equal(
      await main(["capture", "--content", content, "--source", "paste", "--workspace", ws], c.io),
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
        "--statement", "the 1:2 espresso ratio works best",
        "--source-ref", noteIds[0] as string,
        "--confidence", "0.9",
        "--workspace", ws,
      ],
      c.io,
    ),
    0,
    c.text(),
  );
  // grant the app via the CHECKED-IN sample config (proves the sample is the real binding)
  await mkdir(join(ws, "config"), { recursive: true });
  await copyFile(
    join(REPO_ROOT, "examples", "grants", "grants.sample.json"),
    join(ws, "config", "grants.json"),
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

test("(a) reads succeed under the app's own identity via the sample grant", async () => {
  const { ws, noteIds } = await makePopulatedWorkspace();

  const list = await listNotes(ws);
  assert.equal(list.exitCode, 0, list.stderr);
  for (const id of noteIds) assert.ok(list.stdout.includes(id), `note ${id} listed`);

  const note = await getNote(ws, noteIds[0] as string);
  assert.equal(note.exitCode, 0, note.stderr);
  assert.ok(note.stdout.includes("espresso ratio observations"));

  const facts = await listFacts(ws);
  assert.equal(facts.exitCode, 0, facts.stderr);
  assert.match(facts.stdout, /the 1:2 espresso ratio works best/);
});

test("(b) every write form + every ungranted read is scope_denied with ZERO filesystem writes", async () => {
  const { ws, noteIds } = await makePopulatedWorkspace();
  const rawId = noteIds[0] as string;
  const before = await snapshot(ws);

  const deniedForms: string[][] = [
    // write commands — all 9 write surfaces
    ["capture", "--content", "nope", "--source", "paste", "--workspace", ws],
    ["note", "promote", rawId, "--workspace", ws],
    ["distill", "accept", "--file", join(ws, "no-such-proposal.json"), "--workspace", ws],
    ["fact", "add", "--statement", "x", "--source-ref", rawId, "--workspace", ws],
    ["fact", "accept", "--file", join(ws, "no-such-proposal.json"), "--workspace", ws],
    ["output", "create", "--file", join(ws, "no-such-proposal.json"), "--workspace", ws],
    ["secref", "add", "--kind", "k", "--locator", "external://x", "--workspace", ws],
    ["rebuild", "--workspace", ws],
    ["index", "--workspace", ws],
    // a read the sample grant does NOT include (read:index)
    ["query", "anything", "--workspace", ws],
  ];

  for (const argv of deniedForms) {
    const result = await invokeAs(argv);
    assert.equal(result.exitCode, 1, `${argv.join(" ")} must fail`);
    assert.match(result.stderr, /scope_denied/, `${argv.join(" ")} must be scope_denied`);
    assert.ok(
      result.stderr.includes(EXAMPLE_READONLY_CALLER),
      "denial names the caller (audit-friendly)",
    );
  }

  // `distill propose` is contractually a READ (`scope: read:notes`, readOnly)
  // — the app is correctly allowed; the snapshot below proves it writes nothing.
  const propose = await invokeAs(["distill", "propose", "--workspace", ws]);
  assert.equal(propose.exitCode, 0, propose.stderr);

  const afterSweep = await snapshot(ws);
  assert.deepEqual(
    [...afterSweep.keys()].sort(),
    [...before.keys()].sort(),
    "no file created or deleted",
  );
  for (const [path, bytes] of before) {
    assert.equal(afterSweep.get(path), bytes, `byte change in ${path}`);
  }
});

test("(c) ADR-001: no domain vocabulary enters the core (packages/ + schemas/ grep clean)", async () => {
  // Production sources only: test files carry the guard fixtures (a rejected
  // `source: "broker"`), and guard comments/docs say "no broker/domain
  // fields" — NEGATIVE mentions enforcing the rule. A line only violates the
  // ADR when it uses a domain term outside such a guard.
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
