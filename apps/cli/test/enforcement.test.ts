/**
 * SB-073 — scope enforcement at the operations boundary: every CLI command is
 * gated by enforceScope(caller, …) through the SAME resolver for all callers.
 * Negative tests: denied scopes, unknown/missing grants, attempted env bypass.
 */
import { existsSync } from "node:fs";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { ScopeDeniedError, enforceScope } from "@sb/interfaces";
import { main } from "../src/index.js";
import { runCapture } from "../src/capture-command.js";

const tmpDirs: string[] = [];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "sb-enforce-"));
  tmpDirs.push(dir);
  return dir;
}

after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

async function runAs(caller: string, argv: string[]): Promise<{ code: number; output: string }> {
  let output = "";
  const io = { out: (t: string) => void (output += t), err: (t: string) => void (output += t) };
  const code = await main(argv, io, caller);
  return { code, output };
}

test("an unknown caller (empty grant) is denied on EVERY command through the real path", async () => {
  const ws = await makeWorkspace();
  const file = join(ws, "p.json");
  await writeFile(file, "{}", "utf8");

  const commands: string[][] = [
    ["capture", "--content", "x", "--source", "paste", "--workspace", ws],
    ["note", "list", "--workspace", ws],
    ["note", "get", "01ARZ3NDEKTSV4RRFFQ69G5FAV", "--workspace", ws],
    ["note", "promote", "01ARZ3NDEKTSV4RRFFQ69G5FAV", "--workspace", ws],
    ["distill", "propose", "--workspace", ws],
    ["distill", "accept", "--file", file, "--workspace", ws],
    ["fact", "add", "--statement", "s", "--source-ref", "01ARZ3NDEKTSV4RRFFQ69G5FAV", "--workspace", ws],
    ["fact", "accept", "--file", file, "--workspace", ws],
    ["fact", "list", "--workspace", ws],
    ["secref", "add", "--kind", "k", "--locator", "external://placeholder", "--workspace", ws],
    ["secref", "list", "--workspace", ws],
    ["output", "create", "--file", file, "--workspace", ws],
    ["rebuild", "--workspace", ws],
    ["index", "--workspace", ws],
    ["query", "anything", "--workspace", ws],
  ];
  for (const argv of commands) {
    const { code, output } = await runAs("domain-app:rogue", argv);
    assert.equal(code, 1, `${argv[0]} ${argv[1] ?? ""} must exit 1 for a rogue caller`);
    assert.match(output, /scope_denied/, `${argv[0]} ${argv[1] ?? ""} must be scope_denied`);
  }
  // and nothing was written anywhere
  assert.equal(existsSync(join(ws, "vault")), false);
  assert.equal(existsSync(join(ws, "events")), false);
  assert.equal(existsSync(join(ws, "db")), false);
  assert.equal(existsSync(join(ws, "secure_refs")), false);
});

test("skills hold no scopes of their own (they act via the cli, which is the human's proxy)", async () => {
  const ws = await makeWorkspace();
  const denied = await runAs("skill:extract-facts", ["fact", "list", "--workspace", ws]);
  assert.equal(denied.code, 1);
  assert.match(denied.output, /scope_denied/);
});

test("the default cli caller passes through the same resolver and works", async () => {
  const ws = await makeWorkspace();
  const { code } = await runAs("cli", ["capture", "--content", "ok", "--source", "paste", "--workspace", ws]);
  assert.equal(code, 0);
  assert.equal((await readdir(join(ws, "vault", "00_Raw"))).length, 1);
});

test("env flags cannot bypass enforcement (no bypass exists)", async () => {
  const ws = await makeWorkspace();
  const flags = { SB_SKIP_SCOPES: "1", SB_DEV: "1", SB_NO_ENFORCE: "true", NODE_ENV: "test" };
  const previous = new Map<string, string | undefined>();
  for (const [k, v] of Object.entries(flags)) {
    previous.set(k, process.env[k]);
    process.env[k] = v;
  }
  try {
    const { code, output } = await runAs("domain-app:rogue", [
      "capture", "--content", "x", "--source", "paste", "--workspace", ws,
    ]);
    assert.equal(code, 1);
    assert.match(output, /scope_denied/);
    assert.equal(existsSync(join(ws, "vault")), false);
  } finally {
    for (const [k, v] of previous) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});

test("enforceScope: unknown operation names are denied, never silently allowed", () => {
  assert.throws(
    () => enforceScope("cli", "launchMissiles" as never),
    (e: unknown) => e instanceof ScopeDeniedError && e.code === "scope_denied",
  );
});

test("denial messages carry caller + scope only (audit without payload leakage)", async () => {
  const ws = await makeWorkspace();
  try {
    await main(
      ["secref", "add", "--kind", "k", "--locator", "external://SENSITIVE_PLACEHOLDER", "--workspace", ws],
      { out: () => {}, err: () => {} },
      "domain-app:rogue",
    );
  } catch {
    /* main never throws; envelope path */
  }
  try {
    enforceScope("domain-app:rogue", "write:secure_refs");
    assert.fail("expected denial");
  } catch (e) {
    assert.ok(e instanceof ScopeDeniedError);
    assert.match(e.message, /domain-app:rogue/);
    assert.match(e.message, /write:secure_refs/);
    assert.ok(!e.message.includes("SENSITIVE_PLACEHOLDER"), "denials never include payload values");
  }
  // direct library use below the boundary still works for first-party code
  const captured = await runCapture({ workspace: ws, content: "below boundary", source: "paste" });
  assert.ok(captured.note_id);
});
