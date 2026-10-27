# Requirements

- Status: Draft (every requirement below is **Draft** until the product owner accepts it)
- Owner: Product owner (Q-001)
- Last updated: 2026-10-27
- Derived from: [`source/business-requirements.txt`](source/business-requirements.txt) (BRD). "BRD §x" points to the source section.

## Conventions
- IDs are stable: `REQ-<AREA>-<NNN>`. Never reuse a retired ID; mark it *Retired* instead.
- **Priority** is `TBD` for all items — the BRD does not rank features. The owner sets
  Must / Should / Could / Won't (Q-005).
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
- Requirement: The user profile provides a role selector listing Personal Training User, Head Coach and Coach, enabled only for roles granted to that user.
- Acceptance criteria:
  - Given a user granted only Personal Training User, then the other roles are not selectable.
  - Given a user granted Coach and Personal Training User, when they select Coach, then the Coach view loads.
- Open: who grants roles, and is Head Coach self-activated by "toggle" (BRD §1.2) or granted (Q-006). Is Personal Training User granted to everyone (Q-007)?

### REQ-ROLE-002 — View follows active role
- Requirement: The app's view and available functions change to match the active role.
- Type: Functional, Security
- Acceptance criteria:
  - Given the Coach role is active, then Coach-only functions are available and Head-Coach-only functions are not.
  - Given a role is not granted, when its functions are requested directly (e.g. by API), then the request is refused. *(Authorization must be enforced server-side, not only hidden in the UI.)*
- Open: is the last active role remembered between sessions (Q-008).

### REQ-ROLE-003 — Head Coach: manage Coach records
- Requirement: A Head Coach can create, view, update and delete Coach records under their management.
- Type: Functional, Security
- Acceptance criteria:
  - Given Head Coach view, when they add a Coach, then that Coach appears in their coach list.
  - Given a Coach not under this Head Coach, then it cannot be viewed, updated or deleted by them.
- Open: does "add" create a new account, invite by email, or assign an existing user (Q-009)? What happens to a deleted Coach's trainees (Q-010)? Is a "Coach record" the person's user account or a separate record (Q-058)?

### REQ-ROLE-004 — Head Coach: hierarchy visibility
- Requirement: A Head Coach can view details of their coaches and of trainees assigned to those coaches.
- Type: Functional, Privacy
- Acceptance criteria:
  - Given Head Coach view, then each managed coach and that coach's trainees are listed.
  - Trainees of coaches outside their hierarchy are not visible.
- Open: what "details" include (logs? targets? only summaries?), and whether a Head Coach may *edit* trainee plans (BRD "manage and oversee") — Q-021. Whether a coach's own Personal Training User data is visible up the hierarchy — Q-061.

### REQ-ROLE-005 — Coach: manage trainee records
- Requirement: A Coach can create, view, update and delete trainee records for trainees directly assigned to them.
- Type: Functional, Security
- Acceptance criteria:
  - Given Coach view, then only directly assigned trainees are listed.
  - A Coach cannot read or change a trainee assigned to another coach.
- Open: does "delete" remove the trainee's account and data, or only unassign them (Q-010)? How is a trainee added (Q-009)? Is a trainee record the user account (Q-058)? Which trainee data can the coach see (Q-059)? Can the trainee end the relationship (Q-060)?

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

### REQ-DATE-004 — Time-zone day boundaries
- Requirement: "Today" and day boundaries follow the user's configured country and time zone (REQ-ACC-006).
- Acceptance criteria:
  - Given time zone Asia/Kolkata, when a meal is logged at 23:50 IST, then it belongs to that IST date, regardless of server time zone.
- Open: when a user changes time zone, are existing entries re-bucketed (Q-018)? Which time zone applies when a coach views a trainee's day (Q-018)?

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
- Requirement: Country and time zone are configurable (e.g. India · Kolkata) and drive REQ-DATE-004.
- Open: default value for new users (device time zone?) — Q-018.

### REQ-ACC-007 — Change password
- Type: Security
- Requirement: A signed-in user can change their password.
- Open: authentication method, sign-up and forgot-password are not in the BRD (Q-047).

### REQ-ACC-008 — Log out
- Requirement: The user can log out; the session ends on this device.

### REQ-ACC-009 — Delete account
- Type: Privacy
- Requirement: "Delete account" opens a separate flow.
- Status: **Blocked — Q-048** (flow, data deleted vs retained, effect on coach/trainee links not defined).

### REQ-ACC-010 — Sign-up and sign-in
- Type: Security
- Requirement: A person can create an account and sign in before using any role view. *(Not in the BRD, which mentions only change password, log out and delete account; every flow in `flow.md` starts signed in.)*
- Status: **Blocked — Q-047** (sign-up and sign-in methods, forgot password, email verification and social login are not defined). A-008 (email + password) is a low-confidence assumption, not a decision.
- Open: minimum age (Q-066); accounts created by a coach or head coach (Q-009).

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
