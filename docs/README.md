# Documentation Index

Owner of this index: Project owner (D-01)
Last updated: 2026-10-30

## Status definitions
- **Missing** — not written yet.
- **Draft** — written, not reviewed. May contain gaps; open questions are listed.
- **In Review** — circulated for comment.
- **Accepted** — approved by its owner; changes need a recorded update.

## Documents

| # | Document | Status | Owner | Purpose |
|--:|---|---|---|---|
| 1 | [`CLAUDE.md`](../CLAUDE.md) | Draft | Project owner | Claude Code entry point |
| 2 | `docs/README.md` (this file) | Draft | Project owner | Index |
| 3 | [`product/product-brief.md`](product/product-brief.md) | Draft | Project owner | Problem, users, scope, non-goals |
| 3a | [`product/glossary.md`](product/glossary.md) | Draft | Project owner | Terms the documents use inconsistently or leave undefined |
| 3b | [`product/owner-decisions-2026-10-27.md`](product/owner-decisions-2026-10-27.md) | Accepted | Project owner | Owner answers to open questions (D-01 to D-26) and follow-ups |
| 3c | [`product/mvp-scope.md`](product/mvp-scope.md) | Accepted | Project owner | What the MVP includes, what is post-MVP, MVP defaults for open questions (D-18), and the order of the MVP slices. Since D-20 the MVP is the Personal Training User view only |
| 3d | [`product/backlog.md`](product/backlog.md) | Draft | Project owner | Post-MVP items and deferred edge cases (D-18), including Coach and Head Coach (D-20); release-blocking tasks and the Skeleton checks to run before release (D-22) |
| 4 | [`product/requirements.md`](product/requirements.md) | Draft | Project owner | Testable REQ IDs |
| 5 | [`architecture/constraints-and-assumptions.md`](architecture/constraints-and-assumptions.md) | Draft | Project owner | Constraints, assumptions, open questions |
| 6a | [`product/user-journeys.md`](product/user-journeys.md) | Draft | Project owner | Actor journeys |
| 6b | [`../flow.md`](../flow.md) | Draft | Project owner | High-level flows |
| 7 | [`architecture/system-context.md`](architecture/system-context.md) | Draft | Project owner | System boundary, externals, trust boundaries |
| 8 | [`security/data-and-threat-model.md`](security/data-and-threat-model.md) | Draft | Project owner | Data categories, threats, controls |
| 9 | [`architecture/decisions/`](architecture/decisions/README.md) | Draft | Project owner | ADR index and template; ADR-0001 is Accepted (D-12), ADR-0002 and 0003 are Accepted (D-17), ADR-0004 to 0007 are Accepted (D-18), ADR-0008 is a planned slot |
| 10 | [`contracts/`](contracts/) | Draft | Project owner | For the Skeleton, Home and daily tracking, and Meal logging slices: [`data-model.md`](contracts/data-model.md), [`api-conventions.md`](contracts/api-conventions.md), [`error-model.md`](contracts/error-model.md). `integrations.md` is not needed yet |
| 11 | [`quality/test-strategy.md`](quality/test-strategy.md), [`definition-of-done.md`](quality/definition-of-done.md) | Accepted | Project owner | Verification; agreed with the Skeleton plan (2026-10-28) |
| 12 | [`operations/runbook.md`](operations/runbook.md) | Draft | Project owner | Local setup (install and check commands verified on the owner's PC; the rest not yet run), configuration names, paused project (D-16) |
| 13 | [`plans/skeleton-slice.md`](plans/skeleton-slice.md) | Accepted | Project owner | The Skeleton slice: steps, checks and progress (D-18 answer 14; development on the phone with EAS Build, D-19; steps 11–12 moved to the backlog and self-access authorization, D-20; steps run back to back, D-21; done with deferred checks, D-22) |
| 13a | [`data/food-list-sources.md`](data/food-list-sources.md) | Draft | Project owner | Where the IFCT 2017 food list (`data/foods/ifct2017-foods.csv`) comes from, how it was made and checked, and its licence: used without NIN permission, D-25, accepted risk R-007. Dishes: FitSphere's standard-recipe sheet, [`data/standard-recipe-sheet.csv`](data/standard-recipe-sheet.csv) (D-26, amended 2026-10-30; empty until the owner weighs the recipes), and the dish sources considered and not used |
| 13b | [`sources/README.md`](sources/README.md) | Draft | Project owner | The NIN documents read on 2026-10-29 and 2026-10-30: where each came from, its SHA-256 and its terms, for Legal's review (Q-049). The PDFs are kept outside the repository |
| 14 | [`plans/home-daily-tracking-slice.md`](plans/home-daily-tracking-slice.md) | Accepted | Project owner | Slice 2, Home and daily tracking: scope, MVP defaults, steps, checks and progress (D-23), including `npm run dev:phone` (D-22). Built; the owner's checks are pending |
| 15 | [`plans/meal-logging-slice.md`](plans/meal-logging-slice.md) | Accepted | Project owner | Slice 3, Meal logging (no AI): scope, decisions, steps, progress and phone checks (D-26). Built except step 8 (dishes, waiting for the owner's weighed standard-recipe sheet; D-26 answer 3, amended 2026-10-30). Migrations, the food import, photo storage (`check:storage` 8 of 8 from the PC) and `OFF_CONTACT` are done on `fitsphere-dev`; the phone checks are pending |

## Inputs (read-only)
- [`product/source/business-requirements.txt`](product/source/business-requirements.txt) — original BRD.
  `requirements.md` is derived from it and is now the authoritative version.
- [`pre-development-guide.md`](pre-development-guide.md) — the process this repository follows.

## Owners
The project owner (sole developer) owns and approves every document. Legal compliance has a
separate owner, Legal, because it cannot be self-certified (D-01).
