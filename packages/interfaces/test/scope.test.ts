/**
 * SB-068 — grantAllows table tests: wildcard/hierarchical matching, deny
 * precedence, ALWAYS_DENIED hard deny, empty/missing grants allow nothing.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { grantAllows } from "../src/scope.js";
import type { CapabilityGrant, PermissionScope } from "../src/scope.js";

const grant = (allow: string[], deny?: string[]): CapabilityGrant => ({
  app: "test",
  allow: allow as PermissionScope[],
  ...(deny !== undefined ? { deny: deny as PermissionScope[] } : {}),
});
const scope = (s: string): PermissionScope => s as PermissionScope;

test("allow matching: exact, wildcard segment, hierarchical prefix", () => {
  const cases: Array<[string[], string, boolean]> = [
    [["read:notes"], "read:notes", true],
    [["read:notes"], "read:notes:projects", true], // hierarchical prefix
    [["read:notes:*"], "read:notes:projects", true], // wildcard segment
    [["read:notes:*"], "read:notes", false], // pattern longer than scope
    [["read:notes:projects"], "read:notes", false],
    [["read:notes"], "read:facts", false],
    [["write:capture", "read:index"], "read:index", true],
    [[], "read:notes", false], // empty grant allows nothing
  ];
  for (const [allow, s, expected] of cases) {
    assert.equal(grantAllows(grant(allow), scope(s)), expected, `${allow.join(",")} vs ${s}`);
  }
});

test("deny overrides allow (incl. wildcard deny)", () => {
  assert.equal(grantAllows(grant(["read:notes"], ["read:notes"]), scope("read:notes")), false);
  assert.equal(grantAllows(grant(["read:notes"], ["read:notes:*"]), scope("read:notes:x")), false);
  assert.equal(grantAllows(grant(["read:notes"], ["read:facts"]), scope("read:notes")), true);
});

test("ALWAYS_DENIED_SCOPES are unobtainable even when explicitly allowed", () => {
  assert.equal(grantAllows(grant(["write:raw"]), scope("write:raw")), false);
  assert.equal(grantAllows(grant(["delete:*"]), scope("delete:anything")), false);
  assert.equal(grantAllows(grant(["delete:*"]), scope("delete:vault:raw")), false, "deep delete");
  assert.equal(grantAllows(grant(["read:secure_refs"]), scope("read:secure_refs")), false);
});

test("the resolver is environment-blind: env flags change nothing (no bypass)", () => {
  const g = grant([]);
  for (const flag of ["SB_SKIP_SCOPES", "SB_DEV", "NODE_ENV"]) {
    const previous = process.env[flag];
    process.env[flag] = flag === "NODE_ENV" ? "development" : "1";
    try {
      assert.equal(grantAllows(g, scope("write:capture")), false, `${flag} must not bypass`);
      assert.equal(grantAllows(grant(["write:raw"]), scope("write:raw")), false);
    } finally {
      if (previous === undefined) delete process.env[flag];
      else process.env[flag] = previous;
    }
  }
});
