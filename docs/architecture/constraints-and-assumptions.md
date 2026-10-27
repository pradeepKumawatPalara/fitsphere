# Constraints and Assumptions

- Status: Draft
- Owner: Project owner (D-01)
- Last updated: 2026-10-27

Confirmed facts, assumptions and open questions are kept in separate sections. Nothing under
**Assumptions** or **Open questions** is a requirement until the owner confirms it.
D- numbers refer to the owner decisions in
[`owner-decisions-2026-10-27.md`](../product/owner-decisions-2026-10-27.md).

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
| C-008 | Budget: free tiers first. These paid items need project-owner sign-off: Apple Developer Program (US$99/year, required for TestFlight and the App Store — needed only at iOS release, D-10); Google Play developer account (US$25 one-time; new personal accounts must meet testing requirements before production release); AI meal parsing (per-request cost after any free tier, ADR-0005). Prices verified 2026-10-27 — recheck before paying. | D-03, D-10 |

## Quality targets
- Performance: **Open** (Q-050)
- Availability/reliability: **Open** (Q-050)
- Security/privacy: C-002, C-003, C-004; detailed controls in [`data-and-threat-model.md`](../security/data-and-threat-model.md) (Draft)
- Accessibility: **Open** (Q-050)
- Budget/licensing: free tiers first; paid items need owner sign-off (C-008) — affects AI provider, food database and hosting choices
- Deployment/network/region: **Open** — data residency may follow from C-003 (Q-049)

## Assumptions
| ID | Assumption | Evidence | Confidence | Owner |
|---|---|---|---|---|
| A-001 | Phase 1 clients are Android and iOS apps, Android first: iOS testing and release wait until an iPhone is available (D-10). No web app for trainees. Coaches and Head Coaches use the same mobile app with no web dashboard — interpretation, to confirm (Q-068). | Owner decisions D-02, D-10 | Confirmed (D-02); coach part pending Q-068 | Project owner (Q-051) |
| A-002 | One account can hold several roles at once (e.g. a Coach who is also a Personal Training User). | BRD "switch between roles available to them" | High | Project owner |
| A-003 | Each trainee has at most one coach; each coach at most one head coach. Either side may leave at any time. | Owner decision D-11 ("for now") | Confirmed (D-11) | Project owner (Q-072) |
| A-004 | Users can edit and delete their own logged meals and entries. | Not in BRD; needed for usable logging | Medium | Project owner (Q-032) |
| A-005 | Diet plan tab has an empty state when no plan exists. | By analogy to Training | Medium | Project owner |
| A-006 | AI-parsed meals are shown for review and saved only after the user confirms. | Not in BRD; reduces wrong logs | Medium | Project owner |
| A-007 | AI consent is off by default and each change is timestamped. | BRD "asked for consent before"; C-003 | Medium | Project owner + Legal |
| A-008 | Email and password is the only sign-in method in phase 1. | Owner decision D-05 | Confirmed (D-05) | Project owner (Q-047) |
| A-009 | English-only for first release. | BRD is in English; no localisation mentioned | Low | Project owner (Q-054) |

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
| Q-005 | Priority (Must/Should/Could/Won't) per REQ, and release slicing. | Release plan | Project owner | |
| Q-051 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-02). Target platforms: iOS, Android, web? Minimum OS versions? *Minimum OS versions are not decided yet.* | ADR-0001 | Project owner | |
| Q-052 | Are there designs/screens for Coach and Head Coach views? (BRD describes trainee screens in detail but not coach screens.) | Coach/Head Coach UI, ADR-0001 | Project owner | |
| Q-053 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-01, D-03, C-008). Team size, skills, budget and target launch date. *Target launch date is not decided yet.* | ADR-0001..0006 | Project owner | |
| Q-054 | Languages and localisation needed? | i18n setup | Project owner | |
| Q-056 | **Superseded by Q-068 (F-01).** Do Coach and Head Coach tools (e.g. building diet plans with up to three options per meal) run in the same mobile app, or is a web interface needed? A-001 covers trainees only. | — | Project owner | |
| Q-068 | Confirm: no web dashboard for coaches in phase 1? Building 3-option diet plans on a phone is a lot of typing. *(F-01)* | Coach plan editor, ADR-0001 | Project owner | |
| Q-076 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-10: neither; Android-first). Do you have a Mac and an iPhone for iOS testing? *(F-09)* | iOS release, ADR-0001 | Project owner | |

