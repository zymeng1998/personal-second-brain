/**
 * `.srt` / `.vtt` → prose normalization (SB-088, deferrable; OQ #36).
 *
 * Strips cue indices, `HH:MM:SS,mmm --> …` timestamp lines, VTT headers
 * (WEBVTT / NOTE / STYLE / REGION), cue identifiers, and inline tags
 * (`<v Speaker>`, `<i>`, …) so the captured L0 body is clean prose. Per the
 * guardrail, timestamps are NOT preserved in the note body. Malformed input
 * (no timestamps, or no extractable text) fails closed — nothing is captured.
 */
export class NormalizeError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "NormalizeError";
    this.code = code;
  }
}

export type TimedFormat = "srt" | "vtt";

const HEADER_RE = /^(WEBVTT|NOTE|STYLE|REGION)\b/;

function stripInline(line: string): string {
  return line
    .replace(/<[^>]*>/g, "") // cue tags: <v Speaker>, <i>, <00:00:01.000> …
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

/** Normalize a timed-caption transcript to prose (one line per cue, no timestamps). */
export function normalizeTimedTranscript(text: string, format: TimedFormat): string {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n\s*\n/);
  const prose: string[] = [];
  let sawTimestamp = false;

  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.replace(/\s+$/, ""));
    if (lines.length === 0) continue;
    if (HEADER_RE.test(lines[0]?.trim() ?? "")) continue; // drop header / NOTE / STYLE / REGION blocks

    const tsIdx = lines.findIndex((l) => l.includes("-->"));
    if (tsIdx === -1) continue; // not a cue (stray block / header remnant)
    sawTimestamp = true;

    // everything BEFORE the timestamp is a cue index/id (srt number, vtt id) → drop it;
    // everything AFTER is the cue text.
    const cueText = lines
      .slice(tsIdx + 1)
      .map(stripInline)
      .filter((l) => l.length > 0)
      .join(" ");
    if (cueText.length > 0) prose.push(cueText);
  }

  if (!sawTimestamp) {
    throw new NormalizeError("not_timed", `not a valid ${format} transcript (no timestamps found)`);
  }
  if (prose.length === 0) {
    throw new NormalizeError("empty", `${format} transcript has no caption text`);
  }
  return `${prose.join("\n")}\n`;
}
