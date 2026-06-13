# Media Intake Story Map — Media Transcription Intake (EPIC-CORE-013)

Refinement of the EPIC-CORE-013 backlog (the coarse SB-070/071/072 decomposed into ≤3-pt atomic
stories, per the split rule). Companion to [`story_backlog.md`](story_backlog.md) (cards),
[`../workflows/media_transcription_intake.md`](../workflows/media_transcription_intake.md) (the
binding workflow + artifact-store shape), [`security_story_map.md`](security_story_map.md) and
[`phase_5_story_map.md`](phase_5_story_map.md) (the surface/secure_ref integration model this epic
reuses).

**Status (2026-06-12): DECISION REVIEW PASSED — OQ #36–#40 approved exactly as leaned, with two
amendments** (recorded in [`open_questions.md`](open_questions.md)): **(A) strict idempotency** —
same `media_id` + same transcript hash + same media reference is idempotent; same `media_id` with a
different transcript hash or media reference fails closed as `media_id_conflict` (zero writes);
**(B) auditable-but-non-leaking classification** — store only the class (`public_ref`/
`signed_url_detected`/`token_detected`/`local_private_path`/`ambiguous_default_private`), never the
raw locator. Implementation authorized in dependency order SB-070 → 071 → 072 → 085 → 086 → 087 →
088, one atomic commit per story; SB-074 + SB-077 + SB-084 re-run inside SB-087.

## Objective

Connect the real user workflow — **media → transcript artifact → PSB metadata/capture →
reviewable note** — without making the core responsible for heavy media storage or transcription
compute. The standalone `psb-media-transcriber` produces transcripts in its own external artifact
store; this epic builds the **optional intake adapter** that turns a transcript into a normal
capture (transcript text → L0 raw) carrying provenance back to the original media, with the media
binary **never** entering the vault.

- **Done when (epic gate):** a transcript ingested through the adapter lands as an immutable L0
  raw note (verbatim text) + a `captured` event carrying its `media_id` and a media reference;
  re-ingesting the same `media_id` writes nothing (idempotent); the original media binary never
  appears in the vault; no signed URL / API key / private locator value appears in any note,
  event, log, snapshot, or error; and the provenance chain L1 → L0 → `media_id` → media reference
  resolves. Automated as SB-087.

## Fixed guardrails (from the epic authorization — not open questions)

- **The core never stores media binaries.** The adapter reads only transcript **text** + (later)
  small JSON metadata; it never reads, copies, or references audio/video bytes into the vault.
  Original media lives in cloud storage or external local paths — referenced, never stored.
- **Reference, don't embed.** A media reference is metadata only: `media_id` (content hash) +
  a pointer to where the original lives. Anything private (signed URL, token-bearing link,
  private path, keychain item) uses the **secure_ref** model (opaque locator, never echoed);
  only genuinely non-sensitive pointers use plain capture `ref` metadata.
- **No secret exposure anywhere.** No raw secret, API key, signed URL, or private locator value
  in notes, events, logs, snapshots, fixtures, or errors. The SB-087 gate scans for it.
- **Reuse the boundary.** Intake goes through the existing enforced dispatch
  (`main(argv, io, "surface:media-intake")` → `resolveGrant`/`grantAllows`/`enforceScope`) under a
  fixed least-privilege identity — never `cli`, never importing core packages directly, never a
  second enforcement path. Capture, provenance, confirmation, and secure_ref patterns are reused
  as-is; no new write primitives.
- **Immutability both ways.** L0 raw is immutable in the vault; the transcriber's hash dirs are
  the immutable source on the artifact side. Re-ingest is idempotent on `media_id`. The adapter
  never edits the transcriber's artifacts; the transcriber never writes into the vault.
- **Domain-neutral.** No broker/domain vocabulary in the core or the generic adapter. Transcripts
  are generic content; domain handling stays under `domain-apps/` and reuses this intake.
- Stories atomic ≤3 pts; one atomic commit per story; stop after refinement for OQ approval.

## Open decisions — confirm before SB-070 goes `Ready` (leans)

