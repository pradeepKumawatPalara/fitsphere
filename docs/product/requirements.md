# Requirements

- Status: Draft (every requirement below is **Draft** until the product owner accepts it)
- Owner: Product owner (Q-001)
- Last updated: 2026-10-27
- Derived from: [`source/business-requirements.txt`](source/business-requirements.txt) (BRD). "BRD §x" points to the source section.

## Conventions
- IDs are stable: `REQ-<AREA>-<NNN>`. Never reuse a retired ID; mark it *Retired* instead.
- **Priority** is `TBD` unless an owner decision sets it (so far only REQ-ACC-006: Won't) — the
  BRD does not rank features. The owner sets Must / Should / Could / Won't (Q-005).
- D- numbers refer to the owner decisions in [`owner-decisions-2026-10-27.md`](owner-decisions-2026-10-27.md).
- **Type** is Functional unless stated.
- **Related tests**: none yet; to be linked once `docs/quality/test-strategy.md` exists.
- Where the BRD is ambiguous, the requirement states the reading taken and links a Q- item in
  [`constraints-and-assumptions.md`](../architecture/constraints-and-assumptions.md).
  Those readings are **not** confirmed requirements.

Areas: NAV · ROLE · DATE · HOME · MEAS · NUT · PLAN · SAVED · LOG · TRN · PRG · ACC · NFR

---

## NAV — Navigation shell (BRD §1.1)

### REQ-NAV-001 — Bottom navigation
- Requirement: In the Personal Training User view, a four-tab bottom navigation gives access to Home, Nutrition, Training and Progress.
- Acceptance criteria:
  - Given the Personal Training User view, when any main screen is shown, then tabs Home, Nutrition, Training, Progress are visible and each opens its screen.
- Open: navigation for Coach and Head Coach views is not specified (Q-020).

### REQ-NAV-002 — Common header
- Requirement: Every main screen shows the selected date, a calendar shortcut and a profile avatar that opens Account settings.
- Acceptance criteria:
  - Given any main screen, then the selected date, a calendar icon and the profile avatar are visible.
  - When the avatar is tapped, then Account settings opens.

### REQ-NAV-003 — Quick-log button
- Requirement: A floating "+" button on Home and Nutrition opens the Log meal screen (REQ-LOG-001).
- Acceptance criteria:
  - Given Home or Nutrition, then a floating "+" is visible; given Training or Progress, then it is not.
  - When "+" is tapped, then Log meal opens with the date chip set to the currently selected date. *(Reading: BRD says date chip "defaults to Today" — Q-011.)*
- Open: whether "+" offers other quick logs (weight, steps) — Q-012.

---

## ROLE — Roles, views and hierarchy (BRD §1.2, §1.3, §11)

### REQ-ROLE-001 — Role selector
- Requirement: The user profile provides a role selector listing Personal Training User, Coach and Head Coach. In phase 1 any user can turn on any of these roles for themselves (D-06); a role becomes selectable once turned on.
- Type: Functional, Security
- Acceptance criteria:
  - Given a signed-in user, when they turn on the Coach role, then Coach becomes selectable in the role selector.
  - Given a user with Coach and Personal Training User turned on, when they select Coach, then the Coach view loads.
  - Turning on Coach or Head Coach gives no access to anyone else's data; that needs an accepted invitation (REQ-ROLE-009).
- Future scope: premium plans may gate the Head Coach role and limit how many coaches and trainees each plan allows (D-06).
- Open: is Personal Training User available to every account (Q-007)? D-06 suggests yes — to confirm.

### REQ-ROLE-002 — View follows active role
- Requirement: The app's view and available functions change to match the active role.
- Type: Functional, Security
- Acceptance criteria:
  - Given the Coach role is active, then Coach-only functions are available and Head-Coach-only functions are not.
  - Given a role is not granted, when its functions are requested directly (e.g. by API), then the request is refused. *(Authorization must be enforced server-side, not only hidden in the UI.)*
- Open: is the last active role remembered between sessions (Q-008).

### REQ-ROLE-003 — Head Coach: manage Coach records
- Requirement: A Head Coach can add Coaches by invitation (REQ-ROLE-008, REQ-ROLE-009), view and update the Coach records under their management, and remove (unassign) them. Removing a Coach deletes no data (D-07).
- Type: Functional, Security
- Acceptance criteria:
  - Given Head Coach view, when a Coach accepts their invitation, then that Coach appears in the Head Coach's coach list.
  - Given a Coach not under this Head Coach, then it cannot be viewed, updated or removed by them; no Head Coach can see another Head Coach's coaches or view (D-06).
  - When a Head Coach removes a Coach, then the link ends and no data is deleted; to rejoin, the Coach must accept a new invitation (D-07).
- Open: is a "Coach record" the person's user account or the link between them (Q-058) — and so what "update" changes.

### REQ-ROLE-004 — Head Coach: hierarchy visibility and plan editing
- Requirement: A Head Coach can view details of their accepted coaches and of those coaches' trainees, and can edit those trainees' plans (D-08). Each plan records who last changed it. *(Reading: "plans" means the diet plan and the training plan; whether targets are included is Q-075.)*
- Type: Functional, Security, Privacy
- Acceptance criteria:
  - Given Head Coach view, then each accepted coach and that coach's trainees are listed.
  - Trainees of coaches outside their hierarchy are not visible, and nothing in another Head Coach's hierarchy is visible (D-06).
  - When a Head Coach edits a trainee's diet or training plan, then the plan shows who last changed it.
- Open: whether trainees must be told or asked to agree before a Head Coach sees their data (Q-069); whether a coach's own logs are visible (Q-070); targets, and simultaneous edits by Coach and Head Coach (Q-075).

### REQ-ROLE-005 — Coach: manage trainee records
- Requirement: A Coach can add trainees by invitation (REQ-ROLE-008, REQ-ROLE-009), view and update the records of trainees who have accepted, and remove (unassign) them. Removing a trainee deletes no data (D-07).
- Type: Functional, Security
- Acceptance criteria:
  - Given Coach view, then only trainees who have accepted this Coach are listed.
  - A Coach cannot read or change a trainee of another coach.
  - When a Coach removes a trainee, then the link ends and no data is deleted; to rejoin, the trainee must accept a new invitation (D-07).
- Open: is a trainee record the user account or the link (Q-058)? Which trainee data can the coach see (Q-059)? Can a trainee leave on their own, or have more than one coach (Q-072)? Can the former coach still see past data after removal (Q-074)? What happens to targets and plans after removal (Q-060)?

### REQ-ROLE-006 — Coach: set targets and plans
- Requirement: A Coach can set for each assigned trainee: daily calorie target, daily protein target, weekly workout target, diet plan (REQ-PLAN-*) and training plan (REQ-TRN-001).
- Acceptance criteria:
  - When a Coach saves a calorie/protein target, then the trainee's Home and Diet plan show it.
  - When a Coach sends a training plan, then the trainee's Training tab shows it instead of the empty state.
- Open: weekly workout target and Progress "Target row" (body weight, steps) — are they set by the coach (Q-013)? Do target changes apply from a date or retroactively (Q-014)?

### REQ-ROLE-007 — Self-directed users
- Requirement: A Personal Training User without a coach can still log and view all personal data; target-dependent displays show a no-target state.
- Acceptance criteria:
  - Given no coach and no targets, then the calories card shows kcal eaten without a percentage or remaining value.
- Open: can a self-directed user set their own targets (Q-016)?

### REQ-ROLE-008 — Invite a new email address
- Requirement: A Head Coach can invite a Coach, and a Coach can invite a trainee, by entering an email address that is not registered in FitSphere (D-06). The invited person signs up (REQ-ACC-010); the link takes effect only when they accept (REQ-ROLE-009). *(Reading: an email that is already registered goes through REQ-ROLE-009 instead — Q-071.)*
- Type: Functional, Security
- Acceptance criteria:
  - Given an email address not registered in FitSphere, when a Coach invites it, then an invitation is sent to that address.
  - Until the invited person signs up and accepts, the inviter has no access to any of their data.
- Open: invitation expiry, resend, cancel and limits on pending invitations (Q-073).

### REQ-ROLE-009 — Invite an existing user; accept or decline
- Requirement: A Head Coach can invite an existing user to be their Coach, and a Coach can invite an existing user to be their trainee. The invited user accepts or declines; the link exists only after they accept (D-06).
- Type: Functional, Security
- Acceptance criteria:
  - When the invited user accepts, then they appear in the inviter's coach or trainee list.
  - When the invited user declines, then no link is created and the inviter gains no access.
  - Until the invitation is accepted, the inviter cannot see any of the invited user's data.
- Open: invitation rules (Q-073); more than one coach or head coach (Q-072).

### REQ-ROLE-010 — Past activity visible after acceptance
- Requirement: When a Coach accepts a Head Coach, the Head Coach can see the Coach's past activity, not only activity from the acceptance date on. When a trainee accepts a Coach, the Coach can likewise see the trainee's past activity (D-06).
- Type: Functional, Privacy
- Acceptance criteria:
  - Given a trainee who logged meals before accepting a Coach, when they accept, then the Coach can see those earlier logs.
- Open: whether trainees must be told or asked to agree before a Head Coach sees their data (Q-069); whether a coach's own food and body logs count as "activity" (Q-070); which trainee data the coach sees (Q-059).

---

## DATE — Global date handling (BRD §2)

### REQ-DATE-001 — Select a past date
- Requirement: Users can select any past date via the calendar icon or week/date strip; all on-screen data follows the selected date.
- Acceptance criteria:
  - When a past date is selected, then cards, meals and tiles show that date's data.
  - Future dates cannot be selected. *(Reading — BRD only mentions past dates; Q-017.)*

### REQ-DATE-002 — Past-date banner
- Requirement: While a past date is selected, a banner shows the date and a "Back to today" shortcut.
- Acceptance criteria:
  - Given a past date, then the banner is visible; when "Back to today" is tapped, then today is selected and the banner disappears.

### REQ-DATE-003 — Today highlight
- Requirement: Today is highlighted in blue on all date strips.

### REQ-DATE-004 — Day boundaries in India time
- Requirement: In phase 1 all users are in India, so "today" and day boundaries use Asia/Kolkata (IST, UTC+05:30, no daylight saving) for everyone (D-09). Other time zones are future scope (product brief).
- Acceptance criteria:
  - Given a meal logged to Today at 23:50 IST, then it belongs to that IST date, regardless of server time zone.

---

## HOME — Home dashboard (BRD §3)

### REQ-HOME-001 — Header
- Requirement: The header shows the selected date and the user's username.

### REQ-HOME-002 — Week strip
- Requirement: A Monday-to-Sunday strip shows a status box per day and highlights today and the selected day.
- Open: what the status box represents (meals logged? targets hit?) — Q-019.

### REQ-HOME-003 — Calories card
- Requirement: Shows kcal eaten vs target with progress bar, percentage achieved and kcal remaining for the selected date.
- Acceptance criteria:
  - Given target 2000 and eaten 1500, then 75% and 500 kcal remaining are shown.
  - Given eaten exceeds target, then behaviour is per Q-022 (over-target display not specified).

### REQ-HOME-004 — Protein card
- Requirement: As REQ-HOME-003 for protein in grams.

### REQ-HOME-005 — By-meal breakdown
- Requirement: A "By meal" link opens the meal-wise breakdown for the selected day.
- Open: is this the Nutrition › Consumed tab or a separate view (Q-023)?

### REQ-HOME-006 — Quick tiles
- Requirement: Tiles for Weight, Steps and Sleep show the logged value for the selected date, or "+ Add" when none.
- Acceptance criteria:
  - Given no weight logged that day, then the tile shows "+ Add"; tapping it allows entry.
  - Weight displays in the body-weight unit setting (REQ-ACC-003). *(BRD says "Weight (kg)"; Q-024.)*
- Open: sleep unit (hours? hours+minutes?) and input method for steps/sleep (Q-015).

### REQ-HOME-007 — Workout tracker
- Requirement: Shows workouts completed this week vs weekly target (e.g. "1 of 5 · 4 left") with Mon–Sun dots marking workout days.
- Open: does a self-directed "empty workout" count toward the target (Q-025)?

### REQ-HOME-008 — Measurements prompt
- Requirement: A Measurements card prompts weekly waist measurements and opens the measurements sheet (REQ-MEAS-001).
- Open: when the prompt is shown/hidden (e.g. hidden once logged this week) — Q-026.

---

## MEAS — Measurements logging (BRD §4)

### REQ-MEAS-001 — Measurements sheet
- Requirement: Measurements open as a bottom sheet from the Home card or Progress screen.

### REQ-MEAS-002 — Date selector
- Requirement: The sheet's date defaults to today and can be changed to another date (past only — Q-017).

### REQ-MEAS-003 — Unit toggle
- Requirement: A cm/in toggle sets the unit for entered values; stored values are unit-consistent. *(Storage unit is a contract decision.)*

### REQ-MEAS-004 — Mandatory waist fields
- Requirement: Upper waist (guidance "2 fingers above the navel") and lower waist (guidance "2 fingers below the navel") are mandatory.

### REQ-MEAS-005 — Optional fields
- Requirement: An expandable section holds optional chest, hips, arms, thighs and notes.
- Open: arms/thighs — left, right, or one value (Q-027)?

### REQ-MEAS-006 — Save and close
- Requirement: "Save measurements" is enabled only once both mandatory fields hold valid values; the close (X) button exits without saving.
- Acceptance criteria:
  - Given only upper waist entered, then Save is disabled.
  - When X is tapped after entering values, then nothing is saved.
- Open: valid ranges (Q-028); whether X warns about unsaved input (Q-029); logging twice on one date — overwrite or add (Q-030).

---

## NUT — Nutrition: Consumed (BRD §5)

### REQ-NUT-001 — Date strip and tabs
- Requirement: Nutrition has a horizontally scrollable date strip and three tabs: Consumed, Diet plan, Saved.

### REQ-NUT-002 — Eaten summary
- Requirement: Shows total kcal and colour-coded Protein, Carbs, Fat and Fiber for the selected date; a dash ("–") shows where there is no data.

### REQ-NUT-003 — Meal slots
- Requirement: Breakfast, Lunch, Snack and Dinner slots each show "Tap to add what you ate" with a "+" that opens Log meal preset to that slot and date.
- Open: where items logged with the tags "Before training" or "Dessert" appear (Q-031).

### REQ-NUT-004 — Save to my meals
- Requirement: Each logged meal has a "•••" menu with "Save to my meals", which adds it to the Saved tab.
- Open: other menu items (edit, delete, move to another day?) are not specified — Q-032. Editing/deleting a logged meal is assumed necessary (A-004).

---

## PLAN — Nutrition: Diet plan (BRD §6)

### REQ-PLAN-001 — Daily target card
- Requirement: Shows daily calorie and protein targets labelled "Set by your coach"; read-only for the client.
- Type: Functional, Security
- Acceptance criteria:
  - The trainee cannot change targets through the UI or API.

### REQ-PLAN-002 — How-to guide
- Requirement: A collapsible "How to use this plan" guide (meet calorie and protein targets, build every meal around a complete protein source, log every meal) with a "Got it" button that dismisses it.
- Open: is dismissal remembered per user/device (Q-033)?

### REQ-PLAN-003 — Meal cards
- Requirement: Each meal slot in the plan has a card showing its total kcal and protein (e.g. Breakfast: 646 kcal, 50 g protein).

### REQ-PLAN-004 — Up to three options per meal
- Requirement: Each meal offers 1–3 alternatives as tabs (Option 1–3). Each shows a meal name and ingredients with quantities in grams, scoops, tablespoons or pieces.
- Open: do the card totals vary per option (Q-034)?

### REQ-PLAN-005 — Protein first
- Requirement: In every option the protein source is listed first and visually highlighted.

### REQ-PLAN-006 — Option action button
- Requirement: Each option has an action button. **The BRD marks its purpose as presumed** ("presumably to log that planned meal").
- Status: **Blocked — Q-035.** Do not implement until confirmed.

### REQ-PLAN-007 — No diet plan state
- Requirement: When no diet plan exists, the tab shows an empty state. *(Not in BRD; inferred by analogy to REQ-TRN-002 — A-005.)*

---

## SAVED — Nutrition: Saved (BRD §7)

### REQ-SAVED-001 — Saved meals list
- Requirement: Lists the user's saved meals; one tap re-logs a meal to the selected date. *(Reading: which meal slot it goes to — Q-036.)*

### REQ-SAVED-002 — Empty state
- Requirement: With no saved meals, an empty state explains how to save one from the Consumed tab.

---

## LOG — Log meal (BRD §8)

### REQ-LOG-001 — Screen entry
- Requirement: Log meal opens from any "+" button and has a back button and a date chip.

### REQ-LOG-002 — Date picker sheet
- Requirement: The date chip opens a "Log this meal to" sheet listing Today, Yesterday and the five days before, each with its logging status (e.g. "nothing logged"), plus "Another day…" which opens a calendar.
- Open: full set of status labels (Q-037).

### REQ-LOG-003 — Meal type and tags
- Requirement: The user selects one meal type (Breakfast, Lunch, Snack, Dinner) and may add tags "Before training" and "Dessert".
- Open: are tags independent of meal type or alternative slots (Q-031)?

### REQ-LOG-004 — Free-text entry
- Requirement: A free-text box with placeholder "Speak or type what you ate…" accepts a description; a sample entry is shown.

### REQ-LOG-005 — Voice entry
- Requirement: "Speak your meal" records voice and converts it to meal text/items.
- Open: on-device vs cloud speech-to-text, and whether voice needs AI consent (Q-038).

### REQ-LOG-006 — Photo entry
- Requirement: A camera button captures a meal photo or nutrition label for parsing.
- Open: whether images are kept after parsing, for how long and who can see them (Q-064).

### REQ-LOG-007 — Alternative methods
- Requirement: Search database, Scan barcode, Eaten before (past meals) and Saved (your meals) are available and work without AI (REQ-ACC-005).
- Open: food database and barcode data sources (Q-039).

### REQ-LOG-008 — Guidance
- Requirement: Best-practice tips (amounts in grams; raw vs cooked, e.g. cooked rice weighs about 3× raw; name each food separately) and a collapsible Examples section (Best, Vague, Say) with Hide.

### REQ-LOG-009 — AI parsing
- Requirement: AI converts text, voice and photo input into food items with quantities (and nutrition values) that the user reviews before saving. *(Reading: BRD §8 says AI produces "food items and quantities" only. Whether the review shows nutrition values is Q-062; where those values come from is Q-063.)*
- Type: Functional, Privacy
- Acceptance criteria:
  - Given AI consent is off, then no meal text, photo, voice or label is sent to an AI service, and the user is offered non-AI methods.
  - Given AI consent is on, when the user submits text, then a list of items with quantities is returned for review; nothing is saved until confirmed. *(Review step — A-006.)*
  - When AI fails or times out, then the input is kept and the user can retry or use another method.
- Open: AI provider (ADR-0005), accuracy expectations (Q-040).

---

## TRN — Training (BRD §9)

### REQ-TRN-001 — Coach plan by day
- Requirement: The coach-assigned training plan appears day by day, with a how-to guide for every exercise.
- Open: how-to format (text, image, video) and who authors exercise content (Q-041).

### REQ-TRN-002 — Empty state
- Requirement: Until a coach sends a plan, Training shows "No training plan yet".

### REQ-TRN-003 — Empty workout
- Requirement: "Start an empty workout" lets the user log a self-directed session.
- Open: what is logged per exercise — sets, reps, weight, duration (Q-042)?

### REQ-TRN-004 — Workout history
- Requirement: "Workouts you have logged" lists past workouts.

### REQ-TRN-005 — Lifting unit
- Requirement: Lifting weights are entered and shown in the lifting-weight unit setting (REQ-ACC-002); changing the setting converts display of existing history.

---

## PRG — Progress (BRD §10)

### REQ-PRG-001 — Weight over 4 weeks
- Requirement: Shows weight change over the last 4 weeks and the weekly rate, in the body-weight unit (REQ-ACC-003).
- Acceptance criteria:
  - Given less than one week of weigh-ins, then the weekly rate is replaced by a not-enough-data message.
- Open: exact calculation of change and weekly rate (first vs last, averages, regression) — Q-043.

### REQ-PRG-002 — Average calories
- Requirement: Shows average daily calories vs target. *(Period and whether non-logged days count — Q-043.)*

### REQ-PRG-003 — Days logged
- Requirement: Shows meals logged as days with ≥1 meal out of total days (e.g. "0 of 27 days").
- Open: what "total days" counts from (program start?) — Q-044.

### REQ-PRG-004 — Weight trend chart
- Requirement: Chart with range filters 1W, 4W, 12W, 26W, All; empty state until enough weigh-ins exist.
- Open: minimum weigh-ins for the chart (Q-043).

### REQ-PRG-005 — Week-by-week table
- Requirement: Rows per week with Body Weight, Calories, Protein and Steps, a Target row, and a "Pre" row with pre-program baseline. Tapping a week opens its details.
- Open: who enters "Pre" baseline (Q-045); week details content (Q-046); aggregation per column (Q-043).

### REQ-PRG-006 — Measurements section
- Requirement: Lists measurements; with none, shows "Add first" (opens REQ-MEAS-001) and recommends weekly upper/lower waist tracking.

---

## ACC — Account and settings (BRD §11)

### REQ-ACC-001 — Appearance
- Requirement: Theme options System, Light, Dark with helper text for the selected option; System follows the device theme.

### REQ-ACC-002 — Lifting-weight unit
- Requirement: kg/lb setting for lifting weights in workouts and history, independent of body-weight unit.

### REQ-ACC-003 — Body-weight unit
- Requirement: kg/lb setting for weigh-ins and progress, independent of lifting unit.

### REQ-ACC-004 — AI meal reading consent
- Type: Privacy
- Requirement: An "AI meal reading" toggle records consent. Before any meal text, photo, voice note or nutrition label is sent to AI, the user is asked for consent.
- Acceptance criteria:
  - Given a new user, then AI is off until they consent. *(Default-off — A-007.)*
  - When consent is withdrawn, then no further data is sent to AI.
  - Consent changes are recorded with a timestamp. *(A-007.)*
- Open: what else a consent record must contain (Q-065).

### REQ-ACC-005 — Non-AI logging always available
- Requirement: Food database, barcodes and saved meals work with AI turned off.

### REQ-ACC-006 — Country and time zone
- Priority: **Won't** for this release (D-09). Phase 1 uses Asia/Kolkata for everyone (REQ-DATE-004).
- Requirement: Country and time zone are configurable (e.g. India · Kolkata) and drive REQ-DATE-004.
- Open: in phase 1, show "India · Kolkata" as fixed text or hide the setting — owner's choice, not yet made.

### REQ-ACC-007 — Change password
- Type: Security
- Requirement: A signed-in user can change their password.
- Sign-in is email and password (D-05); sign-up and password reset are in REQ-ACC-010.

### REQ-ACC-008 — Log out
- Requirement: The user can log out; the session ends on this device.

### REQ-ACC-009 — Delete account
- Type: Privacy
- Requirement: "Delete account" opens a separate flow.
- Status: **Blocked — Q-048** (flow, data deleted vs retained, effect on coach/trainee links not defined).

### REQ-ACC-010 — Sign-up and sign-in
- Type: Security
- Requirement: A person can create an account and sign in with email and password before using any role view; this is the only sign-in method in phase 1 (D-05). *(Not in the BRD, which mentions only change password, log out and delete account.)*
- Acceptance criteria:
  - Given an email address that is not registered, when the person signs up with it and a password, then an account is created and a verification email is sent to that address.
  - Given a registered email and its correct password, when the user signs in, then they are signed in.
  - Given a user who has forgotten their password, when they request a reset, then a reset link is sent to their registered email address and lets them set a new password.
- Open: minimum age (Q-066); what an unverified account may do, and how long verification and reset links stay valid (no Q- item yet).

---

## NFR — Non-functional (not in BRD; proposed, need owner targets)

### REQ-NFR-001 — Server-side authorization
- Type: Security
- Requirement: Every data read/write is authorized server-side against the active user's granted roles and hierarchy (self, assigned trainees, managed coaches).

### REQ-NFR-002 — Sensitive data handling
- Type: Privacy
- Requirement: Body, health, meal and photo data are treated as sensitive personal data: encrypted in transit and at rest, excluded from logs, and processed only for stated purposes. Applicable law (e.g. India's DPDP Act 2023) to be confirmed (C-003, Q-049).

### REQ-NFR-003 — Performance, availability, accessibility
- Requirement: Targets to be defined by owner — Q-050. No numeric target is assumed.

### REQ-NFR-004 — Offline logging
- Type: Functional, Operational
- Requirement: Users can log while offline: entries are saved on the device and synced when the connection returns. Any step that needs the internet shows a warning that names that step (D-04).
- Acceptance criteria:
  - Given the device is offline, when the user logs their weight, then it is saved on the device and shown in their data; when the connection returns, it is synced.
  - Given the device is offline, when the user starts a step that needs the internet, then the app shows a warning that names that step.
- Open: which steps work offline follows the proposed split in D-04, to confirm (Q-077); how offline changes are synced and conflicts resolved (ADR-0007).
