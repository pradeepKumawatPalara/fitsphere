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

## D-10 Privacy, invitations, offline security and iOS (answers Q-007, Q-058, Q-069, Q-070, Q-074, Q-076)
- Status: **Accepted** (answers given by the project owner in chat, 2026-10-27)
- Answers:
  1. **Removal ends access (Q-074, F-07):** removing a link ends access to all of that person's
     data, including past data.
  2. **Coaching activity only (Q-070, F-03):** a Head Coach sees a coach's coaching activity
     only, never the coach's own personal logs.
  3. **Trainee agreement (Q-069, F-02):** trainees must be notified and must agree before a
     Head Coach can see their data. REQ-ROLE-010 is **Blocked** until this consent step is
     specified (Q-078) and is listed in invariant #8.
  4. **Invitations:** the invite flow never reveals whether an email is registered — it always
     shows "Invitation sent" — and invitations have daily limits.
  5. **ADR-0007 inputs:** every change queued offline is re-authorized on the server at sync
     time; health data stored on the device is encrypted.
  6. **Q-007:** yes — any account can turn on Personal Training User (D-06).
  7. **Q-058:** a Coach record or trainee record is the accepted link between two accounts, not
     an account; removing it deletes no data (D-07).
  8. **iOS (Q-076, F-09):** the owner has neither a Mac nor an iPhone. Phase 1 is
     **Android-first**: develop and test on Android (emulator and an Android phone). iOS builds
     may be compiled with EAS to check that they build, but iOS testing and App Store release
     are deferred until an iPhone is available. The Apple Developer fee is needed only at iOS
     release.
- Risk accepted: iOS-only bugs will be found late (R-001).
- Doc changes: invariant #1 updated and REQ-ROLE-010 added to invariant #8; REQ-ROLE-003/004/
  005/008/009/010 and REQ-NFR-004 updated; REQ-ROLE-011 added (invitation privacy and limits);
  threat-model item T-01 (plus T-02 and T-03 for the ADR-0007 inputs); ADR-0001 validation
  step 5 and revisit conditions; product brief Scope (Android first, iOS follows); C-008 and
  A-001 updated.

## D-11 Links, invitation delivery, switching and trainee permission (answers Q-071, Q-072, Q-078, Q-079, Q-081)
- Status: **Accepted** (answers given by the project owner in chat, 2026-10-27)
- Answers:
  1. **One link each, for now (Q-072, F-05):** one coach per trainee and one Head Coach per
     coach. A trainee may leave their coach, and a coach may leave their Head Coach, at any
     time; leaving ends access exactly like removal (D-10).
  2. **Invitation delivery (refines D-06; answers Q-071):** a Head Coach invites a coach by
     entering an email; a Coach invites a trainee the same way.
     - Email with no FitSphere account: phase 1 sends an invitation email with a sign-up link.
       Other channels (SMS, WhatsApp, etc.) are future scope.
     - Email of a registered user: the invitation is delivered in the app — a push
       notification plus an in-app invitations list, so it is not lost if push is off. No
       email is needed.
     - In both cases the inviter sees only "Invitation sent" (REQ-ROLE-011 still holds); the
       channel used is never shown to the inviter.
     - When a coach accepts, the inviting Head Coach becomes that coach's Head Coach.
  3. **Switching:** if a coach who already has a Head Coach accepts a new invitation, the old
     link ends first (the old Head Coach loses all access immediately, per D-10), then the new
     one is created. Trainees' earlier Allow/Decline answers do not carry over; each trainee
     gets a fresh request for the new Head Coach. The same rule applies when a trainee
     accepts a new coach: the old coach link ends.
  4. **Trainee permission (Q-078):** an in-app request to each trainee: "Allow Head Coach
     <name> to see your logs and edit your plans?" — Allow / Decline. Declined means the Head
     Coach has no access to that trainee. The trainee can change the answer at any time in
     Settings. New trainees joining a coach who has a Head Coach get the same request during
     acceptance. Each answer is recorded with a timestamp. REQ-ROLE-010 is unblocked and
     removed from invariant #8.
  5. **Neutral messages (Q-079):** sign-up and password reset show neutral messages that never
     reveal whether an email is registered, with the same timing rule as T-01.
  6. **Links have no editable fields (Q-081):** "update" means editing the trainee's plans and
     targets; "remove" means ending the link.
  7. Split the coach-sees-trainee-past-activity part of REQ-ROLE-010 into its own requirement.
     Align REQ-NFR-001 with invariant #1.
  8. New open questions: invitation email service and sender domain (Q-082); push notification
     service (Q-083); whether the old Head Coach or coach is told when a link ends by
     switching (Q-084).
