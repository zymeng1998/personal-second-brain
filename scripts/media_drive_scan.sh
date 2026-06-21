#!/usr/bin/env bash
#
# media_drive_scan.sh — Google Drive media → Second Brain transcript intake.
#
# Watches a Google Drive (Desktop / DriveFS) inbox folder for media files,
# prepares an EXTERNAL artifact store keyed by content hash, and — once a
# transcript exists — ingests the transcript TEXT into the Second Brain through
# the existing `@sb/media-intake` adapter. The core NEVER stores media binaries;
# the original media stays in Google Drive and is referenced only as an opaque
# secure_ref (its private locator never appears in notes, events, logs, or
# stdout).
#
# Fast, robust v1: a simple idempotent scanner, not a fragile FS watcher.
#
#   Drop media in DRIVE_MEDIA_INBOX  ->  scan  ->  artifact dir (by date+hash)
#     -> if visual-intake.json marks it visual_processed: SKIP (visual-only,
#        e.g. broker room-tour videos — no transcript, no ingest)
#     -> else if transcript.md present: ingest L0 (+ L1 with --review)
#     -> else: clear PENDING state with the exact next step.
#
# Per-file state the scanner distinguishes:
#   VISUAL_PROCESSED  visual-intake.json status=visual_processed AND its media_id
#                     matches the dir media_id (skip; complete). A missing/
#                     mismatched media_id warns and falls back (never silent skip).
#   INGESTED / OK     transcript.md present and captured via @sb/media-intake
#   PENDING           known media, no transcript yet (and not visual-only)
#   new/unprocessed   first sight of a media_id; artifact dir gets created
#
# Re-running is idempotent: an already-ingested (media_id + transcript + media
# pointer) is a no-op; a changed transcript or pointer for the same media_id
# fails closed inside media-intake (media_id_conflict). Visual-processed media is
# recognized purely by media_id + visual-intake.json, so an old room-tour video
# can sit in the Inbox indefinitely without re-triggering work.
#
# Usage:
#   scripts/media_drive_scan.sh [--once] [--dry-run] [--no-review]
#                               [--transcribe] [--notify] [--help]
#
# Inputs (environment):
#   DRIVE_MEDIA_INBOX        REQUIRED. Folder where media files are dropped,
#                            e.g. ~/Library/CloudStorage/GoogleDrive-<acct>/My Drive/PersonalSecondBrain/Media/Inbox
#   MEDIA_ARTIFACT_ROOT      Default: $HOME/PersonalSecondBrainMediaArtifacts
#   SECOND_BRAIN_WORKSPACE   Default: /Users/mengziyue/PersonalSecondBrain/PersonalSecondBrainWorkspace
#
# Flags:
#   --once         Scan the inbox once and exit (default; reserved for future loop mode).
#   --dry-run      Prepare artifact dirs + report, but never call media-intake.
#   --no-review    Ingest L0 only (default also seeds an L1 working note via --review).
#   --transcribe   If transcript.md is missing, run local whisper to produce it
#                  (opt-in; requires whisper + ffmpeg; downloads a model on first use).
#   --notify       Emit macOS notifications for start / finish / failure.
#   --help         Show this help.
#
# Security: the private Drive locator is passed to media-intake ONLY via
# --media-secref and is stored exclusively inside the workspace secure_refs.
# This script logs a non-reversible fingerprint (media_ref_fp), never the path.

set -u

# ---------------------------------------------------------------------------
# 0. PATH hardening (Automator / LaunchAgent run with a minimal PATH).
# ---------------------------------------------------------------------------
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.local/bin:$HOME/Library/Python/3.9/bin:$PATH"

# Resolve a tool to an absolute path: prefer PATH, then a list of candidates.
resolve_tool() {
  local name="$1"; shift
  local found
  found="$(command -v "$name" 2>/dev/null)" || true
  if [ -n "${found:-}" ] && [ -x "$found" ]; then printf '%s' "$found"; return 0; fi
  local cand
  for cand in "$@"; do
    if [ -x "$cand" ]; then printf '%s' "$cand"; return 0; fi
  done
  return 1
}

# ---------------------------------------------------------------------------
# 1. Defaults + flags.
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

MEDIA_ARTIFACT_ROOT="${MEDIA_ARTIFACT_ROOT:-$HOME/PersonalSecondBrainMediaArtifacts}"
SECOND_BRAIN_WORKSPACE="${SECOND_BRAIN_WORKSPACE:-/Users/mengziyue/PersonalSecondBrain/PersonalSecondBrainWorkspace}"
DRIVE_MEDIA_INBOX="${DRIVE_MEDIA_INBOX:-}"

