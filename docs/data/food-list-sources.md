# Food List Sources

- Status: Draft
- Owner: Project owner (D-01)
- Last updated: 2026-10-30 (D-26 answer 3 amended: dishes come from FitSphere's standard-recipe
  sheet; the IFCT 2017 book's own terms read; the app's acknowledgement is now the book's
  citation). 2026-10-29 (D-25: the owner decided to use the list without NIN permission; accepted
  risk R-007)
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
wherever IFCT values are shown.

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

**Shown in the app (D-25):** wherever IFCT values are shown, the app shows the citation the IFCT
2017 book asks for. The book's copyright page (unnumbered, page 3 of the PDF) introduces it with
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
  wherever IFCT values are shown (D-25).

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
2026-10-30). NIN's guidelines, INDB data and USDA data are not used as sources (table below).

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
  exist yet.
- **Deferred, not dropped (backlog B-26):** curd and raita, masala chai, besan dishes and chole.
  The IFCT list has no curd, white sugar, tea or besan, and B002 "Bengal gram, whole" does not say
  which chickpea it is.

The sheet: UTF-8 without a byte-order mark, LF line endings, one header row and one row per dish.

| Column | Meaning |
|---|---|
| `dish` | Dish name |
| `portion_unit` | `piece`, or `katori (200 ml)` |
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
