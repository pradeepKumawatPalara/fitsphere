# Units from the owner's food database, and a typed quantity plan

- Status: **Accepted** by the owner, 2026-11-13, with the answers in "Rules for the data" and
  "lock it, just change the maximum value: user can enter more maximum value" for the design. Built
  on the branch; not pushed
- Owner: Project owner (D-01)
- Last updated: 2026-11-16
- Branch: `feat/food-units`, in its own folder `D:\fitsphere-food-units` (off main 877168a)
- Builds on: the food page and its two-wheel picker (D-45, 3.6b), more measures (D-76), household
  units (D-36), the foods' servings (D-39, D-46, D-48, D-49, D-59, D-62), the consolidated food
  database (D-94), recent foods (D-60), changing a food in the meal (D-64, D-97), an amount typed
  with the search (D-96), messages after typing stops (D-99). Decision **D-102** (D-101 is
  fitsphere-72's Cloud Run beta)
- Requirements: REQ-LOG-007 ("A food's page" and "Household units" bullets amended)
- Design: the canvas's "3.6b Food page · units from your food database · LOCKED (D-102)" (boards
  `FoodUnits`, `FoodUnitsStates`; proposed in versions 100 and 101, locked in version 102), right of
  3.6b's "more measures" boards

## What the owner asked (2026-11-13)
The owner's workbook `Indian_Food_Database_CONSOLIDATED (1).xlsx` (in `D:\fitsphere-data`, kept
outside the repository) gives every row of its sheets Dishes, Branded packaged and Generic unbranded
a **Portion Type**, a **Default Unit** and its **Allowed Units** with their grams
("katori:129.0g | bowl:215.0g | cup:172.0g | plate:301.0g | tablespoon:12.9g | gram:1g").

1. A food picked in Search foods opens its page on the sheet's **default unit** (quantity 1).
2. The Measure list offers the sheet's **allowed units**; the user can change the unit and the
   quantity.
3. **Quantity** stays a drop-down list and also becomes a box to **type** in, without scrolling.
   0 or a negative number is not allowed.
4. Energy, protein, carbs, fat, fibre and "Net wt" follow the new amount at once.
5. Each food **keeps the measures it has today**; a food the sheet does not list stays as today.
6. No bug that was fixed before may come back.

## What the workbook has (counted 2026-11-13)
| Sheet | Rows | Matched to FitSphere's foods | How matched (as D-94) |
|---|---|---|---|
| Dishes | 10,142 | 9,881 rows → 730 INDB recipes, 6,809 estimated dishes, 33 home-style foods | by name; 54 names two foods share are left out, as in D-94; 207 rows are no FitSphere food |
| Generic unbranded | 625 | 542 IFCT foods (all of IFCT), 28 more by D-94's "same food" list | IFCT by code; 55 rows are no FitSphere food |
| Branded packaged | 8,514 | 8,205 packaged foods | by barcode; 309 rows are no FitSphere food |

- **Not in the sheet, unchanged:** the 630 brand labels, 1,524 packaged foods, 284 INDB recipes,
  112 home-style foods, 39 estimated dishes, My foods and dishes.
- **Units the sheet names:** katori, bowl, cup, plate, tablespoon, teaspoon, glass, piece, plate
  (4 pc), slice, roti, paratha, dosa, idli, vada, medium, egg, bar, pack, serving, handful,
  millilitre, gram and about 30 more single things (samosa, poori, ladoo…).
- **Portion Type** (vessel, piece, spoon, liquid, weight, handful) is not needed: the Default Unit
  and the Allowed Units say everything the page uses.
- Example, the owner's own: **Boiled rice** (INDB, "Uble chawal"): the sheet's default is
  **plate** (301 g), not katori; its units are katori 129 g, bowl 215 g, cup 172 g, plate 301 g,
  tablespoon 12.9 g. It opens on Plate; Katori is one tap away.

## What changes for the user
Design: the canvas's boards `FoodUnits` and `FoodUnitsStates` (every state, dark and light).

1. **The page opens on the sheet's default unit, quantity 1** (Grams 100 when the default is gram).
   Before the default, as today: a food already in the meal opens on its amount (D-64); a recent food
   on its last amount (D-60); a search with an amount ("2 katori dal") on that amount (D-96). A food
   the sheet does not list opens as today.
2. **More measures.** The Measure list holds the food's measures of today plus the sheet's units,
   each with its grams, in today's order (smallest first, then Grams, then oz, D-76). Liquids also
   get **ml**, typed like Grams.
