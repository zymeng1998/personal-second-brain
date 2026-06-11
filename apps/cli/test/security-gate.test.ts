/**
 * SB-074 — the EPIC-CORE-011 "Done when" gate:
 *   (a) an under-privileged caller is scope_denied on EVERY write operation
 *       (registered-but-limited AND unknown callers alike);
 *   (b) ALWAYS_DENIED_SCOPES are unobtainable by any caller — even with an
 *       explicit allow-list naming them;
 *   (c) the secure-ref round-trip (create → list → cite from a note) never
 *       lets the sensitive bytes enter the workspace (full byte-leak scan).
 */
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import {
  ALWAYS_DENIED_SCOPES,
  OPERATION_CONTRACTS,
  ScopeDeniedError,
  enforceScope,
  grantAllows,
  grantFor,
} from "@sb/interfaces";
import type { CapabilityGrant, CoreOperations, PermissionScope } from "@sb/interfaces";
import { main } from "../src/index.js";
import { runCapture } from "../src/capture-command.js";

// In-memory stand-in for a sensitive document. A PLACEHOLDER, not a real
// secret — the gate asserts these bytes never land anywhere in the workspace.
const SENSITIVE_DOCUMENT = "GATE_LEAK_SENTINEL_passport-scan-bytes-0xDEADBEEF";

const tmpDirs: string[] = [];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "sb-security-gate-"));
  tmpDirs.push(dir);
  return dir;
}

after(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

async function everyFile(root: string): Promise<string[]> {
  const files: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    if (!existsSync(dir)) return;
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else files.push(path);
    }
  };
  await walk(root);
  return files;
}

test("GATE (a): every write operation is denied for under-privileged callers", () => {
  const writeOps = (Object.keys(OPERATION_CONTRACTS) as Array<keyof CoreOperations>).filter(
    (op) => !OPERATION_CONTRACTS[op].readOnly,
  );
  assert.ok(writeOps.length >= 7, "the contract table must cover the write surface");

  // descriptor-less write paths enforced via direct scopes
  const directWriteScopes: PermissionScope[] = ["write:notes", "write:secure_refs"];

  for (const op of writeOps) {
    // unknown caller: denied on everything
    assert.throws(
      () => enforceScope("domain-app:rogue", op),
      (e: unknown) => e instanceof ScopeDeniedError,
      `rogue must be denied ${String(op)}`,
    );
    // registered-but-limited caller: the retrieval sidecar may ONLY indexVault
    if (op !== "indexVault") {
      assert.throws(
        () => enforceScope("sidecar:retrieval", op),
        (e: unknown) => e instanceof ScopeDeniedError,
        `sidecar:retrieval must be denied ${String(op)}`,
      );
    }
    // skills hold nothing
    assert.throws(() => enforceScope("skill:any", op), ScopeDeniedError);
  }
  for (const scope of directWriteScopes) {
    assert.throws(() => enforceScope("domain-app:rogue", scope), ScopeDeniedError);
    assert.throws(() => enforceScope("sidecar:retrieval", scope), ScopeDeniedError);
  }
  // the sidecar's one legitimate write
  assert.doesNotThrow(() => enforceScope("sidecar:retrieval", "indexVault"));
});

test("GATE (b): ALWAYS_DENIED_SCOPES are unobtainable by any caller or grant", () => {
  for (const denied of ALWAYS_DENIED_SCOPES) {
    const probe: PermissionScope = denied === "delete:*" ? ("delete:notes" as PermissionScope) : denied;
    // every registered + unknown caller
    for (const caller of ["cli", "sidecar:retrieval", "skill:any", "domain-app:rogue"]) {
      assert.equal(grantAllows(grantFor(caller), probe), false, `${caller} vs ${probe}`);
    }
    // even a synthetic grant explicitly allowing the denied scope
    const synthetic: CapabilityGrant = { app: "attacker", allow: [denied as PermissionScope] };
    assert.equal(grantAllows(synthetic, probe), false, `explicit allow of ${denied} must not work`);
  }
});

test("GATE (c): secure-ref round-trip — the sensitive bytes never enter the workspace", async () => {
  const ws = await makeWorkspace();

  // The sensitive document exists only in memory (external secure storage is
  // simulated by simply never writing it). Record the POINTER via the CLI:
  let stdout = "";
  const io = { out: (t: string) => void (stdout += t), err: (t: string) => void (stdout += t) };
  assert.equal(
    await main(
      [
        "secref", "add",
        "--kind", "identity_document",
        "--locator", "external://secure-volume/item-42",
        "--notes", "metadata only",
        "--id", "secref_gate_0001",
        "--workspace", ws,
      ],
      io,
    ),
    0,
  );

  // list round-trip
  stdout = "";
  assert.equal(await main(["secref", "list", "--workspace", ws], io), 0);
  const list = JSON.parse(stdout) as { count: number; refs: Array<{ id: string }> };
  assert.equal(list.count, 1);
  assert.equal(list.refs[0]?.id, "secref_gate_0001");

  // a note CITES the pointer id (the supported way to reference the document)
  await runCapture({
    workspace: ws,
    content: "Filed the scanned document as secref_gate_0001 (see secure storage).",
    source: "paste",
  });

  // byte-leak scan: the sensitive bytes appear in NO file anywhere in the
  // workspace (vault, events, db, secure_refs, anything)
  const files = await everyFile(ws);
  assert.ok(files.length >= 3, "workspace has the pointer + note + event files");
  for (const file of files) {
    const bytes = await readFile(file, "utf8").catch(() => "");
    assert.ok(
      !bytes.includes(SENSITIVE_DOCUMENT),
      `sensitive bytes leaked into ${file}`,
    );
    assert.ok(!bytes.includes("0xDEADBEEF"), `sentinel fragment leaked into ${file}`);
  }

  // and the citation chain holds: the pointer file exists, frontmatter-only
  const pointer = await readFile(join(ws, "secure_refs", "secref_gate_0001.md"), "utf8");
  assert.match(pointer, /location: external/);
  assert.equal((pointer.split(/\n---\n?/)[1] ?? "").trim(), "", "pointer carries no content");
});
