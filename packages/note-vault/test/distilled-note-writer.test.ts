/**
 * Tests for the SB-024 L2 distilled-note write primitive. Uses Node's built-in
 * test runner + assert (no heavy framework). All writes go to a fresh temp dir.
 * Frontmatter is validated against the real schema (Ajv 2020 + ajv-formats).
 */
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { parse as parseYaml } from "yaml";
import { DistilledNoteWriteError, writeDistilledNote } from "../src/index.js";

// ajv + ajv-formats ship as CJS with awkward ESM-default interop under NodeNext;
// load them via createRequire so the test type-checks without interop gymnastics.
const require = createRequire(import.meta.url);

interface AjvLike {
  compile(schema: unknown): ((data: unknown) => boolean) & { errors?: unknown };
}
type AjvCtor = new (opts?: Record<string, unknown>) => AjvLike;

const ajvMod = require("ajv/dist/2020.js") as { default?: AjvCtor } & AjvCtor;
const Ajv2020: AjvCtor = ajvMod.default ?? ajvMod;
const afMod = require("ajv-formats") as { default?: (ajv: AjvLike) => void } & ((ajv: AjvLike) => void);
const addFormats: (ajv: AjvLike) => void = afMod.default ?? afMod;
import type { WriteDistilledNoteInput } from "../src/index.js";

const ID = "01KT6C7GH0PM1K6XQH3K6ZG8BT";
const SOURCE_REF = "01KT6C7GH0PM1K6XQH3K6ZG8CD";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SCHEMA_PATH = join(REPO_ROOT, "schemas", "markdown", "frontmatter.schema.json");

const tmpDirs: string[] = [];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "sb-distilled-"));
  tmpDirs.push(dir);
  return dir;
}

function baseInput(workspace: string): WriteDistilledNoteInput {
  return {
    workspace,
    id: ID,
    title: "Pre-LN beats post-LN for deep transformers",
    body: "Key insight distilled from working notes.\nWith a line: containing a colon.",
    source_ref: SOURCE_REF,
    createdAt: "2026-06-05T10:00:00Z",
  };
}

/** Extract the YAML frontmatter block (between the first two `---` fences). */
function frontmatterOf(fileText: string): Record<string, unknown> {
  const m = fileText.match(/^---\n([\s\S]*?)\n---/);
  const block = m?.[1];
  assert.ok(block !== undefined, "file should start with a frontmatter block");
  return parseYaml(block) as Record<string, unknown>;
}

