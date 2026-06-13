/**
 * SB-070 — `media_reference.schema.json` acceptance tests + OQ #29-style
 * lock-step parity: one shared fixture set runs through BOTH the published
 * JSON schema (Ajv, test-only) and the dependency-free runtime
 * `parseMediaReference`, asserting identical accept/reject verdicts so the
 * schema and the validator cannot drift. Also asserts `capture.schema.json`
 * accepts `source: "transcript"` + a `media` block.
 */
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { test } from "node:test";
import type { ValidateFunction } from "ajv";
import { MediaReferenceError, parseMediaReference } from "../packages/interfaces/src/media-reference.js";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const require = createRequire(import.meta.url);
interface AjvInstance {
  compile(schema: unknown): ValidateFunction;
}
type AjvCtor = new (opts?: Record<string, unknown>) => AjvInstance;
const ajvMod = require("ajv/dist/2020.js") as { default?: AjvCtor } & AjvCtor;
const Ajv2020: AjvCtor = ajvMod.default ?? ajvMod;

async function compile(rel: string): Promise<ValidateFunction> {
  const raw = await readFile(join(REPO_ROOT, rel), "utf8");
  return new Ajv2020({ allErrors: true, strict: false }).compile(JSON.parse(raw));
}

const SHA = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";

const SHARED: Array<[label: string, value: unknown, accepted: boolean]> = [
  ["public_ref + ref", { media_id: "54c63db258a34d84", transcript_sha256: SHA, ref_class: "public_ref", ref: "https://example.org/v.mp4" }, true],
  ["signed_url_detected + secref", { media_id: "a4bf9becd046d7ae", transcript_sha256: SHA, ref_class: "signed_url_detected", secref: "secref_01HXMEDIA0001" }, true],
  ["token_detected + secref", { media_id: "deadbeefcafe0001", transcript_sha256: SHA, ref_class: "token_detected", secref: "secref_x" }, true],
  ["local_private_path + secref", { media_id: "deadbeefcafe0002", transcript_sha256: SHA, ref_class: "local_private_path", secref: "secref_y" }, true],
  ["ambiguous_default_private + secref", { media_id: "deadbeefcafe0003", transcript_sha256: SHA, ref_class: "ambiguous_default_private", secref: "secref_z" }, true],

  ["public_ref WITHOUT ref", { media_id: "54c63db258a34d84", transcript_sha256: SHA, ref_class: "public_ref" }, false],
  ["public_ref WITH secref (forbidden)", { media_id: "54c63db258a34d84", transcript_sha256: SHA, ref_class: "public_ref", secref: "secref_x" }, false],
  ["private WITH ref (forbidden)", { media_id: "54c63db258a34d84", transcript_sha256: SHA, ref_class: "signed_url_detected", ref: "https://x" }, false],
  ["private WITHOUT secref", { media_id: "54c63db258a34d84", transcript_sha256: SHA, ref_class: "token_detected" }, false],
  ["unknown ref_class", { media_id: "54c63db258a34d84", transcript_sha256: SHA, ref_class: "whatever", ref: "x" }, false],
  ["bad media_id (too short)", { media_id: "short", transcript_sha256: SHA, ref_class: "public_ref", ref: "x" }, false],
  ["bad sha256", { media_id: "54c63db258a34d84", transcript_sha256: "NOTHEX", ref_class: "public_ref", ref: "x" }, false],
  ["bad secref id", { media_id: "54c63db258a34d84", transcript_sha256: SHA, ref_class: "local_private_path", secref: "not-a-secref" }, false],
  ["extra property (no raw-locator field allowed)", { media_id: "54c63db258a34d84", transcript_sha256: SHA, ref_class: "public_ref", ref: "x", locator: "s3://secret" }, false],
  ["missing media_id", { transcript_sha256: SHA, ref_class: "public_ref", ref: "x" }, false],
  ["non-object", [1, 2], false],
];

test("the checked-in sample validates against media_reference.schema.json", async () => {
  const validate = await compile("schemas/markdown/media_reference.schema.json");
  const sample = JSON.parse(await readFile(join(REPO_ROOT, "examples", "media", "media_reference.sample.json"), "utf8"));
  assert.equal(validate(sample), true, JSON.stringify(validate.errors));
});

test("LOCK-STEP: schema and parseMediaReference give identical verdicts", async () => {
  const validate = await compile("schemas/markdown/media_reference.schema.json");
  for (const [label, value, accepted] of SHARED) {
    const schemaVerdict = validate(value) === true;
    let runtimeVerdict = true;
    try {
      parseMediaReference(value);
    } catch (e) {
      assert.ok(e instanceof MediaReferenceError, `${label}: wrong error type`);
      runtimeVerdict = false;
    }
    assert.equal(schemaVerdict, accepted, `${label}: schema verdict drifted`);
    assert.equal(runtimeVerdict, accepted, `${label}: runtime verdict drifted`);
  }
});

test("parseMediaReference is leak-free and freezes its result", () => {
  // a private classification never carries (or echoes) a raw locator
  try {
    parseMediaReference({ media_id: "54c63db258a34d84", transcript_sha256: SHA, ref_class: "public_ref", secref: "secref_x" });
    assert.fail("expected rejection");
  } catch (e) {
    assert.ok(e instanceof MediaReferenceError);
    assert.equal(e.code, "media_reference_invalid");
    assert.ok(!e.message.includes("secref_x"), "error must not echo field values");
  }
  const ref = parseMediaReference({ media_id: "54c63db258a34d84", transcript_sha256: SHA, ref_class: "ambiguous_default_private", secref: "secref_z" });
  assert.ok(Object.isFrozen(ref));
});

test("capture.schema.json accepts source:transcript + a media block", async () => {
  const validate = await compile("schemas/json/capture.schema.json");
  assert.equal(
    validate({
      content: "transcript text",
      source: "transcript",
      media: { media_id: "54c63db258a34d84", transcript_sha256: SHA, ref_class: "public_ref", ref: "https://x" },
    }),
    true,
    JSON.stringify(validate.errors),
  );
  // a media block smuggling an extra raw-locator field is rejected
  assert.equal(
    validate({
      content: "x",
      source: "transcript",
      media: { media_id: "54c63db258a34d84", transcript_sha256: SHA, ref_class: "public_ref", ref: "x", signed_url: "https://secret" },
    }),
    false,
  );
});
