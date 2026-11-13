# Home: every nutrient, the strip's icons, no workouts card (plan)

- Status: **Accepted** (the owner, in chat, 2026-11-13: "lock it B"; see "The owner's answers")
- Owner: Project owner (D-01)
- Last updated: 2026-11-13
- Decision: D-103
- Builds on: Home's food panel (REQ-HOME-003, REQ-HOME-004), Nutrition's Eaten card (REQ-NUT-002),
  the daily carbs, fat and fibre targets (D-70, REQ-ROLE-007), targets by date (D-77), the date strip
  Monday to Sunday (D-79, REQ-HOME-002) and the header calendar's apple and dumbbell (D-84,
  REQ-NAV-002)
- Requirements: REQ-HOME-002, REQ-HOME-004 and REQ-HOME-007 amended; REQ-ROLE-007's workout-target
  criterion amended
- Design: the canvas's "2.3 Home · every nutrient under Calories, icons under the date strip, no
  workouts card · B LOCKED (D-103)" (boards `HomeNutrients` and `HomeNutrientsOptions`, proposed
  in version 103, B locked in version 104): https://claude.ai/artifact/WvdLa9fzyBFrdHcgDf7RTE
- Phone app only: no server change, no migration, no phone schema change, no new build (the Apple and
  Dumbbell icons are already in the app).

## What the owner asked
2026-11-13, with a screenshot of Home:
1. Under Calories, show every nutrient (protein, carbs, fat, fibre) as the Nutrition tab does, and
   remove the separate Protein card.
2. Remove the "Workouts this week" card.
3. Instead, put icons under the date strip's days, as in the month calendar (D-84).
4. Plan and canvas first; build only after approval.

## What the user sees

