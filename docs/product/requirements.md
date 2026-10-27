# Requirements

- Status: Draft (every requirement below is **Draft** until the project owner accepts it)
- Owner: Project owner (D-01)
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

### REQ-ROLE-002 — View follows active role
- Requirement: The app's view and available functions change to match the active role.
- Type: Functional, Security
- Acceptance criteria:
  - Given the Coach role is active, then Coach-only functions are available and Head-Coach-only functions are not.
  - Given a role is not granted, when its functions are requested directly (e.g. by API), then the request is refused. *(Authorization must be enforced server-side, not only hidden in the UI.)*
- Open: is the last active role remembered between sessions (Q-008).

### REQ-ROLE-003 — Head Coach: manage Coach records
- Requirement: A Head Coach can invite Coaches (REQ-ROLE-008, REQ-ROLE-009), view the Coaches who have accepted, and remove (unassign) them, which ends the link. A link has no editable fields (D-11). Removing a Coach deletes no data (D-07).
- Type: Functional, Security
- Acceptance criteria:
  - Given Head Coach view, when a Coach accepts their invitation, then that Coach appears in the Head Coach's coach list.
  - Given a Coach not under this Head Coach, then it cannot be viewed or removed by them; no Head Coach can see another Head Coach's coaches or view (D-06).
  - When a Head Coach removes a Coach, then the link ends and no data is deleted; to rejoin, the Coach must accept a new invitation (D-07).
  - After removal, the Head Coach can no longer see any of that Coach's data, including past data (D-10).
  - When a Head Coach removes a Coach, then the Coach gets the neutral message "<name> is no longer linked with you" by push notification and in the in-app Notifications list (D-14).

### REQ-ROLE-004 — Head Coach: hierarchy visibility, plans and targets
- Requirement: A Head Coach can view the coaching activity of their accepted coaches — never a coach's own personal logs (D-10). Without a trainee's permission, that activity is counts per coach only: number of trainees; how many have allowed, declined or not yet answered (pending); and plans sent. It shows no trainee names or data (D-13). For each trainee who allows it (REQ-ROLE-013), the Head Coach can view that trainee's data and set their diet plan, training plan, and calorie, protein and weekly workout targets (D-08, D-13, D-14). A Head Coach never sees a trainee's settings or AI consent; of the permission answer, they see only its status (D-13). Trainees who have declined or not answered appear only in the counts, never by name; trainees who have allowed it are named (D-13, D-14).
- Type: Functional, Security, Privacy
- Acceptance criteria:
  - Given Head Coach view, then each accepted coach is listed with their counts, and under each coach the trainees who have allowed it (REQ-ROLE-013).
  - Given a coach with trainees who have declined or not yet answered, then the Head Coach sees those trainees only in the counts — no names and no data (D-13).
  - Trainees of coaches outside their hierarchy are not visible, and nothing in another Head Coach's hierarchy is visible (D-06).
  - Given a coach who also logs as a Personal Training User, then the Head Coach sees none of that coach's own logs (D-10).
  - Given a trainee who has declined or not yet answered, then the Head Coach cannot view or set their plans or targets (D-11, D-13).
  - When a Head Coach changes a trainee's plan or target, then the change records the Head Coach and the time, and the trainee and their coach see it labelled "Set by <name>" (D-13, D-14).
  - The Head Coach never sees a trainee's settings or AI consent (D-13).
- Open: if the Coach and the Head Coach edit at the same time, which change wins (Q-075, ADR-0007).

### REQ-ROLE-005 — Coach: manage trainee records
- Requirement: A Coach can invite trainees (REQ-ROLE-008, REQ-ROLE-009), view the trainees who have accepted, update their plans and targets (REQ-ROLE-006), and remove (unassign) them, which ends the link. A link has no editable fields (D-11). Removing a trainee deletes no data (D-07).
- Type: Functional, Security
- Acceptance criteria:
  - Given Coach view, then only trainees who have accepted this Coach are listed.
  - A Coach cannot read or change a trainee of another coach.
  - When a Coach removes a trainee, then the link ends and no data is deleted; to rejoin, the trainee must accept a new invitation (D-07).
  - After removal, the Coach can no longer see any of the trainee's data, including past data (D-10).
  - When a Coach removes a trainee, then the trainee gets the neutral message "<name> is no longer linked with you" by push notification and in the in-app Notifications list (D-14).
  - The Coach never sees the trainee's settings or AI consent (D-13).
  - Given the Coach has a Head Coach, then the Coach sees whether each trainee has allowed, declined or not answered the Head Coach request (D-14).
