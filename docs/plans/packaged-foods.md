# Packaged foods plan

- Status: **Accepted** (the owner, in chat, 2026-11-04: "okay start with 1, push once done")
- Owner: Project owner (D-01)
- Last updated: 2026-11-04
- Builds on: D-48; [ADR-0009](../architecture/decisions/ADR-0009-packaged-food-search.md), which
  amends ADR-0006 rule 2; D-45 (a food's page); D-47 (Indian food data only)
- Requirements: REQ-LOG-007, REQ-ACC-005

## What the owner asked
"Create a database for Indian food items like HealthifyMe: the user can search a brand name, for
example a bread, Amul, and see its nutrition values as per published official sources, with the
maximum possible items people in India use." Copying another app's database was ruled out; the owner
chose Open Food Facts' data first (option 1), with brands' own labels (option 2) and GS1 India's
DataKart (option 3) for later.

## Scope
1. **Data:** Open Food Facts' full export (`en.openfoodfacts.org.products.csv.gz`, kept outside the
   repository) → `npm run off:convert` → `data/foods/off-india-products.csv`: products sold in India
   with valid barcodes, names and consistent label values per 100 g, and the serving when given in
   grams. Export of 2026-11-04: 9,764 products, 6,263 with a serving.
2. **Server:** migration `0014_packaged_foods.sql` (`app.packaged_foods`, row level security on, no
   policies); `foods:import` replaces it whole; `GET /v1/foods` carries the products in `packaged`,
   apart from `items`, and its version covers them; the sync check accepts a barcode product's
   "Serving" only with the grams on the list.
3. **Phone:** schema version 11 (`packaged_foods`), filled with the food list; Search foods lists
   them after My foods, matched by name or brand, tagged "Packaged" with the brand; a product's page
   offers Grams and "Serving (N g)"; it is logged as a barcode product; Open Food Facts is credited
   behind the i.

## Not in scope
- Product photos; ingredients; allergens; nutrients beyond the five FitSphere keeps.
- Brands' own labels (option 2) and GS1 India (option 3).
- Refreshing the export on a schedule: run `off:convert` and `foods:import` again when wanted.

## Risks
- Crowd-sourced values: a product can be wrong or out of date. Checks drop missing, out-of-range and
  inconsistent values; the rest is shown as Open Food Facts gives it.
- ODbL's share-alike duty for the copy on the server and the phones (Legal, L-13).
- Size: about 0.6 MB as CSV; the food-list download grows by roughly 1.5 MB of JSON when it changes.

## Owner's steps
- After the pull requests merge: `npm run migrate -w @fitsphere/api` (0012 to 0014), then
  `npm run foods:import -w @fitsphere/api`, then reload the app.
