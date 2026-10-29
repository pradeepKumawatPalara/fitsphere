# Meal logging (no AI) slice plan

- Status: **Accepted**, approved by the project owner on 2026-10-29 (D-26)
- Owner: Project owner (D-01)
- Last updated: 2026-10-29
- Builds on: [`mvp-scope.md`](../product/mvp-scope.md) section 5, slice 3 (D-18, D-20); the
  [Home and daily tracking slice](home-daily-tracking-slice.md); ADR-0002, ADR-0003, ADR-0006,
  ADR-0007; [`food-list-sources.md`](../data/food-list-sources.md) (D-25)

This is the third MVP slice, for the Personal Training User only (D-20). It builds meal logging
without AI:
- Nutrition (Consumed, the Diet plan empty state, Saved);
- Log meal (date, meal type and tags, food search from the IFCT 2017 list, barcode through Open
  Food Facts, your own food, review before saving);
- meal photos and public image links;
- real calories and protein on Home.

Where the contracts define something, this plan does not repeat it.

## Progress
| Step | Status | Branch |
|---|---|---|
| 1. Food list on the server | Pull request #20, CI green | `meals/01-food-list` |
| 2. Meals and saved meals on the server | Pull request #21, CI green | `meals/02-server-meals` |
| 3. Phone data | Pull request #22, CI green | `meals/03-phone-meals` |
| 4. Nutrition and Home | Pull request #24, CI green | `meals/04-nutrition` |
| 5. Log meal | Pull request #26, CI green | `meals/05-log-meal` |
| 6. Barcode | Pull request #29, CI green | `meals/06-barcode` |
| 7a. Meal photos and public links on the server | Pull request #30, CI green | `meals/07-photos-server` |
| 7b. Meal photos and public links on the phone | Pull request #31, CI green | `meals/07b-photos-app` |
| 8. Dishes (cited raw portions) | **Waiting for the owner:** the source document could not be read from here (see step 8) | `meals/08-dishes` |
| 9. Close-out | Pull request #32 | `meals/09-close-out` |

The slice's pull requests build on pull request #18 (D-24), which must be merged first.

## Scope
| In this slice | Requirements |
|---|---|
| "+" on Home and Nutrition | REQ-NAV-003 |
| Nutrition: date strip and tabs; Consumed (Eaten summary, meal slots, ••• menu); Diet plan empty state; Saved | REQ-NUT-001…004, REQ-PLAN-007, REQ-SAVED-001, REQ-SAVED-002 |
| Log meal: screen, date chip and day sheet, meal type and tags, search, barcode, saved meals, tips, review | REQ-LOG-001…003, REQ-LOG-007, REQ-LOG-008, REQ-ACC-005 |
| Meal photo upload and storage (not AI reading); public image link with the warning (D-26) | REQ-LOG-006 (meal photos only), REQ-LOG-010, REQ-NFR-006 |
| Home: real calories and protein; the week strip's status box; "By meal" | REQ-HOME-002…005 |
| Offline logging and sync of meals and saved meals | REQ-NFR-004, REQ-NFR-001 (self-access) |

Not in this slice: label photos and all AI reading (slice 7). The free-text, voice and photo-reading
box shows "AI meal reading is coming soon" until then (D-26).

## Decisions (D-26)
1. **Meal photos and public links move into this slice** from slice 7, at the owner's
   instruction. Label photos and AI reading stay in slice 7.
2. **Cooked dishes: cited raw portions.**
   - A dish such as "1 roti" is defined only by IFCT raw ingredients and grams quoted word for
     word, with the page, from a document the owner approves.
   - Its values are IFCT's values per 100 g × the raw grams, marked "estimated".
   - It is logged by portion count only. There are no per-100 g cooked values, since those would
     need yield factors.
3. **Oils and fats: 9 kcal per g of fat**, marked "estimated". This is the Atwater general factor
   in FAO Food and Nutrition Paper 77, quoted in `food-list-sources.md`.
4. **New packages:**
   - in the app: `expo-camera`, `expo-image-picker`, `expo-image-manipulator` and
     `expo-file-system`;
   - in the API: `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` (ADR-0002 rule 4).
5. **One EAS development build** covers the new native packages. Claude Code asks the owner before
   starting it (D-19).
6. **Workflow as D-21:** steps run back to back, one branch and pull request each, with CI green
   before merge. The owner's actions and the phone checks are batched at the end.

