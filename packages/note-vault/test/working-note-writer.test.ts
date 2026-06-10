/**
 * Tests for the SB-029 L1 working-note write primitive. Mirrors the distilled
 * writer tests: temp workspaces, real-schema validation via Ajv.
 */
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { parse as parseYaml } from "yaml";
import { WorkingNoteWriteError, writeWorkingNote } from "../src/index.js";
import type { WriteWorkingNoteInput } from "../src/index.js";

const require = createRequire(import.meta.url);

interface AjvLike {
  compile(schema: unknown): ((data: unknown) => boolean) & { errors?: unknown };
}
type AjvCtor = new (opts?: Record<string, unknown>) => AjvLike;

const ajvMod = require("ajv/dist/2020.js") as { default?: AjvCtor } & AjvCtor;
const Ajv2020: AjvCtor = ajvMod.default ?? ajvMod;
const afMod = require("ajv-formats") as { default?: (ajv: AjvLike) => void } & ((ajv: AjvLike) => void);
const addFormats: (ajv: AjvLike) => void = afMod.default ?? afMod;

const ID = "01KT6C7GH0PM1K6XQH3K6ZG8BT";
const SOURCE_REF = "01KT6C7GH0PM1K6XQH3K6ZG8CD";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SCHEMA_PATH = join(REPO_ROOT, "schemas", "markdown", "frontmatter.schema.json");

const tmpDirs: string[] = [];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "sb-working-"));
  tmpDirs.push(dir);
  return dir;
}

function baseInput(workspace: string): WriteWorkingNoteInput {
  return {
    workspace,
    id: ID,
    source_ref: SOURCE_REF,
    title: "Raw material to organize",
    body: "Editable working copy of the raw capture.",
    createdAt: "2026-06-10T10:00:00Z",
  };
}

function frontmatterOf(fileText: string): Record<string, unknown> {
  const m = fileText.match(/^---\n([\s\S]*?)\n---/);
  const block = m?.[1];
  assert.ok(block !== undefined, "file should start with a frontmatter block");
  return parseYaml(block) as Record<string, unknown>;
}

after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

test("writes a schema-valid L1 working note under vault/00_Inbox", async () => {
  const ws = await makeWorkspace();
  const result = await writeWorkingNote(baseInput(ws));

  const expectedPath = join(ws, "vault", "00_Inbox", `${ID}.md`);
  assert.equal(result.path, expectedPath);
  const text = await readFile(expectedPath, "utf8");
  const fm = frontmatterOf(text);
  assert.equal(fm["type"], "working");
  assert.equal(fm["layer"], 1);
  assert.equal(fm["source_ref"], SOURCE_REF);

  const schema = JSON.parse(await readFile(SCHEMA_PATH, "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  assert.equal(validate(fm), true, JSON.stringify(validate.errors));
});

test("title is optional (schema only requires source_ref for working)", async () => {
  const ws = await makeWorkspace();
  const input = baseInput(ws);
  delete (input as { title?: string }).title;
  await writeWorkingNote(input);
  const text = await readFile(join(ws, "vault", "00_Inbox", `${ID}.md`), "utf8");
  assert.ok(!("title" in frontmatterOf(text)));
});

test("missing or invalid source_ref rejected and nothing written", async () => {
  const ws = await makeWorkspace();
  await assert.rejects(
    writeWorkingNote({ ...baseInput(ws), source_ref: "" }),
    (e: unknown) => e instanceof WorkingNoteWriteError && e.code === "missing_source_ref",
  );
  await assert.rejects(
    writeWorkingNote({ ...baseInput(ws), source_ref: "not-a-ulid" }),
    (e: unknown) => e instanceof WorkingNoteWriteError && e.code === "invalid_ulid",
  );
  assert.equal(existsSync(join(ws, "vault", "00_Inbox", `${ID}.md`)), false);
});

test("refuses a target under 00_Raw and a workspace escape", async () => {
  const ws = await makeWorkspace();
  await assert.rejects(
    writeWorkingNote({ ...baseInput(ws), dirRelative: join("vault", "00_Raw") }),
    (e: unknown) => e instanceof WorkingNoteWriteError && e.code === "unsafe_path",
  );
  await assert.rejects(
    writeWorkingNote({ ...baseInput(ws), dirRelative: join("..", "outside") }),
    (e: unknown) => e instanceof WorkingNoteWriteError && e.code === "unsafe_path",
  );
});

test("never overwrites an existing id", async () => {
  const ws = await makeWorkspace();
  await writeWorkingNote(baseInput(ws));
  const before = await readFile(join(ws, "vault", "00_Inbox", `${ID}.md`), "utf8");
  await assert.rejects(
    writeWorkingNote({ ...baseInput(ws), body: "different body" }),
    (e: unknown) => e instanceof WorkingNoteWriteError && e.code === "already_exists",
  );
  assert.equal(await readFile(join(ws, "vault", "00_Inbox", `${ID}.md`), "utf8"), before);
});
