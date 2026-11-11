# More measures for a food plan

- Status: **Accepted** (Part A) by the owner, 2026-11-11: "I approve Part A. Keep the oz for now.
  Let's first build in the canvas", then "lock it" for the design, and "Part B can be handled later".
  Built on the branch; not pushed
- Owner: Project owner (D-01)
- Last updated: 2026-11-11
- Branch: `feat/food-measures`, in its own folder `D:\fitsphere-measures` (off main bf7b556)
- Builds on: the food page and its two-wheel picker (D-45, the redesign's 3.6b, locked
  2026-11-04), household units (D-36), the foods' servings (D-39, D-46, D-48, D-49, D-59, D-62),
  changing a food in the meal (D-64). Decision D-76
- Requirements: REQ-LOG-007 ("A food's page" and "Household units" bullets amended)
- Design: the canvas's "3.6b Food page · more measures · LOCKED (D-76)" (boards `FoodMeasures`,
  `FoodMeasuresStates`; locked in version 71), right of 3.6's search-tag boards

## What the owner asked
2026-11-11, with three pictures of another app's amount picker (a roti: "2 roti/chapati", "2
serve", "2 oz"): when a food is picked from Search foods, the Measure wheel on its page should offer
choices like those (the food's own unit, a serving, piece, slice, oz, grams), with the energy,
nutrients and "Net wt" following the choice. Plan first, from the data the food list has.

## What the food page has today
The page already has the picker from the pictures: Quantity and Measure as two wheels, Done, and
"Net wt" beside the energy (D-45). Quantity goes in halves from 0.5 to 10; Grams are typed in the box.
What is missing is choices in the Measure wheel: almost every food has only **Grams and at most one
serving**.

## What the data has (counted 2026-11-11)
| Source | Foods | Measures today | Its one serving, examples |
|---|---|---|---|
| IFCT | 542 | Grams only (the 62 household-unit rows for 52 foods are all `pending`, none weighed, D-36) | none |
| INDB recipes | 1,014 | Grams, + one serving for 917 | "1 bowl", "1 tall glass", "1 triangle" |
| Home-style foods | 92 | Grams + one serving | "1 roti" 35 g, "2 slices" 56 g |
| Estimated dishes | 5,025 | Grams + one serving | "1 katori" 150 g, "1 plate (6 pc)" 120 g |
| Brand labels | 630 | Grams, + one serving for 115 | "2 biscuits" 15 g, "1 serving" 30 g |
| Packaged (Open Food Facts) | 9,764 | Grams, + "Serving (N g)" for 6,263 | the label's grams only (see below) |
| Dishes (recipe sheet) | 0 approved | portions | — |
| My foods | the user's | their own unit | — |

The owner's master workbook (`Indian_Food_Database_MASTER.xlsx`) also gives each dish one serving
unit only, so there are no extra units waiting there.

**So the pictures' list cannot come whole from our data:** nothing says how much a "piece" or a
"slice" of a roti weighs, or what a second size of a serving is. Inventing those sizes would break
D-36 (units only from measured or owner-approved grams). This plan adds every measure the data
**does** support (part A) and leaves the rest as a choice for the owner (part B).

## Part A — built in this plan (no new data, no migration, no new build)

### A1. oz for every food weighed in grams
1 oz = 28.35 g, a fixed weight, true for every food: no sizes to invent. Offered for every listed
food (IFCT, INDB, home-style, estimated dishes, brand labels) and every packaged food, counted in
halves from 0.5 to 10 oz (283.5 g), as the other units. Not for dishes (portions) or My foods (their
own unit).

### A2. The single unit inside a serving
Where a serving holds several of something, the food also gets **one** of it, by plain division of
grams already approved by the owner:
- "2 slices = 56 g" → also **Slice, 28 g**
- "1 plate (6 pc) = 120 g" → also **Piece, 20 g**
- "3 biscuits = 16 g" → also **Biscuit, 5.33 g**

That gives about 240 foods a second measure: 205 estimated dishes ("plate (N pc)", "handful (N
pc)"), 20 home-style breads, 7 more estimated dishes and 12 brand labels. A serving of one ("1
roti", "1 katori") is already that unit: no extra row.

### A3. Clearer names in the Measure wheel
Each row shows the unit, then its grams in smaller text: "Slice · 28 g", "Plate (6 pc) · 120 g",
"oz · 28.35 g", "Grams". Order: the food's own measures first (units, then servings, then household
units), then Grams, then oz. The page still opens where it does today (INDB, home-style and
estimated dishes on their serving; the others on grams; a recent food or a food in the meal on its
amount, D-60, D-64).

