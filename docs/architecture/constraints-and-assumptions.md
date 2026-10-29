# Constraints and Assumptions

- Status: Draft
- Owner: Project owner (D-01)
- Last updated: 2026-10-28 (D-20: the MVP is the Personal Training User view only)

Confirmed facts, assumptions and open questions are kept in separate sections. Nothing under
**Assumptions** or **Open questions** is a requirement until the owner confirms it.
D- numbers refer to the owner decisions in
[`owner-decisions-2026-10-27.md`](../product/owner-decisions-2026-10-27.md).

**MVP (D-18):** open questions answered for the MVP are marked **MVP default** below. The owner's
defaults are in [`mvp-scope.md`](../product/mvp-scope.md#4-mvp-defaults-for-open-questions)
section 4; defaults chosen by Claude Code under D-18's rule are in
[MVP defaults](#mvp-defaults-d-18). Post-MVP work is in [`backlog.md`](../product/backlog.md).
Since D-20 the MVP is the Personal Training User view only; questions about Coach and Head Coach
views keep their rows but block only post-MVP work.

## Hard constraints
| ID | Constraint | Source / reason |
|---|---|---|
| C-001 | The BRD (`docs/product/source/business-requirements.txt`) is the functional baseline; changes go through `requirements.md`. | Project process |
| C-002 | Role and hierarchy rules (self / coach→trainees / head coach→coaches) must be enforced by the server, not only by hiding UI. | BRD §1.3 permissions; REQ-NFR-001 |
| C-003 | The app processes body, health and meal data, including photos. Phase 1 serves users in India only (D-09), so India's Digital Personal Data Protection Act 2023 is the primary law to check. Legal must confirm the obligations before real users (Q-049). | BRD §11; REQ-NFR-002; D-09 |
| C-004 | No meal text, photo, voice or label may reach an AI service without the user's recorded consent. | BRD §8, §11; REQ-ACC-004 |
| C-005 | Food database, barcode and saved-meal logging must work with AI off. | BRD §11; REQ-ACC-005 |
| C-006 | Phase 1: all users are in India; days are computed in Asia/Kolkata. | BRD §2; REQ-DATE-004; D-09 |
| C-007 | The UI pattern is mobile: bottom navigation, bottom sheets, camera, microphone and barcode scanning. The client must support these device capabilities. | BRD §1, §4, §8 |
| C-008 | Budget: free tiers first. These paid items need project-owner sign-off: Apple Developer Program (US$99/year, required for TestFlight and the App Store — needed only at iOS release, D-10); Google Play developer account (US$25 one-time; new personal accounts must meet testing requirements before production release); AI meal parsing (per-request cost after any free tier, ADR-0005); Supabase Pro (from US$25/month) — **not approved for phase 1**, which runs on the Free plan; reviewed when an R-005 trigger is hit (D-16); a domain for FitSphere's email, needed for SPF, DKIM and DMARC (D-13; ADR-0004, roughly ₹800–1,500/year — confirm at purchase). Prices verified 2026-10-27 — recheck before paying. | D-03, D-10, D-16, D-18 |

## Quality targets
- Performance, availability/reliability and accessibility: **MVP default (D-18, Q-050)** — no
  numeric targets for the MVP; the app must be usable on a low-end Android phone
- Security/privacy: C-002, C-003, C-004; detailed controls in [`data-and-threat-model.md`](../security/data-and-threat-model.md) (Draft)
- Budget/licensing: free tiers first; paid items need owner sign-off (C-008) — affects AI provider, food database and hosting choices
- Deployment/network/region: Mumbai — Supabase for the database and file storage, Google Cloud
  Run for the API (ADR-0002, ADR-0003, D-17). Legal still to confirm data-residency obligations
  (C-003, Q-049)
- Scale: **aspiration, not a capacity target** — FitSphere aims to support up to 20 million users
  in the long term (D-15). Phase 1 starts on free tiers (C-008). ADR-0002 and ADR-0003 must
  explain how the chosen backend and database can grow toward this without a rewrite, and what
  each stage would cost.

## Assumptions
| ID | Assumption | Evidence | Confidence | Owner |
|---|---|---|---|---|
| A-001 | Phase 1 clients are Android and iOS apps, Android first: iOS testing and release wait until an iPhone is available (D-10). No web app for trainees. Coaches and Head Coaches use the same mobile app; a web dashboard for coaches is post-MVP (D-18, Q-068). | Owner decisions D-02, D-10, D-18 | Confirmed (D-02, D-18) | Project owner (Q-051) |
| A-002 | One account can hold several roles at once (e.g. a Coach who is also a Personal Training User). | BRD "switch between roles available to them" | High | Project owner |
| A-003 | Each trainee has at most one coach; each coach at most one head coach. Either side may leave at any time. | Owner decision D-11 ("for now") | Confirmed (D-11) | Project owner (Q-072) |
| A-004 | Users can edit and delete their own logged meals and entries. | Not in BRD; needed for usable logging. D-16: a user may delete their own meal photo or nutrition-label image, and it is really removed. D-18: the meal "•••" menu offers Edit and Delete (Q-032 default) | Confirmed for meals in the MVP (D-18) and for photos and label images (D-16); other entries Medium | Project owner (Q-032) |
| A-005 | Diet plan tab has an empty state when no plan exists. | By analogy to Training. D-20 sets its text: "No diet plan yet. Your coach will add one here." | Confirmed (D-20) | Project owner |
| A-006 | AI-parsed meals are shown for review and saved only after the user confirms. | Not in BRD; reduces wrong logs. In the MVP table: "review before saving" (D-18) | Confirmed (D-18) | Project owner |
| A-007 | AI consent is off by default and each change is timestamped. | BRD "asked for consent before"; C-003 | Medium | Project owner + Legal |
| A-008 | Email and password is the only sign-in method in phase 1. | Owner decision D-05 | Confirmed (D-05) | Project owner (Q-047) |
| A-009 | English-only for first release. | BRD is in English; no localisation mentioned. MVP default: English only (Q-054, D-18) | Confirmed for the MVP (D-18) | Project owner (Q-054) |

## MVP defaults (D-18)
Under D-18, when an open question that does not block safety or privacy has no answer in
[`mvp-scope.md`](../product/mvp-scope.md#4-mvp-defaults-for-open-questions), Claude Code picks the
simplest option that keeps every invariant and records it here (and in the pull request). The
owner can change any of them. The owner's own defaults are in `mvp-scope.md` section 4. The owner
confirmed the defaults below on 2026-10-27 (D-18 answer 11), except a row marked
*not yet confirmed*.

| Question | MVP default | Applied in |
|---|---|---|
| Q-015 Steps and sleep input | Typed in by the user; sleep in hours with one decimal (with the Q-028 default). Health-platform sync is post-MVP | REQ-HOME-006, ADR-0006 |
| Q-060 Plans and targets after a link ends | The trainee keeps them, read-only and labelled with their author; with no coach, the trainee may set their own calorie and protein targets (Q-016) | REQ-ROLE-005, REQ-ROLE-014, REQ-ROLE-015 |
| Q-062 AI review list | Each item with its quantity, kcal and protein; AI estimates marked "estimated" | REQ-LOG-009, ADR-0005 |
| Q-065 Consent record | On/off, the time and the version of the consent text shown; one toggle covers typed or spoken text, photos and labels. Legal confirms (Q-049) | REQ-ACC-004, ADR-0005 |
| Q-073 Resend and cancel details | Post-MVP with invitations (D-20). A resend replaces the earlier invitation, which can no longer be accepted; a cancelled invitation can no longer be accepted; resends count toward the 20-a-day limit; no separate cap on pending invitations; a declined invitation shows as pending until it expires | REQ-ROLE-017, ADR-0004 |
| Q-075 Simultaneous edits | The change the server receives last wins; the label shows its author and time. Finer handling is post-MVP | REQ-ROLE-004, REQ-ROLE-006, ADR-0007 |
| Q-077 Offline split | ADR-0007 rule 6, which refines the D-04 split | REQ-NFR-004, ADR-0007 |
| Q-080 Unverified accounts, link validity | An account must verify its email before it can sign in; verification and reset links expire within 24 hours | REQ-ACC-010, ADR-0004 |
| Diet plan totals | The coach types each option's kcal and protein | REQ-PLAN-008 |
| Training plan fields | Per exercise: name, sets × reps, optional note, optional how-to link | REQ-TRN-006 |
| Average calories period | The last 4 weeks, averaged over days that have entries | REQ-PRG-002 |
| Barcode not found | The user types the label values; they are saved with that meal only | REQ-LOG-007, ADR-0006 |
| AI readings | At most 15 per user per day; a hard monthly cap in the AI module | REQ-LOG-009, ADR-0005 |
| Push and log out | Post-MVP with push (D-20). Push text carries no health data; logging out removes the phone's push token | REQ-ROLE-016, ADR-0004 |
| 30-day clear | Runs when the app starts or returns to the foreground | ADR-0007, T-06 |
| Record of the 18+ confirmation | The account stores when the "I am 18 or older" confirmation was given and which version of its text was shown, as for the consent record (Q-065). *Not yet confirmed: added after answer 11* | REQ-ACC-010 |
| Neutral sign-up and reset texts | Sign-up: "Check your email. If this address can be used for a new account, we've sent a link to finish signing up." Reset: "If an account uses this address, we've sent a link to reset the password." *Not yet confirmed: added with the Skeleton contracts* | REQ-ACC-010, error model |
| Roles of a new account | Account setup turns on the Personal Training User role; Coach and Head Coach are turned on by the user (D-06) — post-MVP, since D-20 hides the role selector. *Not yet confirmed: added with the Skeleton contracts* | REQ-ROLE-001, data model |
| Log out and data on the phone | Logging out deletes the phone's local database and its key. If it holds entries not yet synced, the app warns first and deletes them only if the user confirms. *Not yet confirmed: added with the Skeleton contracts* | REQ-ACC-008, data model |
| Weight entry precision | Body weight is entered and shown with one decimal in the chosen unit; it is stored in whole grams (invariant #6). *Not yet confirmed: added with the Skeleton contracts* | REQ-HOME-006, data model |
| What each MVP slice covers | The REQs listed per slice in `mvp-scope.md` section 5; the owner set the order (D-20). Each slice's plan confirms its scope before work starts. *Not yet confirmed: added with D-20* | `mvp-scope.md` |
| App texts for failures (Skeleton step 6) | When Supabase or the API cannot answer: "Something went wrong. Try again later." A verify-email link opens "Your email is verified. Sign in to continue.", or, for an expired or used link, "This link has expired or was already used. Sign in, or sign up again for a new link." A request that never left the phone shows the named "needs an internet connection" warning instead of the neutral text, since it reveals nothing about the address. *Not yet confirmed* | REQ-ACC-010, error model |
| Body-weight unit of a new account (Skeleton step 10, plan decision 6) | kg, as the BRD's "Weight (kg)"; Home and history show kg until the Settings slice adds the setting (REQ-ACC-003). Weights are typed with at most one decimal, with a dot or a comma | REQ-HOME-006, REQ-ACC-003 |
| Sign-in email links (Skeleton steps 6 and 7) | Supabase's PKCE flow: links carry a one-time code, never tokens. The verify link only confirms the address; the app then asks the user to sign in. A reset link works only on the phone that asked for the reset; elsewhere, or once expired or used, the app says so and offers a new one. *Not yet confirmed* | REQ-ACC-010, ADR-0004 |

Not given an MVP default, because they touch privacy, security or the law: minimum age (Q-066)
and whether sign-up must use the invited address (T-05), both since answered by the owner (D-18
answers 12 and 13); Legal's review (Q-049), still open.

## Open questions
**Blocks** = what cannot be built (or finalised) until it is answered. **Owner** is the project
owner, with Legal kept separate (D-01).
**Due** = date an answer is needed by; left blank until the owner sets it.
Answered items keep their row as a record. *(F-nn)* marks a follow-up raised in the owner decisions.

### Project and scope
| ID | Question | Blocks | Owner | Due |
|---|---|---|---|---|
| Q-001 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-01). Who are the product owner, tech lead, security, QA, ops, legal, design and coach subject-matter expert (SME) owners? | Approvals of everything | Project owner | |
| Q-002 | What evidence/business case supports the product? | Nothing in build | Project owner | |
| Q-003 | Confirm proposed non-goals (payments, chat, wearables, medical advice). | Scope sign-off | Project owner | |
| Q-004 | What are the success measures and their owners? | Analytics design | Project owner | |
| Q-005 | **Partly answered (D-18, D-20):** the MVP comes first, defined in [mvp-scope.md](../product/mvp-scope.md); post-MVP work is in [backlog.md](../product/backlog.md); the MVP's slices and their order are in `mvp-scope.md` section 5 (D-20). *Still open: Must/Should/Could/Won't per REQ.* Priority (Must/Should/Could/Won't) per REQ, and release slicing. | Release plan | Project owner | |
| Q-051 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-02). Target platforms: iOS, Android, web? Minimum OS versions? *Minimum OS versions are not decided yet.* | ADR-0001 | Project owner | |
| Q-052 | Are there designs/screens for Coach and Head Coach views? (BRD describes trainee screens in detail but not coach screens.) | Coach/Head Coach UI, ADR-0001 | Project owner | |
| Q-053 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-01, D-03, C-008). Team size, skills, budget and target launch date. *Target launch date is not decided yet.* | ADR-0001..0006 | Project owner | |
| Q-054 | **MVP default — [mvp-scope.md](../product/mvp-scope.md#4-mvp-defaults-for-open-questions) (D-18):** English only. Languages and localisation needed? | i18n setup | Project owner | |
| Q-056 | **Superseded by Q-068 (F-01).** Do Coach and Head Coach tools (e.g. building diet plans with up to three options per meal) run in the same mobile app, or is a web interface needed? A-001 covers trainees only. | — | Project owner | |
| Q-068 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-18: no web dashboard in the MVP; it is post-MVP). Confirm: no web dashboard for coaches in phase 1? Building 3-option diet plans on a phone is a lot of typing. *(F-01)* | Coach plan editor, ADR-0001 | Project owner | |
| Q-076 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-10: neither; Android-first). Do you have a Mac and an iPhone for iOS testing? *(F-09)* | iOS release, ADR-0001 | Project owner | |

### Roles and hierarchy
| ID | Question | Blocks | Owner | Due |
|---|---|---|---|---|
| Q-006 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-06). Who grants Coach and Head Coach roles? BRD says Head Coach is activated "through a toggle" — can any user self-activate it? | REQ-ROLE-001, ADR-0004, threat model | Project owner | |
| Q-007 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-10). Is Personal Training User available to every account? | REQ-ROLE-001, ADR-0004 | Project owner | |
| Q-008 | **MVP default — [mvp-scope.md](../product/mvp-scope.md#4-mvp-defaults-for-open-questions) (D-18):** yes, per device. *Post-MVP: the role selector is hidden in the MVP (D-20).* Is the last active role remembered across sessions/devices? | REQ-ROLE-002, ADR-0004 | Project owner | |
| Q-009 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-06). "Add Coach/trainee": create account, email invite, invite code, or link an existing user? *Follow-ups: Q-071, Q-073.* | REQ-ROLE-003/005, ADR-0004 | Project owner | |
| Q-010 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-07). "Delete Coach/trainee": delete the account and data, or just unassign? What happens to a deleted coach's trainees and plans? *Former coach's access to past data: Q-074.* | REQ-ROLE-003/005, ADR-0003, ADR-0004 | Project owner + Legal | |
| Q-020 | Navigation layout for Coach and Head Coach views. | Coach/Head Coach UI, ADR-0001 | Project owner | |
| Q-021 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-06, D-08). What trainee "details" can a Head Coach see, and can they edit trainee plans/targets? *Targets: Q-075.* | REQ-ROLE-004, ADR-0004 | Project owner | |
| Q-013 | **MVP default — [mvp-scope.md](../product/mvp-scope.md#4-mvp-defaults-for-open-questions) (D-18, D-20):** in the MVP the user sets their own weekly workout target, target body weight and daily steps target (D-20); once coaches exist, the Coach, and a Head Coach the trainee allows, set them. Who sets the weekly workout target and the Progress "Target row" (body weight, steps)? | REQ-HOME-007, PRG-005 | Project owner | |
| Q-014 | Do target changes apply from a date forward or to past days too? | Data model, ADR-0003 | Project owner | |
| Q-016 | **MVP default — [mvp-scope.md](../product/mvp-scope.md#4-mvp-defaults-for-open-questions) (D-18, extended by D-20):** a user without a coach sets their own daily calorie, protein and steps targets, weekly workout target and target body weight. Can a self-directed user set their own targets? | REQ-ROLE-007 | Project owner | |
| Q-057 | What is the Head Coach "configuration functionality" in BRD §1.2? No requirement covers it yet. | Head Coach scope (no REQ yet) | Project owner | |
| Q-058 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-10: the record is the link). Is a "Coach record" or "trainee record" the person's user account, or a separate record (e.g. the coaching assignment) linked to an account? Can a record exist before the person has an account? See the [glossary](../product/glossary.md). | REQ-ROLE-003/005, ADR-0004, data model | Project owner | |
| Q-059 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-18: logs, read-only — meals with photos and image links, weight, steps, sleep, measurements with notes, workouts and Progress; not saved meals; an allowed Head Coach sees the same; Legal confirms before real users, Q-049). Which trainee data can their Coach see (meal logs, meal photos, body metrics, measurement notes, workouts)? Q-021 covers Head Coaches only. *Settings and AI consent: never (D-13).* | REQ-ROLE-005, ADR-0004, threat model | Project owner + Legal | |
| Q-060 | **MVP default — [chosen under D-18](#mvp-defaults-d-18):** the trainee keeps their plans and targets, read-only and labelled with their author. **Partly superseded by Q-072 and Q-074;** what remains open here is what happens to the trainee's targets and plans after removal (D-07). Can a trainee end the relationship with their coach themselves? What happens to their targets and plans, and to the coach's access to past data? | REQ-ROLE-005, data model | Project owner + Legal | |
| Q-061 | **Superseded by Q-070 (F-03).** When one account holds a coaching role and the Personal Training User role, is that person's own logged data kept separate from the hierarchy — e.g. can their Head Coach see it? | — | Project owner + Legal | |
| Q-069 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-10: notify and agree; step to specify — Q-078). **Trainee privacy:** when a Coach accepts a Head Coach, the Head Coach sees that Coach's trainees' data — but the trainees only agreed to the Coach. Should trainees be told, or asked to agree? Likely a DPDP consent issue. *(F-02)* | REQ-ROLE-010, threat model | Project owner + Legal | |
| Q-070 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-10: coaching activity only). If a Coach is also a Personal Training User, does "past activity" visible to their Head Coach include the Coach's **own** food and body logs? (Recommend: no — coaching activity only.) *(F-03)* | REQ-ROLE-010, ADR-0004 | Project owner + Legal | |
| Q-071 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-11: the system picks the channel). Confirm the reading of "new email never registered" in D-06. *(F-04)* | REQ-ROLE-008 | Project owner | |
| Q-072 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-11: one each for now; either side may leave). Can a trainee have more than one Coach, or a Coach more than one Head Coach? Can the trainee leave a coach on their own? Affects A-003. *(F-05)* | REQ-ROLE-*, ADR-0003 | Project owner | |
| Q-073 | **MVP default — [mvp-scope.md](../product/mvp-scope.md#4-mvp-defaults-for-open-questions) (D-18):** resend and cancel allowed; at most 20 invitations per user per day. Details — resends count toward the limit, no separate cap on pending invitations — are [chosen under D-18](#mvp-defaults-d-18). Invitation rules: expiry, resend, cancel, how many pending invites. *(F-06)* *Decided: daily limits (D-10); invitation-email links work once and expire after 7 days (D-13); in-app invitations also expire after 7 days (D-14).* | REQ-ROLE-008/009/011 | Project owner | |
| Q-074 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-10: no — removal ends all access). After a trainee is unassigned, can the former coach still see their past data? (Recommend: no.) *(F-07)* | REQ-ROLE-005 | Project owner + Legal | |
| Q-075 | **Partly answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-13: yes, while the trainee allows it; every change records its author and time). Can a Head Coach also change calorie/protein **targets**, or only plans? If Coach and Head Coach edit at the same time, which wins? *(F-08)* **MVP default — [chosen under D-18](#mvp-defaults-d-18):** the change the server receives last wins (ADR-0007); finer handling is post-MVP. | REQ-ROLE-004/006, ADR-0004, ADR-0007 | Project owner | |
| Q-078 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-11, REQ-ROLE-013). Specify the trainee notice-and-agreement step required before a Head Coach sees a trainee's data (D-10): what the trainee is told, how they agree or refuse, what happens if they refuse, whether they can withdraw later, and how the agreement is recorded. | REQ-ROLE-004, REQ-ROLE-010, REQ-ROLE-013, ADR-0004, threat model | Project owner + Legal | |
| Q-081 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-11: a link has no editable fields). What can a Head Coach or Coach "update" on a Coach or trainee record, now that a record is the link between two accounts (D-10)? | REQ-ROLE-003/005 | Project owner | |
| Q-084 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-13: yes, a neutral message, also on leaving). When a link ends because the coach or trainee switched to someone else, is the old Head Coach or old coach told? | REQ-ROLE-015 | Project owner | |
| Q-085 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-13: counts per coach only). What exactly is the "coaching activity" a Head Coach sees for a coach (D-10)? A coach's plans and targets are trainee data, which a Head Coach sees only with each trainee's permission (D-11) — so does it mean only counts and summaries that identify no trainee? | REQ-ROLE-004, REQ-ROLE-010, ADR-0004, threat model | Project owner + Legal | |
| Q-086 | Platform Admin (future scope, D-13): which of its rights include viewing users' personal health data, and under what controls — need-to-know only, every access logged, the user notified where the law requires (Q-049)? *Do not design the role now.* | Platform Admin role (future scope), threat model | Project owner + Legal | |