- Open: which trainee data can the coach see (Q-059)? What happens to targets and plans after removal (Q-060)?

### REQ-ROLE-006 — Coach: set targets and plans
- Requirement: A Coach can set for each assigned trainee: daily calorie target, daily protein target, weekly workout target, diet plan (REQ-PLAN-*) and training plan (REQ-TRN-001). A Head Coach can set the same targets and both plans, only while the trainee allows it (REQ-ROLE-004, D-13, D-14). Every change records who made it and when; the trainee, their coach and — while the trainee allows it — the Head Coach see the latest change and its author (D-13). Plans and targets are labelled "Set by <name>", naming the actual author (D-14).
- Acceptance criteria:
  - When a Coach saves a calorie/protein target, then the trainee's Home and Diet plan show it.
  - When a Coach sends a training plan, then the trainee's Training tab shows it instead of the empty state.
  - When a Coach or Head Coach changes a target or plan, then the trainee, the coach and (while allowed) the Head Coach see who made the latest change and when (D-13), and the label reads "Set by <name>" with that person's name (D-14).
- Open: which change wins if the Coach and the Head Coach edit at the same time (Q-075, ADR-0007). Progress "Target row" (body weight, steps) — is it set by the coach (Q-013)? Do target changes apply from a date or retroactively (Q-014)?

### REQ-ROLE-007 — Self-directed users
- Requirement: A Personal Training User without a coach can still log and view all personal data; target-dependent displays show a no-target state.
- Acceptance criteria:
  - Given no coach and no targets, then the calories card shows kcal eaten without a percentage or remaining value.
- Open: can a self-directed user set their own targets (Q-016)?

### REQ-ROLE-008 — Invite a new email address
- Requirement: A Head Coach can invite a Coach, and a Coach can invite a trainee, by entering an email address (D-06). When the address has no FitSphere account, phase 1 sends an invitation email with a sign-up link (D-11); the person signs up (REQ-ACC-010), and the link takes effect only when they accept (REQ-ROLE-009). A registered address gets the in-app invitation instead (REQ-ROLE-009). The inviter sees only "Invitation sent" and is never told whether the address was registered or which channel was used (REQ-ROLE-011).
- Type: Functional, Security
- Acceptance criteria:
  - Given an email address with no FitSphere account, when a Coach invites it, then an invitation email with a sign-up link is sent to that address and the Coach sees "Invitation sent".
  - Until the invited person signs up and accepts, the inviter has no access to any of their data.
  - The sign-up link in an invitation email works only once and expires 7 days after it is sent (D-13).
  - The sender domain has SPF, DKIM and DMARC set up (D-13).
- Future scope: other channels such as SMS or WhatsApp (D-11).
- Open: resend, cancel and the size of the daily limit (Q-073); the email service and sender domain (Q-082). Threat model items T-04, T-05.

### REQ-ROLE-009 — Invite an existing user; accept or decline
- Requirement: A Head Coach can invite an existing user to be their Coach, and a Coach can invite an existing user to be their trainee. The invitation is delivered in the app — a push notification plus the in-app Notifications list, so it is not lost if push is off; no email is sent (D-11, D-15). The invited user accepts or declines; the link exists only after they accept (D-06). When a coach accepts, the inviting Head Coach becomes their Head Coach (D-11). The inviter sees "Invitation sent", as for any address (REQ-ROLE-011).
- Type: Functional, Security
- Acceptance criteria:
  - Given a registered user, when they are invited, then they get a push notification and the invitation appears in their in-app Notifications list (D-15).
  - Given push notifications are off, then the invitation still appears in the in-app Notifications list (D-15).
  - When the invited user accepts, then they appear in the inviter's coach or trainee list.
  - When the invited user declines, then no link is created and the inviter gains no access.
  - Until the invitation is accepted, the inviter cannot see any of the invited user's data.
  - Given the invited user already has a coach or Head Coach, when they accept, then REQ-ROLE-015 applies.
  - An in-app invitation expires 7 days after it is sent (D-14).
- Open: resend, cancel and pending-invitation rules (Q-073); the push notification service (Q-083).

