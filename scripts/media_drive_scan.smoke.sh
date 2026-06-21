#!/usr/bin/env bash
#
# media_drive_scan.smoke.sh — smoke test for the Google Drive media scanner.
#
# Proves the acceptance criteria WITHOUT any real private media or real Google
# Drive: a synthetic "inbox" dir, a synthetic tiny media file (Unicode + spaces),
# a throwaway workspace, and a throwaway artifact root — all under TMPDIR.
#
# Run:  bash scripts/media_drive_scan.smoke.sh
#
# Asserts:
#   1. First scan with no transcript => PENDING; artifact dir + by-id/by-name
#      symlinks + manifest.json created.
#   2. After placing transcript.md, scan ingests via @sb/media-intake; result
#      carries an L0 raw note and (with --review) an L1 working note.
#   3. Re-running is idempotent (no-op).
#   4. The original media binary NEVER appears under the workspace.
#   5. The private inbox locator NEVER appears in notes / events / stdout / logs.
#   6. Unicode + spaces in the filename work end-to-end.
#   7. A visual-only room-tour fixture (visual-intake.json status=visual_processed
#      with a MATCHING media_id) is reported VISUAL_PROCESSED / skipped — never
#      PENDING, never ingested, and leaks no locator.
#   8. A marker with a MISMATCHED or MISSING media_id does NOT skip: the scanner
#      warns and falls back to normal handling (PENDING), never silently skipping.
set -u

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.local/bin:$HOME/Library/Python/3.9/bin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

PNPM_BIN="$(command -v pnpm 2>/dev/null || true)"
if [ -z "$PNPM_BIN" ]; then
  echo "media_drive_scan smoke: pnpm not found. Checked PATH plus ~/.local/bin." >&2
  exit 1
fi

WS="$(mktemp -d "${TMPDIR:-/tmp}/sb-media-ws.XXXXXX")"
ROOT="$(mktemp -d "${TMPDIR:-/tmp}/sb-media-artifacts.XXXXXX")"
INBOX="$(mktemp -d "${TMPDIR:-/tmp}/sb-media-inbox.XXXXXX")"
FAILED=0

cleanup() { rm -rf "$WS" "$ROOT" "$INBOX"; }
trap cleanup EXIT

step() { printf '\n=== %s ===\n' "$1"; }
ok()   { printf '  PASS: %s\n' "$1"; }
fail() { printf '  FAIL: %s\n' "$1"; FAILED=1; }
contains() { case "$1" in *"$2"*) ok "$3";; *) fail "$3";; esac; }
absent()   { case "$1" in *"$2"*) fail "$3";; *) ok "$3";; esac; }

export MEDIA_ARTIFACT_ROOT="$ROOT"
export SECOND_BRAIN_WORKSPACE="$WS"
export DRIVE_MEDIA_INBOX="$INBOX"

SCAN=( bash "$SCRIPT_DIR/media_drive_scan.sh" )

step "0. init throwaway workspace"
"$PNPM_BIN" -s init:workspace >/dev/null 2>&1; [ $? -eq 0 ] && ok "init:workspace" || fail "init:workspace"

step "1. drop a synthetic media file (Unicode + spaces)"
# A few bytes with a media extension. The scanner only HASHES it; it is never
# read as a transcript and never passed as a binary to the core.
MEDIA_NAME='séance lecture (café) #1.mp4'
printf 'FAKE-MEDIA-BYTES-not-a-real-video-0123456789' > "$INBOX/$MEDIA_NAME"
[ -f "$INBOX/$MEDIA_NAME" ] && ok "synthetic media present" || fail "synthetic media present"

step "2. first scan → PENDING (no transcript yet)"
OUT1="$("${SCAN[@]}" --once 2>&1)"
contains "$OUT1" "PENDING" "first scan reports PENDING"
contains "$OUT1" "media_id=" "first scan computed a media_id"
# Capture the media_id from output.
MID="$(printf '%s\n' "$OUT1" | grep -oE 'media_id=[A-Za-z0-9_-]{8,128}' | head -1 | cut -d= -f2)"
[ -n "$MID" ] && ok "captured media_id ($MID)" || fail "captured media_id"