DRY_RUN=0
REVIEW=1
TRANSCRIBE=0
NOTIFY=0

usage() { sed -n '2,60p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

while [ $# -gt 0 ]; do
  case "$1" in
    --once)       shift ;;                 # default; explicit for clarity
    --dry-run)    DRY_RUN=1; shift ;;
    --no-review)  REVIEW=0; shift ;;
    --review)     REVIEW=1; shift ;;
    --transcribe) TRANSCRIBE=1; shift ;;
    --notify)     NOTIFY=1; shift ;;
    -h|--help)    usage; exit 0 ;;
    *) printf 'media_drive_scan: unknown argument: %s\n' "$1" >&2; exit 2 ;;
  esac
done

# Supported media extensions (case-insensitive). Mirrors media-intake's binary set.
MEDIA_EXT_RE='\.(mov|mp4|m4v|m4a|wav|mp3|aac|flac|mkv|webm|avi|mpg|mpeg|wma|ogg|opus)$'

# ---------------------------------------------------------------------------
# 2. Logging (verbose -> file; only summaries to stdout). No private locators.
# ---------------------------------------------------------------------------
RUN_TS="$(date +%Y%m%dT%H%M%S)"
LOG_DIR="$MEDIA_ARTIFACT_ROOT/_logs"
mkdir -p "$LOG_DIR" 2>/dev/null || true
RUN_LOG="$LOG_DIR/scan-$RUN_TS.log"

log()  { printf '%s %s\n' "$(date +%H:%M:%S)" "$*" >> "$RUN_LOG"; }
say()  { printf '%s\n' "$*"; log "$*"; }
warn() { printf 'WARN: %s\n' "$*" >&2; log "WARN: $*"; }
err()  { printf 'ERROR: %s\n' "$*" >&2; log "ERROR: $*"; }

notify() {
  [ "$NOTIFY" -eq 1 ] || return 0
  local title="$1" msg="$2" osa
  osa="$(resolve_tool osascript /usr/bin/osascript)" || return 0
  # Escape double quotes for AppleScript.
  msg="${msg//\"/\\\"}"; title="${title//\"/\\\"}"
  "$osa" -e "display notification \"$msg\" with title \"$title\"" >/dev/null 2>&1 || true
}

# ---------------------------------------------------------------------------
# 3. Resolve required tools.
# ---------------------------------------------------------------------------
NODE_BIN="$(resolve_tool node /usr/local/bin/node /opt/homebrew/bin/node)" || {
  err "node not found. Install Node.js (>=18). Checked PATH, /usr/local/bin, /opt/homebrew/bin."; exit 1; }
PNPM_BIN="$(resolve_tool pnpm "$HOME/.local/bin/pnpm" /usr/local/bin/pnpm /opt/homebrew/bin/pnpm)" || {
  err "pnpm not found. Install pnpm (corepack enable). Checked PATH, ~/.local/bin, /usr/local/bin, /opt/homebrew/bin."; exit 1; }
SHASUM_BIN="$(resolve_tool shasum /usr/bin/shasum)" || {
  err "shasum not found (expected /usr/bin/shasum on macOS)."; exit 1; }

# ---------------------------------------------------------------------------
# 4. Validate inputs (fail closed with actionable messages).
# ---------------------------------------------------------------------------
if [ -z "$DRIVE_MEDIA_INBOX" ]; then
  err "DRIVE_MEDIA_INBOX is not set. Point it at your Google Drive media inbox, e.g.:"
  err "  export DRIVE_MEDIA_INBOX=\"\$HOME/Library/CloudStorage/GoogleDrive-<account>/My Drive/PersonalSecondBrain/Media/Inbox\""
  exit 1
fi
if [ ! -d "$DRIVE_MEDIA_INBOX" ]; then
  err "DRIVE_MEDIA_INBOX does not exist or is not a directory:"
  err "  $DRIVE_MEDIA_INBOX"
  err "Is Google Drive for Desktop installed and signed in? Create the folder in Drive, let it sync, then retry."
  exit 1
fi
if [ ! -d "$SECOND_BRAIN_WORKSPACE" ]; then
  err "SECOND_BRAIN_WORKSPACE does not exist: $SECOND_BRAIN_WORKSPACE"
  err "Run: cd \"$REPO_ROOT\" && SECOND_BRAIN_WORKSPACE=\"$SECOND_BRAIN_WORKSPACE\" pnpm init:workspace"
  exit 1
