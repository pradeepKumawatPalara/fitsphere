# Food List Sources

- Status: Draft
- Owner: Project owner (D-01)
- Last updated: 2026-10-29 (D-25: the owner decided to use the list without NIN permission;
  accepted risk R-007)
- Builds on: [ADR-0006](../architecture/decisions/ADR-0006-food-data.md) (food data, Accepted —
  D-18); REQ-LOG-007, REQ-NUT-002

Where the values in [`data/foods/ifct2017-foods.csv`](../../data/foods/ifct2017-foods.csv) come
from, the licence condition on them and the owner's decision about it, how the file was made, and
the checks it passed. D- numbers
refer to [`owner-decisions-2026-10-27.md`](../product/owner-decisions-2026-10-27.md).

## Licence — owner decision D-25, accepted risk R-007

**Decision (D-25, 2026-10-29):** FitSphere uses the IFCT 2017 food list, and the owner will not
seek permission from the National Institute of Nutrition (NIN). The owner accepts the risk this
carries as **R-007** in
[`constraints-and-assumptions.md`](../architecture/constraints-and-assumptions.md#risks). The list
may be used in development and in release builds. The app shows the acknowledgement text below
wherever IFCT values are shown.

The condition the decision was taken against, word for word from page 17 of the source PDF:

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
- The quoted condition is the PDF compiler's summary of NIN's terms. The terms in the IFCT 2017
  book itself were not read.
- ADR-0006 records that its licence question was decided by the owner under D-25.

## Source

| Item | Value |
|---|---|
| Title | IFCT 2017 Nutrient Knowledge Base (per 100 g edible portion) |
| Compiled by | Not stated in the PDF. Its metadata names ReportLab as the producer and 2026-09-25 as the creation date. It is a compilation of IFCT 2017, not an NIN publication |
| Original source | Indian Food Composition Tables 2017, T. Longvah, R. Ananthan, K. Bhaskarachary and K. Venkaiah, National Institute of Nutrition (ICMR), Hyderabad |
| File used | `IFCT2017_Nutrient_Knowledge_Base (1).pdf`, 17 pages, SHA-256 `d91eed97bc387aa0695239f28b82581582cb9c65859048a10b0223ea71504061`. Kept outside the repository and not committed |
| Coverage | 542 foods in 20 food groups, codes A001–T014 |

What the PDF says about its values (page 1):
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

The PDF gives this citation, quoted above in full:

> Indian Food Composition Tables 2017, T. Longvah, R. Ananthan, K. Bhaskarachary and K. Venkaiah,
> National Institute of Nutrition, ICMR, Hyderabad.

Every page also has this footer: "Source: ICMR-NIN, Indian Food Composition Tables 2017". The
PDF gives no other acknowledgement wording.

**Shown in the app (D-25):** wherever IFCT values are shown, the app shows the citation above, as
written: "Indian Food Composition Tables 2017, T. Longvah, R. Ananthan, K. Bhaskarachary and K.
Venkaiah, National Institute of Nutrition, ICMR, Hyderabad."

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
  ("1 katori"). ADR-0006 asks for both, so they need another source or later work.
