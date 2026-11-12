# Requirements

- Status: Draft (every requirement below is **Draft** until the project owner accepts it)
- Owner: Project owner (D-01)
- Last updated: 2026-11-12 (D-92: REQ-LOG-007, everyday foods first, dry packs last; D-91: REQ-LOG-007, the plain food first; D-89: REQ-LOG-007, a name's brands alike in energy, each brand once; D-88: REQ-LOG-007, Search foods ignores accents; D-86: REQ-LOG-007, Search foods ignores any mark typed; D-85: REQ-HOME-008, when measurements were last logged and "Due" after 7 days; D-84: REQ-NAV-002, the header's calendar marks meal days and workout days; D-83: REQ-TRN-003, the Workout in progress pill; D-82: REQ-TRN-008, the graph touched, History's three bests). 2026-11-11 (D-82: the new REQ-TRN-008, an exercise's page, and REQ-TRN-003's Progress, Edit and Remove bar). Earlier the same day (D-81: REQ-TRN-003, the exercise library's details, on the server only). Earlier the same day (D-80: REQ-LOG-007, the packaged foods named only by their brand renamed or left out). Earlier the same day (D-78: REQ-LOG-007, Search foods shows each branded product once). Earlier the same day (D-79: REQ-HOME-002, the date strip shows Monday to Sunday). Earlier the same day (D-77: REQ-ROLE-007, targets by date, and the new REQ-ROLE-018, Target history). 2026-11-10 (D-71: REQ-TRN-003 and REQ-TRN-004, the workout timer). Earlier the same day (D-67: REQ-TRN-003, the exercise library and its Category and Sub-group). Earlier the same day (D-65: REQ-TRN-002 to REQ-TRN-004, Training's date strip, By day and All workouts). 2026-11-05 (D-50: REQ-TRN-003's exercise list, types and sets). 2026-11-04 (the profile, REQ-ACC-011, D-38). Before that: 2026-10-30 (Settings slice, D-31: REQ-ACC-004's switch and record come with slice
  6; REQ-ACC-006 shown as fixed text). Earlier the same day (Progress slice, D-30: MVP notes on
  REQ-PRG-001 to REQ-PRG-006, and the weekly rate refined; D-26 answer 3, amended: REQ-LOG-008's
  cooked-rice example flagged as unsupported). 2026-10-29 (Training slice, D-29: MVP notes on REQ-TRN-002 to REQ-TRN-005 and
  REQ-HOME-007). Earlier the same day (D-24: REQ-HOME-008, the Measurements card shows and edits a
  date's measurements). Earlier the same day (Home and daily tracking slice, D-23): where targets
  are set; storage units for sleep and measurements; the parts of REQ-HOME-002, REQ-HOME-003/004,
  REQ-HOME-005 and REQ-HOME-007 that wait for meals or workouts. 2026-10-28 (D-20: Coach and Head
  Coach requirements marked Post-MVP)
- Derived from: [`source/business-requirements.txt`](source/business-requirements.txt) (BRD). "BRD §x" points to the source section.
- Scope: the MVP in [`mvp-scope.md`](mvp-scope.md) (D-18, D-20). Every requirement is in the MVP unless it, or part of it, is marked **Post-MVP**; post-MVP work is listed in [`backlog.md`](backlog.md). The MVP is the Personal Training User view only (D-20).

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
- **MVP default (D-18)** marks an answer used for the MVP: set by the owner in
  [`mvp-scope.md`](mvp-scope.md#4-mvp-defaults-for-open-questions) section 4, or chosen under
  D-18's rule and listed in
  [`constraints-and-assumptions.md`](../architecture/constraints-and-assumptions.md#mvp-defaults-d-18).
  Any can be changed later.
- **Post-MVP** marks a requirement, or part of one, that is not in the MVP (D-18,
  `mvp-scope.md` section 3).

Areas: NAV · ROLE · DATE · HOME · MEAS · NUT · PLAN · SAVED · LOG · TRN · PRG · ACC · NFR

---

## NAV — Navigation shell (BRD §1.1)

### REQ-NAV-001 — Bottom navigation
- Requirement: In the Personal Training User view, a four-tab bottom navigation gives access to Home, Nutrition, Training and Progress.
- Acceptance criteria:
  - Given the Personal Training User view, when any main screen is shown, then tabs Home, Nutrition, Training, Progress are visible and each opens its screen.
- Open: navigation for Coach and Head Coach views is not specified (Q-020). **Post-MVP** with those views (D-20, backlog B-17).
- Each tab shows an icon over its label (D-34, amending D-23's text labels). Since the redesign's 2.1 (D-35, locked by the owner 2026-11-03): Lucide outline icons, labels in condensed capitals, and the tab shown in caramel with a bar along its top edge, the others muted; read out as selected.

### REQ-NAV-002 — Common header
- Requirement: Every main screen shows the selected date, a calendar shortcut and a profile avatar that opens Account settings. The calendar marks each day with a meal (an apple under the date) and each day with a workout (a dumbbell), and counts the month's workouts under its name (D-84).
- Acceptance criteria:
  - Given any main screen, then the selected date, a calendar icon and the profile avatar are visible.
  - When the avatar is tapped, then Account settings opens.
  - Given meals and workouts on the phone, when the calendar opens, then each day with a meal has an apple and each day with a workout Training lists (D-65) a dumbbell under its date, no day tinted, the month's workouts are counted under its name ("No workouts", "1 workout", "3 workouts"), a key explains the apple and the dumbbell, and screen readers hear each day's meals and workouts ("2 meals logged, 1 workout logged", "Nothing logged") (D-84).

### REQ-NAV-003 — Quick-log button
- Requirement: A floating "+" button on Home and Nutrition opens the Log meal screen (REQ-LOG-001).
- Built in the Meal logging slice, with Log meal (D-23).
- Acceptance criteria:
  - Given Home or Nutrition, then a floating "+" is visible; given Training or Progress, then it is not.
  - When "+" is tapped, then Log meal opens with the date chip set to the currently selected date (MVP default, Q-011; the BRD says the chip "defaults to Today").
- MVP default (D-18): "+" logs meals only; weight, steps and sleep are logged from the Home tiles (Q-012).

---

## ROLE — Roles, views and hierarchy (BRD §1.2, §1.3, §11)

**MVP (D-20):** only the Personal Training User view. In the MVP, REQ-ROLE-001 applies only
through its MVP default (every account is a Personal Training User, and the selector is hidden),
and REQ-ROLE-007 applies in full. Every other ROLE requirement is **Post-MVP** (backlog B-17 to
B-22).

### REQ-ROLE-001 — Role selector
- Requirement: The user profile provides a role selector listing Personal Training User, Coach and Head Coach. In phase 1 any user can turn on any of these roles for themselves (D-06); a role becomes selectable once turned on.
- Type: Functional, Security
- Acceptance criteria:
  - Given a signed-in user, when they turn on the Coach role, then Coach becomes selectable in the role selector.
  - Given a user with Coach and Personal Training User turned on, when they select Coach, then the Coach view loads.
  - Turning on Coach or Head Coach gives no access to anyone else's data; that needs an accepted invitation (REQ-ROLE-009).
- Future scope: premium plans may gate the Head Coach role and limit how many coaches and trainees each plan allows (D-06).
- MVP default (D-18): a new account starts with the Personal Training User role turned on.
- **Post-MVP** (D-20, backlog B-17): the role selector and turning on Coach or Head Coach. In the MVP the selector is hidden and every account is a Personal Training User.

### REQ-ROLE-002 — View follows active role
- Requirement: The app's view and available functions change to match the active role.
- Type: Functional, Security
- Acceptance criteria:
  - Given the Coach role is active, then Coach-only functions are available and Head-Coach-only functions are not.
  - Given a role is not granted, when its functions are requested directly (e.g. by API), then the request is refused. *(Authorization must be enforced server-side, not only hidden in the UI.)*
- MVP default (D-18): the last active role is remembered on each device (Q-008).
- **Post-MVP** (D-20, backlog B-17). In the MVP the server still refuses a change that needs a role the user has not turned on (`ROLE_NOT_ENABLED`, error model).

### REQ-ROLE-003 — Head Coach: manage Coach records
- **Post-MVP** (D-20, backlog B-19).
- Requirement: A Head Coach can invite Coaches (REQ-ROLE-008, REQ-ROLE-009), view the Coaches who have accepted, and remove (unassign) them, which ends the link. A link has no editable fields (D-11). Removing a Coach deletes no data (D-07).
- Type: Functional, Security
- Acceptance criteria:
  - Given Head Coach view, when a Coach accepts their invitation, then that Coach appears in the Head Coach's coach list.
  - Given a Coach not under this Head Coach, then it cannot be viewed or removed by them; no Head Coach can see another Head Coach's coaches or view (D-06).
  - When a Head Coach removes a Coach, then the link ends and no data is deleted; to rejoin, the Coach must accept a new invitation (D-07).
  - After removal, the Head Coach can no longer see any of that Coach's data, including past data (D-10).
  - When a Head Coach removes a Coach, then the Coach gets the neutral message "<name> is no longer linked with you" by push notification and in the in-app Notifications list (D-14).

### REQ-ROLE-004 — Head Coach: hierarchy visibility, plans and targets
- **Post-MVP** (D-20, backlog B-20).
- Requirement: A Head Coach can view the coaching activity of their accepted coaches — never a coach's own personal logs (D-10). Without a trainee's permission, that activity is counts per coach only: number of trainees; how many have allowed, declined or not yet answered (pending); and plans sent. It shows no trainee names or data (D-13). For each trainee who allows it (REQ-ROLE-013), the Head Coach can view that trainee's data — the same read-only view a Coach has (REQ-ROLE-005, D-18) — and set their diet plan, training plan, and calorie, protein and weekly workout targets (D-08, D-13, D-14), and their target body weight and daily steps target (MVP default, Q-013). A Head Coach never sees a trainee's settings or AI consent; of the permission answer, they see only its status (D-13). Trainees who have declined or not answered appear only in the counts, never by name; trainees who have allowed it are named (D-13, D-14).
- Type: Functional, Security, Privacy
- Acceptance criteria:
  - Given Head Coach view, then each accepted coach is listed with their counts, and under each coach the trainees who have allowed it (REQ-ROLE-013).
  - Given a coach with trainees who have declined or not yet answered, then the Head Coach sees those trainees only in the counts — no names and no data (D-13).
  - Trainees of coaches outside their hierarchy are not visible, and nothing in another Head Coach's hierarchy is visible (D-06).
  - Given a coach who also logs as a Personal Training User, then the Head Coach sees none of that coach's own logs (D-10).
  - Given a trainee who has declined or not yet answered, then the Head Coach cannot view or set their plans or targets (D-11, D-13).
  - When a Head Coach changes a trainee's plan or target, then the change records the Head Coach and the time, and the trainee and their coach see it labelled "Set by <name>" (D-13, D-14).
  - The Head Coach never sees a trainee's settings or AI consent (D-13).
- MVP default (D-18): if the Coach and the Head Coach both change a plan or target, the change the server receives last wins, and the label shows its author and time (Q-075, ADR-0007). Finer handling is post-MVP.

### REQ-ROLE-005 — Coach: manage trainee records
- **Post-MVP** (D-20, backlog B-19).
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
  - The Coach sees each trainee's logs, read-only: meals (with photos and image links), weight, steps, sleep, measurements (with notes), workouts and Progress. The Coach does not see the trainee's saved meals (D-18, answers Q-059). Legal confirms before real users (Q-049).
- MVP default (D-18): after the link ends, the trainee keeps their plans and targets, read-only and labelled with their author; a trainee with no coach may then set their own calorie and protein targets (Q-060, REQ-ROLE-007).

### REQ-ROLE-006 — Coach: set targets and plans
- **Post-MVP** (D-20, backlog B-21). In the MVP users set their own targets (REQ-ROLE-007).
- Requirement: A Coach can set for each assigned trainee: daily calorie target, daily protein target, weekly workout target, target body weight and daily steps target (MVP default, Q-013), diet plan (REQ-PLAN-*, built as in REQ-PLAN-008) and training plan (REQ-TRN-001, built as in REQ-TRN-006). A Head Coach can set the same targets and both plans, only while the trainee allows it (REQ-ROLE-004, D-13, D-14). Every change records who made it and when; the trainee, their coach and — while the trainee allows it — the Head Coach see the latest change and its author (D-13). Plans and targets are labelled "Set by <name>", naming the actual author (D-14).
- Acceptance criteria:
  - When a Coach saves a calorie/protein target, then the trainee's Home and Diet plan show it.
  - When a Coach sends a training plan, then the trainee's Training tab shows it instead of the empty state.
  - When a Coach or Head Coach changes a target or plan, then the trainee, the coach and (while allowed) the Head Coach see who made the latest change and when (D-13), and the label reads "Set by <name>" with that person's name (D-14).
- MVP default (D-18): the change the server receives last wins (Q-075, ADR-0007). The target body weight and daily steps target appear in the Progress Target row (Q-013, REQ-PRG-005).
- Q-014 is answered for the user's own targets (D-77): a change applies from the day it is made, and the days before keep theirs (REQ-ROLE-007).

### REQ-ROLE-007 — Self-directed users
- Requirement: A Personal Training User without a coach can still log and view all personal data; target-dependent displays show a no-target state. They can set their own daily calorie, protein, carbs, fat, fibre (D-70) and steps targets, weekly workout target and target body weight, labelled "Set by you" (D-20, extending the Q-016 MVP default, which covered calorie and protein only). Your targets groups them under Food and Activity and body (D-70); carbs 10–1,000 g, fat 5–500 g and fibre 5–100 g, in whole grams. These are new entries by the user; targets set by a former coach are not edited (invariant 2). Once they accept a coach, coach-set targets apply and are read-only (REQ-PLAN-001; post-MVP).
- Acceptance criteria:
  - Given no coach and no targets, then the calories card shows kcal eaten without a percentage or remaining value.
  - Given no coach, when the user sets a calorie target, then the calories card shows the percentage and kcal remaining against it.
  - Given no coach, when the user sets a weekly workout target, then the Home workout tracker counts against it (REQ-HOME-007); the target body weight and daily steps target appear in the Progress Target row (REQ-PRG-005).
  - Each target records who set it and when, so coach-set targets can be added later without changing the user's own (D-20).
  - Given a calorie target of 1,800 kcal set before today, when the user sets 2,000 kcal today, then today and the days after show 2,000 kcal and the days before still show 1,800 kcal (D-77).
  - Given a past date before the first target, then its calories and protein cards (and Insight) say "No target on this day" and offer no "Set a target"; a past week with no workout target says "No target that week" (D-77).
- MVP (D-20): every user is without a coach, so this requirement covers every account.
- MVP default (D-23, Home and daily tracking slice): the user sets their targets on a "Your targets" screen, opened from Account (the profile avatar) and from "Set a target" on the calories, protein and workout cards when no target is set. Ranges, and who set it, are in the data model (`targets`).
- Targets by date (D-77, answering Q-014; replaces D-23's "one current value per target, applying to every day shown"): a change starts on the IST day it is made and holds until the next change of that target; the days before keep the value they had. Each date shows the targets it had (Home, Insight); Home's workout tracker uses the target that holds on its week's Sunday; Progress shows the targets that hold today. Your targets shows today's values, each with since when ("since 8 Nov", "from today"), and its entry sheet says the change starts today. The targets set before D-77 hold from the day the account was created (their older values were never kept). One value per target and day: a second change the same day replaces it; the value that already holds saves nothing.

### REQ-ROLE-008 — Invite a new email address
- **Post-MVP** (D-20, backlog B-18).
- Requirement: A Head Coach can invite a Coach, and a Coach can invite a trainee, by entering an email address (D-06). When the address has no FitSphere account, phase 1 sends an invitation email with a sign-up link (D-11); the person signs up (REQ-ACC-010), and the link takes effect only when they accept (REQ-ROLE-009). Only an account with the invited email address can accept (D-18, T-05). A registered address gets the in-app invitation instead (REQ-ROLE-009). The inviter sees only "Invitation sent" and is never told whether the address was registered or which channel was used (REQ-ROLE-011).
- Type: Functional, Security
- Acceptance criteria:
  - Given an email address with no FitSphere account, when a Coach invites it, then an invitation email with a sign-up link is sent to that address and the Coach sees "Invitation sent".
  - Until the invited person signs up and accepts, the inviter has no access to any of their data.
  - Given a person who signs up with a different email address from the invited one, then that account cannot accept the invitation (D-18, T-05).
  - The sign-up link in an invitation email works only once and expires 7 days after it is sent (D-13).
  - The sender domain has SPF, DKIM and DMARC set up (D-13).
- Future scope: other channels such as SMS or WhatsApp (D-11).
- MVP default (D-18): up to 20 invitations per user per day; invitations can be resent and cancelled (Q-073, REQ-ROLE-017).
- Emails are sent through Resend from a domain FitSphere owns (ADR-0004, answers Q-082). Threat model items T-04, T-05.

### REQ-ROLE-009 — Invite an existing user; accept or decline
- **Post-MVP** (D-20, backlog B-18).
- Requirement: A Head Coach can invite an existing user to be their Coach, and a Coach can invite an existing user to be their trainee. The invitation is delivered in the app — a push notification plus the in-app Notifications list, so it is not lost if push is off; no email is sent (D-11, D-15). The invited user accepts or declines; the link exists only after they accept (D-06). The server accepts an invitation only from an account with the invited email address (D-18, T-05). When a coach accepts, the inviting Head Coach becomes their Head Coach (D-11). The inviter sees "Invitation sent", as for any address (REQ-ROLE-011).
- Type: Functional, Security
- Acceptance criteria:
  - Given a registered user, when they are invited, then they get a push notification and the invitation appears in their in-app Notifications list (D-15).
  - Given push notifications are off, then the invitation still appears in the in-app Notifications list (D-15).
  - When the invited user accepts, then they appear in the inviter's coach or trainee list.
  - When the invited user declines, then no link is created and the inviter gains no access.
  - Given an account whose email address is not the invited one, when it tries to accept the invitation — in the app or directly through the API — then the server refuses, no link is created, and the message does not show the invited address (D-18, T-05).
  - Until the invitation is accepted, the inviter cannot see any of the invited user's data.
  - Given the invited user already has a coach or Head Coach, when they accept, then REQ-ROLE-015 applies.
  - An in-app invitation expires 7 days after it is sent (D-14).
- Resend, cancel and pending invitations: REQ-ROLE-017 (MVP default, Q-073). Push service: Expo push (ADR-0004, answers Q-083).

### REQ-ROLE-010 — Head Coach sees past coaching activity
- **Post-MVP** (D-20, backlog B-19).
- Requirement: When a Coach accepts a Head Coach, the Head Coach can see the Coach's past coaching activity, not only activity from the acceptance date on — never the coach's own personal logs (D-06, D-10). Coaching activity is the counts per coach in REQ-ROLE-004 (D-13). Any trainee's data is visible only while that trainee allows it (REQ-ROLE-013). *(The coach-sees-trainee part is now REQ-ROLE-012 — D-11.)*
- Type: Functional, Privacy
- Acceptance criteria:
  - Given a coach who sent plans before accepting the Head Coach, when they accept, then the Head Coach's "plans sent" count for that coach includes the earlier plans.
  - Given a coach who also logs as a Personal Training User, then their Head Coach never sees those personal logs (D-10).
  - Given a trainee who has not allowed it, then the Head Coach sees none of that trainee's data, including within the coach's past activity (D-11).

### REQ-ROLE-011 — Invitation privacy and daily limits
- **Post-MVP** (D-20, backlog B-18).
- Requirement: Inviting someone by email never reveals whether the address is registered in FitSphere: the inviter always sees "Invitation sent" and is never shown which channel was used (email or in-app — D-11). Each user can send only a limited number of invitations per day (D-10).
- Type: Security, Privacy
- Acceptance criteria:
  - Given one registered and one unregistered email address, when a Coach invites each, then the Coach gets the same "Invitation sent" result for both, in the app and in the API response, with no sign of which channel was used; response timing does not reveal the difference (T-01).
  - Given a user who has reached the daily invitation limit, when they send another invitation, then it is refused and they are told the daily limit is reached.
- MVP default (D-18): the daily limit is 20 invitations per user, resends included (Q-073, ADR-0004). Expiry is decided (REQ-ROLE-008, REQ-ROLE-009; D-13, D-14). Threat model items T-01, T-04, T-05.

### REQ-ROLE-012 — Coach sees a trainee's past activity
- **Post-MVP** (D-20, backlog B-19).
- Requirement: When a trainee accepts a Coach, the Coach can see the trainee's past activity, not only activity from the acceptance date on (D-06). *(Split from REQ-ROLE-010 — D-11.)*
- Type: Functional, Privacy
- Acceptance criteria:
  - Given a trainee who logged meals before accepting a Coach, when they accept, then the Coach can see those earlier logs.
- What the coach sees: REQ-ROLE-005 (D-18, answers Q-059).

### REQ-ROLE-013 — Trainee permission for Head Coach access
- **Post-MVP** (D-20, backlog B-20).
- Requirement: A Head Coach sees a trainee's data and sets their plans and targets only while the trainee allows it (D-10, D-11, D-13). The trainee gets an in-app request in the Notifications list (D-15): "Allow Head Coach <name> to see your logs and set your plans and targets?" with **Allow** and **Decline** (wording D-14). Declined means the Head Coach has no access to that trainee. The trainee can change the answer at any time in Settings. Each answer is recorded with a timestamp. Of the answer, the Head Coach sees only its status — allowed, declined or pending (D-13; see REQ-ROLE-004) — and the trainee's coach sees each trainee's status (D-14). Answers are kept while the account exists and are deleted with it (MVP default, Q-048); Legal confirms how long they are kept after deletion (Q-049, D-13).
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
- Open: whether this step meets the consent requirements of India's DPDP Act, and whether answers may be deleted with the account, are for Legal to confirm (Q-049). Threat model: permission matrix.

### REQ-ROLE-014 — Leave a coach or Head Coach
- **Post-MVP** (D-20, backlog B-19).
- Requirement: A trainee can leave their coach, and a coach can leave their Head Coach, at any time (D-11). Leaving ends the link exactly like removal: no data is deleted, and the other side loses access to all of the leaver's data, including past data (D-07, D-10).
- Type: Functional, Privacy, Security
- Acceptance criteria:
  - When a trainee leaves their coach, then the link ends, no data is deleted, and the coach — and the coach's Head Coach — can no longer see any of the trainee's data, including past data.
  - When a coach leaves their Head Coach, then the Head Coach can no longer see the coach's coaching activity or any of that coach's trainees' data.
  - When someone leaves, then the other side gets a neutral message: "<name> is no longer linked with you" (D-13), by push notification and in the in-app Notifications list (D-14). The same message goes to the removed side on removal (REQ-ROLE-003, REQ-ROLE-005).
  - On its next sync, the former coach's or Head Coach's app deletes the trainee's data from the device (D-13, REQ-NFR-004).
  - To rejoin, the person must accept a new invitation (D-07).
- MVP default (D-18): the trainee keeps their plans and targets (REQ-ROLE-005, Q-060).

### REQ-ROLE-015 — Switch coach or Head Coach
- **Post-MVP** (D-20, backlog B-19).
- Requirement: A coach has at most one Head Coach and a trainee at most one coach (D-11). If a coach who already has a Head Coach accepts an invitation from another Head Coach, the old link ends first — the old Head Coach loses all access immediately (D-10) — and then the new link is created. Trainees' earlier Allow/Decline answers do not carry over: each trainee gets a fresh request for the new Head Coach (REQ-ROLE-013). The same applies when a trainee accepts a new coach: the old coach link ends first.
- Type: Functional, Privacy, Security
- Acceptance criteria:
  - Given a coach linked to Head Coach A, when they accept an invitation from Head Coach B, then A loses all access immediately and B becomes their Head Coach.
  - Given trainees who had allowed A, then B has no access to any of them until each one allows B.
  - Given a trainee linked to Coach X, when they accept an invitation from Coach Y, then the link with X ends first and X loses all access.
  - Given a coach who already has a Head Coach, or a trainee who already has a coach, then before they accept, the accept screen warns that accepting ends their current link (D-13).
  - When the old link ends, then the old Head Coach or coach gets a neutral message: "<name> is no longer linked with you" (D-13), by push notification and in the in-app Notifications list (D-14).
  - On its next sync, the old Head Coach's or coach's app deletes the trainee data it holds from the device (D-13, REQ-NFR-004).
- MVP default (D-18): the trainee keeps the old coach's plans and targets until the new coach changes them (Q-060). Threat model item T-06.

### REQ-ROLE-016 — Notifications list and push
- **Post-MVP** (D-20, backlog B-22).
- Requirement: One in-app Notifications list holds invitations, Head Coach permission requests and "no longer linked" messages (D-15). Each also arrives as a push notification where push is allowed; the list is the record and push is a best-effort alert (ADR-0004). Push text names the sender and the kind of message and carries no health data (ADR-0004). *(Listed in the MVP table — D-18; brings together REQ-ROLE-009, REQ-ROLE-013 and REQ-ROLE-014.)*
- Type: Functional, Privacy
- Acceptance criteria:
  - Given push notifications are off, when an invitation, permission request or "no longer linked" message arrives, then it appears in the Notifications list.
  - Push text contains no health, body or meal data.
  - When the user logs out on a phone, then that phone gets no further push notifications for them (MVP default, ADR-0004).

### REQ-ROLE-017 — Pending invitations: resend and cancel
- **Post-MVP** (D-20, backlog B-18).
- Requirement: A Coach or Head Coach sees the invitations they have sent that are still pending — the email address and the date sent — and can resend or cancel each one (MVP default, Q-073). A resend replaces the earlier invitation, which can no longer be accepted; a cancelled invitation can no longer be accepted (T-05). Resends count toward the daily limit (REQ-ROLE-011). An invitation leaves the list when it is accepted, cancelled or expires (7 days — D-13, D-14). A declined invitation stays shown as pending until it expires, so a decline does not reveal that the address is registered (REQ-ROLE-011). *(Listed in the MVP table — D-18.)*
- Type: Functional, Security, Privacy
- Acceptance criteria:
  - When the inviter cancels an invitation, then its email link or in-app invitation can no longer be accepted.
  - When the inviter resends an invitation, then the person gets a new one, the earlier one can no longer be accepted, and the resend counts toward the 20-a-day limit.
  - Given an invitation that was declined, then the inviter sees it as pending until it expires.

### REQ-ROLE-018 — Target history
- Requirement: A user can see their own targets by date (D-77): every change under its day, newest first (a target's first value, then each change from the old value to the new), and for one target, its value now and since when, each earlier value with its dates and its number of days, and the days before its first value, which had no target. Read-only: a target is changed on Your targets, from today on (REQ-ROLE-007). Opened from Your targets. Read from the phone, so it works offline.
- Type: Functional
- Acceptance criteria:
  - Given calories set to 1,800 kcal on 6 Nov, 2,000 on 8 Nov and 2,200 on 11 Nov, then All lists "Set to 1,800 kcal" under 6 Nov, "1,800 → 2,000" under 8 Nov and "2,000 → 2,200" under 11 Nov, the newest first, and Calories shows 2,200 kcal now, "Sun 8 Nov – Tue 10 Nov · 3 days · 2,000 kcal", "Fri 6 Nov – Sat 7 Nov · 2 days · 1,800 kcal" and "Before Fri 6 Nov · No target".
  - The target body weight is shown in the body-weight unit setting (REQ-ACC-003).
  - A change the server refused is not listed; a target never set reads "Not set" with "Set a target".
  - Given no targets, then the page says that each change will show there with its date.
- MVP (D-20): only the user sees their own history; it is deleted with the account (REQ-ACC-009).

---

## DATE — Global date handling (BRD §2)

### REQ-DATE-001 — Select a past date
- Requirement: Users can select any past date via the calendar icon or week/date strip; all on-screen data follows the selected date.
- Acceptance criteria:
  - When a past date is selected, then cards, meals and tiles show that date's data.
  - Future dates cannot be selected (MVP default, Q-017).
  - The calendar browses back to the month of the first of the phone's 90 days and up to 12 months ahead (D-34). Future days and days before the 90 are greyed; tapping one says why, "Future dates can't be chosen. Choose today or an earlier day." or "Only the last 90 days are on this phone. Choose a later day.", and screen readers hear "not available".

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
- Requirement: A strip of one week, Monday to Sunday, shows a status box per day and highlights today and the selected day (D-79, 2026-11-11, which replaced D-34's 7 days ending today). It opens on the week holding today; a day chosen another way shows the week holding it. This week's days after today are greyed and cannot be picked (Q-017), nor can the days before the first of the phone's 90 days (D-23); screen readers hear such a day as "not available". Swiping, or "Earlier days" and "Later days", moves it a week at a time, back to the week holding the first of the 90 days and on to this week. Home's workout tracker shows the same Monday-to-Sunday weeks (REQ-HOME-007).
- Acceptance criteria (D-79):
  - Given today is Wednesday 28 Oct, the strip shows Mon 26 Oct to Sun 1 Nov; Thu 29 Oct to Sun 1 Nov are greyed and tapping one changes nothing; "Later days" is greyed.
  - Given "Earlier days" is tapped, Mon 19 Oct to Sun 25 Oct are shown and every one of them can be picked.
- MVP default (D-18): a day's box is filled when at least one meal is logged that day (Q-019).
- Built in the Home and daily tracking slice, except the status box, which comes with meals in the Meal logging slice (D-23).

### REQ-HOME-003 — Calories card
- Requirement: Shows kcal eaten vs target with progress bar, percentage achieved and kcal remaining for the selected date.
- Acceptance criteria:
  - Given target 2000 and eaten 1500, then 75% and 500 kcal remaining are shown.
  - Given eaten exceeds target, then the bar shows full in a warning colour with the text "X kcal over" (MVP default, Q-022).

### REQ-HOME-004 — Protein card
- Requirement: As REQ-HOME-003 for protein in grams (over target: "X g over").
- REQ-HOME-003 and REQ-HOME-004 are built in the Home and daily tracking slice; the amount eaten is 0 until the Meal logging slice adds meals (D-23).

### REQ-HOME-005 — By-meal breakdown
- Requirement: A "By meal" link opens the meal-wise breakdown for the selected day.
- MVP default (D-18): it opens Nutrition › Consumed for that day (Q-023).
- Built with Nutrition › Consumed in the Meal logging slice (D-23).

### REQ-HOME-006 — Quick tiles
- Requirement: Tiles for Weight, Steps and Sleep show the logged value for the selected date, or "+ Add" when none.
- Acceptance criteria:
  - Given no weight logged that day, then the tile shows "+ Add"; tapping it allows entry.
  - Weight displays in the body-weight unit setting (REQ-ACC-003; MVP default, Q-024 — the BRD says "Weight (kg)").
  - Values outside weight 20–300 kg, steps 0–100,000 and sleep 0–24 h cannot be saved (MVP default, Q-028).
  - Given a value already logged for that day, when a new one is saved, then it replaces the old one (MVP default, Q-030).
- MVP default (D-18): steps and sleep are typed in; sleep is in hours with one decimal (Q-015, Q-028). Health-platform sync is post-MVP (backlog B-14). Weight is entered and shown with one decimal in the chosen unit and stored in whole grams (invariant #6). Sleep is stored in whole minutes (MVP default, D-23).

### REQ-HOME-007 — Workout tracker
- Requirement: Shows workouts completed this week vs weekly target (e.g. "1 of 5 · 4 left") with Mon–Sun dots marking workout days.
- Each day up to today can be tapped (D-34; D-42): a day with workouts lists them to open (since D-65 only those with an exercise, numbered as on Training), with "Log another workout" to start a new one on that day; a day with none offers "Start a workout on this day". Later days are greyed and cannot be tapped. Each day is named for screen readers (e.g. "Tuesday 27 Oct: 2 workouts") and is 44 dp to tap.
- The tracker shows the Mon–Sun week of the date picked on Home (Q-026) and names it (D-34): "Workouts this week" for the current week, "Workouts that week" for an earlier one, with the week's dates under the title (e.g. "Mon 19 Oct – Sun 25 Oct"). A workout can be started on any day up to today of the week shown.
- D-41 (replacing Q-025's MVP default): only a workout with at least one exercise counts toward the weekly target; the card reads "N of T · K left", and once the target is met "N workouts · target achieved", with each day's count as a number. The target is set by the coach, or by a Head Coach the trainee allows (REQ-ROLE-006). In the MVP the user sets it (REQ-ROLE-007, D-20).
- The tracker is built in the Home and daily tracking slice; its count and dots come with workouts in the Training slice (D-23).
- MVP default (D-29): every workout on the phone in the Mon–Sun week of the selected date counts, including those waiting to sync; a day may hold several workouts, each counted, and the day's dot shows once it has any.

### REQ-HOME-008 — Measurements prompt
- Requirement: A Measurements card prompts weekly waist measurements and opens the measurements sheet (REQ-MEAS-001). It shows the selected date's measurements and lets the user correct them (D-24). On today it says when measurements were last logged, and that they are due once more than 7 days have passed (D-85).
- Acceptance criteria:
  - Given no measurements for the selected date, then the card shows "Add measurements", which opens the sheet on that date.
  - Given measurements for the selected date, then the card shows them (waist values, any optional values and notes) with "Edit measurements".
  - When "Edit measurements" is tapped, then the sheet opens pre-filled with every saved value and the notes, on that date, which cannot be changed there.
  - When an edit is saved, then that date's entry is updated: there is still one entry for the date, and no other date's entry changes.
  - Given today is selected and has no measurements, then the card says when they were last logged ("Last logged 8 days ago, on Tue 20 Oct."; "No measurements logged yet." or "None in the last 90 days." with none on the phone); given more than 7 days since the last, or none, then a "Due" badge shows beside the title and "Add measurements" is filled; given 7 days or fewer, then neither (D-85).
  - Given a past date with no measurements, then the card says "No measurements for <date>." with no badge (D-85).
- MVP default (D-24, changes Q-026): the card is always shown. *Before D-24: hidden once both waist values were logged for the current Monday–Sunday week.*

---

## MEAS — Measurements logging (BRD §4)

### REQ-MEAS-001 — Measurements sheet
- Requirement: Measurements open as a bottom sheet from the Home card or Progress screen.

### REQ-MEAS-002 — Date selector
- Requirement: The sheet's date defaults to today and can be changed to another date (past dates only; MVP default, Q-017).

### REQ-MEAS-003 — Unit toggle
- Requirement: A cm/in toggle sets the unit for entered values; stored values are unit-consistent. *(Storage unit is a contract decision.)*
- MVP default (D-23): stored in whole millimetres (data model, `measurements`); typed with one decimal. The toggle's last choice is remembered on the phone.

### REQ-MEAS-004 — Mandatory waist fields
- Requirement: Upper waist (guidance "2 fingers above the navel") and lower waist (guidance "2 fingers below the navel") are mandatory.

### REQ-MEAS-005 — Optional fields
- Requirement: An expandable section holds optional chest, hips, arms, thighs and notes.
- MVP default (D-18): one value each for arms and thighs (Q-027).

### REQ-MEAS-006 — Save and close
- Requirement: "Save measurements" is enabled only once both mandatory fields hold valid values; the close (X) button exits without saving.
- Acceptance criteria:
  - Given only upper waist entered, then Save is disabled.
  - When X is tapped after entering values, then nothing is saved.
- MVP default (D-18): valid values are 10–250 cm (Q-028); X closes without a warning (Q-029); a second entry for the same date replaces the first (Q-030).

---

## NUT — Nutrition: Consumed (BRD §5)

### REQ-NUT-001 — Date strip and tabs
- Requirement: Nutrition has a horizontally scrollable date strip and three tabs: Consumed, Diet plan, Saved.

### REQ-NUT-002 — Eaten summary
- Requirement: Shows total kcal and colour-coded Protein, Carbs, Fat and Fiber for the selected date; a dash ("–") shows where there is no data.

### REQ-NUT-003 — Meal slots
- Requirement: Breakfast, Lunch, Snack and Dinner slots each show "Tap to add what you ate" with a "+" that opens Log meal preset to that slot and date.
- MVP default (D-18): tags attach to a meal, which keeps its meal type; a tagged meal shows a small label in its slot (Q-031).
- A slot with meals is folded at first (D-34): its kcal and number of meals ("640 kcal · 3 meals") and its foods on up to two lines (five names, then "+ N more"). The chevron, or the slot's heading, opens it to each meal's card with the time it was last saved in India time ("Saved 8:15 am") and its Edit, Save to my meals and Delete icons (REQ-NUT-004). The chevron is named "Show Breakfast meals" or "Hide Breakfast meals" and is 44 dp to tap. Every slot folds again when the day changes. An empty slot shows "Tap to add what you ate" and its "+" as before.

### REQ-NUT-004 — Meal menu: edit, delete, save to my meals
- Requirement: Each logged meal offers Edit, Delete and "Save to my meals" (MVP default, Q-032), as icons on the meal, each named for screen readers and 44 dp to tap; Delete asks first (D-33, which replaced the first "•••" menu). A saved meal offers Delete the same way. "Save to my meals" adds it to the Saved tab. Deleting a meal also deletes its photo (MVP default, Q-032; REQ-LOG-006).
- D-70: a logged meal's Insight icon comes first, before Edit (REQ-NUT-005).

### REQ-NUT-005 — Insight: a meal's and the day's calories and nutrients
- Requirement (D-70): each logged meal's Insight icon opens the Insight page on that meal's type (Breakfast, Lunch, Snack or Dinner) and date. Five tiles switch between the whole day and its four meals, without going back; a green tick marks each meal with food. The page shows:
  - **Calories:** the scope's kcal and its share of the daily calorie target; the day's kcal split by meal on a bar, each meal's kcal, and what is left (or over) today. The targets are daily; there is no budget per meal.
  - **Against your daily targets:** protein, carbs, fat and fibre eaten, each against its daily target, with the percentage and what is left or over today (over in gold, Q-022). For a meal, the bar shows the meal's part and the rest of today. A nutrient with no target says "No daily target" with "Set a target" (Your targets). A food with no value for a nutrient is named.
  - A meal with nothing logged says so, with "Add to <meal>" (Log meal for that meal and date).
- Acceptance criteria:
  - Given lunch 237 kcal, the day 429 kcal and a 2,000 kcal target, then Lunch shows "Lunch: 12% of your 2,000 kcal daily target" and "Left today 1,571 kcal".
  - Given a fat target of 5 g and 6.8 g eaten that day, then the whole day's fat bar is full in gold with "1.8 g over today".
  - Insight reads only the phone's data: it works offline, and shows numbers only, no advice.

### REQ-NUT-006 — Insight: top foods
- Requirement (D-70): on the Insight page, Top foods ranks the scope's foods by Calories (first), Protein, Carbs, Fat or Fibre: largest first (a tie in the order logged), each with its amount, value and share of the total, five at first, then "Show all N foods". On the whole day, the same food eaten in several meals is one row, its amounts added and its meals named. A food that gave none is not listed; one with no value for the nutrient is left out and named.

---

## PLAN — Nutrition: Diet plan (BRD §6)

**MVP (D-20):** no one can create a diet plan in the MVP, so the Diet plan tab shows only its
empty state (REQ-PLAN-007). REQ-PLAN-001 to REQ-PLAN-006 and REQ-PLAN-008 are **Post-MVP**
(backlog B-21).

### REQ-PLAN-001 — Daily target card
- **Post-MVP** (D-20, backlog B-21). In the MVP the user's own targets show on Home (REQ-ROLE-007).
- Requirement: Shows daily calorie and protein targets labelled "Set by <name>", naming whoever made the latest change — the coach or the Head Coach (D-14; the BRD's label was "Set by your coach"); read-only for the client. It also shows when the latest change was made (D-13).
- Type: Functional, Security
- Acceptance criteria:
  - The trainee cannot change targets through the UI or API.
  - When the coach or Head Coach changes a target, then the card reads "Set by <name>" with that person's name, and shows when the change was made (D-13, D-14).

### REQ-PLAN-002 — How-to guide
- **Post-MVP** (D-20, backlog B-21).
- Requirement: A collapsible "How to use this plan" guide (meet calorie and protein targets, build every meal around a complete protein source, log every meal) with a "Got it" button that dismisses it.
- MVP default (D-18): dismissal is remembered per user (Q-033).

### REQ-PLAN-003 — Meal cards
- **Post-MVP** (D-20, backlog B-21).
- Requirement: Each meal slot in the plan has a card showing its total kcal and protein (e.g. Breakfast: 646 kcal, 50 g protein).

### REQ-PLAN-004 — Up to three options per meal
- **Post-MVP** (D-20, backlog B-21).
- Requirement: Each meal offers 1–3 alternatives as tabs (Option 1–3). Each shows a meal name and ingredients with quantities in grams, scoops, tablespoons or pieces.
- MVP default (D-18): each option shows its own kcal and protein (Q-034).

### REQ-PLAN-005 — Protein first
- **Post-MVP** (D-20, backlog B-21).
- Requirement: In every option the protein source is listed first and visually highlighted.

### REQ-PLAN-006 — Log this option
- Requirement: Each option has a "Log this option" button that logs that option to its meal slot on the selected date (MVP default, Q-035). *(The BRD marked the button's purpose as presumed: "presumably to log that planned meal".)*
- Acceptance criteria:
  - Given yesterday is selected, when the trainee taps "Log this option" on Lunch option 2, then that option is logged to yesterday's Lunch slot and the totals update.
- Status: unblocked — Q-035 answered for the MVP (D-18). **Post-MVP** with diet plans (D-20, backlog B-21).

### REQ-PLAN-007 — No diet plan state
- Requirement: When no diet plan exists, the tab shows an empty state. *(Not in BRD; inferred by analogy to REQ-TRN-002 — A-005, confirmed by D-20.)*
- Acceptance criteria:
  - Given no diet plan, then the Diet plan tab shows "No diet plan yet. Your coach will add one here." (D-20)
- MVP (D-20): no one can create a diet plan in the MVP, so the tab always shows this state.

### REQ-PLAN-008 — Coach builds a diet plan
- **Post-MVP** (D-20, backlog B-21).
- Requirement: A Coach, or a Head Coach the trainee allows (REQ-ROLE-004), builds the trainee's diet plan: meals by slot (Breakfast, Lunch, Snack, Dinner), each with 1–3 options. Each option has a name, ingredients with quantities in grams, scoops, tablespoons or pieces, its protein source marked and listed first (REQ-PLAN-005), and its own kcal and protein (Q-034). Saving the plan makes it visible to the trainee, labelled "Set by <name>" (REQ-ROLE-006). *(Listed in the MVP table — D-18; the trainee's view is REQ-PLAN-003 to REQ-PLAN-005.)*
- Acceptance criteria:
  - Given a meal with three options, when the coach tries to add a fourth, then it is not allowed.
  - When the coach saves the plan, then the trainee's Diet plan tab shows it instead of the empty state (REQ-PLAN-007).
- MVP default (D-18): the coach types each option's kcal and protein.
- Open: coach screen layout and designs (Q-020, Q-052).

---

## SAVED — Nutrition: Saved (BRD §7)

### REQ-SAVED-001 — Saved meals list
- Requirement: Lists the user's saved meals; tapping one logs it to the selected date, in the meal the user chooses each time, since a saved meal keeps no meal of its own (D-69, replacing Q-036's MVP default): "Log meal" logs it as it is; "Change amounts first" opens Log meal with its foods, for that day only.
- MVP default (D-18; the owner's phone test, 2026-11-04): a meal is saved once. A logged meal whose foods and amounts, in any order, are already a saved meal shows a filled bookmark; tapping it says which saved meal it is and offers "Go to Saved", and no second copy is made. The same holds for a saved meal made or changed in Saved (D-69).

### REQ-SAVED-002 — Empty state
- Requirement: With no saved meals, an empty state explains the two ways to save one: Create a saved meal, or the bookmark on a meal in the Consumed tab (D-69).

### REQ-SAVED-003 — Create and change a saved meal
- Requirement (D-69): "Create a saved meal" in Saved asks the meal's name first (required, 1 to 60 characters), then opens the meal to add as many foods as needed, each as in Search foods, and to change or remove each; it is saved under that name. Each saved meal can be opened again to change its name, foods and amounts. A saved meal has no meal (Breakfast, Lunch, Snack or Dinner) of its own. Works offline.

---

## LOG — Log meal (BRD §8)

### REQ-LOG-001 — Screen entry
- Requirement: Log meal opens from any "+" button and has a back button and a date chip.
- MVP (D-68): Log meal holds the date's four meals; a meal tapped shows its foods on that date, to add to or remove from. Save saves every meal changed and stays on the screen (the back arrow leaves); a meal with food has a green tick; back, or another date, with changes not saved asks first. Editing a meal from its pencil changes that one meal, and Save goes back.

### REQ-LOG-002 — Date picker sheet
- Requirement: The date chip opens a calendar titled "Log this meal to", on the selected month. Any past day of the phone's 90 days can be picked; future days cannot (Q-017). Each day with a meal has a dot, and each day is read out with its logging status (D-33, which replaced the first sheet listing Today, Yesterday and the five days before, plus "Another day…" for the calendar).
- MVP default (D-18): the status is "Nothing logged" or "N meals logged" (Q-037).

### REQ-LOG-003 — Meal type and tags
- Requirement: The user selects one meal type (Breakfast, Lunch, Snack, Dinner) and may add tags "Before training" and "Dessert".
- MVP default (D-18): the meal type is required; tags are optional and attach to the meal (Q-031).
- MVP (D-40): the tags are hidden in Log meal until coaches come (backlog B-28). A meal that has tags keeps them, and its card still shows them.

### REQ-LOG-004 — Free-text entry
- Requirement: A free-text box with placeholder "Speak or type what you ate…" accepts a description; a sample entry is shown.
- MVP (D-68): until AI meal reading (slice 7), Log meal shows no box for it; the "AI meal reading is coming soon" box (D-26) is left out for now.

### REQ-LOG-005 — Voice entry
- Requirement: "Speak your meal" turns speech into meal text using the phone's **on-device** speech recognition, so the voice never leaves the phone (D-18, answers Q-038; ADR-0005). The text then follows the free-text path, including the AI consent check (REQ-LOG-009). FitSphere stores no audio; audio storage is future scope (D-16). On a phone that cannot recognise speech on the device, the button is hidden.
- Acceptance criteria:
  - Given a phone with on-device speech recognition and no network, when the user speaks a meal, then the text appears in the free-text box.
  - No audio recording is uploaded or kept by FitSphere, on the device or the server (D-16).
  - Given a phone without on-device speech recognition, then "Speak your meal" is not shown.

### REQ-LOG-006 — Photo entry
- Requirement: A camera button captures a meal photo or nutrition label for parsing. A meal photo is kept as a compressed viewable copy of about 200 KB (phone-viewable quality) with a small thumbnail for lists. Instead of uploading, the user can paste a public link to an image (REQ-LOG-010). Photos are view-only (REQ-NFR-006). A user's own photos are never fully deleted automatically while the account exists; an original may be replaced by a viewing-quality copy (D-16). A user may delete their own meal photo or nutrition-label image, and it is then really removed: from file storage, and from copies cached on other phones at their next sync (D-16, A-004).
- Acceptance criteria:
  - When a user saves a meal photo, then the stored copy is about 200 KB and a thumbnail is created for lists (D-16).
  - When a user deletes their own meal photo, then the file and its thumbnail are removed from file storage, no viewing link can be issued for it, and phones that cached it delete it on their next sync (D-16).
  - When a nutrition-label photo has been read, then it is deleted from file storage (MVP default, Q-064).
- MVP default (D-18): deleting a meal deletes its photo (Q-032). The coach sees meal photos (REQ-ROLE-005, Q-059; post-MVP, D-20).
- MVP (D-26): meal photos — taking or choosing one, the ~200 KB copy and thumbnail, storage, viewing and deletion — are built in slice 3, without AI. Label photos and reading photos with AI come with slice 7.
- Open: how long media is kept (Q-089); once backups exist, how long they keep deleted media (Q-049).

### REQ-LOG-007 — Alternative methods
- Requirement: Search database, Scan barcode and Saved (your meals) are available and work without AI (REQ-ACC-005). When a barcode is not found, the user can type the values from the label (MVP default; ADR-0006).
- **Post-MVP:** Eaten before (past meals) — Saved covers re-logging in the MVP (D-18, backlog B-03).
- Recent foods (D-60): before anything is typed, Search foods lists the foods logged on the last five days (today included, Asia/Kolkata), the latest first, each once by its name with the amount it was last logged in. A tick box on the right picks a food as it was last logged ("N selected · kcal", "Deselect all", "Add N foods"); its name opens its page on that amount, to change it. Once foods are ticked, a food added from its page goes into the meal with them. Works offline, from the meals on the phone.
- A food's page (D-45): choosing a food in Search foods opens its page: Quantity and Measure side by side (grams typed; units, servings and portions counted in halves in a two-wheel picker), then the energy and the protein, carbs, fat and fibre for that amount, updated as it changes, and Add.
- More measures (D-76): a serving that holds several things also gives one of them, its grams divided ("2 slices", 56 g, gives Slice, 28 g; "Plate (4 pc)", 60 g, gives Piece, 15 g); every listed and packaged food can also be logged in oz (28.35 g each, in halves from 0.5 to 10; "2 oz (56.7 g)"). Each measure shows its grams beside its name; the food's own measures come first, smallest first, then Grams, then oz. Dishes stay in portions and My foods in their unit.
- Changing a food in the meal (D-64): in Log meal's review, a food the phone lists opens its own page on the amount it has in the meal ("In this meal now: 100 g"), where any of its measures can be chosen (100 g can become 1 paratha); Save change replaces it, Back leaves it, and "Remove from meal", centred under Save change, takes it out. A food with no page (one typed once, or a barcode product not in the list) keeps the sheet for its amount, its Change and Remove buttons centred.
- Household units (D-36): a listed food can be added in grams or, once the owner has measured it, in a household unit (teaspoon, tablespoon, katori, glass or piece), counted in halves from 0.5 to 10 and at most 2,000 g. The grams one unit holds come only from the owner's household-measures sheet. Barcode products and your own food stay in grams; dishes in portions.
- The same food added again (D-34): while a meal is built or edited, adding a listed food it already has (the same food-list item, dish or barcode) asks "Already in this meal": "Add to existing" puts the amounts together in one item; "Keep separate" adds it as its own item. A food in a household unit joins only the same food in the same unit. When together they would pass 2,000 g, 10 portions or the most units of that food, only "Keep separate" is offered. A food the user entered is never merged. Separately logged meals are not merged.
- Acceptance criteria:
  - Given AI consent is off, when a scanned barcode is not found, then the user can type the label values and save the meal.
- Food data sources: FitSphere's own food list and Open Food Facts (ADR-0006, answers Q-039). The
  food list holds Indian food data only (D-47): IFCT 2017's Indian foods and, since D-46, the
  Indian Nutrient Databank's 1,014 Indian recipes, marked "INDB", their values estimated, each
  with its serving, counted in halves. USDA's FNDDS foods (D-39) are archived, not listed.
  Since D-48, packaged foods sold in India, from Open Food Facts' data (ADR-0009), are found by
  name or brand, marked "Packaged" with the brand, in grams or by their label's serving; since
  D-56 a product listed under several barcodes with the same values shows once; since D-78 each
  branded product shows once whatever its values, its brand label and barcodes together (the same
  brand and name, ignoring a pack size), with its copies saved with no brand (told by the barcode's
  company and a close energy, or the brand at the front of the name), showing the brand label, else
  the energy most copies give, each copy with its own serving; since D-80 a packaged food named
  only by its brand ("Amul") keeps that name when the brand is the product's own (Nutella), takes
  the generic name Open Food Facts gives it, or is left out of the list (it still scans), and a few
  whose name and brand were swapped, or whose values their own data contradicts, were put right or
  left out. Since
  D-49, brands' own labels, read from their websites (since D-52 also from shops' listings of the
  products; since D-53 a few are an AI tool's estimates) and approved by the owner, are listed before
  them, marked "Brand label", in grams or by their serving; a fibre the label does not give is
  shown as unknown. Since D-51, a food named exactly as the search (ignoring case and punctuation)
  is listed first; since D-91 the plain food the search names comes before it: a food that is not a
  brand's or packaged, named as typed, or as typed and then a part in brackets ("Apple (1 medium)"),
  or IFCT's named as typed and then a comma ("Banana, ripe, robusta"), IFCT's first ("potato" finds
  "Potato, brown skin, big" first, not chips); since D-92, for an everyday word, the food as eaten
  that the owner chose comes before all ("rice" finds "Boiled rice (Uble chawal)", "tea" finds "Masala
  Chai"; `docs/data/everyday-foods-sheet.csv`), and packs of a dry or ready-to-cook form the search did
  not ask for come last (batter, mix, premix, powder, podi, ready to cook, leaves: "dosa" lists the
  dosas before the batters; "dosa batter" and a search for the brand list them as before); since D-55 a brand label is also found by hidden search words, the everyday
  names of what it is ("whole wheat atta" finds a pack called "Chakki Atta"). Since D-54 the rest
  come in this order: My foods, brand labels, packaged foods,
  INDB's recipes, then dishes and IFCT's foods. Since D-59, home-style forms of daily foods (a
  bread slice, butter toast, bread omelette), typical values for a home recipe, come right after an
  exact match, untagged, found by their item too, logged in grams or by their serving. Since D-62,
  estimated dishes (typical values for each type of dish, from the owner's dish database) come after
  the dishes, before IFCT's foods, marked "estimated", found by their base food too, logged in grams
  or by their serving; and the search ignores marks and finds words typed together ("haldirams"
  finds Haldiram's, "dalmakhani" finds Dal Makhani, never a word's end and the next one's start); since
  D-86 any other mark typed reads as a space and a word of marks alone is left out ("paneer!" finds what
  "paneer" finds, "aloo & gobi" what "aloo gobi" finds), only % counting, as names use it ("55%"); and
  since D-88 accents are ignored, typed or in a name or brand ("nestle" finds Nestlé, "jalapeno" finds
  Jalapeño; Devanagari is read as it is). Since
  D-66 every match is listed, with no cap on any source, the best matches first: names with the
  words whole, then words starting with them, then inside a word, then foods found only by hidden
  search words, each group in the order above. The results follow the text typed or erased;
  since D-72 the phone searches once typing pauses, one search at a time, and one or two characters,
  marks not counted (D-86: "on!" as "on"), find only the foods whose name, brand or other name is all of
  them ("on" finds the brand ON),
  under "Type 3 letters or more to search all foods."; since D-73 the list shows the results 200 at a
  time, adding the next 200 from those already found as its end comes near, and a food's servings
  and units are read when its page opens;
  since D-57 a cross at the end of the search box clears the search. Since D-61 the results carry no
  source tag (the marks above stay on each food's page): a branded food shows its brand under its
  name, a My food "Your food", and the branded foods of one name are one row ("Bread · 3 brands ·
  220–274 kcal per 100 g") that opens to list them, a brand each; since D-89 only foods alike in
  energy share a row (no more than twice the one before, or 20 kcal apart: "Gold" is a coffee, a tea,
  a milk and an oil, four rows), and a brand counts once however it is written (case, marks, accents,
  "The", a company's words), its spellings and makers made one in the food list as the owner approves
  them (`docs/data/brand-names-sheet.csv`). Your own food can be in any of several units and saved to My foods
  (REQ-LOG-011).

### REQ-LOG-011 — My foods
- Type: Functional
- Requirement: A food the user enters can be saved to "My foods" and logged again from Search foods,
  in its own unit. *(Not in the BRD; the owner's request, D-39.)*
- Acceptance criteria:
  - "Enter your own food" asks for the food's unit (grams, ml, piece, slice, cup, katori, bowl,
    glass, tablespoon, teaspoon or serving), its values per 100 g or ml or per one unit, and the
    quantity eaten. kcal, protein, carbs and fat are required, fibre optional.
  - "Save to My foods" is ticked at first; a saved food shows in Search foods, marked "My food",
    after the Indian foods.
  - Picking a My food asks only its quantity; editing it or deleting it (after a confirmation) never
    changes a meal already logged.
  - My foods work offline and sync; only the user sees them (REQ-NFR-001, D-20); they are deleted
    with the account (REQ-ACC-009).
- Status: built (D-39).

### REQ-LOG-008 — Guidance
- Requirement: Best-practice tips (amounts in grams; raw vs cooked; name each food separately).
- **Unsupported example, flagged (D-26 answer 3, amended 2026-10-30):** the BRD's example (BRD §8), "rice weighs about three times more cooked", has no supporting source, so it is not part of this requirement. FitSphere logs dishes in portions, not by cooked weight. The example is removed from the Log meal screen's tips (`apps/mobile/src/screens/LogMealScreen.tsx`).
- **Post-MVP:** a collapsible Examples section (Best, Vague, Say) with Hide (D-18, backlog B-04).

### REQ-LOG-009 — AI parsing
- Requirement: AI converts text, voice and photo input into food items with quantities and nutrition values that the user reviews before saving. The review list shows each item with its quantity, kcal and protein (MVP default, Q-062; the BRD §8 mentions only "food items and quantities"). Values come from the food list where an item matches; otherwise the AI's estimate is used and marked "estimated" (ADR-0005, ADR-0006; answers Q-063).
- Type: Functional, Privacy
- Acceptance criteria:
  - Given AI consent is off, then no meal text, photo, voice or label is sent to an AI service, and the user is offered non-AI methods.
  - Given AI consent is on, when the user submits text, then a list of items with quantities is returned for review; nothing is saved until confirmed. *(Review step — A-006.)*
  - When AI fails or times out, then the input is kept and the user can retry or use another method.
  - Given a user who has used 15 AI readings today, when they ask for another, then it is refused with a message and non-AI methods are offered (MVP default; ADR-0005).
- AI provider: ADR-0005. Open: accuracy expectations (Q-040), measured in ADR-0005's validation.

### REQ-LOG-010 — Public link instead of an upload
- Requirement: Instead of uploading, a user can add a public link (e.g. YouTube) to their own content — in phase 1, meal photos only (REQ-LOG-006; D-16, confirmed). Links to their own videos come with the audio/video release (future scope). Before the link is saved, the app shows a privacy warning, e.g. "Anyone who has this link can view it, even if you later remove your coach. FitSphere cannot delete content stored on YouTube or other sites.", and the user must confirm to continue. When a link between people ends, FitSphere hides the external link from the former coach or Head Coach, but cannot revoke access to the content itself (accepted risk R-004, invariant 1).
- Type: Functional, Privacy
- Acceptance criteria:
  - When a user adds a public link, then the privacy warning is shown and the link is saved only after the user confirms; if they cancel, nothing is saved.
  - Given a link between a trainee and their coach that has ended, when the former coach requests the trainee's data, then the server returns none of the trainee's external links (D-16).
- Open: Legal to confirm the approach (Q-049). Proposed safeguards for links: threat model item T-09.
- MVP (D-20): there are no coaches, so in FitSphere only the user sees the link; the privacy warning still applies, because anyone with the link can view the content. The second criterion applies post-MVP (backlog B-19).
- MVP (D-26): built in slice 3 for meals, https only. The warning reads "Anyone who has this link can view it. FitSphere cannot delete content stored on other sites." (no coach clause, D-20).

---

## TRN — Training (BRD §9)

### REQ-TRN-001 — Coach plan by day
- **Post-MVP** (D-20, backlog B-21).
- Requirement: The coach-assigned training plan appears day by day, with a how-to guide for every exercise. In phase 1 a how-to is a YouTube link, unlisted or public, provided by the coach (D-16, answers Q-041); FitSphere stores only the link.
- Acceptance criteria:
  - Given an exercise in the plan with a how-to link, then the trainee can open the how-to video from the plan.

### REQ-TRN-002 — Empty state
- Requirement: Until a coach sends a plan, Training shows "No training plan yet".
- MVP (D-20): no one can send a training plan in the MVP, so Training always shows "No training plan yet", with "Log workout" (REQ-TRN-003; named "Start an empty workout" until D-37) and the workout history (REQ-TRN-004).
- D-65: the "No training plan yet" card is not shown for now; Training opens on the date strip, "Log workout for <date>" and the workouts (REQ-TRN-003, REQ-TRN-004). The card comes back with training plans (REQ-TRN-001, post-MVP).

### REQ-TRN-003 — Empty workout
- Requirement: "Log workout" lets the user log a self-directed session. The BRD calls it "Start an empty workout"; the owner renamed the button (D-37).
- MVP default (D-18): per exercise, sets × reps × weight, with an optional note (Q-042). An empty workout is saved but counts toward the weekly target only once it has an exercise (D-41).
- MVP defaults (D-29): "Log workout" saves a workout with no exercises at once, on the selected date, and opens it; each change is saved on the phone at once and synced, with no draft or "Finish" step. Per exercise: a name typed freely (1–80 characters), sets 1–20, reps 1–200 (the same for every set), an optional weight and an optional note of up to 500 characters; up to 30 exercises. A workout's date is fixed once started; it can be edited and deleted (after a confirmation), and a day may hold several workouts. Works offline (ADR-0007 rule 6).
- D-43: a date chip above "Log workout", as Log meal's, opens the calendar "Log this workout to"; the day picked becomes the app's selected date, which "Log workout" logs to.
- D-65 (replacing D-43's chip): the date strip at the top of Training picks the date, as Home's and Nutrition's; the button names it, "Log workout for today" or "Log workout for Sat 31 Oct", and logs to it.
- D-50 (replacing D-29's "typed freely" and "the same for every set"): the name searches FitSphere's exercise list (334 exercises, kept on the phone, offline) or is typed. Each list exercise has one of eight types that decides its fields: weight and reps (a weight on every set), reps (no weight: bodyweight), time, weight and time, distance and time (the average speed and pace shown), treadmill (speed, incline), cardio machine (level), time only. A name of the user's own asks "Log as": sets and reps, time, or cardio. Each set has its own reps, weight and time, 1 to 20 sets. Exercises saved before read as identical sets. Each exercise may have calories burned (a Compendium MET estimate, by speed for running, walking and cycling, or typed in its place) and an average and highest heart rate; calories show on the Training tab only, never on Home.
- D-67: the exercise library joins the list: the owner's 2,090 exercises by category and sub-group (1,832 new, 47 of them replacing ours with our names kept as other names; 2,119 in all), each logged as FitSphere decided, with a Compendium MET where one fits and typed calories where none does. Above the name, Category and Sub-group narrow the search: Sub-group follows the category; with either chosen its exercises show before a word is typed; "Search all categories" clears both. The name can still be searched with neither chosen.
- D-81: each row of the library (an exercise in one category and sub-group) keeps the file's primary muscle, muscles worked, equipment, tags, how-to steps 1 to 3, what to watch for and video address (blank for now), on the server only: nothing in the app shows them yet.
- D-83: while a workout's timer runs or is paused, a pill above the tabs, at the right, and over an exercise's page, shows it with its time and name; tapping it opens the workout (backlog E-29). One timer at a time: meanwhile another workout's Start workout, and Resume after Mark done, are greyed, saying which workout's timer is going, with a link to it.
- D-82: each exercise of a workout ends in a bar with Progress, Edit and Remove (replacing D-42's edit and remove icons); Progress opens its page: Progress, History and How to (REQ-TRN-008).
- D-71: the workout timer. A workout of today has **Start workout** in a bar at its foot; the bar then shows the time counted in minutes and seconds ("12:34", "1:05:12"), "Running" or "Paused", **Pause** or **Resume**, and **Mark done**, which stops it and shows "Done · total time" with the total, pauses left out (with Resume, on a workout of today). A workout of another date has no Start workout. A timer already started can be paused, resumed and marked done whatever the date. The time comes from the clock, so leaving the screen or closing the app does not stop it; 24 hours at most. Mark done is not required (D-29); a workout whose timer has started is listed before its first exercise, and counts toward the week only once it has one (D-41). Each step is saved on the phone at once and synced; it works offline.

### REQ-TRN-004 — Workout history
- Requirement: "Workouts you have logged" lists past workouts.
- MVP default (D-29): newest first; the last 90 days from the phone, and older workouts read from the server online with "Load older", view-only (ADR-0007 rules 1 and 6).
- One card per date (D-34): a date with several workouts shows them together, every exercise in one summary and "2 workouts" beside the date; each workout on its own row ("Workout 1", "Workout 2", in the order started) with a pencil to open it and a bin to delete it (asking first), and "Log another workout" on that date (D-42). Each workout is still stored, edited and deleted on its own.
- D-50: each date card shows the day's calories burned, typed or estimated, "· estimated" when any part is an estimate.
- D-65: two ways to see the workouts, under the date strip (a green mark on each day with a workout). "By day", the first, shows only the selected date's workouts ("No workouts on Sun 8 Nov." when none), each with its pencil and bin, and the day's calories burned. "All workouts" shows the history above, grouped by month, newest first: the newest month open, the others folded to one line, "October 2026 · 9 workouts on 8 days", opened or folded by a tap; "Load older" at the bottom opens the newest month it brings. A date picked on the strip or in the header's calendar shows By day. A workout with no exercise is not listed, marked or counted in either view, and the others are numbered without it ("Workout 1", "Workout 2"), on their own screen too; it is still stored.
- D-71: a timed workout's row says its timer, "Running · 12:34" (counting), "Paused · 31:08" or "Done · 52:40", in By day, All workouts and the older workouts read online; a workout whose timer has started is listed, marked and numbered before its first exercise.

### REQ-TRN-005 — Lifting unit
- Requirement: Lifting weights are entered and shown in the lifting-weight unit setting (REQ-ACC-002); changing the setting converts display of existing history.
- MVP default (D-29): stored in whole grams (invariant #6), 0.1–500 kg or none; entered and shown in kg with one decimal until the Settings slice adds the setting, which then converts the history shown.

### REQ-TRN-006 — Coach builds a training plan
- **Post-MVP** (D-20, backlog B-21).
- Requirement: A Coach, or a Head Coach the trainee allows (REQ-ROLE-004), builds the trainee's training plan by day. Each day lists exercises, each with a name, sets × reps, an optional note and an optional YouTube how-to link, unlisted or public (REQ-TRN-001, D-16). Saving the plan makes it visible to the trainee, labelled "Set by <name>" (REQ-ROLE-006). *(Listed in the MVP table — D-18.)*
- Acceptance criteria:
  - When the coach saves a plan, then the trainee's Training tab shows it instead of "No training plan yet" (REQ-TRN-002).
- MVP default (D-18): the exercise fields above.
- Open: coach screen layout and designs (Q-020, Q-052).

### REQ-TRN-007 — Log a planned workout
- **Post-MVP** (D-20, backlog B-21).
- Requirement: From the day's plan, the trainee starts the workout; its exercises are filled in from the plan, and the trainee logs sets × reps × weight per exercise, with an optional note (MVP default, Q-042). *(Listed in the MVP table — D-18.)*
- Acceptance criteria:
  - When a trainee finishes a planned workout, then it appears in workout history (REQ-TRN-004) and counts toward the weekly target (REQ-HOME-007).
  - Weights are entered and shown in the lifting-weight unit (REQ-TRN-005).

### REQ-TRN-008 — Exercise details: progress, history and how to
- Requirement (D-82, the owner, 2026-11-11): each exercise has a page with three tabs: **Progress**
  (the user's records with it and a graph over time), **History** (every workout with it, the best
  marked) and **How to** (how to do it, from the exercise library, and a video). Opened from a
  workout exercise's Progress button and from Add exercise's How to do it. Plan: `docs/plans/exercise-details-page.md`.
- Acceptance criteria:
  - Given a workout, when the user taps an exercise's Progress, then its page opens on Progress if
    the exercise was logged before, otherwise on How to; the back arrow returns to the workout.
  - Given an exercise of the list picked in Add exercise, when the user taps How to do it, then its
    page opens on How to, and the back arrow returns to the form as it was.
  - Progress shows three records for the exercise's kind, each with the day it was made (a lift:
    Estimated 1RM, Heaviest, Best volume; running: Longest distance, Fastest pace, Workouts), the
    number of workouts with their first and last days, and a graph for 4W, 12W or All that needs two
    workouts in the range; a lift's graph shows Est. 1RM, Heaviest or Volume. Touching the graph and
    sliding shows the nearest workout's value and day in a bubble, and its numbers under the graph, until
    a touch elsewhere or another measure or range; a screen reader steps through the workouts.
  - History lists each workout with the exercise, newest first, its sets as the workout page shows
    them; the exercise's bests (a lift: Best 1RM, Heaviest, Best volume; running: Longest, Fastest)
    show as tiles at the top, each with its value and day, scrolling to its workout when tapped, and
    as tags at the top right of the card holding each, on its date's line; a workout on the phone opens
    from its card; Load older reads older workouts online, which are shown, not opened.
  - How to shows the library's steps, what to watch for, the muscles worked (the primary first) and
    the equipment, with "General guidance, not personal advice. Stop if anything hurts."; and a video
    card opening the exercise's own video, or the owner's default one, outside the app. With no
    details: "No how-to yet". A name the user typed has no video.
  - Workouts count when their exercise's name is the exercise's name or one of its other names,
    ignoring case, hyphens, spaces and doubled letters. Weights are in the lifting-weight unit
    (REQ-TRN-005). Records and All count the phone's 90 days and any older workouts loaded.

---

## PRG — Progress (BRD §10)

### REQ-PRG-001 — Weight over 4 weeks
- Requirement: Shows weight change over the last 4 weeks and the weekly rate, in the body-weight unit (REQ-ACC-003).
- Acceptance criteria:
  - Given less than one week of weigh-ins, then the weekly rate is replaced by a not-enough-data message.
- MVP default (D-18): the 4-week change is the latest weigh-in minus the weigh-in nearest to 28 days earlier; the weekly rate is that change ÷ the weeks between the two weigh-ins, which is ÷ 4 at 28 days (Q-043, refined by D-30).
- MVP default (D-30): the earlier weigh-in is one at least a week before the latest; with none, the change is measured from the oldest weigh-in and the rate is replaced by the not-enough-data message. The weight history stays on its own screen, opened by "All weigh-ins".

### REQ-PRG-002 — Average calories
- Requirement: Shows average daily calories vs target.
- MVP default (D-18): averages count only days that have entries (Q-043); the period is the last 4 weeks, as in REQ-PRG-001.
- MVP default (D-30): the last 28 IST days, today included, against the user's own calorie target (D-20).

### REQ-PRG-003 — Days logged
- Requirement: Shows meals logged as days with ≥1 meal out of total days (e.g. "0 of 27 days").
- MVP default (D-18): total days count from the day the account was created, capped at the last 28 days (Q-044).
- MVP default (D-30): the account's creation day is read from `GET /v1/me` once and kept on the phone; while it is unknown (offline), 28 days are counted.

### REQ-PRG-004 — Weight trend chart
- Requirement: Chart with range filters 1W, 1M, 3M, 6M, All (D-34; first 1W, 4W, 12W, 26W, All); empty state until enough weigh-ins exist.
- MVP default (D-18): the chart needs at least 2 weigh-ins (Q-043).
- MVP default (D-30, amended by D-34): months are calendar months, back to the same date (or that month's last day); the chart opens on 1M. 1W, 1M and 3M come from the phone, 3M cut to the 90 days it holds so it works offline (up to 3 days short of three months); 6M and All also read older weigh-ins online (ADR-0007 rule 6, with a named warning offline) and plot weekly averages. The ranges are named "1 week", "1 month", "3 months", "6 months" and "All" for screen readers.

### REQ-PRG-005 — Week-by-week table
- Requirement: Rows per week with Body Weight, Calories, Protein and Steps, and a Target row. Weekly values are averages over the days that have entries (MVP default, Q-043). The Target row shows the calorie and protein targets and the target body weight and daily steps target set by the coach (MVP default, Q-013). In the MVP these are the user's own targets (REQ-ROLE-007, D-20).
- **Post-MVP:** the "Pre" row with the pre-program baseline, and tapping a week to open its details (D-18; Q-045, Q-046; backlog B-02).
- MVP default (D-30): this week and the 11 before it (within the phone's 90 days), none before the account's first week; older weeks are backlog E-18.

### REQ-PRG-006 — Measurements section
- Requirement: Lists measurements; with none, shows "Add first" (opens REQ-MEAS-001) and recommends weekly upper/lower waist tracking.
- MVP default (D-30): the phone's 90 days, newest first, each with "Edit measurements"; adding opens the sheet on today. Older entries are backlog E-18.

---

## ACC — Account and settings (BRD §11)

### REQ-ACC-001 — Appearance
- Requirement: Theme options System, Light, Dark with helper text for the selected option; System follows the device theme.
- MVP (D-31): synced with the account; System until the user chooses, and before sign-in. The app's own colours, the headers, the tab bar and the status bar follow it; Android's own dialogs and the keyboard follow the phone. Whether System follows the phone on the current development build is phone check 2 of the Settings slice (`app.json` has `"userInterfaceStyle": "light"`).

### REQ-ACC-002 — Lifting-weight unit
- Requirement: kg/lb setting for lifting weights in workouts and history, independent of body-weight unit.
- MVP (D-31): synced with the account; kg until the user chooses. Weights stay stored in grams, so a change converts every weight shown, history included. Typed with one decimal, 0.1–500.0 kg or 0.3–1102.3 lb.

### REQ-ACC-003 — Body-weight unit
- Requirement: kg/lb setting for weigh-ins and progress, independent of lifting unit.
- MVP (D-31): synced with the account; kg until the user chooses. It applies to the Home weight tile and its sheet, the weight history, the target body weight, rejected-change texts and Progress (slice 5, through the same setting). Typed with one decimal, 20.0–300.0 kg or 44.1–661.3 lb.

### REQ-ACC-004 — AI meal reading consent
- Type: Privacy
- Requirement: An "AI meal reading" toggle records consent. Before any meal text, photo, voice note or nutrition label is sent to AI, the user is asked for consent.
- Acceptance criteria:
  - Given a new user, then AI is off until they consent. *(Default-off — A-007.)*
  - When consent is withdrawn, then no further data is sent to AI.
  - Consent changes are recorded with a timestamp. *(A-007.)*
- MVP default (D-18): each change records on/off, the time and the version of the consent text shown; one toggle covers typed or spoken text, photos and labels (Q-065; ADR-0005). Legal confirms (Q-049).
- MVP (D-31): the switch and the record are built in the Settings slice (slice 6), with no AI call: each change goes to `PUT /v1/me/ai-consent`, online only, and the server records its own time (data model, `ai_consents`). The consent text and its version are in the shared package (`AI_CONSENT_TEXT`). The check before each AI call comes with slice 7 (invariant #3).

### REQ-ACC-005 — Non-AI logging always available
- Requirement: Food database, barcodes and saved meals work with AI turned off.

### REQ-ACC-006 — Country and time zone
- Priority: **Won't** for this release (D-09). Phase 1 uses Asia/Kolkata for everyone (REQ-DATE-004).
- Requirement: Country and time zone are configurable (e.g. India · Kolkata) and drive REQ-DATE-004.
- MVP (D-18, D-31): nothing can be changed. Settings shows "Country and time zone: India · Kolkata" as fixed text (D-09: the owner chose to show it). The MVP Settings list is theme, units and AI consent (`mvp-scope.md` section 2).

### REQ-ACC-007 — Change password
- Type: Security
- Requirement: A signed-in user can change their password.
- Sign-in is email and password (D-05); sign-up and password reset are in REQ-ACC-010.
- MVP (D-31): in Settings, the current password and a new one; the current one is checked by signing in again, then the user's other devices are signed out. Online only.

### REQ-ACC-008 — Log out
- Requirement: The user can log out; the session ends on this device.
- MVP default (D-18): logging out deletes the phone's local data. If entries are not yet synced, the app warns that they will be lost and deletes them only if the user confirms (data model, "On the phone").

### REQ-ACC-009 — Delete account
- Type: Privacy
- Requirement: "Delete account" opens a separate flow. After the user confirms, FitSphere deletes the user's data from the database and file storage, ends all their links (the other side gets the neutral "<name> is no longer linked with you" message), and deletes the sign-in account. Only the security logs required by REQ-NFR-005 are kept, without health data (MVP default, Q-048; Legal to confirm, Q-049). Google Play also requires a web page: a simple page explains how to request deletion by email (Q-048). *(How: ADR-0004 rule 7.)*
- Acceptance criteria:
  - When the user confirms deletion, then their entries, plans, targets, settings, profile (REQ-ACC-011), consent records, Head Coach permission answers and media are removed from the database and file storage, and they can no longer sign in.
  - When the account is deleted, then each linked coach, Head Coach or trainee gets the neutral message, and their phones delete the user's data on their next sync (REQ-NFR-004).
  - The admin access log keeps its entries about the account, without health data (REQ-NFR-005).
  - A public web page explains how to request deletion by email. The owner acts on a request only after confirming it from the account's registered address, and only through the logged admin path (ADR-0004).
- Status: unblocked — Q-048 answered for the MVP (D-18). Before real users, Legal confirms what is deleted and what is kept (Q-049). Asking for the password again is post-MVP (backlog E-01).
- MVP (D-20): no links exist, so ending links and the neutral message apply post-MVP (backlog B-19).
- MVP (D-31): built in the Settings slice as `DELETE /v1/me` (api-conventions): the photo files, then the user's rows, then the Supabase sign-in account, deleted with a secret key only the API holds. The page's text is [`docs/legal/account-deletion-page.md`](../legal/account-deletion-page.md) (draft). Acting on an emailed request needs the logged admin path, which is release-blocking task RB-04.

### REQ-ACC-011 — Profile
- Type: Functional, Privacy
- Requirement: The user can add and change their basic details in Settings: a photo, their name,
  date of birth, sex, height, phone number and address; the weight is their latest weigh-in; the
  sign-in email is shown read-only. Every field is optional. *(Not in the BRD; the owner's request,
  D-38.)*
- Acceptance criteria:
  - Given a date of birth that makes the user under 18, then it is refused with "Enter a date of
    birth for someone 18 or older." (REQ-ACC-010); the profile shows the age a date gives.
  - The height is kept in millimetres and shown in cm, or in inches when the measurements use
    inches (invariant #6); 100 to 250 cm.
  - The phone number is a 10-digit Indian mobile number, kept with +91 (invariant #5); not verified.
  - An address is empty, or has line 1, the city, the state and a 6-digit PIN code; line 2 is
    optional.
  - "Log today's weight" saves today's weigh-in, as on Home (REQ-HOME-006).
  - The profile is saved on the phone and synced, so it can be edited offline (ADR-0007); its photo
    is kept and uploaded as a meal photo is (ADR-0002).
  - The header greets the user by the first word of their name, and the avatar shows their photo,
    when there are (REQ-HOME-001).
  - Only the user can read or change their profile (REQ-NFR-001, D-20); no value is logged
    (REQ-NFR-002); deleting the account deletes it and its photo (REQ-ACC-009).
- Status: built (D-38). Before real users, Legal reviews the new data (Q-049).
- MVP defaults (D-38): the sign-in email can't be changed; the phone is not verified; the weight
  shown is the latest weigh-in on the phone (the last 90 days); a photo is cropped to its middle
  square.

### REQ-ACC-010 — Sign-up and sign-in
- Type: Security
- Requirement: A person can create an account and sign in with email and password before using any role view; this is the only sign-in method in phase 1 (D-05). Users must be 18 or older: sign-up requires an "I am 18 or older" confirmation (D-18, answers Q-066 for the MVP). *(Not in the BRD, which mentions only change password, log out and delete account.)*
- Acceptance criteria:
  - Given an email address that is not registered, when the person signs up with it and a password, then an account is created and a verification email is sent to that address.
  - Given the person has not confirmed "I am 18 or older", then sign-up cannot be completed and they cannot use FitSphere (D-18).
  - When the confirmation is given, then the account records when it was given and which version of the confirmation text was shown (MVP default, D-18).
  - Given a registered email and its correct password, when the user signs in, then they are signed in.
  - Given a user who has forgotten their password, when they request a reset, then a reset link is sent to their registered email address and lets them set a new password.
  - Given an email address that is already registered, when someone signs up with it, then they see the same neutral message as for a new address, and response timing does not reveal the difference (D-11, T-01).
  - When a password reset is requested, then the same neutral message is shown whether or not the email is registered, under the same timing rule (D-11).
  - Given an account whose email is not yet verified, when it tries to sign in, then it is asked to verify first (MVP default, Q-080).
- MVP default (D-18): an account must verify its email before it can sign in; verification and reset links expire within 24 hours (Q-080; ADR-0004). Emails are sent through Resend from FitSphere's own domain (ADR-0004, answers Q-082); this is still required at the MVP release (D-20).
- MVP default (D-18): the neutral sign-up and reset texts are in the [error model](../contracts/error-model.md#texts-the-app-shows).
- Password (owner, D-18 answer 14): at least 8 characters, with no character-type rules.
- Minimum age (D-18, Q-066): 18 or older in the MVP. The confirmation is self-declared; FitSphere does not verify age (threat model, open risks). **Post-MVP:** use by people under 18 (backlog B-16); what it would need is for Legal (Q-049).

---

## NFR — Non-functional (not in BRD; proposed, need owner targets)

### REQ-NFR-001 — Server-side authorization
- Type: Security
- Requirement: Every data read and write is authorized on the server. A user can access another person's data only through an accepted link: a Coach → their accepted trainees; a Head Coach → the coaching activity of their accepted coaches (never a coach's own personal logs; counts only — REQ-ROLE-004), and a trainee's data only while that trainee allows it (REQ-ROLE-013). A Head Coach may view and set a trainee's plans and targets only while the trainee allows it. Coaches and Head Coaches never see a trainee's settings or AI consent. Ending a link — by removal, leaving or switching — ends access to all of that person's data, including past data. Changes queued offline are re-authorized at sync time. UI hiding is not access control. Exception — external links: for content a user stores on another site and adds as a link, ending a link hides the link from the former coach or Head Coach, but FitSphere cannot revoke access to the content itself (REQ-LOG-010, R-004). (Project invariant 1; D-06, D-07, D-10, D-11, D-13, D-16.)
- Acceptance criteria:
  - Given a request for another person's data with no accepted link, or from a Head Coach without that trainee's permission, then the server refuses it, whether the request comes from the app or directly to the API.
  - Given a Head Coach whose access a trainee has declined, when they try to set that trainee's plan or target through the API, then the server refuses it (D-13).
- MVP (D-20): no links exist, so a user can read and write only their own data, and the server refuses every request for another user's data. The link rules apply post-MVP (backlog B-19, B-20).

### REQ-NFR-002 — Sensitive data handling
- Type: Privacy
- Requirement: Body, health, meal and photo data are treated as sensitive personal data: encrypted in transit and at rest, excluded from logs, and processed only for stated purposes. Applicable law (e.g. India's DPDP Act 2023) to be confirmed (C-003, Q-049).

### REQ-NFR-003 — Performance, availability, accessibility
- Requirement: No numeric targets for the MVP; the app must be usable on a low-end Android phone (MVP default, Q-050).
- Long-term aspiration, **not a capacity target**: FitSphere aims to support up to 20 million users. Phase 1 starts on free tiers (C-008). ADR-0002 and ADR-0003 must explain how the chosen backend and database can grow toward this without a rewrite, and what each stage would cost (D-15).

### REQ-NFR-004 — Offline logging and data on the device
- Type: Functional, Operational, Security
- Requirement: Users can log while offline: entries are saved on the device and synced when the connection returns. Any step that needs the internet shows a warning that names that step (D-04). Every queued change is re-authorized on the server at sync time (D-10).
  - **The server is the permanent record.** No device rule ever deletes a user's full history; on sign-in, even years later, the app restores it from the server (D-14).
  - **Encryption:** health data stored on the device is encrypted (D-10), invisibly to the user — no extra passwords, no lost features, and offline logging still works (D-14).
  - **Ended links:** the former coach's or Head Coach's app deletes that trainee's data from the device on its next sync (D-13). The same happens on a Head Coach's phone when a trainee withdraws permission (REQ-ROLE-013, ADR-0007).
  - **30 days without a sync:** the app clears only (a) unfinished drafts, such as typed meal text never sent for AI reading, and (b) other people's data copied onto a coach's or Head Coach's phone. Cleared trainee data comes back on the next sync if the link is still active (D-14). Three days before an unfinished draft is cleared, the app shows a reminder: "You have an unfinished meal entry. It will be removed in 3 days." (D-15)
  - **Never cleared automatically:** the user's own entries waiting to sync — they are the only copy and stay until synced (D-14).
  - **Photos cached on the device** (REQ-NFR-006) follow the same rules: encrypted; deleted for a trainee on the next sync after the link ends; other people's photos cleared after 30 days without a sync (D-16).
  - **Phase 1 hosting (D-16):** the Supabase Free plan has no backups, so data lost on the server cannot be restored from a backup. This conflicts with "the server is the permanent record" and is accepted risk R-005.
- Acceptance criteria:
  - Given the device is offline, when the user logs their weight, then it is saved on the device and shown in their data; when the connection returns, it is synced.
  - Given the device is offline, when the user starts a step that needs the internet, then the app shows a warning that names that step.
  - Given a change queued offline by a user who has since lost access (e.g. a coach removed from a trainee), when it syncs, then the server rejects it (D-10).
  - Health data stored on the device is encrypted (D-10); the user is asked for no extra password, no feature is lost, and offline logging still works (D-14).
  - Given a user who signs in on a new or reset phone, then the app restores their full history from the server (D-14): the last 90 days are stored on the phone, and older history loads when viewed online (ADR-0007; D-18 interpretation).
  - Given a link that has ended, when the former coach's or Head Coach's app next syncs, then it deletes that trainee's data from the device (D-13).
  - Given a phone that has not synced for 30 days, then unfinished drafts and other people's data on it are cleared; the user's own entries waiting to sync are kept (D-14).
  - Given an unfinished draft that will be cleared in 3 days, then the app shows the reminder "You have an unfinished meal entry. It will be removed in 3 days." (D-15)
  - Given cleared trainee data on a coach's phone whose link is still active, when the phone next syncs, then that data comes back (D-14).
- MVP default (D-18): which steps work offline and which need internet is set by ADR-0007 rule 6, which refines the D-04 split (Q-077). Sync and conflicts: ADR-0007. If an encryption choice would break a feature, it is raised as a question, not applied (D-14).
- MVP (D-20): the phone holds only the user's own data. The parts about ended links, and about other people's data on a coach's or Head Coach's phone, apply post-MVP (backlog B-19, B-20).

### REQ-NFR-005 — Operator access
- Type: Security, Privacy, Operational
- Requirement: In phase 1 the project owner is the only operator of FitSphere; there is no support staff. Every admin access to user data is logged (D-13). The log is stored in the backend database, kept for 1 year (Legal to confirm, Q-049) and reviewed monthly by the owner (D-14). The owner signs in to the hosting dashboards (Supabase, Google Cloud) with two-factor sign-in, never browses user data in those dashboards, and makes any needed access through the logged admin path (D-16). In phase 1 the operator reviews their own access, and dashboard access is outside this log — accepted risk R-003. The MVP has no admin screens; the logged admin path is a small set of owner-only API commands (ADR-0004). A Platform Admin role is future scope (Q-086).
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
