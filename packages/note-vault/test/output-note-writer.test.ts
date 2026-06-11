/**
 * Tests for the SB-058 L5 output-note write primitive. Mirrors the working
 * writer tests: temp workspaces, real-schema validation via Ajv. L5 outputs
 * MUST cite sources — the writer refuses empty/missing sources before any IO.
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
import { OutputNoteWriteError, writeOutputNote } from "../src/index.js";
import type { WriteOutputNoteInput } from "../src/index.js";

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
const SOURCE_A = "01KT6C7GH0PM1K6XQH3K6ZG8CD";
const SOURCE_B = "01KT6C7GH0PM1K6XQH3K6ZG8CE";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SCHEMA_PATH = join(REPO_ROOT, "schemas", "markdown", "frontmatter.schema.json");

const tmpDirs: string[] = [];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "sb-output-"));
  tmpDirs.push(dir);
  return dir;
}

function baseInput(workspace: string): WriteOutputNoteInput {
  return {
    workspace,
    id: ID,
    title: "Espresso maintenance summary",
    sources: [SOURCE_A, SOURCE_B],
    body: "## Summary\n\nDescale takes 30 minutes.",
    createdAt: "2026-06-10T12:00:00Z",
  };
}

after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

function frontmatterBlockOf(text: string): Record<string, unknown> {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(match, "note must start with a frontmatter block");
  return parseYaml(match![1] as string) as Record<string, unknown>;
}

test("writes a schema-valid L5 output note under vault/60_Outputs citing its sources", async () => {
  const ws = await makeWorkspace();
  const result = await writeOutputNote(baseInput(ws));

  assert.equal(result.id, ID);
  assert.ok(result.path.includes(join("vault", "60_Outputs")));

  const text = await readFile(result.path, "utf8");
  assert.equal(result.bytesWritten, Buffer.byteLength(text, "utf8"));
  const fm = frontmatterBlockOf(text);
  assert.equal(fm["type"], "output");
  assert.equal(fm["layer"], 5);
  assert.deepEqual(fm["sources"], [SOURCE_A, SOURCE_B]);
  assert.match(text, /Descale takes 30 minutes\./);

  // the written frontmatter validates against schema v1 (output branch)
  const schema = JSON.parse(await readFile(SCHEMA_PATH, "utf8")) as unknown;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  assert.equal(validate(fm), true, JSON.stringify(validate.errors));
});

test("missing/empty title or sources is rejected writing nothing", async () => {
  const ws = await makeWorkspace();
  const bad: Array<[Partial<WriteOutputNoteInput>, string]> = [
    [{ title: "  " }, "invalid_title"],
    [{ sources: [] }, "missing_sources"],
    [{ sources: ["", SOURCE_A] }, "missing_sources"],
    [{ sources: undefined as unknown as string[] }, "missing_sources"],
  ];
  for (const [patch, code] of bad) {
    await assert.rejects(
      writeOutputNote({ ...baseInput(ws), ...patch }),
      (e: unknown) => e instanceof OutputNoteWriteError && e.code === code,
    );
  }
  assert.equal(existsSync(join(ws, "vault")), false, "nothing written for invalid inputs");
});

test("never overwrites an existing output note (exclusive create)", async () => {
  const ws = await makeWorkspace();
  const first = await writeOutputNote(baseInput(ws));
  const before = await readFile(first.path, "utf8");
  await assert.rejects(
    writeOutputNote({ ...baseInput(ws), title: "Different title" }),
    (e: unknown) => e instanceof OutputNoteWriteError && e.code === "already_exists",
  );
  assert.equal(await readFile(first.path, "utf8"), before, "existing note byte-unchanged");
});

test("refuses 00_Raw targets and workspace escapes", async () => {
  const ws = await makeWorkspace();
  for (const dirRelative of [join("vault", "00_Raw"), join("..", "outside")]) {
    await assert.rejects(
      writeOutputNote({ ...baseInput(ws), dirRelative }),
      (e: unknown) => e instanceof OutputNoteWriteError && e.code === "unsafe_path",
    );
  }
  await assert.rejects(
    writeOutputNote({ ...baseInput(ws), id: "not-a-ulid" }),
    (e: unknown) => e instanceof OutputNoteWriteError && e.code === "invalid_ulid",
  );
  assert.equal(existsSync(join(ws, "vault")), false);
});

test("optional slug and tags are honored", async () => {
  const ws = await makeWorkspace();
  const result = await writeOutputNote({ ...baseInput(ws), slug: "summary", tags: ["maintenance"] });
  assert.ok(result.path.endsWith(`${ID}--summary.md`));
  const fm = frontmatterBlockOf(await readFile(result.path, "utf8"));
  assert.deepEqual(fm["tags"], ["maintenance"]);
});
