# @sb/adapters

Ingestion adapters that normalize an input source into **L0 raw + a capture event**. All adapters
produce the same capture contract regardless of source.

- Status: **Phase 0 — no code.** MVP ships **manual paste** only.
- Later: email, WeChat/WeCom, screenshots/OCR, voice memos, browser clips, Google Drive, Gmail.
- Adapters never write distilled notes or facts directly — they only capture (L0) + emit events.

Domain-neutral. A domain app may add domain-specific adapters under `domain-apps/`, but they still
produce core captures via `interfaces`.