fi

mkdir -p "$MEDIA_ARTIFACT_ROOT/by-id" "$MEDIA_ARTIFACT_ROOT/by-name" || {
  err "cannot create artifact store under $MEDIA_ARTIFACT_ROOT"; exit 1; }

# ---------------------------------------------------------------------------
# 5. Helpers.
# ---------------------------------------------------------------------------

# media_id = first 16 lowercase hex chars of the file's sha256 content hash.
# This MUST match psb-media-transcriber's convention (hashing.py: sha256[:16])
# so the RunPod transcriber and this scanner resolve the SAME artifact dir for a
# given file. 16 hex also matches media-intake MEDIA_ID_PATTERN /^[A-Za-z0-9_-]{8,128}$/.
compute_media_id() {
  local file="$1" line
  line="$("$SHASUM_BIN" -a 256 -- "$file" 2>/dev/null)" || return 1
  printf '%s' "${line%% *}" | cut -c1-16
}

# Find the canonical artifact dir for a media_id (the unique data dir named
# media_id, excluding the by-id/by-name index symlinks). Empty if none yet.
find_canon_dir() {
  local media_id="$1"
  find "$MEDIA_ARTIFACT_ROOT" -maxdepth 4 -type d -name "$media_id" \
    -not -path "*/by-id/*" -not -path "*/by-name/*" 2>/dev/null | head -n1
}

# Non-reversible short fingerprint of a pointer for non-leaking logs.
pointer_fp() {
  printf '%s' "$1" | "$SHASUM_BIN" -a 256 2>/dev/null | cut -c1-16
}

# Optional local transcription (opt-in). Reads the media binary with EXTERNAL
# whisper (never the core), writes <canon>/transcript.md. Heavy: redirected to
# the per-media job.log with progress.
transcribe_media() {
  local media_file="$1" canon="$2" job_log="$3"
  local whisper ffmpeg base out_txt
  whisper="$(resolve_tool whisper "$HOME/Library/Python/3.9/bin/whisper")" || {
    warn "transcription requested but 'whisper' not found; leaving PENDING"; return 1; }
  ffmpeg="$(resolve_tool ffmpeg /usr/local/bin/ffmpeg /opt/homebrew/bin/ffmpeg)" || {
    warn "transcription requested but 'ffmpeg' not found; leaving PENDING"; return 1; }
  say "  transcribing (whisper) — this can take a while; progress in job.log"
  base="$(basename "$media_file")"; base="${base%.*}"
  {
    printf '\n=== transcribe %s ===\n' "$(date)"
    "$whisper" "$media_file" --model base --output_format txt \
      --output_dir "$canon" --verbose False 2>&1
  } >> "$job_log" 2>&1
  out_txt="$canon/$base.txt"
  if [ -f "$out_txt" ]; then
    mv -f "$out_txt" "$canon/transcript.md"
    say "  transcript produced: transcript.md"
    return 0
  fi
  warn "whisper finished but no transcript file was produced (see job.log); leaving PENDING"
  return 1
}

# ---------------------------------------------------------------------------
# 6. Scan.
# ---------------------------------------------------------------------------
cd "$REPO_ROOT"
say "media_drive_scan: scanning inbox"
# The inbox path (a real DriveFS path embeds the account email) is a private
# locator: never emit it to stdout OR the log. Show only a redacted marker.
say "  inbox     : [configured Drive folder — locator withheld]"
say "  artifacts : $MEDIA_ARTIFACT_ROOT"
say "  workspace : $SECOND_BRAIN_WORKSPACE"
say "  mode      : dry-run=$DRY_RUN review=$REVIEW transcribe=$TRANSCRIBE"
say "  log       : $RUN_LOG"
notify "Second Brain media scan" "Scanning Drive inbox…"

N_TOTAL=0; N_INGESTED=0; N_IDEMPOTENT=0; N_PENDING=0; N_FAILED=0; N_VISUAL=0