### Roles and hierarchy
| ID | Question | Blocks | Owner | Due |
|---|---|---|---|---|
| Q-006 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-06). Who grants Coach and Head Coach roles? BRD says Head Coach is activated "through a toggle" — can any user self-activate it? | REQ-ROLE-001, ADR-0004, threat model | Project owner | |
| Q-007 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-10). Is Personal Training User available to every account? | REQ-ROLE-001, ADR-0004 | Project owner | |
| Q-008 | Is the last active role remembered across sessions/devices? | REQ-ROLE-002, ADR-0004 | Project owner | |
| Q-009 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-06). "Add Coach/trainee": create account, email invite, invite code, or link an existing user? *Follow-ups: Q-071, Q-073.* | REQ-ROLE-003/005, ADR-0004 | Project owner | |
| Q-010 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-07). "Delete Coach/trainee": delete the account and data, or just unassign? What happens to a deleted coach's trainees and plans? *Former coach's access to past data: Q-074.* | REQ-ROLE-003/005, ADR-0003, ADR-0004 | Project owner + Legal | |
| Q-020 | Navigation layout for Coach and Head Coach views. | Coach/Head Coach UI, ADR-0001 | Project owner | |
| Q-021 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-06, D-08). What trainee "details" can a Head Coach see, and can they edit trainee plans/targets? *Targets: Q-075.* | REQ-ROLE-004, ADR-0004 | Project owner | |
| Q-013 | Who sets the weekly workout target and the Progress "Target row" (body weight, steps)? | REQ-HOME-007, PRG-005 | Project owner | |
| Q-014 | Do target changes apply from a date forward or to past days too? | Data model, ADR-0003 | Project owner | |
| Q-016 | Can a self-directed user set their own targets? | REQ-ROLE-007 | Project owner | |
| Q-057 | What is the Head Coach "configuration functionality" in BRD §1.2? No requirement covers it yet. | Head Coach scope (no REQ yet) | Project owner | |
| Q-058 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-10: the record is the link). Is a "Coach record" or "trainee record" the person's user account, or a separate record (e.g. the coaching assignment) linked to an account? Can a record exist before the person has an account? See the [glossary](../product/glossary.md). | REQ-ROLE-003/005, ADR-0004, data model | Project owner | |
| Q-059 | Which trainee data can their Coach see (meal logs, meal photos, body metrics, measurement notes, workouts)? Q-021 covers Head Coaches only. *Settings and AI consent: never (D-13).* | REQ-ROLE-005, ADR-0004, threat model | Project owner + Legal | |
| Q-060 | **Partly superseded by Q-072 and Q-074;** what remains open here is what happens to the trainee's targets and plans after removal (D-07). Can a trainee end the relationship with their coach themselves? What happens to their targets and plans, and to the coach's access to past data? | REQ-ROLE-005, data model | Project owner + Legal | |
| Q-061 | **Superseded by Q-070 (F-03).** When one account holds a coaching role and the Personal Training User role, is that person's own logged data kept separate from the hierarchy — e.g. can their Head Coach see it? | — | Project owner + Legal | |
| Q-069 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-10: notify and agree; step to specify — Q-078). **Trainee privacy:** when a Coach accepts a Head Coach, the Head Coach sees that Coach's trainees' data — but the trainees only agreed to the Coach. Should trainees be told, or asked to agree? Likely a DPDP consent issue. *(F-02)* | REQ-ROLE-010, threat model | Project owner + Legal | |
| Q-070 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-10: coaching activity only). If a Coach is also a Personal Training User, does "past activity" visible to their Head Coach include the Coach's **own** food and body logs? (Recommend: no — coaching activity only.) *(F-03)* | REQ-ROLE-010, ADR-0004 | Project owner + Legal | |
| Q-071 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-11: the system picks the channel). Confirm the reading of "new email never registered" in D-06. *(F-04)* | REQ-ROLE-008 | Project owner | |
| Q-072 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-11: one each for now; either side may leave). Can a trainee have more than one Coach, or a Coach more than one Head Coach? Can the trainee leave a coach on their own? Affects A-003. *(F-05)* | REQ-ROLE-*, ADR-0003 | Project owner | |
| Q-073 | Invitation rules: expiry, resend, cancel, how many pending invites. *(F-06)* *Decided: daily limits (D-10); invitation-email links work once and expire after 7 days (D-13). Still open: the size of the daily limit, resend, cancel, how many pending invites, and whether in-app invitations expire too (threat T-05).* | REQ-ROLE-008/009/011 | Project owner | |
| Q-074 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-10: no — removal ends all access). After a trainee is unassigned, can the former coach still see their past data? (Recommend: no.) *(F-07)* | REQ-ROLE-005 | Project owner + Legal | |
| Q-075 | **Partly answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-13: yes, while the trainee allows it; every change records its author and time). Can a Head Coach also change calorie/protein **targets**, or only plans? If Coach and Head Coach edit at the same time, which wins? *(F-08)* *Still open: which change wins (ADR-0007).* | REQ-ROLE-004/006, ADR-0004, ADR-0007 | Project owner | |
| Q-078 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-11, REQ-ROLE-013). Specify the trainee notice-and-agreement step required before a Head Coach sees a trainee's data (D-10): what the trainee is told, how they agree or refuse, what happens if they refuse, whether they can withdraw later, and how the agreement is recorded. | REQ-ROLE-004, REQ-ROLE-010, REQ-ROLE-013, ADR-0004, threat model | Project owner + Legal | |
| Q-081 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-11: a link has no editable fields). What can a Head Coach or Coach "update" on a Coach or trainee record, now that a record is the link between two accounts (D-10)? | REQ-ROLE-003/005 | Project owner | |
| Q-084 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-13: yes, a neutral message, also on leaving). When a link ends because the coach or trainee switched to someone else, is the old Head Coach or old coach told? | REQ-ROLE-015 | Project owner | |
| Q-085 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-13: counts per coach only). What exactly is the "coaching activity" a Head Coach sees for a coach (D-10)? A coach's plans and targets are trainee data, which a Head Coach sees only with each trainee's permission (D-11) — so does it mean only counts and summaries that identify no trainee? | REQ-ROLE-004, REQ-ROLE-010, ADR-0004, threat model | Project owner + Legal | |
| Q-086 | Platform Admin (future scope, D-13): which of its rights include viewing users' personal health data, and under what controls — need-to-know only, every access logged, the user notified where the law requires (Q-049)? *Do not design the role now.* | Platform Admin role (future scope), threat model | Project owner + Legal | |

