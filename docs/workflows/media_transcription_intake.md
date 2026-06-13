# Workflow: Media Transcription Intake (external source → capture)

How transcripts produced by the standalone **`psb-media-transcriber`** project become Second Brain
captures. The transcriber is intentionally **separate** from this repo (see its README); it runs the
RunPod/faster-whisper pipeline and writes to its **own artifact store**, not into the vault. Second
Brain consumes those artifacts later through an **optional adapter** (not yet built — see backlog).

## Where transcripts live (the transcriber's artifact store)

The transcriber writes to its **media-artifact root** (default `~/PersonalSecondBrainMediaArtifacts/`),
which is **outside** this repo and **outside** the Second Brain workspace (`SECOND_BRAIN_WORKSPACE`):

```
<media_artifact_root>/
├── <YYYY>/<MM>/<media_id>/        # canonical home; media_id = content hash (stable across rename)
│   ├── transcript.md  .srt  .vtt  .segments.json
│   ├── manifest.json  source-metadata.json
│   └── job.log  errors.jsonl  events.jsonl
└── by-name/                       # symlinks named by original video filename → the hash dir
    ├── broker_lesson_1.mov  →  ../2026/06/54c63db258a34d84
    └── harvard.wav          →  ../2026/06/a4bf9becd046d7ae
```

### The `by-name/` convention

`by-name/` is a directory of **symlinks named after the original media filename**, each pointing at
that item's content-hash artifact dir, so the store is browsable **by video name** instead of hashes.
It is maintained by `artifacts.link_by_name()` in the transcriber on every job. Collisions (same name,
different content hash) get an 8-char suffix. Source of truth = the hash dir; `by-name/` = an index.

This mirrors Second Brain's own **stable-id + mutable-slug** rule (ULID is the immutable id; the slug
in `<ULID>--<slug>.md` may change). The video's content hash is the durable key; the filename is the
human-facing label.

## How it maps into Second Brain (the future adapter)

When the intake adapter is built, a transcript becomes a normal capture and follows the existing
[capture → distill](capture_to_distill.md) flow:

```
transcript.md (+ source-metadata.json)  →  CLI `capture` (via adapter)
  → write verbatim to vault/00_Raw/<ULID>.md        (L0, immutable)
  → append capture_events.jsonl record               (source of truth)
      • source.kind = "transcript"
      • ref = opaque pointer back to the artifact dir / media_id (provenance)
  → create a stub working note in 00_Inbox/          (L1, references <ULID>)
```

The raw transcript text lands in **L0 (`00_Raw/`, immutable)** exactly like any other capture; the
adapter never edits the transcriber's artifacts, and the transcriber never writes into the vault.

## Convention requirements (binding on future work)

Any intake/adapter/backfill code MUST:

1. **Preserve the artifact-store shape.** Do not flatten or rename the `<YYYY>/<MM>/<media_id>/` +
   `by-name/` layout. The transcriber owns it; Second Brain reads it read-only.
2. **Carry provenance.** Each capture event records the originating `media_id` and a ref to the
   artifact dir so a raw note is always traceable to its source video.
3. **Respect immutability both ways.** L0 raw is immutable in the vault; the transcriber's hash dirs
   are the immutable source on the artifact side. Re-ingest is idempotent on `media_id`.
4. **Keep organize-by-name.** The video-name view (`by-name/`) is the standard browse surface for
   transcripts; preserve it so material stays findable by video name.

## Status

- **Transcriber:** live and working (v0.1.0) — produces the layout above, including `by-name/`.
- **Second Brain adapter:** **BUILT (v1, 2026-06-12).** `apps/media-intake` (`@sb/media-intake`,
  identity `surface:media-intake`) — `media-intake ingest --artifact-dir <dir>` (or
  `--transcript <file>`) + `--media-ref` (public) / `--media-secref` (private) [`--review` seeds
  the L1 bridge]. Captures the transcript **text** verbatim as L0 (`source:"transcript"`) with an
  auditable, non-leaking media block (`media_id`, `transcript_sha256`, `ref_class`, one-way
  `media_ref_fp`, and a `ref` or `secref` handle) — never the media binary; private/signed/token/
  ambiguous pointers become opaque secure_refs. Strict idempotency on `media_id` (re-ingest with a
  changed transcript or reference ⇒ `media_id_conflict`, zero writes). `.srt`/`.vtt` are normalized
  to prose (no timestamps in the body). All 7 stories `Done` (SB-070/071/072 + SB-085/086/087/088);
  the SB-087 epic gate is green. See
  [`../planning/media_intake_story_map.md`](../planning/media_intake_story_map.md).

## Out of scope

Domain-specific handling (e.g. broker lecture content) is built later under `domain-apps/` and reuses
this same core intake via `interfaces` — no domain concepts enter the core.