async function loadValidator(): Promise<((data: unknown) => boolean) & { errors?: unknown }> {
  const schema = JSON.parse(await readFile(SCHEMA_PATH, "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(schema);
}

after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

test("writes a valid L2 distilled note under vault/80_Wiki", async () => {
  const ws = await makeWorkspace();
  const result = await writeDistilledNote(baseInput(ws));

  const expectedPath = join(ws, "vault", "80_Wiki", `${ID}.md`);
  assert.equal(result.path, expectedPath);
  assert.equal(result.id, ID);
  assert.equal(result.created, "2026-06-05T10:00:00Z");
  assert.ok((await stat(expectedPath)).isFile(), "file should exist");

  const text = await readFile(expectedPath, "utf8");
  const fm = frontmatterOf(text);
  assert.equal(fm.id, ID);
  assert.equal(fm.type, "distilled");
  assert.equal(fm.layer, 2);
  assert.equal(fm.source_ref, SOURCE_REF);
  assert.equal(fm.title, "Pre-LN beats post-LN for deep transformers");
  // body is preserved verbatim after the frontmatter + blank line.
  assert.ok(text.endsWith("Key insight distilled from working notes.\nWith a line: containing a colon."));

  const validate = await loadValidator();
  const ok = validate(fm);
  assert.ok(ok, `frontmatter must validate against schema v1: ${JSON.stringify(validate.errors)}`);
});

test("writes the slug filename and tags when provided", async () => {
  const ws = await makeWorkspace();
  const result = await writeDistilledNote({ ...baseInput(ws), slug: "pre-ln", tags: ["ml", "transformers"] });
  assert.equal(result.path, join(ws, "vault", "80_Wiki", `${ID}--pre-ln.md`));

  const fm = frontmatterOf(await readFile(result.path, "utf8"));
  assert.deepEqual(fm.tags, ["ml", "transformers"]);
  const validate = await loadValidator();
  assert.ok(validate(fm), `tagged note must validate: ${JSON.stringify(validate.errors)}`);
});

test("refuses a target under 00_Raw (immutable L0)", async () => {
  const ws = await makeWorkspace();
  await assert.rejects(
    () => writeDistilledNote({ ...baseInput(ws), dirRelative: "vault/00_Raw" }),
    (err: unknown) => err instanceof DistilledNoteWriteError && err.code === "unsafe_path",
  );
  // nothing was written under the raw area
  assert.equal(existsSync(join(ws, "vault", "00_Raw", `${ID}.md`)), false);
});

test("refuses a target directory that escapes the workspace", async () => {
  const ws = await makeWorkspace();
  await assert.rejects(
    () => writeDistilledNote({ ...baseInput(ws), dirRelative: "../escape" }),
    (err: unknown) => err instanceof DistilledNoteWriteError && err.code === "unsafe_path",
  );
});

test("rejects a missing/empty title", async () => {
  const ws = await makeWorkspace();
  await assert.rejects(
    () => writeDistilledNote({ ...baseInput(ws), title: "   " }),
    (err: unknown) => err instanceof DistilledNoteWriteError && err.code === "missing_title",
  );
});

test("rejects a missing source_ref", async () => {
  const ws = await makeWorkspace();
  await assert.rejects(
    () => writeDistilledNote({ ...baseInput(ws), source_ref: "" }),
    (err: unknown) => err instanceof DistilledNoteWriteError && err.code === "missing_source_ref",
  );
});

test("rejects a non-ULID id and a non-ULID source_ref", async () => {
  const ws = await makeWorkspace();
  await assert.rejects(
    () => writeDistilledNote({ ...baseInput(ws), id: "not-a-ulid" }),
    (err: unknown) => err instanceof DistilledNoteWriteError && err.code === "invalid_ulid",
  );
  await assert.rejects(
    () => writeDistilledNote({ ...baseInput(ws), source_ref: "not-a-ulid" }),
    (err: unknown) => err instanceof DistilledNoteWriteError && err.code === "invalid_ulid",
  );
});

test("never overwrites an existing distilled note id", async () => {
  const ws = await makeWorkspace();
  await writeDistilledNote(baseInput(ws));
  await assert.rejects(
    () => writeDistilledNote({ ...baseInput(ws), body: "different body" }),
    (err: unknown) => err instanceof DistilledNoteWriteError && err.code === "already_exists",
  );
});

test("never reads or mutates the L1 source note it references", async () => {
  const ws = await makeWorkspace();
  // Seed an L1 working note that the distillation derives from.
  const workingDir = join(ws, "vault", "10_Projects");
  await mkdir(workingDir, { recursive: true });
  const workingPath = join(workingDir, `${SOURCE_REF}.md`);
  const workingBytes = `---\nid: ${SOURCE_REF}\ntype: working\nlayer: 1\nsource_ref: ${ID}\ncreated: "2026-06-04T08:00:00Z"\n---\n\nOriginal working note body.`;
  await writeFile(workingPath, workingBytes, "utf8");
  const before = await readFile(workingPath);

  await writeDistilledNote(baseInput(ws));

  const after = await readFile(workingPath);
  assert.ok(before.equals(after), "the L1 source file must be byte-identical after distillation");
});

test("SB-028: links record secondary sources and validate against the schema", async () => {
  const ws = await makeWorkspace();
  const second = "01KT6C7GH0PM1K6XQH3K6ZG8EF";
  const third = "01KT6C7GH0PM1K6XQH3K6ZG8FG";
  await writeDistilledNote({ ...baseInput(ws), links: [second, third, second] });

  const text = await readFile(join(ws, "vault", "80_Wiki", `${ID}.md`), "utf8");
  const fm = frontmatterOf(text);
  assert.equal(fm["source_ref"], SOURCE_REF);
  assert.deepEqual(fm["links"], [second, third]); // deduped, order kept

  const validate = await loadValidator();
  assert.equal(validate(fm), true, JSON.stringify(validate.errors));
});

test("SB-028: omitted/empty links emit no links key", async () => {
  const ws = await makeWorkspace();
  await writeDistilledNote({ ...baseInput(ws), links: [] });
  const text = await readFile(join(ws, "vault", "80_Wiki", `${ID}.md`), "utf8");
  assert.ok(!("links" in frontmatterOf(text)));
});

test("SB-028: invalid links rejected and nothing written", async () => {
  const ws = await makeWorkspace();
  await assert.rejects(
    writeDistilledNote({ ...baseInput(ws), links: ["ok", ""] }),
    (e: unknown) => e instanceof DistilledNoteWriteError && e.code === "invalid_links",
  );
  assert.equal(existsSync(join(ws, "vault", "80_Wiki", `${ID}.md`)), false);
});
