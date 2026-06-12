/**
 * SB-076 — config-aware grant resolution with ABSOLUTE first-party
 * precedence. Hostile entries are injected as in-memory objects (casts) —
 * the SB-075 parser rejects them long before this layer, so these tests
 * prove the defense-in-depth layer behind the parser.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseGrantConfig } from "../src/grant-config.js";
import type { GrantConfig } from "../src/grant-config.js";
import { grantFor, resolveGrant } from "../src/grants.js";
import { ScopeDeniedError, enforceScope } from "../src/enforce.js";
import { ALWAYS_DENIED_SCOPES, grantAllows } from "../src/scope.js";
import type { PermissionScope } from "../src/scope.js";

const scope = (s: string): PermissionScope => s as PermissionScope;

const READONLY_CONFIG: GrantConfig = parseGrantConfig(
  JSON.stringify({
    version: 1,
    grants: [{ app: "domain-app:example-readonly", allow: ["read:notes", "read:facts"] }],
  }),
);

test("domain-app callers resolve from config: granted reads allowed, everything else denied", () => {
  const grant = resolveGrant("domain-app:example-readonly", READONLY_CONFIG);
  assert.equal(grantAllows(grant, scope("read:notes")), true);
  assert.equal(grantAllows(grant, scope("read:facts")), true);
  for (const denied of [
    "write:capture", "write:distill", "write:facts", "write:outputs", "write:notes",
    "write:secure_refs", "rebuild:projections", "write:index", "read:index", "append:events",
  ]) {
    assert.equal(grantAllows(grant, scope(denied)), false, `must be denied ${denied}`);
  }
  // enforceScope threads the config through the same single resolver
  assert.doesNotThrow(() => enforceScope("domain-app:example-readonly", "listNotes", READONLY_CONFIG));
  assert.throws(
    () => enforceScope("domain-app:example-readonly", "capture", READONLY_CONFIG),
    ScopeDeniedError,
  );
});

test("no config / no entry / non-domain-app callers fail closed", () => {
  // no config at all
  assert.deepEqual(resolveGrant("domain-app:example-readonly").allow, []);
  // config present but no entry for this app
  assert.deepEqual(resolveGrant("domain-app:other", READONLY_CONFIG).allow, []);
  // reserved/unknown namespaces NEVER consult config, even with hostile in-memory entries
  const hostile = {
    version: 1,
    grants: [
      { app: "skill:rogue", allow: ["write:facts"] },
      { app: "sidecar:ai", allow: ["write:facts"] },
      { app: "unknown", allow: ["write:facts"] },
    ],
  } as unknown as GrantConfig;
  for (const caller of ["skill:rogue", "sidecar:ai", "unknown", ""]) {
    const grant = resolveGrant(caller, hostile);
    assert.deepEqual(grant.allow, [], `${caller} must not resolve from config`);
    assert.equal(grantAllows(grant, scope("write:facts")), false);
  }
});

test("first-party precedence is absolute: hostile shadowing entries are ignored entirely", () => {
  const shadowing = {
    version: 1,
    grants: [
      // the parser makes these unrepresentable; injected here as raw objects
      { app: "cli", allow: [] }, // attempt to STRIP the cli grant
      { app: "sidecar:retrieval", allow: ["write:facts", "write:capture"] }, // attempt to WIDEN
    ],
  } as unknown as GrantConfig;

  // identical resolution with and without the hostile config
  for (const caller of ["cli", "sidecar:retrieval"]) {
    assert.deepEqual(
      resolveGrant(caller, shadowing),
      resolveGrant(caller),
      `${caller} resolution must ignore config entirely`,
    );
  }
  assert.equal(grantAllows(resolveGrant("cli", shadowing), scope("write:capture")), true);
  assert.equal(grantAllows(resolveGrant("sidecar:retrieval", shadowing), scope("write:facts")), false);
});

test("registry grants are frozen and resolveGrant copies config scope lists (no aliasing)", () => {
  const cli = grantFor("cli");
  assert.ok(Object.isFrozen(cli));
  assert.ok(Object.isFrozen(cli.allow));
  assert.throws(() => {
    cli.allow.push(scope("read:secure_refs"));
  });

  const resolved = resolveGrant("domain-app:example-readonly", READONLY_CONFIG);
  assert.notEqual(resolved.allow, READONLY_CONFIG.grants[0].allow, "must be a copy");
  resolved.allow.push(scope("write:facts")); // mutating the RESULT…
  assert.deepEqual(
    [...READONLY_CONFIG.grants[0].allow],
    ["read:notes", "read:facts"],
    "…must never reach the frozen config",
  );
});

test("ALWAYS_DENIED stays unobtainable through config resolution — even hostile in-memory grants", () => {
  const hostile = {
    version: 1,
    grants: [{ app: "domain-app:rogue", allow: [...ALWAYS_DENIED_SCOPES, "read:notes"] }],
  } as unknown as GrantConfig;
  const grant = resolveGrant("domain-app:rogue", hostile);
  for (const denied of ALWAYS_DENIED_SCOPES) {
    const probe = denied === "delete:*" ? scope("delete:notes") : scope(denied);
    assert.equal(grantAllows(grant, probe), false, `${denied} must stay hard-denied`);
  }
  // the non-privileged scope in the same hostile grant still resolves normally
  assert.equal(grantAllows(grant, scope("read:notes")), true);
});

test("config deny overrides allow through the unchanged grantAllows precedence", () => {
  const config = parseGrantConfig(
    JSON.stringify({
      version: 1,
      grants: [{ app: "domain-app:scoped", allow: ["read:notes"], deny: ["read:notes:private"] }],
    }),
  );
  const grant = resolveGrant("domain-app:scoped", config);
  assert.equal(grantAllows(grant, scope("read:notes")), true);
  assert.equal(grantAllows(grant, scope("read:notes:projects")), true);
  assert.equal(grantAllows(grant, scope("read:notes:private")), false);
});
