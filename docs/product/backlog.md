# Backlog

- Status: Draft
- Owner: Project owner (D-01)
- Last updated: 2026-10-28 (D-20: Coach and Head Coach are post-MVP)

Work that is **not** in the MVP (D-18, D-20, [`mvp-scope.md`](mvp-scope.md)). Nothing here is built
until the owner moves it into a release. MVP defaults chosen under D-18 are listed in
[`constraints-and-assumptions.md`](../architecture/constraints-and-assumptions.md#mvp-defaults-d-18),
not here. D- numbers refer to [`owner-decisions-2026-10-27.md`](owner-decisions-2026-10-27.md).

## Post-MVP features
From `mvp-scope.md` section 3, plus items the D-18 and D-20 answers moved out of the MVP.

| ID | Item | Affects | Notes |
|---|---|---|---|
| B-01 | iOS release | A-001, ADR-0001, C-008 | Waits for an iPhone (D-10, R-001); Apple fee due at release |
| B-02 | "Pre" baseline row and week-details screen in Progress | REQ-PRG-005 | Q-045, Q-046 |
| B-03 | "Eaten before" list in Log meal | REQ-LOG-007 | Saved covers re-logging in the MVP |
| B-04 | Examples section in Log meal (Best, Vague, Say) | REQ-LOG-008 | The tips stay in the MVP |
| B-05 | Audio storage | REQ-LOG-005, ADR-0008, Q-090 | The MVP stores no audio |
| B-06 | Video uploads (other than YouTube links) | REQ-NFR-006, ADR-0008, Q-090, Q-091 | |
| B-07 | Premium plans | REQ-ROLE-001, D-06 | Need payments, a proposed non-goal (Q-003) |
| B-08 | Platform Admin role and admin screens | REQ-NFR-005, D-13, Q-086 | The MVP uses owner-only, logged admin commands (ADR-0004) |
| B-09 | Multiple time zones; users outside India | REQ-ACC-006, REQ-DATE-004, D-09 | |
| B-10 | Other invitation channels (SMS, WhatsApp) | REQ-ROLE-008, D-11 | |
| B-11 | Backups and Supabase Pro | R-005, C-008, ADR-0002, ADR-0003 | Reviewed when an R-005 trigger fires (D-16) |
| B-12 | Better handling when a Coach and a Head Coach edit the same plan or target | REQ-ROLE-004, REQ-ROLE-006, Q-075, ADR-0007 | In the MVP the change the server receives last wins |
| B-13 | Web dashboard for coaches | Q-068, A-001, ADR-0001 revisit condition | D-18 |
| B-14 | Health-platform sync for steps and sleep | REQ-HOME-006, Q-015, ADR-0006 | Steps and sleep are typed in for the MVP. Proposed non-goal (Q-003) |
| B-15 | Voice entry on phones that cannot recognise speech on the device | REQ-LOG-005, ADR-0005 | D-18 allows on-device recognition only. Anything else needs the owner (invariant #3) |
| B-16 | Use by people under 18 | REQ-ACC-010, Q-066 | The MVP is for people 18 or older (D-18). What under-18 use would need, such as consent, is for Legal (Q-049) |
| B-17 | Coach and Head Coach roles: turning them on, the role selector, and the views and navigation for each role | REQ-ROLE-001, REQ-ROLE-002, REQ-NAV-001, Q-008, Q-020, Q-052, Q-057 | D-20. In the MVP every account is a Personal Training User and the selector is hidden |
| B-18 | Invitations: by email and in the app; accept or decline; resend and cancel; the daily limit | REQ-ROLE-008, REQ-ROLE-009, REQ-ROLE-011, REQ-ROLE-017, Q-073, T-01, T-04, T-05; ADR-0004 rule 5 and step 6 | D-20. Invitation emails need Resend and FitSphere's domain, which the MVP release already sets up for sign-up and reset |
| B-19 | Links: coach and trainee lists; remove, leave and switch; past activity; the former coach's phone deletes the trainee's data | REQ-ROLE-003, REQ-ROLE-005, REQ-ROLE-010, REQ-ROLE-012, REQ-ROLE-014, REQ-ROLE-015, REQ-NFR-004 (link parts), T-06; ADR-0002 step 4, ADR-0004 step 4, ADR-0007 steps 2–3 | D-20. The `links` table is already in the data model; access is added as new rules in the access module |
| B-20 | Head Coach access and the trainee's permission (Allow / Decline) | REQ-ROLE-004, REQ-ROLE-013 | D-20. The `head_coach_permission_answers` table is already in the data model |
| B-21 | Coach-set targets and plans: building diet and training plans, the trainee's plan views, "Log this option", the "Set by <name>" label | REQ-ROLE-006, REQ-PLAN-001…006, REQ-PLAN-008, REQ-TRN-001, REQ-TRN-006, REQ-TRN-007, invariant #2, Q-034, Q-035 | D-20. In the MVP the Diet plan and Training tabs show their empty states, and users set their own targets (REQ-ROLE-007) |
| B-22 | The Notifications list and push notifications; the push token removed at log out | REQ-ROLE-016, ADR-0004 rule 6 and step 5 | D-20. Needs B-23 first |
| B-23 | Push check on the phone (was Skeleton step 11) | ADR-0001 step 7, D-13 answer 9, Q-083 | D-20. Needs a free Firebase project with `com.fitsphere.app`, its FCM V1 key uploaded to EAS credentials, `expo-notifications` and a new EAS build. Send a notification with Expo's push tool; it arrives on the phone |
| B-24 | iOS compile check (was Skeleton step 12) | ADR-0001 step 5, R-001 | D-20. One EAS iOS simulator build; uses 1 of the free plan's iOS builds and needs no Apple account. Before the iOS release (B-01) |

## Deferred edge cases
Found while applying D-18. The MVP behaviour applies until an item is picked up. E-02 and E-03
arise only once coaches exist (B-17 to B-21, D-20).

| ID | Edge case | Source | MVP behaviour until then |
|---|---|---|---|
| E-01 | Asking for the password again before an account is deleted | REQ-ACC-009 | A confirmation step only |
| E-02 | A coach or Head Coach deletes their account: what the "Set by <name>" label shows on plans and targets they set | REQ-ACC-009, REQ-PLAN-001 | The trainee keeps the plans and targets; the label no longer shows the deleted person's name |
| E-03 | Turning off a role that still has active links | REQ-ROLE-001 | The role cannot be turned off until those links have ended |
| E-04 | A wrong or changed phone clock (the 30-day clear, "today") | ADR-0007 | The phone's clock is used, read in Asia/Kolkata |
| E-05 | *Closed by D-20.* After a link ends, the old weekly workout, body-weight and steps targets stay read-only, because a user without a coach sets only calorie and protein targets (Q-016) | REQ-ROLE-007, Q-060 | D-20 lets every user set all five targets, so a user whose link has ended sets new ones (REQ-ROLE-007) |
| E-06 | A password-reset link opened on another phone, or after reinstalling the app | REQ-ACC-010 | The link works only on the phone that asked for the reset (PKCE); elsewhere the app says so and offers a new link (Skeleton step 7) |
| E-07 | Signing up again with an address whose old test account was deleted from Supabase Auth but not from the FitSphere database | REQ-ACC-010 | Account setup answers `500`; delete the old `app.users` row by hand on the development project (Skeleton plan, risks) |
| E-08 | The phone's database belongs to another user when the app starts, e.g. after an interrupted log out | REQ-ACC-008 | It is deleted with its key and a new one is created; anything unsynced in it is lost (Skeleton step 8) |
