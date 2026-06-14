/**
 * SB-093 — showing-match summary (broker, READ-ONLY).
 *
 * Reads the client-preference facts (`fact list`, read:facts) + any captured
 * property notes (`note list` / `note get`, read:notes) and produces a ranked
 * match summary. It writes NOTHING — no new grant scope beyond the v1 read set,
 * gate-independent. Property media is referenced by `media_id` only (consumer
 * of apps/media-intake, OQ #46); the broker stores no media binaries.
 *
 * Matching is deterministic: a property is scored by how many "signal" tokens
 * its note shares with the client's preference statements (ties broken by note
 * id), so the summary is reproducible and Node-only (no sidecar).
 */
import { invoke } from "./index.js";

/** Generic tag a human uses when capturing a property note; the broker only READS these. */
export const PROPERTY_NOTE_TAG = "property-note";

const STOPWORDS = new Set([
  "the", "and", "for", "with", "near", "around", "about", "wants", "needs", "prefers",
  "client", "month", "per", "from", "into", "this", "that", "have", "has", "are", "not",
]);

export interface PropertyMatch {
  note_id: string;
  title: string;
  score: number;
  /** The shared signal tokens that drove the score (sorted, for an auditable summary). */
  overlap: string[];
}

export interface MatchResult {
  client: string;
  /** The client's preference statements (generic L3 facts mentioning the client label). */
  preferences: string[];
  /** Candidate property notes, ranked by overlap score (desc), ties by note id (asc). */
  matches: PropertyMatch[];
}

/** Lowercase signal tokens (len ≥ 3, not a stopword, not the client label). */
function tokenize(text: string, clientTokens: ReadonlySet<string>): Set<string> {
  const tokens = new Set<string>();
  for (const raw of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length < 3 || STOPWORDS.has(raw) || clientTokens.has(raw)) continue;
    tokens.add(raw);
  }
  return tokens;
}

/** Parse `note list` rows (`id\ttype\ttitle`). */
function parseNoteRows(stdout: string): Array<{ id: string; title: string }> {
  const rows: Array<{ id: string; title: string }> = [];
  for (const line of stdout.split("\n")) {
    if (line.trim().length === 0) continue;
    const [id, , ...titleParts] = line.split("\t");
    if (id && id.length > 0) rows.push({ id, title: (titleParts.join("\t") ?? "").trim() });
  }
  return rows;
}

/**
 * Build a ranked showing-match summary for a client (read-only). `client` is a
 * label substring that identifies the client's preference facts/notes
 * (e.g. "Client A"). Throws only on a failed read; never writes.
 */
export async function matchClient(workspace: string, client: string): Promise<MatchResult> {
  if (typeof client !== "string" || client.trim().length === 0) {
    throw new Error("matchClient requires a non-empty client label");
  }
  const clientTokens = tokenize(client, new Set());

  // 1. Client preferences = current facts whose statement mentions the client label.
  const factList = await invoke(["fact", "list", "--workspace", workspace]);
  if (factList.exitCode !== 0) throw new Error(`fact list failed: ${factList.stderr.trim()}`);
  const needle = client.toLowerCase();
  const factEnvelope = JSON.parse(factList.stdout) as { facts?: Array<{ statement?: string }> };
  const preferences = (factEnvelope.facts ?? [])
    .map((f) => (typeof f.statement === "string" ? f.statement : ""))
    .filter((s) => s.length > 0 && s.toLowerCase().includes(needle));
  const prefTokens = tokenize(preferences.join(" "), clientTokens);

  // 2. Candidate properties = captured notes tagged PROPERTY_NOTE_TAG.
  const noteList = await invoke(["note", "list", "--workspace", workspace]);
  if (noteList.exitCode !== 0) throw new Error(`note list failed: ${noteList.stderr.trim()}`);

  const matches: PropertyMatch[] = [];
  for (const { id, title } of parseNoteRows(noteList.stdout)) {
    const got = await invoke(["note", "get", id, "--workspace", workspace]);
    if (got.exitCode !== 0) continue;
    if (!got.stdout.includes(PROPERTY_NOTE_TAG)) continue;
    const propTokens = tokenize(got.stdout, clientTokens);
    const overlap = [...prefTokens].filter((t) => propTokens.has(t)).sort();
    matches.push({ note_id: id, title, score: overlap.length, overlap });
  }
  matches.sort((a, b) => (b.score - a.score) || (a.note_id < b.note_id ? -1 : 1));

  return { client, preferences, matches };
}

/** Render a match result as a human-readable, leak-free summary for stdout. */
export function renderMatchSummary(result: MatchResult): string {
  const lines: string[] = [];
  lines.push(`Match summary for ${result.client}`);
  lines.push(`Preferences (${result.preferences.length}):`);
  for (const p of result.preferences) lines.push(`  - ${p}`);
  lines.push(`Ranked properties (${result.matches.length}):`);
  result.matches.forEach((m, i) => {
    const overlap = m.overlap.length > 0 ? ` (overlap: ${m.overlap.join(", ")})` : "";
    lines.push(`  ${i + 1}. [${m.note_id}] ${m.title} — score ${m.score}${overlap}`);
  });
  return lines.join("\n");
}
