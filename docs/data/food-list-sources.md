# Food List Sources

- Status: Draft
- Owner: Project owner (D-01)
- Last updated: 2026-10-30 (Meal logging slice, step 8, D-28: the sheet's `code` and `status`
  columns, the starter set, and how a recipe goes live). Earlier the same day (poultry checked
  again: still not confirmed raw; other recipe sources searched: none can replace weighing).
  Earlier the same day (D-26 answer 3 amended: dishes come from FitSphere's standard-recipe
  sheet; the IFCT 2017 book's own terms read; the app's acknowledgement is now the book's
  citation). 2026-10-29 (D-25: the owner decided to use the list without NIN permission;
  accepted risk R-007)
- Builds on: [ADR-0006](../architecture/decisions/ADR-0006-food-data.md) (food data, Accepted —
  D-18); REQ-LOG-007, REQ-NUT-002

Where the values in [`data/foods/ifct2017-foods.csv`](../../data/foods/ifct2017-foods.csv) come
from, the licence condition on them and the owner's decision about it, how the file was made, and
the checks it passed. The last section covers dishes, which FitSphere's own standard-recipe sheet
defines (D-26, amended 2026-10-30). D- numbers
refer to [`owner-decisions-2026-10-27.md`](../product/owner-decisions-2026-10-27.md).

## Licence — owner decision D-25, accepted risk R-007

**Decision (D-25, 2026-10-29):** FitSphere uses the IFCT 2017 food list, and the owner will not
seek permission from the National Institute of Nutrition (NIN). The owner accepts the risk this
carries as **R-007** in
[`constraints-and-assumptions.md`](../architecture/constraints-and-assumptions.md#risks). The list
may be used in development and in release builds. The app shows the acknowledgement text below
wherever IFCT values are shown; since D-44 (2026-11-04) it is one tap away, behind the i on the
search screen.

The condition the decision was taken against, word for word from page 17 of the source PDF, the
"Source and permissions" paragraph below the appendix. The PDF's printed page numbers match its
page order.

> **Source and permissions.** Indian Food Composition Tables 2017, T. Longvah, R. Ananthan,
> K. Bhaskarachary and K. Venkaiah, National Institute of Nutrition, ICMR, Hyderabad.
> https://www.nin.res.in/ebooks/IFCT2017.pdf — NIN states that the data may be reproduced for
> personal use with acknowledgment, but that no part may be stored or reproduced in electronic
> format *for creating a product* without prior written permission. Written permission from NIN
> (nin@ap.nic.in / ifct2017@gmail.com) is required before shipping this in a commercial
> application.

Notes on the decision:
- The quoted condition covers storing the data in electronic form "for creating a product", not
  only shipping it. D-25 accepts both, as risk R-007.
- The quoted condition is the PDF compiler's summary of NIN's terms. **The IFCT 2017 book's own
  terms were read on 2026-10-30**, in NIN's copy of the book (listed in
  [`docs/sources/README.md`](../sources/README.md); the PDF is kept outside the repository). Its
  copyright page (unnumbered, page 3 of the PDF) says:

  > The use and dissemination of the data in this book is encouraged. This publication can be
  > reproduced for personal use with full acknowledgment of the source. However, no part of this
  > publication can be stored or reproduced in any electronic format for creating a product
  > without the prior written permission of the National Institute of Nutrition, Hyderabad.

  It matches the compiler's summary, so the condition D-25 was decided against is NIN's own.
- ADR-0006 records that its licence question was decided by the owner under D-25.

## Source

| Item | Value |
|---|---|
| Title | IFCT 2017 Nutrient Knowledge Base (per 100 g edible portion) |
| Compiled by | Not stated in the PDF. Its metadata names ReportLab as the producer and 2026-09-25 as the creation date. It is a compilation of IFCT 2017, not an NIN publication |
| Original source | Indian Food Composition Tables 2017, T. Longvah, R. Ananthan, K. Bhaskarachary and K. Venkaiah, National Institute of Nutrition (ICMR), Hyderabad |
| File used | `IFCT2017_Nutrient_Knowledge_Base (1).pdf`, 17 pages, SHA-256 `d91eed97bc387aa0695239f28b82581582cb9c65859048a10b0223ea71504061`. Kept outside the repository and not committed |
| Coverage | 542 foods in 20 food groups, codes A001–T014 |

What the PDF says about its values (page 1, first paragraph):
- Values are per 100 g edible portion, "raw, as published". Protein, fibre, fat and carbohydrate
  are in grams.
- **Calories are in kcal, "converted from the published kilojoule figure (1 kcal = 4.184 kJ)".**
  So the kcal values were converted by the PDF's compiler. In the CSV, `kcal_source = published`
  means "as printed in this PDF", not "a kcal figure printed by NIN".
- A zero is a measured value. For example, fish, meat, poultry and eggs contain no fibre or
  carbohydrate.
- For edible oils and fats, IFCT publishes only the fatty-acid profile, so calories are shown
  as "n.p." (not published).
- 17 rows are listed in an appendix "to verify before use". The compiler flagged them by
  comparing each published energy value with the energy implied by its macronutrients (4 kcal/g
  for protein and carbohydrate, 9 kcal/g for fat).

### Acknowledgement text

**Shown in the app (D-25; D-44):** wherever IFCT values are shown, the app shows the citation the
IFCT 2017 book asks for: in Search foods, behind the i ("Food sources"), one tap away (D-44). The book's copyright page (unnumbered, page 3 of the PDF) introduces it with
"Citation of this book should be given as-":

> Longvah, T., Ananthan, R., Bhaskarachary, K. and Venkaiah, K. (2017). Indian Food Composition
> Tables 2017, National Institute of Nutrition, Indian Council of Medical Research, Hyderabad,
> Telangana, India.

