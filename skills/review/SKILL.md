---
name: review
description: >-
  Periodic review of the Second Brain. Use when the user asks to "review my
  notes", "what needs attention", "process my inbox", or wants a weekly/daily
  review pass. Surfaces candidates with DETERMINISTIC read-only queries (aged
  inbox notes, never-promoted raws, stale tasks), proposes one action per
  candidate, and applies only human-confirmed actions via existing CLI
  commands. Writes nothing on its own.
---

# Review — deterministic candidates, human-confirmed actions

This skill is the **agent workflow layer** for periodic review. It is **not** the backend: every
candidate comes from a documented read-only query, and every action is an existing human-confirmed
CLI command. A review pass with zero confirmations writes zero bytes.

## Non-negotiable safety rules

1. **Candidates come from deterministic queries only (OQ #25).** The three queries below are the
   v1 scope. No hidden heuristics, no model-decided candidate sets — if it isn't reachable by the
   documented commands, it is not a candidate.
2. **Every action maps to an existing human-confirmed command.** This skill introduces no write
   surface: promote → `sb note promote`; distill → the distill skill (`distill propose/accept`);
   correct a fact → `sb fact add --supersedes` (or the extract-facts skill); compose →
   the compose-output skill. Nothing else.
3. **No action without explicit per-item confirmation.** Present the review table; the user picks
   which actions to apply. Skipping everything is a valid outcome.
4. **Never delete, never edit sources.** Review recommends; it does not clean up.

## The three candidate queries (v1, OQ #25)

Run all three read-only; N defaults to 7 days unless the user says otherwise.

1. **Aged inbox** — L1 working notes sitting in `00_Inbox` older than N days:
   `sb note list --type working` then compare each note's frontmatter `created` against now − N.
2. **Never-promoted raws** — L0 raw notes no working note cites: `sb note list --type raw` and
   `sb note list --type working`; flag raw ids that appear in no working note's `source_ref`.
3. **Stale tasks** — task notes whose `status` has not changed in N days: `sb note list` for notes
   with a `status` field; compare `updated` (or `created` when never updated) against now − N.

Optionally enrich a candidate's context with `sb query "<topic>"` (read-only) before recommending.

## Workflow

### 1. Gather candidates (read-only)

Run the three queries; build a `review` proposal (`proposal.schema.json` envelope,
`workflow: "review"`, version 1) with one item per candidate:

```json
{
  "workflow": "review",
  "version": 1,
  "proposed_at": "<ISO-8601 now>",
  "items": [
    {
      "candidate_id": "<note ULID>",
      "query": "aged_inbox | never_promoted_raw | stale_task",
      "recommendation": "promote | distill | supersede_fact | compose_output | leave",
      "reason": "One line grounded in the candidate's own content/dates"
    }
  ]
}
```

### 2. Present the review

Show the table (candidate, which query surfaced it, recommendation, reason). Recommendations are
advisory; `leave` is always offered.

### 3. Apply ONLY confirmed actions

Per confirmed item, run the mapped existing command/skill (rule 2). One confirmation per item — a
blanket "do all" still gets a final list shown before anything runs.

## Out of scope

- Scheduling/cadence automation (the user invokes review).
- New candidate heuristics, scoring models, or CLI surface.
- Deleting/archiving anything.

## Safety check

Enforced by `apps/cli/test/review-safety.test.ts` (run under `pnpm test`): the three candidate
queries are reproducible read-only operations (asserted against a fixture workspace, including the
never-promoted-raw set difference), and a full review pass without confirmations leaves the vault,
all event streams, and the projections byte-identical.
