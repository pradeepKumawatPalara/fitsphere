# Constraints and Assumptions

- Status: Draft
- Owner: Tech lead (Q-001)
- Last updated: 2026-10-27

Confirmed facts, assumptions and open questions are kept in separate sections. Nothing under
**Assumptions** or **Open questions** is a requirement until the owner confirms it.

## Hard constraints
| ID | Constraint | Source / reason |
|---|---|---|
| C-001 | The BRD (`docs/product/source/business-requirements.txt`) is the functional baseline; changes go through `requirements.md`. | Project process |
| C-002 | Role and hierarchy rules (self / coach→trainees / head coach→coaches) must be enforced by the server, not only by hiding UI. | BRD §1.3 permissions; REQ-NFR-001 |
| C-003 | The app processes body, health and meal data, including photos, for users in India (example time zone India · Kolkata). Applicable data-protection law must be confirmed and followed — likely India's Digital Personal Data Protection Act 2023; confirm with legal (Q-049). | BRD §11; REQ-NFR-002 |
| C-004 | No meal text, photo, voice or label may reach an AI service without the user's recorded consent. | BRD §8, §11; REQ-ACC-004 |
| C-005 | Food database, barcode and saved-meal logging must work with AI off. | BRD §11; REQ-ACC-005 |
| C-006 | Day boundaries are computed in the user's configured time zone. | BRD §2; REQ-DATE-004 |
| C-007 | The UI pattern is mobile: bottom navigation, bottom sheets, camera, microphone and barcode scanning. The client must support these device capabilities. | BRD §1, §4, §8 |

## Quality targets
- Performance: **Open** (Q-050)
- Availability/reliability: **Open** (Q-050)
- Security/privacy: C-002, C-003, C-004; detailed controls to be set in `docs/security/data-and-threat-model.md` (Missing)
- Accessibility: **Open** (Q-050)
- Budget/licensing: **Open** (Q-053) — affects AI provider, food database and hosting choices
- Deployment/network/region: **Open** — data residency may follow from C-003 (Q-049)

## Assumptions
| ID | Assumption | Evidence | Confidence | Owner |
|---|---|---|---|---|
| A-001 | Primary clients are native-feeling mobile apps (iOS and Android); web is not required for trainees. | Mobile UI pattern in BRD | Medium | Product owner (Q-051) |
| A-002 | One account can hold several roles at once (e.g. a Coach who is also a Personal Training User). | BRD "switch between roles available to them" | High | Product owner |
| A-003 | Each trainee has at most one coach; each coach at most one head coach. | BRD "directly assigned", "within their hierarchy" | Medium | Product owner |
| A-004 | Users can edit and delete their own logged meals and entries. | Not in BRD; needed for usable logging | Medium | Product owner (Q-032) |
| A-005 | Diet plan tab has an empty state when no plan exists. | By analogy to Training | Medium | Product owner |
| A-006 | AI-parsed meals are shown for review and saved only after the user confirms. | Not in BRD; reduces wrong logs | Medium | Product owner |
| A-007 | AI consent is off by default and each change is timestamped. | BRD "asked for consent before"; C-003 | Medium | Product owner / legal |
| A-008 | Email + password is the sign-in method. | BRD mentions only "change password" | Low | Product owner (Q-047) |
| A-009 | English-only for first release. | BRD is in English; no localisation mentioned | Low | Product owner (Q-054) |

## Open questions
**Blocks** = what cannot be built (or finalised) until it is answered. Owners are roles until named.