### REQ-ROLE-010 — Head Coach sees past coaching activity
- Requirement: When a Coach accepts a Head Coach, the Head Coach can see the Coach's past coaching activity, not only activity from the acceptance date on — never the coach's own personal logs (D-06, D-10). Coaching activity is the counts per coach in REQ-ROLE-004 (D-13). Any trainee's data is visible only while that trainee allows it (REQ-ROLE-013). *(The coach-sees-trainee part is now REQ-ROLE-012 — D-11.)*
- Type: Functional, Privacy
- Acceptance criteria:
  - Given a coach who sent plans before accepting the Head Coach, when they accept, then the Head Coach's "plans sent" count for that coach includes the earlier plans.
  - Given a coach who also logs as a Personal Training User, then their Head Coach never sees those personal logs (D-10).
  - Given a trainee who has not allowed it, then the Head Coach sees none of that trainee's data, including within the coach's past activity (D-11).

### REQ-ROLE-011 — Invitation privacy and daily limits
- Requirement: Inviting someone by email never reveals whether the address is registered in FitSphere: the inviter always sees "Invitation sent" and is never shown which channel was used (email or in-app — D-11). Each user can send only a limited number of invitations per day (D-10).
- Type: Security, Privacy
- Acceptance criteria:
  - Given one registered and one unregistered email address, when a Coach invites each, then the Coach gets the same "Invitation sent" result for both, in the app and in the API response, with no sign of which channel was used; response timing does not reveal the difference (T-01).
  - Given a user who has reached the daily invitation limit, when they send another invitation, then it is refused and they are told the daily limit is reached.
- Open: the size of the daily limit, resend and cancel (Q-073); expiry is decided (REQ-ROLE-008, REQ-ROLE-009; D-13, D-14). Threat model items T-01, T-04, T-05.

### REQ-ROLE-012 — Coach sees a trainee's past activity
- Requirement: When a trainee accepts a Coach, the Coach can see the trainee's past activity, not only activity from the acceptance date on (D-06). *(Split from REQ-ROLE-010 — D-11.)*
- Type: Functional, Privacy
- Acceptance criteria:
  - Given a trainee who logged meals before accepting a Coach, when they accept, then the Coach can see those earlier logs.
- Open: which trainee data the coach sees (Q-059).

### REQ-ROLE-013 — Trainee permission for Head Coach access
- Requirement: A Head Coach sees a trainee's data and sets their plans and targets only while the trainee allows it (D-10, D-11, D-13). The trainee gets an in-app request in the Notifications list (D-15): "Allow Head Coach <name> to see your logs and set your plans and targets?" with **Allow** and **Decline** (wording D-14). Declined means the Head Coach has no access to that trainee. The trainee can change the answer at any time in Settings. Each answer is recorded with a timestamp. Of the answer, the Head Coach sees only its status — allowed, declined or pending (D-13; see REQ-ROLE-004) — and the trainee's coach sees each trainee's status (D-14). Answers are kept while the account exists; how long they are kept after the account is deleted is decided with Legal (Q-049, D-13).
- Type: Functional, Privacy, Security
- Acceptance criteria:
  - When a coach accepts a Head Coach, then each of that coach's trainees gets the request in the app, in the Notifications list (D-15).
  - Given a new trainee accepting a coach who has a Head Coach, then the request is part of accepting.
  - Given a trainee who has declined or not yet answered, then the Head Coach sees none of their data and cannot set their plans or targets.
  - When the trainee taps Allow, then the Head Coach can see their logs and set their plans and targets; when they later change the answer to Decline in Settings, then that access ends.
  - Every answer, and every change to it, is stored with a timestamp.
  - When the coach switches to a new Head Coach, then earlier answers do not carry over and each trainee gets a fresh request (REQ-ROLE-015).
  - Answers are kept for as long as the trainee's account exists (D-13).
  - The trainee's coach sees whether each trainee has allowed, declined or not answered (D-14).
- Open: whether this step meets the consent requirements of India's DPDP Act, and how long answers are kept after an account is deleted, are for Legal to confirm (Q-049). Threat model: permission matrix.

