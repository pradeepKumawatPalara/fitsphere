# F05 — Targets: UI design (LOCKED)

| | |
|---|---|
| **Status** | UI locked 2026-11-02 |
| **Spec IDs** | TGT-001, TGT-002 (+ new onboarding steps "About you" and "Goal") |
| **Design source** | Canvas board *F05 · Targets* (Tweaks → step: about-you / goal / your-plan / edit-targets) |
| **Put at** | `docs/features/F05-targets/ui-design.md` |

## Decision: Q-01 = B, with user edits (update `spec.md`)
- The **app calculates** targets from the user's profile and goal. There is no coach-side input in the MVP.
- **Users can edit** their targets at any time. This changes TGT-001 AC1 ("user cannot edit"); replace it with "user can edit; calculated values are kept for Reset".
- Labels: **"Calculated"** or **"Custom"** (when edited), replacing "Set by your coach". DIET-001's label changes the same way.
- Target changes apply **from today**; past days keep the targets they had (Q-07).
- Targets: daily **calories**, daily **protein**, **workouts per week**, daily **steps**.

## Calculation (show the working on "Your plan")
- BMR uses **Mifflin–St Jeor**: men 10·kg + 6.25·cm − 5·age + 5; women 10·kg + 6.25·cm − 5·age − 161.
- Activity multipliers: Mostly sitting 1.2 · Lightly active 1.375 · Moderately active 1.55 · Very active 1.725 → maintenance (TDEE).
- Goal: Lose −250 / −500 / −750 kcal (Steady / Standard / Fast = 0.25 / 0.5 / 0.75 kg a week); Maintain ±0; Build muscle +250 (Standard) / +150 (Steady) / +400 (Fast).
- Safety floor: never below **1,500 kcal (men) / 1,200 kcal (women)**, and never more than 1,000 below maintenance.
- Protein: lose = 1.8 g/kg, maintain = 1.6 g/kg, build = 2.0 g/kg (of current weight), rounded to 5 g.
- Workouts a week: sitting 3 · light 3 · moderate 4 · very active 5. Steps: sitting 6,000 · light 7,000 · moderate 8,000 · very active 10,000.
- Round calories to the nearest 10.
- Example: male, 30, 178 cm, 72.4 kg, moderate, lose standard → 2,120 kcal · 130 g · 4/wk · 8,000.
- Recalculate (offering "Use new targets?") when the user redoes goal setup. Never recalculate silently.

## Screens
1. **About you** (onboarding step 4/5): "ABOUT / YOU", "We use this to work out your daily targets." Sex block toggle (MALE | FEMALE); **Age** (yrs) and **Height** (cm; ft/in if units are lb) side by side; "HOW ACTIVE ARE YOU?" — a list card with 4 rows (title in Barlow 500 16, description 400 13 `inkMuted`, square radio; the selected row has an `accentTint` background and `accent` title):
   - Mostly sitting — Desk job, little exercise
   - Lightly active — On your feet a bit, or 1–2 workouts a week
   - Moderately active — 3–5 workouts a week
   - Very active — Hard training 6+ days, or a physical job
   NEXT.
2. **Goal** (5/5): "WHAT'S YOUR / GOAL?" — 3 large option cards (icon + Barlow Condensed 24/800 title + Barlow 400 14 description; selected = `primary` fill): Lose fat / Maintain / Build muscle. "PACE" with 3 blocks: Steady 0.25 kg/wk · **Standard 0.5 kg/wk** · Fast 0.75 kg/wk (hidden for Maintain). "BUILD MY PLAN →".
3. **Your plan:** overline "LOSE 0.5 KG / WEEK", "YOUR / PLAN". A cut-corner card: "DAILY CALORIES 2,120 KCAL" (72 italic), then a 3-column strip: PROTEIN 130 g · WORKOUTS 4 /wk · STEPS 8,000. A collapsible "HOW WE WORKED IT OUT" (`accentTint`) with plain-language working. "You can change these any time. Targets never go below a safe minimum." Buttons: "USE THIS PLAN →" and "ADJUST TARGETS".
4. **My targets** (from Account → My targets, Home fuel card long-press, and "Adjust"): title "MY TARGETS" with a **CUSTOM** or **CALCULATED** tag. "Changes apply from today. Past days keep the targets they had." A card of 4 rows (Calories kcal, Protein g, Workouts /wk, Steps), each with −/+ steppers (44×44) and the value; a note under each label: "Calculated" or "Calculated: 2,120 · edited" (`accent`). Steppers: calories ±50, protein ±5, workouts ±1, steps ±500. Links: "↺ RESET TO CALCULATED", "REDO GOAL SETUP". "SAVE TARGETS".

## Validation
Calories 1,200–5,000; protein 40–300 g; workouts 0–7; steps 1,000–30,000. Values outside these are blocked with an inline message.

## Account addition
Add a **"My targets"** row to the Account screen (above Units) showing "2,120 kcal · 130 g".
