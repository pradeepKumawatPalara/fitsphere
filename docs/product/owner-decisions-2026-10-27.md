# Owner Decisions — 2026-10-27

- Status: **Accepted** (answers given by the project owner in chat, 2026-10-27)
- Owner: Project owner (sole developer)
- Purpose: authoritative record of the owner's answers. Apply each "Doc change" to the
  named file; once applied, the Q- item is marked *Answered — see this file*.
- Items marked **Interpretation** are how the answer was read. Confirm or correct them;
  until confirmed they stay Draft.

---

## D-01 Owners and capacity (answers Q-001)
- Answer: built alone with Claude Code. The project owner approves all product, technical,
  design and QA documents. Capacity is about 8 hours a day, weekdays only (~40 h/week).
- Doc change: replace every placeholder owner role in `docs/README.md` and the Q- tables with
  "Project owner". Keep **Legal** as a separate owner (see D-09) — a developer cannot
  self-certify legal compliance.
- Consequence: technology choices must suit one person. Favour managed services, one
  language across client and server, and few moving parts.

## D-02 Platforms (answers Q-051)
- Answer: Android and iOS.
- **Interpretation:** coaches and head coaches use the same mobile app. No web dashboard in
  phase 1. *(Not stated explicitly — confirm. See F-01.)*
- Doc change: A-001 → confirmed (Android + iOS, no web in phase 1). Unblocks ADR-0001.

## D-03 Stack preference and budget (answers Q-053)
- Answer: prefers React Native, JavaScript and Node. Open to another stack if functionality
  or scalability would suffer. Budget is limited: use free services wherever possible.
- Costs that cannot be avoided (verified 2026-10-27, recheck before paying):
  - Apple Developer Program: US$99/year, required for TestFlight and App Store.
  - Google Play developer account: US$25 one-time. New personal accounts must meet testing
    requirements before production release.
  - AI meal parsing: per-request cost after any free tier (ADR-0005).
- Doc change: add these as C-008 (budget: free tiers first; paid items listed above require
  owner sign-off).

## D-04 Offline (answers Q-055)
- Answer: users should be able to log while offline. Where a step needs the internet, the app
  shows a warning that names that step.
- **Interpretation — proposed split (confirm, see F-10):**

  | Works offline (saved on device, synced later) | Needs internet (show named warning) |
  |---|---|
  | Weight, steps, sleep | Sign-in (first time) and password change |
  | Measurements | AI meal reading (text, voice, photo) |
  | Workouts (plan already on device, or empty workout) | Search food database (unless cached) |
  | Re-log from Saved / Eaten before (if on device) | Barcode lookup |
  | Viewing data already synced | Invites, accept/decline, unassign |
  | Typed meal text kept as a draft to parse when back online | Coach editing a trainee's plan |

- Doc change: new requirement REQ-NFR-004 (offline logging + named warnings); add to the
  ADR-0001 and ADR-0003 dependencies. Needs a sync/conflict decision (new ADR slot).

## D-05 Sign-in (answers Q-047)
- Answer: email and password only in phase 1.
- Doc change: A-008 → confirmed. The sign-in requirement (REQ-ACC-010) is no longer blocked
  on method. Forgot-password and email verification are still needed — add as acceptance
  criteria (an email-and-password product cannot work without password reset).

## D-06 Roles and invitations (answers Q-006, Q-009; refines REQ-ROLE-*)
- Answer:
  1. **Phase 1:** any user can declare any role (Personal Training User, Coach, Head Coach)
     for themselves.
  2. **Future scope:** premium plans will gate the Head Coach role and limit how many
     coaches/trainees each plan allows. Not built now.
  3. A Head Coach adds a Coach by **either**
     a. inviting a **new email** that is not registered in FitSphere; or
     b. inviting an **existing user**, who must accept.
  4. A Coach adds a trainee the same two ways.
  5. Once a Coach accepts a Head Coach, the Head Coach can see the Coach's **past** activity,
     not only activity from that day on. The same applies when a trainee accepts a Coach.
  6. A Head Coach sees only their own coaches; never another Head Coach's coaches or view.
     A Coach sees only their own trainees.
- **Interpretation:** "an email which should never be logged in our user" = for flow 3a,
  the email must not belong to an existing account; existing users go through flow 3b.
  *(Confirm.)*