### A4 (optional, the owner chooses). The packaged label's own unit
Open Food Facts gives each product's serving as text too ("2 biscuits (20 g)"), but FitSphere keeps
only the grams. Keeping the text would give packaged foods a unit as in A2 ("Biscuit, 10 g"). It
needs the Open Food Facts export converted again, a migration (one column on
`app.packaged_foods`) and a phone schema version. Counted in the 2026-11-04 export: of the 6,263
products with a serving in grams, only **505** name a unit (scoop 98, piece 33, cup 28, bar 28, tbsp
25…); the other 5,706 say only grams or "serving", and some texts are wrong ("2 tbsp chutney (192
g)"). **Recommended: not now**: too little gain for a migration and a phone schema change.

## Part B — more units per food (needs new data; the owner decides later, not in this plan)
To offer piece, katori, bowl, tablespoon or glass for foods that have none (all of IFCT, most
packaged foods), each food needs the grams of each unit. Three ways, each the owner's call:
1. **Weighed by the owner** (D-36 as it is): the 62 pending rows of the household-measures sheet.
   Slow, but measured.
2. **From the owner's AI tool**, as the home-style foods and estimated dishes were (D-53, D-59,
   D-62): one sheet of food, unit and grams, flagged `llm`, reviewed by Claude (ranges, the same unit
   across similar foods, agreement with the food's serving) and approved by the owner row by row.
   This changes D-36's "measured only" rule, so it needs a new decision. Claude writes the prompt on
   request (text in chat only); never fills a row itself.
3. **Generic sizes for every food** (1 ml as 1 g): the owner already said no (D-36).

## How it is stored (for the reviewer)
- **A2's units are servings like any other:** `foods:import` adds them to `app.food_portions` as a
  second serving of the food (seq 2), from the same sheets. The phone gets them with the next food
  list download (its version changes). The sync's existing serving check covers them. Existing
  serving names are **not changed**, because a meal saved with a serving is checked by its name
  when it is saved again.
- **oz is a serving named "oz" of 28.35 g** that every listed and packaged food may use: the phone
  adds it to each food's measures; the sync accepts it for any listed or packaged food at 28.35 g a
  count; the import refuses a sheet serving named "oz". IFCT foods may now be logged by a serving
  (only oz). So Log meal's changes, "Add to existing" (an oz item joins an oz item only), Recent
  foods and Insight treat it as they treat servings, with no new amount form. A meal shows "2 oz
  (56.7 g)".
- No migration, no phone schema version, no new build: JavaScript and the import only.

## Steps
| Step | What | Status |
|---|---|---|
| 1. Design | The canvas's 3.6b picker with the new Measure rows (dark and light), for the owner to lock | Locked (canvas version 71) |
| 2. Server | The single unit inside a serving at import (INDB, home-style, estimated dishes, brand labels); "oz" in the sync's serving check; IFCT may take a serving | Built |
| 3. Phone | The Measure wheel's rows, names and order; oz; "2 oz (56.7 g)" in meals | Built |
| 4. Docs | D-76, REQ-LOG-007, `data-model.md`, `food-list-sources.md`, `ui-redesign.md`, CLAUDE.md, this plan Accepted | Done |
| Owner's steps | On `fitsphere-dev`, after this branch's API runs: `npm run foods:import -w @fitsphere/api` (no migration); then the phone checks below | — |

## Tests
- API unit tests: reading the unit inside a serving ("2 slices", "1 plate (6 pc)", "3 biscuits",
  "1/4 cup", "2 pcs"; a serving of one gives nothing; a sheet serving named "oz" is refused).
- API integration: the import's serving counts; the sync accepts oz and an A2 unit with the right
  grams, and refuses wrong grams or oz on a dish or a My food.
- Phone: the Measure wheel lists a food's measures in order; oz maths (2 oz = 56.7 g and its
  values); changing an oz item in Log meal; "Add to existing" with oz; a recent food opens on oz.
- Phone checks by the owner: a home-style bread in Slice; a plated estimated dish in Piece; an IFCT
  food in oz; a packaged food in oz; an old meal with a serving saved again.

## Risks
- A2's units are only as right as the serving they come from; most are AI estimates the owner
  approved (flag `llm`, R-013, R-014).
- oz is little used in India and adds a row to every food's wheel. The owner may drop it.
- A wrongly read serving name would make a wrong unit; the import's tests cover the forms in the
  sheets, and the PR lists every unit made, for the owner to look over.

## Not in this plan
Sizes (small, medium, large); units for dishes or My foods; ml for drinks whose label is per 100 ml
(59 brand labels, today taken as grams); Part B; A4 unless the owner picks it.
