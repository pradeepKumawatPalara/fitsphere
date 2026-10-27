# Data and Threat Model

- Status: Draft
- Owner: Project owner (D-01); legal obligations: Legal (Q-049)
- Last updated: 2026-10-27

Started with the items the owner has decided. Sections marked *Not yet written* are gaps, not
statements that nothing is needed. This file does not show that FitSphere is secure or
compliant: each control still needs an implementation and a test. D- numbers refer to
[`owner-decisions-2026-10-27.md`](../product/owner-decisions-2026-10-27.md).

## Assets and data categories
Body, health, meal and photo data are sensitive (REQ-NFR-002, C-003). Categories used in the
permission matrix below:
- **A trainee's data:** meal logs (including AI-parsed items and meal photos), body metrics
  (weight, steps, sleep, measurements), workouts, saved meals, targets, diet and training plans,
  who last changed a target or plan, and settings (including AI consent and Head Coach
  permission answers).
- **A coach's data:** coaching activity — for a Head Coach, counts per coach (D-13) — and the
  coach's own personal logs if they also use the Personal Training User role.
- **Account data:** email address, password and invitations. Whether an email address has a
  FitSphere account is itself sensitive, because it reveals that the person uses a health app
  (T-01).
- **Operational data:** the log of admin access to user data (REQ-NFR-005).

## Actors and trust boundaries
People, external systems and trust boundaries are in
[`system-context.md`](../architecture/system-context.md). Any user can turn on the Coach or Head
Coach role (D-06), so holding a role grants no trust by itself; access to another person's data
comes only from an accepted link (project invariant 1).

In phase 1 the project owner is the only operator, with no support staff; every admin access to
user data is logged (REQ-NFR-005, D-13). A Platform Admin role is future scope; which of its
rights include health data is open (Q-086).

## Permission matrix
Who can view or edit each kind of data, according to the requirements and owner decisions so
far. The server enforces this (invariant 1); hiding something in the app is not enough.

- **View**, **Edit** — granted by the cited requirement or decision.
- **—** — not granted by any requirement or decision.
- **Open** — not decided; the Q- item says what is missing.

### A trainee's data
| Data | Trainee (self) | Their coach | Coach's Head Coach — trainee allowed | Coach's Head Coach — trainee declined or not answered | Former coach or Head Coach (removed, left or switched) | Anyone else |
|---|---|---|---|---|---|---|
| Meal logs, including AI-parsed items and meal photos | View, edit (A-004, Q-032) | View — scope open (Q-059) | View ("your logs", D-11) — scope as Q-059 | — | — (D-10, D-11) | — |
| Body metrics: weight, steps, sleep, measurements | View, edit (A-004) | View — scope open (Q-059) | View (D-11) — scope as Q-059 | — | — | — |
| Workouts | View, edit (A-004) | View — scope open (Q-059) | View (D-11) — scope as Q-059 | — | — | — |
| Saved meals | View, edit (REQ-SAVED-001, REQ-NUT-004) | Open (Q-059) | Open (Q-059) | — | — | — |
| Calorie and protein targets | View only (REQ-PLAN-001, invariant 2) | View, edit (REQ-ROLE-006, D-11) | View, edit (REQ-ROLE-004, D-13) | — | — | — |
| Weekly workout target | View only (REQ-HOME-007, invariant 2) | View, edit (REQ-ROLE-006) — who sets it is open (Q-013) | — (D-13 names calorie and protein only) | — | — | — |
| Diet plan and training plan | View | View, edit (REQ-ROLE-006) | View, edit (D-08, D-13) | — | — | — |
| Who made the latest change to a target or plan, and when | View (D-13) | View (D-13) | View (D-13) | — | — | — |
| Settings and AI consent | View, change (REQ-ACC-*) | — never (D-13) | — never (D-13) | — never (D-13) | — | — |
| Head Coach permission answer | View, change (REQ-ROLE-013) | — | Status only: allowed (D-13) | Counted only, no name (D-13 — interpretation, to confirm) | — | — |

When a link ends, the former coach's or Head Coach's app deletes that trainee's data from the
device on its next sync (REQ-NFR-004, D-13, T-06).

### A coach's data
| Data | Coach (self) | Their Head Coach | Former Head Coach (removed, left or switched) | Anyone else |
|---|---|---|---|---|
| Coaching activity | View, edit | Counts per coach only: number of trainees; allowed / declined / pending; plans sent — no trainee names or data (REQ-ROLE-004, REQ-ROLE-010, D-13). Trainees who allowed it: their data as in the table above | — (D-10, D-11) | — |
| The coach's own personal logs, if they also use the Personal Training User role | View, edit | — never (D-10) | — | Their own coach, if they have one, as for any trainee (table above) |

### Invitations
| Data | Inviter (Coach or Head Coach) | Invited person |
|---|---|---|
| Whether the invited email is registered, and which channel was used | — never (REQ-ROLE-011, D-11) | Not applicable |
| The invitation | Sees only "Invitation sent" | Email with a sign-up link, or in-app invitation (REQ-ROLE-008, REQ-ROLE-009) |
| Sign-up link in an invitation email | — | Works once; expires 7 days after it is sent (REQ-ROLE-008, D-13) |
| Pending invitations they sent | Open (Q-073) | Not applicable |