### Dates and logging
| ID | Question | Blocks | Owner | Due |
|---|---|---|---|---|
| Q-011 | "+" date chip: today, or the date currently selected? | REQ-NAV-003 | Project owner | |
| Q-012 | Does "+" only log meals, or also weight/steps/etc.? | REQ-NAV-003 | Project owner | |
| Q-015 | Steps and sleep: manual entry only, or sync from Apple Health / Google Health Connect? Sleep unit? | REQ-HOME-006, ADR-0006 | Project owner | |
| Q-017 | Can users log or view future dates? | REQ-DATE-001, MEAS-002 | Project owner | |
| Q-018 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-09, phase 1: Asia/Kolkata for everyone). Default time zone; effect of changing it on existing entries; which time zone a coach sees. | REQ-DATE-004, data model, ADR-0003 | Project owner | |
| Q-030 | Two measurement entries on the same date: overwrite or keep both? Same for weight. | Data model, ADR-0003 | Project owner | |
| Q-031 | Are "Before training" and "Dessert" tags on a meal, or extra slots? Where do they show in Consumed? | REQ-LOG-003, NUT-003 | Project owner | |
| Q-032 | Logged-meal "•••" menu: edit, delete, move, duplicate? | REQ-NUT-004 | Project owner | |
| Q-036 | Re-logging a saved meal: which slot and date does it go to? | REQ-SAVED-001 | Project owner | |
| Q-037 | Full list of day logging-status labels in the date sheet. | REQ-LOG-002 | Project owner | |
| Q-038 | Voice: on-device or cloud speech-to-text? Is it covered by AI consent? | REQ-LOG-005, ADR-0005 | Project owner + Legal | |
| Q-039 | Food database and barcode data source (licensed, open such as Open Food Facts, Indian foods such as IFCT)? | REQ-LOG-007, ADR-0006 | Project owner | |
| Q-040 | Acceptable AI parsing accuracy and how it is measured. | REQ-LOG-009, ADR-0005 | Project owner | |
| Q-062 | Does the AI review list show nutrition values per item, or only items and quantities as BRD §8 states? (REQ-LOG-009 currently reads "and nutrition values".) | REQ-LOG-009 | Project owner | |
| Q-063 | Where do nutrition values for AI-parsed items come from: the AI's estimate, or a match in the food database? Meal totals (REQ-HOME-003/004, NUT-002) need them either way. | REQ-LOG-009, ADR-0005, ADR-0006 | Project owner | |
| Q-064 | Are meal photos and nutrition-label images kept after parsing? If so, for how long, who can see them, and are they deleted with the meal? ([`flow.md`](../../flow.md) shows media storage.) | REQ-LOG-006, ADR-0003, threat model | Project owner + Legal | |

