/**
 * SB-079 — `obsidian-helper check`: correct report on clean + defective
 * fixture vaults; read-only (byte-identical workspace); the helper holds
 * nothing beyond its grant (denial probes through the same dispatch).
 */
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { main as sbMain } from "@sb/cli";
import { main as helperMain } from "../src/index.js";
import { EXPECTED_VAULT_FOLDERS } from "../src/check.js";
import type { CheckReport } from "../src/check.js";
import { invoke } from "../src/invoke.js";

const tmpDirs: string[] = [];
after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

function io(): { io: { out: (t: string) => void; err: (t: string) => void }; all: () => string } {
  let buf = "";
  return { io: { out: (t: string) => void (buf += t), err: (t: string) => void (buf += t) }, all: () => buf };
}

async function makeVaultWorkspace(): Promise<{ ws: string; ids: string[] }> {
  const ws = await mkdtemp(join(tmpdir(), "sb-obsidian-check-"));
  tmpDirs.push(ws);
  for (const folder of EXPECTED_VAULT_FOLDERS) {
    await mkdir(join(ws, "vault", folder), { recursive: true });
  }
  const ids: string[] = [];
  // captured AS THE HUMAN (cli) — fixtures, not surface writes
  for (const [title, content] of [
    ["Espresso Guide", "Dose 18g, yield 36g."],
    ["Brew Log", "Today followed [[Espresso Guide]] and [[Missing Note]]."],
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
  return { ws, ids };
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

async function runCheckCli(ws: string): Promise<{ exitCode: number; report: CheckReport }> {
  const c = io();
  const exitCode = await helperMain(["check", "--workspace", ws], c.io);
  return { exitCode, report: JSON.parse(c.all()) as CheckReport };
}

test("check reports the dangling wikilink and stays read-only; resolvable links pass", async () => {
  const { ws, ids } = await makeVaultWorkspace();
  const before = await snapshot(ws);

  const { exitCode, report } = await runCheckCli(ws);
  assert.equal(exitCode, 1, "findings ⇒ exit 1");
  assert.equal(report.ok, false);
  assert.equal(report.notes, 2);
  assert.deepEqual(report.findings.frontmatter, []);
  assert.deepEqual(report.findings.missing_folders, []);
  assert.deepEqual(report.findings.wikilinks, [{ id: ids[1], target: "Missing Note" }]);

  const afterCheck = await snapshot(ws);
  assert.deepEqual([...afterCheck.keys()].sort(), [...before.keys()].sort());
  for (const [path, bytes] of before) assert.equal(afterCheck.get(path), bytes, path);
});

test("a clean vault passes with exit 0", async () => {
  const { ws } = await makeVaultWorkspace();
  // repair the dangling link by capturing the missing target
  const c = io();
  assert.equal(
    await sbMain(
      ["capture", "--content", "now exists", "--source", "paste", "--title", "Missing Note", "--workspace", ws],
      c.io,
    ),
    0,
  );
  const { exitCode, report } = await runCheckCli(ws);
  assert.equal(exitCode, 0, JSON.stringify(report));
  assert.equal(report.ok, true);
  assert.equal(report.notes, 3);
});

test("seeded defects: broken frontmatter + missing folder are reported", async () => {
  const { ws } = await makeVaultWorkspace();
  // hand-seeded defective note (ULID filename fallback; no frontmatter keys)
  await writeFile(
    join(ws, "vault", "00_Inbox", "01ARZ3NDEKTSV4RRFFQ69G5FAV--bad.md"),
    "---\nid: 01ARZ3NDEKTSV4RRFFQ69G5FAV\ntype: working\n---\nbody without layer/created\n",
    "utf8",
  );
  await rm(join(ws, "vault", "80_Wiki"), { recursive: true });

  const { exitCode, report } = await runCheckCli(ws);
  assert.equal(exitCode, 1);
  assert.deepEqual(report.findings.missing_folders, ["80_Wiki"]);
  assert.equal(report.findings.frontmatter.length, 1);
  assert.equal(report.findings.frontmatter[0]?.id, "01ARZ3NDEKTSV4RRFFQ69G5FAV");
  assert.match(report.findings.frontmatter[0]?.reason ?? "", /missing required key: layer/);
});

test("the helper holds nothing beyond write:capture + read:notes (denial probes)", async () => {
  const { ws, ids } = await makeVaultWorkspace();
  const denied: string[][] = [
    ["fact", "list", "--workspace", ws], // read:facts not granted
    ["note", "promote", ids[0] as string, "--workspace", ws],
    ["rebuild", "--workspace", ws],
    ["secref", "add", "--kind", "k", "--locator", "external://x", "--workspace", ws],
    ["query", "anything", "--workspace", ws],
  ];
  for (const argv of denied) {
    const result = await invoke(argv);
    assert.equal(result.exitCode, 1, argv.join(" "));
    assert.match(result.stderr, /scope_denied/, argv.join(" "));
  }
});
