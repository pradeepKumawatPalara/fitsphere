# Project Instructions for Claude Code

## Purpose
FitSphere is a coach-led fitness app. Clients log food, body metrics and workouts against
targets set by their coach; Coaches manage their trainees; Head Coaches manage Coaches.
**The MVP delivers only the Personal Training User view (D-20):** users set their own targets;
Coach and Head Coach are post-MVP.

## Current phase
**Slice 3, Meal logging (no AI) — in progress (D-26, 2026-10-29).** Plan:
`docs/plans/meal-logging-slice.md` (Accepted). Its pull requests build on #18 (D-24), which is
merged first. The owner's actions (migrations and the food import, the Storage bucket and keys,
the Open Food Facts contact, the EAS build) and the phone checks are batched at the end of the
slice.

**Slice 2, Home and daily tracking — built, waiting for the owner (D-23, 2026-10-29).** Plan:
`docs/plans/home-daily-tracking-slice.md` (Accepted). Steps 1 to 7 (pull requests #11 to #17) are
merged; step 8 (D-24: the Measurements card shows and edits a date's measurements, changing Q-026)
is its own pull request. Then the owner applies migration 0002 to
`fitsphere-dev` (`npm run migrate -w @fitsphere/api`) and runs the slice's batched phone checks,
starting the API, the tunnel and Expo with `npm run dev:phone` (D-22). **Next:** slice 3, Meal
logging (no AI); it gets its own plan in `docs/plans/`, approved before any code. One branch and
pull request per step; CI must pass before merge.

**Skeleton slice — done with deferred checks (D-22, 2026-10-29).** Steps 1 to 10 are merged
(`docs/plans/skeleton-slice.md`). Its pending phone checks are backlog SC-01 to SC-13, to run
before the release (accepted risk R-006).

**Builds and devices (D-19).** No Android Studio, emulator or local Android builds. Development
builds come from EAS Build (`development` profile) and run on the owner's phone. Rebuild only when
native code changes, and **tell the owner before every cloud build** (free plan: 15 Android
builds a month). Live code: `npx expo start --dev-client --tunnel`. Checks that need a cable are
marked "USB + adb". The phone reaches the API on the PC through a Cloudflare Quick Tunnel, only
while testing, with test data only, closed after use; **never commit the tunnel's address**
(D-19 answer 6, runbook step 8).

**Personal Training User only (D-20).** No Coach or Head Coach roles, invitations, links, Head
Coach permission, Notifications list or push in the MVP; the role selector is hidden. Keep the
data model able to add links later without rework, but build no link or permission features or
screens. Authorization tests cover self-access and "no other user's data". Slices, in order:
Skeleton; Home and daily tracking; Meal logging (no AI); Training; Progress; Settings and
account; AI meal reading; Release (`mvp-scope.md` section 5).

**MVP first (D-18).** Build the basic product in `docs/product/mvp-scope.md`, Android first.
Post-MVP work and deferred edge cases go to `docs/product/backlog.md`. When an open question
that does not block safety or privacy has no answer, pick the simplest option that keeps every
invariant, record it as an "MVP default" in the pull request and in
`docs/architecture/constraints-and-assumptions.md`, and continue without asking. Never weaken
the invariants, owner decisions, privacy rules or accepted ADRs; those need the owner.

Approved stack:
- Mobile client: React Native with Expo, TypeScript (ADR-0001, Accepted — D-12).
- Backend: a TypeScript Node.js API, the only path to the data; Supabase's Data API is turned
  off (ADR-0002, Accepted — D-17).
- Database and file storage: Supabase PostgreSQL and Supabase Storage in Mumbai, on the Free
  plan in phase 1 with no backups (ADR-0002, ADR-0003, Accepted — D-17; D-16, R-005).
- API host: Google Cloud Run in Mumbai once Q-087 is settled; until then the API runs locally.
- Sign-in and authorization: Supabase Auth, with every request authorized by one access module
  in the Node API; email through Resend from a domain FitSphere owns (still required at the MVP
  release, D-20); Expo push, post-MVP (ADR-0004, Accepted — D-18).
- AI meal reading: Gemini 3.1 Flash-Lite on the paid tier, through one AI module; voice is
  recognised on the phone only (ADR-0005, Accepted — D-18). Paid use needs the owner's sign-off
  on billing and the monthly cap (C-008, Q-087).
- Food data: FitSphere's own food list plus Open Food Facts for barcodes (ADR-0006, Accepted —
  D-18).
- Offline: Expo SQLite on the phone, an outbox and one sync endpoint (ADR-0007, Accepted — D-18).

The validation steps of ADR-0001 to ADR-0007 run in the first slices.
Not approved yet: audio/video media storage (ADR-0008).
Do not scaffold an app, add dependencies or pick frameworks until the relevant ADRs in
`docs/architecture/decisions/` are marked **Accepted** by the decision owner.

## Before real users
Release-blocking, not done yet (D-22; backlog "Release-blocking tasks"). Do them only when the
owner says so:
- RB-01: delete the GitHub copy of the branch `local/test-no-email`, which holds a test password.
  Leave the owner's local branch alone.
- RB-02: delete the Supabase test user that uses that password.
- RB-03: make sure Supabase **Confirm email** is on.

Also before the release: the Skeleton checks SC-01 to SC-13 (R-006), Legal's review (Q-049) and
email through Resend from FitSphere's domain (D-20).

## Sources of truth
- Documentation index and status: `docs/README.md`
- Product scope: `docs/product/product-brief.md`
- MVP scope and defaults (D-18, Accepted): `docs/product/mvp-scope.md`
- Backlog (post-MVP items, deferred edge cases): `docs/product/backlog.md`
- Requirements (REQ IDs): `docs/product/requirements.md`
- User journeys: `docs/product/user-journeys.md`
- Constraints, assumptions, open questions, risks (C-/A-/Q-/R- IDs): `docs/architecture/constraints-and-assumptions.md`
- Owner decisions (D- IDs, Accepted): `docs/product/owner-decisions-2026-10-27.md`
- Glossary: `docs/product/glossary.md`
- System context (Draft): `docs/architecture/system-context.md`
- Data and threat model, including the permission matrix (Draft): `docs/security/data-and-threat-model.md`
- System flows: `flow.md`
- Decisions: `docs/architecture/decisions/`
- Always-on invariants: `.claude/rules/project-invariants.md`
- Original business requirements (input, not edited): `docs/product/source/business-requirements.txt`
- Food list sources (IFCT 2017; used without NIN permission, D-25, accepted risk R-007):
  `docs/data/food-list-sources.md`
- Contracts for the Skeleton slice (Draft): `docs/contracts/data-model.md`, `api-conventions.md`,
  `error-model.md`
- Verification (Accepted with the Skeleton plan): `docs/quality/test-strategy.md`, `definition-of-done.md`
- Current slice plan (Accepted): `docs/plans/meal-logging-slice.md`; earlier slices:
  `docs/plans/home-daily-tracking-slice.md`, `docs/plans/skeleton-slice.md`
- Runbook (Draft — local setup, configuration names, paused project): `docs/operations/runbook.md`

If a referenced document does not exist, state that it is missing; do not invent its contents.

## Working rules
1. Inspect the actual repository before proposing changes.
2. Read relevant requirements, rules, contracts and accepted ADRs before implementation.
3. Do not invent requirements, provider capabilities, benchmark results or security guarantees.
   If the requirements are ambiguous, check the Q- list and `mvp-scope.md`. Apply D-18 to
   questions that do not block safety or privacy; ask about the rest. Never guess silently.
4. For major choices, compare options against documented constraints and obtain human approval.
5. Do not silently change an Accepted ADR; propose a replacement ADR.
6. Treat health, body and meal data as sensitive in code, logs, tests, fixtures and output.
   Use synthetic data only.
7. Add or update tests for behavior changes.
8. Run relevant checks and report exactly what passed, failed or was not run.
9. Update the authoritative document when a requirement, contract or decision changes.
10. Prefer small, reviewable changes, each traceable to REQ IDs.

## Before coding
For non-trivial work: inspect first, prepare a plan that cites REQ IDs, identify risks and
tests, and wait for approval.