3. **Quantity is a box you type in, with the list beside it.** Tap the number to type (a number
   keypad with a decimal point opens); tap the arrow to choose from the list (0.5, 1, 1.5 … as
   today). A number typed that is not on the list ("1.25") is shown in the list too. Grams and ml
   stay typed only, as Grams is today.
4. **The rule:** more than 0, at most two decimals, and **no upper limit** but the one the server
   needs: one food in a meal may now be up to **10,000 g** (was 2,000 g, the owner: "No max limit
   for now", "just change the maximum value"). Grams and ml: whole numbers from 1 up to 10,000 g.
   The message shows 3 seconds after typing stops or when the box is left, never because a button
   was pressed (D-99): "Enter a quantity more than 0, with at most two decimals."; over 10 kg, "That
   is more than 10,000 g of this food, the most one food can have. Enter up to 77.51." Add is greyed
   meanwhile. The list beside the box still offers 0.5 to 10 in halves, as today (a list of
   thousands of rows would be slow); a number typed outside it ("1.25", "25") is shown in the list
   too.
5. **Values at once:** a valid number changes the energy, the four nutrients and "Net wt" as it is
   typed.
6. Logged meals show the amount as today: "1.5 × katori (193.5 g)", "250 ml (250 g)".

## Rules for the data (the owner's answers, 2026-11-13)
| # | Case | The owner's answer |
|---|---|---|
| R1 | A unit the food **already has** under the same name with **other grams** (717 units, e.g. Chicken pulao "Plate" 668 g today, 150.5 g in the sheet; Boiled rice "Plate" 300 g today, 301 g in the sheet) | **The sheet's grams replace today's** ("keep the sheet value"). Meals logged before keep their own grams and stay valid (see "Old meals stay valid") |
| R2 | A food the sheet lists **several times** with different units (302 foods, 314 more rows, e.g. Idli under Rice 25.1 g, 137.5 kcal per 100 g, and under Urad Dal 45 g, 130 kcal) | **The other rows are loaded too, each as its own food**, named with its base food in brackets so a search tells them apart: "Idli" and "Idli (Urad Dal)". The food keeps the row whose base food is the food's own (an estimated dish's `base`), else whose default unit weighs what its serving weighs today, else the first row. The new foods are estimated dishes (flag `llm`), with the row's values per 100 g, serving, units and default; a row the file rates D (a weak match) is held, as D-62 and D-94 hold them, and a row that fails the sheet's checks is held with its problem: 195 added, 148 held |
| R3 | A packaged food whose **label gives a serving** and the sheet another (1,655 of 1,917, e.g. Gram Flour label 100 g, sheet 30 g) | **Keep the label's Serving** ("keep the current one", D-48); the sheet's serving is used only where the label gives none (1,062 foods) |
| R4 | Typed quantity | More than 0, at most **two decimals**, **no upper limit** but 10,000 g of one food in a meal (was 2,000 g) |
| R5 | ml counted below 1 g per ml (132 drinks) | **Claude fixes them** and gives the owner the fixed rows: `docs/data/food-units-ml-fixes.csv` |

## Things in the data you should know (not changed by this plan)
- **The units' grams are the AI tool's estimates**, not weighed: every IFCT food now gets cup,
  tablespoon, katori… (all leafy vegetables "katori 100.5 g", every banana "medium 120 g"). D-36 said
  household units come only from your measurements; approving this plan changes that for units from
  your workbook (D-102 records it; new risk **R-016**, like R-013 and R-014).
- **ml for milk counts 0.8 g per ml** in the sheet (132 of the 263 drinks matched are below 1 g
  per ml; milk is about 1.03): 250 ml of cow's milk would count as 200 g. **Fixed (R5):** a drink's
  ml, glass (250 ml), cup (200 ml), katori (150 ml) and tablespoon (15 ml) are its volume × 1.03 g
  per ml for milk and milk drinks (milk, lassi, milkshake, egg nog), × 1.00 for the others (water,
  tea, coffee, juice, buttermilk, coconut milk). Rows the sheet calls liquid that are not drinks
  ("Milk Sooji Fudge", "Rajma Kofta In Milk And Poppy Seed Gravy") are not changed; they are listed
  in the same file with "not a drink: check" for the owner.
- **Packaged "pack" and "bar" weights are the same guess for many products:** "Amul Pro Chocolate
  500g" pack 20 g, "Bold Brown Bread" pack 50 g. Loaded as the sheet says; fix in the workbook.
- A later correction is safe: see "Old meals stay valid" below.

