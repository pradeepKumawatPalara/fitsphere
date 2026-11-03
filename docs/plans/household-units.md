# Household units plan

- Status: **Accepted**, approved by the project owner on 2026-11-03 (D-36: "I accept the plan for
  adding the unit like tablespoon, glass, bowl… go ahead and build it")
- Owner: Project owner (D-01)
- Last updated: 2026-11-03
- Builds on: D-36; ADR-0006 rule 1 ("values per 100 g plus common portions"); the
  [Meal logging slice](meal-logging-slice.md) (D-26, D-28); the redesign's 3.6
  ([`ui-redesign.md`](ui-redesign.md)); [`test-strategy.md`](../quality/test-strategy.md)

A listed food can be logged in a household unit as well as in grams: "1 glass of milk", "2
teaspoons of ghee", "1 banana" (REQ-LOG-007). The grams a unit holds for a food come only from the
owner's measurements, in FitSphere's household-measures sheet, as the dishes' grams come from the
standard-recipe sheet (D-26, D-28). A food offers a unit only once its row is measured and approved;
grams stay available for every food. Built on the branch `ui-redesign`, before the redesign's
Training module (the owner, 2026-11-03).

## Progress
| Step | Status |
|---|---|
| 1. The contract, the sheet and its import, migration 0009, GET /v1/foods, the sync's check | Built |
| 2. The phone: the cached measures (schema version 8), the unit choice in Search foods, changing and joining items | Built |
| Owner's steps | Migration 0009 and `foods:import` ran on `fitsphere-dev` on 2026-11-03 at the owner's go (0 units imported). Not done: measuring and approving rows, then `foods:import` again |

## Scope
| In this plan | Requirements |
|---|---|
| The units and their sizes (below) | REQ-LOG-007, ADR-0006 rule 1, D-36 |
| `docs/data/household-measures-sheet.csv`: one row per food and unit, `pending` or `approved`; the import refuses the whole sheet if any row is wrong | D-36 answer 1 |
| `app.food_measures` (migration 0009), filled by `foods:import` with the approved rows only | ADR-0006 rule 1 |
| GET /v1/foods gives each food its `measures`: the unit and the grams one holds | ADR-0006 rule 1 |
| A meal item's amount can be a unit: `{ unit: 'measure', measure, value, grams }` | REQ-LOG-007 |
| The sync refuses an item in a unit its food does not have on the list, as it refuses an unlisted dish | D-28 |
| Search foods (3.6): a food with units shows Grams and its units as choice blocks; a unit is counted in halves | REQ-LOG-007 |
| Log meal: changing a unit item's count; the same food in the same unit joins the one already in the meal (D-34) | REQ-LOG-007, D-34 |

Not in this plan: barcode products and your own food stay in grams (their values come per 100 g
from Open Food Facts or a label, and no measured row can exist for them); dishes stay in portions
(D-26, D-28); AI meal reading (slice 7).

## Decisions (MVP defaults, D-18)
1. **Units and sizes:** teaspoon (5 ml), tablespoon (15 ml), katori (200 ml, the dishes' katori,
   D-26), glass (250 ml) and piece. "Half a glass" is 0.5 glass. Sizes are what the owner fills
   when measuring; the grams a food's unit holds are weighed, never worked out from millilitres.
2. **Counts** go in halves from 0.5 to 10, as dish portions, and the grams they come to are at most
   2,000, the most for one food (D-26). The − and + stop there.
3. **Grams per unit:** more than 0 and at most 1,000, with at most two decimals, of the edible part
   (IFCT values are per 100 g edible portion: a banana peeled, an almond shelled). Measured level.
4. **What an item keeps:** the count, the unit and the grams it came to; its values are worked out
   from the grams, so a unit item and a gram item of the same food agree. A later change to a
   unit's grams never changes a past meal (the snapshot rule, D-26).
5. **Joining (D-34):** the same food joins only in the same unit (a glass with a glass); a glass and
   grams of the same food stay two items, as grams and portions do.
6. **A unit taken off the list** (no longer approved): a meal using it that is saved again is
   refused at the sync, as for a dish taken off (D-28).

## Owner's steps
1. Measure and approve rows in `docs/data/household-measures-sheet.csv`: weigh one level unit of
   the food (the edible part), put the grams, `measured_by` and the date, and set `approved`. Never
   filled or approved by anyone else. The starter rows are `pending`, with no grams.
2. On `fitsphere-dev`, only when the owner says so: `npm run migrate -w @fitsphere/api` (0009), then
   `npm run foods:import -w @fitsphere/api`. **Run the migration before starting the updated API**:
   until 0009 is applied, GET /v1/foods fails, so the phone cannot download the food list.
3. On the phone: the next food-list download brings the units (schema version 8 clears the
   cached list's version). No new build: JavaScript only.

## Tests
- Shared: the amount's unit form, its limits, and that only a listed food may use a unit.
- API: the sheet's checks (unit tests); the import, GET /v1/foods with measures, and the sync
  refusing an unlisted unit (integration).
- Phone: the item maths (count to grams to values, changing, joining, the limits); the cached
  measures; Search foods with a unit; changing a unit item in Log meal.

## Risks
- Until rows are approved, no food offers a unit: the feature shows nothing (accepted, D-36).
- Running the updated API before migration 0009 breaks the food-list download (owner's step 2).
