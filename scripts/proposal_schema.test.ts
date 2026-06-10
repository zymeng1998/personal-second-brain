/**
 * SB-056 — `schemas/json/proposal.schema.json` acceptance tests: the example
 * proposals validate; structurally bad proposals are rejected. Lives next to
 * the other schema-facing scripts (run via `pnpm test:scripts`).
 */
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { test } from "node:test";
import type { ValidateFunction } from "ajv";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// same CJS/ESM interop pattern as validate_notes.ts
const require = createRequire(import.meta.url);
interface AjvInstance {
  compile(schema: unknown): ValidateFunction;
}
type AjvCtor = new (opts?: Record<string, unknown>) => AjvInstance;
const ajvMod = require("ajv/dist/2020.js") as { default?: AjvCtor } & AjvCtor;
const Ajv2020: AjvCtor = ajvMod.default ?? ajvMod;
const afMod = require("ajv-formats") as { default?: (ajv: AjvInstance) => void } & ((
  ajv: AjvInstance,
) => void);
const addFormats: (ajv: AjvInstance) => void = afMod.default ?? afMod;

async function compileSchema(): Promise<ValidateFunction> {
  const raw = await readFile(join(REPO_ROOT, "schemas", "json", "proposal.schema.json"), "utf8");
  // strict:false matches validate_notes.ts — our schemas carry a top-level
  // `version` metadata keyword that Ajv strict mode would reject
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(JSON.parse(raw));
}

async function readExample(name: string): Promise<unknown> {
  return JSON.parse(await readFile(join(REPO_ROOT, "examples", "proposals", name), "utf8"));
}

test("both example proposals validate against proposal.schema.json", async () => {
  const validate = await compileSchema();
  for (const name of ["extract_facts.sample.json", "compose_output.sample.json"]) {
    const ok = validate(await readExample(name));
    assert.equal(ok, true, `${name}: ${JSON.stringify(validate.errors)}`);
  }
});

test("structurally invalid proposals are rejected", async () => {
  const validate = await compileSchema();
  const valid = (await readExample("extract_facts.sample.json")) as Record<string, unknown>;

  const bad: Array<[string, unknown]> = [
    ["empty items", { ...valid, items: [] }],
    ["unknown workflow", { ...valid, workflow: "summarize_everything" }],
    ["wrong version", { ...valid, version: 2 }],
    [
      "fact item without source_ref (provenance mandatory)",
      {
        ...valid,
        items: [
          { statement: "x", observed_at: "2026-06-10T00:00:00Z", confidence: 0.5 },
        ],
      },
    ],
    [
      "confidence out of range",
      {
        ...valid,
        items: [
          {
            statement: "x",
            source_ref: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
            observed_at: "2026-06-10T00:00:00Z",
            confidence: 1.5,
          },
        ],
      },
    ],
    [
      "compose_output with two items (v1 allows exactly one)",
      {
        workflow: "compose_output",
        version: 1,
        proposed_at: "2026-06-10T00:00:00Z",
        items: [
          { title: "a", sources: ["x"], body: "" },
          { title: "b", sources: ["y"], body: "" },
        ],
      },
    ],
    [
      "output item with empty sources (must cite)",
      {
        workflow: "compose_output",
        version: 1,
        proposed_at: "2026-06-10T00:00:00Z",
        items: [{ title: "a", sources: [], body: "" }],
      },
    ],
  ];

  for (const [label, proposal] of bad) {
    assert.equal(validate(proposal), false, `expected rejection: ${label}`);
  }
});
