# Documentation Index

Owner of this index: Project owner (D-01)
Last updated: 2026-11-03

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
| 3b | [`product/owner-decisions-2026-10-27.md`](product/owner-decisions-2026-10-27.md) | Accepted | Project owner | Owner answers to open questions (D-01 to D-35) and follow-ups |
| 3c | [`product/mvp-scope.md`](product/mvp-scope.md) | Accepted | Project owner | What the MVP includes, what is post-MVP, MVP defaults for open questions (D-18), and the order of the MVP slices. Since D-20 the MVP is the Personal Training User view only |
| 3d | [`product/backlog.md`](product/backlog.md) | Draft | Project owner | Post-MVP items and deferred edge cases (D-18), including Coach and Head Coach (D-20); release-blocking tasks and the Skeleton checks to run before release (D-22) |
| 4 | [`product/requirements.md`](product/requirements.md) | Draft | Project owner | Testable REQ IDs |
| 5 | [`architecture/constraints-and-assumptions.md`](architecture/constraints-and-assumptions.md) | Draft | Project owner | Constraints, assumptions, open questions |
| 6a | [`product/user-journeys.md`](product/user-journeys.md) | Draft | Project owner | Actor journeys |
| 6b | [`../flow.md`](../flow.md) | Draft | Project owner | High-level flows |
| 7 | [`architecture/system-context.md`](architecture/system-context.md) | Draft | Project owner | System boundary, externals, trust boundaries |
| 8 | [`security/data-and-threat-model.md`](security/data-and-threat-model.md) | Draft | Project owner | Data categories, threats, controls |
| 8a | [`legal/q-049-legal-brief.md`](legal/q-049-legal-brief.md) | Draft | Project owner; answers: Legal | The questions for Legal's review before real users (Q-049: personal data, IFCT 2017 and NIN's terms, the dish method, Open Food Facts' ODbL) and the evidence checklist. Not yet reviewed by Legal |
| 8b | [`legal/account-deletion-page.md`](legal/account-deletion-page.md) | Draft | Project owner; review: Legal | The text of the public page that explains how to delete an account and how to ask for deletion by email (REQ-ACC-009, Google Play; D-31). Its open points (email address, periods, what is kept) are marked; published only after Legal's review and RB-04 |
| 9 | [`architecture/decisions/`](architecture/decisions/README.md) | Draft | Project owner | ADR index and template; ADR-0001 is Accepted (D-12), ADR-0002 and 0003 are Accepted (D-17), ADR-0004 to 0007 are Accepted (D-18), ADR-0008 is a planned slot |
| 10 | [`contracts/`](contracts/) | Draft | Project owner | For the Skeleton, Home and daily tracking, Meal logging, Training and Settings slices: [`data-model.md`](contracts/data-model.md), [`api-conventions.md`](contracts/api-conventions.md), [`error-model.md`](contracts/error-model.md). `integrations.md` is not needed yet |
| 11 | [`quality/test-strategy.md`](quality/test-strategy.md), [`definition-of-done.md`](quality/definition-of-done.md) | Accepted | Project owner | Verification; agreed with the Skeleton plan (2026-10-28) |
| 12 | [`operations/runbook.md`](operations/runbook.md) | Draft | Project owner | Local setup (install and check commands verified on the owner's PC; the rest not yet run), configuration names, paused project (D-16) |
| 13 | [`plans/skeleton-slice.md`](plans/skeleton-slice.md) | Accepted | Project owner | The Skeleton slice: steps, checks and progress (D-18 answer 14; development on the phone with EAS Build, D-19; steps 11–12 moved to the backlog and self-access authorization, D-20; steps run back to back, D-21; done with deferred checks, D-22) |
| 13a | [`data/food-list-sources.md`](data/food-list-sources.md) | Draft | Project owner | Where the IFCT 2017 food list (`data/foods/ifct2017-foods.csv`) comes from, how it was made and checked, and its licence: used without NIN permission, D-25, accepted risk R-007. Dishes: FitSphere's standard-recipe sheet, [`data/standard-recipe-sheet.csv`](data/standard-recipe-sheet.csv) (D-26, amended 2026-10-30; empty until the owner weighs the recipes), and the dish sources considered and not used |
| 13c | [`data/exercise-list-sources.md`](data/exercise-list-sources.md) | Draft | Project owner | FitSphere's exercise list (`data/exercises/exercise-list.csv`, D-50): how it was written, its eight types, and the 2024 Adult Compendium of Physical Activities' METs it uses, with their codes and pages, and the speed bands for running, walking and cycling (accepted risk R-011) |
| 13b | [`sources/README.md`](sources/README.md) | Draft | Project owner | The NIN documents read on 2026-10-29 and 2026-10-30: where each came from, its SHA-256 and its terms, for Legal's review (Q-049). The PDFs are kept outside the repository |
| 14 | [`plans/home-daily-tracking-slice.md`](plans/home-daily-tracking-slice.md) | Accepted | Project owner | Slice 2, Home and daily tracking: scope, MVP defaults, steps, checks and progress (D-23), including `npm run dev:phone` (D-22). Built; the owner's checks are pending |
| 15 | [`plans/meal-logging-slice.md`](plans/meal-logging-slice.md) | Accepted | Project owner | Slice 3, Meal logging (no AI): scope, decisions, steps, progress and phone checks (D-26). Every step is merged, step 8 (dishes, D-28) on 2026-10-30; a dish goes live only when its recipe row is measured and approved by the owner (none yet). Migrations up to 0005, the food import, photo storage (`check:storage` 8 of 8 from the PC) and `OFF_CONTACT` are done on `fitsphere-dev`; migrations 0006 and 0007 and a new food import are still to run there; the phone checks are pending |
| 16 | [`plans/training-slice.md`](plans/training-slice.md) | Accepted | Project owner | Slice 4, Training: scope, MVP defaults, steps, checks and progress (D-29). Built in parallel with slice 3 and merged after it on 2026-10-30 (#23, #25, #27, #28); migration 0007 on `fitsphere-dev` and the owner's checks are pending |
| 17 | [`plans/progress-slice.md`](plans/progress-slice.md) | Accepted | Project owner | Slice 5, Progress: scope, decisions, MVP defaults, steps, checks and progress (D-30). Built beside slice 6; reads existing data only (no server change, no migration). Merged on 2026-10-30 (#41, #42, #44); automated checks pass; the phone checks are deferred to before the release (D-32: backlog S5-01 to S5-07) |
| 18 | [`plans/settings-slice.md`](plans/settings-slice.md) | Accepted | Project owner | Slice 6, Settings and account: scope, MVP defaults, steps, checks and progress (D-31). Built in parallel with slice 5; merged on 2026-10-30 and 2026-10-31 (#43, #45, #46, #47, #48); automated checks pass. Pending, by the owner: the secret key and migration 0008. The phone checks are deferred to before the release (D-32: backlog S6-01 to S6-09) |
| 19 | [`design/design-system.md`](design/design-system.md), [`design/FitSphere-UI-UX-context.md`](design/FitSphere-UI-UX-context.md) | Accepted | Project owner | The app's design language (D-35): palette, colour tokens, type, shape, components, UX principles and copy rules; Lucide icons and the Barlow fonts. Sections 5, 7 and 8 of the context file are examples only. The app follows it from the redesign's first screen (branch `ui-redesign`) |
| 20 | [`plans/ui-redesign.md`](plans/ui-redesign.md) | Draft | Project owner | The UI redesign: modules, the design-lock-build loop per screen, the foundation (tokens, fonts, icons, one new development build), conflicts with the project's rules, progress. The whole app's colours and fonts change at once (owner, 2026-11-03) |
| 21 | [`plans/household-units.md`](plans/household-units.md) | Accepted | Project owner | Household units for a listed food's amount (D-36): teaspoon, tablespoon, katori, glass and piece, from the owner's measured sheet [`data/household-measures-sheet.csv`](data/household-measures-sheet.csv) (starter rows pending, no grams). Built on `ui-redesign`; migration 0009 and the import on `fitsphere-dev` and the measurements are the owner's |
| 22 | [`plans/user-profile.md`](plans/user-profile.md) | Accepted | Project owner | The profile (D-38, REQ-ACC-011): the user's photo, name, date of birth, sex, height, phone and address in Settings, the weight as the latest weigh-in, the email read-only. Built on `ui-redesign`; migration 0010 on `fitsphere-dev` is the owner's, before the updated API runs |
| 24 | [`plans/packaged-foods.md`](plans/packaged-foods.md) | Accepted | Project owner | Packaged foods (D-48, ADR-0009): Open Food Facts' products sold in India, searchable by name and brand |
| 25 | [`plans/exercise-list.md`](plans/exercise-list.md) | Accepted | Project owner | The exercise list (D-50, REQ-TRN-003): a picker over FitSphere's own 334 exercises, eight types including cardio, each set on its own row, calories burned (MET estimate or typed, Training only) and heart rate. Migration 0016 and `exercises:import` on `fitsphere-dev` are the owner's |
| 23 | [`plans/more-foods.md`](plans/more-foods.md) | Accepted | Project owner | More foods (D-39): USDA FoodData Central's FNDDS foods with their servings, your own food in any unit, and My foods (REQ-LOG-011). Migration 0011 and `foods:import` on `fitsphere-dev` are the owner's |

## Rules and policies
Provided by the owner on 2026-11-02 and kept as given, in
[`prerequisitesDoc/`](prerequisitesDoc/); not yet reviewed against the documents above.
- [`ai-usage-policy.md`](prerequisitesDoc/ai-usage-policy.md) — AI usage policy.
- [`architecture-decision-framework.md`](prerequisitesDoc/architecture-decision-framework.md) —
  application architecture decision framework.
- [`code-review-rules.md`](prerequisitesDoc/code-review-rules.md) — code review rules.
- [`it-standard-rules.md`](prerequisitesDoc/it-standard-rules.md) — standard IT rules: generic code
  practices.
- [`release-rules.md`](prerequisitesDoc/release-rules.md) — release rules.
- [`sdlc-rules.md`](prerequisitesDoc/sdlc-rules.md) — SDLC rules.
- [`security-privacy-policy.md`](prerequisitesDoc/security-privacy-policy.md) — security and
  privacy policy.
- [`testing-rules.md`](prerequisitesDoc/testing-rules.md) — standard IT testing rules.

## Inputs (read-only)
- [`product/source/business-requirements.txt`](product/source/business-requirements.txt) — original BRD.
  `requirements.md` is derived from it and is now the authoritative version.
- [`pre-development-guide.md`](pre-development-guide.md) — the process this repository follows.
- [`design/reference-fitsphere/`](design/reference-fitsphere/README.md) — the F0x UI designs of a
  separate FitSphere spec, kept as examples of the design language only (D-35): their features are
  not built and their decisions not applied here.

## Owners
The project owner (sole developer) owns and approves every document. Legal compliance has a
separate owner, Legal, because it cannot be self-certified (D-01).