# Iterate media files safely (spaces / Unicode): NUL-delimited.
while IFS= read -r -d '' media_file; do
  base="$(basename "$media_file")"
  # Case-insensitive extension filter.
  shopt -s nocasematch 2>/dev/null || true
  [[ "$base" =~ $MEDIA_EXT_RE ]] || continue
  shopt -u nocasematch 2>/dev/null || true
  N_TOTAL=$((N_TOTAL + 1))

  media_id="$(compute_media_id "$media_file")" || { err "hash failed for a file (name withheld)"; N_FAILED=$((N_FAILED+1)); continue; }
  if ! printf '%s' "$media_id" | grep -Eq '^[A-Za-z0-9_-]{8,128}$'; then
    err "computed media_id is invalid for a file (name withheld); skipping"; N_FAILED=$((N_FAILED+1)); continue
  fi
  say "• ${base}  → media_id=${media_id}"

  # Canonical artifact dir: reuse if this hash was seen before (stable path),
  # else create under the current YYYY/MM (first-seen date).
  canon="$(find_canon_dir "$media_id")"
  if [ -z "$canon" ]; then
    yyyy="$(date +%Y)"; mm="$(date +%m)"
    canon="$MEDIA_ARTIFACT_ROOT/$yyyy/$mm/$media_id"
    mkdir -p "$canon" || { err "cannot create artifact dir for $media_id"; N_FAILED=$((N_FAILED+1)); continue; }
    log "  created canonical dir: $canon"
  else
    log "  reusing canonical dir: $canon"
  fi

  # Visual-only intake (broker room-tour videos, etc.). A marker SKIPS the file
  # ONLY when BOTH hold:
  #   (a) status == "visual_processed", AND
  #   (b) the marker's media_id EXACTLY equals this artifact dir's computed
  #       media_id (so a stray / copied / hand-edited marker can't suppress
  #       ingest for the wrong file).
  # A missing or mismatched media_id is NOT silently trusted: warn and fall back
  # to normal handling (which becomes PENDING for a room tour — a visible signal
  # that the marker is wrong, never a silent skip). No locator is read or printed
  # here; media_id is a content hash and building/unit are non-private labels.
  vi="$canon/visual-intake.json"
  if [ -f "$vi" ] && grep -Eq '"status"[[:space:]]*:[[:space:]]*"visual_processed"' "$vi"; then
    vi_mid="$(grep -Eo '"media_id"[[:space:]]*:[[:space:]]*"[^"]*"' "$vi" | head -1 | sed -E 's/.*"([^"]*)"$/\1/')"
    if [ -z "$vi_mid" ]; then
      warn "visual-intake.json (status=visual_processed) for $media_id has no media_id; NOT skipping (treating as unprocessed)"
    elif [ "$vi_mid" != "$media_id" ]; then
      warn "visual-intake.json media_id mismatch (marker=$vi_mid, dir=$media_id); NOT skipping (treating as unprocessed)"
    else
      N_VISUAL=$((N_VISUAL + 1))
      vi_kind="$(grep -Eo '"kind"[[:space:]]*:[[:space:]]*"[^"]*"' "$vi" | head -1 | sed -E 's/.*"([^"]*)"$/\1/')"
      vi_unit="$(grep -Eo '"unit"[[:space:]]*:[[:space:]]*"[^"]*"' "$vi" | head -1 | sed -E 's/.*"([^"]*)"$/\1/')"
      say "  VISUAL_PROCESSED (${vi_kind:-visual}${vi_unit:+, unit $vi_unit}) — skipped (visual-only; no transcript ingest)"
      continue
    fi
  fi

  job_log="$canon/job.log"
  : >> "$job_log"

  # Index symlinks (relative). canon always literally begins with
  # "$MEDIA_ARTIFACT_ROOT/", so plain string stripping is symlink-safe
  # (avoids cd/pwd resolving /var -> /private/var on macOS).
  rel="${canon#"$MEDIA_ARTIFACT_ROOT/"}"            # e.g. 2026/06/<media_id>
  ln -sfn "../$rel" "$MEDIA_ARTIFACT_ROOT/by-id/$media_id" 2>/dev/null || true
  # by-name browse symlink. Original filename preserved.
  ln -sfn "../$rel" "$MEDIA_ARTIFACT_ROOT/by-name/$base" 2>/dev/null || true

  # The private Drive locator (NEVER logged). Passed only to --media-secref.
  pointer="$media_file"
  fp="$(pointer_fp "$pointer")"

  # manifest.json — non-leaking provenance (no raw locator).
  size_bytes="$(/usr/bin/stat -f '%z' "$media_file" 2>/dev/null || echo 0)"
  sha_full="$("$SHASUM_BIN" -a 256 -- "$media_file" 2>/dev/null | cut -d' ' -f1)"
  cat > "$canon/manifest.json" <<JSON
{
  "media_id": "$media_id",
  "original_filename": $("$NODE_BIN" -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "$base"),
  "sha256": "$sha_full",
  "size_bytes": $size_bytes,
  "source": "google_drive_desktop",
  "media_ref_class_hint": "local_private_path",
  "media_ref_fp": "$fp",
  "first_seen": "$RUN_TS",
  "transcript_present": $( [ -s "$canon/transcript.md" ] && echo true || echo false )
}
JSON

  # Need a transcript before we can ingest.
  if [ ! -s "$canon/transcript.md" ]; then
    if [ "$TRANSCRIBE" -eq 1 ] && [ "$DRY_RUN" -eq 0 ]; then
      transcribe_media "$media_file" "$canon" "$job_log" || true
    fi
  fi

  if [ ! -s "$canon/transcript.md" ]; then
    N_PENDING=$((N_PENDING + 1))
    say "  PENDING (no transcript). Next step:"
    say "    1) Place the transcript text at:"
    say "         $canon/transcript.md"
    say "       (or re-run with --transcribe to generate it locally via whisper)"
    say "    2) Re-run this scanner; it will ingest automatically."
    continue
  fi

  if [ "$DRY_RUN" -eq 1 ]; then
    say "  DRY-RUN: transcript present; would ingest (media_ref_fp=$fp)"
    continue
  fi

  # Ingest via the existing adapter. Private locator → opaque secure_ref.
  say "  ingesting via @sb/media-intake (media_ref_fp=$fp)…"
  ingest_out="$canon/.ingest.out"
  ingest_err="$canon/.ingest.err"
  # media-intake writes the success envelope to stdout and any error envelope to
  # stderr; BOTH are locator-free by construction. Keep them separate so a
  # failure reason (e.g. media_id_conflict) can be surfaced, then archive both
  # into job.log.
  if [ "$REVIEW" -eq 1 ]; then
    "$PNPM_BIN" --filter @sb/media-intake start -- ingest \
      --artifact-dir "$canon" \
      --media-secref "$pointer" \
      --review \
      --workspace "$SECOND_BRAIN_WORKSPACE" > "$ingest_out" 2> "$ingest_err"
  else
    "$PNPM_BIN" --filter @sb/media-intake start -- ingest \
      --artifact-dir "$canon" \
      --media-secref "$pointer" \
      --workspace "$SECOND_BRAIN_WORKSPACE" > "$ingest_out" 2> "$ingest_err"
  fi
  rc=$?
  { printf '\n=== ingest %s (rc=%s) ===\n' "$(date)" "$rc"; cat "$ingest_out" "$ingest_err"; } >> "$job_log" 2>/dev/null || true

  # The envelope is locator-free by construction; surface only the summary line.
  envelope="$(grep '{"ok":true' "$ingest_out" 2>/dev/null | tail -n1)"
  if [ "$rc" -ne 0 ] || [ -z "$envelope" ]; then
    N_FAILED=$((N_FAILED + 1))
    # Failure envelope (locator-free) lands on stderr.
    fail_env="$(grep '{"ok":false' "$ingest_err" "$ingest_out" 2>/dev/null | sed 's/^[^{]*//' | tail -n1)"
    err "ingest failed for media_id=$media_id ${fail_env:+→ $fail_env}"
    err "  see $job_log"
    cp "$ingest_err" "$canon/last_ingest_error.json" 2>/dev/null || true
    continue
  fi

  cp "$ingest_out" "$canon/last_ingest.json" 2>/dev/null || true
  case "$envelope" in
    *'"idempotent":true'*)
      N_IDEMPOTENT=$((N_IDEMPOTENT + 1))
      say "  OK (idempotent no-op): $envelope" ;;
    *)
      N_INGESTED=$((N_INGESTED + 1))
      say "  OK (ingested): $envelope" ;;
  esac
done < <(find "$DRIVE_MEDIA_INBOX" -maxdepth 1 -type f -print0 2>/dev/null)

# ---------------------------------------------------------------------------
# 7. Summary.
# ---------------------------------------------------------------------------
say "media_drive_scan: done — media=$N_TOTAL ingested=$N_INGESTED idempotent=$N_IDEMPOTENT visual=$N_VISUAL pending=$N_PENDING failed=$N_FAILED"
if [ "$N_FAILED" -gt 0 ]; then
  notify "Second Brain media scan" "Finished with $N_FAILED failure(s). See logs."
  exit 1
fi
notify "Second Brain media scan" "Done: ${N_INGESTED} ingested, ${N_VISUAL} visual, ${N_PENDING} pending."
exit 0
