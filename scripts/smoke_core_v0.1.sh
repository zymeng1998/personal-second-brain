#!/usr/bin/env bash
#
# smoke_core_v0.1.sh — Core v0.1 dogfood smoke test.
#
# Proves the documented Core v0.1 workflow runs end-to-end from a clean clone,
# against a throwaway workspace OUTSIDE the repo:
#   init -> capture -> note list/get -> validate -> media-intake ingest
#   -> media-intake ingest --review (L1 bridge) -> obsidian-helper check
#   -> dashboard read path (HTTP API + UI + security headers).
#
# It is NOT wired into `pnpm test` (it spawns a server and is slower). Run it as
# the manual release gate:  bash scripts/smoke_core_v0.1.sh   (or: pnpm run smoke)
#
# No secrets, signed URLs, private paths, or secure_ref locators appear here —
# the media reference is a plain public example URL.
set -u

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"
PORT="${SMOKE_DASHBOARD_PORT:-8799}"
WS="$(mktemp -d "${TMPDIR:-/tmp}/sb-smoke.XXXXXX")"
ART="$(mktemp -d "${TMPDIR:-/tmp}/sb-smoke-artifacts.XXXXXX")"
DASH_PID=""
FAILED=0

cleanup() {
  [ -n "$DASH_PID" ] && kill "$DASH_PID" 2>/dev/null
  rm -rf "$WS" "$ART"
}
trap cleanup EXIT

step() { printf '\n=== %s ===\n' "$1"; }
ok()   { printf '  PASS: %s\n' "$1"; }
fail() { printf '  FAIL: %s\n' "$1"; FAILED=1; }
# assert <exit_code> <message>
assert() { if [ "$1" -eq 0 ]; then ok "$2"; else fail "$2 (exit $1)"; fi; }
# contains <haystack> <needle> <message>
contains() { case "$1" in *"$2"*) ok "$3";; *) fail "$3";; esac; }

export SECOND_BRAIN_WORKSPACE="$WS"
PNPM="pnpm -s"

step "1. init + verify workspace"
$PNPM init:workspace >/dev/null 2>&1; assert $? "pnpm init:workspace"
$PNPM verify:workspace >/dev/null 2>&1; assert $? "pnpm verify:workspace"

step "2. capture (L0 raw + capture event)"
CAP="$($PNPM --filter @sb/cli capture -- --content "espresso ratio is 1:2 for a balanced shot" --source paste --title "Espresso" 2>/dev/null | grep '{"ok"')"
assert $? "capture ran"
contains "$CAP" '"ok":true' "capture returned ok"

step "3. read back (note list / get)"
LIST="$($PNPM --filter @sb/cli note -- list 2>/dev/null)"
contains "$LIST" "Espresso" "note list shows the captured note"
NOTE_ID="$(printf '%s\n' "$LIST" | grep -oE '^[0-9A-HJKMNP-TV-Z]{26}' | head -1)"
GET="$($PNPM --filter @sb/cli note -- get "$NOTE_ID" 2>/dev/null)"
contains "$GET" "espresso ratio is 1:2" "note get returns verbatim content"

step "4. validate frontmatter (read-only)"
$PNPM validate:notes >/dev/null 2>&1; assert $? "pnpm validate:notes (exit 0 = all valid)"

step "5. media-intake ingest (transcript -> L0, public media reference)"
DIR="$ART/54c63db258a34d84"; mkdir -p "$DIR"
printf 'Lecture one.\nThe espresso ratio is one to two.\n' > "$DIR/transcript.md"
ING="$($PNPM --filter @sb/media-intake start -- ingest --artifact-dir "$DIR" --media-ref "https://example.org/lectures/intro.mp4" 2>/dev/null | grep '{"ok"')"
contains "$ING" '"ok":true' "media-intake ingest ran"
contains "$ING" '"idempotent":false' "first ingest is not idempotent"
# re-ingest the same media_id + transcript + ref => idempotent no-op
ING2="$($PNPM --filter @sb/media-intake start -- ingest --artifact-dir "$DIR" --media-ref "https://example.org/lectures/intro.mp4" 2>/dev/null | grep '{"ok"')"
contains "$ING2" '"idempotent":true' "re-ingest is idempotent (zero writes)"

step "6. media-intake ingest --review (L1 working-note bridge)"
DIR2="$ART/a4bf9becd046d7ae"; mkdir -p "$DIR2"
printf 'Second lecture transcript about milk steaming.\n' > "$DIR2/transcript.md"
REV="$($PNPM --filter @sb/media-intake start -- ingest --artifact-dir "$DIR2" --media-ref "https://example.org/lectures/two.mp4" --review 2>/dev/null | grep '{"ok"')"
contains "$REV" '"working_note_id"' "--review promoted an L1 working note"

step "7. obsidian-helper check (read path)"
CHK="$($PNPM --filter @sb/obsidian-helper start -- check 2>/dev/null | grep '{"ok"')"
contains "$CHK" '"ok":true' "obsidian-helper check passed (no compat findings)"

step "8. dashboard read path (server + JSON API + UI + headers)"
$PNPM --filter @sb/dashboard start -- --port "$PORT" >/dev/null 2>&1 &
DASH_PID=$!
UP=1
for _ in $(seq 1 40); do
  curl -fs "http://127.0.0.1:$PORT/api/notes" >/dev/null 2>&1 && { UP=0; break; }
  sleep 0.3
done
assert $UP "dashboard started on 127.0.0.1:$PORT"
if [ "$UP" -eq 0 ]; then
  NOTES_JSON="$(curl -fs "http://127.0.0.1:$PORT/api/notes")"
  contains "$NOTES_JSON" '"ok":true' "GET /api/notes returns ok"
  UI_CODE="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/")"
  [ "$UI_CODE" = "200" ] && ok "GET / serves the UI (200)" || fail "GET / serves the UI (got $UI_CODE)"
  HDRS="$(curl -s -D - -o /dev/null "http://127.0.0.1:$PORT/api/notes")"
  contains "$HDRS" "Content-Security-Policy: default-src 'self'" "CSP header present"
  contains "$HDRS" "X-Frame-Options: DENY" "X-Frame-Options header present"
fi

step "RESULT"
if [ "$FAILED" -eq 0 ]; then
  echo "  Core v0.1 smoke: PASS"
  exit 0
else
  echo "  Core v0.1 smoke: FAIL"
  exit 1
fi