### Dates and logging
| ID | Question | Blocks | Owner | Due |
|---|---|---|---|---|
| Q-011 | **MVP default — [mvp-scope.md](../product/mvp-scope.md#4-mvp-defaults-for-open-questions) (D-18):** the currently selected date. "+" date chip: today, or the date currently selected? | REQ-NAV-003 | Project owner | |
| Q-012 | **MVP default — [mvp-scope.md](../product/mvp-scope.md#4-mvp-defaults-for-open-questions) (D-18):** meals only; the Home tiles log weight, steps and sleep. Does "+" only log meals, or also weight/steps/etc.? | REQ-NAV-003 | Project owner | |
| Q-015 | **MVP default — [chosen under D-18](#mvp-defaults-d-18):** typed in by the user; sleep in hours with one decimal; health-platform sync is post-MVP. Steps and sleep: manual entry only, or sync from Apple Health / Google Health Connect? Sleep unit? | REQ-HOME-006, ADR-0006 | Project owner | |
| Q-017 | **MVP default — [mvp-scope.md](../product/mvp-scope.md#4-mvp-defaults-for-open-questions) (D-18):** future dates are not selectable. Can users log or view future dates? | REQ-DATE-001, MEAS-002 | Project owner | |
| Q-018 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-09, phase 1: Asia/Kolkata for everyone). Default time zone; effect of changing it on existing entries; which time zone a coach sees. | REQ-DATE-004, data model, ADR-0003 | Project owner | |
| Q-030 | **MVP default — [mvp-scope.md](../product/mvp-scope.md#4-mvp-defaults-for-open-questions) (D-18):** one value per day for weight, steps, sleep and measurements; a new entry replaces it. Two measurement entries on the same date: overwrite or keep both? Same for weight. | Data model, ADR-0003 | Project owner | |
| Q-031 | **MVP default — [mvp-scope.md](../product/mvp-scope.md#4-mvp-defaults-for-open-questions) (D-18):** tags attach to a meal; the meal type is required; tagged meals show a small label in their slot. Are "Before training" and "Dessert" tags on a meal, or extra slots? Where do they show in Consumed? | REQ-LOG-003, NUT-003 | Project owner | |
| Q-032 | **MVP default — [mvp-scope.md](../product/mvp-scope.md#4-mvp-defaults-for-open-questions) (D-18):** Edit, Delete, Save to my meals; deleting a meal deletes its photo. Logged-meal "•••" menu: edit, delete, move, duplicate? | REQ-NUT-004 | Project owner | |
| Q-036 | **MVP default — [mvp-scope.md](../product/mvp-scope.md#4-mvp-defaults-for-open-questions) (D-18):** the slot it was saved from, on the selected date; the user can change the slot. Re-logging a saved meal: which slot and date does it go to? | REQ-SAVED-001 | Project owner | |
| Q-037 | **MVP default — [mvp-scope.md](../product/mvp-scope.md#4-mvp-defaults-for-open-questions) (D-18):** "Nothing logged" or "N meals logged". Full list of day logging-status labels in the date sheet. | REQ-LOG-002 | Project owner | |
| Q-038 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-18: on-device recognition only; the voice never leaves the phone, and the text reaches AI only after the server's consent check — ADR-0005). Voice: on-device or cloud speech-to-text? Is it covered by AI consent? *No audio is stored; audio storage is future scope (D-16).* | REQ-LOG-005, ADR-0005 | Project owner + Legal | |
| Q-039 | **Answered by [ADR-0006](decisions/ADR-0006-food-data.md)** (D-18): FitSphere's own food list, plus Open Food Facts for barcodes. Food database and barcode data source (licensed, open such as Open Food Facts, Indian foods such as IFCT)? | REQ-LOG-007, ADR-0006 | Project owner | |
| Q-040 | Acceptable AI parsing accuracy and how it is measured. *Measured in ADR-0005's validation; the owner decides the acceptable level.* | REQ-LOG-009, ADR-0005 | Project owner | |
| Q-062 | **MVP default — [chosen under D-18](#mvp-defaults-d-18):** each item with its quantity, kcal and protein; AI estimates marked "estimated". Does the AI review list show nutrition values per item, or only items and quantities as BRD §8 states? (REQ-LOG-009 currently reads "and nutrition values".) | REQ-LOG-009 | Project owner | |
| Q-063 | **Answered by [ADR-0005](decisions/ADR-0005-ai-meal-reading.md) and [ADR-0006](decisions/ADR-0006-food-data.md)** (D-18): the food list where an item matches, otherwise the AI's estimate, marked "estimated". Where do nutrition values for AI-parsed items come from: the AI's estimate, or a match in the food database? Meal totals (REQ-HOME-003/004, NUT-002) need them either way. | REQ-LOG-009, ADR-0005, ADR-0006 | Project owner | |
| Q-064 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-16, and the D-18 MVP default below) (D-16: a meal photo is kept as a compressed ~200 KB copy with a thumbnail, or the user pastes a public link; a user's own media is never fully deleted automatically while the account exists, but a user may delete their own meal photo or label image, and it is really removed — A-004). Are meal photos and nutrition-label images kept after parsing? If so, for how long, who can see them, and are they deleted with the meal? ([`flow.md`](../../flow.md) shows media storage.) **MVP default — [mvp-scope.md](../product/mvp-scope.md#4-mvp-defaults-for-open-questions) (D-18):** nutrition-label photos are deleted once the label is read; meal photos are kept (D-16); deleting a meal deletes its photo (Q-032). Who sees photos: Q-059, answered (D-18). | REQ-LOG-006, ADR-0002, ADR-0003, threat model | Project owner + Legal | |

### Screens and display rules
| ID | Question | Blocks | Owner | Due |
|---|---|---|---|---|
| Q-019 | **MVP default — [mvp-scope.md](../product/mvp-scope.md#4-mvp-defaults-for-open-questions) (D-18):** filled when at least one meal is logged that day. Meaning of the Home week-strip "status box". | REQ-HOME-002 | Project owner | |
| Q-022 | **MVP default — [mvp-scope.md](../product/mvp-scope.md#4-mvp-defaults-for-open-questions) (D-18):** the bar shows full in a warning colour, with the text "X kcal over". Display when eaten exceeds target. | REQ-HOME-003/004 | Project owner | |
| Q-023 | **MVP default — [mvp-scope.md](../product/mvp-scope.md#4-mvp-defaults-for-open-questions) (D-18):** opens Nutrition › Consumed for that day. "By meal": Consumed tab or separate view? | REQ-HOME-005 | Project owner | |
| Q-024 | **MVP default — [mvp-scope.md](../product/mvp-scope.md#4-mvp-defaults-for-open-questions) (D-18):** it follows the body-weight unit setting. BRD says "Weight (kg)" on Home; should it follow the kg/lb setting? | REQ-HOME-006 | Project owner | |
| Q-025 | **MVP default — [mvp-scope.md](../product/mvp-scope.md#4-mvp-defaults-for-open-questions) (D-18):** yes. Does an empty (self-directed) workout count toward the weekly target? | REQ-HOME-007 | Project owner | |
| Q-026 | **MVP default — [mvp-scope.md](../product/mvp-scope.md#4-mvp-defaults-for-open-questions) (D-18):** hidden once both waist values are logged for the current Monday–Sunday week. When is the Measurements prompt shown and hidden? | REQ-HOME-008 | Project owner | |
| Q-027 | **MVP default — [mvp-scope.md](../product/mvp-scope.md#4-mvp-defaults-for-open-questions) (D-18):** one value each. Arms/thighs: one value or left and right? | REQ-MEAS-005 | Project owner | |
| Q-028 | **MVP default — [mvp-scope.md](../product/mvp-scope.md#4-mvp-defaults-for-open-questions) (D-18):** weight 20–300 kg; steps 0–100,000; sleep 0–24 h, in hours with one decimal; measurements 10–250 cm. Valid ranges for measurements, weight, steps, sleep. | Validation | Project owner | |
| Q-029 | **MVP default — [mvp-scope.md](../product/mvp-scope.md#4-mvp-defaults-for-open-questions) (D-18):** no; X closes without a warning. Should X warn about unsaved input? | REQ-MEAS-006 | Project owner | |
| Q-033 | **MVP default — [mvp-scope.md](../product/mvp-scope.md#4-mvp-defaults-for-open-questions) (D-18):** per user. Is "Got it" dismissal remembered per user or per device? | REQ-PLAN-002 | Project owner | |
| Q-034 | **MVP default — [mvp-scope.md](../product/mvp-scope.md#4-mvp-defaults-for-open-questions) (D-18):** each option shows its own kcal and protein. *Post-MVP with diet plans (D-20).* Do kcal/protein totals change per option? | REQ-PLAN-003/004 | Project owner | |
| Q-035 | **MVP default — [mvp-scope.md](../product/mvp-scope.md#4-mvp-defaults-for-open-questions) (D-18):** "Log this option" logs it to that meal slot on the selected date. *Post-MVP with diet plans (D-20).* What does the diet-plan option action button do? (BRD: "partly visible in the screenshot, presumably to log".) | REQ-PLAN-006 (unblocked by D-18) | Project owner | |
| Q-041 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-16: a coach-provided YouTube link, unlisted or public). Exercise how-to format and who authors the exercise library. | REQ-TRN-001, ADR-0002 | Project owner | |
| Q-042 | **MVP default — [mvp-scope.md](../product/mvp-scope.md#4-mvp-defaults-for-open-questions) (D-18):** per exercise, sets × reps × weight, with an optional note. Workout log fields (sets, reps, weight, RPE, duration, rest). | REQ-TRN-003 | Project owner | |
| Q-043 | **MVP default — [mvp-scope.md](../product/mvp-scope.md#4-mvp-defaults-for-open-questions) (D-18):** 4-week change = latest weigh-in minus the weigh-in nearest 28 days earlier; weekly rate = change ÷ 4; weekly table = averages over days that have entries; the chart needs 2+ weigh-ins. Average-calories period: [chosen under D-18](#mvp-defaults-d-18). Exact formulas: 4-week change, weekly rate, average calories, weekly aggregates, minimum weigh-ins for the chart. | REQ-PRG-001..005 | Project owner | |
| Q-044 | **MVP default — [mvp-scope.md](../product/mvp-scope.md#4-mvp-defaults-for-open-questions) (D-18):** from the day the account was created, capped at the last 28 days. "Days logged out of total days": total counted from when? | REQ-PRG-003 | Project owner | |
| Q-045 | **MVP default — [mvp-scope.md](../product/mvp-scope.md#4-mvp-defaults-for-open-questions) (D-18):** the "Pre" row is post-MVP ([backlog](../product/backlog.md) B-02). Who enters the "Pre" baseline row, and when? | REQ-PRG-005 | Project owner | |
| Q-046 | **MVP default — [mvp-scope.md](../product/mvp-scope.md#4-mvp-defaults-for-open-questions) (D-18):** week details are post-MVP ([backlog](../product/backlog.md) B-02). Content of week details view. | REQ-PRG-005 | Project owner | |

### Account, security and quality
| ID | Question | Blocks | Owner | Due |
|---|---|---|---|---|
| Q-047 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-05). Sign-up, sign-in method(s), forgot password, email verification, social login? | REQ-ACC-010, ADR-0004 | Project owner | |
| Q-048 | **MVP default — [mvp-scope.md](../product/mvp-scope.md#4-mvp-defaults-for-open-questions) (D-18):** delete the user's data from the database and file storage, end all links (the other side gets the neutral message), delete the sign-in account; keep only the security logs required by REQ-NFR-005, without health data; a web page explains how to request deletion by email. Legal confirms (Q-049). Delete-account flow: what is deleted, what is retained and for how long, effect on coach links. | REQ-ACC-009 (unblocked by D-18), ADR-0003, ADR-0004 | Project owner + Legal | |
| Q-049 | Phase 1 is India only (D-09): confirm obligations under India's Digital Personal Data Protection Act 2023 — data residency, consent records and anything else needed before real users. Other laws only if users outside India are added later. *Includes how long Head Coach permission answers are kept after an account is deleted (D-13), and confirming the 1-year retention of the admin access log (D-14). Also whether the privacy warning for user-provided public links is enough, given that FitSphere cannot delete or revoke that content (D-16, R-004). Added by D-18: the AI provider may process meal data outside India (ADR-0005); the coach view (Q-059); what the delete-account default deletes and keeps, including permission answers and consent records (Q-048, Q-065). Added by D-18 answer 12: whether a self-declared "I am 18 or older" confirmation is enough, and what use by people under 18 would need (Q-066).* | Threat model, ADR-0002, ADR-0003, ADR-0005, ADR-0006, ADR-0008 | Legal | |
| Q-050 | **MVP default — [mvp-scope.md](../product/mvp-scope.md#4-mvp-defaults-for-open-questions) (D-18):** no numeric targets for the MVP; the app must be usable on a low-end Android phone. Performance, availability, accessibility (e.g. WCAG level) targets. | Test strategy, ADR-0002 | Project owner | |
| Q-055 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-04, REQ-NFR-004). Must logging work offline and sync later? *Offline/online split to confirm: Q-077.* | ADR-0001, ADR-0002, ADR-0003, ADR-0007 | Project owner | |
| Q-065 | **MVP default — [chosen under D-18](#mvp-defaults-d-18):** on/off, the time and the version of the consent text shown; one toggle covers typed or spoken text, photos and labels. Legal confirms (Q-049). What must a consent record contain beyond a timestamp (A-007): the notice version shown, which inputs it covers (text, voice, photo, label), the AI provider, and when consent was withdrawn? | REQ-ACC-004, ADR-0005 | Project owner + Legal | |
| Q-066 | **Answered for the MVP — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-18 answer 12): users must be 18 or older; sign-up requires an "I am 18 or older" confirmation. Use by people under 18 is post-MVP ([backlog](../product/backlog.md) B-16); what it would need is for Legal (Q-049). Is there a minimum age for users? If minors may use the app, what consent is required? | REQ-ACC-010, threat model | Project owner + Legal | |
| Q-067 | Which usage data may be collected to measure success (Q-004), given that health, body and meal data stay out of analytics (project invariant 7)? | Analytics design | Project owner + Legal | |
| Q-077 | **MVP default — [chosen under D-18](#mvp-defaults-d-18):** ADR-0007 rule 6, which refines the D-04 split. Confirm the offline split in D-04. *(F-10)* | REQ-NFR-004, ADR-0007 | Project owner | |
| Q-079 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-11: neutral messages). Do sign-up and password reset also avoid revealing whether an email is registered? If not, the invitation protection (D-10, REQ-ROLE-011) can be bypassed through them. | REQ-ACC-010, ADR-0004, threat model | Project owner | |
| Q-080 | **MVP default — [chosen under D-18](#mvp-defaults-d-18):** an account must verify its email before it can sign in; verification and reset links expire within 24 hours. What can an account do before its email is verified, and how long do verification and password-reset links stay valid? | REQ-ACC-010 | Project owner | |
| Q-082 | **Answered by [ADR-0004](decisions/ADR-0004-accounts-auth-and-notifications.md)** (D-18): Resend, from a domain FitSphere owns, sends invitation, verification and reset emails; buying the domain needs the owner's sign-off (C-008). Which email service and sender domain send invitation emails, on a free tier (C-008)? Should the same service send verification and password-reset emails (REQ-ACC-010)? *ADR-0004 must verify that sign-in emails come from a sender domain with SPF, DKIM and DMARC (D-16).* | REQ-ROLE-008, REQ-ACC-010, ADR-0002, ADR-0004 | Project owner | |
| Q-083 | **Answered by [ADR-0004](decisions/ADR-0004-accounts-auth-and-notifications.md)** (D-18): Expo push, with FCM credentials for Android. Which push notification service delivers in-app invitation alerts? *Expo push support is to be verified in the first slice (D-13, ADR-0001). The same service also delivers "no longer linked" messages (D-14).* | REQ-ROLE-009, ADR-0001, ADR-0002 | Project owner | |

### Hosting and media
Raised by [ADR-0002](decisions/ADR-0002-backend-and-hosting.md#open-questions-and-how-each-is-handled) (2026-10-27).

| ID | Question | Blocks | Owner | Due |
|---|---|---|---|---|
| Q-087 | Does the Google Cloud Run free tier need a billing account (card)? If so, set a budget alert (e.g. ₹500/month) before deploying. *Paid AI use (ADR-0005) needs the same billing account.* *Checked 2026-10-27: Google's docs say "A Google Cloud billing account is required to access the Google Cloud Free Tier"; whether the billing account needs a card is stated only for Free Trial sign-up. Still open: the owner approves creating the billing account and its budget alert.* | API hosting on Cloud Run, ADR-0002; paid AI, ADR-0005 | Project owner | |
| Q-088 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-16: phase 1 runs on the Free plan with no backups; accepted risk R-005, with owner-review triggers). Backups before Supabase Pro: is "no real users on the Free plan" acceptable, or do we need our own scheduled database export? | Storing real user data, ADR-0002, ADR-0003 | Project owner | |
| Q-089 | **Partly answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-16: a user's own media is never fully deleted while the account exists; an original may be replaced by a viewing-quality copy; voice audio is deleted after transcription). Media retention: how long to keep original photos, audio and (future) videos, and whether to keep only a small copy after a period? The free plan's 1 GB of file storage fills quickly. *Overlaps Q-064 for meal photos and labels. Account deletion removes the user's files (Q-048 MVP default, D-18). Still open: Legal's view (Q-049).* | Media lifecycle rules, ADR-0002, ADR-0003, ADR-0008 | Project owner + Legal | |
| Q-090 | Audio and video limits (future scope): maximum recording length, video length and resolution, and per-user storage quota (possibly tied to future premium plans, D-06)? | Audio/video release, ADR-0008 | Project owner | |
| Q-091 | Can media be stored outside India with a cheaper provider, or must it stay in India? *Part of Q-049.* | ADR-0008 | Legal | |
| Q-092 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-16: both — coaches' how-to videos, and trainees' own videos and photos after a privacy warning; accepted risk R-004; Legal note in Q-049). Which videos may use YouTube links: coaches' exercise how-to videos only, or also trainees' personal videos? | ADR-0002, ADR-0008 | Project owner + Legal | |
| Q-093 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-19 answer 6: a development tunnel, Cloudflare's Quick Tunnel, only while testing, with test data only, closed after use; its address is never committed). During development, how does the owner's phone reach the API on the PC? The PC's Wi-Fi blocks traffic between devices, and the emulator is no longer used (D-19). The options are a development-only tunnel or Cloud Run early (Q-087). Production API rules are unchanged. Not given an MVP default: it decides who can reach the API, so it touches security. | Skeleton step 2's "API: ok" check, and every later check that calls the API | Project owner | Before Skeleton step 2 is merged |

## Risks
| ID | Risk | Source | Mitigation | Owner |
|---|---|---|---|---|
| R-001 | iOS-only bugs will be found late: phase 1 is developed and tested on Android only, and iOS builds are at most compiled to check that they build. | D-10 | Compile iOS builds with EAS where useful (ADR-0001); test on a real iPhone before any iOS release. | Project owner |
| R-002 | ADR-0001 was accepted without its validation spike, so a problem with the framework — barcode scanning, audio or photo capture, offline SQLite, the iOS compile, list speed on low-end Android phones, or push notifications — may only be found once the first slices are built, when changing course costs more. | D-12 | Run the ADR-0001 checks during the first slices; the ADR's revisit conditions say when to change course. The push and iOS compile checks, first planned for the first slice (D-13), are post-MVP since D-20 (backlog B-23, B-24). | Project owner |
| R-003 | In phase 1 the operator reviews their own access: the project owner is the only operator and also the only reviewer of the admin access log, which is kept in the same backend database. **Remaining dashboard risk (D-16):** the owner can still read user data directly in the Supabase and Google Cloud dashboards, and such access does not appear in FitSphere's admin access log. | D-14, D-16 | Accepted for phase 1. The log records every admin access to user data and is reviewed monthly (REQ-NFR-005); Platform Admin controls are open (Q-086). Two-factor sign-in on Supabase and Google Cloud; the owner never browses user data in dashboards and uses only the logged admin path (D-16). | Project owner |
| R-004 | Content a user stores on YouTube or another site and adds to FitSphere as a link stays viewable by anyone who has the link — including a former coach or Head Coach after the link between them ends. FitSphere cannot delete that content or revoke access to it. | D-16, D-17 | Accepted by the owner (D-17). A privacy warning that the user must confirm before the link is saved (REQ-LOG-010); the link is hidden from the former coach or Head Coach when a link ends; exception stated in invariant #1; threat T-09; Legal to confirm the approach (Q-049). | Project owner |
| R-005 | Phase 1 runs on the Supabase Free plan with no backups (D-16): data lost on the server cannot be restored; the project may pause after 1 week without activity, making the app unavailable until resumed; limits of 500 MB database, 1 GB files and 5 GB monthly egress. **Conflicts with D-14** ("the server is the permanent record", REQ-NFR-004): without backups, the server copy itself can be lost. | D-16, D-17 | Accepted for phase 1 by the owner (D-17). The owner reviews moving to Supabase Pro (C-008) or adding backups when any trigger is hit: database over 400 MB; files over 800 MB; monthly active users near 50,000; monthly egress over 4 GB (Supabase counts cached egress separately, also 5 GB — watch both); any pause; any data-loss incident. A paused project is resumed from the Supabase dashboard ([`runbook.md`](../operations/runbook.md)). | Project owner |
| R-006 | The Skeleton pull requests (#3 to #10) were merged on 2026-10-29 with phone checks still pending: sign-up and verify, password reset, the expired token, the encrypted database file and its start-up check, the 1,000-row and 200-row checks, a rejected future date, the log-out warning, and the server copy of offline entries. A defect there may be found only after later slices build on it. | D-22 | Accepted by the owner (D-22). Automated tests cover the logic of each check and run in CI. The checks are backlog SC-01 to SC-13 and must pass before the MVP release; a failure is fixed as a defect. | Project owner |

## Major decisions needed (ADRs)
Listed in [`decisions/README.md`](decisions/README.md), which is the single record of each
ADR's dependencies; the **Blocks** column above names the same ADRs. ADR-0001 is Accepted
(D-12); ADR-0002 and ADR-0003 are Accepted (D-17); ADR-0004 to ADR-0007 are Accepted (D-18);
ADR-0008 (media storage for the audio/video release) is a planned slot.

## Suggested first slice
*(Proposal for the owner — not approved.)* The owner has since asked for the **Skeleton** slice
(2026-10-28): monorepo, CI, sign-in with the 18+ confirmation, IST dates, weight online and
offline, and the first authorization tests. Its contracts are in
[`docs/contracts/`](../contracts/) and its checks in
[`test-strategy.md`](../quality/test-strategy.md). This proposal is kept as a record until the
Skeleton plan is approved. A thin vertical slice that touches the riskiest foundations with the
fewest open questions:

1. Sign-in with email and password (REQ-ACC-010, D-05), log out (REQ-ACC-008). Country/time
   zone (REQ-ACC-006) is Won't for phase 1 (D-09).
2. Global date handling (REQ-DATE-001..004) — proves Asia/Kolkata day boundaries early.
3. Weight quick tile + body-weight unit (REQ-HOME-006 weight only, REQ-ACC-003).
4. Server-side role check scaffold for "self" access (REQ-NFR-001).

It avoids AI, food database, coach screens and Progress formulas, which have the most open questions.

The ADR-0001 checks also run in the first slices, because the spike was skipped (D-12, R-002):
Expo app on an Android phone (D-19; not the emulator), EAN-13 barcode scan, audio and photo
capture, 1,000 rows in local SQLite with the network off, and a 200-row list on a low-end
Android phone. The EAS iOS compile and the Expo push check (D-13) are post-MVP since D-20
(backlog B-23, B-24). Details and where results are
recorded: [ADR-0001](decisions/ADR-0001-mobile-client-framework.md#validation-in-the-first-slices-d-12).

The validation steps of ADR-0002 and ADR-0003 also run in the first slice (D-17): the Supabase
project in Mumbai with two-factor sign-in, the Data API turned off, a pooled database
connection, the first authorization tests (self-access only in the MVP, D-20), photo upload and
the 5-minute viewing links, log checks, and the link-constraint and query tests. Results are
recorded in each ADR.

## Revisit triggers
- A change to team, platforms or budget (D-01 to D-03) — revisit all stack ADRs.
- Users outside India (future scope, D-09) or a regulated-health partner — revisit C-003,
  C-006, REQ-DATE-004, project invariant 5 and hosting.
- An iPhone becomes available — start iOS testing (R-001, ADR-0001).
- More than one coach per trainee, or Head Coach per coach (D-11 says "for now") — revisit
  REQ-ROLE-015, the data model and the permission matrix in the threat model.
- Adding wearables/health sync — new integration ADR.
- Switching or adding an AI provider — revisit ADR-0005 and consent text.
- The owner changes an MVP default or moves a backlog item into a release (D-18) — update
  `mvp-scope.md` or this file, `backlog.md` and the affected REQs.
- An R-005 trigger is hit (database over 400 MB, files over 800 MB, monthly active users near
  50,000, monthly egress over 4 GB, any pause or data-loss incident) — owner reviews Supabase Pro
  or backups (D-16, C-008).
- Monthly active users reach 250,000 — start the capacity and cost model required before
  stage 3 of the ADR-0002 and ADR-0003 growth paths (D-15, D-16).