MVP defaults chosen under D-18 answer 3 are recorded in
[`constraints-and-assumptions.md`](../architecture/constraints-and-assumptions.md#mvp-defaults-d-18)
in the step that builds each one.

## Steps
1. **Food list on the server.**
   - Migration 0003 (`foods`, `barcode_products`) and `npm run foods:import`.
   - The import adds the oils' estimated kcal, hides the three rows whose kcal disagrees with
     their macronutrients until they are checked, and adds spelling aliases.
   - `GET /v1/foods`, and the IFCT acknowledgement as a shared constant.
2. **Meals and saved meals on the server.**
   - Migration 0004.
   - `meal.set`, `meal.delete`, `savedMeal.set` and `savedMeal.delete`.
   - Totals computed on the server; the pull lists.
3. **Phone data.**
   - Local schema v3.
   - The food list cached on the phone and refreshed when its version changes.
   - The store and the sync client for meals and saved meals; day totals.
4. **Nutrition and Home.**
   - Consumed, Diet plan and Saved; the ••• menu.
   - Real Home totals, the week strip's status box and "By meal".
   - "+" on Home and Nutrition.
5. **Log meal.**
   - The date chip and day sheet; meal type and tags.
   - The AI-coming-soon box and the tips.
   - Offline food search; your own food.
   - Review before saving; Edit.
6. **Barcode.**
   - The Open Food Facts lookup through the API, cached in its own table, with attribution.
   - The camera scanner and the "needs internet" warning.
7. **Meal photos and public links.**
   - S3 presigned links (ADR-0002 rules 3 and 4).
   - On the phone, a compressed copy of about 200 KB and a thumbnail, cached in the encrypted
     database.
   - The public link with its warning.
8. **Dishes (cited raw portions).** Merging this pull request is the owner's OK on each quoted
   source.
   - **2026-10-29: waiting for the owner.** NIN's *Dietary Guidelines for Indians* (2024) could
     not be read from here: the NIN link
     (`nin.res.in/dietaryguidelines/pdfjs/locale/DGI24thJune2024fin.pdf`) answered HTTP 404, and
     the ICMR copy's host did not resolve. Copies on other sites are not used, since D-26 asks for
     a document the owner approves. The owner provides the PDF (or another document to use); the
     step then quotes each dish's raw ingredients and grams with the page.
9. **Close-out.** Documents, ADR results and the batched owner checks.

## Owner's actions and checks at the end of the slice
1. Merge #18, then #20, #21, #22, #24, #26, #29, #30, #31 and #32, in order, each with green
   CI.
2. Supabase, from `D:\fitsphere` on `main` after the merges:
   - `npm run migrate -w @fitsphere/api` (applies 0002 to 0005), then
     `npm run foods:import -w @fitsphere/api`;
   - the meal-photo bucket, S3 connection and access key (runbook, step 5 item 9), then
     `npm run check:storage -w @fitsphere/api`: every line should say PASS.
3. `OFF_CONTACT` in `apps/api/.env`: a contact address for Open Food Facts' User-Agent.
4. An OK to start the EAS development build (the 3rd of this month's 15). It carries
   `expo-camera`, `expo-image-picker`, `expo-image-manipulator` and `expo-file-system`.
5. The source document for the dishes (step 8), then review of the quoted sources.
6. The phone checks below.

## Phone checks (batched)
On the new development build, with `npm run dev:phone`; synthetic values only. Record each result
with its date here, and in the ADR it validates.
1. **Food list offline** (ADR-0006 validation 2): after one sync, turn on aeroplane mode and
   search 20 common foods (e.g. atta, rice, dal, paneer, ghee); each is found, with the IFCT
   acknowledgement under the results.
2. **Logging:** log a meal by search with grams; Edit it, Save it to my meals, re-log it from
   Saved, then Delete one. Home's calories and protein, the week strip's box and "By meal" follow.
3. **Barcodes** (ADR-0006 validation 1, ADR-0001 check 2): scan 20 Indian packaged foods; record
   how many Open Food Facts finds. Log one found product in grams, and one not found as your own
   food (ADR-0006 validation 4). Also type one barcode by hand.
4. **Offline logging** (ADR-0007 step 1, meals): in aeroplane mode, log a meal by search; Home
   shows it; reconnect; it syncs and shows on the Supabase table `app.meals`.
5. **Meal photo** (ADR-0002 step 5, ADR-0001 check 3): take a photo for a meal and save it. In
   Supabase Storage, the bucket holds `meals/<user>/<photo>.jpg` of about 200 KB and a
   `-thumb.jpg`; download the photo on the PC and check that its properties show no GPS location.
   The thumbnail shows on Nutrition and opens the photo. Remove the photo (or delete the meal):
   after the next sync the files are gone from the bucket.
6. **Public link:** add an https image link; the warning shows; Cancel saves nothing; Add link
   saves it; tapping it opens the browser.
7. **Storage with the Data API off** (ADR-0002 step 2): `npm run check:storage` above passed; it
   also checks that an expired viewing link stops working.
