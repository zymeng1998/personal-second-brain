# Open-Source Second Brain Evaluation

Research conducted 2026-06-03 to decide build-vs-fork-vs-combine and what to borrow. Scores are
1–5; for **lock_in_risk** and **complexity_risk**, *lower is better*; all others *higher is better*.

## License safety rule (applies throughout)

> **Do not copy source code from AGPL, GPL, unspecified-license, or unclear-license repositories.
> Reference architecture and ideas only unless license compatibility is verified.**

This applies especially to **Khoj** (AGPL-3.0), **flepied/second-brain-agent** (GPL-3.0),
**sspaeti/obsidian-note-taking-assistant** (license unspecified), and **coleam00/second-brain-skills**
(no stated license). Apache-2.0 / MIT repos (mem0, ReMe, eugeniughelbur, COG, jamesmcroft) may be
reused subject to attribution.

## Scorecard

| Repo | local | open_fmt | obsidian | arch | domain_indep | retrieval | agent | reuse | lock_in↓ | cplx↓ | License | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| sspaeti/obsidian-note-taking-assistant | 5 | 5 | 5 | 4 | 5 | 5 | 2 | 5 | 1 | 2 | unspecified⚠ | BORROW (design) |
| jamesmcroft/obsidian-ai-second-brain | 5 | 5 | 5 | 3 | 4 | 1 | 3 | 4 | 1 | 1 | MIT | BORROW (template) |
| eugeniughelbur/obsidian-second-brain | 5 | 5 | 5 | 4 | 4 | 2 | 5 | 4 | 2 | 3 | MIT | BORROW patterns / AVOID auto-rewrite |
| flepied/second-brain-agent | 4 | 4 | 4 | 4 | 5 | 4 | 3 | 4 | 3 | 3 | GPL-3.0⚠ | REFERENCE |
| mem0ai/mem0 | 4 | 3 | 2 | 4 | 4 | 4 | 4 | 4 | 2 | 3 | Apache-2.0 | REFERENCE (memory model) |
| agentscope-ai/ReMe | 4 | 4 | 3 | 4 | 4 | 4 | 4 | 4 | 2 | 3 | Apache-2.0 | REFERENCE (memory-as-files) |
| huytieu/COG-second-brain | 5 | 5 | 4 | 4 | 3 | 2 | 5 | 3 | 2 | 4 | MIT | REFERENCE / AVOID self-evolve |
| khoj-ai/khoj | 4 | 3 | 4 | 4 | 4 | 5 | 3 | 2 | 4 | 4 | AGPL-3.0⚠ | STUDY (optional surface later) |
| coleam00/second-brain-skills | 4 | 4 | 2 | 4 | 3 | 1 | 4 | 3 | 1 | 2 | none⚠ | REFERENCE (skill authoring) |
| decodingai/second-brain-ai-assistant-course | 2 | 2 | 1 | 4 | 4 | 5 | 3 | 3 | 2 | 5 | MIT | STUDY (RAG technique) |

## Per-candidate notes

### sspaeti/obsidian-note-taking-assistant — **BORROW (design)**
Fully local CLI + web app: BGE-M3 (1024-d) embeddings in DuckDB + VSS (HNSW), plus a wikilink graph
and tag hyperedges. Dual retrieval: graph traversal (backlinks/connections), semantic search, and
"hidden connections" (semantically similar but unlinked). ~57★, license unspecified.
- **Borrow:** the entire retrieval-sidecar blueprint (DuckDB VSS + BGE-M3 + graph + hyperedges).
- **Avoid:** copying source until license is verified — **port the design**, write our own code.
- **Risk:** small/young project; verify license before any code reuse.

### jamesmcroft/obsidian-ai-second-brain — **BORROW (template)**
MIT starter template: PARA + CODE folders, typed YAML frontmatter, `_Templates/`, README-as-AI-grounding.
~15★, small but directly aligned.
- **Borrow:** vault folder layout, frontmatter schema, note templates, README-as-grounding idea.
- **Avoid:** expecting any retrieval/runtime — it's a template only.

