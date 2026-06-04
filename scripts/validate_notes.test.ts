/**
 * Tests for the SB-016 read-only frontmatter validator. Builds temp workspaces
 * with hand-written notes (valid + invalid) and asserts the report/exit codes.
 * Node's built-in test runner; temp workspaces only. Lives next to the script
 * (scripts has no package; run via `pnpm test:scripts`).
 */
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { main, validateWorkspaceNotes } from "./validate_notes.js";

const RAW_ID = "01KT6C7GH0PM1K6XQH3K6ZG8BT";
const OUT_ID = "01KT6KRMJGFHB0TJRSQJ10ZZXT";
const SRC_ID = "01KT6E3SHCZ18TAVPNAET9MVM0";

const VALID_RAW = `---
id: ${RAW_ID}
type: raw
layer: 0
created: "2026-06-03T09:15:00Z"
---
hello body
`;

const VALID_OUTPUT = `---
id: ${OUT_ID}
type: output
layer: 5
title: "Brief"
created: "2026-06-03T12:00:00Z"
sources:
  - ${SRC_ID}
---
generated body
`;

const MISSING_FM = `no frontmatter here, just text\n`;

const INVALID_YAML = `---
id: "unterminated
type: raw
---
body
`;

const INVALID_ULID = `---
id: not-a-ulid
type: raw
layer: 0
created: "2026-06-03T09:15:00Z"
---
body
`;

const WRONG_LAYER = `---
id: ${SRC_ID}
type: distilled
layer: 1
title: "X"
created: "2026-06-03T10:10:00Z"
---
body
`;

const RAW_WITH_UPDATED = `---
id: ${RAW_ID}
type: raw
layer: 0
created: "2026-06-03T09:15:00Z"
updated: "2026-06-03T10:00:00Z"
---
body
`;

const tmpDirs: string[] = [];

async function makeWorkspace(notes: Record<string, string>): Promise<string> {
  const ws = await mkdtemp(join(tmpdir(), "sb-validate-"));
  tmpDirs.push(ws);
  const rawDir = join(ws, "vault", "00_Raw");
  await mkdir(rawDir, { recursive: true });
  for (const [name, content] of Object.entries(notes)) {
    await writeFile(join(rawDir, name), content, "utf8");
  }
  return ws;
}

after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

test("valid raw note passes", async () => {
  const ws = await makeWorkspace({ "a.md": VALID_RAW });
  const report = await validateWorkspaceNotes({ workspace: ws });
  assert.equal(report.checked, 1);
  assert.equal(report.invalid, 0);
});

test("valid output note with required sources passes", async () => {
  const ws = await makeWorkspace({ "out.md": VALID_OUTPUT });
  const report = await validateWorkspaceNotes({ workspace: ws });
  assert.equal(report.invalid, 0);
});

test("missing frontmatter fails", async () => {
  const ws = await makeWorkspace({ "x.md": MISSING_FM });
  const report = await validateWorkspaceNotes({ workspace: ws });
  assert.equal(report.invalid, 1);
  assert.match(report.results[0]!.errors[0]!, /missing frontmatter/);
});

test("invalid YAML frontmatter fails", async () => {
  const ws = await makeWorkspace({ "x.md": INVALID_YAML });
  const report = await validateWorkspaceNotes({ workspace: ws });
  assert.equal(report.invalid, 1);
  assert.match(report.results[0]!.errors[0]!, /YAML parse error/);
});

test("invalid ULID fails", async () => {
  const ws = await makeWorkspace({ "x.md": INVALID_ULID });
  const report = await validateWorkspaceNotes({ workspace: ws });
  assert.equal(report.invalid, 1);
});

test("wrong layer for note type fails", async () => {
  const ws = await makeWorkspace({ "x.md": WRONG_LAYER });
  const report = await validateWorkspaceNotes({ workspace: ws });
  assert.equal(report.invalid, 1);
});

test("raw note with `updated` fails (schema forbids it)", async () => {
  const ws = await makeWorkspace({ "x.md": RAW_WITH_UPDATED });
  const report = await validateWorkspaceNotes({ workspace: ws });
  assert.equal(report.invalid, 1);
});

test("multiple files produce a summary with correct counts", async () => {
  const ws = await makeWorkspace({ "ok1.md": VALID_RAW, "ok2.md": VALID_OUTPUT, "bad.md": INVALID_ULID });
  const report = await validateWorkspaceNotes({ workspace: ws });
  assert.equal(report.checked, 3);
  assert.equal(report.valid, 2);
  assert.equal(report.invalid, 1);

  let stdout = "";
  const code = await main(["--workspace", ws], { out: (t) => (stdout += t), err: () => {} });
  assert.equal(code, 1);
  assert.match(stdout, /3 checked, 2 valid, 1 invalid/);
});

test("validator is read-only: file contents unchanged after validation", async () => {
  const ws = await makeWorkspace({ "a.md": VALID_RAW, "bad.md": INVALID_ULID });
  const rawDir = join(ws, "vault", "00_Raw");
  const before = await readFile(join(rawDir, "a.md"));
  const namesBefore = (await readdir(rawDir)).sort();

  await validateWorkspaceNotes({ workspace: ws });

  assert.deepEqual(await readFile(join(rawDir, "a.md")), before, "note bytes must be unchanged");
  assert.deepEqual((await readdir(rawDir)).sort(), namesBefore, "no files added/removed");
});

test("unsafe (relative) workspace path is rejected with exit 2", async () => {
  let stderr = "";
  const code = await main(["--workspace", "relative/workspace"], { out: () => {}, err: (t) => (stderr += t) });
  assert.equal(code, 2);
  assert.match(stderr, /unsafe_workspace/);
});

test("a clean valid workspace exits 0", async () => {
  const ws = await makeWorkspace({ "a.md": VALID_RAW, "out.md": VALID_OUTPUT });
  const code = await main(["--workspace", ws], { out: () => {}, err: () => {} });
  assert.equal(code, 0);
});

test("--help prints usage and exits 0", async () => {
  let stdout = "";
  const code = await main(["--help"], { out: (t) => (stdout += t), err: () => {} });
  assert.equal(code, 0);
  assert.match(stdout, /read-only frontmatter validation/);
});
