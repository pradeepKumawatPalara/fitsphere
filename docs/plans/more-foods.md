# More foods plan

- Status: **Accepted** (the owner, in chat, 2026-11-04: "go ahead", with USDA's portion weights as
  published, and adding a unit and quantity for each food the user enters)
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

## Part 2: your own food in any unit, and My foods (proposed REQ-LOG-011)
- **Unit and quantity (the owner's addition, 2026-11-04):** "Enter your own food" asks for each
  food's unit and quantity:
  - **Units:** grams (g), millilitres (ml), piece, slice, cup, katori, bowl, glass, tablespoon,
    teaspoon or serving. The list is fixed (MVP default).
  - **Values:** for grams or millilitres, per 100 g or 100 ml, as a label prints them, with the
    quantity eaten in g or ml (1 to 2,000). For any other unit, per one of that unit, for example
    "1 slice: 180 kcal, 6 g protein…".
  - **Quantity:** 0.1 to 100, with at most one decimal (MVP default). The grams of a slice need not
    be known.
- **Saving one:** "Save to My foods" keeps the food's name, unit and values.
- **Using one:** My foods show first in Search foods, marked "My food". Picking one asks only the
  quantity, in its unit.
- **Changing and deleting:** a My food can be edited or deleted from its sheet. Meals already
  logged keep their values (snapshot, as today).
- **Sync:** synced like saved meals, with `myFood.set` and `myFood.delete`, so it works offline
  and on another phone. It is the user's own and private (D-20), never logged (invariant 7), and
  deleted with the account.

## Step 1 results (2026-11-04)
Read from `FoodData_Central_survey_food_json_2024-10-31.zip`: 3,835,292 bytes, SHA-256
`dfb06ae7ddc397ccd570b91c14b75438ab2ba39f64f22d321f61d4a52a77f3eb`, kept in
`D:\fitsphere-data\usda-fndds-2024-10-31\`, outside the repository.
- **Foods:** 5,432, in 172 categories. All but one have kcal, protein, fat, carbohydrate and fibre
  per 100 g; the one without values is left out.
- **Servings:** 3.1 per food on average, at most 15, besides "Quantity not specified". 675 foods
  have a slice, for example "Bread, white": "1 medium or regular slice" 28 g, "1 small or
  thin/very thin slice" 24 g, "1 large or thick slice" 43 g. Peanut butter has "1 tablespoon" 16 g.
- **Coverage:** 125 breads; 39 peanut-butter foods, including "Peanut butter sandwich, with regular
  peanut butter, on white bread" (382 kcal per 100 g; "1 sandwich" 92 g). About 25 Indian-named
  foods: dal, chicken curry, biryani, paneer and others. These are US recipes, for example USDA's
  paneer has 22.5 g carbohydrate per 100 g; IFCT and the owner's dishes stay first.
- **Size:** the trimmed CSV is about 1 MB, not the 10 MB estimated, so the list adds about 1 MB on
  the server and on the phone.
- **MVP defaults:**
  - left out: servings in ounces ("1 oz", "1 fl oz") and cubic inches, since India uses metric,
    and "Quantity not specified";
  - kept: "Guideline amount per …" servings, as USDA gives them.

## Data and API
- **Migration 0011:**
  - `app.foods.source` adds `usda_fndds`;
  - `app.food_portions` (source, code, label, grams);
  - `app.my_foods` (user ID, ID, name, unit, its values per 100 g, 100 ml or one unit, saved and
    deleted times, change number), with row level security on and deleted with the user.
- **Meal items:**
  - a new source `usda_fndds`;
  - a new amount `{ unit: 'serving', label, value, grams }` for a USDA portion; the server checks
    that the portion is on the list with those grams;
  - for the user's own food, an amount in any of Part 2's units, `{ unit: 'own', name, value }`:
    the quantity eaten in that unit, with the item's values for that quantity, as today;
  - a My food item stays source `own`, with its ID as `ref`.
- **`GET /v1/foods`** adds each food's portions. **The sync pull** adds `myFoods`.
- **Phone:** schema version 10, adding the foods' portions and `my_foods`.

## Design first
The redesign's rule applies: each new screen part is designed on the canvas and locked by the
owner before it is built:
- Search foods with USDA foods and My foods (3.6);
- the serving choice for a USDA food;
- the unit, quantity and "Save to My foods" in Enter your own food (3.8);
- editing or deleting a My food.

## Steps
1. **Data check, no app change:** download FNDDS, count the foods and portions, check bread,
   peanut butter and Indian foods, measure the sizes. Report to the owner. *Done 2026-11-04 (see
   "Step 1 results").*
2. **Design** on the canvas; the owner locks it. *Designed 2026-11-04, waiting for the owner:*
   - 3.6 gains "Search with My foods", "USDA food by serving" and "My food by its unit", and the
     USDA credit;
   - 3.8 gains the unit choice, values per 100 g or per one unit, the quantity, "Save to My foods"
     (ticked at first; MVP default), and "Edit a My food" and "Delete a My food".
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
  - your own food in each unit, with values per 100 g or ml or per one unit, and the quantity's
    limits;
  - saving, logging, editing and deleting a My food, offline too;
  - the version 10 upgrade.

## Progress
Built on branch `feat/more-foods`, 2026-11-04:
- Step 3, the server: migration 0011; `npm run usda:convert` and `foods:import` (5,431 foods,
  14,738 servings); `GET /v1/foods` with servings; `myFood.set` and `myFood.delete`; the serving
  check on meals. Shared, API and integration tests pass, the real files loading whole.
- Step 4, the phone: schema version 10; Search foods with My foods and USDA foods; servings; your
  own food in any unit; My foods saved, edited and deleted; Log meal's change sheet. Mobile tests
  pass.
- Step 5, the docs: D-39, REQ-LOG-011, the data model, API conventions, `food-list-sources.md`,
  ADR-0006's row, the threat model, the deletion page, Legal's brief, the MVP defaults.

## Owner's steps
- ~~Approve this plan, including USDA's portion weights as published~~ (done, 2026-11-04).
- ~~Lock the designs (step 2)~~ (done, 2026-11-04: "good to go").
- On `fitsphere-dev`, when the owner says so: migration 0011, then `foods:import`.

## Risks
- **US foods and names in an Indian app:** for example "Bread, white, toasted". Mitigated by
  Indian foods first and the "USDA" mark.
- **US recipes:** a US recipe can differ from the Indian dish of the same name, for example a
  curry. The values are USDA's for its recipe.
- **List size and download:** a few MB for each phone each time the list changes. Watched against
  the free plan's 5 GB a month (ADR-0002).