- Doc changes: REQ-ROLE-003/004/005/008/009/010/011, REQ-ACC-010 and REQ-NFR-001 updated;
  REQ-ROLE-012 (coach sees past activity), REQ-ROLE-013 (trainee permission), REQ-ROLE-014
  (leave) and REQ-ROLE-015 (switch) added; A-003 confirmed; REQ-ROLE-010 removed from
  invariant #8; threat model gains a permission matrix and threats T-04 to T-06;
  `docs/architecture/system-context.md` drafted; journeys J-08 to J-10 updated; product brief
  Future scope (other invitation channels).

## D-12 ADR-0001 accepted without the spike
- Status: **Accepted** (answer given by the project owner in chat, 2026-10-27)
- Answer: skip the ADR-0001 validation spike and mark ADR-0001 **Accepted** — Option A, React
  Native with Expo and TypeScript, using development builds and EAS Build. The spike's checks
  move into the first slices.
- ADR-0001 is accepted while four of its dependencies are still open: Q-020 and Q-052 (coach
  screen layout and designs), Q-068 (web dashboard for coaches — already a revisit condition)
  and Q-083 (push service — checked in the first slice, D-13).
- Risk accepted: a problem with the framework may only be found once the first slices are
  built (R-002).
- Doc changes: ADR-0001 status, decision and validation plan; decisions index; R-002; suggested
  first slice; `CLAUDE.md` current phase; docs index; system context; `flow.md`.

## D-13 Head Coach visibility, targets, invitation safeguards, phone copies and operator (answers Q-084, Q-085; updates Q-075)
- Status: **Accepted** (answers given by the project owner in chat, 2026-10-27)
- Answers:
  1. **Coaching activity (Q-085):** without a trainee's permission, a Head Coach sees only
     counts per coach: number of trainees; how many have allowed, declined or not yet answered
     (pending); plans sent. No trainee names or data.
  2. **Targets and plans (Q-075, updated):** both the Coach and the Head Coach can set a
     trainee's diet plan, training plan, and calorie and protein targets. The Coach can do this
     for their own trainees; the Head Coach only while that trainee allows Head Coach access
     (REQ-ROLE-013). Each change records who made it and when, so the trainee and both coaches
     can see the latest change and its author.
  3. **Invitations:** invitation links work once and expire after 7 days; the sender domain has
     SPF, DKIM and DMARC set up; the accept screen warns that accepting ends the current link.
     These move from "proposed" to decided in the threat model (T-04, T-05, T-06).
  4. **Settings and consent:** Coaches and Head Coaches cannot see a trainee's settings or AI
     consent. A Head Coach sees only each trainee's permission status (allowed / declined /
     pending).
  5. **Phone copies:** when a link ends, the former coach's or Head Coach's app deletes that
     trainee's data from the device on its next sync. Input to ADR-0007; threat T-06.
  6. **Operator (updated):**
     - Phase 1: the project owner is the only operator. No support staff. Any admin access to
       user data is logged.
     - Future scope: a fourth role, "Platform Admin" (the business owner), with the rights
       needed to run FitSphere as a business. Not designed now.
     - New open question Q-086 (Project owner + Legal): which Platform Admin rights include
       viewing users' personal health data, and under what controls (need-to-know only, every
       access logged, user notified where the law requires).
  7. **Leaving and switching (Q-084):** when a link ends by leaving or switching, the other side
     always gets a neutral message: "X is no longer linked with you".
  8. **Permission answers:** kept while the account exists; how long they are kept after the
     account is deleted is decided with Legal (Q-049).
  9. **ADR-0001:** push notifications added to the decision criteria; verify Expo push support
     in the first slice.
  10. **Invariant #1:** the two proposed wording changes are applied ("only while that trainee
      allows it"; "Ending a link — by removal, leaving or switching —"), and it now says a Head
      Coach may set plans and targets only while the trainee allows it.
