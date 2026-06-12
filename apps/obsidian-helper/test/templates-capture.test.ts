/**
 * SB-080 — templates install (exclusive create, never overwrite; excluded
 * from note enumeration AND validation) + the draft→capture bridge (one L0
 * note + one capture event through the enforced op; draft byte-untouched).
 */
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { validateWorkspaceNotes } from "../../../scripts/validate_notes.js";
import { main as helperMain } from "../src/index.js";
import { TEMPLATE_FILES, TEMPLATES_RELATIVE_DIR } from "../src/templates.js";
import { splitDraft } from "../src/capture-bridge.js";
import { invoke } from "../src/invoke.js";

const tmpDirs: string[] = [];
after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

function io(): { io: { out: (t: string) => void; err: (t: string) => void }; all: () => string } {
  let buf = "";
  return { io: { out: (t: string) => void (buf += t), err: (t: string) => void (buf += t) }, all: () => buf };
}

async function makeWorkspace(): Promise<string> {
  const ws = await mkdtemp(join(tmpdir(), "sb-obsidian-bridge-"));
  tmpDirs.push(ws);
  return ws;
}

async function captureEventCount(ws: string): Promise<number> {
  const raw = await readFile(join(ws, "events", "capture_events.jsonl"), "utf8").catch(() => "");
  return raw.split("\n").filter((line) => line.trim().length > 0).length;
}

test("templates install: exclusive create, idempotent re-run, never overwrites", async () => {
  const ws = await makeWorkspace();
  const dir = join(ws, TEMPLATES_RELATIVE_DIR);

  let c = io();
  assert.equal(await helperMain(["templates", "install", "--workspace", ws], c.io), 0, c.all());
  let report = JSON.parse(c.all()) as { installed: string[]; skipped: string[] };
  assert.equal(report.installed.length, TEMPLATE_FILES.length);
  assert.deepEqual(report.skipped, []);
  for (const t of TEMPLATE_FILES) {
    const content = await readFile(join(dir, t.name), "utf8");
    assert.equal(content, t.content);
    assert.doesNotMatch(content, /^---\n/, `${t.name}: templates carry no frontmatter`);
    assert.doesNotMatch(content, /broker|landlord|commission|rental/i, `${t.name}: domain-neutral`);
  }

  // second run: everything skipped, bytes identical
  c = io();
  assert.equal(await helperMain(["templates", "install", "--workspace", ws], c.io), 0);
  report = JSON.parse(c.all()) as { installed: string[]; skipped: string[] };
  assert.deepEqual(report.installed, []);
  assert.equal(report.skipped.length, TEMPLATE_FILES.length);

  // a pre-existing customized file is NEVER overwritten
  const custom = "my customized scaffold — do not touch\n";
  await writeFile(join(dir, "working-note.md"), custom, "utf8");
  c = io();
  assert.equal(await helperMain(["templates", "install", "--workspace", ws], c.io), 0);
  assert.equal(await readFile(join(dir, "working-note.md"), "utf8"), custom);
});

test("installed templates are invisible to note enumeration and validation", async () => {
  const ws = await makeWorkspace();
  const c = io();
  assert.equal(
    await invoke(["capture", "--content", "a real note", "--source", "paste", "--workspace", ws]).then((r) => r.exitCode),
    0,
  );
  assert.equal(await helperMain(["templates", "install", "--workspace", ws], c.io), 0);

  // note list (enforced dispatch) sees only the real note
  const list = await invoke(["note", "list", "--workspace", ws]);
  assert.equal(list.exitCode, 0, list.stderr);
  const lines = list.stdout.split("\n").filter((l) => l.trim().length > 0);
  assert.equal(lines.length, 1, `templates must not be listed: ${list.stdout}`);

  // the full validation pass stays green and never even checks the templates
  const report = await validateWorkspaceNotes({ workspace: ws });
  assert.equal(report.invalid, 0, JSON.stringify(report));
  assert.equal(report.checked, 1, "only the real note is validated — templates excluded");
});

test("capture bridge: frontmatter draft → one L0 + one event; draft byte-untouched", async () => {
  const ws = await makeWorkspace();
  const draftDir = await mkdtemp(join(tmpdir(), "sb-drafts-"));
  tmpDirs.push(draftDir);
  const draftPath = join(draftDir, "draft.md");
  const draftContent =
    '---\ntitle: "Morning Pages"\ntags: [journal, morning]\n---\nToday I noticed the espresso tasted brighter.\n';
  await writeFile(draftPath, draftContent, "utf8");

  const eventsBefore = await captureEventCount(ws);
  const c = io();
  assert.equal(await helperMain(["capture", "--file", draftPath, "--workspace", ws], c.io), 0, c.all());
  const result = JSON.parse(c.all()) as { draft: string; capture: { note_id: string } };
  assert.equal(result.draft, draftPath);

  // exactly one capture event appended
  assert.equal(await captureEventCount(ws), eventsBefore + 1);

  // the L0 note carries the body (frontmatter lifted, not duplicated) + the title
  const got = await invoke(["note", "get", result.capture.note_id, "--workspace", ws]);
  assert.equal(got.exitCode, 0, got.stderr);
  assert.ok(got.stdout.includes("Today I noticed the espresso tasted brighter."));
  assert.ok(got.stdout.includes("Morning Pages"));
  assert.ok(!got.stdout.includes("tags: [journal, morning]"), "draft frontmatter not re-embedded in body");

  // the draft file is BYTE-untouched
  assert.equal(await readFile(draftPath, "utf8"), draftContent);
});

test("capture bridge: plain draft (no frontmatter) is captured verbatim; raw immutability holds", async () => {
  const ws = await makeWorkspace();
  const draftDir = await mkdtemp(join(tmpdir(), "sb-drafts-plain-"));
  tmpDirs.push(draftDir);
  const draftPath = join(draftDir, "plain.md");
  const plain = "# Quick thought\n\nNo frontmatter here at all.\n";
  await writeFile(draftPath, plain, "utf8");

  let c = io();
  assert.equal(await helperMain(["capture", "--file", draftPath, "--workspace", ws], c.io), 0, c.all());
  const first = JSON.parse(c.all()) as { capture: { note_id: string } };
  const firstNote = await invoke(["note", "get", first.capture.note_id, "--workspace", ws]);
  assert.ok(firstNote.stdout.includes("No frontmatter here at all."));

  // a second bridge capture leaves the first L0 note byte-identical
  const firstBytes = firstNote.stdout;
  c = io();
  assert.equal(await helperMain(["capture", "--file", draftPath, "--workspace", ws], c.io), 0);
  const again = await invoke(["note", "get", first.capture.note_id, "--workspace", ws]);
  assert.equal(again.stdout, firstBytes);

  // empty draft fails closed, nothing captured
  const emptyPath = join(draftDir, "empty.md");
  await writeFile(emptyPath, "---\ntitle: x\n---\n   \n", "utf8");
  const before = await captureEventCount(ws);
  c = io();
  assert.equal(await helperMain(["capture", "--file", emptyPath, "--workspace", ws], c.io), 1);
  assert.match(c.all(), /empty_draft/);
  assert.equal(await captureEventCount(ws), before);
});

test("splitDraft lifts title/tags inline forms and tolerates fence-less drafts", () => {
  assert.deepEqual(splitDraft("no fence"), { body: "no fence", tags: [] });
  const parts = splitDraft("---\ntitle: 'A'\ntags: x, y\n---\nbody\n");
  assert.equal(parts.title, "A");
  assert.deepEqual(parts.tags, ["x", "y"]);
  assert.equal(parts.body, "body\n");
});
