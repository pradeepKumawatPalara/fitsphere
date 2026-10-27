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
  and settings (including AI consent and Head Coach permission answers).
- **A coach's data:** coaching activity (what it includes is open — Q-085), and the coach's own
  personal logs if they also use the Personal Training User role.
- **Account data:** email address, password and invitations. Whether an email address has a
  FitSphere account is itself sensitive, because it reveals that the person uses a health app
  (T-01).

## Actors and trust boundaries
People, external systems and trust boundaries are in
[`system-context.md`](../architecture/system-context.md). Any user can turn on the Coach or Head
Coach role (D-06), so holding a role grants no trust by itself; access to another person's data
comes only from an accepted link (project invariant 1).

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
| Targets: calorie, protein, weekly workout | View only (REQ-PLAN-001, invariant 2) | View, edit (REQ-ROLE-006, D-11) | Open (Q-075) | — | — | — |
| Diet plan and training plan | View | View, edit (REQ-ROLE-006) | View, edit (D-08, REQ-ROLE-013) | — | — | — |
| Settings, AI consent, Head Coach permission answer | View, change (REQ-ACC-*, REQ-ROLE-013) | Open | Open | — | — | — |

### A coach's data
| Data | Coach (self) | Their Head Coach | Former Head Coach (removed, left or switched) | Anyone else |
|---|---|---|---|---|
| Coaching activity | View, edit | View — what it includes is open (Q-085); never data of a trainee who has not allowed it (REQ-ROLE-010) | — (D-10, D-11) | — |
| The coach's own personal logs, if they also use the Personal Training User role | View, edit | — never (D-10) | — | Their own coach, if they have one, as for any trainee (table above) |

### Invitations
| Data | Inviter (Coach or Head Coach) | Invited person |
|---|---|---|
| Whether the invited email is registered, and which channel was used | — never (REQ-ROLE-011, D-11) | Not applicable |
| The invitation | Sees only "Invitation sent" | Email with a sign-up link, or in-app invitation (REQ-ROLE-008, REQ-ROLE-009) |
| Pending invitations they sent | Open (Q-073) | Not applicable |

### Still open in the matrix
- Which trainee data a coach sees (Q-059), and whether a Head Coach can change targets (Q-075).
- What "coaching activity" includes (Q-085).
- Whether a coach or Head Coach can see a trainee's settings, AI consent or permission answer —
  no Q- item yet.
- Copies of other people's data already on a former coach's or Head Coach's phone when a link
  ends (offline store, REQ-NFR-004) — not covered by any decision (T-06).
- Access by anyone who operates FitSphere (support, administrators) is not documented.

## Threat scenarios
| ID | Asset | Attacker and action | Impact | Likelihood | Mitigation (decided) | Still open | Owner |
|---|---|---|---|---|---|---|---|
| T-01 | Whether an email address has an account; people's inboxes | Any user turns on Coach or Head Coach (D-06), then invites addresses to learn which are registered, or sends invitations in bulk | Reveals that a person uses a health app; invitation spam sent from FitSphere | Not assessed | The inviter always sees "Invitation sent" and never the channel used; daily invitation limits (REQ-ROLE-011, D-10, D-11). Sign-up and password reset show neutral messages (REQ-ACC-010, D-11) | Size of the limit (Q-073); response time must not differ between the cases — to verify in tests | Project owner |
| T-02 | Data on the server | A change queued offline syncs after the user lost access, e.g. a coach removed from a trainee | Writes to data the user may no longer touch | Not assessed | Every queued change is re-authorized on the server at sync time (REQ-NFR-004, invariant 1, D-10) | Design in ADR-0007 | Project owner |
| T-03 | Health data stored on the phone | Someone gets the phone or a copy of its storage | Health, body and meal data exposed | Not assessed | Health data on the device is encrypted (REQ-NFR-004, D-10) | Design in ADR-0007 | Project owner |
| T-04 | Trust in FitSphere emails; users' passwords | (a) Someone sends emails that pretend to be FitSphere invitations, to phish passwords. (b) If the real invitation email shows anything the inviter typed, such as their name, the inviter can put misleading text or links into a genuine FitSphere email | Stolen accounts; real invitations stop being trusted | Not assessed | Daily invitation limits (REQ-ROLE-011) | Sender domain and email service (Q-082). Proposed, not decided: SPF, DKIM and DMARC on the sender domain; links point only to FitSphere's own domain; inviter-supplied text shown as plain text with a length limit | Project owner |
| T-05 | The link between two accounts | An invitation link that never expires, works more than once or is forwarded lets the wrong person — or the right person much later — accept | The wrong or an unexpected person becomes linked, and the inviter then sees their data | Not assessed | Accepting is always an explicit step (REQ-ROLE-009); a Head Coach still needs each trainee's permission (REQ-ROLE-013) | Expiry, resend and cancel rules (Q-073); whether sign-up must use the invited address. Proposed, not decided: links expire, work once, and stop working when the invitation is cancelled | Project owner |
| T-06 | Access after a switch of Head Coach or coach | (a) The old Head Coach or coach keeps access: requests already in progress, changes queued offline on their phone, or copies of data still on their phone. (b) A coach accepts a new Head Coach by mistake, ending the old link. (c) The new Head Coach gets trainee data on the strength of answers given to the old one | Data seen after access should have ended; old Head Coach cut off without warning; trainee data shown without fresh permission | Not assessed | Old link ends first and all its access ends immediately (REQ-ROLE-015, D-11); queued changes re-authorized at sync (T-02); answers do not carry over and each trainee gets a fresh request (REQ-ROLE-013, D-11) | Copies already on the old side's phone; whether the old side is told (Q-084). Proposed, not decided: the accept screen says that accepting ends the current link | Project owner |

## Security controls
*Not yet written.* Always-on rules are in
[`project-invariants.md`](../../.claude/rules/project-invariants.md).

## Retention and deletion
*Not yet written.* Open: delete-account flow (Q-048), meal photo retention (Q-064). Head Coach
permission answers are stored with timestamps (REQ-ROLE-013); how long they are kept is not
decided.

## Open risks
- Whether the trainee permission step (REQ-ROLE-013) meets the consent requirements of India's
  DPDP Act 2023 is for Legal to confirm (Q-049).
- What "coaching activity" a Head Coach sees without trainee permission (Q-085).
- Obligations under the DPDP Act are not yet confirmed by Legal (Q-049).
