# PARA Mapping

PARA (Projects, Areas, Resources, Archives) as realized in the vault. Plus a few system folders that
support the layered memory model. **Domain-neutral** — no broker/domain folders here.

## Folder map

| Folder | PARA role | Definition | Layer(s) |
|---|---|---|---|
| `00_Raw/` | — | Immutable raw capture (source of truth) | L0 |
| `00_Inbox/` | — | Unprocessed queue awaiting triage | L1 (transient) |
| `10_Projects/` | **Projects** | Short-term efforts with a goal & end | L1/L2 |
| `20_Areas/` | **Areas** | Ongoing responsibilities to maintain | L1/L2 |
| `30_Resources/` | **Resources** | Topics/reference of ongoing interest | L1/L2 |
| `40_Archives/` | **Archives** | Inactive items from the other three | L1/L2 |
| `50_Entities/` | (cross-cutting) | People/orgs/places/concepts notes | L2 |
| `60_Outputs/` | (cross-cutting) | Generated drafts/reports (cite sources) | L5 |
| `70_Daily/` | (cross-cutting) | Daily notes / braindumps | L1 |
| `80_Wiki/` | (cross-cutting) | Evergreen/concept notes | L2 |
| `90_System/` | (cross-cutting) | Templates, config, schema copies | — |

## Why extra folders beyond PARA

PARA organizes *actionability*; the second brain also needs places for **entities** (graph anchors),
**outputs** (L5), **daily capture** (CODE entry point), **evergreen wiki** (L2), and **system**
(templates/schemas). These are cross-cutting, not a replacement for PARA.

## Movement rules

- New material lands in `00_Inbox/` (or `70_Daily/` for braindumps); raw original goes to `00_Raw/`.
- Triage moves notes into Projects/Areas/Resources.
- Completed/inactive → `40_Archives/` (never deleted automatically).
- Entities referenced across notes get a note in `50_Entities/` and `[[wikilinks]]`.

## Domain independence

Domain-specific structures (e.g. broker "clients", "listings") are **not** PARA folders. A domain app
maps its concepts onto core notes/entities/facts via `interfaces`, storing domain data under
`domain-apps/`. The core vault never grows domain folders.