| # | Question | Lean |
|---|---|---|
| 36 | **Minimal transcript input format for v1** — `.txt`, `.srt`/`.vtt`, or both? | **`.txt` + `.md` captured verbatim** (the transcriber already emits prose `transcript.md` — the canonical input). `.srt`/`.vtt` are derivative timed-caption formats whose cue-index/timestamp stripping is a distinct parsing concern; a dedicated **gate-independent SB-088** (deferrable) adds `.srt`/`.vtt` → prose normalization. So: minimal core path is text/markdown verbatim; timed-caption support is a separate, optional story. |
| 37 | **Transcripts only, or also register media before a transcript exists?** | **Transcripts only for v1.** The media reference is recorded **together with** the transcript at ingest (provenance), not standalone — an L0 raw note requires real content, and a "media stub with no body" adds a bodiless note type with little value. Pre-registering media before a transcript exists is deferred (future story). |
| 38 | **L0 only, or also a distillation/review path?** | **L0 raw (verbatim) + a thin L1 review bridge.** Ingest always writes L0; SB-086 seeds an L1 working note in `00_Inbox` by **reusing the existing `note promote`** so the transcript enters the existing capture → distill / review pipeline. No new distillation logic — the Phase 1H/Phase 4 paths handle L2+ unchanged. |
| 39 | **Media reference: external path/link metadata vs `secure_ref`?** | **Both, classified by sensitivity — private-by-default for ambiguous pointers.** Non-sensitive external paths/URLs → plain capture `ref` metadata (visible). Private cloud links, **signed URLs / token-bearing links**, private local paths, keychain items → **`secure_ref`** (opaque locator ≤500 chars, never echoed; `read:secure_refs` stays hard-denied). Anything that looks signed/token-bearing is forced to secure_ref; the adapter creates the secref itself (needs `write:secure_refs`) for a one-command workflow. |
| 40 | **Which surface exposes v1 first?** | **A dedicated CLI adapter app — `apps/media-intake`, identity `surface:media-intake`** (mirrors `apps/obsidian-helper`). Not folded into the core `sb` CLI (keeps the adapter optional/separable with a narrower-than-`cli` grant), not the dashboard/obsidian-helper. A single CLI surface = the minimal usable workflow; dashboard/obsidian integration deferred. |

## Architecture (fixed)

```
psb-media-transcriber artifact store (EXTERNAL, read-only — never written by PSB)
  <media_artifact_root>/<YYYY>/<MM>/<media_id>/transcript.md (+ .srt .vtt manifest.json …)
  by-name/<original-filename> → ../<YYYY>/<MM>/<media_id>     (browse-by-name index, preserved)
        │  transcript TEXT only (never the audio/video binary)
        ▼
apps/media-intake   caller: surface:media-intake          first-party registry (in-code):
  ingest --artifact-dir <dir> | --transcript <file>          cli, sidecar:retrieval,
         --media-ref <public> | --media-secref <private>      surface:obsidian-helper,
        │                                                      surface:dashboard,
        │  classify media reference (OQ #39):                  surface:media-intake  ◄─ NEW
        │    public  → capture `ref` metadata (plain)                 │
        │    private → writeSecureRef → secref_… handle               ▼
        ▼                                          main(argv, io, caller) ─► enforceScope
   capture op → L0 raw (transcript verbatim; source="transcript";   (the ONE enforced dispatch)
                media_id + media-ref handle as provenance)
        │  idempotent on media_id (re-ingest writes nothing)
        ▼
   note promote → L1 working note in 00_Inbox  →  existing distill / review flow
```

- Sub-phase 13A = contract (SB-070); 13B = identity + grant (SB-071); 13C = media reference
  (SB-072); 13D = transcript ingest → L0 (SB-085) + L1 bridge (SB-086); 13E = epic gate (SB-087);
  13X = `.srt`/`.vtt` normalization (SB-088, deferrable).
- `apps/media-intake` is a pnpm workspace package (like `apps/obsidian-helper`); its tests run in
  root `pnpm test`, Node-only. The reserved coarse trio SB-070/071/072 is retained with narrowed
  scope; SB-085–088 are new (the original coarse split — read/list → capture-with-provenance →
  idempotent — is superseded by contract-first decomposition).

## Stories (all ≤3 pts; 16 pts total — SB-070/071/072 narrowed; SB-085/086/087 + deferrable SB-088 new)

