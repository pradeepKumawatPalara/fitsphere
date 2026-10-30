# MVP Scope and Defaults (D-18)

- Status: **Accepted** — owner instruction, 2026-10-27: "deliver the basic requirements;
  don't ask deep edge cases; cover missed edge cases in future releases."
  Amended on 2026-10-28 by **D-20**: the MVP delivers only the Personal Training User view;
  Coach and Head Coach are post-MVP. Section 5 gives the order of the MVP slices.
  Amended on 2026-10-29 by **D-26**: meal photos and public image links move from slice 7 into
  slice 3.
  Amended on 2026-10-30 by **D-S1**: the AI consent switch and its record move from slice 7 into
  slice 6, and Settings shows "India · Kolkata" as fixed text.
- Owner: Project owner
- Applies to: all work until the MVP is released on Android.

## 1. The MVP rule
1. Build the **basic product** listed in section 2. Everything else is post-MVP (section 3).
2. When an open question is **not** answered in section 4 and does not block safety or
   privacy, the developer (Claude Code) picks the **simplest option that keeps every
   invariant**, records it as an "MVP default" in the pull request and in
   `constraints-and-assumptions.md`, and continues. **Do not stop to ask the owner.**
3. Never weaken: the invariants, decided owner decisions (D-01…D-17, D-19, D-20), privacy
   rules or accepted ADRs. Those still need the owner.
4. Missed edge cases go to a `docs/product/backlog.md` list for later releases.

## 2. In the MVP (Android first)
Only the Personal Training User view (D-20). Every account is a Personal Training User.

| Area | MVP includes | Main REQs |
|---|---|---|
| Account | Sign-up (email + password, email verification, 18+), sign-in, forgot/reset password, change password, log out, **delete account** (required by Google Play). Sign-up and reset emails come through Resend from a domain FitSphere owns (D-20) | ACC-007/008/009/010 |
| Settings | Theme, lifting unit, body-weight unit, AI consent toggle | ACC-001…005 |
| Role | Every account is a Personal Training User; the role selector is hidden (D-20) | ROLE-001 (MVP default only) |
| Own targets | The user sets their own daily calorie, protein and steps targets, weekly workout target and target body weight, labelled "Set by you" (D-20; extends Q-016) | ROLE-007 |
| Home | Date strip, past-date banner, calories and protein cards, weight/steps/sleep tiles, workout tracker, measurements card | DATE-*, HOME-* |
| Nutrition | Consumed (summary, meal slots, ••• menu); Diet plan as an empty state only: "No diet plan yet. Your coach will add one here." (D-20); Saved | NUT-*, PLAN-007, SAVED-* |
| Log meal | Date chip and day sheet; meal type and tags; typed text read by AI; photo (meal or label) read by AI; voice using the phone's built-in speech-to-text (ADR-0005); food search; barcode; saved meals; review before saving; photo upload or public image link with warning | LOG-* |
| Measurements | Bottom sheet, cm/in, mandatory waist fields, optional fields | MEAS-* |
| Training | "No training plan yet", "Start an empty workout", log sets/reps/weight, workout history (D-20) | TRN-002…005 |
| Progress | 4-week weight card, trend chart (1W/4W/12W/26W/All), weekly table vs Target row, days logged, measurements list | PRG-001…004, PRG-005 (without "Pre" row and week details), PRG-006 |
| Offline | Logging works offline and syncs; named "needs internet" warnings | NFR-004, ADR-0007 |

## 3. Post-MVP (later releases)
**Coach and Head Coach (D-20):** the Coach and Head Coach roles and the role selector ·
invitations · links (remove, leave, switch) · Head Coach permission · the Notifications list ·
push notifications · coach-set targets and plans (building them, the diet plan and training plan
views, "Log this option") · the push check and the iOS compile check that were Skeleton steps 11
and 12. Details: [`backlog.md`](backlog.md) B-17 to B-24.

Also post-MVP: iOS release · "Pre" baseline row and week-details screen · "Eaten before" list
(Saved covers re-logging) · Examples section in Log meal (tips stay) · audio storage · video
uploads (other than YouTube links) · premium plans · Platform Admin role and admin
screens · multiple time zones · other invite channels (SMS, WhatsApp) · backups and
Supabase Pro (until a D-16 trigger fires) · advanced conflict handling for simultaneous
plan edits · web dashboard for coaches.

## 4. MVP defaults for open questions
These answer open questions for the MVP. Any can be changed later.

