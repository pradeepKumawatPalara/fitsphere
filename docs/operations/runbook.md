# Runbook

- Status: Draft
- Owner: Project owner (D-01)
- Last updated: 2026-10-27

Only verified operational steps belong here (`docs/pre-development-guide.md` §5.10). Procedures
not yet known are marked *Not yet written* rather than guessed. D- numbers refer to
[`owner-decisions-2026-10-27.md`](../product/owner-decisions-2026-10-27.md).

The hosting choice is still **Proposed** (ADR-0002, ADR-0003). The steps below apply once the
Supabase project exists; phase 1 runs on the Supabase Free plan (D-16).

## Local setup
*Not yet written.*

## Configuration names
*Not yet written.* Secret values never go in this file or the repository.

## Deployment and rollback
*Not yet written.*

## Monitoring
*Not yet written.* The owner-review triggers for moving to Supabase Pro or adding backups
(D-16, R-005) are:
- database over 400 MB (Free plan limit: 500 MB);
- files over 800 MB (Free plan limit: 1 GB);
- monthly active users near 50,000;
- monthly viewing traffic (egress) over 4 GB. The Free plan has 5 GB of egress and a separate
  5 GB of cached egress (Supabase pricing page, checked 2026-10-27); watch both;
- any pause;
- any data-loss incident.

Where to read each figure will be written once the project exists.

## Backup and recovery
Phase 1 has **no backups** (D-16, accepted risk R-005): data lost on the server cannot be
restored. Recovery procedures: *Not yet written.*

## Common failures

### Supabase project paused
Supabase pauses Free-plan projects after 1 week of inactivity (Supabase pricing page). While
the project is paused, the app cannot sync; users' entries stay on their phones until they sync
(REQ-NFR-004).

Steps (project owner):
1. Sign in to the Supabase dashboard with two-factor sign-in (D-16).
2. Open the paused project and choose **Resume project** (Supabase docs, "Free project
   pausing").
3. Once it is running, confirm that the app syncs.
4. Record the pause. Any pause is an R-005 trigger: review moving to Supabase Pro or adding
   backups (D-16, C-008).

Do not browse user data in the dashboard while doing this (D-16, REQ-NFR-005).

Time limit: Supabase's current docs say a paused project can be restored for up to 1 year
after it was paused; a 2024 Supabase changelog said 90 days. Resume promptly and treat the
shorter limit as the safe one. After the limit, the dashboard offers a download of the
project's backup file and Storage objects instead of a restore (Supabase docs, checked
2026-10-27).

References: https://supabase.com/docs/guides/platform/free-project-pausing and
https://supabase.com/pricing

## Incident escalation
*Not yet written.* In phase 1 the project owner is the only operator (D-13).

## Owners
Every procedure: Project owner (D-01).