### The food panel (Home's first card)
The Calories part is unchanged: the hero number, "1,320 of 2,200 kcal", the 20 plates, or "Set a
target", or "No target on this day" on a past date (D-77). Under its rule, in place of the Protein
card, four nutrients side by side, as Nutrition's Eaten card: **Protein, Carbs, Fat, Fibre**, each
with its colour square and its amount, written as Nutrition writes it. "By meal" stays at the foot.
Three ways to show them (the canvas's options):

- **A · Nutrition's row.** The four amounts only, exactly as Nutrition's Eaten card. No nutrient's
  target shows on Home (Insight still shows them). Today's protein target and bar leave Home.
- **B · the row with targets** (recommended). As A, and under each amount "of 120 g" and a thin bar
  in the nutrient's colour; over the target, the "of" line and the bar turn gold (as Q-022). A
  nutrient with no target says "No target". So protein keeps its target on Home, and carbs, fat and
  fibre show theirs (D-70).
- **C · a line each.** One line per nutrient, as Insight's "Against your daily targets": the name on
  the left, "86 of 120 g" on the right, a bar under it; no target: "No daily target". Taller.

In every option: nothing logged shows "–", as Nutrition; a past date shows that date's targets
(D-77); screen readers hear each nutrient whole ("Protein: 86 g of 120 g", "Fat: 64 g of 60 g, 4 g
over", "Fibre: 9 g, no daily target").

### The date strip
Each day's status box goes. Under the date, as in the header's calendar (D-84): a green **apple** on
a day with a meal and a green **dumbbell** on a day with a workout that Training lists (one with an
exercise, D-41), side by side; on the selected day they take its ink (as the calendar's selected
day). A day with nothing has no mark; greyed days (after today, before the 90 days) have none.
Screen readers hear "Wednesday 11 Nov, 3 meals logged, 1 workout logged". The strip's size, arrows,
swipes and greying are unchanged (D-79).

### The workouts card
"Workouts this week" (the tracker, REQ-HOME-007) leaves Home, with the day sheet it opened (D-34,
D-42). Workouts are still logged and opened on Training (its By day and its strip), and seen in the
header's calendar.

## Questions for the owner
1. **A, B or C** for the nutrients? Recommended: **B**.
2. **The weekly workout target.** Today only the workouts card shows it ("2 of 4 · 2 left"). With
   the card gone:
   - (a) **recommended:** one line under the strip, "3 of 4 workouts this week", with a dumbbell, as
     the month calendar counts its workouts (the canvas's state "Today, with the week count"); with
     no target, "3 workouts this week";
   - (b) nothing on Home: the target stays in Your targets and Target history only.
3. **Nutrition's and Training's strips** (the same strip today: Nutrition marks meals, Training
   workouts). Recommended: the same apple and dumbbell on all three tabs, as the header's calendar
   shows both on every tab. Other choice: Home only, the other two unchanged.

## How it is built (after approval)
On branch `feat/home-nutrients` off `main`, in `D:\fitsphere-home` (removed once merged).
- `components/WeekStrip.tsx`: `loggedDays` and `loggedLabel` give way to `activity: { meals:
  Record<IstDay, number>; workouts: Record<IstDay, number> }`; Apple 12 and Dumbbell 12 in a row 12
  tall under the date (`testID` `meals-<day>`, `workout-<day>`), the selected day's in `onPrimary`;
  the label from `activityStatus` (`CalendarSheet.tsx`, shared). The day keeps its 64 height.
- `screens/HomeScreen.tsx`: the strip's week's meals (`mealCounts`, as today) and workouts
  (`listEntries('workout')` for the strip's week, not the selected date's, then `workoutsPerDay`);
  the Protein `TargetProgressCard` replaced by a new `components/NutrientTargets.tsx` (the chosen
  option; colours and names from `EatenSummary`'s `NUTRIENTS`, amounts by `formatGrams`, targets
  from `targetsOn` as today); `WorkoutTracker` and `WorkoutDaySheet` removed from Home. If question
  2 is (a), the week's line under the strip with the week's Sunday's target (D-77).
- `WorkoutTracker.tsx` and `WorkoutDaySheet.tsx` are deleted if nothing else uses them (today only
  Home does); `TargetProgressCard` keeps only its hero use, its smaller form removed if unused.
- `NutritionScreen.tsx`, `TrainingScreen.tsx`: pass `activity` (question 3).
- Docs: D-103 in `owner-decisions-2026-10-27.md`; REQ-HOME-002, REQ-HOME-004, REQ-HOME-007 and
  REQ-ROLE-007 (and their "Last updated"); `docs/design/design-system.md` (the strip); the
  ui-redesign plan's 2.3 row; `constraints-and-assumptions.md` MVP defaults if any; CLAUDE.md's
  current phase. The canvas boards are titled LOCKED once chosen.

## Tests
- `WeekStrip.test.tsx`: apple on a meal day, dumbbell on a workout day, both, none; none on greyed
  days; the selected day's colour; the spoken label.
- `home.test.tsx`: the four nutrients with amounts, "–" with nothing logged, each target ("of 120
  g"), over a target, no target, a past date's targets (D-77); no Protein card; no workouts card.
- `home-workouts.test.tsx`: replaced by the strip's dumbbells on Home (a workout with no exercise
  gets none, D-41) and, if 2(a), the week's line (with and without a target, an earlier week).
- `nutrition.test.tsx`, `training.test.tsx`, `targets.test.tsx`: the strips' new marks, and the
  tests that read the old status boxes or the tracker updated.
- Full mobile jest, typecheck and lint.

## Risks
- Fewer ways to a workout from Home (the tracker's days opened them). Training and the calendar
  still do.
- Four amounts with targets in a 390 dp wide phone are narrow: B keeps each column to the amount, a
  short "of" line and a bar; a large font setting may wrap "of 1,000 g" (it wraps, it is not cut).

## Not in this change
Nutrition's Eaten card, Insight, Your targets and the header's calendar are unchanged; no new target
kinds; Log meal's calendar keeps its dots.

## The owner's answers (in chat, 2026-11-13)
1. "lock it B": the row with targets. The canvas's boards are titled LOCKED: B (version 104).
2. Not answered: the recommended (a) is built as an MVP default, the line under the strip.
3. Not answered: the recommended default is built, the apple and the dumbbell on all three strips.

## Results (2026-11-13)
Built as above, with one difference from "How it is built": the week's meals and workouts are read
by one hook, `useWeekActivity` (`src/weekActivity.ts`), used by Home, Nutrition and Training.
`TargetProgressCard` keeps only its hero form; `WorkoutTracker.tsx` and `WorkoutDaySheet.tsx` are
deleted. Checks in `D:\fitsphere-home`: mobile typecheck, ESLint on `apps/mobile/src`, and the whole
mobile jest run (79 suites, 969 tests) pass. Not run yet: the owner's check on the phone.