The owner chose this wording on 2026-10-30. Until then the app showed the shorter citation the PDF
gives, quoted above in full: "Indian Food Composition Tables 2017, T. Longvah, R. Ananthan,
K. Bhaskarachary and K. Venkaiah, National Institute of Nutrition, ICMR, Hyderabad." Every page of
the PDF also has this footer: "Source: ICMR-NIN, Indian Food Composition Tables 2017". The PDF
gives no other acknowledgement wording.

## The CSV

`data/foods/ifct2017-foods.csv`: UTF-8 without a byte-order mark, LF line endings, one header
row and 542 data rows, in the PDF's order. Fields that contain a comma are quoted.

| Column | Meaning |
|---|---|
| `code` | IFCT food code as printed, e.g. `A001` |
| `name` | Name as printed, including its spelling (e.g. "Goosberry", "Coconut, kernal, dry", "Egg, quial") |
| `food_group` | Group heading the row appears under, e.g. "Cereals and Millets" |
| `protein_g`, `fibre_g`, `fat_g`, `carbs_g` | Grams per 100 g edible portion, as printed (always two decimals) |
| `kcal` | kcal per 100 g, as printed (whole numbers). Empty for the 14 oils and fats marked "n.p." |
| `kcal_source` | `published` (528 rows) or `not published` (14 rows, T001–T014). Missing kcal is not calculated |
| `needs_review` | `yes` for the 17 rows in the PDF's appendix, `no` for all others |
| `note` | For `needs_review = yes`, the appendix's reason, word for word. Otherwise empty |

The values are text copied from the PDF. They were never converted to numbers, so nothing was
rounded, recalculated or filled in.

## How the CSV was made

1. **Text with positions.** PyMuPDF 2.0 (MuPDF 1.28.5) read every text span on each page,
   with its position, size and colour. It was installed in a temporary folder outside the
   repository and is not a project dependency. Plain `pdftotext -layout` was not used, because
   on many pages it moves values up or down a row.
2. **Rows.** Each food row has a name, a small grey code (e.g. `B010`) and six right-aligned
   cells: Qty, Protein, Fibre, Fat, Carbs and Calories. Each value went to the column header it
   is right-aligned with (within 3 points). Each row took its food group from the nearest
   "(N items)" heading above it. Any span the parser did not assign, any empty cell and any
   misaligned value was reported. There were none.
3. **Appendix.** Code, name and reason were read from the table on page 17. Two-line reasons
   were joined with one space. The em dash in the oils reason is kept.
4. **CSV.** Written with Python's `csv` module in the PDF's order. "n.p." became an empty `kcal`
   with `kcal_source = not published`.

The one-off scripts ran from a temporary folder and are not committed.

## Checks run (2026-10-29)

All checks passed.

1. **Row counts per food group** match the counts printed in the PDF's headings. The total is
   542.

   | Food group | PDF | CSV |
   |---|--:|--:|
   | Cereals and Millets | 24 | 24 |
   | Grain Legumes | 25 | 25 |
   | Green Leafy Vegetables | 34 | 34 |
   | Other Vegetables | 78 | 78 |
   | Roots and Tubers | 19 | 19 |
   | Fruits | 68 | 68 |
   | Nuts and Oil Seeds | 21 | 21 |
   | Condiments and Spices | 33 | 33 |
   | Mushrooms | 4 | 4 |
   | Sugars | 2 | 2 |
   | Miscellaneous Foods | 2 | 2 |
   | Milk and Milk Products | 4 | 4 |
   | Egg and Egg Products | 15 | 15 |
   | Poultry | 19 | 19 |
   | Animal Meat | 63 | 63 |
   | Marine Fish | 92 | 92 |
   | Marine Shellfish | 8 | 8 |
   | Marine Mollusks | 7 | 7 |
   | Fresh Water Fish and Shellfish | 10 | 10 |
   | Edible Oils and Fats | 14 | 14 |
   | **Total** | **542** | **542** |

2. **No duplicate codes.** Within each letter, codes run without gaps from 001. Two names
   appear twice, each time with different codes and groups: "Cat fish" (P009 Marine Fish,
   S001 Fresh Water Fish and Shellfish) and "Crab" (Q001 Marine Shellfish, S007 Fresh Water
   Fish and Shellfish).
3. **Second extraction.** Every row was compared with output from a different tool, xpdf
   `pdftotext` 4.06 in `-table` mode: name, protein, fibre, fat, carbs and kcal for all 542
   rows (3,252 values). There were 0 differences, after collapsing the extra spaces
   `pdftotext` puts inside 12 names.
4. **Format.** No value cell is empty except the 14 not-published kcal. Every Qty is "100 g".
   Every macronutrient has two decimals, and every printed kcal is a whole number.
5. **Review rows.** `needs_review = yes` on exactly the 17 appendix rows (N001, Q001, S007,
   T001–T014), each with its reason in `note`.