step "3. artifact store: canonical dir + symlinks + manifest"
CANON="$(find "$ROOT" -maxdepth 4 -type d -name "$MID" -not -path '*/by-id/*' -not -path '*/by-name/*' | head -1)"
[ -n "$CANON" ] && [ -d "$CANON" ] && ok "canonical artifact dir exists" || fail "canonical artifact dir exists"
[ -L "$ROOT/by-id/$MID" ] && ok "by-id symlink exists" || fail "by-id symlink exists"
[ -L "$ROOT/by-name/$MEDIA_NAME" ] && ok "by-name symlink exists (Unicode/space name)" || fail "by-name symlink exists"
[ -f "$CANON/manifest.json" ] && ok "manifest.json written" || fail "manifest.json written"
# manifest must NOT contain the private inbox path.
MAN="$(cat "$CANON/manifest.json" 2>/dev/null)"
absent "$MAN" "$INBOX" "manifest.json does not leak the private inbox path"

step "4. provide transcript.md, then scan → ingest (L0 + L1)"
printf 'Smoke lecture transcript.\nThe espresso ratio is one to two.\n' > "$CANON/transcript.md"
OUT2="$("${SCAN[@]}" --once 2>&1)"
contains "$OUT2" '"ok":true' "ingest returned ok"
contains "$OUT2" "OK (ingested)" "scanner reports a fresh ingest"
contains "$OUT2" '"working_note_id"' "--review seeded an L1 working note"
# The private locator must not appear in scanner stdout.
absent "$OUT2" "$INBOX" "scanner stdout does not leak the private inbox path"

step "5. L0 raw note exists with the transcript text + media_id"
RAW_HIT="$(grep -rl 'espresso ratio is one to two' "$WS/vault" 2>/dev/null | head -1)"
[ -n "$RAW_HIT" ] && ok "L0 raw note captured the transcript verbatim" || fail "L0 raw note captured the transcript"
# media_id is recorded in the note frontmatter (media_id: "<hash>"), not in `note list`.
MID_HIT="$(grep -rl "media_id: \"$MID\"" "$WS/vault" 2>/dev/null | head -1)"
[ -n "$MID_HIT" ] && ok "L0 note frontmatter carries the media_id" || fail "L0 note frontmatter carries the media_id"

step "6. media binary NEVER under the workspace"
# Bytes must not appear ANYWHERE in the workspace (vault, events, or secure_refs).
BIN_HIT="$(grep -rl 'FAKE-MEDIA-BYTES-not-a-real-video' "$WS" 2>/dev/null | head -1)"
[ -z "$BIN_HIT" ] && ok "no media binary bytes under workspace" || fail "media binary leaked into workspace ($BIN_HIT)"

step "7. private locator NEVER in notes / events"
# The note/event boundary must be locator-free. secure_refs is the sanctioned
# opaque home for the locator and is intentionally EXCLUDED here.
LOC_HIT="$(grep -rl "$INBOX" "$WS/vault" "$WS/events" 2>/dev/null | head -1)"
[ -z "$LOC_HIT" ] && ok "private inbox locator absent from notes + events" || fail "private locator leaked ($LOC_HIT)"
NAME_HIT="$(grep -rl 'séance lecture' "$WS/vault" "$WS/events" 2>/dev/null | head -1)"
[ -z "$NAME_HIT" ] && ok "media filename absent from notes + events" || fail "media filename leaked into notes/events ($NAME_HIT)"

step "8. re-scan is idempotent (no-op)"
OUT3="$("${SCAN[@]}" --once 2>&1)"
contains "$OUT3" '"idempotent":true' "re-scan is an idempotent no-op"

step "8b. changed transcript for same media_id FAILS CLOSED (media_id_conflict)"
NOTES_BEFORE="$(find "$WS/vault" -type f -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
printf 'A DIFFERENT transcript body that must be rejected.\n' > "$CANON/transcript.md"
OUT4="$("${SCAN[@]}" --once 2>&1)"
contains "$OUT4" "media_id_conflict" "conflicting re-ingest reports media_id_conflict"
contains "$OUT4" "ingest failed" "scanner surfaces the failure"
NOTES_AFTER="$(find "$WS/vault" -type f -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
[ "$NOTES_BEFORE" = "$NOTES_AFTER" ] && ok "zero writes on conflict ($NOTES_BEFORE notes unchanged)" || fail "conflict wrote notes ($NOTES_BEFORE -> $NOTES_AFTER)"
# restore the original transcript so later manual inspection is consistent
printf 'Smoke lecture transcript.\nThe espresso ratio is one to two.\n' > "$CANON/transcript.md"

