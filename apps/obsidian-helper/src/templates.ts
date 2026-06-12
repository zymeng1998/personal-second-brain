/**
 * `obsidian-helper templates install` (SB-080) — domain-neutral Obsidian
 * template scaffolds into `vault/90_System/templates/`.
 *
 * Templates are BODY-ONLY scaffolding (plus an HTML comment header): they
 * carry no frontmatter, because frontmatter (id/type/layer/created) is
 * core-owned and created only by the confirmed core operations — copying a
 * template must never smuggle a stale id or fake provenance into a note.
 * The note-enumeration and validation layers exclude this folder (system
 * assets, not notes).
 *
 * Writes are EXCLUSIVE-CREATE into this one fixed folder and nowhere else:
 * an existing file is never overwritten — it is skipped and reported. This
 * is the helper's only direct vault write surface; all note/data writes go
 * through the enforced capture op.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const HEADER = (purpose: string): string =>
  `<!-- Second Brain Obsidian template — ${purpose}.\n     Body scaffolding only: real notes get their frontmatter from the core\n     (capture / sb note promote). Route finished drafts through\n     \`obsidian-helper capture --file <draft.md>\`. -->\n`;

export const TEMPLATE_FILES: ReadonlyArray<{ name: string; content: string }> = Object.freeze([
  {
    name: "working-note.md",
    content: `${HEADER("L1 working note scaffold")}# {{title}}

## Context

## Notes

## Open questions

- [ ]
`,
  },
  {
    name: "daily-note.md",
    content: `${HEADER("daily note scaffold")}# {{date:YYYY-MM-DD}}

## Log

## Captured today

## Review

- [ ]
`,
  },
  {
    name: "entity-stub.md",
    content: `${HEADER("entity stub scaffold")}# {{title}}

## Overview

## Related

- [[ ]]

## Facts

`,
  },
]);

export const TEMPLATES_RELATIVE_DIR = join("vault", "90_System", "templates");

export interface TemplatesInstallReport {
  ok: true;
  dir: string;
  installed: string[];
  skipped: string[];
}

export async function runTemplatesInstall(workspace: string): Promise<TemplatesInstallReport> {
  const dir = join(workspace, TEMPLATES_RELATIVE_DIR);
  await mkdir(dir, { recursive: true });
  const installed: string[] = [];
  const skipped: string[] = [];
  for (const template of TEMPLATE_FILES) {
    try {
      await writeFile(join(dir, template.name), template.content, { flag: "wx" });
      installed.push(template.name);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException)?.code !== "EEXIST") throw error;
      skipped.push(template.name); // never overwritten
    }
  }
  return { ok: true, dir, installed, skipped };
}