6. **Spot check of 25 random rows** (Python `random.Random(20261029).sample`). Each row was
   cut from the rendered PDF page and compared by eye with the CSV. All 25 match.

   | # | Page | Code | Name | Protein | Fibre | Fat | Carbs | kcal | Result |
   |--:|--:|---|---|--:|--:|--:|--:|--:|---|
   | 1 | 3 | D004 | Bitter gourd, jagged, teeth ridges, elongate | 1.44 | 3.78 | 0.24 | 2.82 | 21 | Match |
   | 2 | 3 | D007 | Bottle gourd, elongate, pale green | 0.53 | 2.12 | 0.13 | 1.68 | 11 | Match |
   | 3 | 4 | D025 | Brinjal-16 | 1.26 | 3.74 | 0.34 | 3.46 | 25 | Match |
   | 4 | 5 | D055 | Kovai, small | 1.22 | 3.25 | 0.24 | 2.41 | 19 | Match |
   | 5 | 5 | D068 | Ridge gourd | 0.91 | 1.81 | 0.14 | 1.72 | 13 | Match |
   | 6 | 6 | E006 | Apricot, processed | 1.47 | 0.59 | 0.64 | 10.93 | 56 | Match |
   | 7 | 6 | E021 | Goosberry | 0.34 | 7.75 | 0.16 | 4.39 | 24 | Match |
   | 8 | 7 | E052 | Phalsa | 1.66 | 4.54 | 0.14 | 15.09 | 72 | Match |
   | 9 | 7 | E057 | Raisins, dried, black | 2.57 | 3.92 | 0.34 | 71.29 | 306 | Match |
   | 10 | 8 | H003 | Arecanut, dried, red color | 6.46 | 11.11 | 4.46 | 70.27 | 353 | Match |
   | 11 | 8 | H014 | Linseeds | 18.55 | 26.17 | 35.67 | 10.99 | 444 | Match |
   | 12 | 8 | H020 | Sunflower seeds | 23.53 | 10.80 | 51.85 | 6.85 | 586 | Match |
   | 13 | 9 | G009 | Coriander leaves | 3.52 | 4.66 | 0.70 | 1.93 | 31 | Match |
   | 14 | 9 | G018 | Onion, small | 1.82 | 1.16 | 0.16 | 11.58 | 57 | Match |
   | 15 | 9 | G022 | Chillies, red | 12.69 | 31.15 | 6.40 | 29.46 | 237 | Match |
   | 16 | 10 | M007 | Egg, poultry, omlet | 16.53 | 0.00 | 11.60 | 0.00 | 170 | Match |
   | 17 | 11 | O010 | Goat, spleen | 18.45 | 0.00 | 2.37 | 0.00 | 96 | Match |
   | 18 | 12 | O024 | Sheep, kidneys | 16.22 | 0.00 | 2.92 | 0.00 | 92 | Match |
   | 19 | 13 | P023 | Kalava | 19.38 | 0.00 | 1.20 | 0.00 | 89 | Match |
   | 20 | 13 | P024 | Kanamayya | 20.19 | 0.00 | 0.65 | 0.00 | 88 | Match |
   | 21 | 14 | P040 | Mural | 19.04 | 0.00 | 0.58 | 0.00 | 82 | Match |
   | 22 | 14 | P043 | Narba | 21.95 | 0.00 | 1.60 | 0.00 | 103 | Match |
   | 23 | 14 | P059 | Pulli paarai | 20.06 | 0.00 | 1.55 | 0.00 | 95 | Match |
   | 24 | 14 | P061 | Raai fish | 21.61 | 0.00 | 1.69 | 0.00 | 103 | Match |
   | 25 | 16 | R002 | Clam, white shell, ribbed | 11.82 | 0.00 | 1.34 | 0.00 | 60 | Match |

7. **The 17 review rows, checked by eye.** The random sample happened to include none of
   them, so each was also compared with the rendered page. All 17 match, including "n.p." for
   T001–T014.
8. **Column-shift check.** For the 528 rows with printed kcal, the printed kcal was compared
   with 4 × protein + 9 × fat + 4 × carbs. The median gap is 2.5%. A misread column would show
   up as many large gaps. Only 3 rows differ by more than 25%. This check changed no values.

## Use in FitSphere (D-26; meal logging slice, step 1)

`npm run foods:import -w @fitsphere/api` loads the CSV into `app.foods`
([data model](../contracts/data-model.md)), and `GET /v1/foods` serves it to the phone, which
caches it for offline search. The import checks the whole file first and imports nothing if any
row is wrong; running it again gives the same table. The values themselves are not changed. On
top of them:
- **Oils and fats (T001–T014) get estimated energy.** IFCT publishes no energy for them, so
  FitSphere uses 9 kcal per gram of fat (D-26), marked "estimated" (`kcal_source =
  estimated_fat_factor`). For example, ghee at 100.00 g fat gives 900.00 kcal, and corn oil at
  100.01 g gives 900.09. The factor, word for word from FAO Food and Nutrition Paper 77, *Food
  energy – methods of analysis and conversion factors* (Rome, 2003), chapter 3, section 3.5.1
  "The Atwater general factor system"
  (https://www.fao.org/4/Y5022e/y5022e04.htm, read 2026-10-29):

  > It uses a single factor for each of the energy-yielding substrates (protein, fat,
  > carbohydrate), regardless of the food in which it is found. The energy values are 17 kJ/g
  > (4.0 kcal/g) for protein, 37 kJ/g (9.0 kcal/g) for fat and 17 kJ/g (4.0 kcal/g) for
  > carbohydrates.
- **N001, Q001 and S007 are hidden from search** until they are checked against the IFCT 2017
  book (MVP default). Their published energy disagrees with their own macronutrients, for
  example N001 "Chicken, poultry, leg, skinless" at 384 kcal from 19.44 g protein and 12.64 g fat.
  They stay in the table, marked `hidden`.
- **Spelling aliases**, so search finds the names below, which are kept as printed:
  - E021 → Gooseberry;
  - H006 → Coconut, kernel, dry;
  - M007, M010, M013 → … omelette;
  - M014, M015 → … quail ….
- **The acknowledgement** above is the shared constant `IFCT_ACKNOWLEDGEMENT`. The app shows it
  wherever IFCT values are shown (D-25): in Search foods' "Food sources" sheet, behind the i (D-44).

## Notes on the data (values not changed)

- **E033 "Lemon, juice"** has the largest gap in the list: 37 kcal printed, about 8 kcal from
  its macronutrients (protein 0.41, fat 0.75, carbs 0.00). The PDF's appendix does not list
  it, so it is `needs_review = no`. Worth checking against the IFCT 2017 book with the other
  17 rows.
- **T002 Corn oil and T009 Safflower oil** show 100.01 g fat per 100 g, as printed.
- The PDF calls its values "raw", but some names describe cooked or processed foods, e.g.
  M004 "Egg, poultry, whole, boiled", M007 "Egg, poultry, omlet", A024 "Wheat, vermicelli,
  roasted", E006 "Apricot, processed".
- Names keep the PDF's spelling, so searching for "gooseberry" or "quail" will not find E021,
  M014 or M015 without aliases.
- The list holds ingredients, not dishes (roti, cooked dal, sabzi), and has no common portions
  ("1 katori"). ADR-0006 asks for both. Dishes come from FitSphere's standard-recipe sheet (next
  section).

