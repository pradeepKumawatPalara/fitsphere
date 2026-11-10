# Meal insight plan

- Status: **Accepted** (the owner, in chat, 2026-11-10: the designs locked and the ranges approved;
  see "The owner's answers")
- Owner: Project owner (D-01)
- Last updated: 2026-11-10
- Builds on: the Eaten summary and meal slots (REQ-NUT-002, REQ-NUT-003), the user's own targets
  (REQ-ROLE-007, D-20, D-23), the redesign's locked 3.1 (Nutrition, Consumed) and 6.2 (Your
  targets). Decision D-70
- Requirements: new REQ-NUT-005 (Insight) and REQ-NUT-006 (Top foods); REQ-NUT-004 and
  REQ-ROLE-007 amended (the Insight icon; daily carbs, fat and fibre targets)
- Design: the canvas's "3.1 Nutrition · Insight · LOCKED (D-70)" (boards `NutritionInsight`,
  `NutritionInsightStates`, `Insight`, `InsightStates`; version 64) and "6.2 Targets · carbs, fat,
  fibre · LOCKED" (boards `TargetsNutrients`, `TargetsNutrientsStates`)

## What the owner asked
2026-11-10: in the Nutrition tab, one more action called **Insight** for each meal (Breakfast,
Lunch, Snack, Dinner):
1. Tapping Insight shows the calories eaten in that meal. The calorie target is for the whole day,
   not per meal, so the meal shows what it added to the day.
2. Insight shows protein, carbs, fat and fibre eaten against their targets. Today only the calorie
   and protein targets can be set (Settings › Your targets), so carbs, fat and fibre targets are
   added there.
3. The top foods for each nutrient (which foods gave the most protein, and so on), for the meal and
   for the whole day, separately.

## What the user sees

### Nutrition › Consumed (3.1)
- Each logged meal's card gets an **Insight icon** (a pie chart) **before its Edit icon** (the
  owner, 2026-11-10), named "Lunch insight: Roti, Toor dal…" for screen readers and 44 dp to tap.
  It opens the Insight page on that meal's type (Breakfast, Lunch, Snack or Dinner), so two
  breakfasts both open Breakfast. The cards show when a slot is opened, as today.
- The Eaten card has no Insight link (the owner removed it, 2026-11-10); the whole day is the Day
  tile on the Insight page.
- Nothing else on the screen changes; saved meals (the Saved tab) get no Insight.

### The Insight page (new)
A whole page with a back arrow (as the exercise page, D-67). Under the title, the date
("Today · Tue 3 Nov"). Then a row of five tiles: **Day, Breakfast, Lunch, Snack, Dinner**, with the
icons of Log meal's meal tiles (D-58) and a calendar for Day; the one opened is chosen, a green tick
marks each meal with food, and tapping another tile switches without going back.

1. **Calories.** The chosen meal's kcal, large, and the line "Lunch: 32% of your 2,000 kcal daily
   target". A bar across the daily target split by meal (the chosen meal in caramel, the others
   muted), then each meal's kcal and "Left today" (or "Over", in gold). For **Day**: the day's
   kcal, "52% of your 2,000 kcal daily target", the same bar and list. There is no meal budget.
   With no calorie target, the bar spans the day's eaten total and the line reads
   "No daily target · Set a target".
2. **Against your daily targets.** Protein, Carbs, Fat and Fibre, each "25 g of 110 g" with a bar
   and the percentage. For a meal, the bar shows the meal's part in the nutrient's colour and the
   rest of the day's eating faded behind it, with a small key ("Lunch", "Rest of today"). For Day,
   "71 g left today", or "3 g over" in gold with a full gold bar. A nutrient with no target shows
   its amount, "No daily target" and **Set a target** (opens Your targets). When a food in the meal
   has no value for a nutrient (some sources give none, D-26), a note says so: "Cucumber raita has
   no fibre value."
3. **Top foods.** Five pills: Calories, Protein, Carbs, Fat, Fibre (Calories first). The five foods
   that gave the most, largest first: rank, name, its amount ("3 pieces · 120 g"), the value, its
   share of the meal's (or day's) total and a thin bar. More than five: "Show all 7 foods". On
   **Day**, the same food eaten in two meals is one row, its amounts added, and the second line
   names the meals ("Breakfast, Dinner · 2 pieces"). Foods that give none of the nutrient are not
   listed; foods with no value for it are left out, with a note.
4. **A meal with nothing logged** (for example Snack): "Nothing logged for Snack on Tue 3 Nov." and
   an outlined **Add to Snack** that opens Log meal for that meal and date (the Day tile with nothing
   logged: "Nothing logged on …" and **Log meal**).

