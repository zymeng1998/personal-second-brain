# Post-v0.1 Expansion — Design Doc (WeChat capture + Media archive to Google Drive)

**Status:** DRAFT for review — design only, **no implementation, no commit** until approved.
**Date:** 2026-06-18
**Author:** session handoff (research pass over the real source, not just docs).

This doc proposes two post-v0.1 workflows and decomposes them into atomic (≤3-pt) stories.
It does **not** add cards to [`story_backlog.md`](story_backlog.md) yet — on approval the stories
below become `SB-095+` cards and go through the normal OQ review (see "Open questions", filed as
OQ #48+ to continue from the broker epic's #47).

---

## 0. Verified current state (from source, not docs)

Confirmed by reading the code this session:

- **CLI dispatch is one enforced path:** `main(argv, io, caller)` in `@sb/cli`
  ([`apps/cli/src/index.ts`](../../apps/cli/src/index.ts)). Top-level commands present:
  `capture`, `note` (list/get/promote), `distill`, `fact`, `output`, `secref`, `rebuild`,
  `index`, `query`.
- **Caller identities & grants** ([`packages/interfaces/src/grants.ts`](../../packages/interfaces/src/grants.ts)):
  first-party in-code grants for `cli`, `sidecar:retrieval`, `surface:obsidian-helper`,
  `surface:media-intake`, `surface:dashboard`. `domain-app:*` callers resolve from a validated
  workspace `config/grants.json` only ([`grant-config.ts`](../../packages/interfaces/src/grant-config.ts),
  `DOMAIN_APP_ID_PATTERN`). `surface:*` identities are **first-party** (config can never declare them).
- **Scope model** ([`scope.ts`](../../packages/interfaces/src/scope.ts)):
  `ALWAYS_DENIED_SCOPES = [write:raw, delete:*, read:secure_refs]` — hard-denied for every caller,
  structurally ungrantable. Grantable operational scopes incl. `write:capture, read:notes,
  write:notes, read:facts, write:facts, read:index, write:secure_refs`.
- **`wechat` and `ocr` are already valid raw source kinds**
  ([`capture.ts`](../../packages/interfaces/src/capture.ts),
  [`capture.schema.json`](../../schemas/json/capture.schema.json) enum:
  `paste, email, wechat, ocr, voice, clip, import, transcript`). So `capture --source wechat`
  works **today** — the missing piece is the *capture adapter*, not the contract.
- **The media-intake pattern is the template to copy** ([`apps/media-intake/src/`](../../apps/media-intake/src/)):
  - `invoke.ts` — the surface's only route into core: wraps `main(argv, io, "surface:media-intake")`.
  - `ingest.ts` — reads text (never a binary; extension allowlist + binary denylist + size cap),
    idempotency scan via `note list`/`note get`, then `capture --source transcript --media <json>`;
    optional `--review` reuses `note promote` for an L1 working note.
  - `media-ref.ts` — `recordMediaReference`: a clean public URL → plain `ref`; a signed/token/private
    pointer → opaque `secref_…` via `secref add` (raw locator never returned/logged). **A local
    filesystem path is classified `local_private_path` → forced to a secref automatically.**
- **The broker is the template for a domain consumer** ([`domain-apps/broker/src/`](../../domain-apps/broker/src/)):
  `captureClientNote` → `capture --source import --tag client-intake`; `promoteClient` → `note promote`;
  `acceptPreferenceFacts` → unchanged `fact accept`. Grants come from `config/grants.json`, expanded
  least-privilege per story.

**Design consequence:** both new workflows are **adapters around the existing enforced dispatch**.
No core schema/command changes are required for the MVP. Credentials (Google OAuth, any LLM key)
**never touch the core** — adapters resolve them to an opaque pointer string before calling `capture`.

---

## 1. WeChat selected-chat capture

### 1.1 Hard privacy boundary (applies to every option)

**Out of scope, permanently, for personal WeChat:**
- Reading/decrypting WeChat's local message store (`EnMicroMsg.db` / the macOS container SQLite),
  key extraction, memory dumping, or any DB scraping.
- Bypassing app sandboxing or using Accessibility to read messages the user did not themselves select.
- Any automated send/reply (see §1.5 — suggestion-only).

**In scope:** only data the user *deliberately surfaces themselves* — text they selected and copied
(clipboard), or a screenshot they chose to take (OCR fallback). The raw verbatim capture is always
stored as immutable **L0**; parsing is best-effort on top.

### 1.2 Three options

| Option | What it is | Effort | Robustness | Recommendation |
|---|---|---|---|---|
| **A. Manual export/import** | User selects messages in WeChat Desktop, copies, pastes into a `.txt`/`.md`, runs `capture --source wechat --file …`. | ~0 (works today) | High (no scraping) | **Ship as doc immediately.** Baseline that always works. |
| **B. Selected-chat clipboard/OCR capture** | A local CLI/hotkey reads the clipboard (or OCRs the visible window) right after the user selects + copies a conversation; parses into messages; stores raw L0. | Medium | Medium (clipboard format is fragile; OCR is a fallback) | **The MVP.** Clipboard-first, OCR deferrable. |
| **C. WeCom / enterprise API** | Official Work-WeChat (企业微信) APIs for org-managed accounts. | High; requires WeCom, not personal WeChat | High (sanctioned) | **Future only.** Document as the sanctioned path if the broker moves to WeCom. Not personal-WeChat. |

### 1.3 MVP design (Option B, clipboard-first)

Flow (suggestion-only, no send):

```
1. User opens WeChat Desktop, selects a conversation / range of messages, ⌘C.
2. User triggers the local hotkey / .command (or runs the CLI directly).
3. Adapter reads ONLY the clipboard (`pbpaste`) — the selected/visible text the user copied.
4. Raw verbatim clipboard text → immutable L0 (`capture --source wechat`, tagged `wechat-intake`).
5. Parser normalizes into messages: { sender, timestamp, text, attachments[], source_line }.
   - Parse is best-effort + confidence-scored; the verbatim L0 is retained regardless.
6. Optional `--review` → `note promote` seeds an L1 working note (enters the distill/review flow).
7. Downstream skill proposes (never writes silently): conversation summary, talking points,
   follow-up tasks, and client-preference facts — all via existing propose→accept paths.
```

**New surface:** `apps/wechat-capture` (`@sb/wechat-capture`), identity `surface:wechat-capture`,
modeled exactly on `apps/media-intake`. Its only route into core is `invoke()` →
`main(argv, io, "surface:wechat-capture")`. Least-privilege grant `[write:capture, read:notes]`
(add `write:notes` only for the `--review` story). **No** `write:secure_refs`, no facts/distill.

**Parser contract** (`parseWeChatClipboard(text) → { messages: WeChatMessage[], confidence }`):
```ts
interface WeChatMessage {
  sender: string | null;      // null when the bubble's sender can't be resolved
  timestamp: string | null;   // raw as seen; not coerced to ISO in v1
  text: string;
  attachments: string[];      // placeholder markers only: "[图片]"/"[Image]", "[链接]"/"[Link]", …
  source_line: number;        // 1-based line index in the raw clipboard text
}
```
- Pure, dependency-free, locale-aware (handles EN and ZH WeChat copy formats; macOS Chinese locale
  per the global rules). On low confidence the adapter still captures the verbatim L0 and flags
  `parse_low_confidence` — it never drops data.
- Attachments are **markers only** — clipboard copy yields placeholders, not files. Media that the
  client sends goes through `apps/media-intake` + the Drive archive (§2), referenced by id.

**OCR fallback (deferrable):** when text selection fails (some WeChat bubbles block selection), a
user-initiated screenshot of the frontmost WeChat window → macOS Vision OCR (e.g. a `shortcuts`
Quick Action or `ocrit`) → text → same `--source ocr` pipeline. Same privacy rule: only what the
user chose to screenshot.

**macOS launcher** (per the user's automation rules): a double-clickable `.command` / Quick Action
that calls the CLI with **absolute interpreter + tool paths** (Automator/Quick-Action PATH excludes
Homebrew), emits a "started" + "finished" `osascript` notification, and handles spaces/Unicode in
paths. No reading of WeChat internals — it only invokes the clipboard adapter.

### 1.4 Why clipboard, not automation of WeChat

WeChat Desktop has no stable export API and no accessibility tree we're willing to traverse. The
clipboard is the one channel that is (a) explicitly user-initiated, (b) free of any
scraping/decryption, and (c) format-stable enough to parse with a fallback to verbatim. This keeps
us on the right side of the privacy boundary by construction.

### 1.5 Future suggestive-reply architecture (NOT in MVP — design only)

When approved later (own epic), reply *suggestions* (never auto-send) would work as:

```
1. Retrieve PSB context LOCALLY: query the client's preference facts + recent thread
   (sb query / fact list) — minimal, scoped to this client only.
2. Redact: strip locators/secure_refs/contact details before any external call.
3. Call the LLM API (Claude) with ONLY the minimal necessary context (recent thread + retrieved
   facts). Key from env, never in repo. (See claude-api skill for model ids/pricing.)
4. Return 2–3 reply options as a PROPOSAL to stdout/UI.
5. Each option carries: source refs (which facts/notes informed it) + warnings
   (e.g. "verify current price/availability before quoting").
6. Human copies and sends manually. No write path to WeChat exists.
```
Lives in `domain-apps/broker` (reply suggestion is domain-specific) + a thin LLM adapter; the core
stays domain-neutral. Suggestion-only, confirmation-gated, no `surface:*`/`domain-app:*` send scope
is ever defined.

---

## 2. Media archive pipeline → Google Drive

### 2.1 Principles (confirmed against current media-intake)

- **RunPod stays for transcription.** No migration to GCP — there is no concrete reason, and the
  transcription path (`psb-media-transcriber` → transcript text) already feeds `media-intake`.
- Drive is **only the archive of original video/audio**. PSB stores **only an opaque reference**
  (`ref` or `secref`), never the binary — exactly as media-intake already enforces.
- **Credentials never enter the core.** The Drive uploader is a standalone adapter that returns an
  opaque pointer string; that pointer is then passed to the existing
  `media-intake ingest --media-ref/--media-secref`.

### 2.2 Two Drive workflows — distinguished

| | **A. Drive for Desktop sync-folder (MVP)** | **B. Drive API + OAuth (later)** |
|---|---|---|
| Mechanism | Copy original into a synced folder, e.g. `~/Library/CloudStorage/GoogleDrive-<account>/My Drive/PSB-Media/<media_id>/original.mp4`; Drive for Desktop syncs it. | Installed-app **OAuth desktop/loopback** flow uploads via the Drive API, returns a `fileId` + `webViewLink`. |
| Auth | None (uses the user's existing Drive for Desktop login). | OAuth desktop client (**not** an API key — API keys can't do per-user uploads). Tokens stored **outside the repo** (e.g. `~/.config/psb/drive/`), gitignored. |
| PSB reference | The local sync path → classified `local_private_path` → **auto-forced to a `secref`** by the existing `recordMediaReference`. | `fileId` (account-private) → passed via `--media-secref` → stored as a `secref`. |
| Pros | Zero auth code, ships fast, robust. | Stable canonical id, survives local-path changes, scriptable end-to-end. |
| Cons | Reference is a machine-local path; sync is eventually-consistent; not portable. | OAuth/token handling + consent screen; more moving parts. |

**Recommendation:** ship A first (it reuses the secref path with *zero* new security surface), then
add B as a drop-in uploader that returns a `fileId` instead of a path.

### 2.3 Pipeline shape

```
RunPod transcribe (unchanged) ─┬─► transcript.md (text)
                               └─► original media file (local)
                                      │
                  archive adapter (sync-folder copy  OR  Drive API upload)
                                      │  returns opaque pointer (path | fileId)
                                      ▼
        media-intake ingest --artifact-dir <dir> --media-secref <pointer>
                                      ▼
        L0 transcript (source:transcript) + media block { media_id, …, secref } ; --review → L1
```
The archive adapter is **outside** the enforced core (it only moves bytes / calls Google). The core
only ever sees the opaque pointer — the existing media-ref classifier turns it into a `secref`.

---

## 3. Proposed stories (atomic, ≤3 pts)

IDs continue from the broker epic (last used SB-094). On approval these become `story_backlog.md`
cards; until then they live here only (backlog workflow: no card goes `Ready` without OQ approval).

### EPIC-EXT-001 — WeChat selected-chat capture (suggestion-only)

| ID | Story | SP | Goal | Non-goals | Files likely to change | Tests | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| SB-095 | Manual export/import path (Option A) | 1 | Document the paste→`capture --source wechat` workflow; prove it works today. | No new code path. | `docs/workflows/wechat_capture.md`; small fixture test in a new `apps/wechat-capture` or under broker. | 1 test: pasted synthetic `.txt` → L0 `source:wechat`, verbatim, tagged. | Doc exists; a real pasted export captures to an immutable L0 with no parsing. |
| SB-096 | `surface:wechat-capture` grant | 1 | First-party registry entry, least-privilege `[write:capture, read:notes]`. | No `write:secure_refs`/facts/distill. | `packages/interfaces/src/grants.ts`; grants test. | Exact-table grant test; all other scopes `scope_denied`; ALWAYS_DENIED unobtainable; config-blind. | Surface holds exactly the two scopes; every other op denied byte-identically. |
| SB-097 | Clipboard → raw L0 adapter | 3 | `apps/wechat-capture` `capture` reads `pbpaste`, stores verbatim L0 (`source:wechat`, tag `wechat-intake`) via `invoke()`→ enforced dispatch. | No parsing yet; no OCR; no hotkey. | `apps/wechat-capture/src/{invoke,capture}.ts`, `index.ts`, package.json. | Happy path (clipboard text → one L0 + one event); empty clipboard fails closed; binary/oversized clipboard refused. | Verbatim clipboard captured as immutable L0; exactly one capture event; nothing parsed/dropped. |
| SB-098 | Message parser/normalizer | 3 | Pure `parseWeChatClipboard(text)` → `{messages[], confidence}` (EN+ZH); attachments as markers; `source_line` retained. | No ISO timestamp coercion; no OCR; raw L0 untouched. | `apps/wechat-capture/src/parse.ts` + tests + synthetic fixtures. | EN + ZH copy fixtures parse; low-confidence input still yields verbatim + `parse_low_confidence`; attachment markers detected. | Deterministic parse; never throws on garbled input; verbatim always retained. |
| SB-099 | `--review` L1 bridge | 2 | `--review` reuses `note promote` → L1 working note citing the L0 (enters distill/review). +`write:notes`. | No new writer path. | `apps/wechat-capture/src/capture.ts`; grant +`write:notes`; tests. | Fresh capture promotes one L1 citing L0; re-run never duplicates; L0 immutable. | L1 bridge works via the unchanged promote; idempotent. |
| SB-100 | macOS hotkey / `.command` launcher | 2 | Double-clickable `.command` / Quick Action calling the CLI with absolute paths + start/finish notifications. | No WeChat internals; no auto-send. | `scripts/wechat_capture.command`; `docs/workflows/wechat_capture.md`. | Manual run doc + a path-quoting/Unicode smoke (non-CI). | Launcher captures the current clipboard with notifications; works from Finder double-click. |
| SB-101 | OCR fallback (deferrable) | 3 | User-initiated WeChat-window screenshot → macOS Vision OCR → `--source ocr` pipeline. | Not on the gate path; no continuous capture. | `apps/wechat-capture/src/ocr.ts`; launcher option. | OCR-text fixture → same parse+capture path; failure falls back cleanly. | Selected-screenshot OCR feeds the same L0/parse path; opt-in only. |
| SB-102 | Downstream suggestion skill | 3 | Skill reads captured thread + client facts; proposes summary / talking points / follow-up tasks / preference facts — all via existing propose→accept (suggestion-only). | No auto-send; no silent writes; no LLM send path. | `skills/wechat-thread-review/`; broker glue; E2E safety test. | Propose-without-accept writes nothing; accepts carry provenance; L0/L1 byte-unchanged. | Suggestions are proposals only; human accepts through unchanged paths. |
| SB-103 | EPIC-EXT-001 gate | 2 | Gate: privacy boundary (no DB/scrape code), capture→parse→L1 round-trip, no-leak scan, suggestion-only, SB-074/077 re-asserted. | — | `apps/wechat-capture/test/wechat-capture-gate.test.ts`. | The gate suite. | All invariants green in root `pnpm test`. |

**EPIC-EXT-001 total ≈ 18 pts** (SB-101 deferrable; reply-assistant is a separate future epic).

### EPIC-EXT-002 — Media archive to Google Drive

| ID | Story | SP | Goal | Non-goals | Files likely to change | Tests | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| SB-104 | Drive sync-folder archiver (MVP) | 3 | Standalone adapter copies an original media file into a configured Drive-for-Desktop synced folder under `<media_id>/`, returns the opaque sync path. | No Drive API; no OAuth; not inside the core. | `apps/media-archive/src/sync_folder.ts` (or `scripts/`); config for the synced root. | Copy into a temp "synced" dir; returns path; refuses to overwrite; handles spaces/Unicode. | Original archived under `<media_id>/`; adapter returns an opaque pointer; no core change. |
| SB-105 | Wire archiver → media-intake ingest | 2 | Glue: transcribe (RunPod, unchanged) → archive original → `media-intake ingest --media-secref <path>`. Stored as `secref` (path is `local_private_path`). | No new core command; no auto-publish. | `scripts/media_archive_ingest.sh` (or a thin TS runner); docs. | End-to-end with a synthetic transcript + dummy media → L0 + media block with a `secref`; no binary in vault. | Transcript ingested with a Drive-backed secref reference; original never enters the vault. |
| SB-106 | Drive API OAuth uploader (later) | 3 | Installed-app **OAuth desktop/loopback** flow; tokens stored outside repo (gitignored); upload returns `fileId`. | No API key; no service account; no sharing/permission changes. | `apps/media-archive/src/drive_api.ts`; `~/.config/psb/drive/` (gitignored); `.env.example` note. | Auth/token-refresh unit tests with a mocked Drive client; pointer-shape test. | OAuth flow yields a token outside the repo; upload returns a `fileId`; credentials never logged/committed. |
| SB-107 | Use Drive `fileId` reference | 2 | Swap the sync-path pointer for the API `fileId` via `--media-secref`; stored as a `secref`. | No change to transcription; no public sharing. | `apps/media-archive/src/*`; docs. | `fileId` → secref round-trip; locator never leaks into note/event/output. | PSB stores only the opaque Drive `fileId` as a secref. |
| SB-108 | EPIC-EXT-002 gate | 2 | Gate: no binary in vault, pointer→secref leak scan, RunPod-unchanged assertion, credentials-outside-repo check. | — | `apps/media-archive/test/media-archive-gate.test.ts`. | The gate suite. | All invariants green; no secret/locator anywhere in the vault/events/output. |

**EPIC-EXT-002 total ≈ 12 pts** (SB-106/107 are the "later" API tier).

### EPIC-EXT-003 — Suggestive reply assistant (FUTURE, named only)

Not decomposed pending approval of §1.5. Named stories: *reply-context retrieval + redaction*,
*LLM adapter (env key, minimal context, 2–3 options + source refs + warnings)*,
*broker reply-suggest command (suggestion-only)*, *gate (no send path exists)*.

---

## 4. Recommended implementation order

1. **SB-095** — WeChat manual import doc (zero risk, immediate value; validates the contract).
2. **SB-096 → SB-097 → SB-098 → SB-099** — WeChat clipboard MVP (grant → capture → parse → review).
3. **SB-100** — macOS hotkey launcher (makes the MVP ergonomic).
4. **SB-104 → SB-105** — Drive sync-folder archive MVP (reuses the secref path; no new auth surface).
5. **SB-102** — WeChat downstream suggestion skill (depends on captured threads + client facts).
6. **SB-103** — close EPIC-EXT-001.
7. **Later tier:** SB-101 (OCR), SB-106 → SB-107 (Drive OAuth), SB-108, then EPIC-EXT-003 (reply assistant).

Rationale: ship the highest-value, lowest-risk paths first (doc + clipboard + sync-folder), defer
everything that adds an external-credential or fragile-automation surface (OCR, OAuth, LLM replies).

---

## 5. Risk table

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | **Privacy** — capturing more than the user intended, or touching WeChat's encrypted store. | CRITICAL | Hard boundary: clipboard/OCR of user-surfaced content **only**; no DB read/decrypt, no Accessibility scraping. Verbatim L0 + no-leak gate. Encoded as a gate test (SB-103) that greps the adapter for forbidden DB/scrape patterns. |
| R2 | **WeChat fragility** — clipboard/OCR format drifts across versions/locales; parse breaks. | HIGH | Parser is best-effort + confidence-scored; **verbatim L0 is always stored** regardless, so capture never fails on parse. EN+ZH fixtures; `parse_low_confidence` flag instead of data loss. |
| R3 | **OAuth / secrets** — leaking a Drive token or committing credentials. | HIGH | OAuth **desktop/loopback** flow, never an API key; tokens stored **outside the repo** (gitignored `~/.config/psb/drive/`); credentials never reach the core or logs; `.env.example` documents required vars; gate checks no secret in vault/events/output. |
| R4 | **Drive sync reliability** — eventually-consistent sync; a referenced path may not exist yet or moves. | MEDIUM | MVP stores the path as an opaque `secref` (provenance, not a hard dependency); document the sync-latency caveat; the later API tier (fileId) removes the local-path dependency. Archiver refuses to overwrite and namespaces by `media_id`. |
| R5 | **Accidental auto-send** — a future reply feature sends to a client without human action. | CRITICAL | **No send path exists and none is defined** in any grant. Reply assistant is suggestion-only (2–3 options, human copies/sends). Gate asserts no send scope/code path. Deferred to a separate epic. |
| R6 | **Scope creep into the core** — WeChat/Drive concepts leaking into `packages/core`/schemas. | MEDIUM | Both are adapters around the enforced dispatch; ADR-001 domain-neutral grep in each gate; `wechat`/`ocr` source kinds already exist, so no contract change for the MVP. |

---

## 6. Open questions (to file as OQ #48+ on review)

- **OQ #48** — WeChat MVP channel: confirm **clipboard-first, OCR deferrable** (vs OCR-first)?
- **OQ #49** — New surface `apps/wechat-capture` (mirroring media-intake) vs folding capture into
  the broker domain app? (Recommendation: a first-party `surface:*`, since capture is domain-neutral
  and the broker should *consume* the captured notes.)
- **OQ #50** — Drive MVP tier: confirm **sync-folder first**, OAuth API later?
- **OQ #51** — Where does the Drive archiver live: `apps/media-archive` (new) vs `scripts/`? (Recommendation:
  `apps/media-archive`, kept outside the enforced core; returns an opaque pointer only.)
- **OQ #52** — Reply assistant: defer entirely to EPIC-EXT-003 (suggestion-only), confirmed out of MVP?

---

*Design only. No source changed. Nothing committed. Awaiting approval to file OQ #48+ and move
SB-095 to `Ready`.*