### Screens and display rules
| ID | Question | Blocks | Owner | Due |
|---|---|---|---|---|
| Q-019 | Meaning of the Home week-strip "status box". | REQ-HOME-002 | Project owner | |
| Q-022 | Display when eaten exceeds target. | REQ-HOME-003/004 | Project owner | |
| Q-023 | "By meal": Consumed tab or separate view? | REQ-HOME-005 | Project owner | |
| Q-024 | BRD says "Weight (kg)" on Home; should it follow the kg/lb setting? | REQ-HOME-006 | Project owner | |
| Q-025 | Does an empty (self-directed) workout count toward the weekly target? | REQ-HOME-007 | Project owner | |
| Q-026 | When is the Measurements prompt shown and hidden? | REQ-HOME-008 | Project owner | |
| Q-027 | Arms/thighs: one value or left and right? | REQ-MEAS-005 | Project owner | |
| Q-028 | Valid ranges for measurements, weight, steps, sleep. | Validation | Project owner | |
| Q-029 | Should X warn about unsaved input? | REQ-MEAS-006 | Project owner | |
| Q-033 | Is "Got it" dismissal remembered per user or per device? | REQ-PLAN-002 | Project owner | |
| Q-034 | Do kcal/protein totals change per option? | REQ-PLAN-003/004 | Project owner | |
| **Q-035** | **What does the diet-plan option action button do?** (BRD: "partly visible in the screenshot, presumably to log".) | **REQ-PLAN-006 blocked** | Project owner | |
| Q-041 | Exercise how-to format and who authors the exercise library. | REQ-TRN-001 | Project owner | |
| Q-042 | Workout log fields (sets, reps, weight, RPE, duration, rest). | REQ-TRN-003 | Project owner | |
| Q-043 | Exact formulas: 4-week change, weekly rate, average calories, weekly aggregates, minimum weigh-ins for the chart. | REQ-PRG-001..005 | Project owner | |
| Q-044 | "Days logged out of total days": total counted from when? | REQ-PRG-003 | Project owner | |
| Q-045 | Who enters the "Pre" baseline row, and when? | REQ-PRG-005 | Project owner | |
| Q-046 | Content of week details view. | REQ-PRG-005 | Project owner | |