| Question | MVP default |
|---|---|
| Q-008 Remember last role | Post-MVP: the role selector is hidden (D-20). When roles return: yes, per device |
| Q-011 "+" date | Opens with the currently selected date |
| Q-012 "+" scope | Meals only; tiles handle weight/steps/sleep |
| Q-013 Target row | The user sets their own weekly workout target, target body weight and daily steps target (D-20). Post-MVP, once coaches exist: the Coach (and an allowed Head Coach) set them |
| Q-016 No coach | Every user sets their own daily calorie, protein and steps targets, weekly workout target and target body weight (extended by D-20; first set for calorie and protein only) |
| Q-017 Future dates | Not selectable |
| Q-019 Week strip status box | Filled when at least one meal is logged that day |
| Q-022 Over target | Bar shows full in a warning colour; text "X kcal over" |
| Q-023 "By meal" | Opens Nutrition › Consumed for that day |
| Q-024 Weight tile | Follows the body-weight unit setting |
| Q-025 Empty workout | Counts toward the weekly target |
| Q-026 Measurements card | Always shown on Home: the selected date's measurements with "Edit measurements", or "Add measurements" when that date has none. Editing updates that date's entry. *Changed by D-24 (2026-10-29); was "Hidden once both waist values are logged for the current Mon–Sun week"* |
| Q-027 Arms/thighs | One value each |
| Q-028 Valid ranges | Weight 20–300 kg; steps 0–100,000; sleep 0–24 h (hours with one decimal); measurements 10–250 cm |
| Q-029 Close (X) with input | Closes without warning |
| Q-030 Same day twice | Weight, steps, sleep, measurements: one value per day; a new entry replaces it |
| Q-031 Tags | Tags attach to a meal; meal type is required; tagged meals show a small label in their slot |
| Q-032 Meal ••• menu | Edit, Delete, Save to my meals. Deleting a meal deletes its photo |
| Q-033 "Got it" | Remembered per user |
| Q-034 Option totals | Post-MVP with diet plans (D-20). When built: each option shows its own kcal and protein |
| Q-035 Option button | Post-MVP with diet plans (D-20). When built: "Log this option" logs it to that meal slot on the selected date |
| Q-036 Re-log saved meal | Goes to the meal slot it was saved from; user can change it |
| Q-037 Day status labels | "Nothing logged" or "N meals logged" |
| Q-042 Workout fields | Per exercise: sets × reps × weight; optional note |
| Q-043 Progress formulas | 4-week change = latest weigh-in minus the weigh-in nearest 28 days earlier; weekly rate = change ÷ the weeks between the two weigh-ins (÷ 4 when they are 28 days apart); weekly table = averages over days that have entries; chart needs 2+ weigh-ins. *Weekly rate refined by D-P1 (2026-10-30); was "change ÷ 4"* |
| Q-044 Days logged | Out of days since the account was created, capped at the last 28 days |
| Q-045 / Q-046 | "Pre" row and week details are post-MVP |
| Q-048 Delete account | Deletes the user's data from the database and file storage, ends all links (others get the neutral message; no links exist in the MVP, D-20), deletes the sign-in account. Only security logs required by REQ-NFR-005 are kept, without health data (Legal to confirm, Q-049). A simple web page explains how to request deletion by email, as Google Play requires |
| Q-050 Quality targets | No numeric targets for MVP; app must be usable on a low-end Android phone |
| Q-054 Language | English only |
| Q-064 Label photos | Deleted after the label is read; meal photos kept (D-16) |
| Q-073 Invitations | Post-MVP with invitations (D-20). When built: resend and cancel allowed; maximum 20 invitations per user per day |

## 5. MVP slices (D-20)
The owner set the order. Which REQs each slice covers is an MVP default (D-18 answer 3); each
slice's plan confirms its scope with the owner before work starts, as the Skeleton's did.

| # | Slice | Covers | Main REQs |
|---|---|---|---|
| 1 | Skeleton | Monorepo and CI; sign-up with 18+, verification, sign-in, reset, log out; IST dates; weight online and offline; self-access authorization. Plan: [`skeleton-slice.md`](../plans/skeleton-slice.md) | ACC-008, ACC-010, DATE-*, HOME-006 (weight), NFR-001, NFR-004 |
| 2 | Home and daily tracking | Bottom navigation and header; Home: week strip, calories and protein cards, steps and sleep tiles, workout tracker, measurements card; the measurements sheet; own targets. Plan: [`home-daily-tracking-slice.md`](../plans/home-daily-tracking-slice.md) (D-23); HOME-005 and the week strip's status box come with meals in slice 3 | NAV-001, NAV-002, HOME-*, MEAS-*, ROLE-007 |
| 3 | Meal logging (no AI) | Log meal: "+" button, date chip and day sheet, meal type and tags, food search, barcode, saved meals, tips, meal photo or public image link with warning, "AI meal reading is coming soon"; Nutrition: Consumed, the Diet plan empty state, Saved. Plan: [`meal-logging-slice.md`](../plans/meal-logging-slice.md) (D-26) | NAV-003, LOG-001…003, LOG-006 (meal photos), LOG-007, LOG-008, LOG-010, NUT-*, PLAN-007, SAVED-*, ACC-005 |
| 4 | Training | "No training plan yet", empty workout, sets × reps × weight, history, lifting unit; the Home workout count. Plan: [`training-slice.md`](../plans/training-slice.md) (D-29); the lifting-unit setting comes with slice 6 | TRN-002…005, HOME-007 |
| 5 | Progress | 4-week weight, average calories, days logged, trend chart, week table with Target row, measurements list. Plan: [`progress-slice.md`](../plans/progress-slice.md) (D-P1), built beside slice 6 | PRG-001…006 |
| 6 | Settings and account | Theme, units, the AI consent switch and record (no AI call), "India · Kolkata" as fixed text, change password, delete account and its web page. Plan: [`settings-slice.md`](../plans/settings-slice.md) (D-S1) | ACC-001…004, ACC-006 (fixed text), ACC-007, ACC-009 |
| 7 | AI meal reading | The consent check before each AI call (the switch and record come with slice 6, D-S1); typed text, voice (recognised on the phone), reading meal and label photos, review before saving. Paid AI use needs the owner's sign-off (C-008, Q-087) | ACC-004, LOG-004, LOG-005, LOG-006 (label photos, reading), LOG-009 |
| 8 | Release | Resend with FitSphere's own domain for sign-up and reset emails; the API on Cloud Run (Q-087); Google Play listing and testing; Legal's review before real users (Q-049) | ACC-010, C-008 |

Delete account (slice 6) covers the data that exists by then, meal photos included (D-26);
slice 7 extends it to label photos.
