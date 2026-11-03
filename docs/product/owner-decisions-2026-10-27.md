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
  one file to one path and gives no viewing access (T-08). *Amended by D-27: upload links last
  10 minutes (600 seconds).*
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

## D-18 MVP first; ADR-0004 to ADR-0007 accepted (answers Q-038, Q-059, Q-066, Q-068 and T-05; sets MVP defaults)
- Status: **Accepted** (owner instruction in chat, 2026-10-27; [`mvp-scope.md`](mvp-scope.md)
  Accepted). Answers 11 to 13 are the owner's confirmations, given later the same day. Answer 14
  was given on 2026-10-28 with the approval of the Skeleton slice plan.
- Answers:
  1. **MVP first:** "deliver the basic requirements; don't ask deep edge cases; cover missed
     edge cases in future releases." Build the basic product in `mvp-scope.md` section 2,
     Android first. Its section 3 lists what is post-MVP; every other requirement stays in the
     MVP.
  2. **MVP defaults:** the defaults in `mvp-scope.md` section 4 answer those open questions for
     the MVP. Any can be changed later.
  3. **Unanswered questions:** when an open question that does not block safety or privacy has
     no answer, Claude Code picks the simplest option that keeps every invariant, records it as
     an "MVP default" in the pull request and in
     [`constraints-and-assumptions.md`](../architecture/constraints-and-assumptions.md#mvp-defaults-d-18),
     and continues without asking the owner.
  4. **Still need the owner:** the invariants, D-01 to D-17, privacy rules and accepted ADRs are
     never weakened without the owner.
  5. **Backlog:** post-MVP items and deferred edge cases are listed in [`backlog.md`](backlog.md).
  6. **ADR pre-approval:** ADR-0004 to ADR-0007 are Accepted if checking them against the
     requirements, invariants, threat model, D-01 to D-18 and ADR-0001 to ADR-0003 finds no
     conflict that touches privacy, security or a D- decision. Small inconsistencies are fixed in
     the ADRs first. A conflict that does touch one goes to the owner.
  7. **Voice (answers Q-038; owner's answer to the one conflict the check found):** a phone's
     built-in speech service may send the voice to its provider's servers before FitSphere's
     server can check consent (invariant #3, C-004). Answer: **on-device recognition only.** The
     voice never leaves the phone; only the text is used, and it reaches AI only after the
     server's consent check. On a phone that cannot recognise speech on the device, the
     microphone button is hidden.
  8. **Coach view (answers Q-059):** a Coach sees their trainees' logs, read-only: meals (with
     photos and image links), weight, steps, sleep, measurements (with notes), workouts and
     Progress. Not saved meals; never settings or AI consent (D-13). A Head Coach sees the same
     for trainees who allow it (REQ-ROLE-004, REQ-ROLE-013). Legal confirms before real users
     (Q-049).
  9. **Web dashboard (answers Q-068):** none in the MVP; it is post-MVP.
  10. **ADR-0004 to ADR-0007 Accepted** under answer 6, with answers 7 and 8 and the small fixes
      applied in the same change: sign-in with Supabase Auth, email through Resend, Expo push
      (ADR-0004); Gemini 3.1 Flash-Lite on the paid tier (ADR-0005); FitSphere's own food list
      plus Open Food Facts (ADR-0006); own simple sync with Expo SQLite (ADR-0007).
  11. **Owner confirmations:** the owner accepts all 15 MVP defaults chosen under answer 3 (listed
      in [`constraints-and-assumptions.md`](../architecture/constraints-and-assumptions.md#mvp-defaults-d-18)),
      confirms the four interpretations below, and accepts the invariant #8 update.
  12. **Minimum age (answers Q-066 for the MVP):** users must be 18 or older. Sign-up requires an
      "I am 18 or older" confirmation. Use by people under 18 is post-MVP
      ([`backlog.md`](backlog.md) B-16); what it would need is for Legal (Q-049).
  13. **Who can accept an invitation (answers T-05):** an invitation can be accepted only by an
      account with the invited email address.
  14. **Skeleton slice (2026-10-28):** the owner approved
      [`docs/plans/skeleton-slice.md`](../plans/skeleton-slice.md), with these answers:
      - **Minimum password length: 8 characters.** No character-type rules. A security setting,
        so the owner's answer was needed under answer 4 (REQ-ACC-010).
      - **The Expo push check stays in the Skeleton**, as D-13 answer 9 requires. It needs a free
        Firebase project, with its FCM credentials uploaded to Expo (ADR-0001 step 7).
        *Superseded by D-20: the push check is post-MVP (backlog B-23).*
      - **Integration tests on the PC use PostgreSQL 17 installed natively**, not Docker Desktop.
      - **Each step goes on its own branch with a pull request; CI must pass before merge.**
- **Interpretation (confirmed, answer 11):** nutrition-label photos are input for reading, like voice
  recordings (D-16 answer 5), not stored media. Deleting them after reading (Q-064 default)
  therefore does not conflict with D-16 answer 6.
- **Interpretation (confirmed, answer 11):** the delete-account default (Q-048) keeps only the security logs
  required by REQ-NFR-005, so Head Coach permission answers are deleted with the account. This
  is the provisional answer to the period left open in D-13 answer 8; Legal confirms (Q-049).
- **Interpretation (confirmed, answer 11):** Q-035 and Q-048 are answered for the MVP, so REQ-PLAN-006 and
  REQ-ACC-009 are no longer blocked and leave invariant #8. Real users still wait for Legal
  (Q-049).
- **Interpretation (confirmed, answer 11):** ADR-0007 keeps the last 90 days of a user's own data on the
  phone and loads older history from the server when it is viewed online. This is read as
  meeting D-14 ("the app restores it from the server"): the full history stays on the server and
  can be viewed on any phone, and only entries already synced age out of the phone.
- Not given an MVP default, because they touch privacy, security or the law: minimum age
  (Q-066) and whether sign-up must use the invited address (T-05), both since answered by the
  owner (answers 12 and 13); Legal's review (Q-049), still open.
- Doc changes: `backlog.md` created; MVP defaults section and Q- items marked in
  `constraints-and-assumptions.md` (A-001, A-004, A-006, A-009, C-008, quality targets);
  requirements marked MVP default or Post-MVP, REQ-PLAN-006 and REQ-ACC-009 unblocked,
  REQ-ROLE-016, REQ-ROLE-017, REQ-PLAN-008, REQ-TRN-006 and REQ-TRN-007 added; invariant #8;
  threat model (matrix, T-01 to T-07, retention); ADR-0004 to ADR-0007 fixed and accepted;
  decisions index; `CLAUDE.md`; `README.md`; docs index; system context; `flow.md`; journeys;
  product brief; glossary. For answers 11 to 13: REQ-ACC-010, REQ-ROLE-008 and REQ-ROLE-009;
  threat model (account data, invitations, T-05, open risks); constraints (MVP defaults, Q-049,
  Q-066); backlog B-16; ADR-0004 open-questions table; decisions index; `flow.md`; journeys;
  product brief. For answer 14: `docs/plans/skeleton-slice.md`; REQ-ACC-010; runbook (local
  setup); `CLAUDE.md` current phase; docs index.

## D-19 Development on the phone with EAS Build (changes the Skeleton plan; opens Q-093)
- Status: **Accepted** (owner instruction in chat, 2026-10-28). It changes the Skeleton plan
  approved in D-18 answer 14 and how ADR-0001 is validated, and narrows D-10's "emulator and an
  Android phone" to the phone.
- Answers:
  1. **No Android Studio, emulator or local Android builds.** JDK 17 and the Android SDK are no
     longer needed. The owner keeps only Android's platform-tools (`adb`).
  2. **Development builds come from EAS Build** (cloud, `development` profile). They are installed
     on the owner's OnePlus Nord CE4 from the EAS link or QR code. Rebuild only when native code
     changes, and stay within the free plan (15 Android builds a month). Claude Code tells the
     owner before each cloud build.
  3. **Live code:** `npx expo start --dev-client --tunnel`, because the owner's Wi-Fi blocks
     traffic between devices.
  4. **API access from the phone during development:** Claude Code proposes the safest free
     option (a development-only tunnel to the API on the PC, or Cloud Run early), with its
     security trade-offs, and the owner chooses (Q-093, open). Production API rules are
     unchanged.
  5. **Device checks:** every emulator check in the Skeleton plan moves to the phone. A check
     that truly needs a cable is marked "USB + adb".
  6. **The API from the phone (answers Q-093; given later on 2026-10-28):** a development tunnel
     to the API on the PC, **only while testing, with test data only, and closed after use**.
     The tunnel's address is never committed. The owner left the tool to Claude Code, which
     picked Cloudflare's Quick Tunnel (`cloudflared`): free, no account needed; each run gets a
     new `trycloudflare.com` address, which stops working when `cloudflared` stops (Cloudflare's
     docs, read 2026-10-28). Not chosen: USB with `adb reverse` (needs the cable for every
     check that calls the API) and Cloud Run early (needs billing, Q-087). Start and stop:
     runbook step 8. CI fails if a Quick Tunnel address is committed.
- Checked with this decision (2026-10-28):
  - In Expo CLI 58.1.16, as installed, `--tunnel` uses Expo's own tunnel service, which needs the
    developer signed in to an Expo account. ngrok is used only with `--tunnel ngrok`. This was
    read from the installed CLI's source. While the tunnel runs, the development server has a
    public address; it serves the app's code, which holds only publishable `EXPO_PUBLIC_` values.
  - `developmentClient: true` makes EAS run Gradle's `:app:assembleDebug` (Expo's eas.json
    reference). The debug manifest that Expo SDK 58 generates allows plain HTTP; the main
    manifest does not, so release builds do not (seen in a local `expo prebuild`).
  - By default, EAS CLI leaves out of the upload every file that `.gitignore` excludes (Expo's
    ".easignore" page), so `apps/mobile/.env` is not uploaded. A development build gets its code
    and `EXPO_PUBLIC_` values from the PC's development server, not from the build.
- Doc changes: `docs/plans/skeleton-slice.md` (steps 2, 3, 6–8, 10–11, verification, tools,
  risks); runbook (what is needed, EAS and the phone, running the app); ADR-0001 (consequences,
  validation step 1); test strategy (device checks, tools); constraints (suggested first slice,
  Q-093); system context (EAS Build); `CLAUDE.md` current phase; docs index; `apps/mobile`
  (`eas.json`, `start` script, `.env.example`). For answer 6: runbook (what is needed, step 8,
  configuration names, references); Skeleton plan (decisions 1 and 8, step 2, risks); test
  strategy (tools); constraints (Q-093); `CLAUDE.md`; `apps/mobile/.env.example`; CI (a check
  that no Quick Tunnel address is committed).

## D-20 The MVP is the Personal Training User view only (amends D-18's MVP scope and the Skeleton plan)
- Status: **Accepted** (owner instruction in chat, 2026-10-28). It amends D-18 answer 1 (what the
  MVP includes, [`mvp-scope.md`](mvp-scope.md) section 2) and answer 14 (the Skeleton plan),
  moves the push check that D-13 answer 9 placed in the first slice to post-MVP, and extends the
  Q-016 MVP default.
- Answers:
  1. **The MVP delivers only the Personal Training User view.** Coach and Head Coach are
     post-MVP: their roles, invitations, links, Head Coach permission, the Notifications list and
     push notifications ([`backlog.md`](backlog.md) B-17 to B-22).
  2. **Users set their own targets:** daily calories, daily protein, daily steps, weekly workouts
     and target body weight. This extends the Q-016 MVP default, which covered calories and
     protein only.
  3. **Diet plan tab:** an empty state, "No diet plan yet. Your coach will add one here."
     **Training tab:** "No training plan yet", "Start an empty workout" and the workout history.
  4. **The role selector is hidden in the MVP;** every account is a Personal Training User.
  5. **Links later, without rework:** the data model stays able to add links, but no link or
     permission features or screens are built now. Authorization tests cover self-access only,
     plus cases showing that no other user's data can be read or written.
  6. **Still required at release:** Resend, with a domain FitSphere owns, for the sign-up and
     password-reset emails (ADR-0004).
  7. **Skeleton plan:** step 11 (push check) and step 12 (iOS compile check) move to the backlog
     (B-23, B-24), and step 9 is simplified to self-access. Step 12's close-out tasks move to
     step 10.
  8. **MVP slices, in this order:** 1 Skeleton, 2 Home and daily tracking, 3 Meal logging (no AI),
     4 Training, 5 Progress, 6 Settings and account, 7 AI meal reading, 8 Release
     ([`mvp-scope.md`](mvp-scope.md) section 5).
- Unchanged: the invariants, the other D- decisions, privacy rules and the accepted ADRs.
  Invariant #2 still holds: in the MVP every target is set by the user, and targets a coach sets
  stay read-only for the trainee once coaches exist. The ADRs' decisions stand; only the
  validation steps that check post-MVP features move with those features: ADR-0001 steps 5 and
  7, ADR-0002 step 4 (its link cases), ADR-0004 steps 4 to 6, and ADR-0007 steps 2 and 3.
- **Interpretation (confirmed by the owner, 2026-10-28: "keep the link tables")** of answer 5:
  - The Skeleton's migration still creates `user_roles`, `links` and
    `head_coach_permission_answers` as in the [data model](../contracts/data-model.md), and
    ADR-0003's link checks (a), (b) and (d) still run in step 4, because they show the schema can
    hold links. In the MVP, nothing but those database tests writes `links` or
    `head_coach_permission_answers`.
  - Routes that read a user's data keep the user's ID in the path (for example
    `GET /v1/users/{userId}/weigh-ins`): in the MVP only the user gets their data, and anyone else
    gets `404`. Coach access is added later as new rules in the access module, not new routes.
  - Targets record who set them and when, so coach-set targets can be added later and kept
    read-only for the trainee (invariant #2).
- **MVP default (D-18 answer 3):** which REQ IDs each slice covers ([`mvp-scope.md`](mvp-scope.md)
  section 5). Each slice's plan confirms its scope with the owner before work starts.
- Doc changes: `mvp-scope.md` (status, sections 1–5); requirements (Coach and Head Coach REQs and
  coach parts marked Post-MVP; REQ-ROLE-007 extended); `backlog.md` (B-17 to B-24, E-05 closed);
  threat model (MVP scope of the matrix and threats; own targets); `docs/plans/skeleton-slice.md`
  (steps 9, 11 and 12, decisions 4 and 5, tools, risks, close-out); test strategy (authorization
  table, device checks); data model (roles, links, permission answers, targets); API
  conventions (the weigh-ins route, Resend); runbook (Resend); constraints (A-005, Q-005, Q-008,
  Q-013, Q-016, Q-034, Q-035, Q-073, MVP defaults, R-002, suggested first slice); ADR-0001,
  ADR-0002, ADR-0004 and ADR-0007 (a note on their validation steps; ADR-0004's Q-082 row);
  product brief; user journeys; `CLAUDE.md`; `README.md`; docs index.

## D-21 Skeleton steps run back to back (amends D-18 answer 14 and the Skeleton plan's workflow)
- Status: **Accepted** (owner instruction in chat, 2026-10-28, after step 2 was merged).
- Answers:
  1. **Steps 3 to 10 run back to back.** Each step still has its own branch and pull request.
     Claude Code does not wait for the owner between steps that need nothing from the owner, and
     opens each pull request once its checks pass.
  2. **Work stops only when the owner is needed:** something in Supabase or the owner's accounts,
     a phone check, a cloud build, or a decision that touches privacy, security or a D- decision.
     Questions are batched. Each stop lists the pull requests to merge, the phone checks with
     exact steps, and what is needed from the owner.
  3. **Open questions follow D-18 and D-20:** the simplest MVP default, recorded, with no
     edge-case questions.
  4. **The owner starts and stops the API, the tunnel and Expo;** Claude Code does not.
- Unchanged: CI must pass before merge, the owner merges, and every phone check is run and
  recorded before its step counts as done.
- Doc changes: `docs/plans/skeleton-slice.md` (decision 2, progress); `CLAUDE.md` current phase.

## D-22 Skeleton closed with deferred checks; security clean-up before release (amends D-21)
- Status: **Accepted** (owner instruction in chat, 2026-10-29, after the phone checks that day).
- Answers:
  1. **Security clean-up, deferred and release-blocking** (backlog RB-01 to RB-03; `CLAUDE.md`
     "Before real users"): delete the GitHub copy of the branch `local/test-no-email`, which
     holds a test password; delete the Supabase test user that uses that password; make sure
     Supabase **Confirm email** is on. Not done now.
  2. **The pending Skeleton phone checks move to before the release** (backlog SC-01 to SC-13,
     each linked to its ADR and step) and are marked pending in the ADRs and the Skeleton plan.
     Accepted risk **R-006**: the Skeleton pull requests are merged with these checks pending.
  3. **The Los Angeles time-zone check is dropped for the MVP**, which serves India only (D-09):
     Skeleton step 3's phone check and step 10's check 5 (ADR-0007 step 5). Post-MVP, backlog
     B-25.
  4. **Merge now.** Claude Code merges pull requests #3 to #10 in step order, each only with
     green CI and without forcing, then deletes the merged branches. The owner's local branch
     `local/test-no-email` stays untouched.
  5. **`npm run dev:phone`**, one command that starts the API, the tunnel and Expo and writes
     the tunnel's address into `apps/mobile/.env`, is built in the next slice.
- Amends D-21: phone checks still pending no longer stop a Skeleton step from counting as done,
  and Claude Code merges the Skeleton pull requests at the owner's instruction (D-21: the owner
  merges). CI must still pass before every merge.
- Doc changes: `docs/product/backlog.md`; `docs/architecture/constraints-and-assumptions.md`
  (R-006); "Validation results" in ADR-0001, ADR-0002, ADR-0004 and ADR-0007;
  `docs/plans/skeleton-slice.md` (done with deferred checks); `CLAUDE.md` (current phase,
  "Before real users"); `docs/README.md`.

## D-23 Home and daily tracking slice plan approved
- Status: **Accepted** (owner approval in chat, 2026-10-29).
- Answers:
  1. **Slice 2 plan approved:** [`docs/plans/home-daily-tracking-slice.md`](../plans/home-daily-tracking-slice.md),
     with its scope, its MVP defaults chosen under D-18 answer 3, and its seven steps.
  2. **Workflow as D-21:** steps run back to back, with one branch and one pull request each, CI
     green before merge, and the owner merging. The phone checks are batched at the end of the
     slice.
  3. **`npm run dev:phone`** (D-22 answer 5) is step 1.
- Amended by D-34 answer 9 (2026-11-03): the tabs, first text labels only (the slice plan's MVP
  default), show an icon over each label.
- Unchanged: the invariants, the other D- decisions, privacy rules and the accepted ADRs.
- Doc changes: `docs/plans/home-daily-tracking-slice.md`; `CLAUDE.md` current phase;
  `docs/README.md`. The MVP defaults are added to `constraints-and-assumptions.md` in the step
  that builds each one.

## D-24 Measurements card shows and edits a date's measurements (changes the Q-026 MVP default)
- Status: **Accepted** (owner instruction in chat, 2026-10-29; implementation plan approved the
  same day).
- Changes the owner's Q-026 MVP default in [`mvp-scope.md`](mvp-scope.md) section 4 ("hidden once
  both waist values are logged for the current Mon–Sun week"), and D-23's reading of it (the
  selected date's week). REQ-HOME-008 is updated.
- Answers:
  1. **The Measurements card stays on Home.** It is no longer hidden once both waist values are
     logged for a week.
  2. **It shows the selected date's measurements:** upper and lower waist, any optional values
     entered, and the notes, in the cm/in unit last chosen on the phone. With no entry for that
     date, it shows "Add measurements" and the weekly waist prompt.
  3. **"Edit measurements"** opens the sheet pre-filled with the saved values, optional values
     and notes included. Saving updates that date's entry: one entry per date (Q-030), never a
     duplicate.
  4. **A correction stays with its date.** In Edit the sheet's date is fixed, so editing a past
     date never changes another date's entry (MVP default chosen under D-18 answer 3 with this
     decision). Add keeps the date selector (REQ-MEAS-002).
  5. **Unchanged:** validation (Q-028), the cm/in units, offline logging and sync (ADR-0007).
     No server, schema or API change is needed.
- Unchanged: the invariants, the other D- decisions, privacy rules and the accepted ADRs.
- Doc changes: `mvp-scope.md` (Q-026); `requirements.md` (REQ-HOME-008);
  `constraints-and-assumptions.md` (Q-026, MVP defaults); `docs/plans/home-daily-tracking-slice.md`
  (step 8, phone check 5); `user-journeys.md` (J-04); `CLAUDE.md`; `docs/README.md`.

## D-25 The IFCT 2017 food list is used without NIN permission (accepted risk R-007)
- Status: **Accepted** (owner decision in chat, 2026-10-29).
- Decides the food-list licence question that ADR-0006 left open ("blocks release, not
  development").
- Answers:
  1. **FitSphere uses the IFCT 2017 food list** (`data/foods/ifct2017-foods.csv`, described in
     [`docs/data/food-list-sources.md`](../data/food-list-sources.md)) in development and in
     release builds.
  2. **The owner will not seek permission from the National Institute of Nutrition (NIN).** The
     condition quoted in `food-list-sources.md` asks for NIN's written permission before the data
     is stored or reproduced electronically to create a product.
  3. **The owner accepts the risk** as R-007 in `constraints-and-assumptions.md`. The NIN licence
     is not a release blocker.
  4. **The app shows the IFCT acknowledgement text** given in `food-list-sources.md` wherever
     IFCT values are shown.
- Unchanged: the invariants, the other D- decisions, privacy rules and the accepted ADRs.
  ADR-0006's decision stands; it now notes that its licence question was decided here.
- Doc changes: `docs/data/food-list-sources.md`; `constraints-and-assumptions.md` (R-007, Q-039);
  `backlog.md`; ADR-0006; `docs/README.md`; `CLAUDE.md` (sources of truth).

## D-26 Meal logging slice plan approved; photos move into slice 3; dishes and oil energy
- Status: **Accepted** (owner approval in chat, 2026-10-29; the dish and oil answers were given
  while planning). **Answer 3 amended** by the owner in chat on 2026-10-30.
- Answers:
  1. **Slice 3 plan approved:** [`docs/plans/meal-logging-slice.md`](../plans/meal-logging-slice.md),
     with its scope, its MVP defaults chosen under D-18 answer 3, and its nine steps.
  2. **Meal photos and public image links move into slice 3** (REQ-LOG-006 for meal photos,
     REQ-LOG-010), from slice 7. Label photos and AI reading stay in slice 7. Until then, the
     free-text, voice and photo-reading box shows "AI meal reading is coming soon".
  3. **Cooked dishes: raw portions from FitSphere's standard-recipe sheet** (amended
     2026-10-30; the original answer follows the new one).
     - **Values (unchanged):** a dish's values are IFCT's values per 100 g × the raw grams of
       each ingredient, marked "estimated".
     - **Source (changed):** a dish such as "1 roti" is defined only by IFCT raw ingredients and
       their raw grams for one portion (one exception, next), from FitSphere's standard-recipe
       sheet, [`docs/data/standard-recipe-sheet.csv`](../data/standard-recipe-sheet.csv). The
       sheet is written by weighing raw ingredients, and the owner approves it. It replaces an
       outside document quoted with its page.
     - **Exception, cooked IFCT entries:** where IFCT publishes a cooked value for the whole item
       (M004 boiled egg), that value is used per gram of the cooked item, and the sheet records the
       cooked grams per piece.
     - **Omelette:** raw whole egg (M001) plus the oil weighed per omelette, like other dishes. It
       does not use IFCT's omelette (M007): the IFCT 2017 book does not say how M007 was prepared
       or whether it includes oil.
     - **Chicken curry: do not fill** until IFCT's poultry values are confirmed raw. The IFCT
       tables do not say whether N002 and N003 are raw or cooked, and the book's general text says
       "All data except for poultry and egg pertains to raw food" (printed page xx;
       `food-list-sources.md`).
     - **Not used as a source:** NIN's *Dietary Guidelines for Indians* (any edition), data from
       the Indian Nutrient Databank (INDB) and data from USDA FoodData Central. Why each was
       considered and not used: [`food-list-sources.md`](../data/food-list-sources.md).
     - **Portion units:**
       - per piece for roti, phulka, paratha, puri, idli, dosa, egg and omelette;
       - per katori for every other dish, with 1 katori = 200 ml, the size NIN's 2024
         guidelines call medium;
       - half portions allowed: 0.5 to 10 in halves, as the meal contract already accepts.
     - **Deferred, not dropped:** curd and raita, masala chai, besan dishes and chole (backlog
       B-26). The IFCT list has no curd, white sugar, tea or besan, and B002 "Bengal gram, whole"
       does not say which chickpea it is.
     - **Portions only:** a dish is logged by portion count only. There are no per-100 g cooked
       values and no logging by cooked weight, since those would need yield factors.
       REQ-LOG-008's example "cooked rice weighs about 3× raw" has no supporting source: it is
       flagged there as unsupported and removed from the Log meal screen's tips.
     - **The owner's OK** on the sheet is the merge of the slice's dish pull request.
     - *Original answer (2026-10-29), replaced:* a dish such as "1 roti" is defined only by IFCT
       raw ingredients and grams, quoted word for word with the page from a document the owner
       approves. No document read on 2026-10-29 and 2026-10-30 gave the raw grams for one dish
       portion under terms that allow use in the app.
  4. **Oils and fats: 9 kcal per g of fat**, the Atwater general factor (FAO Food and Nutrition
     Paper 77, 2003), marked "estimated". IFCT publishes no energy value for them.
  5. **New packages**:
     - app: `expo-camera`, `expo-image-picker`, `expo-image-manipulator`, `expo-file-system`;
     - API: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, for the S3 interface of
       ADR-0002 rule 4.

     One EAS development build covers them, and Claude Code asks the owner before starting it
     (D-19).
  6. **Workflow as D-21**, with the owner's actions and phone checks batched at the end.
- Unchanged: the invariants, the other D- decisions, privacy rules and the accepted ADRs.
  If Supabase's S3 interface cannot issue presigned links, the alternative changes ADR-0002 rule
  4 and goes to the owner. Legal's review (Q-049) stays open and must be done before real users.
- Doc changes: `docs/plans/meal-logging-slice.md`; `CLAUDE.md` current phase; `docs/README.md`.
  `mvp-scope.md` and the other documents change in the step that builds each part. For the
  amendment of 2026-10-30: `docs/data/food-list-sources.md`;
  `docs/data/standard-recipe-sheet.csv` (new, every gram field empty); `docs/sources/README.md`
  (new: the NIN documents read, with hashes and terms; the PDFs stay outside the repository);
  `requirements.md` (REQ-LOG-008); `backlog.md` (B-26);
  ADR-0006 (validation results); the plan's decision 2 and step 8; `CLAUDE.md`; `docs/README.md`.

## D-27 Upload links last 10 minutes (amends ADR-0002 rule 3)
- Status: **Accepted** (owner instruction in chat, 2026-10-29).
- Answer: ADR-0002 rule 3's upload-link lifetime changes from "valid for 2 hours" to
  **10 minutes (600 seconds)**, matching the code (`UPLOAD_LINK_SECONDS`,
  `apps/api/src/storage/mediaStorage.ts`).
- Reason: the 2 hours described Supabase's own upload links, which had no shorter option. The API
  issues S3 presigned links (ADR-0002 rule 4), whose lifetime the API sets, so the limitation
  accepted in D-16 no longer applies. A shorter link narrows the time a leaked upload link works.
  Each link still allows one JPEG to one path and gives no viewing access.
- Checked on `fitsphere-dev`, 2026-10-29: `npm run check:storage` passed 8 of 8.
- Unchanged: viewing links at most 5 minutes (D-16), and the rest of ADR-0002.
- Doc changes: ADR-0002 rule 3, its D-16 note and its validation results; threat T-08;
  `constraints-and-assumptions.md` (meal photos on the server).

## D-28 Dishes go live recipe by recipe, from a starter set (step 8 of the meal logging slice)
- Status: **Accepted** (owner instruction in chat, 2026-10-30).
- Builds on D-26 answer 3 (amended 2026-10-30): dishes are defined by FitSphere's measured
  standard-recipe sheet, `docs/data/standard-recipe-sheet.csv`.
- Answers:
  1. **Starter set.** The first recipes to measure: Boiled egg, Roti / chapati, Phulka, Plain
     rice, Toor dal, Moong dal, Aloo gobi, Idli and Plain dosa. The engineering is built now and
     does not wait for all 24 recipes; each dish goes live once its recipe is measured and approved.
  2. **Single IFCT foods stay in grams.** Only dishes are logged in portions (0.5 to 10, in
     halves). The app never asks a user for a recipe's ingredient weights.
  3. **INDB stays excluded**, with NIN's guidelines and USDA data: the measured-recipe method of
     D-26 answer 3 continues.
  4. **Chicken curry stays DO NOT FILL** until IFCT's poultry values are confirmed raw.
- How a recipe goes live (step 8):
  - Each row of the sheet has a `status`: `pending`, `approved` or `blocked`. `npm run
    foods:import` imports only `approved` rows, and refuses an `approved` row that is not complete
    (grams, count, `measured_by`, `date`).
  - The owner sets `approved` in the pull request that adds the measurements; the merge of that
    pull request stays the owner's OK (D-26).
  - The chicken curry row is `blocked`; the import refuses any value in it, and refuses poultry
    (IFCT group N) in any approved recipe.
  - The API serves each dish's values for one portion, never its ingredients or grams.
- Unchanged: the invariants, the other D- decisions, privacy rules and the accepted ADRs. Legal's
  review (Q-049) stays open and must be done before real users.
- Doc changes: `docs/plans/meal-logging-slice.md` (step 8); `docs/data/food-list-sources.md`;
  `docs/contracts/data-model.md`; `docs/contracts/api-conventions.md`;
  `constraints-and-assumptions.md` (MVP defaults); `backlog.md` (E-13); ADR-0006 (validation
  results); `CLAUDE.md`; `docs/README.md`.

## D-29 Training slice plan approved, built beside slice 3
*Numbered D-29 on 2026-10-30, when slice 4 was rebased onto slice 3. It was built in parallel with
slice 3 (D-26) under the temporary ID D-T1, and its backlog cases E-14 to E-17 under E-T1 to E-T4.*
- Status: **Accepted** (owner approval in chat, 2026-10-29).
- Answers:
  1. **Slice 4 plan approved:** [`docs/plans/training-slice.md`](../plans/training-slice.md), with
     its scope, its MVP defaults chosen under D-18 answer 3, and its four steps.
  2. **Built in parallel with slice 3** in a separate worktree. Shared files get small changes
     only. The server migration and the phone schema version are renumbered before merging if
     they would collide, and the migration runs on Supabase only when the owner says so. New
     decision, question and backlog IDs are temporary until merged (now D-29 and E-14 to E-17).
  3. **Workflow as D-21:** steps run back to back, with one branch and one pull request each, each
     rebased on the latest main with every check run again before it is opened, CI green before
     merge, and the owner merging. The phone checks are batched at the end of the slice.
  4. **No new native packages** without asking the owner first (cloud build, D-19); none is
     planned.
- Unchanged: the invariants, the other D- decisions, privacy rules and the accepted ADRs.
- Doc changes: `docs/plans/training-slice.md`; `CLAUDE.md` current phase; `docs/README.md`. The
  MVP defaults are added to `constraints-and-assumptions.md` in the step that builds each one.

## D-30 Progress slice plan approved, built beside slice 6
*Numbered D-30 on 2026-10-31, after slices 5 and 6 were merged (D-32). It was built in parallel
with slice 6 (D-31) under the temporary ID D-P1, and its backlog cases E-18 to E-20 under E-P1 to
E-P3; the commit messages and pull requests #41, #42 and #44 use those IDs.*
- Status: **Accepted** (owner approval in chat, 2026-10-30).
- Answers:
  1. **Slice 5 plan approved:** [`docs/plans/progress-slice.md`](../plans/progress-slice.md), with
     its scope, its MVP defaults chosen under D-18 answer 3, and its three steps. Progress only
     reads existing data: no server change, no migration and no new phone schema version.
  2. **Built in parallel with slice 6** in a separate worktree, as D-29 was beside slice 3. Shared
     files get small changes only; new IDs are temporary until merged (now D-30 and E-18 to E-20);
     each step is rebased on the latest main with every check run again before its pull request; no
     new native package without asking the owner first (none is planned; the chart is drawn with
     plain views).
  3. **Theme and units come from slice 6.** Progress takes every colour from slice 6's theme module
     and every body weight through the shared unit helpers with one unit hook, never a fixed "kg"
     or "cm". If slice 6's theme is not on main when the Progress screen is built, Progress adds the
     same module with the light colours only, and slice 6's version is kept when they meet.
  4. **Weekly rate (refines the Q-043 MVP default):** the rate is the 4-week change ÷ the weeks
     between the two weigh-ins, which is "÷ 4" when they are 28 days apart. Less than a week
     between them shows the not-enough-data message (REQ-PRG-001).
  5. **Workflow as D-21:** steps run back to back, one branch and one pull request each, CI green
     before merge, the owner merging; the phone checks are batched at the end.
- Amended by D-34 answer 6 (2026-11-03): the weight chart's ranges are 1W, 1M, 3M, 6M and All, in
  calendar months, opening on 1M (REQ-PRG-004).
- Unchanged: the invariants, the other D- decisions, privacy rules and the accepted ADRs.
- Doc changes: `docs/plans/progress-slice.md`; the Q-043 rows in `mvp-scope.md`,
  `constraints-and-assumptions.md` and REQ-PRG-001 in `requirements.md`; `CLAUDE.md` current phase;
  `docs/README.md`. The MVP defaults are added to `constraints-and-assumptions.md` in the step that
  builds each one.

## D-31 Settings and account slice plan approved, built beside slice 5
*Numbered D-31 on 2026-10-31, after slices 5 and 6 were merged (D-32). It was built in parallel
with slice 5 (D-30) under the temporary ID D-S1, its backlog cases E-21 to E-23 under E-S1 to E-S3
and its release-blocking item RB-04 under RB-S1; the commit messages and pull requests #43 and #45
to #48 use those IDs. The comments in migration `0008_settings.sql` and in `apps/api/.env.example`
still say D-S1: a migration is not edited once written (the migration runner checks each file's
checksum), and the configuration template was left as it is.*
- Status: **Accepted** (owner approval in chat, 2026-10-30).
- Answers:
  1. **Slice 6 plan approved:** [`docs/plans/settings-slice.md`](../plans/settings-slice.md), with
     its scope, its MVP defaults chosen under D-18 answer 3, and its five steps.
  2. **AI consent moves into slice 6:** the "AI meal reading" switch and its record (REQ-ACC-004:
     on or off, the server's time and the consent text's version) are built in slice 6, with no AI
     call. Slice 7 keeps the AI calls and the server's consent check before each one (invariant
     #3).
  3. **"India · Kolkata" is shown** in Settings as fixed text (D-09: the owner's choice between
     showing and hiding it). REQ-ACC-006 stays *Won't* for this release: nothing can be changed.
  4. **Deleting the sign-in account uses a Supabase secret key, on the server only.** The owner
     creates a secret key (`sb_secret_…`) and puts it in the API's configuration as
     `SUPABASE_SECRET_KEY`. Only the API's auth module uses it, for Supabase Auth's admin
     "delete user" call; it never goes in the app, logs or tests. Without it, Delete account
     answers that it is not available and deletes nothing. (Chosen over deleting the row from
     Supabase's internal `auth.users` table, and over deleting the data only.)
  5. **Built in parallel with slice 5** in a separate worktree, as D-29 answer 2: shared files get
     small changes only; migration `0008_settings.sql` and phone schema version 7, renumbered
     before merging if they collide; the migration runs on Supabase only when the owner says so;
     new IDs are temporary until merged (now D-31, E-21 to E-23 and RB-04). Slice 6 owns the theme
     and unit modules, and slice 5's Progress screens read them.
  6. **Workflow as D-21**, and **no new native packages** without asking the owner first (cloud
     build, D-19); none is planned.
- Unchanged: the invariants, the other D- decisions, privacy rules and the accepted ADRs. Legal's
  review (Q-049) covers the consent text and what account deletion deletes and keeps.
- Doc changes: `docs/plans/settings-slice.md`; `mvp-scope.md` section 5 (slices 6 and 7);
  REQ-ACC-004 and REQ-ACC-006 in `requirements.md`; J-10 in `user-journeys.md`; `CLAUDE.md`;
  `docs/README.md`. The MVP defaults are added to `constraints-and-assumptions.md` in the step
  that builds each one.

## D-32 Slices 5 and 6 merged; their phone checks deferred to before the release (amends D-30 and D-31)
- Status: **Accepted** (owner instruction in chat, 2026-10-31, after both slices were merged).
- Answers:
  1. **Merged, not checked on a phone.** Slice 5, Progress (D-30), was merged on 2026-10-30 (#41,
     #42 and #44); slice 6, Settings and account (D-31), on 2026-10-30 and 2026-10-31 (#43, #45,
     #46, #47 and #48). On the merged main (`a480dcb`, 2026-10-31) every automated check passed:
     `npm run lint`, `npm run typecheck`, `npm test` (API 109, app 440, shared 72; shared also in
     the Los Angeles time zone) and `npm run test:integration` (219). No check of either slice has
     been run on a real phone: their phone checks are **deferred, not passed**.
  2. **The phone checks move to before the release** and stay mandatory: the 7 Progress checks
     (backlog S5-01 to S5-07) and the 9 Settings checks (S6-01 to S6-09), taken unchanged from the
     two plans. Each must pass, and be recorded in its slice plan, before the MVP release; a failure
     is fixed as a defect. The phone part of ADR-0004 step 7 (deleting an account, S6-08) is
     marked pending.
  3. **Accepted risk R-006 is extended to these checks** instead of adding a new risk: a defect
     seen only on a real phone (the chart drawn with views, dark mode and System following the
     phone, the kg/lb settings, change password, account deletion) may be found only after later
     slices build on these two.
  4. **The temporary IDs are final:** D-P1 → D-30, E-P1 to E-P3 → E-18 to E-20; D-S1 → D-31,
     E-S1 to E-S3 → E-21 to E-23, RB-S1 → RB-04.
- Amends D-30 answer 5 and D-31 answer 6 (D-21): the phone checks batched at the end of each slice
  are deferred to before the release, as D-22 did for the Skeleton.
- Not changed by this decision: the owner's own steps for slice 6, the Supabase secret key
  (`SUPABASE_SECRET_KEY`, D-31 answer 4) and migrations 0006 to 0008 on `fitsphere-dev`, run only
  when the owner says so.
- Unchanged: the invariants, the other D- decisions, privacy rules and the accepted ADRs.
- Doc changes: `docs/product/backlog.md` (S5-01 to S5-07, S6-01 to S6-09); R-006 in
  `docs/architecture/constraints-and-assumptions.md`; `docs/plans/progress-slice.md` and
  `docs/plans/settings-slice.md` (merged, checks deferred); step 7 in ADR-0004; the device checks in
  `docs/quality/test-strategy.md`; `CLAUDE.md` (current phase, "Before real users");
  `docs/README.md`; the final IDs wherever the temporary ones were used.

## D-33 Changes from the owner's review of the refreshed app on a phone (2026-11-02)
- Status: **Accepted** (owner instruction in chat, 2026-11-02, on the `ui-refresh` branch).
- Answers:
  1. **An icon package.** `@expo/vector-icons` (Ionicons) is added for the header's calendar and the
     meal cards' actions: JavaScript only, its font loaded by `expo-font`, which is already in the
     development build, so no new build is needed. The tabs keep text labels only (D-23; since D-34
     answer 9, an icon over each label).
  2. **Meal actions as icons (REQ-NUT-004, Q-032).** Each logged meal shows Edit, "Save to my meals"
     and Delete as icons on the meal, in place of the "•••" menu; a saved meal shows Delete. Each
     icon is named for screen readers ("Edit Lunch: …", "Save Lunch: … to my meals", "Delete
     Lunch: …") and 44 dp to tap. Delete still asks "Delete this meal?" (or "Delete this saved
     meal?") first; Delete is red, never filled.
  3. **Log meal's date is a calendar (REQ-LOG-002, Q-037).** The date chip opens the calendar,
     titled "Log this meal to", in place of the sheet of Today, Yesterday and the five days before
     with "Another day…". The limits are unchanged: any past day of the phone's 90 days (D-23), no
     future day (Q-017). Each day with a meal has a dot, and each day is read out with its status,
     "Nothing logged" or "N meals logged" (Q-037). The header's calendar is unchanged.
  4. **Messages that say what is missing or wrong.** No limit changes; only what the app says:
     - Sign in names an empty field ("Enter your email address.", "Enter your password."); wrong
       details keep the neutral text (D-11). An address that isn't one: "Enter an email address like
       name@example.com." A password outside 8 to 72 characters: "Use 8 to 72 characters."
     - Sign up and Account setup: "Tick "I am 18 or older" to continue." under the waiting button.
     - Set a new password: a failure other than the same password or no internet says "Something
       went wrong. Try again later." instead of the password rule.
     - Measurements: "Enter both waist values to save." under Save while a waist is empty; the notes
       say "Up to 500 characters."
     - Enter your own food: under Add, the first thing missing ("Enter the food's name.", "Enter kcal,
       protein, carbs and fat to add.", or the grams rule); each value its range ("Enter 0 to 900,
       with at most one decimal.", "Enter 0 to 100, …"); the grams their rule.
     - Save to my meals: "Enter a name." for an empty name. Log meal: "Add at least one food to save
       the meal." while there is none.
     - An exercise: every field's problem at once, each under its field.
- Unchanged: what each action does, the confirmation steps, the date limits, every validation
  limit, the invariants, the other D- decisions, privacy rules and the accepted ADRs.
- Doc changes: REQ-NUT-004 and REQ-LOG-002 in `docs/product/requirements.md`; Q-032 and Q-037 in
  `docs/product/mvp-scope.md` and `docs/architecture/constraints-and-assumptions.md` (with A-004
  and the tabs' note); `docs/product/user-journeys.md`; `docs/quality/test-strategy.md`; the texts
  in `docs/contracts/error-model.md`.
- Amended by D-35 (2026-11-03): the icons are Lucide (`lucide-react-native`) in place of Ionicons
  from `@expo/vector-icons`; the switch needs `react-native-svg` and so a new development build.

## D-34 Changes from the owner's second phone review (2026-11-03)
- Status: **Accepted** (owner instruction in chat, 2026-11-03, on the `ui-refresh` branch).
- Answers:
  1. **Home's workout tracker opens a day's workouts (REQ-HOME-007).** Each day up to today can be
     tapped. One workout opens it; more than one shows the count on the dot and opens a sheet,
     "Workouts on <day>", to choose which; none opens "No workout on <day>" with "Start a workout on
     this day", which saves a workout on that day and opens it, as Training's "Start an empty
     workout" does. Later days are greyed and cannot be tapped. Each day is named for screen
     readers and is 44 dp to tap. The weekly count still counts each workout (Q-025, unchanged).
  2. **Training's history shows one card per date (REQ-TRN-004).** Workouts on the same date are
     shown together: every exercise in one summary, "2 workouts" beside the date. Tapping a card
     with one workout opens it; with more, the same "Workouts on <day>" sheet asks which. This is
     display only: each workout is still stored, synced, edited and deleted on its own, with its
     confirmation unchanged. Older workouts read from the server are grouped the same way and stay
     view-only.
  3. **The date strip shows 7 days ending today (REQ-HOME-002).** Today is the last day, so no day
     ahead is shown. Swiping and the arrows, renamed "Earlier days" and "Later days", move 7 days at
     a time, back to the 7 holding the first of the phone's 90 days (D-23). This replaces the
     Monday-to-Sunday weeks of the first swipeable strip (D-33's review, item 9). Home's workout
     tracker keeps Monday-to-Sunday weeks.
  4. **The same food added again to a meal (REQ-LOG-007).** Only in Log meal's list, while a meal
     is built or edited: adding a listed food the meal already has (the same food-list item, dish
     or barcode, in the same unit) asks "Already in this meal". "Add to existing" puts the amounts
     together in one item, its values worked out as when its grams are changed; "Keep separate",
     or closing the sheet, adds it as its own item. When together they would pass 2,000 g or 10
     portions, only "Keep separate" is offered and the sheet says why. Foods the user entered are
     never merged, and separately logged meals are not merged. Nothing changes in what is stored
     or synced: the meal is saved as one record, as before.
  5. **The calendar browses ahead (REQ-DATE-001, Q-017).** Both calendars, the header's and Log
     meal's, go forward up to 12 months. Future days, and days before the first of the 90, stay
     greyed and cannot be picked (Q-017 unchanged); tapping one keeps the calendar open and says
     "Future dates can't be chosen. Choose today or an earlier day." or "Only the last 90 days are
     on this phone. Choose a later day." Screen readers hear such a day as "not available".
  6. **The weight chart's ranges are 1W, 1M, 3M, 6M and All (REQ-PRG-004; amends D-30).** Months
     are calendar months, back to the same date or that month's last day (31 Mar back one month is
     28 or 29 Feb). The chart opens on 1M. 1W, 1M and 3M come from the phone; 3M is cut to the 90
     days the phone holds, so it works offline, which can leave it up to 3 days short of three
     months. 6M and All read older weigh-ins online as 26W and All did, with the named warning
     offline ("Showing 6 months of weight needs an internet connection."). "All" is kept. Screen
     readers hear "1 week", "1 month", "3 months", "6 months" and "All".
  7. **Nutrition's meal slots fold (REQ-NUT-003; D-33's review, item 10).** A slot with meals is
     folded at first: its kcal and number of meals ("640 kcal · 3 meals") and its foods on up to two
     lines (five names, then "+ N more"). The chevron, or the slot's heading, opens it to each
     meal's card with "Saved 8:15 am" and the Edit, Save to my meals and Delete icons. The time is
     the meal's stored `recordedAt`, the moment it was last saved (so an edit moves it), shown in
     India time; no new field is stored. The chevron is named "Show/Hide <slot> meals" and is 44 dp
     to tap. Which slots are open is kept on the screen only and resets when the day changes.
  8. **The sign-in screens have no header, and going back returns to Sign in (REQ-ACC-010).** App
     start, Sign in, Sign up, Forgot password, Reset password, Check email, Verified and Account
     setup show no "FitSphere" header; their content starts below the status bar. "Create an
     account" and "Forgot password?" open their screens on top of Sign in, so Android's back
     gesture returns to it; "I already have an account" and "Back to sign in" (also on Check email)
     go back to that Sign in rather than open a second one, and open Sign in when nothing is under
     them, e.g. after a link in an email.
  9. **The tabs show an icon over each label (REQ-NAV-001; amends D-23).** Ionicons from
     `@expo/vector-icons`: home, nutrition, barbell and stats-chart, filled for the tab shown and
     outlined for the others. The tab shown has its icon on a pill (56 by 32, radius 16, the
     theme's chosen tint) and its label in blue, semibold; the others are muted. Labels are 13 so
     they fit under the icons. Each tab keeps its name and selected state for screen readers and
     is the full tab to tap, 64 dp above the navigation bar. Theme tokens only.
  10. **Home's workout tracker names its week (REQ-HOME-007).** It shows the Mon–Sun week of the
      date picked on Home (Q-026, unchanged), so its title reads "Workouts this week" for the
      current week and "Workouts that week" for an earlier one, with the week's dates under it
      ("Mon 19 Oct – Sun 25 Oct"); with no target the count says the same ("2 workouts that week").
      As answer 1 gives, a day of an earlier week can be tapped to open or start its workouts.
- Unchanged: what is stored and synced, the confirmation steps, every validation limit, the
  invariants, the other D- decisions, privacy rules and the accepted ADRs.
- Doc changes: REQ-HOME-002, REQ-HOME-007, REQ-NUT-003, REQ-TRN-004, REQ-LOG-007, REQ-DATE-001 and
  REQ-PRG-004 and REQ-NAV-001 in `docs/product/requirements.md`; D-23's amendment; Home, Nutrition, Training, Log meal, Progress, Q-017
  and Q-019 in `docs/product/mvp-scope.md`; D-30's amendment; the chart in `constraints-and-assumptions.md`,
  `docs/plans/progress-slice.md`, `docs/quality/test-strategy.md` and backlog S5-03.
- Amended by D-35 (2026-11-03): answer 9's icons are Lucide in place of Ionicons. The redesign's
  2.1, locked by the owner on 2026-11-03, marks the tab shown with a caramel bar along its top edge
  in place of the tinted pill; its icon and label are caramel, the others muted.

## D-35 The app's design language, with Lucide icons and the Barlow fonts (amends D-33 and D-34)
- Status: **Accepted** (owner instruction in chat, 2026-11-03).
- Answers:
  1. **The design language.** `docs/design/design-system.md` and
     `docs/design/FitSphere-UI-UX-context.md` are the app's design language: palette, colour
     tokens, type, shape, components, the app-shell pattern, UX principles and copy rules. The
     `F0x-*-ui.md` files, moved to `docs/design/reference-fitsphere/`, are examples from a separate
     FitSphere spec: their features are not built and their decisions not applied here. Where a
     design file conflicts with an invariant, an owner decision or an accepted ADR, those win and
     the conflict goes to the owner.
  2. **Lucide icons** (`lucide-react-native`), as the design system names, replace Ionicons from
     `@expo/vector-icons` (amends D-33 answer 1 and D-34 answer 9). Lucide draws with
     `react-native-svg`, which has native code and is not in the current development build, so the
     switch needs a new EAS development build; the owner is told before it starts (D-19).
  3. **The Barlow fonts** are approved: Barlow Condensed and Barlow, from
     `@expo-google-fonts/barlow-condensed` and `@expo-google-fonts/barlow`. They load through
     `expo-font`, which is already in the development build, so they need no new build.
- **Interpretation:** the owner's "approved" is read as confirming two points from the same chat:
  sections 5 (locked screens), 7 (decisions) and 8 (tech choices) of the context file are
  examples only, like the F0x files; and the context file's path to the F0x files is updated and
  the design documents are added to `docs/README.md`. *(Confirm.)*
- **Interpretation:** these answers choose the look and the packages; they do not start the
  restyle. No app code changes and no package is installed until the owner asks (the owner's
  "Don't change any app code yet", 2026-11-03). *(Confirm.)*
- Unchanged: the invariants (including Asia/Kolkata for "today", invariant 5), the other D-
  decisions, privacy rules and the accepted ADRs.
- Doc changes: `CLAUDE.md` ("Design source of truth"); the README in
  `docs/design/reference-fitsphere/`; D-33's and D-34's amendment lines; the tabs' note in
  `docs/architecture/constraints-and-assumptions.md`; `docs/README.md`.
- Applied from 2026-11-03: the owner locked the redesign's first screen, 1.1 Sign in, and said to
  build it; the colours, fonts and icons switched with it (`docs/plans/ui-redesign.md`).

## D-36 Household units for a food's amount, from the owner's measurements
- Status: **Accepted** (owner instruction in chat, 2026-11-03, with the answers to two questions).
- Context: on the redesign's canvas the owner asked for a choice of unit for a food's portion
  besides grams, such as a tablespoon, a glass, half a glass or a bowl, taking HealthifyMe's serving
  choice as the reference. A unit needs the grams it holds for each food: the IFCT list gives values
  per 100 g only, and D-26 does not use NIN's household-measure tables.
- Answers:
  1. **Where the grams come from:** the owner's measured sheet, as with the dish recipes (D-26).
     FitSphere fixes its own unit sizes (for example teaspoon 5 ml, tablespoon 15 ml, glass 250 ml,
     half glass 125 ml, katori or bowl 200 ml) and the owner weighs one level measure of each food.
     A food offers a unit only once its row is measured and approved by the owner; grams stay
     available for every food. Never fill in or approve a row without the owner's measurements.
  2. **When:** after the redesign (modules 4 to 6), as its own small slice with a plan that the
     owner accepts first. *Amended by the owner, 2026-11-03: "I accept the plan… go ahead and build
     it. After that we will go for training tasks": built now, on the branch `ui-redesign`, before
     the redesign's Training module. Plan: `docs/plans/household-units.md` (Accepted).*
- *Later the same day:* asked why units are not open for every food, the owner chose to keep
  measured units only (not 1 ml as 1 g for every food, nor units the user sets), with a wider
  starter sheet: 62 rows for 52 foods, all `pending`, no grams.
- **Interpretation:** HealthifyMe is a reference for the interaction only (an amount with a unit
  beside it and the grams it comes to); none of its data or wording is used. *(Confirm.)*
- **Interpretation:** the sizes listed in answer 1 are examples; the plan proposes the units and
  sizes for the owner to approve. *(Confirm.)*
- Unchanged until the plan is accepted: grams for listed foods, barcode products and your own food;
  portions for dishes (D-26, D-28); the meal contract; the invariants.
- Doc changes: backlog B-27; the plan `docs/plans/household-units.md`; the sheet
  `docs/data/household-measures-sheet.csv`; `data-model.md` (`food_measures`, the meal item's
  amount, phone schema version 8); `api-conventions.md` (`GET /v1/foods`); `food-list-sources.md`;
  REQ-LOG-007.

## D-37 Training's button is "Log workout"
- Status: **Accepted** (owner instruction in chat, 2026-11-03, while locking the redesign's 4.1).
- Answer: the Training tab's button "Start an empty workout" is renamed **"Log workout"**. It does
  the same as before: it saves a workout with no exercises on the selected date and opens it
  (REQ-TRN-003, D-29, Q-025).
- Unchanged: the BRD's wording in `docs/product/source/business-requirements.txt` (input, not
  edited); "No training plan yet" and the rest of the tab.
- Doc changes: REQ-TRN-002 and REQ-TRN-003; `mvp-scope.md`; `user-journeys.md`;
  `constraints-and-assumptions.md`; `FEATURE_STATUS.md`; the slice-4 manual test guide.

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