### Account, security and quality
| ID | Question | Blocks | Owner | Due |
|---|---|---|---|---|
| Q-047 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-05). Sign-up, sign-in method(s), forgot password, email verification, social login? | REQ-ACC-010, ADR-0004 | Project owner | |
| **Q-048** | **Delete-account flow: what is deleted, what is retained and for how long, effect on coach links.** | **REQ-ACC-009 blocked**, ADR-0003 | Project owner + Legal | |
| Q-049 | Phase 1 is India only (D-09): confirm obligations under India's Digital Personal Data Protection Act 2023 — data residency, consent records and anything else needed before real users. Other laws only if users outside India are added later. *Includes how long Head Coach permission answers are kept after an account is deleted (D-13).* | Threat model, ADR-0002, ADR-0003, ADR-0005, ADR-0006 | Legal | |
| Q-050 | Performance, availability, accessibility (e.g. WCAG level) targets. | Test strategy, ADR-0002 | Project owner | |
| Q-055 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-04, REQ-NFR-004). Must logging work offline and sync later? *Offline/online split to confirm: Q-077.* | ADR-0001, ADR-0002, ADR-0003, ADR-0007 | Project owner | |
| Q-065 | What must a consent record contain beyond a timestamp (A-007): the notice version shown, which inputs it covers (text, voice, photo, label), the AI provider, and when consent was withdrawn? | REQ-ACC-004, ADR-0005 | Project owner + Legal | |
| Q-066 | Is there a minimum age for users? If minors may use the app, what consent is required? | REQ-ACC-010, threat model | Project owner + Legal | |
| Q-067 | Which usage data may be collected to measure success (Q-004), given that health, body and meal data stay out of analytics (project invariant 7)? | Analytics design | Project owner + Legal | |
| Q-077 | Confirm the offline split in D-04. *(F-10)* | REQ-NFR-004, ADR-0007 | Project owner | |
| Q-079 | **Answered — see [owner-decisions-2026-10-27.md](../product/owner-decisions-2026-10-27.md)** (D-11: neutral messages). Do sign-up and password reset also avoid revealing whether an email is registered? If not, the invitation protection (D-10, REQ-ROLE-011) can be bypassed through them. | REQ-ACC-010, ADR-0004, threat model | Project owner | |
| Q-080 | What can an account do before its email is verified, and how long do verification and password-reset links stay valid? | REQ-ACC-010 | Project owner | |
| Q-082 | Which email service and sender domain send invitation emails, on a free tier (C-008)? Should the same service send verification and password-reset emails (REQ-ACC-010)? | REQ-ROLE-008, REQ-ACC-010, ADR-0002 | Project owner | |
| Q-083 | Which push notification service delivers in-app invitation alerts? *Expo push support is to be verified in the first slice (D-13, ADR-0001).* | REQ-ROLE-009, ADR-0001, ADR-0002 | Project owner | |

## Risks
| ID | Risk | Source | Mitigation | Owner |
|---|---|---|---|---|
| R-001 | iOS-only bugs will be found late: phase 1 is developed and tested on Android only, and iOS builds are at most compiled to check that they build. | D-10 | Compile iOS builds with EAS where useful (ADR-0001); test on a real iPhone before any iOS release. | Project owner |
| R-002 | ADR-0001 was accepted without its validation spike, so a problem with the framework — barcode scanning, audio or photo capture, offline SQLite, the iOS compile, list speed on low-end Android phones, or push notifications — may only be found once the first slices are built, when changing course costs more. | D-12 | Run the ADR-0001 checks during the first slices, with the push check in the first slice (D-13); the ADR's revisit conditions say when to change course. | Project owner |

## Major decisions needed (ADRs)
Listed in [`decisions/README.md`](decisions/README.md), which is the single record of each
ADR's dependencies; the **Blocks** column above names the same ADRs. ADR-0001 is Accepted
(D-12); the others are not written yet.

## Suggested first slice
*(Proposal for the owner — not approved.)* A thin vertical slice that touches the riskiest
foundations with the fewest open questions:

1. Sign-in with email and password (REQ-ACC-010, D-05), log out (REQ-ACC-008). Country/time
   zone (REQ-ACC-006) is Won't for phase 1 (D-09).
2. Global date handling (REQ-DATE-001..004) — proves Asia/Kolkata day boundaries early.
3. Weight quick tile + body-weight unit (REQ-HOME-006 weight only, REQ-ACC-003).
4. Server-side role check scaffold for "self" access (REQ-NFR-001).

It avoids AI, food database, coach screens and Progress formulas, which have the most open questions.

The ADR-0001 checks also run in the first slices, because the spike was skipped (D-12, R-002):
Expo app on the Android emulator, EAN-13 barcode scan, audio and photo capture, 1,000 rows in
local SQLite with the network off, one EAS iOS compile, and a 200-row list on a low-end Android
phone. Expo push support is checked in the first slice (D-13). Details and where results are
recorded: [ADR-0001](decisions/ADR-0001-mobile-client-framework.md#validation-in-the-first-slices-d-12).

## Revisit triggers
- A change to team, platforms or budget (D-01 to D-03) — revisit all stack ADRs.
- Users outside India (future scope, D-09) or a regulated-health partner — revisit C-003,
  C-006, REQ-DATE-004, project invariant 5 and hosting.
- An iPhone becomes available — start iOS testing (R-001, ADR-0001).
- More than one coach per trainee, or Head Coach per coach (D-11 says "for now") — revisit
  REQ-ROLE-015, the data model and the permission matrix in the threat model.
- Adding wearables/health sync — new integration ADR.
- Switching or adding an AI provider — revisit ADR-0005 and consent text.