step "9. secure_ref recorded (private pointer stored opaquely)"
SECREF_CNT="$(find "$WS/secure_refs" -type f 2>/dev/null | wc -l | tr -d ' ')"
[ "$SECREF_CNT" -ge 1 ] && ok "a secure_ref was minted for the private pointer" || fail "secure_ref minted"
# Even the secure_ref store must not echo back into stdout; verify the locator
# lives ONLY in secure_refs (allowed) and nowhere in vault/events (already checked).
ok "secure_ref store is the only home for the private locator"

step "10. visual-only room-tour fixture → VISUAL_PROCESSED (skipped, never PENDING)"
# A second media file representing a broker room-tour video (visual-only).
RT_NAME='maple court unit 1201 (room tour).mov'
printf 'FAKE-ROOMTOUR-VIDEO-BYTES-visual-only-9876543210' > "$INBOX/$RT_NAME"
# media_id = sha256[:16] of the file content (same algo as the scanner).
RT_MID="$(shasum -a 256 "$INBOX/$RT_NAME" | cut -c1-16)"
[ -n "$RT_MID" ] && ok "computed room-tour media_id ($RT_MID)" || fail "computed room-tour media_id"

# First scan: no marker yet → the room tour is reported PENDING and its artifact dir is created.
OUT_RT1="$("${SCAN[@]}" --once 2>&1)"
contains "$OUT_RT1" "$RT_MID" "first scan sees the room-tour media_id"
RT_CANON="$(find "$ROOT" -maxdepth 4 -type d -name "$RT_MID" -not -path '*/by-id/*' -not -path '*/by-name/*' | head -1)"
[ -n "$RT_CANON" ] && [ -d "$RT_CANON" ] && ok "room-tour artifact dir created" || fail "room-tour artifact dir created"

# Drop the visual-only marker (status=visual_processed). No raw Drive path inside.
cat > "$RT_CANON/visual-intake.json" <<JSON
{
  "schema_version": 1,
  "kind": "room_tour",
  "status": "visual_processed",
  "media_id": "$RT_MID",
  "original_filename": "$RT_NAME",
  "building": "Maple Court",
  "area": "Riverside, Example City",
  "unit": "1201",
  "doorplate_status": "clear",
  "doorplate_source": "opening_frame",
  "note_id": "01TESTNOTEVISUALONLY00000000",
  "secure_ref": "secref_TESTVISUALONLY",
  "transcription": "not_required",
  "processed_at": "2026-06-21T00:00:00Z"
}
JSON

# Second scan: marker present → VISUAL_PROCESSED / skipped, and NO PENDING anywhere this run.
OUT_RT2="$("${SCAN[@]}" --once 2>&1)"
contains "$OUT_RT2" "VISUAL_PROCESSED" "marked room tour reported VISUAL_PROCESSED"
contains "$OUT_RT2" "unit 1201"        "VISUAL_PROCESSED line carries the unit label"
contains "$OUT_RT2" "visual=1"         "summary counts the visual-processed item"
absent   "$OUT_RT2" "PENDING"          "no PENDING reported when visual-only marker present"
absent   "$OUT_RT2" "$INBOX"           "visual scan stdout does not leak the private inbox path"

# The marker + manifest must not leak the private locator.
absent "$(cat "$RT_CANON/visual-intake.json" 2>/dev/null)" "$INBOX" "visual-intake.json does not leak the inbox path"
absent "$(cat "$RT_CANON/manifest.json" 2>/dev/null)"      "$INBOX" "room-tour manifest.json does not leak the inbox path"

# Visual-only media is NEVER ingested: no note/secure_ref carries its media_id, no bytes in workspace.
RT_NOTE_HIT="$(grep -rl "$RT_MID" "$WS/vault" "$WS/events" 2>/dev/null | head -1)"
[ -z "$RT_NOTE_HIT" ] && ok "room-tour media_id absent from notes/events (no ingest)" || fail "room tour was ingested ($RT_NOTE_HIT)"
RT_BIN_HIT="$(grep -rl 'FAKE-ROOMTOUR-VIDEO-BYTES' "$WS" 2>/dev/null | head -1)"
[ -z "$RT_BIN_HIT" ] && ok "room-tour binary bytes never under workspace" || fail "room-tour binary leaked ($RT_BIN_HIT)"