## How it is built (for the reviewer)
**Data, server (no change to how foods are searched):**
- New script `npm run food-units:convert -- "<workbook>"` (`apps/api/src/foods/foodUnits.ts`)
  writes **`docs/data/food-units-sheet.csv`** (source, code, name, unit, grams, opens_on), applying
  R1 to R5 and D-94's matching, and adds R2's other rows to `docs/data/dish-estimates-sheet.csv` as
  new estimated dishes; it changes nothing else there (D-94's names, dishes and aliases stay as
  they are). Running it again changes nothing more.
- `foods:import` checks the sheet whole first, then loads the units into **`app.food_portions`**
  after each food's own servings (IFCT may now have servings), and the packaged foods' into a new
  table **`app.packaged_food_portions`**; the default into `app.foods.opens_on` and
  `app.packaged_foods.opens_on`. **Migration `0033_food_units.sql`.**
- **Old meals stay valid:** every unit and grams ever loaded is kept in
  `app.food_portion_history` (never deleted). The sync accepts a serving that is listed now **or was
  listed before**, so a meal logged before a correction can still be edited and saved, and a saved
  meal still logged (the D-56/D-78 kind of refusal cannot come back this way).
- `GET /v1/foods` sends each food's units in `portions` (as today) with `opensOn`, and each
  packaged food's `portions` and `opensOn` (optional fields; older phones ignore them). About 1.3 MB
  more before compression, downloaded once.
- **Shared rules** (`packages/shared`): a serving's or household unit's count may be any number
  more than 0 with at most two decimals (was halves up to 10); "ml" is a serving like "oz" (whole
  ml, its grams from the food's ml unit); an IFCT food may be logged in its listed servings (was oz
  only). One food in a meal may be up to 10,000 g (was 2,000; a food's own serving still at most
  2,000 g); an item up to 200,000 kcal and 20,000 g of a nutrient, so no amount the phone allows is
  refused (today a My food of 2,000 kcal a piece × 11 would be). The meal's totals get wider columns
  (`app.meals`, `app.saved_meals`: numeric(10,2), in migration 0033). The sync's grams check
  compares the count × grams with 0.01 g allowed **or** today's per-unit check, so nothing accepted
  today is refused. Dishes of the recipe sheet (none approved) stay at most 10 portions; a My food's
  own unit stays 0.1 to 100 (D-39).

**Phone:**
- Phone schema **version 23** (the gym-member session's PR #97 merged with no phone change, so main
  was still at 22): `foods.opens_on`, `packaged_foods.portions` and `opens_on`; the food list downloads
  once again. The packaged rows per insert drop from 76 to 66, to fit SQLite's 999 values with two more
  columns.
- `FoodDetail.tsx`: the opening order above; the Quantity box (typed, with the list); the rule and
  message through `useFieldChecks` (D-99); `itemFromServings` and the packaged ones take any count.