## Dishes: FitSphere's standard-recipe sheet (D-26, amended 2026-10-30)

The IFCT list has raw ingredients, not cooked dishes, and no portions. A dish is therefore defined
by FitSphere's own standard-recipe sheet, [`standard-recipe-sheet.csv`](standard-recipe-sheet.csv).
The owner writes it by weighing raw ingredients, and approves it (D-26 answer 3, amended
2026-10-30). NIN's guidelines, INDB data and USDA data are not used as sources for the dishes
(table below). INDB's recipes are listed as foods of their own since D-46 (section below).

- **Values:** for each ingredient, IFCT's values per 100 g × its raw grams in one portion, added up
  and marked "estimated". Oils and ghee use the 9 kcal per gram of fat above.
- **Portions:**
  - per piece for roti, phulka, paratha, puri, idli, dosa, egg and omelette;
  - per katori for every other dish, with 1 katori = 200 ml.
  - Logged in half portions, 0.5 to 10.
- **Portions only:** a dish has no per-100 g cooked values and cannot be logged by cooked weight,
  since those would need yield factors.
- **Status (2026-10-30): empty.** The sheet lists 25 dishes with their IFCT ingredients. Every gram,
  count, "measured by" and date cell stays empty until the owner weighs the recipe. No dish values
  exist yet. The owner's starter set (D-28): boiled egg, roti, phulka, plain rice, toor dal, moong
  dal, aloo gobi, idli and plain dosa.
- **Deferred, not dropped (backlog B-26):** curd and raita, masala chai, besan dishes and chole.
  The IFCT list has no curd, white sugar, tea or besan, and B002 "Bengal gram, whole" does not say
  which chickpea it is.

The sheet: UTF-8 without a byte-order mark, LF line endings, one header row and one row per dish.

| Column | Meaning |
|---|---|
| `code` | The dish's stable code, e.g. `roti`: what a logged meal records as the dish. Never changed once a dish is live |
| `dish` | Dish name, as the app shows it |
| `portion_unit` | `piece`, or `katori (200 ml)` |
| `status` | `pending` (not yet measured or approved; not imported), `approved` (the owner's OK; imported) or `blocked` (must stay empty: the chicken curry, D-28) |
| `ingredient_1` … `ingredient_6` | An ingredient, named as printed in the IFCT list: raw, except the cooked entry below (M004) |
| `ifct_code_1` … `ifct_code_6` | Its IFCT code. Empty where there is a choice to make; the note lists the choices |
| `raw_g_per_portion_1` … `raw_g_per_portion_6` | Raw grams of that ingredient in one portion: its raw grams in the weighed batch ÷ the batch's count |
| `oil_or_ghee`, `oil_or_ghee_ifct_code` | The fat used: ghee T013, or an oil T001–T012 |
| `oil_or_ghee_g_per_portion` | Grams of fat in one portion: the fat used in the batch ÷ the batch's count. For a fried dish, the fat the batch absorbs |
| `cooked_g_per_piece` | Only for a dish that is one cooked IFCT entry (M004): the cooked grams of one piece, the weighed cooked pieces' grams ÷ `pieces_per_batch` |
| `pieces_per_batch` | For a piece dish: how many pieces the weighed batch made |
| `katoris_per_batch` | For a katori dish: how many 200 ml katoris the cooked batch filled |
| `measured_by`, `date` | Who weighed the recipe, and the date (YYYY-MM-DD) |
| `notes` | The counting rule, choices still to make, and anything else about the recipe |

**Counting rule.** Grams per portion = the weighed batch's grams ÷ its count: `pieces_per_batch`
for a piece dish, `katoris_per_batch` for a katori dish. Each row's note gives the rule for its
kind of dish. The chicken curry row's note starts with DO NOT FILL (below).

**How a recipe goes live (D-28).** `npm run foods:import -w @fitsphere/api` reads the sheet with
the IFCT list ([`apps/api/src/foods/dishes.ts`](../../apps/api/src/foods/dishes.ts)). It checks the
whole sheet first and imports nothing if any row is wrong, naming the line:
- **Every row:** the code and dish name appear once; each filled IFCT code is in the list, under
  the name the sheet gives; the fat is an oil or fat (T001–T014); grams have at most two decimals
  (more than 0, at most 1,000); `pieces_per_batch` is a whole number; `date` is a real date.
- **`approved` rows** must be complete: each ingredient listed has its name, code and raw grams;
  the fat has its code and grams, or all three fat cells are empty; the count for its unit (and
  not the other); `measured_by` and `date`. One portion may hold at most 2,000 kcal and 500 g of
  each nutrient, so 10 portions fit one meal item. A hidden food (N001, Q001, S007) and IFCT's
  poultry (group N, not confirmed raw) are refused.
- **`pending` rows** may be part-filled while being measured; they are not imported.
- **`blocked` rows** must keep every gram, count, `measured_by` and `date` cell empty.

Each approved dish's values for one portion are the sum of value per 100 g × grams ÷ 100 over its
ingredients and fat, worked out in exact hundredths and rounded once, and always marked
"estimated". `app.dishes` then holds exactly the approved dishes: a dish no longer approved is
removed. Only these values reach the phone (`GET /v1/foods`); the ingredients and grams stay in
this sheet.

**Cooked IFCT entries (the exception in D-26 answer 3).** Where IFCT publishes a cooked value for
the whole item, that value is used per gram of the cooked item, and the sheet records the cooked
grams per piece in `cooked_g_per_piece`. One row does this: M004 "Egg, poultry, whole, boiled".
The IFCT 2017 book says its egg values are not all for raw food:

> Except for eggs, all other food component data are for foods in the raw form.

(Preface, printed page i.)

> All data except for poultry and egg pertains to raw food.

(General information, printed page xx.)

- **The omelette does not use M007 (owner, 2026-10-30).** The book does not say how M007 "Egg,
  poultry, omlet" was prepared, or whether oil was used. Its text, searched on 2026-10-30, does not
  describe how any egg was cooked; M007 appears only as a row in its tables. So the omelette row is
  defined like other dishes: raw whole egg, M001 "Egg, poultry, whole, raw", plus the oil weighed
  per omelette.
- **Poultry: not confirmed raw, so the chicken curry row is marked DO NOT FILL (owner,
  2026-10-30).** Checked in the IFCT 2017 tables on 2026-10-30:
  - **Row names.** On Table 1's poultry page (printed page 20) the rows read "N001 Chicken,
    poultry, leg, skinless", "N002 Chicken, poultry, thigh, skinless" and "N003 Chicken, poultry,
    breast, skinless". None says raw or cooked. The egg rows on the same page do, e.g. "M001 Egg,
    poultry, whole, raw" and "M004 Egg, poultry, whole, boiled".
  - **Headings and footnotes.** Table 1's heading (printed page 3) reads "(All values are expressed
    per 100g edible portion; All blank space in the table represent below detectable limit)",
    which says nothing about raw or cooked food. The tables that list N001 to N003 (Tables 1, 2, 3,
    5, 7 and 8) have no footnotes. On their pages, "raw" and "cooked" appear only in egg rows'
    names.
  - **Food descriptions.** The book's "Food Picture and Description" section (printed pages
    427–500) describes foods in groups A to L and P to S only, so it has no entry for poultry.
  - **General text.** The only statement is "All data except for poultry and egg pertains to raw
    food" (printed page xx), while the preface (printed page i) names eggs only.
  - **Second search, later on 2026-10-30: still not established.** The whole text of the book was
    searched, and its two figures that have no text (printed pages xvi and xxiii) were viewed.
    - The sampling plan puts poultry with plant foods and eggs: "All plant foods, egg and poultry
      are continuously sampled in batches from the selected sampling sites in the country"
      (section 2.4, printed page xv). The same section says "Edible portion of the fresh produce
      are separated out and composite samples of each food are prepared" (printed pages xv–xvi).
      Section 2.5, on meat, which does not name poultry, has "ready-to-cook samples are collected
      from the butcher" (printed page xvi).
    - No cooking step appears in the sampling plans, the analytical methods (Table 5) or the
      data-flow figure, and the references cite no study of poultry. So the methods describe fresh
      samples, but no sentence says the poultry values are for raw meat, and printed page xx still
      leaves poultry out of its statement about raw food.
    - Outside the book, NIN's *Dietary Guidelines for Indians* (2024) gives a "Meat & poultry" row
      in Table 1.3, "Average values of macronutrients and dietary fibre in various food groups (Per
      100g raw weight)" (printed page 8). Its source line is "Indian Food Composition Tables 2017 &
      Nutritive Values of Indian Foods". That is an average for a food group, drawn from two
      tables, not a statement about IFCT's poultry samples.
    - NIN's annual reports for 2011–12 to 2017–18 say nothing about how the samples were
      prepared. The website printed in the book, www.ifct2017.com, now leads to a site that is not
      NIN's.
    - **The chicken curry row stays DO NOT FILL.** Only an owner decision can change that: for
      example, asking NIN (the copyright page gives ifct2017@gmail.com and nin@ap.nic.in), or
      accepting the sampling text as enough.

