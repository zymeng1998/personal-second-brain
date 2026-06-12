/**
 * SB-075 — fail-closed grant config parser/loader.
 *
 * The core of this file is the OQ #29 LOCK-STEP test: one shared fixture set
 * is run through BOTH the published JSON schema (Ajv, test-only dependency)
 * and the dependency-free runtime `parseGrantConfig`, asserting identical
 * accept/reject verdicts so the two can never drift. The single documented
 * divergence — duplicate `domain-app:*` entries with different payloads,
 * which JSON Schema cannot express — is asserted explicitly as
 * schema-accepts/loader-rejects (the loader is strictly stricter, never
 * looser).
 */
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { test } from "node:test";
import type { ValidateFunction } from "ajv";
import {
  EMPTY_GRANT_CONFIG,
  GrantConfigError,
  loadGrantConfig,
  parseGrantConfig,
} from "../src/grant-config.js";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

// same CJS/ESM interop pattern as the schema tests in scripts/
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
  return new Ajv2020({ allErrors: true, strict: false }).compile(JSON.parse(raw));
}

const entry = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  app: "domain-app:example-readonly",
  allow: ["read:notes", "read:facts"],
  ...overrides,
});

/** Shared fixtures: schema verdict and runtime verdict MUST be identical. */
const SHARED_FIXTURES: Array<[label: string, config: unknown, accepted: boolean]> = [
  ["minimal read-only grant", { version: 1, grants: [entry()] }, true],
  ["empty grants list", { version: 1, grants: [] }, true],
  ["empty allow list", { version: 1, grants: [entry({ allow: [] })] }, true],
  ["deny list present", { version: 1, grants: [entry({ deny: ["write:facts"] })] }, true],
  ["scoped read:notes:<sub>", { version: 1, grants: [entry({ allow: ["read:notes:projects"] })] }, true],
  ["two distinct apps", { version: 1, grants: [entry(), entry({ app: "domain-app:other" })] }, true],

  ["write:raw in allow", { version: 1, grants: [entry({ allow: ["write:raw"] })] }, false],
  ["delete:* in allow", { version: 1, grants: [entry({ allow: ["delete:*"] })] }, false],
  ["delete:notes in allow", { version: 1, grants: [entry({ allow: ["delete:notes"] })] }, false],
  ["read:secure_refs in allow", { version: 1, grants: [entry({ allow: ["read:secure_refs"] })] }, false],
  ["write:raw in deny", { version: 1, grants: [entry({ deny: ["write:raw"] })] }, false],
  ["read:secure_refs in deny", { version: 1, grants: [entry({ deny: ["read:secure_refs"] })] }, false],
  ["reserved app cli", { version: 1, grants: [entry({ app: "cli" })] }, false],
  ["reserved app sidecar:retrieval", { version: 1, grants: [entry({ app: "sidecar:retrieval" })] }, false],
  ["reserved app skill:x", { version: 1, grants: [entry({ app: "skill:x" })] }, false],
  ["wrong namespace shape", { version: 1, grants: [entry({ app: "domain-apps/example" })] }, false],
  ["non-string app", { version: 1, grants: [entry({ app: 7 })] }, false],
  ["unknown scope", { version: 1, grants: [entry({ allow: ["read:everything"] })] }, false],
  ["non-string scope item", { version: 1, grants: [entry({ allow: [42] })] }, false],
  ["missing version", { grants: [] }, false],
  ["wrong version", { version: 2, grants: [] }, false],
  ["extra top-level property", { version: 1, grants: [], mode: "permissive" }, false],
  ["non-array grants", { version: 1, grants: {} }, false],
  ["entry missing allow", { version: 1, grants: [{ app: "domain-app:x" }] }, false],
  ["entry extra property", { version: 1, grants: [entry({ elevated: true })] }, false],
  ["non-object entry", { version: 1, grants: ["domain-app:x"] }, false],
  ["duplicate scope in allow", { version: 1, grants: [entry({ allow: ["read:notes", "read:notes"] })] }, false],
  ["identical duplicate entries", { version: 1, grants: [entry(), entry()] }, false],
  ["non-object root", [1, 2], false],
];

