# More foods plan

- Status: **Draft**, waiting for the owner's approval
- Owner: Project owner (D-01)
- Last updated: 2026-11-04
- Builds on: ADR-0006 rule 1 (values only from a source whose licence allows it, "IFCT if
  permitted, otherwise USDA or other permitted sources; record the source per item"); D-25; D-26;
  D-36 (household units); REQ-LOG-001, REQ-LOG-007, REQ-SAVED-001; the redesign's 3.6 and 3.8
  ([`ui-redesign.md`](ui-redesign.md))

## Why
The owner's phone test (2026-11-04): Search foods finds too little. The food list is IFCT 2017
only: 542 plain Indian ingredients (dals, rice, vegetables, fruits, milk), with no bread, peanut
butter, curd, tea or sugar. Dishes appear only once their recipes are measured, and none is
approved yet. The owner asked for many more foods, "like HealthifyMe", and to log peanut butter
bread by the slice.

HealthifyMe's food list is its own data and cannot be copied. The owner chose (2026-11-04) two
additions:
1. USDA's free food list;
2. "My foods", foods the user saves once.

Later options, not in this plan: AI meal reading (slice 7, ADR-0005), and a paid food database
with Indian dishes (cost and privacy need the owner).

## Part 1: USDA foods
- **Source:** USDA FoodData Central, its "as eaten" list FNDDS 2021–2023 (released 10/2024). These
  are foods and drinks as people eat them, with the portion weights recorded in the US diet
  survey (for example "1 cup"). Values are per 100 g.
- **Licence:** public domain (CC0 1.0); USDA asks to be credited. Search shows "Values: USDA
  FoodData Central" under the results, as it shows IFCT's credit.
- **Not used:** SR Legacy (final in 2018), Foundation Foods (few foods), Branded Foods (over
  400,000 mostly US supermarket products).
- **Step 1 confirms from the files:** how many foods there are (estimated at about 5,000), the
  portion wording ("1 slice"?), whether bread, peanut butter and some Indian dishes are in it,
  and the sizes. The estimate for the list on the server and on the phone is about 10 MB.
- **How it gets in:** a script turns the downloaded USDA files into
  `data/foods/usda-fndds-foods.csv`, kept in the repository: code, name, category, kcal, protein,
  carbs, fat and fibre per 100 g, and each portion's label and grams. The downloaded files stay
  outside the repository, like the NIN PDFs. `foods:import` loads the CSV.
- **Search:** Indian foods first (IFCT and dishes), then the user's own (Part 2), then USDA. Each
  USDA food is marked "USDA".
- **Servings:** a USDA food offers Grams plus its own portions, for example "slice", "cup" or
  "tablespoon". The user chooses one, then how many, 0.5 to 10 in halves, at most 2,000 g, for
  example "2 × slice (52 g)". "Quantity not specified" portions are left out.
- **Needs the owner's yes:** USDA's portion weights are used **as USDA publishes them**, not
  measured by the owner. This differs from D-36, where household units need the owner's
  measurements.
- **The peanut butter bread example:** "Bread, white" × 2 slices plus "Peanut butter" × 1
  tablespoon. Step 1 checks whether FNDDS also has a ready "peanut butter sandwich".

## Part 2: My foods (proposed REQ-LOG-011)
- **Saving one:** "Enter your own food" gets "Save to My foods". A saved food keeps its name, its
  values per 100 g as today, and optionally one serving with its grams, for example "slice = 40 g".
- **Using one:** My foods show first in Search foods, marked "My food". One is logged in grams, or
  in its serving (0.5 to 10 in halves).
- **Changing and deleting:** a My food can be edited or deleted from its sheet. Meals already
  logged keep their values (snapshot, as today).
- **Sync:** synced like saved meals, with `myFood.set` and `myFood.delete`, so it works offline
  and on another phone. It is the user's own and private (D-20), never logged (invariant 7), and
  deleted with the account.

## Data and API
- **Migration 0011:**
  - `app.foods.source` adds `usda_fndds`;
  - `app.food_portions` (source, code, label, grams);
  - `app.my_foods` (user ID, ID, name, values per 100 g, serving label and grams, saved and deleted
    times, change number), with row level security on and deleted with the user.
- **Meal items:**
  - a new source `usda_fndds`;
  - a new amount `{ unit: 'serving', label, value, grams }`, for a USDA portion or a My food's
    serving. The server checks that a USDA portion is on the list with those grams.
  - A My food item stays source `own`, with its ID as `ref`.
- **`GET /v1/foods`** adds each food's portions. **The sync pull** adds `myFoods`.
- **Phone:** schema version 10, adding the foods' portions and `my_foods`.

## Design first
The redesign's rule applies: each new screen part is designed on the canvas and locked by the
owner before it is built:
- Search foods with USDA foods and My foods (3.6);
- the serving choice for a USDA food;
- "Save to My foods" and the serving in Enter your own food (3.8);
- editing or deleting a My food.

## Steps
1. **Data check, no app change:** download FNDDS, count the foods and portions, check bread,
   peanut butter and Indian foods, measure the sizes. Report to the owner.
2. **Design** on the canvas; the owner locks it.
3. **Server:** migration 0011, the import, the contract, `myFood.set` and `myFood.delete`, tests.
4. **Phone:** schema version 10, search, servings, My foods, tests.
5. **Docs:**
   - D-39 and REQ-LOG-011;
   - `food-list-sources.md`;
   - ADR-0006's open-questions row "USDA: not used";
   - the data model and API conventions;
   - the threat model and the deletion page;
   - Legal's brief (CC0 needs no permission; noted).

## Tests
- **Import:** the converter and the import, including portions, the credit and the source per
  item.
- **Contract:** the serving amount, its limits, and a portion not on the list refused.
- **API (integration):** portions in `GET /v1/foods`; My foods synced, pulled, self-access only,
  and deleted with the account.
- **Phone:**
  - the search order;
  - a USDA food in slices with the right values;
  - saving, logging, editing and deleting a My food, offline too;
  - the version 10 upgrade.

## Owner's steps
- Approve this plan, including USDA's portion weights as published.
- Lock the designs (step 2).
- On `fitsphere-dev`, when the owner says so: migration 0011, then `foods:import`.

## Risks
- **US foods and names in an Indian app:** for example "Bread, white, toasted". Mitigated by
  Indian foods first and the "USDA" mark.
- **US recipes:** a US recipe can differ from the Indian dish of the same name, for example a
  curry. The values are USDA's for its recipe.
- **List size and download:** a few MB for each phone each time the list changes. Watched against
  the free plan's 5 GB a month (ADR-0002).
