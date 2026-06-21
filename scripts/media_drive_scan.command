#!/usr/bin/env bash
#
# media_drive_scan.command — double-click launcher for the Drive media scanner.
#
# In Finder, double-click this file to run one scan in a Terminal window with a
# macOS notification on finish. Edit DRIVE_MEDIA_INBOX below to your real inbox
# path (it embeds your Google account email — keep this file private; do NOT
# commit your edited copy).
#
# This launcher hardens PATH itself (Finder launches with a minimal PATH) and
# delegates to scripts/media_drive_scan.sh, which resolves absolute tool paths.
set -u
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.local/bin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- EDIT THESE (or rely on values exported in your shell profile) -----------
# export DRIVE_MEDIA_INBOX="$HOME/Library/CloudStorage/GoogleDrive-<account>/My Drive/PersonalSecondBrain/Media/Inbox"
export MEDIA_ARTIFACT_ROOT="${MEDIA_ARTIFACT_ROOT:-$HOME/PersonalSecondBrainMediaArtifacts}"
export SECOND_BRAIN_WORKSPACE="${SECOND_BRAIN_WORKSPACE:-/Users/mengziyue/PersonalSecondBrain/PersonalSecondBrainWorkspace}"
# -----------------------------------------------------------------------------

if [ -z "${DRIVE_MEDIA_INBOX:-}" ]; then
  echo "DRIVE_MEDIA_INBOX is not set. Edit this .command file (or your shell profile) and try again."
  echo "Press any key to close."; read -r -n 1 _; exit 1
fi

bash "$SCRIPT_DIR/media_drive_scan.sh" --once --notify
code=$?
echo
echo "Scan finished (exit $code). Press any key to close."
read -r -n 1 _
exit "$code"
