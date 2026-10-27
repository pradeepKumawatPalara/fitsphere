# Data and Threat Model

- Status: Draft
- Owner: Project owner (D-01); legal obligations: Legal (Q-049)
- Last updated: 2026-10-27

Started with the items the owner has decided. Sections marked *Not yet written* are gaps, not
statements that nothing is needed. This file does not show that FitSphere is secure or
compliant: each control still needs an implementation and a test. D- numbers refer to
[`owner-decisions-2026-10-27.md`](../product/owner-decisions-2026-10-27.md).

## Assets and data categories
*Not yet written.* Known so far: body, health, meal and photo data are sensitive (REQ-NFR-002,
C-003). Whether an email address has a FitSphere account is also sensitive, because it reveals
that the person uses a health app (T-01).

## Actors and trust boundaries
*Not yet written.* Trust boundaries are sketched in [`flow.md`](../../flow.md). Any user can turn
on the Coach or Head Coach role (D-06), so holding a role grants no trust by itself; access to
another person's data comes only from an accepted link (project invariant 1).

## Threat scenarios
| ID | Asset | Attacker and action | Impact | Likelihood | Mitigation (decided) | Still open | Owner |
|---|---|---|---|---|---|---|---|
| T-01 | Whether an email address has an account; people's inboxes | Any user turns on Coach or Head Coach (D-06), then invites addresses to learn which are registered, or sends invitations in bulk | Reveals that a person uses a health app; invitation spam sent from FitSphere | Not assessed | The inviter always sees "Invitation sent"; daily invitation limits (REQ-ROLE-011, D-10) | Size of the limit (Q-073); sign-up and password reset can leak the same thing (Q-079); response time must not differ between the two cases — to verify in tests | Project owner |
| T-02 | Data on the server | A change queued offline syncs after the user lost access, e.g. a coach removed from a trainee | Writes to data the user may no longer touch | Not assessed | Every queued change is re-authorized on the server at sync time (REQ-NFR-004, invariant 1, D-10) | Design in ADR-0007 | Project owner |
| T-03 | Health data stored on the phone | Someone gets the phone or a copy of its storage | Health, body and meal data exposed | Not assessed | Health data on the device is encrypted (REQ-NFR-004, D-10) | Design in ADR-0007 | Project owner |

## Security controls
*Not yet written.* Always-on rules are in
[`project-invariants.md`](../../.claude/rules/project-invariants.md).

## Retention and deletion
*Not yet written.* Open: delete-account flow (Q-048), meal photo retention (Q-064).

## Open risks
- The trainee notice-and-agreement step before a Head Coach sees trainee data is not specified
  (Q-078), so REQ-ROLE-010 stays blocked.
- Obligations under India's DPDP Act 2023 are not yet confirmed by Legal (Q-049).