- **Interpretation (confirmed in D-14):** answers 1 and 4 read together — a Head Coach sees
  trainees who have declined or not answered only within the counts, with no names; trainees
  who have allowed access are shown by name.
- **Interpretation (confirmed in D-14):** "links" in answer 3 means the sign-up link in an
  invitation email. In-app invitations also expire after 7 days (D-14).
- Still open from Q-075: which change wins if the Coach and the Head Coach edit at the same time
  (ADR-0007).
- Doc changes: REQ-ROLE-004/005/006/008/010/011/013/014/015, REQ-PLAN-001, REQ-NFR-001 and
  REQ-NFR-004 updated; REQ-NFR-005 (operator access) added; Q-075 partly answered; notes on
  Q-049, Q-059, Q-073 and Q-083; Q-086 added; threat model (matrix, T-04 to T-06 decided, T-07
  added, retention); ADR-0001 decision criteria and checks; ADR-0007 inputs; system context;
  glossary; product brief; journeys J-08 and J-09; `flow.md`; invariant #1.

## D-14 Confirmations, weekly target, messages, data on the device and the access log
- Status: **Accepted** (answers given by the project owner in chat, 2026-10-27)
- Answers:
  1. **D-13 interpretations confirmed:** trainees who have declined or not answered appear to a
     Head Coach only in the counts; trainees who have allowed access are named. In-app
     invitations also expire after 7 days (Q-073).
  2. **Weekly workout target:** the Head Coach may also set it, the same as the Coach, only
     while the trainee allows it.
  3. **Permission request text** becomes: "Allow Head Coach <name> to see your logs and set
     your plans and targets?"
  4. **Removal:** when a link ends by removal, the removed side also gets the neutral message.
  5. **Coach sees the answers:** a Coach can see which of their trainees have allowed, declined
     or not answered the Head Coach request.
  6. **Data on the device (updated; T-06, ADR-0007 inputs, REQ-NFR-004):**
     - The server is the permanent record. No device rule ever deletes a user's full history;
       on sign-in, even years later, the app restores it from the server.
     - Encryption of data on the phone must be invisible to the user: no extra passwords, no
       lost features, and offline logging still works. If an encryption choice would break a
       feature, raise it as a question instead of applying it.
     - Auto-clear after 30 days without a sync applies **only** to (a) unfinished drafts, such
       as typed meal text never sent for AI reading, and (b) other people's data copied onto a
       coach's or Head Coach's phone.
     - The user's own entries waiting to sync are never auto-deleted — they are the only copy.
       They stay until synced.
     - Cleared copies of trainee data come back automatically on the next sync if the link is
       still active.
  7. **Admin access log:** stored in the backend database, kept for 1 year (Legal to confirm,
     Q-049), reviewed monthly by the owner. Accepted risk R-003: in phase 1 the operator
     reviews their own access.
  8. **Neutral "no longer linked" message:** delivered by push notification and the in-app
     notifications list.
  9. **Labels:** plan and target labels show the actual author: "Set by <name>" (REQ-PLAN-001).
- Doc changes: REQ-ROLE-003/004/005/006/009/011/013/014/015, REQ-PLAN-001, REQ-NFR-004 and
  REQ-NFR-005 updated; R-003 added; notes on Q-013, Q-049, Q-073 and Q-083; threat model
  (matrix, T-03, T-05 to T-07, retention); ADR-0007 inputs; system context; glossary; journeys
  J-08 and J-09; `flow.md`.

## D-15 Notifications list, draft reminder and long-term scale
- Status: **Accepted** (answers given by the project owner in chat, 2026-10-27)
- Answers:
  1. **One Notifications list:** there is one in-app "Notifications" list. Invitations, Head
     Coach permission requests and "no longer linked" messages all appear there.
  2. **Draft reminder:** before an unfinished draft is auto-cleared (D-14), the app shows a
     reminder 3 days earlier: "You have an unfinished meal entry. It will be removed in 3 days."
  3. **Long-term scale — an aspiration, not a proven capacity target:** FitSphere aims to
     support up to 20 million users. Phase 1 starts on free tiers. ADR-0002 and ADR-0003 must
     explain how the chosen backend and database can grow toward this without a rewrite, and
     what it would cost at each stage.
