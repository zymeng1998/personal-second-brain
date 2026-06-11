/**
 * Tests for the SB-067 `sb secref` command: metadata-only pointer add/list.
 * Audit guardrail: stdout carries id/kind/path/captured_at but NEVER echoes
 * the locator value. (Locators here are placeholders, not real secrets.)
 */
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { SecrefCliError, runSecrefAdd, runSecrefList } from "../src/secref-command.js";
import { main } from "../src/index.js";

const LOCATOR = "external://keychain/item-placeholder-007";

const tmpDirs: string[] = [];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "sb-secref-cli-"));
  tmpDirs.push(dir);
  return dir;
}

after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

test("secref add writes one pointer; list returns it; ids default to secref_<ULID>", async () => {
  const ws = await makeWorkspace();
  const added = await runSecrefAdd({
    kind: "identity_document",
    locator: LOCATOR,
    notes: "metadata only",
    workspace: ws,
    now: "2026-06-10T12:00:00Z",
  });
  assert.match(added.id, /^secref_[0-7][0-9A-HJKMNP-TV-Z]{25}$/);
  assert.equal(added.captured_at, "2026-06-10T12:00:00Z");
  assert.ok(!JSON.stringify(added).includes(LOCATOR), "audit output never echoes the locator");

  const list = await runSecrefList({ workspace: ws });
  assert.equal(list.count, 1);
  assert.equal(list.refs[0]?.id, added.id);
  assert.equal(list.refs[0]?.locator, LOCATOR); // list IS the read surface — locator available there
  assert.equal(list.invalid.length, 0);

  // the pointer file itself holds metadata only (no body)
  const text = await readFile(added.path, "utf8");
  assert.equal((text.split(/\n---\n?/)[1] ?? "").trim(), "");
});

test("missing kind/locator are bad_arguments; nothing is written", async () => {
  const ws = await makeWorkspace();
  await assert.rejects(
    runSecrefAdd({ kind: "", locator: LOCATOR, workspace: ws }),
    (e: unknown) => e instanceof SecrefCliError && e.code === "bad_arguments",
  );
  await assert.rejects(
    runSecrefAdd({ kind: "k", locator: "  ", workspace: ws }),
    (e: unknown) => e instanceof SecrefCliError && e.code === "bad_arguments",
  );
  assert.equal((await runSecrefList({ workspace: ws })).count, 0);
});

test("main() round-trip: sb secref add / list; bad args exit 1 without echoing values", async () => {
  const ws = await makeWorkspace();
  let stdout = "";
  const io = { out: (t: string) => void (stdout += t), err: (t: string) => void (stdout += t) };

  assert.equal(
    await main(
      ["secref", "add", "--kind", "lease", "--locator", LOCATOR, "--id", "secref_lease_001", "--workspace", ws],
      io,
    ),
    0,
  );
  assert.ok(!stdout.includes(LOCATOR), "CLI stdout never echoes the locator");
  assert.match(stdout, /secref_lease_001/);

  stdout = "";
  assert.equal(await main(["secref", "list", "--workspace", ws], io), 0);
  assert.equal((JSON.parse(stdout) as { count: number }).count, 1);

  stdout = "";
  assert.equal(await main(["secref", "add", "--kind", "lease", "--workspace", ws], io), 1);
  assert.match(stdout, /bad_arguments/);

  stdout = "";
  assert.equal(await main(["secref", "nuke", "--workspace", ws], io), 1);
  assert.match(stdout, /unknown secref subcommand/);
});
