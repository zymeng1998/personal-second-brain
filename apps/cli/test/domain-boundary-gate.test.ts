/**
 * SB-077 — the EPIC-CORE-012 "Done when" gate: NO possible
 * `config/grants.json` content can weaken the EPIC-CORE-011 security model.
 *  (a) privileged-scope configs (write:raw / delete:* / read:secure_refs,
 *      allow AND deny, incl. wildcard) ⇒ whole file rejected AND the
 *      requesting caller denied everything (fail closed, zero writes);
 *  (b) first-party-shadowing configs ⇒ rejected, and registry callers
 *      resolve IDENTICALLY with and without any config present;
 *  (c) malformed configs (bad JSON / unknown scope / schema violations /
 *      duplicate apps) ⇒ every domain-app caller denied on every operation,
 *      zero writes;
 *  (d) unknown caller + unknown scope/operation stay denied;
 *  (e) the SB-074 security-gate invariants re-asserted WITH config present
 *      (the full SB-074 file also runs in this same suite).
 */
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import {
  ALWAYS_DENIED_SCOPES,
  OPERATION_CONTRACTS,
  ScopeDeniedError,
  enforceScope,
  grantAllows,
  parseGrantConfig,
  resolveGrant,
} from "@sb/interfaces";
import type { CoreOperations, GrantConfig, PermissionScope } from "@sb/interfaces";
import { main } from "../src/index.js";

const APP = "domain-app:gate";
const tmpDirs: string[] = [];

after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

function cliIo(): { io: { out: (t: string) => void; err: (t: string) => void }; all: () => string } {
  let buf = "";
  return { io: { out: (t: string) => void (buf += t), err: (t: string) => void (buf += t) }, all: () => buf };
}

async function makeWorkspace(): Promise<{ ws: string; noteId: string }> {
  const ws = await mkdtemp(join(tmpdir(), "sb-domain-gate-"));
  tmpDirs.push(ws);
  const c = cliIo();
  assert.equal(
    await main(["capture", "--content", "gate fixture", "--source", "paste", "--workspace", ws], c.io),
    0,
    c.all(),
  );
  return { ws, noteId: (JSON.parse(c.all()) as { note_id: string }).note_id };
}

async function writeConfig(ws: string, content: string): Promise<void> {
  await mkdir(join(ws, "config"), { recursive: true });
  await writeFile(join(ws, "config", "grants.json"), content, "utf8");
}

/** Every command form, read AND write, under one caller. Returns stderr per form. */
function commandForms(ws: string, noteId: string): string[][] {
  return [
    ["note", "list", "--workspace", ws],
    ["note", "get", noteId, "--workspace", ws],
    ["fact", "list", "--workspace", ws],
    ["distill", "propose", "--workspace", ws],
    ["secref", "list", "--workspace", ws],
    ["query", "anything", "--workspace", ws],
    ["capture", "--content", "x", "--source", "paste", "--workspace", ws],
    ["note", "promote", noteId, "--workspace", ws],
    ["distill", "accept", "--file", join(ws, "none.json"), "--workspace", ws],
    ["fact", "add", "--statement", "x", "--source-ref", noteId, "--workspace", ws],
    ["fact", "accept", "--file", join(ws, "none.json"), "--workspace", ws],
    ["output", "create", "--file", join(ws, "none.json"), "--workspace", ws],
    ["secref", "add", "--kind", "k", "--locator", "external://x", "--workspace", ws],
    ["rebuild", "--workspace", ws],
    ["index", "--workspace", ws],
  ];
}

async function snapshot(root: string): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  const walk = async (dir: string): Promise<void> => {
    if (!existsSync(dir)) return;
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else files.set(relative(root, path), (await readFile(path)).toString("base64"));
    }
  };
  await walk(root);
  return files;
}

/** Run every command form as `caller`; each must exit 1 matching `pattern`; zero writes. */
async function assertFullyDenied(ws: string, noteId: string, caller: string, pattern: RegExp): Promise<void> {
  const before = await snapshot(ws);
  for (const argv of commandForms(ws, noteId)) {
    const c = cliIo();
    assert.equal(await main(argv, c.io, caller), 1, `${caller}: ${argv.join(" ")} must fail`);
    assert.match(c.all(), pattern, `${caller}: ${argv.join(" ")} wrong failure mode`);
  }
  const afterRun = await snapshot(ws);
  assert.deepEqual([...afterRun.keys()].sort(), [...before.keys()].sort(), "no file created/deleted");
  for (const [path, bytes] of before) assert.equal(afterRun.get(path), bytes, `byte change in ${path}`);
}

test("GATE (a): privileged-scope configs are rejected whole — the requesting app gets NOTHING", async () => {
  const { ws, noteId } = await makeWorkspace();
  const privilegedConfigs = [
    ["write:raw in allow", { version: 1, grants: [{ app: APP, allow: ["read:notes", "write:raw"] }] }],
    ["delete wildcard in allow", { version: 1, grants: [{ app: APP, allow: ["delete:*"] }] }],
    ["delete:notes in allow", { version: 1, grants: [{ app: APP, allow: ["delete:notes"] }] }],
    ["read:secure_refs in allow", { version: 1, grants: [{ app: APP, allow: ["read:secure_refs"] }] }],
    ["write:raw smuggled into deny", { version: 1, grants: [{ app: APP, allow: ["read:notes"], deny: ["write:raw"] }] }],
  ] as const;

  for (const [label, config] of privilegedConfigs) {
    await writeConfig(ws, JSON.stringify(config));
    // even the scope the config ALSO granted legitimately is lost: whole-file rejection
    await assertFullyDenied(ws, noteId, APP, /grant_config_invalid/);
    const c = cliIo();
    assert.equal(await main(["note", "list", "--workspace", ws], c.io, APP), 1, label);
  }
});

