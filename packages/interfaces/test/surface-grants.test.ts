/**
 * SB-078 — surface caller grants (OQ #32): exact least-privilege tables for
 * `surface:obsidian-helper` and `surface:dashboard`; everything outside the
 * table denied; ALWAYS_DENIED unobtainable; surfaces never consult config;
 * zero change for existing callers (their own tests run unmodified alongside).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { grantFor, resolveGrant } from "../src/grants.js";
import { ALWAYS_DENIED_SCOPES, grantAllows } from "../src/scope.js";
import type { PermissionScope } from "../src/scope.js";
import type { GrantConfig } from "../src/grant-config.js";

const scope = (s: string): PermissionScope => s as PermissionScope;

const ALL_OPERATIONAL: string[] = [
  "write:capture", "write:distill", "write:facts", "write:outputs", "write:notes",
  "write:secure_refs", "read:facts", "rebuild:projections", "write:index", "read:index",
  "append:events", "read:notes",
];

const SURFACE_TABLES: Record<string, string[]> = {
  "surface:obsidian-helper": ["write:capture", "read:notes"],
  "surface:dashboard": ["read:notes", "read:facts", "read:index", "write:capture"],
};

test("surface grants match the documented least-privilege tables EXACTLY", () => {
  for (const [caller, allowed] of Object.entries(SURFACE_TABLES)) {
    const grant = grantFor(caller);
    for (const s of ALL_OPERATIONAL) {
      assert.equal(
        grantAllows(grant, scope(s)),
        allowed.includes(s),
        `${caller} vs ${s}: must be ${allowed.includes(s) ? "allowed" : "denied"}`,
      );
    }
    // exact allow-list (no hidden extras, frozen like the rest of the registry)
    assert.deepEqual([...grant.allow].sort(), [...allowed].sort());
    assert.ok(Object.isFrozen(grant) && Object.isFrozen(grant.allow), `${caller} grant frozen`);
  }
});

test("ALWAYS_DENIED stays unobtainable for both surfaces", () => {
  for (const caller of Object.keys(SURFACE_TABLES)) {
    const grant = grantFor(caller);
    for (const denied of ALWAYS_DENIED_SCOPES) {
      const probe = denied === "delete:*" ? scope("delete:notes") : scope(denied);
      assert.equal(grantAllows(grant, probe), false, `${caller} vs ${denied}`);
    }
  }
});

test("surfaces are first-party: config is never consulted, hostile entries ignored", () => {
  const hostile = {
    version: 1,
    grants: [
      { app: "surface:dashboard", allow: ["write:facts", "write:distill"] },
      { app: "surface:obsidian-helper", allow: [] },
    ],
  } as unknown as GrantConfig;
  for (const caller of Object.keys(SURFACE_TABLES)) {
    assert.deepEqual(
      resolveGrant(caller, hostile),
      resolveGrant(caller),
      `${caller} resolution must be config-blind`,
    );
  }
  assert.equal(grantAllows(resolveGrant("surface:dashboard", hostile), scope("write:facts")), false);
  assert.equal(
    grantAllows(resolveGrant("surface:obsidian-helper", hostile), scope("write:capture")),
    true,
  );
});

test("an unregistered surface name gets the empty grant (fail closed)", () => {
  const grant = grantFor("surface:mobile");
  assert.deepEqual(grant.allow, []);
  assert.equal(grantAllows(grant, scope("read:notes")), false);
});
