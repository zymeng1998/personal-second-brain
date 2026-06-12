/**
 * `obsidian-helper check` (SB-079) — READ-ONLY Obsidian-compat report.
 *
 * All NOTE CONTENT is read through the enforced dispatch (`note list` +
 * `note get` under `surface:obsidian-helper`) — never via direct vault file
 * reads, honoring the boundary guardrail. Diagnostics here are structural
 * (frontmatter fence + required keys, dangling `[[wikilinks]]`, expected
 * folder presence); full Ajv schema depth stays with `pnpm validate:notes`.
 * Folder presence uses direct read-only `existsSync` on directory paths —
 * directory structure is not note data and has no core operation.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { invoke } from "./invoke.js";

/** The Obsidian/PARA layout the vault documents (obsidian_compatibility.md). */
export const EXPECTED_VAULT_FOLDERS = [
  "00_Raw",
  "00_Inbox",
  "10_Projects",
  "50_Entities",
  "60_Outputs",
  "70_Daily",
  "80_Wiki",
  "90_System",
] as const;

const REQUIRED_FRONTMATTER_KEYS = ["id", "type", "layer", "created"] as const;

export interface FrontmatterFinding {
  id: string;
  reason: string;
}

export interface WikilinkFinding {
  id: string;
  target: string;
}

export interface CheckReport {
  ok: boolean;
  workspace: string;
  notes: number;
  findings: {
    frontmatter: FrontmatterFinding[];
    wikilinks: WikilinkFinding[];
    missing_folders: string[];
  };
}

export class CheckError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "CheckError";
    this.code = code;
  }
}

interface ListedNote {
  id: string;
  title: string;
}

function parseNoteList(stdout: string): ListedNote[] {
  return stdout
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const [id = "", , title = ""] = line.split("\t");
      return { id, title };
    })
    .filter((note) => note.id.length > 0);
}

/** Structural frontmatter diagnostic over dispatch-read content. */
function frontmatterReason(content: string): string | undefined {
  if (!content.startsWith("---\n") && content.trim() !== "---") return "missing frontmatter fence";
  const end = content.indexOf("\n---", 3);
  if (end === -1) return "unterminated frontmatter fence";
  const block = content.slice(4, end);
  for (const key of REQUIRED_FRONTMATTER_KEYS) {
    if (!new RegExp(`^${key}:`, "m").test(block)) return `missing required key: ${key}`;
  }
  return undefined;
}

/** `[[target]]` occurrences in the body (alias `|` and heading `#` forms normalized). */
function wikilinkTargets(content: string): string[] {
  const end = content.startsWith("---\n") ? content.indexOf("\n---", 3) : -1;
  const body = end === -1 ? content : content.slice(end + 4);
  const targets: string[] = [];
  for (const match of body.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const raw = (match[1] ?? "").split("|")[0]?.split("#")[0]?.trim() ?? "";
    if (raw.length > 0) targets.push(raw);
  }
  return targets;
}

export async function runCheck(workspace: string): Promise<CheckReport> {
  const list = await invoke(["note", "list", "--workspace", workspace]);
  if (list.exitCode !== 0) {
    throw new CheckError("check_failed", `note list failed: ${list.stderr.trim()}`);
  }
  const notes = parseNoteList(list.stdout);
  const knownTargets = new Set<string>();
  for (const note of notes) {
    knownTargets.add(note.id);
    if (note.title.length > 0) knownTargets.add(note.title);
  }

  const frontmatter: FrontmatterFinding[] = [];
  const wikilinks: WikilinkFinding[] = [];
  for (const note of notes) {
    const got = await invoke(["note", "get", note.id, "--workspace", workspace]);
    if (got.exitCode !== 0) {
      frontmatter.push({ id: note.id, reason: "unreadable via note get" });
      continue;
    }
    const reason = frontmatterReason(got.stdout);
    if (reason !== undefined) frontmatter.push({ id: note.id, reason });
    for (const target of wikilinkTargets(got.stdout)) {
      if (!knownTargets.has(target)) wikilinks.push({ id: note.id, target });
    }
  }

  const missingFolders = EXPECTED_VAULT_FOLDERS.filter(
    (folder) => !existsSync(join(workspace, "vault", folder)),
  );

  return {
    ok: frontmatter.length === 0 && wikilinks.length === 0 && missingFolders.length === 0,
    workspace,
    notes: notes.length,
    findings: {
      frontmatter,
      wikilinks,
      missing_folders: [...missingFolders],
    },
  };
}