### Project and scope
| ID | Question | Blocks | Owner |
|---|---|---|---|
| Q-001 | Who are the product owner, tech lead, security, QA and ops owners? | Approvals of everything | Sponsor |
| Q-002 | What evidence/business case supports the product? | Nothing in build | Product owner |
| Q-003 | Confirm proposed non-goals (payments, chat, wearables, medical advice). | Scope sign-off | Product owner |
| Q-004 | What are the success measures and their owners? | Analytics design | Product owner |
| Q-005 | Priority (Must/Should/Could/Won't) per REQ, and release slicing. | Release plan | Product owner |
| Q-051 | Target platforms: iOS, Android, web? Minimum OS versions? | ADR-0001 | Product owner |
| Q-052 | Are there designs/screens for Coach and Head Coach views? (BRD describes trainee screens in detail but not coach screens.) | Coach/Head Coach UI | Design |
| Q-053 | Team size, skills, budget and target launch date. | ADR-0001..0006 | Sponsor |
| Q-054 | Languages and localisation needed? | i18n setup | Product owner |

### Roles and hierarchy
| ID | Question | Blocks | Owner |
|---|---|---|---|
| Q-006 | Who grants Coach and Head Coach roles? BRD says Head Coach is activated "through a toggle" — can any user self-activate it? | REQ-ROLE-001, threat model | Product owner |
| Q-007 | Is Personal Training User available to every account? | REQ-ROLE-001 | Product owner |
| Q-008 | Is the last active role remembered across sessions/devices? | REQ-ROLE-002 | Product owner |
| Q-009 | "Add Coach/trainee": create account, email invite, invite code, or link an existing user? | REQ-ROLE-003/005 | Product owner |
| Q-010 | "Delete Coach/trainee": delete the account and data, or just unassign? What happens to a deleted coach's trainees and plans? | REQ-ROLE-003/005 | Product owner + legal |
| Q-020 | Navigation layout for Coach and Head Coach views. | Coach/Head Coach UI | Design |
| Q-021 | What trainee "details" can a Head Coach see, and can they edit trainee plans/targets? | REQ-ROLE-004 | Product owner |
| Q-013 | Who sets the weekly workout target and the Progress "Target row" (body weight, steps)? | REQ-HOME-007, PRG-005 | Product owner |
| Q-014 | Do target changes apply from a date forward or to past days too? | Data model | Product owner |
| Q-016 | Can a self-directed user set their own targets? | REQ-ROLE-007 | Product owner |

### Dates and logging
| ID | Question | Blocks | Owner |
|---|---|---|---|
| Q-011 | "+" date chip: today, or the date currently selected? | REQ-NAV-003 | Product owner |
| Q-012 | Does "+" only log meals, or also weight/steps/etc.? | REQ-NAV-003 | Product owner |
| Q-015 | Steps and sleep: manual entry only, or sync from Apple Health / Google Health Connect? Sleep unit? | REQ-HOME-006, ADR-0006 | Product owner |
| Q-017 | Can users log or view future dates? | REQ-DATE-001, MEAS-002 | Product owner |
| Q-018 | Default time zone; effect of changing it on existing entries; which time zone a coach sees. | REQ-DATE-004, data model | Product owner + tech lead |
| Q-030 | Two measurement entries on the same date: overwrite or keep both? Same for weight. | Data model | Product owner |
| Q-031 | Are "Before training" and "Dessert" tags on a meal, or extra slots? Where do they show in Consumed? | REQ-LOG-003, NUT-003 | Product owner |
| Q-032 | Logged-meal "•••" menu: edit, delete, move, duplicate? | REQ-NUT-004 | Product owner |
| Q-036 | Re-logging a saved meal: which slot and date does it go to? | REQ-SAVED-001 | Product owner |
| Q-037 | Full list of day logging-status labels in the date sheet. | REQ-LOG-002 | Product owner |
| Q-038 | Voice: on-device or cloud speech-to-text? Is it covered by AI consent? | REQ-LOG-005 | Product owner + legal |
| Q-039 | Food database and barcode data source (licensed, open such as Open Food Facts, Indian foods such as IFCT)? | REQ-LOG-007, ADR-0006 | Product owner + tech lead |
| Q-040 | Acceptable AI parsing accuracy and how it is measured. | REQ-LOG-009 | Product owner |

### Screens and display rules
| ID | Question | Blocks | Owner |
|---|---|---|---|
| Q-019 | Meaning of the Home week-strip "status box". | REQ-HOME-002 | Design |
| Q-022 | Display when eaten exceeds target. | REQ-HOME-003/004 | Design |
| Q-023 | "By meal": Consumed tab or separate view? | REQ-HOME-005 | Design |
| Q-024 | BRD says "Weight (kg)" on Home; should it follow the kg/lb setting? | REQ-HOME-006 | Product owner |
| Q-025 | Does an empty (self-directed) workout count toward the weekly target? | REQ-HOME-007 | Product owner |
| Q-026 | When is the Measurements prompt shown and hidden? | REQ-HOME-008 | Product owner |
| Q-027 | Arms/thighs: one value or left and right? | REQ-MEAS-005 | Product owner |
| Q-028 | Valid ranges for measurements, weight, steps, sleep. | Validation | Product owner |
| Q-029 | Should X warn about unsaved input? | REQ-MEAS-006 | Design |
| Q-033 | Is "Got it" dismissal remembered per user or per device? | REQ-PLAN-002 | Product owner |
| Q-034 | Do kcal/protein totals change per option? | REQ-PLAN-003/004 | Product owner |
| **Q-035** | **What does the diet-plan option action button do?** (BRD: "partly visible in the screenshot, presumably to log".) | **REQ-PLAN-006 blocked** | Product owner |
| Q-041 | Exercise how-to format and who authors the exercise library. | REQ-TRN-001 | Product owner |
| Q-042 | Workout log fields (sets, reps, weight, RPE, duration, rest). | REQ-TRN-003 | Product owner |
| Q-043 | Exact formulas: 4-week change, weekly rate, average calories, weekly aggregates, minimum weigh-ins for the chart. | REQ-PRG-001..005 | Product owner + coach SME |
| Q-044 | "Days logged out of total days": total counted from when? | REQ-PRG-003 | Product owner |
| Q-045 | Who enters the "Pre" baseline row, and when? | REQ-PRG-005 | Product owner |
| Q-046 | Content of week details view. | REQ-PRG-005 | Design |

### Account, security and quality
| ID | Question | Blocks | Owner |
|---|---|---|---|
| Q-047 | Sign-up, sign-in method(s), forgot password, email verification, social login? | Auth ADR-0004 | Product owner |
| **Q-048** | **Delete-account flow: what is deleted, what is retained and for how long, effect on coach links.** | **REQ-ACC-009 blocked** | Product owner + legal |
| Q-049 | Applicable laws (DPDP Act 2023, others if users outside India), data residency, consent records needed. | Threat model, hosting ADR | Legal |
| Q-050 | Performance, availability, accessibility (e.g. WCAG level) targets. | Test strategy | Product owner |
| Q-055 | Must logging work offline and sync later? | ADR-0001, ADR-0003 | Product owner |

## Major decisions needed (ADRs)
Listed in [`decisions/README.md`](decisions/README.md). None are drafted yet; each depends on
Q-051 and Q-053.

## Suggested first slice
*(Proposal for the owner — not approved.)* A thin vertical slice that touches the riskiest
foundations with the fewest open questions:

1. Sign-in (pending Q-047), Account › country/time zone (REQ-ACC-006), log out (REQ-ACC-008).
2. Global date handling (REQ-DATE-001..004) — proves time-zone day boundaries early.
3. Weight quick tile + body-weight unit (REQ-HOME-006 weight only, REQ-ACC-003).
4. Server-side role check scaffold for "self" access (REQ-NFR-001).

It avoids AI, food database, coach screens and Progress formulas, which have the most open questions.

## Revisit triggers
- Answers to Q-051 (platforms) or Q-053 (team/budget) — revisit all stack ADRs.
- Users outside India or a regulated-health partner — revisit C-003 and hosting.
- Adding wearables/health sync — new integration ADR.
- Switching or adding an AI provider — revisit ADR-0005 and consent text.
