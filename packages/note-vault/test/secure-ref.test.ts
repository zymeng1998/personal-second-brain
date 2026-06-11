/**
 * Tests for the SB-050 secure_refs pointer primitive. A secure ref is a
 * REFERENCE, never a secret container: frontmatter-only, metadata-capped,
 * schema-valid, never overwritten, and error messages never echo values.
 * (Sentinels below are placeholders, not real secrets.)
 */
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { parse as parseYaml } from "yaml";
import { SecureRefError, listSecureRefs, writeSecureRef } from "../src/index.js";

const require = createRequire(import.meta.url);
interface AjvLike {
  compile(schema: unknown): ((data: unknown) => boolean) & { errors?: unknown };
}
type AjvCtor = new (opts?: Record<string, unknown>) => AjvLike;
const ajvMod = require("ajv/dist/2020.js") as { default?: AjvCtor } & AjvCtor;
const Ajv2020: AjvCtor = ajvMod.default ?? ajvMod;
const afMod = require("ajv-formats") as { default?: (ajv: AjvLike) => void } & ((ajv: AjvLike) => void);
const addFormats: (ajv: AjvLike) => void = afMod.default ?? afMod;

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SCHEMA_PATH = join(REPO_ROOT, "schemas", "markdown", "secure_ref.schema.json");

// placeholder sentinel standing in for sensitive content — NOT a real secret
const LEAK_SENTINEL = "LEAK_SENTINEL_PLACEHOLDER_4242";

const tmpDirs: string[] = [];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "sb-secref-"));
  tmpDirs.push(dir);
  return dir;
}

after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

function baseInput(workspace: string) {
  return {
    workspace,
    id: "secref_2026_0001",
    kind: "identity_document",
    locator: "external://keychain/item-placeholder-001",
    capturedAt: "2026-06-10T12:00:00Z",
    notes: "metadata only",
  };
}

test("writes a frontmatter-only, schema-valid pointer file under secure_refs/", async () => {
  const ws = await makeWorkspace();
  const result = await writeSecureRef(baseInput(ws));
  assert.ok(result.path.includes("secure_refs"));
  assert.ok(!result.path.includes("vault"));

  const text = await readFile(result.path, "utf8");
  // frontmatter ONLY: nothing after the closing fence
  const afterFence = text.split(/\n---\n?/)[1] ?? "";
  assert.equal(afterFence.trim(), "", "pointer files carry no body");

  const fm = parseYaml(text.match(/^---\n([\s\S]*?)\n---/)![1] as string) as Record<string, unknown>;
  const schema = JSON.parse(await readFile(SCHEMA_PATH, "utf8")) as unknown;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  assert.equal(validate(fm), true, JSON.stringify(validate.errors));

  const list = await listSecureRefs(ws);
  assert.equal(list.refs.length, 1);
  assert.equal(list.refs[0]?.id, "secref_2026_0001");
  assert.equal(list.invalid.length, 0);
});

test("a multi-line or oversized field is refused (reference, not a container) and never echoed", async () => {
  const ws = await makeWorkspace();
  const attempts = [
    { ...baseInput(ws), locator: `line1\n${LEAK_SENTINEL}\nline3` },
    { ...baseInput(ws), notes: LEAK_SENTINEL.repeat(40) }, // > 500 chars
    { ...baseInput(ws), kind: `k\n${LEAK_SENTINEL}` },
  ];
  for (const input of attempts) {
    try {
      await writeSecureRef(input);
      assert.fail("expected not_a_container rejection");
    } catch (e) {
      assert.ok(e instanceof SecureRefError && e.code === "not_a_container");
      // the guardrail: error message + details never contain the value
      assert.ok(!e.message.includes(LEAK_SENTINEL), "message must not echo the value");
      assert.ok(!JSON.stringify(e.details ?? {}).includes(LEAK_SENTINEL), "details must not echo the value");
    }
  }
  assert.equal(existsSync(join(ws, "secure_refs")), false, "nothing written for refused inputs");
});

test("invalid id / workspace / timestamp rejected; never overwrites", async () => {
  const ws = await makeWorkspace();
  await assert.rejects(
    writeSecureRef({ ...baseInput(ws), id: "not-a-secref" }),
    (e: unknown) => e instanceof SecureRefError && e.code === "invalid_id",
  );
  await assert.rejects(
    writeSecureRef({ ...baseInput(ws), capturedAt: "yesterday-ish" }),
    (e: unknown) => e instanceof SecureRefError && e.code === "invalid_field",
  );
  await assert.rejects(
    writeSecureRef({ ...baseInput("relative/path"), workspace: "relative/path" }),
    (e: unknown) => e instanceof SecureRefError && e.code === "unsafe_path",
  );

  const first = await writeSecureRef(baseInput(ws));
  const before = await readFile(first.path, "utf8");
  await assert.rejects(
    writeSecureRef({ ...baseInput(ws), kind: "different" }),
    (e: unknown) => e instanceof SecureRefError && e.code === "already_exists",
  );
  assert.equal(await readFile(first.path, "utf8"), before, "existing ref byte-unchanged");
});

test("list reports malformed pointer files without throwing (and skips README.md)", async () => {
  const ws = await makeWorkspace();
  await writeSecureRef(baseInput(ws));
  const dir = join(ws, "secure_refs");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "README.md"), "docs, not a pointer", "utf8");
  await writeFile(join(dir, "secref_bad_body.md"), "---\nid: secref_bad_body\nkind: x\nlocation: external\nlocator: \"l\"\ncaptured_at: \"2026-06-10T12:00:00Z\"\n---\n\nsmuggled body content\n", "utf8");
  await writeFile(join(dir, "secref_no_loc.md"), "---\nid: secref_no_loc\nkind: x\nlocation: external\ncaptured_at: \"2026-06-10T12:00:00Z\"\n---\n", "utf8");
  await writeFile(join(dir, "secref_garbled.md"), "no frontmatter at all", "utf8");

  const list = await listSecureRefs(ws);
  assert.equal(list.refs.length, 1, "only the valid pointer is returned");
  assert.deepEqual(
    list.invalid.map((i) => i.file).sort(),
    ["secref_bad_body.md", "secref_garbled.md", "secref_no_loc.md"],
  );
  const bodyReason = list.invalid.find((i) => i.file === "secref_bad_body.md")?.reason ?? "";
  assert.match(bodyReason, /body must be empty/);
});

test("an empty/missing secure_refs dir lists cleanly", async () => {
  const ws = await makeWorkspace();
  assert.deepEqual(await listSecureRefs(ws), { refs: [], invalid: [] });
});