- **SB-070** (2, P2) — **media intake contract** (OQ #36): add `"transcript"` to `CaptureSource`
  (`capture.ts` + `capture.schema.json` enum + `RAW_SOURCE_KINDS`); new `media_reference.schema.json`
  (metadata-only: `media_id` content-hash, artifact-dir pointer, optional safe label/duration —
  **no binary, no secret fields**) + `MediaReference` / `MediaIngestInput` interfaces types.
  Contracts only; mirrors SB-047/SB-056/SB-060.
- **SB-071** (2, P2) — **`surface:media-intake` identity + grant** (OQ #40): first-party registry
  entry with documented least-privilege grant `[write:capture, read:notes, write:notes,
  write:secure_refs]` (capture the transcript; read for idempotency; promote the L1 bridge; write
  the private media secref — `read:secure_refs` stays hard-denied). Grant-table tests; everything
  else denied; ALWAYS_DENIED unobtainable; zero change for existing callers. Mirrors SB-078.
- **SB-072** (3, P2) — **media reference recording** (OQ #39): record the original-media pointer as
  a citable **handle** — public `--media-ref` (plain external path/URL) XOR private `--media-secref`
  (→ `writeSecureRef`, opaque locator, never echoed); **private-by-default** for signed/token-bearing
  or ambiguous locators (forced to secure_ref); returns a handle (a plain ref string or a `secref_…`
  id) for the ingest to cite. Reuses the existing secure_ref writer; no transcript yet.
- **SB-085** (3, P2) — **transcript ingest → L0**: `apps/media-intake` skeleton + `ingest` — read a
  transcript `.txt`/`.md` (`--artifact-dir <dir>` ⇒ `<dir>/transcript.md` + `media_id` =
  dir basename; or `--transcript <file> --media-id <hash>`) **read-only** with guardrails
  (extension allowlist, size cap, path-safety, **never reads media-binary extensions**); route
  through the enforced capture op → L0 verbatim (`source: "transcript"`) carrying `media_id` + the
  SB-072 media-ref handle as provenance; **idempotent on `media_id`** (re-ingest reports the
  existing note, writes nothing).
- **SB-086** (2, P2) — **L1 reviewable bridge** (OQ #38): `ingest --review` (or `promote`) seeds an
  L1 working note in `00_Inbox` referencing the L0 transcript note by **reusing the enforced
  `note promote`**, so the transcript enters the existing capture → distill / review flow; the
  provenance chain L1 → L0 → `media_id` → media reference is asserted intact. No new distillation
  logic.
- **SB-087** (2, P2) — **media-intake epic gate**: the "Done when" automated — `media_id`
  idempotency (re-ingest writes nothing); full provenance round-trip (L1 → L0 → `media_id` →
  media-ref handle resolves); **no media binary in the vault** (only transcript text); **no
  signed-URL / API-key / private-locator leak** in any note/event/log/snapshot/error (full scan
  with a sentinel locator); domain-term grep over `apps/media-intake`; SB-074 + SB-077 + SB-084
  invariants re-asserted in-suite (surface identity denied outside its grant; secure_ref locator
  never echoed).
- **SB-088** (2, P2, deferrable) — **`.srt`/`.vtt` normalization**: strip cue indices + timestamps
  (and optional speaker labels) → clean prose before capture; gate-independent (the epic gate does
  not depend on it). Implement only if OQ #36 approves staged-both.

### Dependency graph
```
SB-070 ─ SB-071 ─ SB-072 ─ SB-085 ─ SB-086 ─ SB-087 (gate; needs SB-085 + SB-086)
                              └────── SB-088 (deferrable; gate-independent)
```
Recommended order: **SB-070 → SB-071 → SB-072 → SB-085 → SB-086 → SB-087 (→ SB-088 optional).**

## Out of scope

- Storing, transcoding, or transcribing media — the transcriber owns that; the core only ingests
  transcript text + references.
- Reading/parsing `source-metadata.json` or `manifest.json` secret-bearing fields in v1 (avoids
  the whole signed-URL/token leak surface; safe `media_id` comes from the artifact-dir name). Rich
  manifest metadata is a future story.
- Pre-registering media before a transcript exists (OQ #37); a "media stub" note type.
- Dashboard / Obsidian-helper media surfaces (OQ #40 — CLI adapter first); mobile/clipper intake.
- Domain-specific transcript handling (broker lecture content, etc.) — built later under
  `domain-apps/`, reusing this intake via `interfaces`. EPIC-DOMAIN-001 stays `Deferred`.
- Editing the transcriber's artifact store, or changing its `<YYYY>/<MM>/<media_id>/` + `by-name/`
  layout (read-only; preserve organize-by-name).
