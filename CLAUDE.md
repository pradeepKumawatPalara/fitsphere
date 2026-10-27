# Project Instructions for Claude Code

## Purpose
FitSphere is a coach-led fitness app. Clients log food, body metrics and workouts against
targets set by their coach; Coaches manage their trainees; Head Coaches manage Coaches.

## Current phase
**Pre-development (documentation).** Approved stack:
- Mobile client: React Native with Expo, TypeScript (ADR-0001, Accepted — D-12).
- Backend: a TypeScript Node.js API, the only path to the data; Supabase's Data API is turned
  off (ADR-0002, Accepted — D-17).
- Database and file storage: Supabase PostgreSQL and Supabase Storage in Mumbai, on the Free
  plan in phase 1 with no backups (ADR-0002, ADR-0003, Accepted — D-17; D-16, R-005).
- API host: Google Cloud Run in Mumbai once Q-087 is settled; until then the API runs locally.

The validation steps of ADR-0001 to ADR-0003 run in the first slices.
Not approved yet: the sign-in provider and authorization model (ADR-0004 — Supabase Auth is
only a candidate), AI (ADR-0005), food database (ADR-0006), offline sync (ADR-0007), audio/video
media storage (ADR-0008), and the email and push services (Q-082, Q-083).
Do not scaffold an app, add dependencies or pick frameworks until the relevant ADRs in
`docs/architecture/decisions/` are marked **Accepted** by the decision owner.

## Sources of truth
- Documentation index and status: `docs/README.md`
- Product scope: `docs/product/product-brief.md`
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
- Runbook (Draft — only the paused-project step is written): `docs/operations/runbook.md`
- Not yet written: `docs/contracts/`, `docs/quality/`

If a referenced document does not exist, state that it is missing; do not invent its contents.

## Working rules
1. Inspect the actual repository before proposing changes.
2. Read relevant requirements, rules, contracts and accepted ADRs before implementation.
3. Do not invent requirements, provider capabilities, benchmark results or security guarantees.
   If the requirements are ambiguous, check the Q- list and ask; do not guess silently.
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
