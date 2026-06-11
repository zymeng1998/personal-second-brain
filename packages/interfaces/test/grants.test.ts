/**
 * SB-069 — first-party grants registry: documented least-privilege table,
 * unknown/skill callers get empty grants, ALWAYS_DENIED unobtainable via any
 * registered grant.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { grantFor } from "../src/grants.js";
import { ALWAYS_DENIED_SCOPES, grantAllows } from "../src/scope.js";
import type { PermissionScope } from "../src/scope.js";

const scope = (s: string): PermissionScope => s as PermissionScope;

test("cli holds every operational scope; sidecar:retrieval is read-vault/index-only", () => {
  const cli = grantFor("cli");
  for (const s of [
    "write:capture", "write:distill", "write:facts", "write:outputs", "write:notes", "write:secure_refs",
    "read:facts", "rebuild:projections", "write:index", "read:index", "append:events", "read:notes",
  ]) {
    assert.equal(grantAllows(cli, scope(s)), true, `cli must hold ${s}`);
  }

  const sidecar = grantFor("sidecar:retrieval");
  assert.equal(grantAllows(sidecar, scope("read:notes")), true);
  assert.equal(grantAllows(sidecar, scope("write:index")), true);
  assert.equal(grantAllows(sidecar, scope("read:index")), true);
  for (const s of ["write:capture", "write:facts", "write:outputs", "append:events", "rebuild:projections"]) {
    assert.equal(grantAllows(sidecar, scope(s)), false, `sidecar must NOT hold ${s}`);
  }
});

test("unknown callers and skills get an empty grant (denied everything)", () => {
  for (const caller of ["skill:distill", "skill:rogue", "domain-apps/example", "sidecar:ai", ""]) {
    const grant = grantFor(caller);
    assert.equal(grant.app, caller);
    assert.deepEqual(grant.allow, []);
    assert.equal(grantAllows(grant, scope("read:notes")), false);
  }
});

test("ALWAYS_DENIED scopes are unobtainable through every registered grant", () => {
  for (const caller of ["cli", "sidecar:retrieval", "skill:any", "unknown"]) {
    const grant = grantFor(caller);
    assert.equal(grantAllows(grant, scope("write:raw")), false, `${caller}: write:raw`);
    assert.equal(grantAllows(grant, scope("delete:notes")), false, `${caller}: delete:*`);
    assert.equal(grantAllows(grant, scope("read:secure_refs")), false, `${caller}: read:secure_refs`);
    for (const denied of ALWAYS_DENIED_SCOPES) {
      assert.ok(!grant.allow.includes(denied as PermissionScope), `${caller} allow-list must not list ${denied}`);
    }
  }
});