## USDA FoodData Central: FNDDS 2021–2023 (D-39; archived, D-47)
- **Archived since D-47 (2026-11-04):** the owner chose Indian food data only. USDA's foods are no
  longer in the food list or Search foods; `foods:import` keeps them in `app.usda_foods` and
  `app.usda_food_portions`, not served, and the app no longer shows USDA's credit. Meals logged
  with a USDA food keep it. The rest of this section describes the files, which stay in the
  repository.
- **What:** USDA's "as eaten" foods (FNDDS, the Food and Nutrient Database for Dietary Studies,
  2021–2023, released 10/2024), with the serving weights recorded in the US diet survey. Values per
  100 g.
- **Licence:** "USDA FoodData Central data are in the public domain and they are not copyrighted.
  They are published under CC0 1.0 Universal" (fdc.nal.usda.gov/api-guide, read 2026-11-04). USDA
  asks to be credited; the app shows `USDA_ACKNOWLEDGEMENT` with IFCT's, in Search foods' "Food
  sources" sheet behind the i (D-44).
- **File read:** `FoodData_Central_survey_food_json_2024-10-31.zip`, 3,835,292 bytes, SHA-256
  `dfb06ae7ddc397ccd570b91c14b75438ab2ba39f64f22d321f61d4a52a77f3eb`, from
  fdc.nal.usda.gov/download-datasets, kept in `D:\fitsphere-data\usda-fndds-2024-10-31\`, outside
  the repository.
- **Made with** `npm run usda:convert -w @fitsphere/api -- <surveyDownload.json>`
  (`apps/api/src/foods/usda.ts`):
  - `data/foods/usda-fndds-foods.csv`: 5,431 foods, each with its food code, name, WWEIA category
    and kcal, protein, carbohydrate (by difference), fat and total dietary fibre per 100 g,
    rounded to two decimals. "Milk, human" has no values and is left out.
  - `data/foods/usda-fndds-portions.csv`: 14,738 servings in USDA's order. Left out (MVP default):
    "Quantity not specified"; servings counted in ounces or cubic inches ("1 oz", "per fl oz of
    beverage"); names over 80 characters (16 turkey cuts); and a second serving with the same name.
    A cup or bottle that only names its ounces ("1 cup (8 fl oz)") stays, its grams shown.
- **Checks:** `foods:import` refuses the files whole on a wrong header, a code that is not 8 digits,
  a value over 100 g or 1,000 kcal per 100 g (lard has 902), or a serving of an unknown food, over
  2,000 g or in ounces. The committed files load whole into PostgreSQL in the integration tests.
- **Coverage noted (2026-11-04):** 125 breads; 39 peanut-butter foods, including "Peanut butter
  sandwich, with regular peanut butter, on white bread"; about 25 Indian-named foods, which are US
  recipes, e.g. USDA's paneer has 22.5 g carbohydrate per 100 g. IFCT's foods come first in search.

## Indian Nutrient Databank (INDB): Indian recipes (D-46)
- **What:** 1,014 Indian recipes as cooked and eaten (curries, dals, sabzis, parathas, snacks,
  drinks, sweets), each with its values per 100 g and one serving, published with Vijayakumar A,
  Dubasi HB, Awasthi A, Jaacks LM, "Development of an Indian Food Composition Database", *Current
  Developments in Nutrition* 2024;8(7):103790, doi:10.1016/j.cdnut.2024.103790. INDB computed the
  values from each recipe's ingredients, mostly IFCT 2017's (2004's, UK CoFID's and USDA's where
  IFCT has none), per 100 g of the ingredients' total weight, with no cooking-yield correction.
- **Licence:** none stated for the data. The article is open access under CC BY 4.0; its data
  statement says "All analysis codes and files are publicly and freely available on GitHub"; the
  repository has no licence file. Its recipes come from *The Art & Science of Cooking* (490),
  *Basic Food Preparation* (376) and websites (148). Used under owner decision D-46, accepted risk
  R-009; Legal is asked (Q-049, L-15). The app shows `INDB_ACKNOWLEDGEMENT` with IFCT's and USDA's,
  in Search foods' "Food sources" sheet behind the i.
- **Files read:** from github.com/lindsayjaacks/Indian-Nutrient-Databank-INDB- at commit
  `fbdb62bec519c6e2468582a799fb47e194b42558` (2025-04-08), downloaded 2026-11-04 to
  `D:\fitsphere-data\indb-2026-11-04\`, outside the repository. Only `INDB.xlsx` is used:
  1,063,585 bytes, SHA-256 `65f91911de09ebdb4b80c4a3dc3ff372a35420e05444239d8df8a42e8b5b9ecf`.
  `recipes_servingsize.xlsx`, `recipes_names.xlsx`, `Units.xlsx` and `README.md` were read, not
  used.
- **Made with** `npm run indb:convert -w @fitsphere/api -- <INDB.xlsx>`
  (`apps/api/src/foods/indb.ts`, read with `apps/api/src/foods/xlsx.ts`, no added library):
  - `data/foods/indb-foods.csv`: 1,014 recipes, each with its INDB code (ASC, BFP or OSR and 3
    digits), name, kcal, protein, carbohydrate, fat and fibre per 100 g, rounded to two decimals;
    every value estimated. None left out.
  - `data/foods/indb-portions.csv`: 917 servings, one per recipe, "1 <INDB's serving unit>", its
    grams 100 × the serving's energy ÷ the energy per 100 g. INDB's protein, carbs and fat per
    serving give the same weight, within 1 %, in all 915 recipes checked. The 97 recipes INDB
    gives no serving stay in grams only.
- **Checks:** `foods:import` refuses the files whole as it does USDA's (header, codes, values over
  100 g or 1,000 kcal per 100 g, servings of unknown recipes or over 2,000 g). The committed files
  load whole into PostgreSQL in the integration tests.
- **In the app:** tagged "INDB", listed after FitSphere's dishes and before IFCT's foods; a recipe
  opens on its serving, as INDB's per-100 g values are of the raw ingredients, not the cooked dish.
  Not used for FitSphere's own dishes, which stay the owner's measured recipes (D-26).

## Brand labels: FitSphere's brand-labels sheet (D-49)
`docs/data/brand-labels-sheet.csv` holds packaged Indian foods with the values their brands publish,
each read from the brand's or manufacturer's own website or, since D-52, a shop's listing of the
product or a file the owner made with another AI tool, and approved by the owner.

| Column | Rule |
|---|---|
| `code` | FitSphere's own: lowercase letters and digits joined by hyphens, at most 64, unique |
| `brand`, `product` | As the page names them; listed as "brand product" unless the product starts with the brand |
| `status` | `proposed` (read, waiting for the owner's OK: not imported) or `approved` (imported) |
| `basis` | `100 g`, or `100 ml` for a drink (taken as 100 g) |
| `kcal`, `protein_g`, `carbs_g`, `fat_g` | Per 100 g or ml, at most two decimals; nutrients 0 to 100, kcal at most 1,000; the energy must agree with them (4, 4 and 9 kcal a gram, within a quarter or 20 kcal) |
| `fibre_g` | As above, or empty when the label gives none (shown as unknown) |
| `serving`, `serving_grams` | Together or both empty: the serving as printed ("1 slice") and its grams or ml, at most 2,000 |
| `source_url`, `read_on` | The https address of the page the values were read from (empty for an `llm` row only), and the date |
| `notes` | The printed text the values were read from, and any working: a per-100 g value worked out from a per-serving one, or a page that is the brand's international site |
| `flag` | Empty, `scrap` (D-52) or `llm` (D-53): kept on the server in `app.foods.flag`, never sent to the phone; nothing reads it yet |

- Sources (D-52, amending D-49): the brand's or manufacturer's own website first; when it shows no
  values, a shop's listing of the product, preferably the photo of the pack's label; and files the
  owner makes with another AI tool. Never a model's memory, nutrition apps or blogs. One row, Catch
  Chat Masala, takes its values from Open Food Facts, at the owner's word. A product with no
  readable values is not added.
- The 187 rows approved on 2026-11-06 (D-52) carry the flag `scrap`; the first 23 have none.
- AI estimates (D-53, amending D-52): a row may hold an AI tool's estimate of the product's values
  from its general knowledge, not read from any label, once the owner approves it; it is flagged
  `llm`, has no page and keeps the tool's note. 314 such rows were approved on 2026-11-06 (56 bread
  and biscuits, then 221 across the other categories, then 12 ready meals and frozen foods, then 25
  masalas, oils and drinks); they show in the app like the other brand
  labels (R-012). Products already in the database, as brand labels or Open Food Facts' packaged
  products, were left out.
- `npm run foods:import` checks the whole sheet and refuses all of it if any row is wrong, naming
  the line; only approved rows reach `app.foods` (source `brand_label`) and their servings
  `app.food_portions`. Never approve a row without the owner's word.
- Licence: the pages are the brands' own or shops', "all rights reserved"; the values are facts
  printed on the packs. Accepted risk R-010; Legal is asked (Q-049, L-16).

## Open Food Facts: packaged foods sold in India (D-48)
- **What:** Open Food Facts' products whose countries include India, with the values their labels
  give per 100 g (per 100 ml for a drink, taken as 100 g) and, where given in grams, one serving.
  Crowd-sourced: contributors copy them from the packs.
- **Licence:** the Open Database License (ODbL), allowing commercial use with attribution and
  share-alike; the app shows `OFF_ATTRIBUTION` ("Contains data from Open Food Facts, available under
  the Open Database License") behind Search foods' i. Kept in its own table, `packaged_foods`, on the
  server and the phone (ADR-0006 rule 2, ADR-0009). Legal is asked about the share-alike duty
  (Q-049, L-13).
- **File read:** `en.openfoodfacts.org.products.csv.gz`, Open Food Facts' export of 2026-11-04
  (Last-Modified 2026-11-04 09:04 GMT), 1,528,045,350 bytes, SHA-256
  `224fa0410236f4b77274c70d70cfe76be10ca9b377e1e47a2530202309db08fc`, from
  static.openfoodfacts.org/data, kept in `D:\fitsphere-data\off-2026-11-04\`, outside the
  repository.
- **Made with** `npm run off:convert -w @fitsphere/api -- <the .csv.gz>`
  (`apps/api/src/foods/offIndia.ts`; read a line at a time):
  - 4,893,449 products read; 25,838 sold in India; **9,764 kept**, 6,263 with a serving in grams.
  - Left out: 11,759 with kcal, protein, carbohydrate or fat missing or out of range (each 0 to 100 g,
    together at most 105 g; kcal at most 1,000); 194 whose energy does not agree with them (4 kcal a
    gram of protein and carbohydrate, 9 of fat, within a quarter or 20 kcal); 3,206 with no usable
    name; 915 whose barcode is not a valid GS1 code for one product (its check digit, and not an
    in-store code: an EAN-8 starting 0 or 2, an EAN-13 starting 2).
  - The brand is the first one named. kJ are turned into kcal ÷ 4.184 when kcal are not given. A
    serving in millilitres is left out.
- **Checks:** `foods:import` refuses the file whole on a wrong header, an invalid or repeated
  barcode, or a value out of range. The committed file loads whole into PostgreSQL in the
  integration tests.
- **Coverage noted (2026-11-04):** about 2,850 brands; among them Amul 322 products (name or brand),
  Britannia 322, Haldiram's 206, Maggi 148, Parle 147, Mother Dairy 46.

## Household units: FitSphere's household-measures sheet (D-36)
`docs/data/household-measures-sheet.csv` gives the grams one household unit of a listed food holds,
so the food can be logged as "1 glass" or "2 teaspoons" as well as in grams (plan:
[`household-units.md`](../plans/household-units.md)). The grams come only from the owner's own
weighing: no published table is used (NIN's household-measure tables are not a source, D-26).

| Column | Rule |
|---|---|
| `ifct_code`, `food` | An IFCT row, named exactly as the list names it; not one hidden until checked |
| `measure` | `teaspoon (5 ml)`, `tablespoon (15 ml)`, `katori (200 ml)`, `glass (250 ml)` or `piece` |
| `status` | `pending` (not imported) or `approved` (the owner's OK: imported) |
| `grams_per_measure` | More than 0, at most 1,000, at most two decimals: one level unit, the edible part only (a banana peeled, an almond shelled), as IFCT's values are per 100 g edible portion |
| `measured_by`, `date` | Required once approved; the date as YYYY-MM-DD |
| `notes` | How to weigh it |

- One row per food and unit. `npm run foods:import` checks the whole sheet with the IFCT list and
  refuses all of it if any row is wrong, naming the line; only approved rows reach
  `app.food_measures`, and a row no longer approved is removed at the next import.
- The starter rows, 62 for 52 foods (the owner's choice of measured units for every food,
  2026-11-03), are `pending`, with no grams, in the order they are weighed: drinks by the glass;
  ghee and six oils by the teaspoon and tablespoon; jaggery; atta, maida, rice, poha and rava;
  five raw dals by the katori; nuts, seeds and dried fruit; fruit by the piece or katori;
  vegetables by the piece; egg; paneer. Never fill in or approve a row without the owner's
  measurements.

### Cooked-dish and portion sources considered and not used

Searched and read on 2026-10-29 and 2026-10-30. Page numbers are the printed ones. The NIN
documents are listed, with their hashes and terms, in [`docs/sources/README.md`](../sources/README.md);
the PDFs are kept outside the repository.

| Source | What it has for dishes | Why it is not used |
|---|---|---|
| NIN, *Dietary Guidelines for Indians*, 2024 | Raw food-group amounts; katori sizes (Annexure I, pp. 111–112); raw-food measures in household utensils (Annexure II, pp. 113–124); infant recipes | No weight for one adult dish portion. Its copyright page asks for NIN's written permission before electronic use in a product |
| NIN, *Dietary Guidelines for Indians – A Manual*, 2011 | Approximate kcal per household serving of 56 cooked dishes (Annexure 8, pp. 106–107); sample meal plans (Annexure 2a, 2b, pp. 87–88) | No grams, protein or ingredients. Not to be reproduced for commercial purposes; NIN's approval is asked for |
| NIN, *My Plate for the Day*; NIN's short guidelines booklet | Food-group amounts | No dish portions |
| The IFCT 2017 book | Raw foods, except eggs (pp. i, x and xx; see "Cooked IFCT entries" above) | No cooked dishes or household measures |
| Indian Nutrient Databank (INDB): Vijayakumar A, Dubasi HB, Awasthi A, Jaacks LM, "Development of an Indian Food Composition Database", *Curr Dev Nutr* 2024;8(7):103790; data on GitHub (`lindsayjaacks/Indian-Nutrient-Databank-INDB-`) | 1,014 recipes with ingredients, grams and servings; values per 100 g of the ingredients' total weight, with no cooking-yield correction | The data has no licence. It is built on IFCT 2017 and on recipes from two copyrighted cookbooks |
| USDA FoodData Central | A few Indian dishes in US recipes (dal, dosa, sambar, cooked rice, a commercial chapati), with gram portions; public domain (CC0) | US recipes, not IFCT ingredients. The owner chose not to use it |
| USDA *Table of Nutrient Retention Factors*, Release 6 (2007) | Nutrient retention in cooking | No weight yields |
| USDA *Table of Cooking Yields for Meat and Poultry* (2014) | Cooking yields | Meat and poultry only |
| Bognár (2002), tables of weight yield and retention factors (Bundesforschungsanstalt für Ernährung, Karlsruhe) | Weight yields of cooked foods, by its title | Not found on an official site |
| FAO/INFOODS *Food Composition Study Guide* (module 8, recipes) and *Guidelines for Food Matching* 1.2 (2012) | Recipe-calculation and food-matching guidance | Guidance, not Indian dish data. FAO's website terms allow non-commercial use. Not read in full |
| EuroFIR recipe-calculation reports (Reinivuo and Laitinen, 2007; Vásquez-Caicedo and others, 2008); USDA *Agriculture Handbook No. 102* (1975) | Methods; yields by stage of preparation, by title | Not read: methods, not Indian dish data |
| *Indian Journal of Nutrition and Dietetics*: "Some Common Indian Recipes and their Nutritive Value" and "Standardisation and Nutrient Analysis of Nine Commonly Used South Indian Recipes"; "Enhancing FKG.in: automating Indian food composition analysis" (arXiv 2412.05248) | Recipe nutrient values, by title | Found in searches, not read; licences unknown |
| A news report on the 2024 guidelines (*The Tribune*) | Says one roti is about 30 g of flour | Not a primary source; the claim is not in the guidelines' text |
| PM POSHAN guidelines, 2023 (Ministry of Education), and its norms on data.gov.in | Raw amounts per child for a whole school meal: "100 grams of food grain (rice/wheat/nutri-rich cereals), 20 grams of pulses, 50 grams of vegetables and 5 grams of oil/fat" | Not dish recipes. data.gov.in's Government Open Data License – India would allow use, but no dish data was found there |
| State school-meal and child-nutrition (ICDS) documents: Haryana's 2019–20 plan, Odisha's hot cooked meal guidelines, Tamil Nadu's ICDS recipe book | Dish names; raw rations per child (Odisha: rice 80 g, dal 30 g, oil 3 g); millet recipes in mixed units | No cooked weight or volume, so no grams per piece or katori; no licence text found |
| FSSAI, *Ghar ki Rasoi: Tasty bhi, Healthy bhi* (2021) | Contest recipes, none of the 25 dishes, in cups and grams with servings | Wrong dishes. Its terms say it "shall not be printed and distributed for commercial purposes" |
| NIN, *Count What You Eat* (Swaran Pasricha, 1989, reprinted) | About 16 of the dishes, with ingredient weights in grams and a 150 ml bowl, by a bookseller's description | Not seen. NIN reserves all rights, so it would need NIN's written permission |
| Wikibooks Cookbook | Some of the dishes (chapati, poha, upma, idli, sambar, khichdi, rajma, aloo gobi) | Open licence (CC BY-SA), but anonymous recipes, not weighed, mostly in cups |
| "6000+ Indian Food Recipes Dataset" (Mendeley Data, 2020) | Many recipes with servings | Labelled CC BY 4.0, but made from another website's recipes, so the label cannot license them |
| UK *Composition of Foods Integrated Dataset* 2021 (McCance and Widdowson's) | Values per 100 g of a few cooked Indian dishes, from UK samples | Open Government Licence, but values of cooked dishes, not raw grams, so they do not fit D-26's method |
| A hospital diet annexure (HIMSR, 2026); *Nutritive Value of Indian Foods* (Health Bulletin No. 23, 1956) | The main ingredient per serving only, e.g. "Roti (30gm each)"; no recipes | Incomplete; no licence text found |

### Can another source replace weighing? (searched 2026-10-30)
The last eight rows above come from a second search, later on 2026-10-30. It looked for a source
that gives, for these dishes, the raw grams of each ingredient for one portion, or for a batch
with its yield, under terms that allow use in a commercial app.
- **No source does both, for any of the 25 dishes.** The sources with an open licence have
  per-child meal amounts, values of cooked dishes, or recipes in cups that were never weighed.
- **The closest is NIN's *Count What You Eat*,** which would need NIN's written permission.
- **So no recipe can be filled from verified existing data.** Every row except chicken curry
  needs the owner's weighing.
  - The boiled egg needs only the weight of one boiled, peeled egg. Its values are IFCT's own
    (M004), but the IFCT book gives no egg weight.
  - Choices to make before weighing are in each row's note: the rice (plain rice, idli, plain
    dosa), the rajma, the vegetables (vegetable curry), the fish (fish curry), and the oil or
    ghee (19 rows).
  - The chicken curry row is blocked (above).