- **Important:** because access to anyone else's data now requires the other person to
  **accept** an invitation, self-declaring a role does not by itself expose anyone's data.
  This removes the abuse case raised in the review (conflict #1), provided acceptance is
  enforced on the server.
- Doc change: rewrite REQ-ROLE-001, 003, 005 accordingly; add REQ-ROLE-008 (invite new
  email), REQ-ROLE-009 (invite existing user + accept/decline), REQ-ROLE-010 (past-activity
  visibility on acceptance). Record premium plans under "Future scope" in the product brief.

## D-07 Removal (answers Q-010)
- Answer: "delete" means **unassign**. No data is deleted. To rejoin, the trainee must accept
  again. Same between Head Coach and Coach.
- Doc change: rename CRUD "delete" to "remove (unassign)" in REQ-ROLE-003/005. Rejoining
  re-uses the invite-and-accept flow. See F-07 for what the former coach can still see.

## D-08 Head Coach edit rights (answers Q-021)
- Answer: a Head Coach can **edit the plans** of trainees who belong to their coaches.
- **Interpretation:** "plans" = diet plan and training plan. Whether this also covers
  calorie/protein targets is not stated — confirm (F-08).
- Doc change: REQ-ROLE-004 becomes "view and edit plans"; record who last changed a plan.

## D-09 India only (answers Q-018 for phase 1; narrows Q-049)
- Answer: phase 1 is for users in India only. Multiple time zones are future scope.
- Consequence: all day boundaries use **Asia/Kolkata (IST, UTC+05:30)**, which has no
  daylight saving. Q-018 is answered for phase 1.
- Doc change:
  - C-006 → "Phase 1: all users are in India; days are computed in Asia/Kolkata."
  - REQ-ACC-006 (country/time zone setting) → *Won't for this release*; show "India ·
    Kolkata" as fixed text or hide it — owner's choice.
  - REQ-DATE-004 → IST only; move other zones to Future scope.
  - C-003 / Q-049: India's Digital Personal Data Protection Act 2023 becomes the primary law
    to check. **Still needs legal confirmation** before real users (owner: Legal advisor).

---

## Proposed replacement wording for the two invariants
*(The review found these pre-answered open questions. Now that D-08 and D-09 exist, here is
wording to approve. Do not apply until approved.)*

- **Invariant #1 (new):** Authorization is server-side. A user can access another person's
  data only through an **accepted** link: Coach → their accepted trainees; Head Coach → their
  accepted coaches and those coaches' trainees. Head Coaches may view and edit those trainees'
  plans (D-08). Removing a link removes access (D-07). UI hiding is not access control.
- **Invariant #5 (new):** Phase 1 serves India only. "Today" and day membership use
  Asia/Kolkata, never server local time. Store timestamps in UTC, and store the day the user
  chose (REQ-LOG-002) as its own field — never derive it from the timestamp alone.

---

## Follow-up questions raised by these answers
Assign the next free Q- numbers when adding these.

| Ref | Question | Why it matters | Blocks |
|---|---|---|---|
| F-01 | Confirm: no web dashboard for coaches in phase 1? Building 3-option diet plans on a phone is a lot of typing. | Coach UX, ADR-0001 | Coach plan editor |
| F-02 | **Trainee privacy:** when a Coach accepts a Head Coach, the Head Coach sees that Coach's trainees' data — but the trainees only agreed to the Coach. Should trainees be told, or asked to agree? | Likely a DPDP consent issue | REQ-ROLE-010, threat model |
| F-03 | If a Coach is also a Personal Training User, does "past activity" visible to their Head Coach include the Coach's **own** food and body logs? (Recommend: no — coaching activity only.) | Multi-role privacy | REQ-ROLE-010 |
| F-04 | Confirm the reading of "new email never registered" in D-06. | Invite flow | REQ-ROLE-008 |
| F-05 | Can a trainee have more than one Coach, or a Coach more than one Head Coach? Can the trainee leave a coach on their own? | Data model (A-003) | ADR-0003, ROLE-* |
| F-06 | Invitation rules: expiry, resend, cancel, how many pending invites. | Invite flow, abuse limits | REQ-ROLE-008/009 |
| F-07 | After a trainee is unassigned, can the former coach still see their past data? (Recommend: no.) | Privacy | REQ-ROLE-005 |
| F-08 | Can a Head Coach also change calorie/protein **targets**, or only plans? If Coach and Head Coach edit at the same time, which wins? | Authorization, conflicts | REQ-ROLE-004/006 |
| F-09 | Do you have a Mac and an iPhone for iOS testing? | iOS build and test route, ADR-0001 | iOS release |
| F-10 | Confirm the offline split in D-04. | Sync design | REQ-NFR-004 |