### Operator
In phase 1 the project owner is the only operator. Admin access to user data does not come from
a link, so the matrix above does not cover it; instead, every such access is logged
(REQ-NFR-005, D-13, T-07).

### Still open in the matrix
- Which trainee data a coach sees (Q-059).
- Which change wins if the Coach and the Head Coach edit a target or plan at the same time
  (Q-075, ADR-0007).
- Whether a coach sees which of their trainees allowed their Head Coach — no decision grants it,
  so it is shown as —; no Q- item yet.
- Reading of D-13: trainees who declined or have not answered appear to a Head Coach only in the
  counts, never by name — to confirm.
- Platform Admin rights over health data (Q-086, future scope).

## Threat scenarios
| ID | Asset | Attacker and action | Impact | Likelihood | Mitigation (decided) | Still open | Owner |
|---|---|---|---|---|---|---|---|
| T-01 | Whether an email address has an account; people's inboxes | Any user turns on Coach or Head Coach (D-06), then invites addresses to learn which are registered, or sends invitations in bulk | Reveals that a person uses a health app; invitation spam sent from FitSphere | Not assessed | The inviter always sees "Invitation sent" and never the channel used; daily invitation limits (REQ-ROLE-011, D-10, D-11). Sign-up and password reset show neutral messages (REQ-ACC-010, D-11) | Size of the limit (Q-073); response time must not differ between the cases — to verify in tests | Project owner |
| T-02 | Data on the server | A change queued offline syncs after the user lost access, e.g. a coach removed from a trainee | Writes to data the user may no longer touch | Not assessed | Every queued change is re-authorized on the server at sync time (REQ-NFR-004, invariant 1, D-10) | Design in ADR-0007 | Project owner |
| T-03 | Health data stored on the phone | Someone gets the phone or a copy of its storage | Health, body and meal data exposed | Not assessed | Health data on the device is encrypted (REQ-NFR-004, D-10) | Design in ADR-0007 | Project owner |
| T-04 | Trust in FitSphere emails; users' passwords | (a) Someone sends emails that pretend to be FitSphere invitations, to phish passwords. (b) If the real invitation email shows anything the inviter typed, such as their name, the inviter can put misleading text or links into a genuine FitSphere email | Stolen accounts; real invitations stop being trusted | Not assessed | Daily invitation limits (REQ-ROLE-011); SPF, DKIM and DMARC on the sender domain (REQ-ROLE-008, D-13) | Sender domain and email service (Q-082). Proposed, not decided: links point only to FitSphere's own domain; inviter-supplied text shown as plain text with a length limit | Project owner |
| T-05 | The link between two accounts | An invitation link that never expires, works more than once or is forwarded lets the wrong person — or the right person much later — accept | The wrong or an unexpected person becomes linked, and the inviter then sees their data | Not assessed | Accepting is always an explicit step (REQ-ROLE-009); a Head Coach still needs each trainee's permission (REQ-ROLE-013); invitation-email links work once and expire after 7 days (REQ-ROLE-008, D-13) | Resend and cancel rules, and whether in-app invitations expire (Q-073); whether sign-up must use the invited address. Proposed, not decided: a link stops working when its invitation is cancelled | Project owner |
| T-06 | Access after a link ends, especially on a switch of Head Coach or coach | (a) The old Head Coach or coach keeps access: requests already in progress, changes queued offline on their phone, or copies of data still on their phone. (b) A coach accepts a new Head Coach by mistake, ending the old link. (c) The new Head Coach gets trainee data on the strength of answers given to the old one | Data seen after access should have ended; old Head Coach cut off without warning; trainee data shown without fresh permission | Not assessed | Old link ends first and all its access ends immediately (REQ-ROLE-015, D-11); queued changes re-authorized at sync (T-02); the old side's app deletes that trainee's data from the phone on its next sync (REQ-NFR-004, D-13); the accept screen warns that accepting ends the current link, and the old side gets a neutral message, "X is no longer linked with you" (REQ-ROLE-014, REQ-ROLE-015, D-13); answers do not carry over and each trainee gets a fresh request (REQ-ROLE-013, D-11) | A phone that does not sync again — kept offline, or the app not opened — keeps its encrypted copy (T-03) until it does | Project owner |
| T-07 | All user data | The operator, or anyone who gets the operator's credentials, reads user data through admin access, outside the link checks | Health data seen without the user's knowledge | Not assessed | One operator only (the project owner), no support staff; every admin access to user data is logged (REQ-NFR-005, D-13) | Where the log is kept, how it is protected and reviewed — the operator is also its only reviewer; Platform Admin rights and controls (Q-086) | Project owner |

## Security controls
*Not yet written.* Always-on rules are in
[`project-invariants.md`](../../.claude/rules/project-invariants.md).

## Retention and deletion
*Not yet written.* Open: delete-account flow (Q-048), meal photo retention (Q-064). Head Coach
permission answers are stored with timestamps (REQ-ROLE-013) and kept while the account exists;
how long they are kept after the account is deleted is decided with Legal (Q-049, D-13). How
long the admin access log is kept is not decided (REQ-NFR-005).

## Open risks
- Whether the trainee permission step (REQ-ROLE-013) meets the consent requirements of India's
  DPDP Act 2023 is for Legal to confirm (Q-049).
- Obligations under the DPDP Act are not yet confirmed by Legal (Q-049).
- Trainee data stays on a former coach's or Head Coach's phone until that phone next syncs (T-06).
