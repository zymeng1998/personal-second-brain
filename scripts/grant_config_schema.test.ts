/**
 * SB-060 — `schemas/json/grant_config.schema.json` acceptance tests: the
 * example grant config validates; structurally hostile/invalid configs are
 * rejected. The schema is the published contract (OQ #29); duplicate-app
 * rejection is a loader-level semantic check (SB-075 — JSON Schema cannot
 * express it) and is therefore NOT asserted here.
 */
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { test } from "node:test";
import type { ValidateFunction } from "ajv";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// same CJS/ESM interop pattern as validate_notes.ts / proposal_schema.test.ts
const require = createRequire(import.meta.url);
interface AjvInstance {
  compile(schema: unknown): ValidateFunction;
}
type AjvCtor = new (opts?: Record<string, unknown>) => AjvInstance;
const ajvMod = require("ajv/dist/2020.js") as { default?: AjvCtor } & AjvCtor;
const Ajv2020: AjvCtor = ajvMod.default ?? ajvMod;

async function compileSchema(): Promise<ValidateFunction> {
  const raw = await readFile(
    join(REPO_ROOT, "schemas", "json", "grant_config.schema.json"),
    "utf8",
  );
  // strict:false matches the other schema tests — top-level `version` metadata keyword
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  return ajv.compile(JSON.parse(raw));
}

async function readSample(): Promise<Record<string, unknown>> {
  const raw = await readFile(join(REPO_ROOT, "examples", "grants", "grants.sample.json"), "utf8");
  return JSON.parse(raw) as Record<string, unknown>;
}

const entry = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  app: "domain-app:example-readonly",
  allow: ["read:notes", "read:facts"],
  ...overrides,
});

test("the example grant config and benign variants validate", async () => {
  const validate = await compileSchema();
  const good: Array<[string, unknown]> = [
    ["checked-in sample", await readSample()],
    ["empty grants list (no external grants)", { version: 1, grants: [] }],
    ["empty allow list (explicit no-grant entry)", { version: 1, grants: [entry({ allow: [] })] }],
    ["entry with a deny list", { version: 1, grants: [entry({ deny: ["write:facts"] })] }],
    [
      "scoped read:notes:<sub> grant",
      { version: 1, grants: [entry({ allow: ["read:notes:projects"] })] },
    ],
  ];
  for (const [label, config] of good) {
    assert.equal(validate(config), true, `${label}: ${JSON.stringify(validate.errors)}`);
  }
});

test("privileged scopes are structurally unrepresentable (allow AND deny)", async () => {
  const validate = await compileSchema();
  for (const privileged of ["write:raw", "delete:*", "delete:notes", "read:secure_refs"]) {
    for (const field of ["allow", "deny"] as const) {
      const config = { version: 1, grants: [entry({ [field]: [privileged] })] };
      assert.equal(validate(config), false, `expected rejection: ${privileged} in ${field}`);
    }
  }
});

test("reserved/first-party caller identities are unrepresentable", async () => {
  const validate = await compileSchema();
  for (const app of [
    "cli",
    "sidecar:retrieval",
    "skill:extract-facts",
    "domain-apps/example", // wrong namespace shape
    "domain-app:", // empty name
    "domain-app:UPPER", // charset violation
  ]) {
    const config = { version: 1, grants: [entry({ app })] };
    assert.equal(validate(config), false, `expected rejection: app '${app}'`);
  }
});

test("structurally invalid configs are rejected", async () => {
  const validate = await compileSchema();
  const sample = await readSample();
  const bad: Array<[string, unknown]> = [
    ["unknown scope string", { version: 1, grants: [entry({ allow: ["read:everything"] })] }],
    ["missing version", { grants: [] }],
    ["wrong version", { ...sample, version: 2 }],
    ["extra top-level property", { ...sample, mode: "permissive" }],
    ["non-array grants", { version: 1, grants: {} }],
    ["entry missing allow", { version: 1, grants: [{ app: "domain-app:x" }] }],
    [
      "entry with an extra property",
      { version: 1, grants: [entry({ elevated: true })] },
    ],
    [
      "duplicate scope within one allow list",
      { version: 1, grants: [entry({ allow: ["read:notes", "read:notes"] })] },
    ],
  ];
  for (const [label, config] of bad) {
    assert.equal(validate(config), false, `expected rejection: ${label}`);
  }
});