- Doc changes: REQ-ROLE-009/013 and the "no longer linked" criteria name the Notifications list;
  REQ-NFR-003 (aspiration) and REQ-NFR-004 (reminder) updated; quality targets; product brief
  goals; ADR-0002, ADR-0003 and ADR-0007 inputs; glossary; journeys J-08 and J-09.

## D-16 Media, external links, phase-1 hosting plan and owner access (answers Q-041, Q-088, Q-092; partly answers Q-064, Q-089)
- Status: **Accepted** (answers given by the project owner in chat, 2026-10-27)
- Answers:
  1. **View-only media:** media is view-only in the app. Users view photos and play media; there
     is no download feature.
  2. **External links (YouTube and other public links):**
     - Coaches may add YouTube links for exercise how-to videos. In phase 1 a how-to is a
       coach-provided YouTube link, unlisted or public (answers Q-041).
     - Trainees may also add YouTube or other public links for their own videos and photos.
       Before saving, the app shows a privacy warning, e.g. "Anyone who has this link can view
       it, even if you later remove your coach. FitSphere cannot delete content stored on
       YouTube or other sites." The user must confirm to continue (answers Q-092).
     - When a link between people ends, FitSphere hides the external link from the former coach
       or Head Coach, but cannot revoke access to the content itself. Accepted risk R-004;
       invariant #1 states this exception; threat-model entry T-09; note for Legal (Q-049).
  3. **Phase-1 hosting plan (answers Q-088):** use the Supabase **Free** plan only, with no
     backups in this release. Supabase Pro is **not approved** now; it may be approved later
     (C-008). Accepted risk R-005: no backups (data loss possible); the project may pause after
     1 week without activity; limits of 500 MB database and 1 GB files. This **conflicts with
     D-14** ("the server is the permanent record"); the conflict is recorded in R-005.
     - Owner-review triggers to move to Pro or add backups: database over 400 MB; files over
       800 MB; monthly active users near 50,000; monthly viewing traffic (egress) over 4 GB of
       the 5 GB free allowance; any pause; any data-loss incident.
     - If the project pauses, the owner resumes it from the Supabase dashboard
       ([`runbook.md`](../operations/runbook.md)).
     - This sets the plan level only. It does not accept ADR-0002 or ADR-0003, which stay
       Proposed.
  4. **Meal photos in phase 1 (partly answers Q-064):** a user can (a) upload a photo, stored as
     a compressed viewable copy of about 200 KB (phone-viewable quality) plus a small thumbnail
     for lists, or (b) paste a public link to an image, with the same privacy warning as in
     answer 2. Viewed photos are cached on the device under the device rules (D-10, D-13, D-14),
     so repeat views use no egress. Capacity estimate: about 5,000 photos fit in the 1 GB of
     free file storage (fewer once thumbnails are counted).
  5. **Voice meal recordings in phase 1:** transcribe, then delete the audio. Audio storage is
     future scope.
  6. **Retention (input to Q-089):** never fully delete a user's own media while the account
     exists; originals may be replaced by a viewing-quality copy.
  7. **Owner access:** two-factor sign-in on Supabase and Google Cloud. The owner never browses
     user data in dashboards; any needed access goes through a logged admin path
     (REQ-NFR-005). R-003 is extended with the remaining dashboard risk.
  8. **ADR-0002 and ADR-0003 revisions (both stay Proposed):**
     - The device media cache follows D-10, D-13 and D-14 (encrypted, removed when a link
       ends, cleared after 30 days without a sync). Media links have a short maximum expiry
       and a threat-model entry (T-08).
     - Encryption at rest is a Must (REQ-NFR-002).
     - Supabase's auto-generated Data API is switched off or denies all app tables, so the
       Node API is the only path to the data.
     - Supabase Auth is only a candidate. The sign-in decision moves to ADR-0004, which must
       verify neutral messages and equal timing (REQ-ACC-010, T-01) and email from a sender
       domain with SPF, DKIM and DMARC (Q-082, D-13).
     - Growth paths start on the Free plan (R-005); Pro is a later stage, reached when a
       trigger is hit. A capacity and cost model is required before stage 3, started at
       250,000 monthly active users (D-15), instead of invented figures.
     - Each ADR lists its open questions and how each is handled, as ADR-0001 did.
     - Links are never deleted except as the delete-account flow decides (Q-048).
     - API logs and monitoring exclude health data (invariant #7).
     - AI consent is checked immediately before each AI call, not when an upload link is
       issued (invariant #3).
- **Interpretation (confirmed by the owner, 2026-10-27):** phase 1 has no video feature for
  trainees (audio and video are future scope), so in phase 1 trainees' public links (answer 2)
  are for meal photos only (answer 4). Video links apply once the audio/video release adds video.
- **Interpretation (confirmed by the owner, 2026-10-27):** "never fully delete" (answer 6)
  applies to automatic retention only. A user may delete their own meal photo or nutrition-label
  image, and it is really removed (A-004, Q-064). Account deletion stays with Q-048.
- **Confirmed by the owner (2026-10-27):** media viewing links expire after at most 5 minutes.
  Supabase's 2-hour upload links are accepted as a known limitation — each allows uploading
  one file to one path and gives no viewing access (T-08).
- Doc changes: invariant #1; REQ-LOG-005, REQ-LOG-006, REQ-TRN-001, REQ-NFR-001, REQ-NFR-004
  and REQ-NFR-005 updated; REQ-LOG-010 (public links) and REQ-NFR-006 (view-only media) added;
  Q-041, Q-088 and Q-092 answered; Q-064 and Q-089 partly answered; notes on Q-038, Q-049 and
  Q-087; Q-082 also blocks ADR-0004; C-008; R-003 extended, R-004 and R-005 added; threat model
  (data categories, matrix, T-07 updated, T-08 and T-09 added, retention, open risks); system
  context; glossary; journeys J-01 and J-06; product brief Future scope;
  `docs/operations/runbook.md` created; ADR-0002 and ADR-0003 revised; decisions index.
  Confirmations applied to REQ-LOG-006, REQ-LOG-010, A-004, Q-064, T-08, retention, ADR-0002,
  ADR-0003 and the ADR-0007 inputs.

## D-17 ADR-0002 and ADR-0003 accepted
- Status: **Accepted** (answer given by the project owner in chat, 2026-10-27)
- Answer: the owner accepts risks R-004 and R-005 and marks ADR-0002 (backend and hosting) and
  ADR-0003 (primary database) **Accepted**: a TypeScript Node.js API that is the only path to
  the data, with Supabase PostgreSQL and file storage in Mumbai, on the Free plan in phase 1
  (D-16). Supabase Auth is still pending ADR-0004.
- Each ADR keeps its validation steps for the first slice and its revisit conditions,
  including ADR-0007 finding no workable offline-sync approach with PostgreSQL.
- Accepted while these are still open; each ADR's "Open questions and how each is handled"
  table says how each is handled: Q-049, Q-050, Q-082, Q-083 and Q-087 (ADR-0002); Q-014, Q-030
  and Q-048 (ADR-0003); Q-064 and Q-089, both partly answered (both ADRs).
- Doc changes: ADR-0002 and ADR-0003 status, decision and validation sections; decisions index;
  `CLAUDE.md` current phase; `README.md`; docs index; system context; `flow.md`; constraints
  (quality targets, suggested first slice, major decisions, R-004, R-005).

---

## Proposed replacement wording for the two invariants
*(Approved by the owner and applied to `.claude/rules/project-invariants.md` on 2026-10-27.
Invariant #1 was later updated for D-10, D-13 and D-16; the rules file holds the current wording.)*

- **Invariant #1 (new):** Authorization is server-side. A user can access another person's
  data only through an **accepted** link: Coach → their accepted trainees; Head Coach → their
  accepted coaches and those coaches' trainees. Head Coaches may view and edit those trainees'
  plans (D-08). Removing a link removes access (D-07). UI hiding is not access control.
- **Invariant #5 (new):** Phase 1 serves India only. "Today" and day membership use
  Asia/Kolkata, never server local time. Store timestamps in UTC, and store the day the user
  chose (REQ-LOG-002) as its own field — never derive it from the timestamp alone.

---

## Follow-up questions raised by these answers
Added as Q-068 to Q-077 (F-01 → Q-068 … F-10 → Q-077). F-02, F-03, F-07 and F-09 are
answered in D-10.

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