### REQ-ROLE-014 — Leave a coach or Head Coach
- Requirement: A trainee can leave their coach, and a coach can leave their Head Coach, at any time (D-11). Leaving ends the link exactly like removal: no data is deleted, and the other side loses access to all of the leaver's data, including past data (D-07, D-10).
- Type: Functional, Privacy, Security
- Acceptance criteria:
  - When a trainee leaves their coach, then the link ends, no data is deleted, and the coach — and the coach's Head Coach — can no longer see any of the trainee's data, including past data.
  - When a coach leaves their Head Coach, then the Head Coach can no longer see the coach's coaching activity or any of that coach's trainees' data.
  - When someone leaves, then the other side gets a neutral message: "<name> is no longer linked with you" (D-13), by push notification and in the in-app Notifications list (D-14). The same message goes to the removed side on removal (REQ-ROLE-003, REQ-ROLE-005).
  - On its next sync, the former coach's or Head Coach's app deletes the trainee's data from the device (D-13, REQ-NFR-004).
  - To rejoin, the person must accept a new invitation (D-07).
- Open: what happens to targets and plans after the link ends (Q-060).

### REQ-ROLE-015 — Switch coach or Head Coach
- Requirement: A coach has at most one Head Coach and a trainee at most one coach (D-11). If a coach who already has a Head Coach accepts an invitation from another Head Coach, the old link ends first — the old Head Coach loses all access immediately (D-10) — and then the new link is created. Trainees' earlier Allow/Decline answers do not carry over: each trainee gets a fresh request for the new Head Coach (REQ-ROLE-013). The same applies when a trainee accepts a new coach: the old coach link ends first.
- Type: Functional, Privacy, Security
- Acceptance criteria:
  - Given a coach linked to Head Coach A, when they accept an invitation from Head Coach B, then A loses all access immediately and B becomes their Head Coach.
  - Given trainees who had allowed A, then B has no access to any of them until each one allows B.
  - Given a trainee linked to Coach X, when they accept an invitation from Coach Y, then the link with X ends first and X loses all access.
  - Given a coach who already has a Head Coach, or a trainee who already has a coach, then before they accept, the accept screen warns that accepting ends their current link (D-13).
  - When the old link ends, then the old Head Coach or coach gets a neutral message: "<name> is no longer linked with you" (D-13), by push notification and in the in-app Notifications list (D-14).
  - On its next sync, the old Head Coach's or coach's app deletes the trainee data it holds from the device (D-13, REQ-NFR-004).
