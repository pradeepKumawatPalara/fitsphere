# Backlog

- Status: Draft
- Owner: Project owner (D-01)
- Last updated: 2026-10-30 (Settings slice, step 2, D-S1: RB-S1 and E-S1). Earlier the same day
  (D-28: E-13, a dish removed from the list). Earlier the same day (D-26
  answer 3, amended: B-26, dishes deferred until their missing ingredients have a source).
  2026-10-29 (Training slice, D-29: E-14 to E-17). Earlier the same day (D-25: the IFCT licence is
  not release-blocking). Earlier the same day
  (Home and daily tracking slice, D-23: E-09 to E-12). Earlier the same
  day (D-22): release-blocking tasks, deferred Skeleton checks, B-25

Work that is **not** in the MVP (D-18, D-20, [`mvp-scope.md`](mvp-scope.md)). Nothing here is built
until the owner moves it into a release. **Exception:** the first two sections list work that must
be done **before the MVP release** (D-22). MVP defaults chosen under D-18 are listed in
[`constraints-and-assumptions.md`](../architecture/constraints-and-assumptions.md#mvp-defaults-d-18),
not here. D- numbers refer to [`owner-decisions-2026-10-27.md`](owner-decisions-2026-10-27.md).

## Release-blocking tasks (D-22)
Security clean-up after the Skeleton phone checks. Not done yet: do them only when the owner says
so, and before any real user (`CLAUDE.md`, "Before real users").

The IFCT 2017 food-list licence is **not** release-blocking: the owner decided to use the list
without NIN permission and accepted the risk (D-25, R-007).

| ID | Task | Why |
|---|---|---|
| RB-01 | Delete the GitHub copy of the branch `local/test-no-email` (`git push origin --delete local/test-no-email`). The owner's local branch is a separate decision | It holds a test password (`apps/mobile/src/auth/temporary-password.ts` on that branch) |
| RB-02 | Delete the Supabase test user that uses that password on `fitsphere-dev`, and its FitSphere account row (E-07) | Its password is in the branch of RB-01 |
| RB-03 | Make sure **Confirm email** is on: Authentication → Sign In / Providers → Email | An unverified account must not sign in (Q-080); the test branch needed it off |
| RB-S1 | Build the owner's logged admin path for deleting an account on an emailed request: an owner-only API command that runs the same deletion as `DELETE /v1/me` and writes the admin access log (REQ-NFR-005). Then publish the deletion page (`docs/legal/account-deletion-page.md`) and give its address in the Google Play listing. Temporary ID (D-S1) | The page promises deletion by email (REQ-ACC-009, Google Play), and the owner may act only through the logged admin path (ADR-0004 rules 7 and 8, D-16) |

## Skeleton checks to run before release (D-22)
Phone checks of the Skeleton slice still pending when its pull requests were merged on
2026-10-29 (accepted risk R-006). Each must pass, and be recorded in its ADR and the Skeleton plan,
before the MVP release. Run them on the merged code, not on `local/test-no-email`, with Confirm
email on (RB-03). The exact steps are in the Skeleton plan.

| ID | Check | ADR | Skeleton step |
|---|---|---|---|
| SC-01 | Replace a day's weight; pick a past day: the banner shows and Back to today returns; future days cannot be picked | — (REQ-HOME-006, REQ-DATE-001, REQ-DATE-003) | 10, checks 1–2 |
| SC-02 | Scroll the 200-row history list; partial until a low-end phone is available | ADR-0001 check 6 | 10, check 7 |
| SC-03 | With the phone's date a day ahead, that day's weight is rejected (`DAY_IN_FUTURE`) and stays, even after a restart, until discarded | ADR-0007 step 4 | 10, check 4 |
| SC-04 | In airplane mode, the 1,000-row check passes; record its times | ADR-0001 check 4 | 8 |
| SC-05 | Log out with a pending entry: the warning appears, and Stay signed in keeps you signed in | — (REQ-ACC-008) | 10, check 6 |
| SC-06 | Offline, log a weight, force-stop and reopen the app (USB + adb): still pending. Back online: it syncs. Log out and sign in: the server restores exactly one value per day, including the offline entries of 2026-10-29 | ADR-0007 step 1 | 10, check 3 |
| SC-07 | The phone's database file, copied off over USB + adb, is unreadable | ADR-0007 step 6 | 8 |
| SC-08 | The start-up check shows the SQLCipher version. The app opened its database on 2026-10-29, but the version was not read | ADR-0007 step 6 (rule 5) | 8 |
| SC-09 | Sign up with your own address: the neutral text; sign-in refused before verifying; the email link opens the app; sign in, account setup, Home shows the email; log out | ADR-0004 step 3, ADR-0002 step 2 | 6, checks 1–5 and 8 |
| SC-10 | A repeat sign-up, and a sign-up with an address outside the team, show the same text | ADR-0004 step 2 | 6, check 6 |
| SC-11 | `npm run check:signup -w @fitsphere/api -- <registered address>` prints PASS | ADR-0004 step 2 | 6, check 6; 10 |
| SC-12 | Forgot password: the email link opens "Set a new password" on the phone that asked; sign in with the new password; an address outside the team shows the same text | ADR-0004 step 2 | 7 |
| SC-13 | A token saved more than an hour earlier gets `401` from `/v1/me` | ADR-0004 step 3 | 6, check 7 |

## Post-MVP features
From `mvp-scope.md` section 3, plus items the D-18, D-20 and D-26 answers moved out of the MVP.

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
| B-25 | Phone time-zone check: with the phone set to Los Angeles, "Today (IST)" keeps India's date and a weight gets the IST day (was Skeleton step 3's phone check and step 10's check 5) | ADR-0007 step 5, REQ-DATE-004, invariant #5 | D-22: dropped for the MVP, which serves India only (D-09). Automated tests cover it under `Asia/Kolkata` and `America/Los_Angeles`. Run with B-09 |
| B-26 | Dishes deferred until their missing ingredients have a source: curd and raita, masala chai, besan dishes (such as besan chilla, dhokla and pakora), and chole | REQ-LOG-007, ADR-0006 rule 1 | D-26 answer 3, amended 2026-10-30: deferred, not dropped. The IFCT list has no curd, white sugar, tea or besan, and B002 "Bengal gram, whole" does not say which chickpea it is. A source for those ingredients needs the owner's approval |

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
| E-09 | Removing a target, rather than changing it | REQ-ROLE-007 | A target can be changed but not removed (D-23) |
| E-10 | Showing and editing Home for days older than the 90 days the phone holds, online | REQ-DATE-001, ADR-0007 rule 1 | The calendar and the week strip stop at 90 days; older history is viewed in Progress (D-23) |
| E-11 | Target history: a target that applies from the day it was set, so past days keep the target they had (Q-014) | REQ-ROLE-007, REQ-PRG-005 | One current value per target, applying to every day shown (D-23) |
| E-12 | Changing the measurements sheet's date after typing values | REQ-MEAS-002 | The fields show the new day's entry, or empty fields, so values typed for the old day are cleared (D-23) |
| E-13 | A dish removed from the list (no longer approved) while a phone still has a meal or saved meal naming it waiting to sync, or one is re-logged later | REQ-LOG-007, D-28 | The change is refused (`VALIDATION_FAILED`) and shown as rejected; meals already on the server keep their snapshot. Keep a withdrawn dish on the list, hidden from search, if this happens in practice |
| E-14 | Per-set reps and weights, and the other workout fields Q-042 listed (duration, RPE, rest) | REQ-TRN-003, Q-042 | One line per exercise: sets × reps × weight with an optional note; the same reps and weight for every set (D-29) |
| E-15 | Changing a workout's date after it was started | REQ-TRN-003, REQ-LOG-002 | The date is fixed when the workout starts; to log another day, the user picks that date first, or deletes the workout and starts again (D-29) |
| E-16 | Editing or deleting workouts older than the 90 days the phone holds, online | REQ-TRN-004, ADR-0007 rule 1 | Older workouts are read with "Load older" and only viewed (D-29) |
| E-17 | Exercise names suggested from past workouts, or an exercise list | REQ-TRN-003 | Names are typed freely each time (D-29) |
| E-P1 | Progress's week table and measurements for weeks older than the 90 days the phone holds, online | REQ-PRG-005, REQ-PRG-006, ADR-0007 rule 1 | The table shows this week and the 11 before it, and the measurements of the last 90 days; older weights are in the chart (26W, All) and "All weigh-ins" (D-P1). Needs read routes for meals, steps and measurements |
| E-P2 | Tapping a point on the weight chart to see its value and date | REQ-PRG-004 | The chart shows the highest and lowest values and the first and last dates, and a screen reader hears a summary of the range (D-P1) |
| E-P3 | The target body weight as a line on the weight chart | REQ-PRG-004, REQ-PRG-005 | The target body weight is in the week table's Target row (D-P1) |
| E-S1 | A photo upload link issued less than 10 minutes before the account is deleted can still put one file in storage afterwards. Temporary ID (D-S1) | REQ-ACC-009, ADR-0002 rule 5 | The deletion removes every file the database knows of; post-MVP, the user's folder is swept again 10 minutes later |
