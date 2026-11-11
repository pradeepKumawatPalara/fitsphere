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
     IFCT values are shown. *Changed by D-44 (2026-11-04): on the search screen it is behind an i,
     one tap away.*
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

## D-38 The profile: the user's basic details in Settings
- Status: **Accepted** (owner request in chat, 2026-11-03; answers the same day; the plan
  [`user-profile.md`](../plans/user-profile.md) approved, and the screens 6.1 and 6.6 locked, with
  "approve lock it").
- Request: Settings lets the user add and change their name, photo, address, sex, age, height,
  weight, phone number and email, with the server keeping them.
- Answers:
  1. **Email:** shown read-only; changing the sign-in email stays out of the MVP.
  2. **Age:** the date of birth is stored, and the age worked out from it; 18 or older
     (REQ-ACC-010).
  3. **Weight:** the latest weigh-in; changing it logs today's weigh-in, so Home, Progress and the
     profile agree (invariant #6).
  4. **Address and phone:** collected, both optional; private to the user, never sent to another
     service, deleted with the account. Legal reviews them before real users (Q-049).
- Built as REQ-ACC-011: migration 0010 (`app.profiles`, and `app.media.kind` for the profile
  photo), the `profile.set` sync change and the profile in the pull, phone schema version 9.
- Owner's step: run migration 0010 on `fitsphere-dev` **before** running the updated API.
- Doc changes: REQ-ACC-011 and REQ-ACC-009; the data model; API conventions; the data and threat
  model; Legal's brief; the account deletion page; `constraints-and-assumptions.md`; the plans.

## D-39 More foods: USDA's list, your own food in any unit, and My foods
- Status: **Accepted** (the owner, in chat, 2026-11-04: the request after the phone test, the choice
  of options 1 and 2, "go ahead" with the plan [`more-foods.md`](../plans/more-foods.md), and "good
  to go" locking the redesign's 3.6 and 3.8).
- Request: Search foods finds too little ("like HealthifyMe"); peanut butter bread should be logged
  by the slice; and your own food should have a unit and a quantity.
- Answers:
  1. **USDA FoodData Central's FNDDS 2021–2023** joins IFCT 2017 in the food list: 5,431 foods as
     eaten, public domain (CC0), with USDA's credit under the results. ADR-0006 rule 1 already
     allows USDA as a source with the source recorded per item, so the ADR stands. IFCT's Indian
     foods come first in search. HealthifyMe's list is its own and is not copied.
  2. **USDA's servings** ("Medium or regular slice", "1 tablespoon") are used with the grams USDA
     publishes, not measured by the owner; unlike D-36's household units, which stay measured-only.
  3. **Your own food in any unit** (the owner's addition): grams, ml, piece, slice, cup, katori, bowl,
     glass, tablespoon, teaspoon or serving; values per 100 g or ml, or per one unit; and the
     quantity eaten.
  4. **My foods** (REQ-LOG-011): your own food saved to log again, synced, editable and deletable.
- Built: migration 0011 (`app.food_portions`, `app.my_foods`, `usda_fndds` in `app.foods`), the sync
  changes `myFood.set` and `myFood.delete`, phone schema version 10, `npm run usda:convert`.
- Owner's steps: on `fitsphere-dev`, migration 0011, then `foods:import`.
- Doc changes: REQ-LOG-007 and REQ-LOG-011; the data model; API conventions; `food-list-sources.md`;
  ADR-0006's open questions; the threat model; the deletion page; Legal's brief;
  `constraints-and-assumptions.md`; the plans.

## D-40 The meal tags are hidden until coaches
- Status: **Accepted** (owner, in chat, 2026-11-04, after the phone test: "go for option 2").
- Question: what are "Before training" and "Dessert" for in Log meal, as the meal types are already
  chosen there? They are the BRD's tags on a meal (REQ-LOG-003, Q-031); in the MVP they only show as a
  label on the meal card, and their use, seeing what a client eats before training or how often they
  have dessert, is a coach's (post-MVP, D-20). Beside the meal types, they read as two more meal types.
- Answer: **hidden** in Log meal until coaches come (backlog B-28). A meal that has tags keeps them:
  its card still shows them, and editing it keeps them. A saved meal logged again from Nutrition's
  Saved tab keeps its tags, as before. The data model, contract and sync are unchanged.
- Unchanged: the BRD (`docs/product/source/business-requirements.txt`, input, not edited).
- Doc changes: REQ-LOG-003; backlog B-28; the redesign plan's 3.5; the canvas board 3.5.


## D-41 The weekly workouts card: clearer words, a number on each day, and only real workouts count
- Status: **Accepted** (owner, in chat, 2026-11-04, after the phone test).
- Question: Home's "Workouts this week" read "7 of 5 · target reached", with a tick on one day and
  "3" on two others; it made no sense to the owner. Each "Log workout" counted, even with no exercise
  (Q-025's MVP default).
- Answers:
  1. **Words:** once the target is met or passed, "7 workouts · target achieved"; below it, as
     before, "2 of 5 · 3 left".
  2. **A number on every workout day:** 1, 2, 3…, never a tick.
  3. **Empty workouts don't count** (replacing Q-025's MVP default): only a workout with at least one
     exercise counts toward the week and shows on its day. An empty workout is still saved, listed
     on Training and in its day's sheet, and counts once an exercise is added.
- Unchanged: how a workout is started and saved (D-29, D-37); the target itself (REQ-ROLE-007).
- Doc changes: REQ-HOME-007 and REQ-TRN-003; `mvp-scope.md`; `constraints-and-assumptions.md`
  (Q-025 and the Training defaults); the data model's `workouts`; the redesign plan's 2.3.


## D-42 Another workout on the same day
- Status: **Accepted** (owner, in chat, 2026-11-04, after the phone test: "User should be able to add
  Workout and inside workout there can be multiple exercises… we need this functionality").
- Problem: a day could hold several workouts, each with its own exercises (D-29), but tapping a day
  with one workout, on Home's tracker or Training's date card, opened that workout (D-34), so the
  user could only add exercises to it; another workout on that day was hidden.
- Answer: tapping a day up to today, on Home, or a date's card on Training, always opens that day's
  sheet: its workouts to open ("Workout 1 · …"), and **"Log another workout"**, which saves a new,
  empty workout on that day and opens it. A day with none still offers "Start a workout on this day".
  Training's "Log workout" button is unchanged. A weekly target of up to 14 workouts (REQ-ROLE-007)
  can therefore be met with two a day.
- Replaces: D-34's "a day with one workout opens it", on Home and on Training.
- **Then, the same day (owner, after testing it: "I need the similar option in Training tab as well…
  remove DONE… Delete Workout/Exercise on the same card as a small icon near edit icon"; the
  redesign's 4.1 and 4.2 changed and locked, "good to go"):**
  - Training's date card lists its workouts, each on its own row ("Workout 1", "Workout 2", in the
    order started) with a pencil to open it and a red bin to delete it, and "Log another workout"
    under them. Deleting asks first ("Delete Workout 2 on Tue 3 Nov? It leaves your history and your
    weekly count."). Older workouts read from the server stay view-only, with no icons.
  - A workout is titled with its place, "Workout 2 · Tue 3 Nov". Each exercise has a pencil and a red
    bin; removing asks first ("Remove Squat from this workout?").
  - **No Done:** each exercise is saved when "Save exercise" is pressed, so the workout has no Done
    button; the header's back arrow leaves.
- Doc changes: REQ-HOME-007, REQ-TRN-003 and REQ-TRN-004; `constraints-and-assumptions.md`; the
  redesign plan's 2.6, 4.1 and 4.2; the canvas boards 2.6, 4.1 and 4.2.

## D-43 The date of a new workout on Training
- Status: **Accepted** (owner, in chat, 2026-11-04, after the phone test: "When I log a Meal, I have
  calendar option on top for date selection. I need the similar on Training tab when adding a
  workout"; the redesign's 4.1 changed and locked, "good to go").
- Problem: "Log workout" logs to the app's selected date (D-29), but that date is changed only from
  the header's calendar icon, which the owner had not found, so a past day's workout seemed
  impossible to log.
- Answer: Training has a date chip above "Log workout", as Log meal's ("Today, Wed 4 Nov" with a
  calendar icon). It opens the calendar titled **"Log this workout to"**, with the same days as the
  header's (today back through the phone's 90 days; no future day). The day picked becomes the app's
  selected date, so the header shows it too, and "Log workout" logs to it. Workouts already logged,
  and editing them, are unchanged; a started workout's date stays fixed (backlog E-15).
- Doc changes: REQ-TRN-003; `constraints-and-assumptions.md`; the redesign plan's 4.1; the canvas
  boards 4.1 and 2.2.

## D-44 Search foods fills the screen; the food sources behind an i
- Status: **Accepted** (owner, in chat, 2026-11-04, after the phone test: "I need this search food in
  the full screen mode, and the instructions written below should go in a "i" icon and only be
  visible once clicked. The goal is to make the searched food list visible to the max items without
  scrolling"; the redesign's 3.6 changed and locked, "good to go", after being told this changes
  D-25 answer 4).
- Problem: Search foods was a sheet. With the keyboard up, its title, its Close button and the two
  food-source credits under the results left room for about three results.
- Answer:
  - Search foods fills the screen: a header with a back arrow ("Close search"), the title and an
    **i** ("Food sources"); the search box; then the results, down to the keyboard. There is no
    Close at the foot.
  - The credits, IFCT's ("Food values: …") and USDA's ("Foods marked USDA: …"), move into a "Food
    sources" sheet that the i opens. They are no longer on screen until it is tapped.
  - A food's amount still opens as a sheet, now over the results; "Back to search" returns to them.
- Changes: **D-25 answer 4** ("the app shows the IFCT acknowledgement text wherever IFCT values are
  shown"): the acknowledgement is now one tap away on the search screen, behind the i. The owner
  chose this knowing it is part of how the use of IFCT without NIN's permission is handled
  (R-007); Legal is asked about it (Q-049, L-09).
- Doc changes: `food-list-sources.md`; the Legal brief (L-09); `constraints-and-assumptions.md`;
  the redesign plan's 3.6; the canvas boards 3.6.

## D-45 A food's page: quantity, measure and the macronutrients breakdown
- Status: **Accepted** (owner, in chat, 2026-11-04: "on selection all the macronutritients
  breakdown should be visible", then, with two HealthifyMe screenshots, "I want it to look like
  this… ignore the image for now"; the redesign's 3.6b, new, locked, "good to go").
- Problem: choosing a food in Search foods opened a sheet showing what the amount adds as energy and
  protein only, with the units as a row of choices and − and + to count them.
- Answer: a food opens its own page, full screen over the results:
  - its name, its source tag (USDA, Dish or My food) and its energy per 100 g, one piece or one
    unit;
  - **Quantity** and **Measure** side by side. Grams, and a My food's quantity, are typed. A
    household unit (D-36), a USDA serving (D-39) or a dish's portion (D-28) is counted in halves:
    tapping either box opens a picker with two wheels, quantity and measure, and Done. A listed
    food's measures are Grams, its household units, then USDA's servings, each with the grams it
    holds ("Glass (258 g)"). The limits are unchanged (2,000 g for one food; up to 10 portions);
  - **Macronutrients breakdown:** the energy of that amount, with the weight it comes to ("Net wt:
    56 g") or "Estimated" for a dish, then protein, carbs, fat and fibre, each on its own row with
    its colour. A value the food has none for shows a dash, as does everything while the typed
    quantity can't be added, with the rule under the box;
  - **Add** at the foot; the back arrow returns to the same results. A My food keeps "Edit My
    food".
  No photo for now. Every food, dish and My food already holds the four values, so no data changes.
- Doc changes: REQ-LOG-007; the redesign plan's 3.6 and 3.6b; the canvas boards 3.6b.

## D-46 The Indian Nutrient Databank's recipes in the food list
- Status: **Accepted** (owner, in chat, 2026-11-04: "Go with 2", then "implement this data as
  well", choosing between asking INDB's authors for permission first and using it now with its
  credit).
- Problem: Search foods had few Indian dishes as eaten (curries, sabzis, dals, parathas): IFCT 2017
  lists raw foods, FitSphere's own dishes wait for the owner's measured recipes (D-26), and USDA's
  Indian-named foods are US recipes. The owner asked for an Indian dish list like HealthifyMe's and
  for 3,000 to 4,000 foods to be made up; made-up values were refused, as they would be guesses
  shown as nutrition data.
- Answer: the Indian Nutrient Databank (INDB; Vijayakumar, Dubasi, Awasthi and Jaacks, *Current
  Developments in Nutrition* 2024, 8(7), 103790) joins the food list:
  - its **1,014 recipes**, with their values per 100 g as INDB computed them, all marked
    **estimated**, and the one serving INDB gives each (917 of them, e.g. "Dosa (36.13 g)",
    a bowl, a roti, a tall glass), counted in halves; its grams come from INDB's own per-serving values;
  - tagged **"INDB"** in Search foods, listed after FitSphere's dishes and before IFCT's foods;
    an INDB recipe opens on its serving, as INDB's values are per 100 g of the raw ingredients;
  - credited in the "Food sources" sheet behind the i, with IFCT's and USDA's;
  - not used for FitSphere's own dishes (D-26), which stay the owner's measured recipes.
- Risk accepted: INDB's data has **no licence**; its recipes come from two copyrighted cookbooks
  and websites, and its values mostly from IFCT 2017 (R-007). The owner accepts this as **R-009**,
  as D-25 did for IFCT; the source is always credited and never hidden. Legal is asked (Q-049,
  L-15). The authors were not asked; that stays open.
- Doc changes: `food-list-sources.md`; the Legal brief (L-15, E-10); ADR-0006's licence row;
  `constraints-and-assumptions.md` (R-009, the More foods row); the data model; REQ-LOG-007.
  Migration `0012_indb_foods.sql`; no phone schema change.

## D-47 Indian food data only: USDA's foods archived
- Status: **Accepted** (owner, in chat, 2026-11-04: "I want you to delete USDA data and move it to
  some other separate table for now, I am not going to use that. I just want to use the Indian
  data, approved from my side"; then, asked about the household weights, "Drop them, Indian only").
- Answer:
  - USDA's 5,431 FNDDS foods and their servings (D-39) **leave the food list**. Migration
    `0013_usda_archive.sql` moves them to two archive tables, `app.usda_foods` and
    `app.usda_food_portions`, kept, not served, so they can come back later; `foods:import`
    refills the archive from `data/foods/usda-fndds-*.csv`, which stay in the repository.
  - Search foods lists FitSphere's dishes, INDB's recipes (D-46), IFCT's foods (D-25) and My
    foods. The "Food sources" sheet credits IFCT and INDB.
  - A meal or saved meal already holding a USDA food keeps it, as each holds its own values; a
    USDA serving in one is checked against the archive.
  - The household weights prepared from USDA's SR Legacy for the 62 starter units were dropped
    before they were proposed in the repository: the units stay `pending`, for the owner to weigh
    (D-36 unchanged).
- Changes: D-39's USDA part (My foods and your own food's units stay). D-46 is unchanged.
- Doc changes: `food-list-sources.md`; the more-foods plan; ADR-0006's licence row; the Legal brief
  (E-10); `constraints-and-assumptions.md`; the data model; REQ-LOG-007 and REQ-LOG-011;
  `CLAUDE.md`.

## D-48 Packaged foods searchable by brand, from Open Food Facts' data
- Status: **Accepted** (owner, in chat, 2026-11-04: "okay start with 1, push once done").
- Problem: the owner asked for a database of Indian packaged foods "like HealthifyMe", searchable by
  brand (an Amul bread), with values "as per published official sources", and as many items as
  possible. Copying another app's database was refused: it is that company's property. India has
  no public database of branded foods.
- Options given: (1) Open Food Facts' data, products sold in India; (2) brands' own labels,
  collected and approved by the owner; (3) GS1 India's DataKart, under an agreement. The owner chose
  (1) to start; (2) and (3) stay for later.
- Answer ([ADR-0009](../architecture/decisions/ADR-0009-packaged-food-search.md), the
  [packaged-foods plan](../plans/packaged-foods.md)):
  - Open Food Facts' export of 2026-11-04 gives **9,764 packaged products sold in India** with usable
    label values (6,263 with a serving in grams), across about 2,850 brands; they go in their own
    table, `app.packaged_foods`, apart from FitSphere's food list, and to the phone with the list.
  - Search foods finds them by name or brand, after My foods, tagged "Packaged" with the brand. A
    product is logged as a barcode product, in grams or by its label's serving ("Serving (50 g)").
  - Open Food Facts is credited in its own wording behind Search foods' i.
  - The values are as Open Food Facts gives them (copied from labels by its contributors), after
    checks: a valid barcode, a name, kcal, protein, carbs and fat per 100 g in range and agreeing.
- Changes: ADR-0006 rule 2 used Open Food Facts for barcodes only; ADR-0009 adds name and brand
  search from its data export. Legal is asked about the share-alike duty for the copies (L-13).
- Doc changes: ADR-0009; the packaged-foods plan; `food-list-sources.md`; the Legal brief (L-13,
  E-10); `constraints-and-assumptions.md`; the data model; REQ-LOG-007; `docs/README.md`;
  `CLAUDE.md`. Migration `0014_packaged_foods.sql`; phone schema version 11.

## D-49 Brands' own labels, approved by the owner
- Status: **Accepted** (owner, in chat, 2026-11-04: "okay start with option 2, the brands' own
  labels", the second of the three sources offered with D-48).
- Answer:
  - A **brand-labels sheet**, `docs/data/brand-labels-sheet.csv`: one row a product, with its brand,
    name, values per 100 g (or 100 ml), the serving its label gives, the **official page** it was
    read from and the date. Rows are read from the brand's or manufacturer's own website only, never
    from retailers, other apps or Open Food Facts; values are copied as printed, and per-100 g values
    are worked out from per-serving ones only where the page gives no per-100 g column, which the
    row's notes say.
  - A row is `proposed` until the owner approves it; only approved rows reach the food list, as
    source `brand_label`, tagged "Brand label", listed after My foods and before Open Food Facts'
    products, with their serving. Never approve a row without the owner's word.
  - A label may give no dietary fibre: it is shown as unknown (–), not 0. The food list allows an
    unknown fibre for brand labels only.
  - The app's credit says the values are the brands' own, with the page each was read from kept.
- Risk: brands' websites are "all rights reserved"; copying the nutrition facts printed on a label
  is taken to be reuse of facts, which Legal is asked to confirm (R-010, L-16).
- **Approved (owner, in chat, 2026-11-04: "approve all"):** the first 23 rows, read on 2026-11-04 —
  9 Amul (5 from Dudhsagar Dairy's site, the Mehsana union that makes Amul products, whose values
  are "approximate"), Maggi 2-Minute Masala Noodles, 3 Haldiram's from its international site
  (worked out per 100 g from US-style per-serving labels), 9 Britannia and Aashirvaad Shudh Chakki
  Atta. Brands whose sites give no values (Parle, Mother Dairy, Nescafé, Horlicks and others) wait
  for the owner's pack labels.
- Doc changes: `food-list-sources.md`; the Legal brief (L-16, E-10); `constraints-and-assumptions.md`
  (R-010, the More foods row); the data model; REQ-LOG-007; `CLAUDE.md`. Migration
  `0015_brand_labels.sql`; phone schema version 12 (the cached food list is made again so a fibre
  may be unknown).

## D-50 An exercise list, every kind of exercise, each set on its own, calories burned and heart rate
- Status: **Accepted** (owner, in chat, 2026-11-04 and 2026-11-05; plan `docs/plans/exercise-list.md`
  approved 2026-11-05: "I approve the plan"; its screens, 4.1 to 4.3, locked the same day: "lock it").
- Asked: "user should be able to see Picker for exercise names, should auto populate the names, KGs
  should be visible for weight trainings... If user select Pushups then weights are not mandatory.
  Create the list of all exercises and weight trainings and store it in our DB"; then "each type of
  exercise that a person can perform. cardio as well" (running's distance and speed, treadmills);
  then "please add Calories burned, A separate weight and reps for each set, Heart rate".
- Answer:
  - **FitSphere's own exercise list**, written by us (exercise names are everyday words), stored in
    the database and kept on the phone for searching offline: 334 exercises in
    `data/exercises/exercise-list.csv`, each with its group, how it is logged and other names to
    search by. The owner checks it in the pull request.
  - **Eight types**, each with its own fields: weight and reps; reps (no weight field: bodyweight);
    time; weight and time; distance and time (the average speed and pace shown); treadmill (speed,
    incline, distance); cardio machine (distance, level); time only. A list exercise with a weight
    asks for it on every set.
  - A name that is not in the list can still be saved; it asks "Log as": sets and reps (weight
    optional), time, or cardio.
  - **Each set on its own row**, with its own reps, weight and time; "Add set" copies the last.
    Exercises saved before read as that many identical sets.
  - **Calories burned and heart rate** on each exercise: calories estimated from the 2024 Adult
    Compendium of Physical Activities (MET × the latest weight × the time), or typed from a machine
    or watch in their place; shown "· estimated" as Log meal's values are, the Compendium credited
    behind an i. Calories burned show on the Training tab only, for now: Home's calorie target and
    card do not change ("Ignore for now to merge to the Home dashboard. Let track the calories burn
    on the Training tab only").
  - Distance in km and speed in km/h only for now (MVP default).
  - **The faster, the more** (owner, 2026-11-05: "a person who works faster will burn calories
    more. But this field will be editable for now so user can update"): running, jogging, walking and
    cycling take the Compendium's activity for their speed (the typed speed, or the distance over the
    time), from 87 speed bands; the band starting at the highest speed at or below theirs, so an
    estimate never runs high. Other exercises have one MET each. The calories stay editable.
- Risk: the Compendium's website allows commercial use, its journal article's licence does not
  (R-011, Legal L-17); the owner accepted it for now ("Compendium agree for now").
- Built in two steps: the list, the types and the sets (migration `0016_exercises.sql`,
  `npm run exercises:import`, `GET /v1/exercises`, phone schema version 13); then calories burned
  and heart rate (migration `0017_exercise_speed_mets.sql`, `data/exercises/speed-mets.csv`, phone
  schema version 14). Takes the exercise-list half of backlog E-17, and per-set rows and duration from
  E-14, into the MVP.
- Doc changes: REQ-TRN-003; the data model; `constraints-and-assumptions.md` (the exercise rows,
  R-011, the calories row); the backlog (E-14, E-17, E-24 to E-26, E-26 closed); `docs/data/exercise-list-sources.md`;
  `docs/sources/README.md`; the Legal brief (L-17); the redesign plan's 4.1 to 4.3; `CLAUDE.md`.

---

## D-51 Search foods: an exact match first
- Status: **Accepted** (owner, in chat, 2026-11-05, after the phone test: "When I search for any food
  that time I want that exact matching food item at the top result. Rest of the food can be shown
  as it is showing. Like I search for bread, the Bread shows in the middle of the result").
- Answer: a food whose name is exactly what was typed comes first, from whichever source it is;
  case, spaces and punctuation are ignored ("bread" finds "Bread"), and a packaged food also
  matches by its brand and name together ("amul butter"). The other results keep their order:
  dishes, INDB, IFCT, My foods, brand labels, then packaged foods (D-46 to D-49).
- Doc changes: REQ-LOG-007; `constraints-and-assumptions.md` (the More foods row).

---

## D-52 More brand labels: shops' listings and the owner's other AI tool allowed; a flag on the server
- Status: **Accepted** (owner, in chat, 2026-11-05 and 2026-11-06).
- Asked: "i am allowing you to get the data from the flipkart, amazon or any e commerce app. but do
  not get the data from the model own memory" (2026-11-05); then files the owner made with another
  AI tool; then (2026-11-06) "I approve that you must dump these rows to backend search table so
  that when I search for it food I can find it in my search food. Leave the rest of category for
  now. While storing the data to backend table make flag column where value will be scrap. this is
  backend value only no need to show on the frontend. and no logic should be calculated for now".
- Answer:
  - **Sources of the brand-labels sheet (amends D-49):** the brand's or manufacturer's own website
    first; when it shows no values, a shop's listing of the product (Blinkit, Flipkart, Amazon,
    BigBasket, Swiggy Instamart, Spencer's and the like), preferably the photo of the pack's label;
    and files the owner makes with another AI tool. **Never a model's memory.** Each row keeps the
    page it was read from, the date and the printed text.
  - **Approved (owner, 2026-11-06):** 187 more rows, collected on 2026-11-05 for packaged foods
    eaten in North India: dairy (82) and flours, grains and rice (54), collected here, 69 from
    brands' own sites and 67 from shops' photos of the pack's label; and, from the owner's other AI
    tool, biscuits (5), masalas and spices (12), oils and fats (18), breakfast and health (12) and
    instant noodles and pasta (4), mostly from shops' listings. Kept at the owner's word ("I need in
    my search result"): Catch Chat Masala, whose values come from Open Food Facts, and Rajdhani
    Besan, whose pack prints minimum and maximum limits rather than typical values. Pulses,
    ready-to-eat foods, bread, namkeen, sweets, pickles and drinks wait, and so do the other tool's
    further rows (kept outside the repository, in `D:\fitsphere-data\brand-labels-2026-11-05\`).
  - **A flag kept on the server only:** a `flag` column on the sheet and on `app.foods`: `scrap` on
    these 187 rows, empty on every other food, the first 23 brand labels included ("Leave the
    already dumped data"). It is never sent to the phone or shown, and nothing reads it: the owner
    decides its use later.
  - The app's credit for "Brand label" now says the values are as printed on each product's label,
    read from the brand's website, a shop's listing of the product or Open Food Facts.
- Risk: R-010 and L-16 now cover shops' listings and, for one row, Open Food Facts (ODbL, L-13).
- Doc changes: `food-list-sources.md`; the Legal brief (L-16); `constraints-and-assumptions.md`
  (R-010); the data model; REQ-LOG-007; `CLAUDE.md`. Migration `0018_food_flag.sql`; no phone
  schema change.

---

## D-53 AI estimates in the brand-labels sheet, flagged llm
- Status: **Accepted** (owner, in chat, 2026-11-06).
- Asked: the owner asked for a prompt that lets an AI tool give a product's values from its own
  trained knowledge where it cannot read them, then supplied such a file for bread and biscuits:
  "Please upload this table to our food search db, in the new column save value as LLM. If in this
  CSV we have value that is already saved in our database then ignore it".
- Answer (amends D-52, which said never a model's memory):
  - A row of the brand-labels sheet may hold an AI tool's estimate of a product's values from its
    general knowledge, not read from any label, once the owner approves it. Such a row is flagged
    `llm` (the server-only `flag` column of D-52), keeps the tool's note ("ESTIMATE: ... Not read
    from any label"), and has no page: `source_url` may be empty for an `llm` row only.
  - **Approved (owner, 2026-11-06):** 56 rows from the owner's file of 98 (bread and bakery 16,
    biscuits 40). The other 42 were left out because the product is already in the database,
    checked by hand: all 42 are among Open Food Facts' packaged products (D-48), with label values
    (Parle-G, Monaco, the Oreos, Jim Jam, most Britannia breads and rusks and others). Rows whose
    values repeat another's exactly (16 rows, e.g. four Patanjali Creamfeast flavours) are kept:
    they are different products.
  - **Approved (owner, 2026-11-06, "dumped it"):** 222 more rows from the owner's second file of
    369 (dairy, flours, pulses, ready-to-eat and frozen foods, bread, biscuits, namkeen, sweets,
    pickles and sauces, masalas, oils, drinks, breakfast foods, noodles, honey, jam, sugar, chocolate,
    juices, soft drinks, yogurt, soup and frozen peas): 221 estimates flagged `llm`, and Total Frozen
    Green Peas, read from a shop's typed text, flagged `scrap` (D-52). The other 147 were left out,
    checked by hand: 8 already among the brand labels and 139 among Open Food Facts' packaged
    products.
  - **Approved (owner, 2026-11-06, "now dumped this"):** 12 more `llm` rows from the owner's third
    file of 84 (ready-to-eat, frozen and bakery): Mother's Recipe and Kohinoor ready meals, Gits Shahi
    Paneer, Sumeru Punjabi Samosa and Godrej Yummiez Aloo Tikki. The other 72 were left out: 54 already
    in the sheet from the second file, 18 already among Open Food Facts' packaged products.
  - **Approved (owner, 2026-11-06, "now dumped this"):** 25 more `llm` rows from the owner's fourth
    file of 74 (masalas, oils, tea, coffee, sharbats, drink mixes and malt drinks). The other 49 were
    left out: 35 already in the sheet (7 of them under another code, such as MDH Kitchen King Masala
    for MDH Kitchen King), 14 already among Open Food Facts' packaged products.
  - **Approved (owner, 2026-11-06, "Dumped it now"):** from the owner's fifth file of 19, read from
    the brands' own websites (not AI estimates), 3 new rows flagged `scrap` as D-52's web-read rows:
    Bikano Gol Matthi and Chatak Masala Chips, Haldiram's Soan Papdi Premium. The other 16 were left
    out: 11 already among Open Food Facts' packaged products, and 5 already in the sheet as `llm`
    estimates (Bikano Mini Samosa, Gulab Jamun and Rasgulla; Nilon's Mixed and Lime Pickle), whose
    official values wait for the owner's word.
  - **Approved (owner, 2026-11-06, "Dumped this"):** from the owner's sixth file of 102 (namkeen,
    sweets, pickles, chutneys and papad), 37 `llm` estimates and Nilon's Dhaniya Pudina Chutney,
    read from Nilon's site, as `scrap`. The other 64 were left out: 62 already in the database (in
    the sheet, or among Open Food Facts' packaged products; a general name such as "Haldiram's
    Gajak" counts as the "Til Gajak" already there), and 2 Nilon's Standard pickles (mango, lemon)
    with values from Nilon's site, held with the 5 above for the owner's word.
  - **Estimates replaced by official values (owner, 2026-11-06, "replace"):** six `llm` rows now hold
    the values on the brand's own site and are flagged `scrap`, keeping their codes: Bikano Mini
    Samosa, Gulab Jamun and Rasogolla (Rasgulla); Nilon's Mixed and Lemon Pickle (Classic Pickle
    range) and Mango Pickle (Standard Pickles). Nilon's two ranges print different values (Classic
    93 kcal, Standard about 200 kcal), so Nilon's Lemon Pickle (Standard Pickles) is added as its own
    row. The sheet now holds 567 brand labels: 23 unflagged, 199 `scrap`, 345 `llm`. Rule kept: a row
    with the brand's own value replaces an `llm` estimate of the same product only on the owner's
    word.
  - **Approved (owner, 2026-11-06, "Please dump"):** from the owner's seventh file of 154 (sauces
    and spreads, honey, jaggery, drinks and drink mixes, namkeen, sweets, chocolate, muesli and oats,
    dry fruits, ready meals, pasta, vermicelli and cake rusks), 63 `llm` estimates. The other 91 were
    left out, checked by hand: 4 already in the sheet (MDH, Catch and Everest jaljeera, Sunfeast
    Pasta Treat Masala) and 87 among Open Food Facts' packaged products. The new rows have search
    words like the others (D-55); with them, the three jaljeeras lose cumin powder's search words
    and Sunfeast Pasta Treat Masala those of cream biscuits, given by mistake. The sheet now holds
    630 brand labels: 23 unflagged, 199 `scrap`, 408 `llm`.
  - **Shown like the other brand labels** (the owner's choice, offered against marking them
    "estimated"): tagged "Brand label", no visible difference; only the server-side flag tells
    them apart. The credit behind Search foods' i is unchanged, so it does not mention estimates
    (accepted risk R-012).
- Doc changes: `food-list-sources.md`; the Legal brief (L-16); `constraints-and-assumptions.md`
  (R-012); the data model; REQ-LOG-007; `CLAUDE.md`. Migration `0019_food_flag_llm.sql`; no phone
  schema change, no app change.

---

## D-54 Search foods: My foods, brand labels and packaged foods before INDB and IFCT
- Status: **Accepted** (owner, in chat, 2026-11-06: "when I search for the food then exact food
  matched item should be at the top of the result; which is fixed now. After that I want the food
  of user own saved, Brand label, then packaged, then INDB and other items shows. This should be
  the order").
- Answer: a food named exactly as the search still comes first (D-51). The other results now come
  in this order: the user's My foods, brand labels (D-49), packaged foods from Open Food Facts
  (D-48), INDB's recipes (D-46), then the rest: FitSphere's dishes (D-28) and IFCT's foods, in that
  order (MVP default: they keep the order they had between them). This replaces the order in D-51
  (dishes, INDB, IFCT, My foods, brand labels, packaged foods). Each source still shows up to 30
  matches, and every result keeps its tag.
- Doc changes: REQ-LOG-007; `constraints-and-assumptions.md` (the More foods row). Phone app only:
  no server change, no migration, no new build.

---

## D-55 Hidden search words on brand labels
- Status: **Accepted** (owner, in chat, 2026-11-06: "add search words", after a search for "whole
  wheat atta" did not find the brands whose packs say "Chakki Atta").
- Answer: each brand label may carry search words, the everyday names of what the product is
  (for a chakki atta: "whole wheat atta", "wheat flour", "gehu atta"; for dahi: "curd", "yogurt";
  for a lime pickle: "nimbu achar"). They are kept with the food as aliases after its brand, so a
  search for the item finds every brand whatever its pack calls it. They are never shown. Words the
  name already holds are left out. The first set was written for all 567 brand labels from the food
  item each belongs to (MVP default: English and common Hindi names); the owner can change any row in
  the sheet's new `search_words` column.
- **Group words too (owner, 2026-11-06: "pulses"; then "I want option 1 for the Pulses. If similar
  things can be done for the rest of the items please proceed"):** each food also carries its group,
  so a general search shows the whole group: pulses and lentils (dals, rajma, chana, soya chunks),
  dairy, flour, grains, ready meal, frozen food, bakery, biscuits, snacks, sweets, spices, cooking
  oil, drinks, breakfast, dry fruits and nuts, pickles, sauces, instant food, spreads and
  sweetener. A word the name or another search word already covers is left out.
- Doc changes: `food-list-sources.md`; the data model; REQ-LOG-007. Server import only: the phone
  already searches aliases, so no phone change, no migration, no new build; `foods:import` again.

---

## D-56 Search foods: a packaged product listed under several barcodes shows once
- Status: **Accepted** (owner, in chat, 2026-11-06: "when I search for the Paneer there are a lot of
  items of label Packaged Milky Mist. Why is that so duplicate item"; then "remove duplicates").
- Answer: Open Food Facts keeps one product per barcode, so a food sold in several pack sizes, or
  added twice, is in the packaged foods several times with the same values (269 of the 9,764, such as
  Milky Mist Paneer 4 times and Horlicks Classic Malt 11 times). Search foods now shows such copies
  once: the same brand, the same name (a name that repeats the brand counts as the same) and the
  same values. The first copy stays, taking a copy's serving when it has none. Products whose name
  or values differ stay apart. Every barcode stays on the phone and on the server, so any pack still
  scans. Search reads up to four times more matches before keeping 30, so copies do not crowd out
  other products.
- Doc changes: REQ-LOG-007; `constraints-and-assumptions.md` (the More foods row). Phone app only:
  no server change, no migration, no new build.

---

## D-57 Search foods: a cross clears the search
- Status: **Accepted** (owner, in chat, 2026-11-06: "In the Search foods input need a cross icon
  from where I can clear out the result ... I want that when I typed into input field on each
  character erase my search result should refresh based on the new input").
- Answer: while something is typed, a cross at the end of the search box clears the search and its
  results. The results follow the search as each letter is typed or erased; the app already did
  this, and a test now covers it. (Since D-72 the phone searches once typing pauses.)
- The microphone asked for in the same message is **on hold** (owner, 2026-11-06: "For now keep on
  hold the mic I will let you later to implement"); backlog E-28. FitSphere's own microphone may use
  only the phone's on-device speech recognition (ADR-0005, D-18), which needs a new module and a new
  development build.
- Doc changes: REQ-LOG-007; backlog E-28. Phone app only: no server change, no migration, no new
  build.

---

## D-58 Log meal in steps: the meals and the ways to add food in one row each
- Status: **Accepted** (owner, in chat, 2026-11-06: "on the Log Meal all 4 Meal KPI should be in one
  line. When I select one it should clearly differentiable; same for the Add Food all 4 KPI should
  be in one line, I should clearly differentiate each one; and when I select from the top Meal, as a
  user I should understand myself where to click. First let me know the UI on the canvas"; the AI
  box "in between both"; then "lock it" on the canvas's "3.5 Log meal in steps").
- Answer (the redesign's 3.5, changed):
  - Log meal shows three numbered steps: 1 Meal, 2 Add food, 3 Review and save. The step to do now
    has its number on caramel and a line saying what to tap ("Start here: tap your meal"; "Next:
    tap how to add your food"; "Last: check your foods, then Save meal"; with foods but no meal yet,
    "Choose the meal to save"). A done step shows a green tick. The caramel frame round the step to
    do now, in the locked design, was removed at the owner's word the same day ("the highlighted
    current step is not looking good. Please remove it"). Every step can still be used in any
    order, as before; Save meal still needs a meal and a food.
  - The four meals are always in one row, each a tile with its icon (sunrise, sun, cookie, moon);
    the chosen one is filled in caramel with a tick. A name too long for its quarter, with the
    phone's text made larger, shrinks to fit. Re-logging a saved meal keeps its two by two.
  - The four ways to add food are in one row, each with its own icon on its own tint (caramel,
    blue-grey, green, gold) and its name in two short lines ("Own food" is read out as "Enter your
    own food").
  - "AI meal reading is coming soon" stays between the meals and the ways to add food.
- MVP default: the tints are the app's own colours (accent, fat, success, warning), as quiet
  fills; two tokens are added for them, `fatTint` and `warningTint`.
- Doc changes: `docs/design/design-system.md` (the two tints); `docs/plans/ui-redesign.md` (3.5).
  Phone app only: no server change, no migration, no new build.
- Changed by D-68 (2026-11-10): no step turns green; the chosen meal has no tick of its own (a green
  tick marks each meal with food); the "AI meal reading is coming soon" box is left out.

## D-59 Home-style foods: everyday forms of daily foods, from the owner's AI files
- Status: **Accepted** (owner, in chat, 2026-11-06: "when I search for the food like Bread it only
  shows the Bread but in the real it should show options like Bread, Bread slice, Bread toast, Bread
  jam, Bread omelette"; then, sending the first file, "review and dump it"; on how they show, "later I
  will remove the tag of Brand label, packaged, INDB"; on their place, "just after the exact match").
- Answer:
  - FitSphere's food list gets a new source, home-style foods (`home`): the everyday forms of daily
    foods as eaten at home, not any brand's product (a white bread slice, butter toast, bread jam,
    bread omelette). They come from the owner's files made with another AI tool, one food item at a
    time, each row an estimate from the tool's general knowledge with its recipe in the note, kept in
    `docs/data/home-foods-sheet.csv`, flagged `llm` on the server only (D-53).
  - **Approved (owner, 2026-11-06, "review and dump it"):** 31 bread forms from the owner's file of
    32; Shahi tukda was left out, already in the list as INDB's Shahi tukre.
  - **Approved (owner, 2026-11-06, "now please dump these"):** 30 roti forms (phulka, ghee and
    butter roti, tandoori, missi, rumali, bajra, jowar, ragi and fasting rotis, baati and others) and
    31 naan, kulcha and paratha forms (butter, garlic and stuffed naans, kulchas, lachha, egg, sattu
    and other parathas, sheermal, bakarkhani, taftan); none was in the list already. The file gave
    the item as "naan, kulcha and paratha"; each row's item is set to naan, kulcha or paratha (the
    Mughlai breads to naan), as an item is a search word. 92 home-style foods in all.
  - In Search foods they come right after a food named exactly as the search (D-51), before My foods;
    the rest keep D-54's order. Each is found by its item too ("bread" finds Butter toast).
  - They carry no tag and no "estimated" (MVP default from the owner's answer: the tags are to go).
    The sources sheet behind the i says they are typical values for a home recipe.
  - A home-style food is logged in grams or by its serving (a slice, two slices, a plate), and opens
    on its serving.
- Doc changes: REQ-LOG-007; `food-list-sources.md`; the data model; `constraints-and-assumptions.md`
  (R-013); the Legal brief (L-18); `CLAUDE.md`. Migration `0020_home_foods.sql`; no phone schema
  change, no new build. On `fitsphere-dev`: migration 0020 before the updated API, then
  `foods:import`, only when the owner says so.

## D-60 Recent foods in Search foods: the last five days' foods, ticked or opened on their last amount
- Status: **Accepted** (owner, in chat, 2026-11-06: "In the fitsphere Log Meal -> Search food the
  screen shows the empty. I want that it should suggest last 5 days added food item below the search
  foods so instead of searching User can directly pick from it ... Item should be from recent to
  last of last 5 days. So recently added item should show at the top. User can pick multiple as
  well. When he select it should clearly be visible that user has selected this and user can deselect
  as well. First show me the UI on the canvas then start building it"; on the canvas: "No need to
  show the today yesterday tag just show the item. No duplicate should be present, and the clickable
  icon should be in the right side. No need to show tag like INDB, Packaged"; then "if first user
  select the check box and further selection of food will count as adding to current log meal, or in
  the first click user directly click on the measuring tab ... user can increase and decrease the
  quantity. And the uniqueness will be measured by the food item name ... In such case show the
  latest one measurements. Note this in my decision"; then "Lock it, start building" on the canvas's
  "3.6 Search foods with recent foods", version 36). Numbered D-60 because D-59 is home-style foods,
  built at the same time.
- Answer (the redesign's 3.6, added to):
  - Before anything is typed, Search foods shows **Recent foods · Last 5 days**: every food logged on
    today and the four days before (Asia/Kolkata days, invariant 5), the latest first: by the meal's
    day, then when the meal was saved, then a meal's last food first.
  - **Each food once, told apart by its name** (ignoring case and spaces): a food eaten twice in
    different amounts shows once, with the **latest** amount and its values. No day labels and no
    source tags (INDB, Packaged, Brand label) in this list.
  - Each row: the name and, under it, the amount last logged and its kcal; a **tick box on the
    right**. Ticking picks the food as it was last logged; a ticked row is tinted, its name heavier,
    its box filled in caramel with a check; tapping again unticks it. While foods are ticked, a bar
    at the foot says "N selected · kcal", offers "Deselect all", and "Add N foods" puts them all into
    the meal being logged and returns to Log meal.
  - **Tapping a food's name opens its page** (3.6b) on the amount last logged, with "Last time: …"
    under the boxes, to change the quantity or measure there.
  - **Once foods are ticked, a food added from its page goes in with them**, a recent one or one
    found by the search: the page's button says "Add N foods" and the line above it "Your N ticked
    foods go in with it." A ticked food opened on its own page goes in once, with the page's amount.
    The ticks stay while searching.
  - The keyboard opens by itself only when there are no recent foods (then: "Foods you log show here
    for 5 days, so you can add them again with a tap."); otherwise on a tap in the search box.
- MVP defaults:
  - A ticked food is added with the values it was logged with (as a saved meal is); its page uses the
    food list's values now.
  - A recent food with no page (your own food not kept in My foods, a My food deleted, a food that
    has left the list, a barcode product scanned rather than listed) is ticked when its name is
    tapped.
  - Meals the server refused are left out; foods added with "Already in this meal" still ask, as
    before (D-34).
- Brings part of backlog B-03 ("Eaten before") into the MVP. Doc changes: REQ-LOG-007;
  `docs/product/backlog.md` (B-03); `docs/plans/ui-redesign.md` (3.6). Phone app only: no server
  change, no migration, no phone schema change, no new build.

## D-61 Search results without source tags: a brand under the name, one row per name for several brands
- Status: **Accepted** (owner, in chat, 2026-11-06: "I want that when we search the food Bread ... the
  label Package, Brand label to be removed. But if I remove there will be multiple multiple Bread of
  the same because they are from the different brand. So come up with me the better design ... each
  type of tagged so I can visualize which one look good after removing the tagged Packaged and
  similar"; on the canvas's "3.6 Search results without tags", of Now, A, B, C and D: "c").
- Answer (the redesign's 3.6, changed; supersedes the tags of D-39, D-46, D-48 and D-49 in the results):
  - No result in Search foods carries a source tag: no "Packaged", "Brand label", "INDB", "My food" or
    "Dish".
  - A branded food (a brand label, or a packaged food with a brand) shows its name without the brand,
    and under it its **brand**, a little heavier, then its energy: "Sandwich Bread" / "Alpha Bakers ·
    250 kcal per 100 g".
  - The branded foods of **one name** (the brand left out, ignoring case and punctuation) are **one
    row**, where the first of them was: "Bread" / "3 brands · 220–274 kcal per 100 g", with a chevron.
    Tapping it opens the brands under it, set in on the sunken colour, a brand each with its energy;
    each opens its page; tapping the name again closes them. A name only one brand has stays a row of
    its own.
  - A My food says "Your food" in caramel where its tag was. INDB's recipes, IFCT's foods and dishes
    show their name and energy; a recipe's or dish's still says "estimated".
  - The order is as before (D-51, D-54); a name's row takes the place of its first brand.
- MVP defaults:
  - Each food's own page (3.6b) keeps its source tag and brand, so where a value comes from stays one
    tap away; the credits behind the i are unchanged ("Foods marked INDB …" refers to that tag).
  - "N brands" counts different brands; a name only one brand has, even from two sources (a brand
    label and a packaged food of the same brand and name), stays a row for each, its brand under it.
- For Legal (Q-049): the attribution of Open Food Facts (L-13), INDB (L-15) and the brand labels
  (L-16, R-010, R-012) no longer shows on each result, only on the food's page and behind the i.
- Doc changes: REQ-LOG-007; `docs/architecture/constraints-and-assumptions.md` (More foods);
  `docs/plans/ui-redesign.md` (3.6). Phone app only: no server change, no migration, no new build.

## D-62 Estimated dishes from the owner's dish database; Search foods ignores spaces and marks
- Status: **Accepted** (owner, in chat, 2026-11-10: "I have provided a one file in the
  D:fitssphere-data. named: Indian_Food_Database_MASTER. ... Once I approve your changes than you need
  to dumped into the fitssphere"; on the proposal (the rated-C dishes as "estimated dishes" after
  INDB's recipes and the dishes, before IFCT's foods; the rated-D dishes left out; the file's new
  packaged products that pass FitSphere's checks; and the search fix for "haldirams"): "Fix the
  Issue: haldirams that you mentioend I approve your purpose. And wheever you finds any issue reading
  Classic South Indian Rava Idli simialr product. For now do not dumped. only dumped the right data.
  After Dumped do let me know the data which you find issue").
- Answer:
  - FitSphere's food list gets a new source, **estimated dishes** (`dish_estimate`): Indian dishes the
    list did not have, from the owner's dish database (`Indian_Food_Database_MASTER.xlsx`, built on
    6 November 2026, kept outside the repository). Each dish has the typical values per 100 g of its
    **type of dish** (one of the file's "archetypes", such as a dry sabzi, a dal tadka or a pulao),
    not values measured for that dish, and that type's serving (a katori, a plate, a piece). Their
    names are Archana's Kitchen's recipe names (names only) or made by the file's own grammar (a base
    food and a way of cooking it). They are kept in `docs/data/dish-estimates-sheet.csv`, flagged
    `llm` on the server only (D-53).
  - **Loaded: 5,025** of the file's dishes rated C ("estimated") that FitSphere lacked.
  - **Held back, not loaded: 1,778**, each with its problem in the sheet's `issue` column:
    - 1,259 rated D ("weak match": no keyword matched, so the base food's default values);
    - 519 rated C whose values do not fit the dish: another type's values (Classic South Indian Rava
      Idli has a sweet lassi's), not a dish at all (a spice powder, a batter, a premix), a spoonful's
      values for a serving dish, a meat, fish or egg dish with a vegetable's protein, a vegetable
      juice given a fruit juice's values, and the like.
  - Not in the sheet: the file's dishes FitSphere already has, by name or another spelling (962,
    every one of INDB's among them), and the file's second rows for a dish.
  - In Search foods they come after INDB's recipes and the dishes, before IFCT's foods (D-54's order
    otherwise), up to 30 matches. Each is also found by its base food ("okra" finds Bhindi Masala).
    The results say "estimated", as for INDB's recipes; the food's page is marked "Estimated dish";
    the sources sheet behind the i says they are typical values for each type of dish. Each is
    logged in grams or by its serving, and opens on its serving.
  - **11 packaged products** from the file's packaged sheet (Open Food Facts India, export of
    27 October 2026) that FitSphere's packaged foods lacked and that pass every check D-48 applies
    join them, in `data/foods/off-india-extra.csv` (Haldiram's Bhujia sev among them). The other 324
    of the file's 335 new barcodes failed: the energy did not agree with the nutrients (142), the
    barcode was wrong or a shop's own in-store code (137), a value was out of range (24), or the name
    was not usable (21).
  - **Search ignores spaces and marks** (the owner: "Fix the Issue: haldirams"): in names, brands and
    search words, and in what is typed, the marks ' ’ . are dropped and - & , / ( ) read as spaces, so
    "haldirams" finds Haldiram's; and a word typed as two words run together finds them written apart,
    the first starting a word, so "healthfactory" finds The Health Factory and "dalmakhani" finds Dal
    Makhani. This holds for every kind of food in Search foods: the food list, packaged foods, dishes
    and My foods. A word made only of such marks is matched as typed.
    - **Changed on 2026-11-10** after the owner's phone test ("I Search Dal it shows the Aloo Naan is it
      a type of dal"): the first version dropped every space, so a word could match one word's end and
      the next one's start ("stuffed aloo" read "stuffedaloo", which has "dal"; 13 foods, such as Aloo
      naan, Soaked Almonds and Chettinad Aloo). Words run together now match only whole words written
      apart.
- MVP defaults:
  - The rules that held rows back are FitSphere's own, applied when the sheet was made. The owner can
    approve a held row later, with its values corrected.
  - One row per dish name: the file's first row that passes the checks, rated C before D. The values
    are the file's, unchanged; names cut off in the file ("Ghee Rice (") are tidied.
- Not done: the file says 255 of INDB's values look implausible (for example Curd rice, 196 kcal per
  100 g). That is a separate question; INDB's values are unchanged.
- Doc changes: REQ-LOG-007; `food-list-sources.md`; the data model;
  `constraints-and-assumptions.md` (R-014); the Legal brief (L-19); `CLAUDE.md`. Migration
  `0021_dish_estimates.sql`; no phone schema change, no new build. On `fitsphere-dev`: migration 0021
  before the updated API, then `foods:import` (the owner's word: "only dumped the right data").

---

## D-63 A workout's sets a row each, and deleting a workout says what goes
- Status: **Accepted** (owner, in chat, 2026-11-10, from a phone screenshot of 4.2: "In the Exercise
  card layout got confused if the User has made multiple sets of the same exercise. So I want that the
  sets to separated by the /. If you have better UI Design provide me the canva link"; "when I write to
  delete the workout the message is to confusing me so provide me the Better Message"; on the canvas's
  "4.2 A workout · PROPOSED", of Now, A (split by /) and B (a row per set): "B. Yes I am ok with the
  wording").
- Answer (the redesign's 4.2 and 4.1, changed):
  - On the workout screen an exercise's sets show **a row each**: a muted label, then the set in
    condensed figures, "Set 1  10 × 20.0 kg", "Set 2  8 × 22.5 kg". Sets all the same share one row,
    "3 sets  10 × 40.0 kg"; one set reads "1 set  12 reps". Reps alone say "reps"; a timed set shows
    its time, "3 sets  1:00"; a weight-and-time set, "0:45 × 24.0 kg". Cardio is unchanged.
  - **Delete workout** asks "Delete Workout 1 on Tue 10 Nov?" and under it what goes: "Its 2 exercises
    will be deleted too. It will no longer count in this week's workouts. You can't undo this." A
    workout's bin on Training asks the same in its sheet: "Workout 2 on Tue 3 Nov will be deleted, with
    its 2 exercises. It will no longer count in this week's workouts. You can't undo this."
- MVP defaults:
  - "this week's" when the workout's Mon–Sun week (IST) is today's, else "that week's", as Home's
    workouts card names the week (D-34); a workout with no exercises counts in no week (D-41), so it
    says only "You can't undo this."
  - A screen reader reads each card as its rows: "Squat: Set 1, 10 × 40.0 kg; Set 2, 12 × 40.0 kg".
- Doc changes: `docs/architecture/constraints-and-assumptions.md` (the exercise sheet and deleting);
  `docs/plans/ui-redesign.md` (4.2); `docs/testing/slice-4-manual-testing.md`. Phone app only: no
  server change, no migration, no new build.

---

## D-64 Changing a food in the meal: its own page, any of its measures, Remove centred
- Status: **Accepted** (owner, in chat, 2026-11-10, from a phone screenshot of a food's sheet in Log
  meal's review: "After logged meal whole reviewing the item if I want to change the item's measuring
  entity I can not do this, like gram to slice, spoon. So want this functionality as well. And here
  the Remove button is left align I want it to center"; on the canvas's "3.5 Log meal · PROPOSED:
  change a food in the meal": "approve").
- Answer (the redesign's 3.5 and 3.6b, changed):
  - In Log meal's review, a food the phone lists (a listed food, a dish, a packaged food, a My food)
    opens **its own page** (3.6b) on the amount it has in the meal, said under the boxes: "In this meal
    now: 100 g". Its Measure offers every measure the food has (Grams, its household units, its
    servings), so 100 g can become 1 paratha; the breakdown follows the change.
  - **Save change** replaces the food in the meal; the back arrow ("Back to the meal") leaves it as it
    was. **Remove from meal**, in red with a bin, is centred under Save change.
  - A food with **no page** (one typed once in Enter your own food, or a barcode product not in the
    list) keeps the sheet for its amount, its **Change to …** and **Remove** each a button of its own,
    the label centred.
- MVP defaults:
  - From the meal, a My food's page offers no "Edit My food": it changes the amount only.
  - The changed food takes the food list's values as they are now, as adding it again would.
  - Spoons, katoris and the other household units show only for foods whose measures the owner has
    approved in the household-measures sheet (D-36); none is approved yet.
- Doc changes: REQ-LOG-007; `docs/plans/ui-redesign.md` (3.5). Phone app only: no server change, no
  migration, no new build.

---

## D-65 Training: the date strip on top, "By day" and "All workouts"
- Status: **Accepted** (owner, in chat, 2026-11-10: "if I want to the see the workout from the last
  date of last month than I Need to Scroll down the lot of"; "The Date Picker of the log workout is
  confusing that of whcih date I am logging the workout"; "when I select the date than I can see the
  workout of that date only and I am shold be able to log the workout of that date"; "apart from this
  I can also see the whole workout as I can see now"; on the canvas's first proposal: "I want the
  calender Stripe on the top of Training tab. for now Remove the card No Training plan yet. when I
  Select the a particualar date I can see the workout of that date. keep the another plan fo the all
  workout"; on "4.1 Training · PROPOSED v2": "lock it").
- Answer (the redesign's 4.1, changed; replaces D-43's date chip):
  - Training opens on the **date strip**, as Home's and Nutrition's (D-34): 7 days ending today, a
    green mark on each day with a workout. Under it, two choice pills: **By day** (the first) and
    **All workouts**.
  - **By day** shows only the selected date's workouts, under one button that names the date it logs
    to: "Log workout for today", or "Log workout for Sat 31 Oct". A past date shows "Showing Sat 31 Oct"
    with "Back to today", as Nutrition's (REQ-DATE-002). The date is a label, "Sat 31 Oct · 2 workouts"
    ("Today, Tue 10 Nov · 1 workout"); its workouts are one card of rows, each with its pencil and bin
    (D-42), and the day's calories burned (D-50). A date with none says "No workouts on Sun 8 Nov."
  - **All workouts** is the history as before (one card per date, D-34; each workout a row, "Log
    another workout" on each date, D-42), grouped by month, newest first: the newest month open, each
    other folded to one line, "October 2026 · 9 workouts on 8 days"; a tap opens or folds it. "Load
    older" stays at the bottom.
  - A date picked on the strip or in the header's calendar shows By day for it.
  - The "No training plan yet" card is **not shown for now**: no one can send a training plan in the
    MVP (D-20). It comes back with training plans (REQ-TRN-001, post-MVP).
  - **A workout with no exercise is not listed** (owner, later the same day: "On the workout hostory by
    today and All workouts. I do not want to shows the workouts with the zero excesice"; asked whether
    Home's "Workouts on <date>" sheet should hide them too, so a workout has the same number
    everywhere: "Hide everywhere"). By day, All workouts, the strip's marks, a month's count and
    Home's day sheet leave it out, as the weekly count already did (D-41); workouts are numbered
    without it ("Workout 1", "Workout 2"), on their own screen too. It is still stored, and its own
    screen, open right after "Log workout", shows it until it gets an exercise or is deleted.
- MVP defaults:
  - Training opens on By day each time the app starts; the choice stays while the app runs.
  - A month's line counts the workouts listed under it and their dates.
  - After "Load older", the newest month it brought opens, so what came is in sight.
  - The strip marks a day with a listed workout; screen readers hear "workout logged".
  - A workout left with no exercise stays stored and synced but cannot be opened again from a list;
    deleting it, or not saving it until it has an exercise, would change D-29 and is the owner's to
    decide.
- Doc changes: REQ-TRN-002, REQ-TRN-003, REQ-TRN-004 and REQ-HOME-007; `docs/architecture/constraints-and-assumptions.md`
  (the Training tab; starting a workout); `docs/plans/ui-redesign.md` (4.1);
  `docs/testing/slice-4-manual-testing.md`; `CLAUDE.md`. Phone app only: no server change, no
  migration, no new build.

---

## D-66 Search foods lists every match, with no cap, the best matches first
- Status: **Accepted** (owner, in chat, 2026-11-10: "When I search for the Item I do want the cap of 30
  item. I want that all the data available in the Fitssphere must be available as the result when the
  entered Text is matched the search logic"; "do want" is read as "don't want", from the second
  sentence). Numbered D-66 because D-63, D-64 and D-65 are the workout fix, the Log meal fix and the
  Training tab, built at the same time.
- Answer:
  - Search foods lists **every** food that matches the search (every word in its name, brand or
    search words, D-62), from every source: no longer up to 30 from each source of the food list, 30
    packaged foods, 10 dishes and 10 My foods.
  - **The best matches first** (owner, in chat, 2026-11-10, after a phone test: "When I search for
    the Dal Why I am seeing the Baati, Refined Sunflower oil"; of the options offered, "Real matches
    first"): after a food named exactly as the search (D-51), the results come in four groups:
    1. foods whose name has every word typed as a whole word ("Moong Dal");
    2. those where a word typed only starts a word of the name ("Dalia", "Dalda");
    3. those where it is only inside a word ("Chicken Vindaloo");
    4. those found only by their hidden search words (Baati, by "dal baati"; a dish by its base food).
    Inside each group the order by source stays as D-54, D-59 and D-62 set it. A packaged food's
    brand counts as part of its name. D-61's grouping of brands is unchanged.
- MVP defaults:
  - The worst of the words typed counts: "moong dal" puts "Moong daliya" in the second group. Two
    words typed together count as whole when the name has them apart ("dalmakhani" and "Dal
    Makhani").
  - The list scrolls; its rows are drawn as they come into view. A one-letter search can list about
    17,000 foods. (Since D-72 one or two characters find only the foods named by them; since D-73 the
    list shows its rows 200 at a time.)
  - The search still runs at each letter typed or erased (D-57), with no pause added. (Changed by
    D-72: the phone searches once typing pauses, and one or two characters find only the foods named
    by them.)
  - **Ready-made search text** (owner, in chat, 2026-11-10: "apply the index: Ready-made search
    text", after asking whether an index would make the search faster): each food's and packaged
    food's name, aliases and brand are kept as the search reads them, written when the list is
    stored, so a search does not work them out again for every food (on the PC, with about 17,000
    foods, "dal" took 19 ms in place of 72). A full-text index was measured and not added: at this
    size it saved almost nothing more.
- Phone app only: no server change, no migration, no new build; phone schema version 15. Doc
  changes: REQ-LOG-007; `constraints-and-assumptions.md` (More foods); the data model (the phone).

---

## D-67 The exercise library: the owner's 2,090 exercises, by Category and Sub-group
- Status: **Accepted** (owner, in chat, 2026-11-10: "In the d:/fitssphere-data I have added a new
  file: Gym_Exercise_Library. reads it and Dumped it into our Fitsshere excesice database. SO that
  when the USer search for it. It can see the Rssult."; "While Adding the excercise there should be a
  two new drosown to slect the excesice category and subgroup refer to the sheets"; "for the existing
  available excercise LEave the cateogry and sub group value empty for now"; "If as the our new list
  system can not calculate the calories and keep is empty let theuser emter its value by itslef"; "for
  the New list decide ourself that this excesice needs the stes, timer and other entervalue as pr your
  decsion. whatever you took decison for the each excesrcie generate the CSV and let me knwot he name.
  I will Verify it by myself."; then, on the plan's questions: "Allow the sme excercise to the
  different category for now"; "these are already in our list so you can copy paste these category and
  subgroup"; "The file come from My AI tool"; "Keep the only one from the new Excel sheet"; on the plan
  and the canvas's "4.3 Exercise sheet · PROPOSED": "approve, lock it"; then, after a phone test: "After
  Selecting the Category and Subcategory the Excersi is typed in the Excercise name the available options
  is window is to short. which is a bad UI Desing. in the cateogry and sub group choice list it self as
  scrolling but Excercise name does not has own scrllnig. My Suggestion would be instead of showing the
  this screen the pop that come from the Below it should be rendered as the whole page. and we can add
  the back icon to go back"; on "4.3 Exercise page · PROPOSED": "lock it"; then: "Need a Icon to close and
  open the choice list in the excercise name inout fields same as Category."; "When I have slected
  excecise name If I change the category and subcateogry and the excerce is not belong to the that
  combinations the Excescse name must be disappear"; on the matches' category and sub-group, of the
  canvas's A (a second line) and B (also grouped when browsing): "go for the A"; "on the Add Excercise
  tab mark Optional average Heast rate, Highest Heart rate").
- Answer (plan [`docs/plans/exercise-library.md`](../plans/exercise-library.md); the redesign's 4.3,
  changed):
  - The owner's file (`D:\fitsphere-data\Gym_Exercise_Library.xlsx`, from the owner's AI tool: 2,090
    rows, 39 categories, 59 sub-group names) joins the exercise list through the review sheet
    `docs/data/exercise-library-sheet.csv`: **1,832 new exercises**, each logged as FitSphere decided
    (one of D-50's eight types), with a Compendium MET where an activity the list already uses fits,
    and none for 268 (sled work, skills, drills, rehab, most branded classes), whose calories are
    typed.
  - An exercise listed in several categories is **one exercise with several places**. An exercise
    already in our list takes the file's category and sub-group (187 of them).
  - Of the 84 names like ours, the **47 that are the same exercise replace ours**, keeping our names
    as other names to be found by; the other 37 stay apart (the plan lists them all). Our list goes
    from 334 to 287; the whole list is 2,119.
  - The exercise sheet gets **Category** and **Sub-group** above the name. Sub-group lists the chosen
    category's sub-groups, or every sub-group name with none chosen ("Chest" finds every category's);
    a category with none reads "No sub-groups". With either chosen, its exercises show before a word is
    typed ("Barbell · Chest · 20 exercises"); typing narrows them ("19 matches in Barbell · Chest"); no
    match offers "Search all categories". The name can still be searched with neither chosen.
  - The exercise sheet is **a whole page** over the workout, as Search foods (D-44): a back arrow and
    its title ("Add exercise", "Edit exercise") at the top, the back arrow in place of Cancel. Category,
    Sub-group and the name come first; while a Category or Sub-group list, or the matches, show, they
    stay and the list fills the page under them, scrolling on its own; while the form (sets, time,
    calories, heart rate, note) shows, the whole page scrolls, the fields with it (the owner: "the
    whole screen should be scrollable while adding the timer and calories spend enter"). Save exercise
    is fixed at the foot, and steps aside while a list shows.
  - The name has a **chevron**, as Category's: it closes the list showing (and the keyboard), or opens
    it again: the matches of the words typed, the choice's exercises, or, with nothing typed or chosen,
    every exercise A to Z ("All exercises · 2,119"). Typing opens it again.
  - An exercise of the list already picked that a new Category or Sub-group does not hold **leaves the
    name**, so the choice's exercises show to pick from; a name of the user's own stays.
- MVP defaults:
  - The names stay as the file writes them ("Barbell Flat Bench Press"); seven are renamed so no two
    clash: Pilates' Swimming, Criss-Cross, Hip Circles and Jackknife become "… (Pilates)", and Warrior
    I, II and III become Warrior 1, 2 and 3 (the search counts a doubled letter once).
  - A match shows what the choice does not, on a second, muted line under its name (the owner's A):
    its category and sub-group with nothing chosen ("Core / Abs · Anti-Extension / Plank"), its
    sub-group with a category chosen, nothing with both; an exercise in no category, its group.
  - The categories and sub-groups come in the file's order; Sub-group with no category chosen lists
    every name A to Z. Each choice shows its count; changing the category clears a sub-group it does
    not have.
  - The choice is not saved with the exercise, and the sheet opens with none.
  - While a Category or Sub-group list is open, the name steps aside so the list has the page.
  - The matches draw at most 300 rows (a plain list, which the scrolling page can hold): "All
    exercises" shows the first 300 and "The first 300 are shown: type a name or pick a category to find
    the others."; a category's or sub-group's exercises (169 at most) all show.
  - The heart rate fields say they are optional, as the others do: "Average heart rate (optional)" and
    "Highest heart rate (optional)".
- Doc changes: REQ-TRN-003; `docs/data/exercise-list-sources.md`; the data model;
  `docs/architecture/constraints-and-assumptions.md` (the exercise sheet); `docs/plans/ui-redesign.md`
  (4.3); `docs/testing/slice-4-manual-testing.md`; `CLAUDE.md`. Migration `0022_exercise_places.sql`
  (`app.exercises.places`), phone schema version 16; no new build. On `fitsphere-dev`: migration 0022
  before the updated API, then `exercises:import`; only when the owner says so.

---

## D-68 Log meal holds the date's meals: Save stays, a green tick on each meal with food, no AI box
- Status: **Accepted** (owner, in chat, 2026-11-10: "Remove the card AI Meal Reading is Comming Soon
  for now"; "If I click on the save Mean I am going back whcih I do not want. Because on the same
  screen I want to add the item for theother meal as well"; "when I added al least any one food item
  in te any Mean I should be able to the green tick on that meal KPI"; "for th existing Green tick of
  Meal We nned to think what we can do"; on the canvas's proposal: "options A", "Yes I need the
  questions", "Keep the done button" (later removed, below), and "I should be able to add or remove the more foods item the
  lucch. If I remove the all luch item it should go back to non greeen state"; then "lock it" on
  "3.5 Log meal · save and stay · PROPOSED v2"). Numbered D-68 because D-65, D-67 and D-69 are taken
  by other work built at the same time (the Training tab, and others agreed between the sessions).
- Answer (the redesign's 3.5, changed):
  - The "AI meal reading is coming soon" box is left out of Log meal for now. AI meal reading is
    still slice 7 (D-26), and its switch in Settings stays.
  - Log meal holds the date's four meals. A meal tapped shows its foods on that date: the ones saved
    before and any added now. Foods can be added to it or removed from it there. Each meal keeps its
    changes while another is on show.
  - **Save stays on the screen.** It saves every meal changed, and its name says what it saves
    ("Save lunch"; "Save 2 meals"). Then the footer says what was saved in green ("Lunch saved · 2
    foods · 592 kcal"; "Lunch removed"; "Lunch and Snack saved") over Save, greyed until the next
    change; the meal stays on show and the cue says "Next: tap another meal". With nothing to save,
    Save is greyed, with "Add at least one food to save the meal." when the meal on show has none.
    The back arrow leaves. The Done the canvas showed was removed the same day (owner, in chat,
    after a phone test: "remove the done bottom most done button it is not required").
  - A meal with food has a **green tick** in its corner, ringed in the page colour, read out as "has
    food". Remove every food of a meal and its tick goes at once; the footer then says "Lunch has no
    foods now. Saving removes it from Tue 10 Nov.", and Save removes the meal.
  - **Option A:** no step turns green; a step keeps its number, on caramel for the one to do now. The
    chosen meal is filled in caramel, with no tick of its own.
  - **The leave question:** back with changes not saved asks "Lunch isn't saved" ("2 meals aren't
    saved"), "You changed Lunch. Save it before you leave?", with Save lunch and "Leave without
    saving". Another date asks the same, "before you change the date?", with "Don't save". Its icon
    and title are in one line, and both buttons are the sheet's width, centred (owner, in chat, after a
    phone test: "I want that icon and label should be in the same line. and Button Leave wothout
    Saving should be proper aligned").
- MVP defaults:
  - A meal type with two meals saved on one date (from before, or a saved meal logged to it) shows
    their foods as one list. On Save each saved food stays in its own meal; a food added, or changed
    on its page, goes to the newest; a meal left with no foods is removed. The photo field is the
    newest meal's photo.
  - Foods added before any meal is chosen join the meal tapped next (as a saved meal's foods join its
    own meal); Save then needs a meal, as before. Back with them asks "Your foods aren't saved", with
    "Choose the meal" and "Leave without saving".
  - Editing a meal from its pencil changes that one meal, as before: its type can change, Save goes
    back, and the meals show no ticks; back with a change asks "You changed this meal. Save it before
    you leave?".
  - Nutrition's "+" on a meal opens that meal with its foods, so a food added joins it rather than
    making another meal of that type.
- Phone app only: no server change, no migration, no new build. Doc changes: REQ-LOG-001,
  REQ-LOG-004; `mvp-scope.md` (slice 3); `meal-logging-slice.md`; `ui-redesign.md` (3.5);
  `constraints-and-assumptions.md` (Log meal).

---

## D-69 Create a saved meal in Saved, under the user's own name; a saved meal keeps no meal
- Status: **Accepted** (owner, in chat, 2026-11-10: "in the Nutrition tab's Saved tab I should be able
  to create a custom Meal and saved it as the custom name so that I log it everytime quickly", with the
  example of a Monday breakfast of 4 eggs, 1 glass of milk, 2 roti and 2 sabzi; then, on the first
  design: "when the User click on the Create saved meal there should be input to ask for the custom
  name which is mandatory. than There should be otions add the multiple items To add the new item it
  should works same as the search functionality. I do not want to track the saved food to specfic mean
  like Breakfast, Lunch, Dinner , and snack. User is free to add any saved meal to any mean"; the
  second design, "PROPOSED v2" on the redesign canvas, approved with "ok start building this").
  Numbered D-69 because D-67 (the exercise library) and D-68 (Log meal) were taken by work built at
  the same time.
- Answer:
  - **Create a saved meal**, a button at the top of Nutrition › Saved, asks the meal's **name first**
    ("New saved meal"; required: "Next: add foods" waits for it). The new screen ("New saved meal")
    shows the name, with a pencil to change it, and the foods: **Add food** opens Search foods, as in
    Log meal (recent foods, search, a food's page, your own food), as many times as needed; each food's
    pencil changes its amount on its page, or removes it (D-64). **Save meal** keeps it in Saved.
  - **Each saved meal can be changed**: its pencil, beside the bin, opens the same screen ("Edit saved
    meal", **Save changes**): name, foods and amounts.
  - **A saved meal keeps no meal** (Breakfast, Lunch, Snack or Dinner), whether made here or saved
    from a logged meal with the bookmark. Tapping it in Saved asks the meal each time ("Log Monday
    breakfast", none chosen; **Log meal** waits for one). This replaces Q-036's MVP default (the slot it
    was saved from).
  - **Log it as it is, or change it first** (owner, in chat, 2026-11-10: "it should be both If the User
    want to change it He can change and He can directly logged"): **Change amounts first**, on the same
    sheet, opens Log meal on the selected date with the saved meal's foods and the meal chosen, if one
    was, under a note "From Monday breakfast · Change what you need for this day. Your saved meal stays
    as it is." What is changed there is that day's meal only.
  - **The same foods are not saved twice** (owner, in chat, 2026-11-10: "Stop create the duplicate
    one"): saving foods and amounts, in any order, that are already a saved meal says "Already in my
    meals · These foods and amounts are already saved as …", with Go to Saved, and makes no copy, as
    the bookmark does (REQ-SAVED-001).
  - The sheets for the name, logging a saved meal and "Already in my meals" have their tile beside the
    title, on one line (owner, on the canvas, 2026-11-10).
- MVP defaults:
  - When the user logs a saved meal, the meal is chosen each time; none is guessed from the time of
    day. Log meal's Saved meals tile adds a saved meal's foods to the meal being logged and no longer
    chooses its meal.
  - A saved meal's name may repeat another's; only the same foods and amounts are stopped.
  - A saved meal's tags (hidden until coaches, D-40) are kept when it is changed, and are carried into
    the day's meal by Change amounts first, as by Log meal.
  - Leaving the screen without saving keeps nothing, as Log meal does.
- Server: `savedMeal.set` no longer needs `mealType`; one sent by an older phone (still in its outbox)
  is accepted and not kept, and the pull no longer sends it. Migration `0023_saved_meals_any_meal.sql`:
  the saved meal's content rule no longer asks for a meal type; the column stays, unused, and is
  cleared when a saved meal is saved again. Applied on `fitsphere-dev` at the owner's word on
  2026-11-10. The exercise library's `0022_exercise_places.sql` (D-67), already applied there, comes
  with this change word for word, as the migration runner needs every applied migration.
- Phone: schema version 17: `saved_meals` made again without `meal_type`, every saved meal copied,
  those waiting to sync too. Version 16 is the exercise library's (D-67), included word for word, as
  the owner's phone may have it already. No new build. The foods of a
  meal being put together (adding, "Already in this meal", changing one) are shared by Log meal and the
  saved meal screen (`components/MealFoods.tsx`).
- Doc changes: REQ-SAVED-001, REQ-SAVED-002, new REQ-SAVED-003; Q-036 in `mvp-scope.md` and
  `constraints-and-assumptions.md`; J-03; the data model and `api-conventions.md`; the redesign plan
  (3.3, 3.3b); CLAUDE.md.

## D-70 Insight for each meal and the day; daily carbs, fat and fibre targets
- Status: **Accepted** (owner, in chat, 2026-11-10: "In the Butritions tab I need one more action
  called Insight for the Each Meal like Lunch, Breakfast and so on", with three points: the calories
  eaten in each meal, the target being for the whole day only; protein, fat, carbs and fibre eaten
  against their targets, with carbs, fat and fibre targets added to Your targets; and the top foods
  for each nutrient, per meal and for the whole day separately. On the canvas: "I want the Insight as
  the Icon Before the edit icon on the each meal of the day. when i click on this icon rest of the
  flow is ok. and Insight tab is fine for now. 6.2 Desing screen is locked"; then "1 Fine for now",
  "2 remove it" (the Eaten card's Insight link); and the ranges below: "approve").
- Answer:
  - **Insight icon** (a pie chart) on each logged meal's card in Nutrition › Consumed, **before
    Edit**. It opens the new **Insight** page on that meal's type and date; two breakfasts both open
    Breakfast. Saved meals have none, and the Eaten card has no Insight link.
  - **The Insight page** (a pushed screen, "Insight"): the date, then five tiles, Day, Breakfast,
    Lunch, Snack, Dinner (Log meal's tiles, a green tick on each meal with food), to switch without
    going back. Then:
    1. **Calories:** the meal's (or the day's) kcal and its share of the daily calorie target; a bar
       of the day split by meal (the chosen meal in caramel); each meal's kcal and "Left today" or
       "Over today". **No budget per meal**: the targets stay daily.
    2. **Against your daily targets:** protein, carbs, fat and fibre, each "X g of Y g" with a bar and
       the percentage; for a meal, its part solid and the rest of today faded; "N g left today", or
       "N g over today" in gold (Q-022's colour). With no target: "No daily target" and **Set a
       target**. A food with no value for a nutrient is named ("… has no fibre value.").
    3. **Top foods:** Calories, Protein, Carbs, Fat or Fibre; the five foods that gave the most,
       largest first, with the amount, the value and the share, then "Show all N foods". On the whole
       day, the same food eaten in several meals is one row, its amounts added and its meals named.
  - **Your targets** (6.2, locked again): three more, **Daily carbs**, **Daily fat** and **Daily
    fibre**, in whole grams, as tiles like the others; the tiles in two groups, **Food** (calories
    across the row, protein, carbs, fat, fibre) and **Activity and body** (steps, weekly workouts,
    body weight across the row).
  - **Allowed values** (proposed, then approved): carbs 10 to 1,000 g, fat 5 to 500 g, fibre 5 to
    100 g.
- MVP defaults:
  - Insight reads only what is on the phone (the date's meals and the targets), so it works offline;
    it shows numbers only, no advice.
  - A food that gave none of the nutrient chosen is not in Top foods; one with no value for it is
    left out and named. The same food is one listed food (its source and code; a food the user
    entered, by its name); amounts in the same unit are added, others listed with "+".
  - A meal with nothing logged shows "Nothing logged for Snack on …" and **Add to Snack** (Log meal
    for that meal and date).
  - Grams on Insight show one decimal at most ("25 g", "6.3 g").
- Server: `target.set` takes `carbs`, `fat` and `fibre`. Migration `0024_nutrient_targets.sql`
  replaces `app.targets`' two checks (the kinds and each kind's range). **On `fitsphere-dev`:
  migration 0024 before the updated API; only when the owner says so.** Until then, a carbs, fat or
  fibre target syncs as "Not saved".
- Phone: no schema change (the phone's targets table does not check the kind); no new build. An older
  copy of the app cannot read the new kinds from the sync; only test phones exist.
- Doc changes: new REQ-NUT-005 and REQ-NUT-006, REQ-ROLE-007; the data model and
  `api-conventions.md`; the plan `docs/plans/meal-insight.md`; the redesign plan (3.1, 3.10, 6.2);
  CLAUDE.md.

---

## D-71 The workout timer: Start workout, Pause and Resume, Mark done, today only
- Status: **Accepted** (owner, in chat, 2026-11-10: "in the log workout of the Training tab I want to
  have a start work button where when the User click it shows a stopwatch/timer that count time in
  minutes and seconds and when the work out has been done user can marke this workout done. and total
  time is calculated. User can stop the timer and resume at the any time. this is enable for the today
  date only."; the plan `docs/plans/workout-timer.md` and the canvas's "4.2 A workout · PROPOSED
  (D-71): the workout timer", version 66, approved and locked with "approve, lock it"). Numbered D-71
  because D-70 (the meal insight) was taken by work built at the same time.
- Answer:
  - **Start workout**: a workout of today has a bar at the foot of its screen with **Start workout**.
    Tapped, the bar shows **Workout time** counting up in minutes and seconds ("12:34"; from an hour,
    "1:05:12"), a green **Running** tag, **Pause** and **Mark done**.
  - **Pause and Resume** at any time: paused, the time stops, the tag turns gold, **Paused**, and
    Pause becomes **Resume**, which counts on from where it stopped.
  - **Mark done** stops the timer and the bar goes; under the title a green panel says **Done · total
    time 52:40**: the time counted, pauses left out. A **Resume** on the panel, on a workout of today,
    undoes a Mark done tapped by mistake and counts on.
  - **Today only**: a workout of another date has no Start workout and no bar; a timed one shows its
    done panel without Resume.
  - On **Training**, in By day and All workouts, a timed workout's row says **Running · 12:34**
    (green, counting), **Paused · 31:08** (gold) or **Done · 52:40**.
- MVP defaults:
  - A timer already started can be paused, resumed and marked done whatever the date, so a workout
    that runs past midnight can be finished; it stays on the date it was logged to.
  - The time comes from the phone's clock: leaving the screen, closing the app or turning the phone
    off does not stop it. A clock set back takes no time away; a timer shows 24 hours at most.
  - Mark done is not required: the workout is still saved at every change (D-29), and a workout logged
    without the timer stays as it was. Mark done with no exercise is allowed and keeps the time.
  - A workout whose timer has started is **listed** on Training and in Home's day sheet before its
    first exercise ("No exercises"), so a running workout is never lost; this changes D-65's "a workout
    with no exercise is not listed" for timed workouts only. It still **counts toward the week only once
    it has an exercise** (D-41, unchanged).
  - Each workout has its own timer; two may run at once. Deleting a workout deletes its timer.
  - Not in this change: Reset to 0:00, laps and rest timers, sound or vibration, a lock-screen timer
    (it needs a native module and a new build), the time on Home, typing the total by hand, using the
    time to estimate calories.
- Server: `workout.set` takes `timer` (`startedAt`, `countedSeconds` 0 to 86,400, `runningSince`,
  `doneAt`; never running and done at once), or null; a change without it, from an app before D-71,
  keeps the timer stored. The pull and `GET /v1/users/{userId}/workouts` send it. Migration
  `0025_workout_timer.sql`: four columns on `app.workouts`, with checks; a deleted workout has none;
  `0026_workout_timer_count.sql` makes the count required once the timer has started (0025's rule let
  a start with no count through). Any database needs migrations 0025 and 0026 before this API runs.
- Phone: schema version 18, a `timer` column (JSON) on `workouts`; workouts stored before have none.
  JavaScript only: no new build.
- Doc changes: REQ-TRN-003 and REQ-TRN-004; the data model and `api-conventions.md`; the redesign plan
  (4.1, 4.2); `constraints-and-assumptions.md`; the slice 4 manual test guide (S4-22 to S4-26);
  CLAUDE.md.

---

## D-72 Search foods searches less often
- Status: **Accepted** (owner, in chat, 2026-11-11, after a speed test of Search foods and a list of
  ways to make it faster: "lets implement the A. Search less often. regarding the 3 point that if our
  db has food with the item length of 1,2 than they alos should be appear when the search").
- Answer:
  - **A pause before searching**: the phone searches once typing pauses for a moment, not at every
    letter, so a word typed quickly is searched once. The results of the text before stay on the
    screen meanwhile; "No foods found" shows only once the search for the text typed is done.
    Emptying the box, or its cross (D-57), clears the results at once.
  - **One search at a time**: a search waits for the one under way to finish, and only the latest
    text waits; texts typed in between are never searched.
  - **Three characters or more** (spaces not counted) search as before (D-62, D-66). With one or two,
    a food is listed only when its whole name, a packaged food's brand, or one of a food's other names
    is exactly what was typed, ignoring case and marks: "h" finds the product named H, "on" the brand
    ON's products, "go" Go's cheese, "id" iD's. A line above them says "Type 3 letters or more to
    search all foods."
- Why: on the PC, with the food list as the phone holds it (7,300 foods and 9,775 packaged foods), one
  letter took 210 ms of search work for up to 15,600 foods and 263 ms until the screen showed them;
  three letters or more took 11 to 37 ms. Typing "paneer butter masala" ran 20 searches, 572 ms of
  work in all. After this change one or two characters take about 9 ms, and that text typed without
  stopping is searched once (about 22 ms). The phone itself was not measured.
- MVP defaults: the pause is 250 ms; marks alone (such as "-") find nothing; a search already under
  way is not stopped, its results are dropped when the text has changed.
- Phone app only: no server change, no migration, no new build, no phone schema change. Doc changes:
  REQ-LOG-007; `constraints-and-assumptions.md` (More foods); D-57 and D-66 point here.

---

## D-73 Search foods: the results 200 at a time, each food read in full only when opened
- Status: **Accepted** (owner, in chat, 2026-11-11: "now implemet 4. Show the first 100 or so rows,
  and load more as you scroll., 5. Read only what the list shows."; then, told that after D-72 these
  would save little time on the PC and could change a name's brand row while scrolling: "Build Both 4
  and 5. My core Idea is End User should not feel like the when He scroll down he should be wait too
  much than loads. loading of the data should be smooth. and Initial screen must be filled by the
  result if the search text has more result. for this if it is necessaary to load the 200 items once
  instead of 100 fell free to load.").
- Answer:
  - **The results 200 at a time**: the list shows the first 200 rows of results; when its end is
    near (about two screens away), it adds the next 200, until every match is listed (D-66). A new
    search starts again at its first 200.
  - **No waiting while scrolling**: the rows added come from the results the search already found,
    so scrolling never searches again. Every match is still put in order (D-51, D-66) and a name's
    brands grouped (D-61) before the first row shows, so a row such as "Sandwich Bread · 5 brands" is
    whole from the start and never changes while scrolling. (Not chosen: reading each 200 from the
    database as the list scrolls, which would search again for every page and could show a name with
    fewer brands until the rest came.)
  - **The first screen filled**: the first 15 rows are drawn at once, more than the tallest phone
    shows.
  - **Each food read in full only when opened**: for the list, the search reads of each food only what
    its row needs (its name, brand, kcal and whether its values are estimated); its other names,
    servings and household units are read when its page opens. Packaged foods, dishes and My foods
    were already read this way.
- Why: after D-72 the biggest searches (three letters such as "chi", about 1,400 foods) took 23 to 33
  ms on the PC, most of it finding the matches; reading less for each food made no difference that
  could be measured on the PC, and showing 200 rows at a time does not change the search's time. The
  change is for scrolling that never waits and rows that never change; the phone was not measured.
- MVP defaults: 200 rows a time; more added two screens before the end; 15 rows drawn first; a food
  that has left the food list between the search and the tap (a new list downloaded meanwhile) does
  not open.
- Phone app only: no server change, no migration, no new build, no phone schema change. Doc changes:
  REQ-LOG-007; `constraints-and-assumptions.md` (More foods); D-66 points here.

---

## D-74 The phone keeps the food list in memory between searches
- Status: **Accepted** (owner, in chat, 2026-11-11, from the list of search speed-ups not yet done:
  "Lets build: Bigger memory cache on the phone").
- Answer: the phone's database keeps up to **8 MB** of its pages in memory, read and decrypted, in
  place of SQLite's default of about 2 MB. A food search reads the whole food list, about 2.4 MB (1.3
  MB of foods and 1.1 MB of packaged foods, as the phone holds them on 2026-11-11), which did not fit:
  each search pushed out pages the next one needed, so most of the list was read from storage and
  decrypted again at every search. Now it is read once and stays.
- Why: on the PC, with an unencrypted copy of the phone's database, searches took 4 to 5 ms less with
  the larger cache ("dal" from about 13 ms to about 9 ms, "chi" from about 18 ms to 14 ms, "paneer" from
  25–29 ms to about 20 ms). On the phone the decrypting saved comes on top; the phone was not measured.
- Privacy: as before, decrypted pages are only in the app's own memory while it runs; nothing is
  written to storage unencrypted (ADR-0007 rule 5).
- MVP defaults: 8 MB, about three times the food list today, so it still fits as the list grows; the
  memory is used only as pages are read (about 3 MB for the whole database today). Set after the key,
  at each start; it lasts as long as the connection.
- Phone app only: no server change, no migration, no new build, no phone schema change. Doc changes:
  the data model ("On the phone").

---

## D-75 Search foods orders its results in one pass
- Status: **Accepted** (owner, in chat, 2026-11-11, from the list of search speed-ups not yet done:
  "Explain The part Cheaper ordering implement this").
- Answer: the results keep **exactly the same order** (D-51 the exact match first; D-66 the four
  groups; inside each, the order by source). The phone now works the order out in one pass over the
  results, reading each name once for each test, where it used to make two passes and read each name
  three times (once for the groups, twice for the exact match; a packaged food has two names, its own
  and its brand with it).
- Why: on the PC, with the food list as the phone holds it, putting "chi"'s 1,391 results in order
  took about 4 ms in place of 6.5, "rea"'s 1,188 about 3.5 in place of 5.5, "milk"'s 733 about 2 in
  place of 3.2: about a third less, the same order checked on each. The phone was not measured. Not
  done: reading the order from each food's ready-made search text, which saved under 1 ms more and
  would have meant carrying that text with every result.
- Phone app only: no server change, no migration, no new build, no phone schema change; no change to
  any requirement.

---

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