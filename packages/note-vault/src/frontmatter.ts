/**
 * Shared YAML-frontmatter parsing (SB-044). The single implementation behind
 * every full-frontmatter consumer (projections, validators) — the Phase 1/2
 * reviews flagged this logic as duplicated across packages.
 *
 * Not used by `read-notes.ts`: its line-based field extractor is a deliberate
 * SB-015 design choice (verbatim reads, targeted fields), not a frontmatter
 * parser.
 */
import { parse as parseYaml } from "yaml";

export type FrontmatterParseResult =
  | { ok: true; frontmatter: Record<string, unknown>; body: string }
  | { ok: false; reason: string };

/**
 * Parse a note's leading `---` YAML frontmatter block with diagnostics.
 * `frontmatter` is the parsed mapping; `body` is the content after the closing
 * delimiter. Fails (with a human-readable `reason`) when the block is missing,
 * unterminated, not a YAML mapping, or invalid YAML.
 */
export function parseFrontmatter(content: string): FrontmatterParseResult {
  if (!content.startsWith("---\n")) {
    return { ok: false, reason: "missing frontmatter block (file must start with '---')" };
  }
  const end = content.indexOf("\n---", 4);
  if (end === -1) {
    return { ok: false, reason: "unterminated frontmatter block (no closing '---')" };
  }
  const block = content.slice(4, end);
  let data: unknown;
  try {
    data = parseYaml(block);
  } catch (err) {
    return { ok: false, reason: `YAML parse error: ${err instanceof Error ? err.message : String(err)}` };
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, reason: "frontmatter is empty or not a YAML mapping" };
  }
  const body = content.slice(end + 4).replace(/^\n/, "");
  return { ok: true, frontmatter: data as Record<string, unknown>, body };
}

/**
 * Lenient view for projections: the frontmatter mapping, or `{}` when the note
 * has no parseable frontmatter.
 */
export function frontmatterOf(content: string): Record<string, unknown> {
  const parsed = parseFrontmatter(content);
  return parsed.ok ? parsed.frontmatter : {};
}
