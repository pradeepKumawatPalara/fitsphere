# ADR-0009: Packaged foods searchable by name and brand, from Open Food Facts' data

- Status: **Accepted** by the project owner on 2026-11-04 (D-48: "okay start with 1, push once
  done", after choosing between Open Food Facts' data, brands' own labels collected by hand, and
  GS1 India's DataKart)
- Date: 2026-11-04
- Decision owner: Project owner
- Related requirements: REQ-LOG-007, REQ-ACC-005, REQ-NFR-004
- Related constraints: C-005 (works without AI), C-008 (free first), D-04 (offline), D-09 (India),
  D-47 (Indian food data only), Q-049 (Legal, L-13)
- Amends: ADR-0006 rule 2 ("Barcode → Open Food Facts API"), which stays; this ADR adds a second use
  of Open Food Facts' data. ADR-0006 is otherwise unchanged.

## Context
Users search for packaged foods by brand and name ("Amul butter", "Britannia bread"), as in other
Indian food apps, not only by scanning a barcode. ADR-0006 used Open Food Facts for barcode lookups
only, one product at a time, kept in `barcode_products`. India has no public database of branded
foods. Copying another app's database is not an option: it is that company's property.

## Decision criteria
1. **Must:** the source's licence allows commercial use; the source of each value is recorded and
   credited.
2. **Must:** works with AI off (C-005, invariant #4) and, once downloaded, offline (D-04).
3. **Must:** Open Food Facts' data stays apart from FitSphere's own food list (ADR-0006 rule 2).
4. **Should:** free (C-008); thousands of products sold in India.

## Options considered
### Option A — Open Food Facts' data export, products sold in India
- Benefits: free; open licence (ODbL) allowing commercial use with attribution; 25,838 products
  list India (export of 2026-11-04), 9,764 with usable label values after the checks below; label
  values per 100 g and often the serving.
- Costs and risks: crowd-sourced, so coverage by brand is uneven (Amul 311, Haldiram's 139) and a
  value can be mistyped; ODbL's share-alike duty (Legal, L-13); the phone holds a copy.
- Evidence: the converter's counts, `docs/data/food-list-sources.md`.
### Option B — brands' own published labels, collected and approved by the owner
- Benefits: the most accurate. Costs: slow (dozens to hundreds of products); some websites' terms
  may limit reuse. Kept as the way to add missing popular brands later.
### Option C — GS1 India's DataKart (data supplied by the manufacturers)
- Benefits: official, at scale. Costs: needs an agreement with GS1 India, whose terms and cost are
  not known. Kept for before real users.

## Decision
Option A. Open Food Facts' data export is read by `npm run off:convert` into
`data/foods/off-india-products.csv`, loaded by `foods:import` into `app.packaged_foods`, a table of
its own, apart from `foods` and from `barcode_products`. A product is kept when its countries
include India, its barcode is a valid GS1 code for one product, it has a name, and its kcal (or kJ),
protein, carbohydrate and fat per 100 g are given, in range, and agree with each other (MVP
defaults, `apps/api/src/foods/offIndia.ts`). The phone downloads the products with the food list,
into its own table, and searches them offline by name and brand. A product is logged as a barcode
product, in grams or by its label's serving in grams. The app credits Open Food Facts with its
wording, behind Search foods' i. Barcode scans still ask Open Food Facts live (ADR-0006 rule 2).

## Why this option wins
It is the only free source with thousands of Indian packaged products under a licence that allows
commercial use, and it keeps Open Food Facts' data where ADR-0006 put it: in its own table.

## Why alternatives were rejected
B gives too few products to start with; C needs an agreement whose terms are not known.

## Counterfactual
A GS1 India agreement at an acceptable cost, or Legal finding the share-alike duty unacceptable for
a copy on the phone, would make C (or B) the better choice.

## Validation
- `foods:import` loads the committed file whole into PostgreSQL in the integration tests.
- Before real users: Legal answers L-13 for the bulk copy (Q-049); spot-check 20 popular products
  against their packs.
