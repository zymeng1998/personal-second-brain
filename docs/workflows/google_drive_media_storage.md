# Workflow: Google Drive Media Storage → Transcript Intake

The **fastest robust path** for storing media (audio/video) in Google Drive while keeping the Second
Brain core media-binary-free. You drop a file into a Google Drive folder; a local scanner prepares an
**external** artifact store keyed by content hash, and — once a transcript exists — ingests the
transcript **text** into the vault through the existing [`@sb/media-intake`](media_transcription_intake.md)
adapter. The original media never enters the workspace; its private Drive locator is stored only as an
opaque `secure_ref`.

> This is the **local Google Drive for Desktop** path. It complements the separate
> `psb-media-transcriber` (RunPod/faster-whisper) project described in
> [media_transcription_intake.md](media_transcription_intake.md) — both write the same
> `~/PersonalSecondBrainMediaArtifacts/` store and feed the same adapter.

## Design (why this shape)

- **Storage/sync layer = Google Drive for Desktop (DriveFS)**, not the Drive API. Files in
  `My Drive/PersonalSecondBrain/Media/Inbox` appear as ordinary local paths under
  `~/Library/CloudStorage/…`. No OAuth, no tokens, no API quota — the fastest robust v1.
- **Scanner, not a watcher.** A simple idempotent scan (`scripts/media_drive_scan.sh`) is far more
  robust than a filesystem watcher and is trivial to schedule.
- **Content-hash identity.** `media_id` = first **16** lowercase hex chars of the file's SHA-256.
  This deliberately matches **`psb-media-transcriber`** (`hashing.py: sha256[:16]`) so the RunPod
  transcriber and this scanner resolve the **same** `<media_id>` artifact dir for a given file — the
  transcriber writes `transcript.md`, the scanner finds it. 16 hex also matches the core's
  `MEDIA_ID_PATTERN` `^[A-Za-z0-9_-]{8,128}$`. Stable across renames.
- **The core never reads the binary.** Only the transcript **text** is captured (L0). The media
  pointer becomes a `secure_ref` (private-by-default for local paths).

## Prerequisites (this machine, verified 2026-06-20)

| Tool | Path | Notes |
|------|------|-------|
| node | `/usr/local/bin/node` (v22) | resolved with fallback PATH |
| pnpm | `~/.local/bin/pnpm` (9.0) | **not** on the default Automator PATH — script adds `~/.local/bin` |
| shasum | `/usr/bin/shasum` | always present on macOS |
| ffmpeg | `/usr/local/bin/ffmpeg` | only needed for `--transcribe` |
| whisper | `~/Library/Python/3.9/bin/whisper` | only needed for `--transcribe` |

**Drive setup (DONE on this machine, 2026-06-21):**
- **Google Drive for Desktop is installed and signed in.** Local root:
  `~/Library/CloudStorage/GoogleDrive-<account>`.
- Inbox exists and is marked **Available offline** in Finder (DriveFS `subscribed=1` for
  `PersonalSecondBrain`, `Media`, `Inbox`) — i.e. always-local, reliable for hashing.
- Real-inbox `--dry-run` succeeded (`media=0 … failed=0`).
- We use **Drive for Desktop local-folder sync only** — no Drive API / OAuth / service account /
  rclone for v1.

## One-time setup

1. **Install Google Drive for Desktop** and sign in. Create the inbox folder in Drive:
   `My Drive/PersonalSecondBrain/Media/Inbox`. Let it sync.
2. **Find its local path** (the account email is embedded — treat it as private):
   ```bash
   ls -d ~/Library/CloudStorage/*/My\ Drive/PersonalSecondBrain/Media/Inbox
   ```
3. **Export the environment** (add to your shell profile or a private `.env` you do **not** commit):
   ```bash
   export DRIVE_MEDIA_INBOX="$HOME/Library/CloudStorage/GoogleDrive-<account>/My Drive/PersonalSecondBrain/Media/Inbox"
   export MEDIA_ARTIFACT_ROOT="$HOME/PersonalSecondBrainMediaArtifacts"   # default; optional
   export SECOND_BRAIN_WORKSPACE="/Users/mengziyue/PersonalSecondBrain/PersonalSecondBrainWorkspace"
   ```
4. Ensure the workspace exists (once):
   ```bash
   cd /Users/mengziyue/PersonalSecondBrain/personal-second-brain
   SECOND_BRAIN_WORKSPACE="$SECOND_BRAIN_WORKSPACE" pnpm init:workspace
   ```

## Manual run (the primary path)

```bash
cd /Users/mengziyue/PersonalSecondBrain/personal-second-brain
scripts/media_drive_scan.sh            # scan once; ingest transcripts, report pending
scripts/media_drive_scan.sh --dry-run  # prepare artifact dirs + report, never ingest
scripts/media_drive_scan.sh --no-review # L0 only (default also seeds an L1 working note)
scripts/media_drive_scan.sh --transcribe # also run local whisper when transcript.md is missing
```

### What a scan does, per media file