- `PortionStepper` (Log meal's "change amount" sheet for a food not on the list) shows a typed count
  such as 1.25 and steps it by halves, as today.
- `formatServings`: "250 ml"; counts with two decimals ("1.25 × katori").

**Found in the owner's phone test (2026-11-16):** the full food list is now 6.3 MB (about 4.6 MB
before); sent unpacked from the PC through the tunnel over the phone's hotspot, it took longer than the
phone's 15 seconds, so the phone gave up and showed "Offline". Fixed: `GET /v1/foods` and
`GET /v1/exercises` send their list gzipped to a client that accepts it (0.7 MB; Node's own zlib,
`src/routes/largeJson.ts`, no new package; the phone's networking asks for it and unpacks it unseen),
and the phone waits 60 seconds for the two lists (`LIST_TIMEOUT_MS` in `api/client.ts`), 15 for
everything else.

## Steps
| Step | What | Status |
|---|---|---|
| 1. Plan and design | This plan; the canvas's `FoodUnits` and `FoodUnitsStates`, dark and light, for the owner to approve and lock | Accepted; locked (canvas version 102) |
| 2. Data | `food-units:convert`, the sheet made from the workbook, its checks and report: 16,607 foods; 195 dishes of another base food (148 held, rated D); 106 drinks' ml fixed, 33 not-drinks listed | Built |
| 3. Server | Migration 0033, `foods:import`, `GET /v1/foods`, the shared rules, the sync's serving check and history | Built |
| 4. Phone | Schema v23, the food page (default, units, typed quantity), formats | Built |
| 5. Docs | D-102, REQ-LOG-007, `data-model.md`, `food-list-sources.md`, constraints (R-016, MVP defaults), `ui-redesign.md` 3.6b, CLAUDE.md, this plan Accepted | Done |
| Owner's steps | Copy `apps/api/.env` into this folder (for the integration tests and `dev:phone`); phone test from this folder (`npm run dev:phone`, after migration 0033 and `foods:import` on `fitsphere-dev`); "push". The Cloud Run beta uses the same database: its older API refuses an old meal whose serving's grams the import changed (1,699 servings), so deploy this API soon after the import | — |

## Tests (and the old bugs each one guards)
- **Data** (`apps/api/src/foods/foodUnits.test.ts`, a small synthetic workbook): Allowed Units read,
  a malformed one refused; each food's units and default (Grams for gram, ml for millilitre); an IFCT
  row only when the names agree; a generic food where D-94 put it; R2 (the row kept by serving weight
  or own base; another base's row an estimated dish of its own that passes the sheet's checks; a D row
  held, with no units); R3 (the label's serving kept); R5 (milk 1.03 with its glass, cup, katori and
  tablespoon; a drink 1.00; a not-a-drink row only reported); running again on its own output changes
  nothing; the units sheet read whole and each bad row refused by its line (unknown source, oz, over
  2,000 g, 0, three decimals, a unit twice, an empty row, a food twice); R1 (a unit of the same name
  takes the sheet's grams, the others numbered on); the page's opening measure only when the food has
  it; a packaged food's second Serving left out. The committed sheets: `dishEstimates.test.ts` counts
  7,043 approved and 298 held; D-94's convert run on its own workbook gives the same three sheets as
  before with the new rows in place.
- **The sync's grams check** (unit): everything accepted before still is (2 × 28 g, 0.5 oz, 10 ×
  25.06 g); a typed 1.25 or 0.01, and 250 ml; other grams refused.
- **Server integration** (`test/integration/food-units.test.ts`; all 321 integration tests pass locally, 2026-11-16, after the old ones were moved to the new limits: 10,001 g refused, 7,043 estimated dishes, the import's new counts): the import's servings,
  opening measures and history; `GET /v1/foods` sends `opensOn` and a packaged food's `portions`; the
  sync accepts a unit, a typed count, ml, an IFCT unit, a packaged unit and the label's serving, and
  refuses an unlisted unit, other grams, ml not whole, 0, three decimals and the database's serving of a
  packaged food whose label gives one; a meal logged before a unit's grams changed is accepted again,
  the new grams too; 30 foods of 10,000 g in one meal fit its totals, 10,001 g is refused. The
  migration test lists 0033; the row-level-security test lists the two new tables.
- **Phone** (`screens/foodunits.test.tsx`, `local/foodUnits.test.ts`, `mealItems.test.ts`): the page
  opens on the default (Plate; an IFCT banana on Medium; Grams for gram), a food not listed opens as
  before (an INDB recipe on its serving), the measures in order, an amount in the meal comes first
  (D-64); a typed 1.5 katori gives its values at once and is logged as "1.5 × katori (193.5 g)"; 0, -1,
  1.234 and letters refused with the message and Add greyed, empty only once the box is left (D-99),
  the message waits 3 seconds while typing; any amount up to 10,000 g, past it the most to type; the
  list shows a typed 1.25 among its halves and a choice there goes into the box; ml typed whole and
  logged as "250 ml (257.5 g)"; a packaged food's units beside its label's Serving. The phone database
  keeps the new fields, the update from version 22 clears the list's version, and the statements stay
  within SQLite's 999 values. The amount rules: reading a count, the messages, the most per unit, a
  typed count's grams and how a meal says it, a dish's typed portions, Add to existing in hundredths
  (D-34), Log meal's change sheet stepping a typed count by halves.
- Tests of the old limits changed to the owner's new ones (2,000 g → 10,000 g, halves → two decimals,
  10 oz → as many as fit 10,000 g, the list of a heavy unit now 0.5 to 10); every other existing test
  passes unchanged. The upgrade tests from older phone versions drop the three new columns too.
- **Phone checks by the owner:** Boiled rice opens on Plate, change to 2 katori; type 1.5; type 0
  (message after 3 s, Add greyed); an IFCT food (banana: Medium); a drink in ml; a packaged bar; a
  brand label as today; an old meal edited and saved; a recent food; "2 roti" in search.

## Risks
- The units are only as right as the workbook (R-016): wrong rows show wrong grams until fixed in
  the workbook and imported again; old meals stay valid.
- A bigger food list: about 44,000 more units, 1.3 MB more before compression, downloaded once per
  change; searching does not read them (D-73).
- The opening unit can change for up to 16,300 foods; foods the user logged before still open on
  their last amount (D-60).

## Not in this plan
Changing the workbook's grams; units for brand labels, My foods or dishes; Portion Type; the
barcode camera's product page (it has its own grams box); D-94's sheets (aliases, dishes, generic
foods) from the new workbook, which stay as they are unless the owner asks.
