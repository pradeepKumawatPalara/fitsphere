# Definition of Done

- Status: Accepted — agreed with the Skeleton plan, which the owner approved on 2026-10-28
- Owner: Project owner (D-01)
- Last updated: 2026-10-28

A change is done only when every applicable item is true. "Not applicable" is allowed; skipping
silently is not. The pull request (or commit message, while there are no pull requests) says
which items were not applicable and why.

## Scope and traceability
- [ ] The change is traced to REQ IDs, and to ADR steps where it validates one.
- [ ] Every acceptance criterion it touches has an automated test or a recorded manual check
      ([test strategy](test-strategy.md)).
- [ ] No requirement was invented. Any new "MVP default" (D-18) is recorded in
      [`constraints-and-assumptions.md`](../architecture/constraints-and-assumptions.md#mvp-defaults-d-18)
      and listed in the pull request.
- [ ] The change is small enough to review in one sitting.

## Invariants
- [ ] Every new or changed API route has an access rule and authorization tests (invariant #1).
- [ ] Coach-set targets stay read-only for the trainee (invariant #2), where touched.
- [ ] No AI call without a server-side consent check immediately before it (invariant #3), where
      touched.
- [ ] Non-AI logging still works (invariant #4), where touched.
- [ ] IST days and UTC timestamps are stored separately; nothing uses the server's or phone's
      local time zone (invariant #5).
- [ ] Measures are stored in their canonical unit (invariant #6).
- [ ] No health data, tokens, email addresses or secrets in logs, errors, analytics, fixtures,
      screenshots or commits; test data is synthetic (invariant #7).

## Checks
- [ ] Lint, type-check and all automated tests pass on the PC and in GitHub Actions.
- [ ] The results are reported exactly: what passed, what failed, what was not run and why.
- [ ] Manual device checks that the change needs were run, and their results recorded with the
      date (under "Validation results" in the ADR, when it is an ADR step).

## Contracts and documents
- [ ] Contracts in [`docs/contracts/`](../contracts/) match the code: endpoints, fields, error
      codes, tables and migrations.
- [ ] The authoritative document is updated when a requirement, contract or decision changes;
      an Accepted ADR is never silently changed.
- [ ] New configuration names are listed in the
      [runbook](../operations/runbook.md#configuration-names) without values, and `.env.example`
      files are updated.

## Security and dependencies
- [ ] No secret value is committed; `.env` files stay untracked.
- [ ] Each new dependency is necessary, maintained, licensed for this use and, for native app
      libraries, supports React Native's New Architecture (ADR-0001).
- [ ] Database changes are migration files, reviewed like code.

## Remaining risks
- [ ] Known gaps, deferred checks and new risks are written in the pull request, and in the
      backlog or threat model when they outlast it.
