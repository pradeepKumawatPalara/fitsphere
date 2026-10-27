# MVP Scope and Defaults (D-18)

- Status: **Accepted** — owner instruction, 2026-10-27: "deliver the basic requirements;
  don't ask deep edge cases; cover missed edge cases in future releases."
- Owner: Project owner
- Applies to: all work until the MVP is released on Android.

## 1. The MVP rule
1. Build the **basic product** listed in section 2. Everything else is post-MVP (section 3).
2. When an open question is **not** answered in section 4 and does not block safety or
   privacy, the developer (Claude Code) picks the **simplest option that keeps every
   invariant**, records it as an "MVP default" in the pull request and in
   `constraints-and-assumptions.md`, and continues. **Do not stop to ask the owner.**
3. Never weaken: the invariants, decided owner decisions (D-01…D-17), privacy rules or
   accepted ADRs. Those still need the owner.
4. Missed edge cases go to a `docs/product/backlog.md` list for later releases.

## 2. In the MVP (Android first)

| Area | MVP includes | Main REQs |
|---|---|---|
| Account | Sign-up (email + password, email verification), sign-in, forgot/reset password, change password, log out, **delete account** (required by Google Play) | ACC-007/008/009/010 |
| Settings | Theme, lifting unit, body-weight unit, AI consent toggle | ACC-001…005 |
| Roles | Declare roles; switch active role | ROLE-001/002 |
| Links | Invite by email (new user) or in-app (existing user); accept/decline; remove; leave; accepting a new invite ends the old link; Head Coach permission Allow/Decline; one Notifications list; push notifications | ROLE-003…015 |
| Coach | Trainee list; set calorie, protein and weekly workout targets; diet plan (meals, up to 3 options, ingredients, protein first); training plan by day with exercises and YouTube how-to link | ROLE-006, PLAN-*, TRN-001 |
| Head Coach | Coach list; counts per coach; for trainees who allowed: view and edit plans and targets | ROLE-004/010 |
| Home | Date strip, past-date banner, calories and protein cards, weight/steps/sleep tiles, workout tracker, measurements card | DATE-*, HOME-* |
| Nutrition | Consumed (summary, meal slots, ••• menu), Diet plan, Saved | NUT-*, PLAN-*, SAVED-* |
| Log meal | Date chip and day sheet; meal type and tags; typed text read by AI; photo (meal or label) read by AI; voice using the phone's built-in speech-to-text (ADR-0005); food search; barcode; saved meals; review before saving; photo upload or public image link with warning | LOG-* |
| Measurements | Bottom sheet, cm/in, mandatory waist fields, optional fields | MEAS-* |
| Training | Plan by day, empty workout, log sets/reps/weight, history | TRN-* |
| Progress | 4-week weight card, trend chart (1W/4W/12W/26W/All), weekly table vs Target row, days logged, measurements list | PRG-001…004, PRG-005 (without "Pre" row and week details), PRG-006 |
| Offline | Logging works offline and syncs; named "needs internet" warnings | NFR-004, ADR-0007 |

## 3. Post-MVP (later releases)
iOS release · "Pre" baseline row and week-details screen · "Eaten before" list (Saved
covers re-logging) · Examples section in Log meal (tips stay) · audio storage · video
uploads (other than YouTube links) · premium plans · Platform Admin role and admin
screens · multiple time zones · other invite channels (SMS, WhatsApp) · backups and
Supabase Pro (until a D-16 trigger fires) · advanced conflict handling for simultaneous
plan edits · web dashboard for coaches.

## 4. MVP defaults for open questions
These answer open questions for the MVP. Any can be changed later.

| Question | MVP default |
|---|---|
| Q-008 Remember last role | Yes, per device |
| Q-011 "+" date | Opens with the currently selected date |
| Q-012 "+" scope | Meals only; tiles handle weight/steps/sleep |
| Q-013 Target row | Coach (and allowed Head Coach) can set weekly workout target, target body weight and daily steps target |
| Q-016 No coach | A user without a coach can set their own calorie and protein targets |
| Q-017 Future dates | Not selectable |
| Q-019 Week strip status box | Filled when at least one meal is logged that day |
| Q-022 Over target | Bar shows full in a warning colour; text "X kcal over" |
| Q-023 "By meal" | Opens Nutrition › Consumed for that day |
| Q-024 Weight tile | Follows the body-weight unit setting |
| Q-025 Empty workout | Counts toward the weekly target |
| Q-026 Measurements card | Hidden once both waist values are logged for the current Mon–Sun week |
| Q-027 Arms/thighs | One value each |
| Q-028 Valid ranges | Weight 20–300 kg; steps 0–100,000; sleep 0–24 h (hours with one decimal); measurements 10–250 cm |
| Q-029 Close (X) with input | Closes without warning |
| Q-030 Same day twice | Weight, steps, sleep, measurements: one value per day; a new entry replaces it |
| Q-031 Tags | Tags attach to a meal; meal type is required; tagged meals show a small label in their slot |
| Q-032 Meal ••• menu | Edit, Delete, Save to my meals. Deleting a meal deletes its photo |
| Q-033 "Got it" | Remembered per user |
| Q-034 Option totals | Each option shows its own kcal and protein |
| Q-035 Option button | "Log this option": logs it to that meal slot on the selected date |
| Q-036 Re-log saved meal | Goes to the meal slot it was saved from; user can change it |
| Q-037 Day status labels | "Nothing logged" or "N meals logged" |
| Q-042 Workout fields | Per exercise: sets × reps × weight; optional note |
| Q-043 Progress formulas | 4-week change = latest weigh-in minus the weigh-in nearest 28 days earlier; weekly rate = change ÷ 4; weekly table = averages over days that have entries; chart needs 2+ weigh-ins |
| Q-044 Days logged | Out of days since the account was created, capped at the last 28 days |
| Q-045 / Q-046 | "Pre" row and week details are post-MVP |
| Q-048 Delete account | Deletes the user's data from the database and file storage, ends all links (others get the neutral message), deletes the sign-in account. Only security logs required by REQ-NFR-005 are kept, without health data (Legal to confirm, Q-049). A simple web page explains how to request deletion by email, as Google Play requires |
| Q-050 Quality targets | No numeric targets for MVP; app must be usable on a low-end Android phone |
| Q-054 Language | English only |
| Q-064 Label photos | Deleted after the label is read; meal photos kept (D-16) |
| Q-073 Invitations | Resend and cancel allowed; maximum 20 invitations per user per day |