Insight only reads what is already on the phone (the date's meals and the targets): it works
offline and shows no advice, only the numbers.

### Settings › Your targets (6.2)
Three new targets, in whole grams: **Daily carbs, Daily fat, Daily fibre**, each a tile like the
others ("Set by you", the pencil, the same entry sheet). The tiles are grouped:
- **Food:** Daily calories (across the row), Daily protein, Daily carbs, Daily fat, Daily fibre.
- **Activity and body:** Daily steps, Weekly workouts, Target body weight (across the row).

Allowed values (approved by the owner): carbs 10 to 1,000 g, fat 5 to 500 g, fibre 5 to 100 g.

## How it is built
- **Shared contracts** (`packages/shared/src/contracts.ts`): `TARGET_KINDS` gains `carbs`, `fat`,
  `fibre`; `TARGET_RANGES` and `targetSetDataSchema` follow.
- **API:** migration `0024_nutrient_targets.sql` replaces `app.targets`' two checks (the kinds and
  the value ranges) to allow the three new kinds. The sync change `target.set` already validates
  with the shared schema; the pull is unchanged. Tests: the sync accepts and stores each new kind,
  refuses values out of range, and still allows only the user's own targets.
- **Phone, no schema change:** the phone's `targets` table has no check on the kind.
  - `src/targets.ts`: the three new texts; `TargetsScreen.tsx`: the two groups and the icons
    (Lucide `Wheat`, `Droplet`, `Leaf`, already in the app's icon package).
  - `src/insight.ts` (new, pure functions): a scope's totals, each meal's kcal, each nutrient
    against its target (left, over, no target, foods without a value) and the top foods (same food
    joined by `sameFood`, amounts by `formatAmount`). Unit tested.
  - `src/app/insight.tsx` and `src/screens/InsightScreen.tsx` (new): the page, reading
    `listMealsOfDay` and `listTargets`; route `/insight?day=…&scope=day|breakfast|lunch|snack|dinner`.
  - `MealCard.tsx` (an optional `onInsight`, its icon before Edit) and `NutritionScreen.tsx`: the
    Insight icon. `MealSheets.tsx` shares the meal icons (`MEAL_ICONS`).
- **Docs:** REQ-NUT-005, REQ-NUT-006 and REQ-ROLE-007 in `requirements.md`; D-70 in the owner
  decisions; this plan Accepted; CLAUDE.md's Current phase; the canvas boards retitled LOCKED.
- One branch, `feat/meal-insight`, one pull request. No new build (JavaScript only).
- **On `fitsphere-dev`:** migration 0024 before the updated API; only when the owner says so.

## Tests
- `insight.test.ts`: a meal and the day; the same food in two meals joined; foods without a value
  left out and named; no target, under, exactly at and over a target; five foods and "Show all";
  ties keep the meal's order.
- Shared: the new ranges' edges.
- API: `target.set` for carbs, fat and fibre (stored, out of range refused, another user's not
  reachable); the migration test list gains 0024.
- Phone screens: the Insight icon sits before Edit on each logged meal (not on saved meals); it
  opens on the meal's type;
  the tiles switch; the pills switch the top foods; "Set a target" opens Your targets; Your
  targets lists eight tiles in two groups and saves a carbs target.
- Typecheck, lint and every existing test.

## Risks
- **Migration order:** until 0024 runs on `fitsphere-dev`, setting a carbs, fat or fibre target
  syncs as "Not saved" (the database refuses the kind). Run 0024 before the updated API.
- **An older copy of the app** on another phone cannot read a carbs, fat or fibre target from the
  sync and stops syncing until it is updated. Only test phones exist; all run the new code through
  Metro.
- **Missing and estimated values:** some foods have no carbs, fat or fibre (IFCT gaps, labels), and
  some values are estimates (INDB, dish estimates, AI-estimated labels; R-012 to R-014). Insight
  adds what the meal holds, says when a value is missing, and makes no health claim.

## Not in this change
- A calorie or nutrient budget per meal (the targets stay daily, as the owner said).
- Carbs, fat and fibre cards on Home, and new target rows in Progress.
- Coach-set targets (post-MVP, D-20).

## The owner's answers (in chat, 2026-11-10)
1. Nutrition: "I want the Insight as the Icon Before the edit icon on the each meal of the day. when
   i click on this icon rest of the flow is ok." Redrawn as "PROPOSED v2" (canvas version 63). On
   it: two breakfasts both opening Breakfast, "Fine for now"; the Eaten card's Insight link,
   "remove it". Locked as drawn without it (canvas version 64).
2. The Insight page: "Insight tab is fine for now" (approved, with top foods five, then
   "Show all").
3. Your targets (6.2): "6.2 Desing screen is locked."
4. The allowed values for the new targets: "approve".

## Results (2026-11-10)
Built on `feat/meal-insight`. Typecheck and lint pass; the phone's 792 tests, the shared and API
unit tests and the API's 289 database tests (with migration 0024) pass. Not yet run: the owner's
phone test, and migration 0024 on `fitsphere-dev`.