```
DRIVE_MEDIA_INBOX/<your file>.mp4
        │  sha256 → media_id (16 hex; matches psb-media-transcriber)
        ▼
MEDIA_ARTIFACT_ROOT/
├── <YYYY>/<MM>/<media_id>/        # canonical artifact dir (basename = media_id)
│   ├── transcript.md              # YOU / RunPod / --transcribe provide this (transcript media)
│   ├── visual-intake.json         # OR this: visual-only marker (room tours) — skip, no transcript
│   ├── manifest.json              # non-leaking provenance (hash, size, fp — NO raw locator)
│   ├── job.log                    # per-media log (locator-free)
│   └── last_ingest.json           # the locator-free success envelope
├── by-id/<media_id>   → ../<YYYY>/<MM>/<media_id>
└── by-name/<original filename> → ../<YYYY>/<MM>/<media_id>   # browse by name
```

- **Visual-only marker valid** (`visual-intake.json` with `status: "visual_processed"` **and** a
  `media_id` equal to the computed `media_id`) → **SKIP** (`VISUAL_PROCESSED`). No transcript, no
  ingest — see [Media kinds](#media-kinds-transcript-vs-visual-only-room-tours).
- **Transcript present** → calls `@sb/media-intake ingest --artifact-dir <dir> --media-secref <drive path> --review`.
  Result: an immutable **L0** raw note (`source:"transcript"`) + an **L1** working note (with `--review`).
- **Transcript missing** (and not visual-only) → prints a clear **PENDING** state with the exact next
  step (drop `transcript.md` into the artifact dir, or re-run with `--transcribe`).

### Idempotency & fail-closed

- Re-running with the same media + transcript + pointer is a **no-op** (`"idempotent":true`).
- A **changed transcript or pointer** for the same `media_id` **fails closed** inside media-intake
  (`media_id_conflict`, zero writes). The scanner surfaces the failure and exits non-zero.

## Media kinds: transcript vs visual-only (room tours)

Not all media needs a transcript. Two kinds:

- **Transcript media** (lectures, meetings, voice notes) — the audio carries the meaning. These flow
  through RunPod transcription → `transcript.md` → `@sb/media-intake` (L0 + L1), as above.
- **Visual-only media** (broker **room-tour videos**, by default) — the *picture* is the content; the
  audio is non-semantic background. **Room-tour audio is NOT transcribed** unless Mengziyue explicitly
  asks for it for that specific file. The unit / building / doorplate are captured visually (from the
  opening frames) into an L0 note by the intake agent, and the scanner must not keep nagging to
  transcribe them.

### The `visual-intake.json` marker

A visual-only item is marked **complete** by a `visual-intake.json` file in its artifact dir:

```
<MEDIA_ARTIFACT_ROOT>/<YYYY>/<MM>/<media_id>/visual-intake.json
```

```json
{
  "schema_version": 1,
  "kind": "room_tour",
  "status": "visual_processed",
  "media_id": "0123abcd4567ef89",
  "original_filename": "VID_0001.MOV",
  "building": "Maple Court",
  "area": "Riverside, Example City",
  "unit": "1201",
  "doorplate_status": "clear",
  "doorplate_source": "opening_frame",
  "note_id": "01EXAMPLENOTEID0000000000A",
  "secure_ref": "secref_…",
  "transcription": "not_required",
  "processed_at": "2026-06-21T19:…Z"
}
```

- It records *workflow state + non-private labels* only. It **must not** contain raw Drive paths — the
  private locator lives solely in the `secure_ref` (the `secure_ref` value here is just the opaque id).
- It is a **script/doc-level convention**, deliberately kept out of the core packages and schemas
  (no broker/room-tour vocabulary in the domain-independent core).

**Marker contract (hardened).** The scanner skips a file as `VISUAL_PROCESSED` **only when both** hold:
1. `status` is exactly `"visual_processed"`, **and**
2. the marker's `media_id` **exactly equals** the file's computed `media_id` (= the artifact dir name).

If the `media_id` is **missing** or **mismatched**, the scanner does **not** skip: it emits a
`WARN: visual-intake.json media_id mismatch (marker=…, dir=…); NOT skipping` (or `… has no media_id; NOT
skipping`) and **falls back to normal handling** — which is **PENDING** for a room tour (no
`transcript.md`). This prevents a copied, stray, or hand-edited marker from suppressing intake for the
**wrong** media file. `status` alone is never sufficient.

### How the scanner distinguishes the four states

For each media file in the Inbox the scanner reports exactly one state:

| State | Condition | Action |
|-------|-----------|--------|
| **VISUAL_PROCESSED** | `visual-intake.json` has `status: "visual_processed"` **AND** its `media_id` equals the computed `media_id` | Skip — no transcript, no ingest |
| **INGESTED / OK** | `transcript.md` present, captured via `@sb/media-intake` | L0 (+ L1 with `--review`); idempotent on re-run |
| **PENDING** | known media, no transcript yet, not validly visual-only (includes a marker whose `media_id` is missing/mismatched → warns + falls back) | Print the exact next step |
| **new/unprocessed** | first time this `media_id` is seen | Create the artifact dir, then PENDING (or ingest if a transcript was pre-placed) |

### Inbox can safely hold old videos

Recognition is by **content hash (`media_id`) + `visual-intake.json`**, not by filename or location.
So already-processed room tours can stay in `Media/Inbox` forever: each scan re-identifies them and
reports `VISUAL_PROCESSED` without redoing work or re-prompting for a transcript. (Moving processed
tours into `Media/Library/RoomTours` is a **future** workflow decision — this story only adds the
state marker and the folder layout below; it does not move any files.)

### Drive folder layout

```
My Drive/PersonalSecondBrain/Media/
├── Inbox/                # drop zone (scanner reads here; current room tours live here)
├── Library/
│   └── RoomTours/        # future home for processed room tours (no auto-move yet)
└── NeedsReview/          # future: items needing a human decision
```

## Producing the transcript

**Canonical path — remote RunPod (serverless).** All transcription jobs are handled by the remote
serverless **RunPod** GPU service via the **`psb-media-transcriber`** project
(`/Users/mengziyue/psb-media-transcriber`, faster-whisper `large-v3`), **not** on this Intel Mac.
It uploads audio to a RunPod network volume, runs the Serverless worker, and downloads the transcript
artifacts into the **same** `~/PersonalSecondBrainMediaArtifacts/<YYYY>/<MM>/<media_id>/` store this
scanner reads — because both derive `media_id` as `sha256[:16]`, the dirs line up automatically.

```bash
# 1) Transcribe the Drive file with RunPod (writes transcript.md into the artifact dir):
cd /Users/mengziyue/psb-media-transcriber && source .venv/bin/activate
psb-transcribe transcribe "$DRIVE_MEDIA_INBOX/<your file>.mp4"
#    (or right-click the file in Finder → the "Transcribe with RunPod" Quick Action)

# 2) Then ingest the transcript into the Second Brain:
cd /Users/mengziyue/PersonalSecondBrain/personal-second-brain
scripts/media_drive_scan.sh
```

Prefer this for anything real — the local machine is CPU-only and slow. (See the transcriber's
`STATUS.md` / `RUNPOD_SETUP.md` for endpoint + `.env` credential setup; creds live in
`~/.psb-transcribe/.env`, never in this repo.)

Fallbacks:
- **Manual**: drop a `transcript.md` (or `.txt`/`.srt`/`.vtt`) into the artifact dir and re-run.
- **`--transcribe`** (local whisper, opt-in — quick/offline tests only): `scripts/media_drive_scan.sh --transcribe`.
  First run downloads the model; progress goes to the per-media `job.log`. Not the default and not for
  production volume.

## Security model (locator never leaks)

- The private Drive path (which embeds your account email) is passed **only** to `--media-secref` and
  is stored **only** inside `SECOND_BRAIN_WORKSPACE/secure_refs/` as an opaque `secref_…`.
- It **never** appears in: notes (vault), the event log, `manifest.json`, `job.log`, the scan log, or
  stdout. The scanner prints a non-reversible `media_ref_fp` (first 16 hex of SHA-256) instead.
- The media **binary** is never read by the core and never copied into the workspace.

## Optional automation

Two templates ship under `scripts/`:

- **Double-click launcher** — `scripts/media_drive_scan.command`. Edit the `DRIVE_MEDIA_INBOX` line,
  then double-click in Finder. Shows a Terminal window and a macOS notification.
- **Periodic LaunchAgent** — `scripts/com.personalsecondbrain.mediascan.plist.template`. Fill in the
  three paths, copy to `~/Library/LaunchAgents/com.personalsecondbrain.mediascan.plist`, then:
  ```bash
  launchctl load ~/Library/LaunchAgents/com.personalsecondbrain.mediascan.plist
  ```
  It runs the scanner every 15 minutes. macOS may prompt for **Files and Folders / Full Disk Access**
  the first time it touches the CloudStorage folder — grant it in
  System Settings → Privacy & Security.

## Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| `DRIVE_MEDIA_INBOX is not set` | Export it (see setup). |
| `DRIVE_MEDIA_INBOX does not exist` | Drive for Desktop not installed/signed in, or folder not synced. |
| `pnpm not found` (under LaunchAgent) | The script adds `~/.local/bin`; if pnpm moved, edit `resolve_tool` candidates. |
| `media_id_conflict` | The transcript or media path changed for an already-ingested file. Intended fail-closed; investigate which changed. |
| Stuck on **PENDING** | No `transcript.md` yet. Provide one or use `--transcribe`. |
| Whisper does nothing | `--transcribe` needs `whisper` + `ffmpeg` on PATH; see prerequisites. |

## Smoke test (no real media)

```bash
cd /Users/mengziyue/PersonalSecondBrain/personal-second-brain
bash scripts/media_drive_scan.smoke.sh
```

Uses synthetic fixtures (Unicode + spaces in the filename) under `TMPDIR` and asserts: PENDING state,
artifact dir + `by-id`/`by-name` symlinks + `manifest.json`, idempotent ingest, L0 + L1 notes, the
media binary never under the workspace, the private locator never in notes/events/stdout, and a
**visual-only room-tour fixture** reported as `VISUAL_PROCESSED` (skipped, never PENDING, no ingest).