### eugeniughelbur/obsidian-second-brain — **BORROW patterns / AVOID behavior**
MIT Claude-Code skill (also Codex/Gemini/OpenCode), ~2k★, active. 43 commands; `raw/` immutable layer;
AI-readable frontmatter + recency markers; scheduled background agents.
- **Borrow:** skill/command taxonomy, AI-readable frontmatter, `raw/` immutability (→ our L0).
- **Avoid:** "every source rewrites existing pages" + "contradictions reconcile automatically" —
  violates our raw-immutability, no-silent-mutation, human-in-the-loop rules.

### flepied/second-brain-agent — **REFERENCE**
GPL-3.0, ~298★, BASB-inspired. Pipeline MD→chunk→embed→ChromaDB→**MCP server**; follows links to
ingest PDFs/YouTube/web. Last release 2024.
- **Borrow (ideas only, GPL):** MCP-server-as-interface pattern; link-following ingestion pipeline.
- **Avoid:** copying code (GPL); ChromaDB (we prefer DuckDB); staleness.

### mem0ai/mem0 — **REFERENCE (memory model)**
Apache-2.0, ~57k★. Multi-level scoping (user/session/agent), single-pass **ADD-only** extraction,
temporal reasoning, entity linking, hybrid vector+BM25.
- **Borrow:** ADD-only non-destructive memory, scoping, provenance/temporal, entity linking → fact-store design.
- **Optionally embed** the Python lib in the AI/fact sidecar later (license-friendly).

### agentscope-ai/ReMe — **REFERENCE (memory-as-files)**
Apache-2.0, ~3k★. "Memory as editable Markdown files" (ReMeLight) + vector mode; hybrid retrieval
(~70% vector / 30% BM25); local backends.
- **Borrow:** memory-as-files alignment with our vault; hybrid retrieval weighting.

### huytieu/COG-second-brain — **REFERENCE / AVOID self-evolve**
MIT, ~517★. Cognition+Obsidian+Git; 17 skills, 6 worker agents (cheap model for I/O, strong for
reasoning), `AGENTS.md` multi-CLI fallback; daily braindump; CRM/PM baked in.
- **Borrow:** worker-agent orchestration split; `AGENTS.md` pattern; daily braindump workflow.
- **Avoid:** self-evolving/auto-organize/self-healing-without-review; baked-in CRM/PM (too opinionated).

### khoj-ai/khoj — **STUDY (optional surface later)**
AGPL-3.0, ~35k★, mature. Self-hostable AI app; multi-LLM; semantic search; Obsidian plugin; owns its
own Postgres/index.
- **Role:** study; *optionally* self-host later as a retrieval/chat **surface** pointed at the vault.
- **Avoid:** core dependency — AGPL is viral; heavy monolith owning its own store.

### coleam00/second-brain-skills — **REFERENCE (skill authoring)**
~753★, no stated license. Actually a content-creation skill pack (brand/pptx/video/SOP/skill-creator/
MCP-client), loosely "second brain."
- **Borrow (ideas only):** skill-authoring conventions, progressive context disclosure, lightweight MCP-client wrapper.
- **Avoid:** treating it as a KB base; confirm license before any reuse.

### decodingai/second-brain-ai-assistant-course — **STUDY (RAG technique)**
MIT, ~2.8k★. Course: RAG (contextual + parent retrieval), LLMOps, smolagents, fine-tuning; Notion +
MongoDB + ZenML.
- **Borrow:** advanced retrieval techniques + eval/LLMOps discipline.
- **Avoid:** as a base — cloud-heavy stack conflicts with local-first.

## Also considered (inspiration only)
- **Logseq** — local-first outliner; inspiration for block-level structure, not a dependency.
- **mindverse/Second-Me** — local AI identity; inspiration, not a dependency.
- **Karpathy LLM-Wiki pattern / SwarmVault** — wiki-as-context-for-LLMs framing; informs AI-readable notes.

## Conclusion: combine

Build the thin core from scratch (contracts + Markdown vault + event log — small surface area).
**Port** sspaeti's retrieval design and **reference** mem0/ReMe memory model, flepied's MCP/ingestion
ideas, jamesmcroft's templates, and eugeniughelbur/COG skill patterns into the sidecars/skills later.
Do **not** fork any single repo as the foundation. See ADRs 001–007.