test("LOCK-STEP (OQ #29): schema and runtime validator give identical verdicts", async () => {
  const validate = await compileSchema();
  for (const [label, config, accepted] of SHARED_FIXTURES) {
    const schemaVerdict = validate(config) === true;
    let runtimeVerdict = true;
    try {
      parseGrantConfig(JSON.stringify(config));
    } catch (error: unknown) {
      assert.ok(error instanceof GrantConfigError, `${label}: wrong error type`);
      runtimeVerdict = false;
    }
    assert.equal(schemaVerdict, accepted, `${label}: schema verdict drifted`);
    assert.equal(runtimeVerdict, accepted, `${label}: runtime verdict drifted`);
  }
});

test("documented divergence: duplicate app with different payloads — schema accepts, loader rejects", async () => {
  const validate = await compileSchema();
  const config = {
    version: 1,
    grants: [entry(), entry({ allow: ["write:facts"] })],
  };
  assert.equal(validate(config), true, "JSON Schema cannot express app uniqueness");
  assert.throws(
    () => parseGrantConfig(JSON.stringify(config)),
    (error: unknown) =>
      error instanceof GrantConfigError &&
      error.details.reason === "duplicate_app" &&
      error.details.path === "grants[1].app",
    "duplicate domain-app entries must fail closed (never merge / last-write-wins)",
  );
});

test("rejection is whole-file, leak-free, and names reason + key path only", () => {
  const config = {
    version: 1,
    grants: [entry(), entry({ app: "domain-app:rogue", allow: ["read:notes", "write:raw"] })],
  };
  try {
    parseGrantConfig(JSON.stringify(config));
    assert.fail("expected rejection");
  } catch (error: unknown) {
    assert.ok(error instanceof GrantConfigError);
    assert.equal(error.code, "grant_config_invalid");
    assert.equal(error.details.reason, "scope_not_grantable");
    assert.equal(error.details.path, "grants[1].allow[1]");
    // leak-free: the message carries the key path, never payload values
    assert.ok(!error.message.includes("write:raw"));
    assert.ok(!error.message.includes("domain-app:rogue"));
  }
  assert.throws(
    () => parseGrantConfig("{ not json"),
    (e: unknown) => e instanceof GrantConfigError && e.details.reason === "invalid_json",
  );
});

test("parsed config is deep-frozen — config-loaded grants cannot be mutated", () => {
  const config = parseGrantConfig(JSON.stringify({ version: 1, grants: [entry()] }));
  assert.ok(Object.isFrozen(config));
  assert.ok(Object.isFrozen(config.grants));
  assert.ok(Object.isFrozen(config.grants[0]));
  assert.ok(Object.isFrozen(config.grants[0].allow));
  assert.throws(() => {
    (config.grants[0].allow as string[]).push("write:facts");
  });
});

test("loadGrantConfig: missing file = valid empty config; unreadable/invalid fail closed", async () => {
  const dir = await mkdtemp(join(tmpdir(), "sb-grant-config-"));
  try {
    // missing config/grants.json → default-deny empty config (OQ #31)
    const missing = await loadGrantConfig(dir);
    assert.deepEqual(missing, EMPTY_GRANT_CONFIG);
    assert.ok(Object.isFrozen(missing.grants));

    // a real file round-trips through the same strict parser
    await mkdir(join(dir, "config"), { recursive: true });
    await writeFile(
      join(dir, "config", "grants.json"),
      JSON.stringify({ version: 1, grants: [entry()] }),
      "utf8",
    );
    const loaded = await loadGrantConfig(dir);
    assert.equal(loaded.grants.length, 1);
    assert.equal(loaded.grants[0].app, "domain-app:example-readonly");

    // malformed content fails closed via the same parser
    await writeFile(join(dir, "config", "grants.json"), "{ nope", "utf8");
    await assert.rejects(
      loadGrantConfig(dir),
      (e: unknown) => e instanceof GrantConfigError && e.details.reason === "invalid_json",
    );

    // unreadable (path is a directory) fails closed as `unreadable`
    await rm(join(dir, "config", "grants.json"));
    await mkdir(join(dir, "config", "grants.json"));
    await assert.rejects(
      loadGrantConfig(dir),
      (e: unknown) => e instanceof GrantConfigError && e.details.reason === "unreadable",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("the checked-in sample config parses and matches the read-only example grant", async () => {
  const text = await readFile(join(REPO_ROOT, "examples", "grants", "grants.sample.json"), "utf8");
  const config = parseGrantConfig(text);
  assert.equal(config.version, 1);
  assert.equal(config.grants.length, 1);
  assert.deepEqual(config.grants[0], {
    app: "domain-app:example-readonly",
    allow: ["read:notes", "read:facts"],
  });
});