test("GATE (b): first-party-shadowing configs are rejected; registry resolution is config-blind", async () => {
  const { ws, noteId } = await makeWorkspace();
  for (const app of ["cli", "sidecar:retrieval", "skill:rogue"]) {
    await writeConfig(ws, JSON.stringify({ version: 1, grants: [{ app, allow: ["read:notes"] }] }));
    // the shadowing file is invalid → any domain app fails closed
    await assertFullyDenied(ws, noteId, APP, /grant_config_invalid/);
    // …and the FIRST-PARTY caller is untouched by the hostile file (config never loaded)
    const c = cliIo();
    assert.equal(await main(["note", "list", "--workspace", ws], c.io), 0, c.all());
    assert.ok(c.all().includes(noteId));
  }

  // resolution-level: registry callers resolve IDENTICALLY with/without any config
  const benign = parseGrantConfig(
    JSON.stringify({ version: 1, grants: [{ app: APP, allow: ["read:notes"] }] }),
  );
  const hostile = {
    version: 1,
    grants: [
      { app: "cli", allow: [] },
      { app: "sidecar:retrieval", allow: ["write:facts"] },
    ],
  } as unknown as GrantConfig;
  for (const caller of ["cli", "sidecar:retrieval"]) {
    assert.deepEqual(resolveGrant(caller, benign), resolveGrant(caller), `${caller} vs benign`);
    assert.deepEqual(resolveGrant(caller, hostile), resolveGrant(caller), `${caller} vs hostile`);
  }
});

test("GATE (c): malformed configs fail closed — every domain app denied everywhere, zero writes", async () => {
  const { ws, noteId } = await makeWorkspace();
  const malformed = [
    ["invalid JSON", "{ not json"],
    ["unknown scope", JSON.stringify({ version: 1, grants: [{ app: APP, allow: ["read:everything"] }] })],
    ["wrong version", JSON.stringify({ version: 2, grants: [] })],
    ["extra property", JSON.stringify({ version: 1, grants: [], mode: "permissive" })],
    [
      "duplicate app entries (approved guardrail: never merge / last-write-wins)",
      JSON.stringify({
        version: 1,
        grants: [
          { app: APP, allow: ["read:notes"] },
          { app: APP, allow: ["write:facts"] },
        ],
      }),
    ],
  ] as const;
  for (const [label, content] of malformed) {
    await writeConfig(ws, content);
    await assertFullyDenied(ws, noteId, APP, /grant_config_invalid/);
    await assertFullyDenied(ws, noteId, "domain-app:other", /grant_config_invalid/);
    void label;
  }
});

test("GATE (d): unknown caller and unknown scope/operation stay denied — with and without config", async () => {
  const { ws, noteId } = await makeWorkspace();
  // no config file: any domain-app / unknown caller is denied on everything
  await assertFullyDenied(ws, noteId, APP, /scope_denied/);
  await assertFullyDenied(ws, noteId, "totally-unknown", /scope_denied/);

  // a VALID config for one app grants nothing to anyone else
  await writeConfig(ws, JSON.stringify({ version: 1, grants: [{ app: APP, allow: ["read:notes"] }] }));
  await assertFullyDenied(ws, noteId, "domain-app:other", /scope_denied/);

  // unknown operation names are denied even for a config-granted caller
  const config = parseGrantConfig(
    JSON.stringify({ version: 1, grants: [{ app: APP, allow: ["read:notes"] }] }),
  );
  assert.throws(
    () => enforceScope(APP, "selfDestruct" as keyof CoreOperations, config),
    ScopeDeniedError,
  );
});

test("GATE (e): the SB-074 security invariants hold unchanged WITH config present", async () => {
  const config = parseGrantConfig(
    JSON.stringify({
      version: 1,
      grants: [{ app: APP, allow: ["read:notes", "read:facts", "write:facts"] }],
    }),
  );

  // every write operation still denied for under-privileged callers, config in hand
  const writeOps = (Object.keys(OPERATION_CONTRACTS) as Array<keyof CoreOperations>).filter(
    (op) => !OPERATION_CONTRACTS[op].readOnly,
  );
  for (const op of writeOps) {
    assert.throws(() => enforceScope("domain-app:rogue", op, config), ScopeDeniedError);
    assert.throws(() => enforceScope("skill:any", op, config), ScopeDeniedError);
    if (op !== "indexVault") {
      assert.throws(() => enforceScope("sidecar:retrieval", op, config), ScopeDeniedError);
    }
  }

  // ALWAYS_DENIED unobtainable for EVERY caller — including the config-granted app
  for (const denied of ALWAYS_DENIED_SCOPES) {
    const probe: PermissionScope = denied === "delete:*" ? ("delete:notes" as PermissionScope) : denied;
    for (const caller of ["cli", "sidecar:retrieval", "skill:any", APP, "domain-app:rogue"]) {
      assert.equal(
        grantAllows(resolveGrant(caller, config), probe),
        false,
        `${caller} must never obtain ${probe}`,
      );
    }
  }

  // and the config-granted app still holds exactly what it was granted
  assert.doesNotThrow(() => enforceScope(APP, "listNotes", config));
  assert.doesNotThrow(() => enforceScope(APP, "addFact", config));
  assert.throws(() => enforceScope(APP, "capture", config), ScopeDeniedError);
});