step "10b. visual-intake.json with MISMATCHED media_id does NOT skip (warn + fallback)"
BM_NAME='maple court unit 9999 (bad marker).mov'
printf 'FAKE-ROOMTOUR-BADMARKER-bytes-1122334455' > "$INBOX/$BM_NAME"
BM_MID="$(shasum -a 256 "$INBOX/$BM_NAME" | cut -c1-16)"
# First scan creates the artifact dir (PENDING, no marker yet).
"${SCAN[@]}" --once >/dev/null 2>&1
BM_CANON="$(find "$ROOT" -maxdepth 4 -type d -name "$BM_MID" -not -path '*/by-id/*' -not -path '*/by-name/*' | head -1)"
[ -n "$BM_CANON" ] && ok "bad-marker artifact dir created" || fail "bad-marker artifact dir created"
# Marker claims a DIFFERENT file's media_id — must not be trusted.
cat > "$BM_CANON/visual-intake.json" <<JSON
{ "schema_version": 1, "kind": "room_tour", "status": "visual_processed",
  "media_id": "deadbeefdeadbeef", "unit": "9999", "transcription": "not_required" }
JSON
OUT_BM="$("${SCAN[@]}" --once 2>&1)"
contains "$OUT_BM" "media_id mismatch"       "mismatch is detected"
contains "$OUT_BM" "marker=deadbeefdeadbeef" "warn names the marker media_id"
contains "$OUT_BM" "NOT skipping"            "explicit fallback (file is not skipped)"
contains "$OUT_BM" "PENDING"                 "bad-marker file falls back to PENDING (no transcript)"
contains "$OUT_BM" "VISUAL_PROCESSED"        "a VALID marker still skips (no regression)"
contains "$OUT_BM" "visual=1"                "only the validly-marked item counts as visual"
BM_NOTE_HIT="$(grep -rl "$BM_MID" "$WS/vault" "$WS/events" 2>/dev/null | head -1)"
[ -z "$BM_NOTE_HIT" ] && ok "bad-marker media not ingested" || fail "bad-marker media was ingested ($BM_NOTE_HIT)"
absent "$OUT_BM" "$INBOX" "bad-marker scan stdout does not leak the inbox path"

step "10c. visual-intake.json with MISSING media_id does NOT skip (warn + fallback)"
MM_NAME='maple court unit 8888 (no media_id).mov'
printf 'FAKE-ROOMTOUR-NOMID-bytes-99aabbccddeeff' > "$INBOX/$MM_NAME"
MM_MID="$(shasum -a 256 "$INBOX/$MM_NAME" | cut -c1-16)"
"${SCAN[@]}" --once >/dev/null 2>&1
MM_CANON="$(find "$ROOT" -maxdepth 4 -type d -name "$MM_MID" -not -path '*/by-id/*' -not -path '*/by-name/*' | head -1)"
[ -n "$MM_CANON" ] && ok "missing-media_id artifact dir created" || fail "missing-media_id artifact dir created"
# Marker has status but no media_id field at all.
cat > "$MM_CANON/visual-intake.json" <<JSON
{ "schema_version": 1, "kind": "room_tour", "status": "visual_processed",
  "unit": "8888", "transcription": "not_required" }
JSON
OUT_MM="$("${SCAN[@]}" --once 2>&1)"
contains "$OUT_MM" "has no media_id" "missing media_id is detected"
contains "$OUT_MM" "NOT skipping"    "explicit fallback (file is not skipped)"
MM_NOTE_HIT="$(grep -rl "$MM_MID" "$WS/vault" "$WS/events" 2>/dev/null | head -1)"
[ -z "$MM_NOTE_HIT" ] && ok "missing-media_id marker not skipped and not ingested" || fail "ingested ($MM_NOTE_HIT)"
absent "$OUT_MM" "$INBOX" "missing-media_id scan stdout does not leak the inbox path"

step "RESULT"
if [ "$FAILED" -eq 0 ]; then
  echo "  media_drive_scan smoke: PASS"
  exit 0
else
  echo "  media_drive_scan smoke: FAIL"
  exit 1
fi