- Open: what happens to the old coach's targets and plans (Q-060). Threat model item T-06.

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
- Requirement: Shows daily calorie and protein targets labelled "Set by <name>", naming whoever made the latest change — the coach or the Head Coach (D-14; the BRD's label was "Set by your coach"); read-only for the client. It also shows when the latest change was made (D-13).
- Type: Functional, Security
- Acceptance criteria:
  - The trainee cannot change targets through the UI or API.
  - When the coach or Head Coach changes a target, then the card reads "Set by <name>" with that person's name, and shows when the change was made (D-13, D-14).

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
- Requirement: "Speak your meal" records voice and converts it to meal text/items. The recording is deleted once it has been transcribed; audio storage is future scope (D-16).
- Acceptance criteria:
  - When a voice entry has been transcribed, then the audio recording is deleted and is not kept on the device or the server (D-16).
- Open: on-device vs cloud speech-to-text, and whether voice needs AI consent (Q-038).

### REQ-LOG-006 — Photo entry
- Requirement: A camera button captures a meal photo or nutrition label for parsing. A meal photo is kept as a compressed viewable copy of about 200 KB (phone-viewable quality) with a small thumbnail for lists. Instead of uploading, the user can paste a public link to an image (REQ-LOG-010). Photos are view-only (REQ-NFR-006). A user's own photos are never fully deleted automatically while the account exists; an original may be replaced by a viewing-quality copy (D-16). A user may delete their own meal photo or nutrition-label image, and it is then really removed: from file storage, and from copies cached on other phones at their next sync (D-16, A-004).
- Acceptance criteria:
  - When a user saves a meal photo, then the stored copy is about 200 KB and a thumbnail is created for lists (D-16).
  - When a user deletes their own meal photo, then the file and its thumbnail are removed from file storage, no viewing link can be issued for it, and phones that cached it delete it on their next sync (D-16).
- Open: whether nutrition-label images are kept after parsing by default, and whether deleting a meal also deletes its photo (Q-064, Q-032); how long media is kept (Q-089); which of it the coach sees (Q-059); once backups exist, how long they keep deleted media (Q-049).

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

### REQ-LOG-010 — Public link instead of an upload
- Requirement: Instead of uploading, a user can add a public link (e.g. YouTube) to their own content — in phase 1, meal photos only (REQ-LOG-006; D-16, confirmed). Links to their own videos come with the audio/video release (future scope). Before the link is saved, the app shows a privacy warning, e.g. "Anyone who has this link can view it, even if you later remove your coach. FitSphere cannot delete content stored on YouTube or other sites.", and the user must confirm to continue. When a link between people ends, FitSphere hides the external link from the former coach or Head Coach, but cannot revoke access to the content itself (accepted risk R-004, invariant 1).
- Type: Functional, Privacy
- Acceptance criteria:
  - When a user adds a public link, then the privacy warning is shown and the link is saved only after the user confirms; if they cancel, nothing is saved.
  - Given a link between a trainee and their coach that has ended, when the former coach requests the trainee's data, then the server returns none of the trainee's external links (D-16).
- Open: Legal to confirm the approach (Q-049). Proposed safeguards for links: threat model item T-09.

---

## TRN — Training (BRD §9)

### REQ-TRN-001 — Coach plan by day
- Requirement: The coach-assigned training plan appears day by day, with a how-to guide for every exercise. In phase 1 a how-to is a YouTube link, unlisted or public, provided by the coach (D-16, answers Q-041); FitSphere stores only the link.
- Acceptance criteria:
  - Given an exercise in the plan with a how-to link, then the trainee can open the how-to video from the plan.

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
  - Given an email address that is already registered, when someone signs up with it, then they see the same neutral message as for a new address, and response timing does not reveal the difference (D-11, T-01).
  - When a password reset is requested, then the same neutral message is shown whether or not the email is registered, under the same timing rule (D-11).
- Open: minimum age (Q-066); what an unverified account may do, and how long verification and reset links stay valid (Q-080); which email service sends these emails (Q-082).

---

## NFR — Non-functional (not in BRD; proposed, need owner targets)

### REQ-NFR-001 — Server-side authorization
- Type: Security
- Requirement: Every data read and write is authorized on the server. A user can access another person's data only through an accepted link: a Coach → their accepted trainees; a Head Coach → the coaching activity of their accepted coaches (never a coach's own personal logs; counts only — REQ-ROLE-004), and a trainee's data only while that trainee allows it (REQ-ROLE-013). A Head Coach may view and set a trainee's plans and targets only while the trainee allows it. Coaches and Head Coaches never see a trainee's settings or AI consent. Ending a link — by removal, leaving or switching — ends access to all of that person's data, including past data. Changes queued offline are re-authorized at sync time. UI hiding is not access control. Exception — external links: for content a user stores on another site and adds as a link, ending a link hides the link from the former coach or Head Coach, but FitSphere cannot revoke access to the content itself (REQ-LOG-010, R-004). (Project invariant 1; D-06, D-07, D-10, D-11, D-13, D-16.)
- Acceptance criteria:
  - Given a request for another person's data with no accepted link, or from a Head Coach without that trainee's permission, then the server refuses it, whether the request comes from the app or directly to the API.
  - Given a Head Coach whose access a trainee has declined, when they try to set that trainee's plan or target through the API, then the server refuses it (D-13).

