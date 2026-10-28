# Project Instructions for Claude Code

## Purpose
FitSphere is a coach-led fitness app. Clients log food, body metrics and workouts against
targets set by their coach; Coaches manage their trainees; Head Coaches manage Coaches.
**The MVP delivers only the Personal Training User view (D-20):** users set their own targets;
Coach and Head Coach are post-MVP.

## Current phase
**Skeleton slice — the first implementation slice.** Plan approved by the owner on 2026-10-28:
`docs/plans/skeleton-slice.md`. One branch and pull request per step; CI must pass before merge;
stop after each step for the owner's check (D-18 answer 14).

**Builds and devices (D-19).** No Android Studio, emulator or local Android builds. Development
builds come from EAS Build (`development` profile) and run on the owner's phone. Rebuild only when
native code changes, and **tell the owner before every cloud build** (free plan: 15 Android
builds a month). Live code: `npx expo start --dev-client --tunnel`. Checks that need a cable are
marked "USB + adb".

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
- Contracts for the Skeleton slice (Draft): `docs/contracts/data-model.md`, `api-conventions.md`,
  `error-model.md`
- Verification (Accepted with the Skeleton plan): `docs/quality/test-strategy.md`, `definition-of-done.md`
- Current slice plan (Accepted): `docs/plans/skeleton-slice.md`
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
