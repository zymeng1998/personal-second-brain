/**
 * `obsidian-helper capture --file <draft.md>` (SB-080) — the draft→capture
 * bridge. The human writes a draft in Obsidian (or anywhere); the helper
 * routes it through the ENFORCED capture operation (one L0 raw note + one
 * capture event, under `surface:obsidian-helper`). The draft file itself is
 * never modified or deleted — the human decides its fate. Obsidian stays
 * never-the-writer-of-record.
 *
 * If the draft has a frontmatter block, `title:` and inline `tags:` are
 * lifted into capture metadata and the BODY (sans frontmatter) is captured;
 * otherwise the whole file is captured verbatim.
 */
import { readFile } from "node:fs/promises";
import { invoke } from "./invoke.js";

export class BridgeError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "BridgeError";
    this.code = code;
  }
}

interface DraftParts {
  body: string;
  title?: string;
  tags: string[];
}

/** Line-based lift (mirrors the read-notes field extractor philosophy). */
export function splitDraft(content: string): DraftParts {
  if (!content.startsWith("---\n")) return { body: content, tags: [] };
  const end = content.indexOf("\n---", 3);
  if (end === -1) return { body: content, tags: [] };
  const block = content.slice(4, end);
  const afterFence = content.indexOf("\n", end + 4);
  const body = afterFence === -1 ? "" : content.slice(afterFence + 1);

  const parts: DraftParts = { body, tags: [] };
  const titleMatch = /^title:\s*(.+)\s*$/m.exec(block);
  if (titleMatch?.[1] !== undefined) {
    parts.title = titleMatch[1].trim().replace(/^["']|["']$/g, "");
  }
  // inline forms only: `tags: [a, b]` or `tags: a, b` (block lists stay with the human)
  const tagsMatch = /^tags:\s*(?:\[([^\]]*)\]|([^\n[]+))\s*$/m.exec(block);
  const rawTags = tagsMatch?.[1] ?? tagsMatch?.[2];
  if (rawTags !== undefined) {
    parts.tags = rawTags
      .split(",")
      .map((t) => t.trim().replace(/^["']|["']$/g, ""))
      .filter((t) => t.length > 0);
  }
  return parts;
}

export interface BridgeResult {
  draft: string;
  capture: unknown;
}

export async function runCaptureFile(filePath: string, workspace: string): Promise<BridgeResult> {
  let content: string;
  try {
    content = await readFile(filePath, "utf8");
  } catch (error: unknown) {
    throw new BridgeError(
      "draft_unreadable",
      `cannot read draft: ${filePath} (${(error as NodeJS.ErrnoException)?.code ?? "error"})`,
    );
  }
  const draft = splitDraft(content);
  if (draft.body.trim().length === 0) {
    throw new BridgeError("empty_draft", `draft has no body content: ${filePath}`);
  }

  const argv = ["capture", "--content", draft.body, "--source", "import"];
  if (draft.title !== undefined) argv.push("--title", draft.title);
  if (draft.tags.length > 0) argv.push("--tag", draft.tags.join(","));
  argv.push("--workspace", workspace);

  const result = await invoke(argv);
  if (result.exitCode !== 0) {
    // pass the structured envelope through untouched (e.g. scope_denied)
    throw new BridgeError("capture_failed", result.stderr.trim());
  }
  return { draft: filePath, capture: JSON.parse(result.stdout) as unknown };
}