### REQ-NFR-002 — Sensitive data handling
- Type: Privacy
- Requirement: Body, health, meal and photo data are treated as sensitive personal data: encrypted in transit and at rest, excluded from logs, and processed only for stated purposes. Applicable law (e.g. India's DPDP Act 2023) to be confirmed (C-003, Q-049).

### REQ-NFR-003 — Performance, availability, accessibility
- Requirement: Targets to be defined by owner — Q-050. No numeric target is assumed.
- Long-term aspiration, **not a capacity target**: FitSphere aims to support up to 20 million users. Phase 1 starts on free tiers (C-008). ADR-0002 and ADR-0003 must explain how the chosen backend and database can grow toward this without a rewrite, and what each stage would cost (D-15).

### REQ-NFR-004 — Offline logging and data on the device
- Type: Functional, Operational, Security
- Requirement: Users can log while offline: entries are saved on the device and synced when the connection returns. Any step that needs the internet shows a warning that names that step (D-04). Every queued change is re-authorized on the server at sync time (D-10).
  - **The server is the permanent record.** No device rule ever deletes a user's full history; on sign-in, even years later, the app restores it from the server (D-14).
  - **Encryption:** health data stored on the device is encrypted (D-10), invisibly to the user — no extra passwords, no lost features, and offline logging still works (D-14).
  - **Ended links:** the former coach's or Head Coach's app deletes that trainee's data from the device on its next sync (D-13).
  - **30 days without a sync:** the app clears only (a) unfinished drafts, such as typed meal text never sent for AI reading, and (b) other people's data copied onto a coach's or Head Coach's phone. Cleared trainee data comes back on the next sync if the link is still active (D-14). Three days before an unfinished draft is cleared, the app shows a reminder: "You have an unfinished meal entry. It will be removed in 3 days." (D-15)
  - **Never cleared automatically:** the user's own entries waiting to sync — they are the only copy and stay until synced (D-14).
  - **Photos cached on the device** (REQ-NFR-006) follow the same rules: encrypted; deleted for a trainee on the next sync after the link ends; other people's photos cleared after 30 days without a sync (D-16).
  - **Phase 1 hosting (D-16):** the Supabase Free plan has no backups, so data lost on the server cannot be restored from a backup. This conflicts with "the server is the permanent record" and is accepted risk R-005.
- Acceptance criteria:
  - Given the device is offline, when the user logs their weight, then it is saved on the device and shown in their data; when the connection returns, it is synced.
  - Given the device is offline, when the user starts a step that needs the internet, then the app shows a warning that names that step.
  - Given a change queued offline by a user who has since lost access (e.g. a coach removed from a trainee), when it syncs, then the server rejects it (D-10).
  - Health data stored on the device is encrypted (D-10); the user is asked for no extra password, no feature is lost, and offline logging still works (D-14).
  - Given a user who signs in on a new or reset phone, then the app restores their full history from the server (D-14).
  - Given a link that has ended, when the former coach's or Head Coach's app next syncs, then it deletes that trainee's data from the device (D-13).
  - Given a phone that has not synced for 30 days, then unfinished drafts and other people's data on it are cleared; the user's own entries waiting to sync are kept (D-14).
  - Given an unfinished draft that will be cleared in 3 days, then the app shows the reminder "You have an unfinished meal entry. It will be removed in 3 days." (D-15)
  - Given cleared trainee data on a coach's phone whose link is still active, when the phone next syncs, then that data comes back (D-14).
- Open: which steps work offline follows the proposed split in D-04, to confirm (Q-077); how offline changes are synced and conflicts resolved (ADR-0007). If an encryption choice would break a feature, it is raised as a question, not applied (D-14).

### REQ-NFR-005 — Operator access
- Type: Security, Privacy, Operational
- Requirement: In phase 1 the project owner is the only operator of FitSphere; there is no support staff. Every admin access to user data is logged (D-13). The log is stored in the backend database, kept for 1 year (Legal to confirm, Q-049) and reviewed monthly by the owner (D-14). The owner signs in to the hosting dashboards (Supabase, Google Cloud) with two-factor sign-in, never browses user data in those dashboards, and makes any needed access through the logged admin path (D-16). In phase 1 the operator reviews their own access, and dashboard access is outside this log — accepted risk R-003. A Platform Admin role is future scope (Q-086).
- Acceptance criteria:
  - When the operator views or changes a user's data through admin access, then a log entry records who, when and whose data — without the data itself (invariant 7).
  - Log entries are kept for 1 year (D-14; period to be confirmed by Legal, Q-049).
  - The owner's Supabase and Google Cloud accounts have two-factor sign-in turned on (D-16).

### REQ-NFR-006 — View-only media
- Type: Functional, Privacy, Operational
- Requirement: Photos — and audio and video once the audio/video release adds them — are viewed or played in the app; there is no download feature (D-16). Lists show a small thumbnail rather than the full copy. Viewed photos are cached on the device under the rules in REQ-NFR-004, so repeat views do not download them again (D-16). View-only is not copy protection: anyone can take a screenshot or screen recording, so privacy rests on who may view (REQ-NFR-001).
- Acceptance criteria:
  - Given a photo in a meal log, then the app shows it and offers no download or save-to-device action.
  - Given a photo already viewed on this device, when it is viewed again, then it is shown from the device cache without being downloaded again.
