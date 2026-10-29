# ADR-0006: Food data (search, barcode, nutrition values)

- Status: **Accepted** by the project owner on 2026-10-27 under the D-18 pre-approval. The check
  against the requirements, invariants, threat model, D-01 to D-18 and ADR-0001 to ADR-0003
  found only small inconsistencies, which the existing decisions already settled. They were
  fixed in the same change, before acceptance.
- Date: 2026-10-27
- Decision owner: Project owner
- Related requirements: REQ-LOG-007, LOG-009, NUT-002, REQ-HOME-006, REQ-ACC-005, NFR-004
- Related decisions: C-005 (works without AI), C-008 (free first), D-04 (offline), D-09 (India), D-18 (MVP)
- Builds on: ADR-0003 (PostgreSQL), ADR-0005 (AI uses these values)

## Context
FitSphere needs nutrition values (kcal, protein, carbs, fat, fiber) for two kinds of food:
1. **Home-cooked Indian foods** (roti, dal, rice, sabzi, paneer…), searched by name;
2. **Packaged products**, found by barcode.
Search must work without AI (C-005) and, for common foods, offline (D-04). Barcode
lookups may need internet (named warning, D-04). Budget: free.

## Decision criteria
1. **Must:** works with AI off (C-005, invariant #4).
2. **Must:** licences allow use in the app; the source of each value is recorded.
3. **Must:** free (C-008).
4. **Should:** common Indian foods searchable offline (D-04).
5. **Should:** replaceable — one food-data module in the Node API.

## Options considered
- **Open Food Facts** (packaged products, barcodes): free, open data under the Open
  Database License (ODbL); the API requires a custom User-Agent identifying the app and has
  rate limits. ODbL is "share-alike": a database built by combining its data must also be
  released as open data (checked 2026-10-27). Coverage of Indian products: unknown —
  measure.
- **Indian Food Composition Tables (IFCT 2017, National Institute of Nutrition):** the
  standard Indian reference for raw ingredients. Licence for reuse in an app: **not
  checked** — must be confirmed before copying values. *Decided by the owner under D-25
  (2026-10-29): FitSphere uses IFCT 2017 without NIN permission, accepted risk R-007.*
- **USDA FoodData Central:** US government data; good for raw ingredients, weak on Indian
  dishes. Licence not checked here.
- **Paid commercial food APIs:** not considered for MVP (cost).

## Decision
FitSphere's own food list plus Open Food Facts for barcodes, with the rules under "Recommended
option". Accepted by the project owner on 2026-10-27 under the D-18 pre-approval. This answers
Q-039 and, with ADR-0005, Q-063.

Accepted while these were still open: the licence of the food-list source (blocks release, not
development) and the ODbL share-alike question (Legal, Q-049). "Open questions and handling"
below says how each is handled. *The food-list licence question was decided by the owner under
D-25 (2026-10-29): IFCT 2017 is used without NIN permission, as accepted risk R-007, and is no
longer a release blocker. This ADR's decision is unchanged.*

## Recommended option
1. **FitSphere food list (own table)** for common foods — start with about 150–200 common
   Indian foods and ingredients, values per 100 g plus common portions (e.g. "1 roti",
   "1 katori dal"). Values come only from a source whose licence allows it (IFCT if
   permitted, otherwise USDA or other permitted sources); record the source per item.
   This list is small and is **cached on the phone** for offline search.
2. **Barcode → Open Food Facts API**, called from the Node API with FitSphere's
   User-Agent. Only the barcode number is sent — nothing that identifies the user. Products
   found are stored in a **separate table**, with attribution, and are not merged into
   FitSphere's own food list (keeps the ODbL share-alike duty limited to that table — Legal
   to confirm, Q-049).
3. **Not found** → the user types the values from the label, which works with AI off
   (C-005), or photographs the label for AI reading if they consented (ADR-0005). Values
   typed by hand are saved with that meal only, not added to the shared food list (MVP
   default).
4. AI results (ADR-0005) are matched to the food list first; unmatched items keep the AI
   estimate, marked "estimated".
5. One food-data module in the Node API, so sources can be added later.
6. **No health-platform sync in the MVP** (MVP default, Q-015): steps and sleep are typed in,
   sleep in hours with one decimal (Q-028 default). A later integration needs its own ADR
   (backlog B-14).

## Why this option
Free, works offline for the foods Indians log most, keeps licences clean, and doesn't
depend on AI.

## Why alternatives were rejected
Open Food Facts alone covers packaged products, not home-cooked food. USDA alone is weak on
Indian dishes. Paid food APIs cost money the MVP does not have (C-008).

## Counterfactual
A paid food API would win if barcode hit rates for Indian packs stay too low and the budget
allows it. A larger Indian dataset would replace the hand-built list if one becomes available
on terms that allow use in the app.

## Consequences
- The owner must build and check the initial food list (time, not money). Claude Code can
  draft it from a permitted source; the owner reviews.
- Barcode hit rate for Indian packs may be low at first; manual entry covers gaps.

## Validation plan
1. Scan 20 Indian packaged products: record how many Open Food Facts finds.
2. Search 20 common foods offline from the cached list.
3. Confirm the licence of the chosen source for the food list before release.
4. With AI off, a barcode that is not found can be logged by typing the label values.

Record each result, with its date, under "Validation results".

## Validation results
- **Rule 1, the food list — built (Meal logging slice, D-25, D-26):** IFCT 2017, 542 foods,
  imported by a tested `npm run foods:import`, cached on the phone and searched offline
  ([`food-list-sources.md`](../../data/food-list-sources.md)). Dishes (rule 1's common portions)
  wait for the owner's source document (slice plan, step 8).
- **Rule 2, Open Food Facts — behaviour checked live on 2026-10-29:** API v3 answers a found
  product with HTTP 200 and `status: "success"`, and an unknown barcode with HTTP 404. FitSphere
  sends the barcode only, with its User-Agent, and keeps every answer in `barcode_products`.
  Open Food Facts limits product reads to 15 a minute per IP address (risk R-008).
- **Validation 4 — passed in automated tests:** a barcode that is not found, or found without kcal
  or protein, leads to "Enter your own food", which works with AI off
  (`apps/mobile/src/screens/barcode.test.tsx`). The phone check is batched with the slice's.
- **Validations 1 and 2:** phone checks at the end of the Meal logging slice, after the EAS build;
  not run yet.

## Revisit conditions
Barcode hit rate too low for users; food list needs grow beyond manual upkeep; a licence
problem appears.

## Open questions and handling
| Question | Handling |
|---|---|
| Q-039 data sources | Answered by this ADR |
| Q-063 where nutrition values come from | Answered with ADR-0005: food list first, else the AI's estimate, marked |
| Q-015 steps and sleep input | MVP default (D-18): typed in; health-platform sync is post-MVP |
| IFCT / USDA licence | IFCT: decided by the owner under D-25 (2026-10-29): used without NIN permission, accepted risk R-007; not a release blocker. See [`food-list-sources.md`](../../data/food-list-sources.md). USDA: not used |
| Q-049 ODbL share-alike | Legal to confirm before release |

## References (checked 2026-10-27)
- Open Food Facts API conditions: https://support.openfoodfacts.org/help/en-gb/12-api-data-reuse/94-are-there-conditions-to-use-the-api
- Open Food Facts licence: https://wiki.openfoodfacts.org/ODBL_License
