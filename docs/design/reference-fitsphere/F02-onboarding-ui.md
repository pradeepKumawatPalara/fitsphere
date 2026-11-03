# F02 — Onboarding: UI design (LOCKED)

| | |
|---|---|
| **Status** | UI locked 2026-11-02 |
| **Spec IDs** | ONB-001, ONB-002, ONB-003 (+ the F05 goal steps attached at the end) |
| **Design source** | Canvas board *F02 · Onboarding* (Tweaks → step) and *F05 · Targets* (about-you, goal, your-plan) |
| **Put at** | `docs/features/F02-onboarding/ui-design.md` |

## Decisions
| Q | Decision |
|---|---|
| Q-05 username | 3–20 characters: letters, numbers or `_`; unique, case-insensitive; checked live; suggest alternatives when taken |
| ONB-002 | Country and time zone are pre-filled from the phone; units default to kg / kg |
| ONB-003 / Q-21 | Starting weight can be skipped; programme start defaults to today and can be changed |
| Flow | Onboarding has **5 steps**: 1 Profile · 2 Base · 3 Starting weight · 4 About you · 5 Goal → Your plan → Home. Steps 4–5 and Your plan belong to F05; until F05 is built, step 3 goes straight to "Ready to train". |

## Shared layout
Same as the auth screens: stripe corner, a back button (hidden on step 1), a **segmented progress bar** (one segment per step, 6 high, radius 2, `primary` when done) and a counter "1 / 5" on the right. Heading: two lines, the second in `accent`. The primary button sits at the bottom.

## Steps
1. **Profile:** "STEP 2 OF 2 · SETUP", "WHAT DO WE / CALL YOU?". A 72×72 avatar (radius 8, `primary`, the initial) with "Your initial is your avatar. It updates as you type your name." Fields: **Your name**, **Username** (an "@" prefix inside the field, a `success` tick when available). Helper: "@mudit is available · 3–20 letters, numbers or _" (`success`), or when taken: "Taken. Try gymrat_mudit or gymrat26." (`danger`, NEXT disabled). Button "NEXT →".
2. **Base:** "SET YOUR / BASE", "Your day starts and ends in your time zone." A **Country & time zone** card (globe icon, "INDIA · KOLKATA", "IST, UTC +5:30 · from your phone", CHANGE → the time-zone sheet from F04). **Body weight** and **Lifting weights** each have a 2-option block toggle (KG | LB; 56 high; selected is `primary`). "You can change these any time in Account." NEXT.
3. **Starting weight:** "WHERE ARE YOU / STARTING?", "Your starting weight is the baseline for every progress chart." A card with a −0.1 / +0.1 stepper (52×52) around a big "72.4 KG" (84 italic); tapping the number opens the numeric keypad. **Programme starts** row ("TODAY · FRI 06 NOV", CHANGE). "SAVE →" and "SKIP FOR NOW".
4. **Done:** "READY TO / TRAIN" with a summary card: Username, Time zone, Units, Starting weight. "GO TO HOME →".

## Rules
- Each step saves when it's completed, so quitting mid-way resumes at the same step.
- Users who haven't finished onboarding always land back in it after logging in.
- Weight range: 20–300 kg (44–660 lb), one decimal.
