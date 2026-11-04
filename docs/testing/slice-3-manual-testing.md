# Slice 3, Meal logging (no AI): manual test guide

- Status: **Ready to run.** No result is recorded yet; only the tester marks Pass or Fail.
- Prepared: 2026-10-30, from `main` at `c24546b` (slices 3 and 4 merged), by reading the app's code
  and tests. Every text in quotes below is copied from the code.
- Plan: [`meal-logging-slice.md`](../plans/meal-logging-slice.md), "Phone checks" 1 to 6 and 8 (D-26,
  D-28). Check 7 (`check:storage`) already passed on the PC on 2026-10-29.
- Companion guide: [`slice-4-manual-testing.md`](slice-4-manual-testing.md) (Training).

## How to use this guide
- Run the tests **in the order written**. Later tests use meals that earlier tests create, and the
  expected totals depend on it.
- Each test says where to start, what to tap, what to type and what you should see. Tick **Pass**
  only if every "You should see" line and the final expected result match. Otherwise tick **Fail**
  and write what you saw (a screenshot helps).
- **Synthetic data only** (invariant #7). The foods and amounts below are test values, not your
  own meals. Don't photograph people, documents or anything personal.
- **Android shows button labels in capitals.** A button written here as **Save meal** appears on
  the phone as SAVE MEAL. Round "+" buttons, chips and tabs keep their normal case.
- "Today", "yesterday", "2 days ago" and "3 days ago" are IST days. Examples use Fri 30 Oct 2026;
  your dates will differ. **Run the whole guide within one IST day**, away from midnight, because
  "today" moves at 00:00 IST.
- The common header at the top of Home, Nutrition, Training and Progress shows "Hi, <name>" and the
  selected date ("Today · Fri 30 Oct", or just "Thu 29 Oct" for a past day). Its **📅** button
  opens the calendar; the round letter next to it opens Account.
- Running these tests writes synthetic meals and saved meals for your test account to
  `fitsphere-dev`, and barcode lookups add products to its shared product cache. The cleanup at the
  end deletes the meals. A deleted meal leaves an empty "deleted" row on the server by design, so
  other phones learn of the deletion.

## What is covered

| Area | Status | Tests |
|---|---|---|
| Nutrition tab: date strip, Consumed / Diet plan / Saved, ••• menu | Implemented | S3-01, S3-02, S3-26 |
| Meal slots: Breakfast, Lunch, Snack, Dinner (the app says "Snack", not "Snacks") | Implemented | S3-08, S3-10, S3-12, S3-17 |
| Food search on the phone (IFCT 2017 list, 542 foods; 3 hidden, 14 with estimated kcal) | Implemented | S3-04, S3-05, S3-24 |
| One food in grams (1 to 2,000 whole grams) | Implemented | S3-07, S3-08 |
| Change grams or remove a food in the review | Implemented | S3-10, S3-11 |
| Add, edit and delete meals | Implemented | S3-08, S3-11, S3-26 |
| Your own food (label values per 100 g) | Implemented | S3-12, S3-22 |
| Saved meals: save, add in Log meal, re-log, delete | Implemented | S3-14 to S3-16, S3-27 |
| Date chip, past days, future days blocked, 90-day window | Implemented | S3-16 to S3-18 |
| Calories and protein on Home; week strip status boxes; "By meal" | Implemented | S3-09, S3-13 |
| Meal photo, thumbnail, viewer; public image link with warning | Implemented | S3-19, S3-20 |
| Barcode (camera or typed) through Open Food Facts | Implemented | S3-21 to S3-23 |
| Offline search, offline logging and sync | Implemented | S3-24, S3-25 |
| Meals come back from the server after log out and sign in | Implemented | S3-28 |
| **Dishes in portions (stepper 0.5 to 10)** | **Built, but blocked by data:** 0 of 25 recipes approved (24 `pending`, chicken curry `blocked`) | S3-06 (dishes stay hidden; runnable), S3-29 (**Blocked**) |
| AI meal reading (typed, voice, photo reading) | Not implemented (slice 7); the screen says it is coming soon | S3-03 |
| Diet plan from a coach | Not implemented (post-MVP, D-20); empty state only | S3-02 |
| Label photos, per-100 g or cooked-weight logging of dishes | Not implemented (D-26, D-28) | — |

Not testable by hand (covered by the automated tests): a change the server refuses ("This meal
wasn't saved: <reason>. Edit or discard it."), a meal deleted on another phone ("This meal is no
longer on this phone."), the 30-food limit per meal, and a past meal keeping its values after the
food list changes. The app never asks for raw ingredient weights: a dish is chosen by portions
only, and grams are asked only for a listed food, a barcode product or your own food.

## Prerequisites (do these once, before S3-01)

| # | What | How to confirm |
|---|---|---|
| P-01 | `D:\fitsphere` is on `main` at `c24546b` or later | `git log -1 --oneline` |
| P-02 | **Owner action.** With `dev:phone` stopped, apply migrations 0006 and 0007 to `fitsphere-dev` and import the food list: `npm run migrate -w @fitsphere/api`, then `npm run foods:import -w @fitsphere/api` | Migrate prints `Applied: 0006_dishes.sql, 0007_workouts.sql` (or `Nothing to apply.` if done before). Import prints `Imported 542 foods: 3 hidden until checked, 14 with estimated kcal.` and `Imported 0 approved dishes. Not imported: 24 pending, 1 blocked (chicken_curry).` Until the migrations run, the food list never reaches the phone and every sync fails |
| P-03 | The EAS development build from 2026-10-29 (`f4d528c8`, with the camera and photo modules) is installed on the phone | The app opens without "Cannot find native module 'ExpoCamera'" |
| P-04 | Start everything: `npm run dev:phone` from `D:\fitsphere`; open the FitSphere development build on the phone and connect to the server shown (QR code) | The app loads. If it stays on "Reloading…", force-stop the app (Android Settings › Apps › FitSphere › Force stop) and open it again |
| P-05 | Sign in with your **test** account (synthetic data only) | Home opens; the header shows "Hi, <name>" and "Today · <date>" |
| P-06 | Tap the round letter (top right) › Account. Scroll to **Development** | "Sync: synced" and "API: ok". Don't share a screenshot of this screen: it shows the tunnel's address |
| P-07 | On Account, tap **Your targets**. Set **Daily calories** 2000, **Daily protein** 100 and **Weekly workouts** 4 (tap the row, type, **Save**) | The rows show "2,000 kcal", "100 g" and "4 workouts", each "Set by you". With other targets, recalculate the Home percentages; with no target, Home shows "<n> kcal eaten" and **Set a target** instead |
| P-08 | Clean start: for today, yesterday, 2 days ago and 3 days ago, Nutrition › Consumed shows "Eaten –" and every slot says "Tap to add what you ate"; Saved shows its empty text | If any meal is left from earlier testing, delete it (••• › **Delete** › **Delete**), or write down its kcal and protein and add them to every expected total below |

## Test data

| Used in | Food as listed | Search words | Per 100 g on the phone | Amount | Values for the amount |
|---|---|---|---|---|---|
| S3-08, S3-11 | Egg, poultry, whole, boiled (IFCT M004) | `boiled egg` | 148 kcal, 13.4 g protein | 50 g, then 100 g | 74 kcal · 6.7 g; then 148 kcal · 13.4 g |
| S3-08 | Milk, whole, Cow | `milk cow` | 73 kcal, 3.3 g | 200 g | 146 kcal · 6.5 g |
| S3-10 | Rice, raw, milled | `rice raw milled` | 356 kcal, 7.9 g | 80 g, then 60 g | 285 kcal · 6.4 g; then 214 kcal · 4.8 g |
| S3-10 | Red gram, dal (toor dal) | `red gram dal` | 331 kcal, 21.7 g | 40 g | 132 kcal · 8.7 g |
| S3-10 | Paneer (added, then removed) | `paneer` | 258 kcal, 18.9 g | 100 g | 258 kcal · 18.9 g |
| S3-12 | Your own food "Test snack bar" | — | typed: 400 kcal, 20 g protein, 45 g carbs, 15 g fat, fibre empty | 50 g | 200 kcal · 10.0 g |
| S3-17 | Wheat flour, atta | `atta` | 320 kcal, 10.6 g | 60 g | 192 kcal · 6.3 g |
| S3-17 | Ghee (kcal estimated) | `ghee` | 900 kcal (estimated), 0.0 g | 5 g | 45 kcal · 0.0 g, estimated |
| S3-25 | Banana, ripe, robusta | `banana robusta` | 105 kcal, 1.2 g | 120 g | 126 kcal · 1.5 g |
| S3-21 to S3-23 | Packaged foods you have at home (Indian brands) | barcode | from Open Food Facts | 30 g | kcal per 100 g × 0.3 |

Saved meal name: `Test breakfast`. Image link: `https://example.com/meal.jpg` (a reserved
documentation address).

### Expected totals for today
With the targets from P-07 (2,000 kcal, 100 g). Nutrition shows one decimal; Home rounds to whole
numbers.

| After | Today's meals | Nutrition › Eaten (kcal · Protein · Carbs · Fat · Fibre) | Home › Calories | Home › Protein |
|---|---|---|---|---|
| S3-08 | Breakfast | 220 kcal · 13.2 g · 9.9 g · 14.2 g · 0.0 g | 220 of 2,000 kcal · 11% · 1,780 kcal remaining | 13 of 100 g · 13% · 87 g remaining |
| S3-10 | + Lunch | 566 kcal · 26.7 g · 78.9 g · 15.2 g · 5.3 g | 566 of 2,000 kcal · 28% · 1,434 kcal remaining | 27 of 100 g · 27% · 73 g remaining |
| S3-11 | Breakfast edited | 640 kcal · 33.4 g · 78.9 g · 20.4 g · 5.3 g | 640 of 2,000 kcal · 32% · 1,360 kcal remaining | 33 of 100 g · 33% · 67 g remaining |
| S3-12 | + Snack (own food) | 840 kcal · 43.4 g · 101.4 g · 27.9 g · 5.3 g | 840 of 2,000 kcal · 42% · 1,160 kcal remaining | 43 of 100 g · 43% · 57 g remaining |
| S3-25 | + Snack (banana, offline) | 966 kcal · 44.9 g · 129.8 g · 28.3 g · 7.6 g | 966 of 2,000 kcal · 48% · 1,034 kcal remaining | 45 of 100 g · 45% · 55 g remaining |
| S3-26 | Banana deleted | back to the S3-12 row | back to the S3-12 row | back to the S3-12 row |

Other days: **yesterday** (S3-16) 294 kcal · 20.0 g protein; **2 days ago** (S3-17) 237 kcal ·
6.3 g protein; **3 days ago** (S3-21, S3-22) depends on the products scanned.

---

## Part A: Nutrition screens and the food list

### S3-01 · Nutrition tab: tabs and an empty day
**Screen:** Nutrition › Consumed · **Covers:** REQ-NUT-001, REQ-NUT-002, REQ-NUT-003 · **Start:** Home, today selected · **Data:** none

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | Bottom bar: **Nutrition** | — | The week strip (‹, Mon to Sun, ›). Today's box is filled blue. Under each day is a small square status box, all empty |
| 2 | Look below the strip | — | Three tabs: "Consumed" (filled blue, chosen), "Diet plan", "Saved". No "Showing …" banner |
| 3 | Look at the Eaten card | — | "Eaten" and "–"; under it "Protein –", "Carbs –", "Fat –", "Fibre –" |
| 4 | Scroll down | — | Four slots in this order: "Breakfast", "Lunch", "Snack", "Dinner". Each has a round blue "+" on the right and "Tap to add what you ate" |
| 5 | Look at the bottom right | — | A floating round blue "+" button |

**Final expected result:** Nutrition opens on Consumed with an empty day: every value is "–" and
all four slots invite a meal.

**Result**
- [ ] Pass
- [ ] Fail
- Actual result / notes:

### S3-02 · Diet plan and Saved: empty states
**Screen:** Nutrition › Diet plan, Saved · **Covers:** REQ-PLAN-007, REQ-SAVED-002 · **Start:** Nutrition (from S3-01) · **Data:** none

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | Tap the **Diet plan** tab | — | "No diet plan yet. Your coach will add one here." Nothing else (no plan can be added in the MVP) |
| 2 | Tap the **Saved** tab | — | "No saved meals yet. In Consumed, open a meal's ••• menu and choose "Save to my meals"." |
| 3 | Tap the **Consumed** tab | — | The empty day from S3-01 again |

**Final expected result:** both empty states show their exact texts.

**Result**
- [ ] Pass
- [ ] Fail
- Actual result / notes:

### S3-03 · Log meal: the screen, and leaving without saving
**Screen:** Home "+" → Log meal · **Covers:** REQ-NAV-003, REQ-LOG-001, REQ-LOG-003, REQ-LOG-004 (AI box only), REQ-LOG-008 · **Start:** Home, today selected · **Data:** none

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | Bottom bar: **Home**. Tap the floating round **+** (bottom right) | — | A screen titled "Log meal" with a back arrow |
| 2 | Look at the top | — | A blue chip "Today, Fri 30 Oct ▾" (your date) |
| 3 | Look under "Meal" | — | Chips "Breakfast", "Lunch", "Snack", "Dinner", **none** chosen; then "Before training" and "Dessert", none chosen |
| 4 | Look at the dashed box | — | "AI meal reading is coming soon" and "For now, add foods by search, barcode, your own food or a saved meal." |
| 5 | Look under "Add food" | — | Buttons **Search foods**, **Scan barcode**, **Enter your own food**, **Saved meals**; then "Tips: give amounts in grams; say whether a food is raw or cooked; add each food separately." |
| 6 | Look under "Photo (optional)" | — | Buttons **Take photo**, **Choose from gallery**, **Add an image link instead** |
| 7 | Look under "Review" | — | "No foods yet." and a greyed-out **Save meal** button that does nothing when tapped |
| 8 | Tap the back arrow (or Android Back) | — | Home again, with no question asked; nothing was saved (Calories still shows 0) |

**Final expected result:** Log meal opens on today with no meal type, shows the AI-coming-soon box
and the tips, and cannot save an empty meal.

**Result**
- [ ] Pass
- [ ] Fail
- Actual result / notes:

### S3-04 · Food search: the list on the phone, no results, acknowledgement
**Screen:** Log meal › Search foods · **Covers:** REQ-LOG-007, REQ-ACC-005, ADR-0006 rule 1, D-25 · **Start:** Home, today selected · **Data:** `atta`, `xyzfood`, `toor`, `red gram dal`

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | Home › floating **+** › **Search foods** | — | A sheet titled "Search foods", a box with the grey hint "e.g. atta, dal, paneer", the keyboard open, and "Food values: Longvah, T., Ananthan, R., Bhaskarachary, K. and Venkaiah, K. (2017). Indian Food Composition Tables 2017, …" in small text under the list |
| 2 | Type in the search box | `atta` | One row: "Wheat flour, atta" with "320 kcal per 100 g" |
| 3 | Clear the box and type | `xyzfood` | "No foods found. Try another word, or enter your own food." |
| 4 | Clear and type | `toor` | "No foods found. …" (the list uses IFCT names: toor dal is "Red gram, dal") |
| 5 | Clear and type | `red gram dal` | One row: "Red gram, dal" with "331 kcal per 100 g" |
| 6 | Tap **Close**, then the back arrow | — | Home; nothing saved |

**Final expected result:** search answers from the list on the phone, says when nothing matches,
and always shows the IFCT acknowledgement. If step 1 shows "Downloading the food list needs an
internet connection." while the phone is online, the list never downloaded: see Troubleshooting.

**Result**
- [ ] Pass
- [ ] Fail
- Actual result / notes:

### S3-05 · Food list rules: estimated kcal, hidden rows, spelling aliases
**Screen:** Log meal › Search foods · **Covers:** D-26 decisions 3 and plan step 1 (estimated oils, hidden rows, aliases) · **Start:** Home, today selected · **Data:** `ghee`, `chicken`, `crab`, `omelette`, `quail`

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | Home › **+** › **Search foods**; type | `ghee` | "Ghee" with "900 kcal per 100 g · estimated" |
| 2 | Tap **Ghee** | — | "Per 100 g: 900 kcal (estimated) · 0.0 g protein". Tap **Back to search** |
| 3 | Clear and type | `chicken` | Six rows: "Chicken mushroom, fresh", "Chicken, poultry, breast, skinless", "Chicken, poultry, thigh, skinless", "Chicken, poultry, wing, skinless", "Poultry, chicken, gizzard", "Poultry, chicken, liver". **No** "Chicken, poultry, leg, skinless" (hidden until checked) |
| 4 | Clear and type | `crab` | Two rows: "Crab, sea" and "Mud crab". **No** row named just "Crab" (two are hidden until checked) |
| 5 | Clear and type | `omelette` | Three rows, found by their corrected spelling: "Egg, country hen, omlet", "Egg, duck, whole, omlet", "Egg, poultry, omlet" |
| 6 | Clear and type | `quail` | "Egg, quial, whole, boiled" and "Egg, quial, whole, raw" |
| 7 | **Close**, back arrow | — | Home; nothing saved |

**Final expected result:** oils and fats show estimated kcal; the three rows whose kcal disagrees
with their macronutrients don't appear; misspelt IFCT names are found by the correct spelling.

**Result**
- [ ] Pass
- [ ] Fail
- Actual result / notes:

### S3-06 · Dishes are not offered while no recipe is approved
**Screen:** Log meal › Search foods · **Covers:** D-28 ("a pending or blocked dish is not found"), plan phone check 8 (last sentence) · **Start:** Home, today selected · **Data:** `roti`, `idli`, `plain dosa`, `chicken curry`, `boiled egg`

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | Home › **+** › **Search foods**; type | `roti` | "No foods found. Try another word, or enter your own food." |
| 2 | Clear and type, one at a time | `idli`, then `plain dosa`, then `chicken curry` | "No foods found. …" each time |
| 3 | Clear and type | `boiled egg` | Six IFCT foods, each "… kcal per 100 g". **No** row whose second line starts "Dish ·" |
| 4 | Tap **Egg, poultry, whole, boiled** | — | A **Grams eaten** box (an IFCT food, in grams). No portion stepper, and no field asking for ingredient weights |
| 5 | **Back to search**, **Close**, back arrow | — | Home; nothing saved |

**Final expected result:** no dish row appears for any of the 25 recipe-sheet dishes, since none is
approved (24 pending, chicken curry blocked).

**Result**
- [ ] Pass
- [ ] Fail
- Actual result / notes:

### S3-07 · Grams field: what can and cannot be added
**Screen:** Log meal › Search foods › a food · **Covers:** REQ-LOG-007 (MVP default: whole grams 1 to 2,000) · **Start:** Home, today selected · **Data:** `boiled egg`; amounts below

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | Home › **+** › **Search foods**; type `boiled egg`; tap **Egg, poultry, whole, boiled** (148 kcal per 100 g) | — | Title "Egg, poultry, whole, boiled"; "Per 100 g: 148 kcal · 13.4 g protein"; **Grams eaten** already holds `100`; "= 148 kcal · 13.4 g protein"; **Add** enabled |
| 2 | Clear the Grams eaten box | (empty) | Red "Enter whole grams from 1 to 2,000." and **Add** greyed out |
| 3 | Type | `0` | The same red text; **Add** greyed out |
| 4 | Clear, type | `2001` | The same red text; **Add** greyed out |
| 5 | Clear, type | `2000` | "= 2,960 kcal · 268.6 g protein"; **Add** enabled |
| 6 | Clear, type | `50` | "= 74 kcal · 6.7 g protein" |
| 7 | **Back to search**, **Close**, back arrow | — | Home; nothing saved |

**Final expected result:** only whole grams from 1 to 2,000 can be added; the preview follows the
grams.

**Result**
- [ ] Pass
- [ ] Fail
- Actual result / notes:

---

## Part B: Logging, editing and totals (today)

### S3-08 · Log a breakfast by search, in grams
**Screen:** Nutrition › Breakfast "+" → Log meal › Search foods · **Covers:** REQ-NUT-003, REQ-LOG-007, REQ-LOG-003, REQ-NUT-002, REQ-HOME-002 · **Start:** Home, today selected · **Data:** Egg, poultry, whole, boiled 50 g; Milk, whole, Cow 200 g; Breakfast

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | Bottom bar: **Nutrition**; in the **Breakfast** slot tap its round **+** | — | Log meal with "Today, <date> ▾" and the **Breakfast** chip already chosen (filled blue) |
| 2 | **Search foods**; type | `boiled egg` | Six rows; one is "Egg, poultry, whole, boiled" · "148 kcal per 100 g" |
| 3 | Tap **Egg, poultry, whole, boiled**; clear Grams eaten and type | `50` | "= 74 kcal · 6.7 g protein" |
| 4 | Tap **Add** | — | The sheet closes. Review: "Egg, poultry, whole, boiled" and "50 g · 74 kcal · 6.7 g protein", with "•••" on the right; "Total: 74 kcal · 6.7 g protein" |
| 5 | **Search foods**; type `milk cow`; tap **Milk, whole, Cow** (73 kcal per 100 g); clear Grams eaten and type | `200` | "= 146 kcal · 6.5 g protein" |
| 6 | Tap **Add** | — | Review has two foods; second line "200 g · 146 kcal · 6.5 g protein"; "Total: 220 kcal · 13.2 g protein" |
| 7 | Tap **Save meal** | — | Back on Nutrition › Consumed |
| 8 | Look at the Breakfast slot | — | One card: "Egg, poultry, whole, boiled + 1 more" and "220 kcal · 13.2 g protein", with "•••". If "Waiting to sync" shows under it, it disappears within a few seconds |
| 9 | Look at the Eaten card | — | "220 kcal"; Protein 13.2 g, Carbs 9.9 g, Fat 14.2 g, Fibre 0.0 g |
| 10 | Look at the week strip | — | Today's status box is filled green |

**Final expected result:** the breakfast is saved on today with both foods and the values above,
and it syncs (no "Waiting to sync" left).

**Result**
- [ ] Pass
- [ ] Fail
- Actual result / notes:

### S3-09 · Home follows the meal
**Screen:** Home › Calories, Protein, week strip, "By meal" · **Covers:** REQ-HOME-002, REQ-HOME-003, REQ-HOME-004, REQ-HOME-005 · **Start:** Nutrition (after S3-08) · **Data:** targets from P-07

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | Bottom bar: **Home** | — | Calories card: "220 of 2,000 kcal", a bar about one tenth full, "11%" and "1,780 kcal remaining" |
| 2 | Look at the Protein card | — | "13 of 100 g", "13%" and "87 g remaining" |
| 3 | Look at the week strip | — | Today's status box filled green |
| 4 | Bottom bar: **Nutrition**; tap the **Saved** tab; bottom bar: **Home**; tap **By meal** | — | Nutrition opens on the **Consumed** tab (not Saved) for the same day |
| 5 | Do step 4 **again**: tap the **Saved** tab; bottom bar **Home**; tap **By meal** | — | Again the **Consumed** tab (Q-023: "By meal" opens Consumed even when another tab was open) |

**Final expected result:** Home's calories and protein match the breakfast, and "By meal" opens
Consumed every time, not only the first time.

**Result**
- [ ] Pass
- [ ] Fail
- Actual result / notes:

### S3-10 · Lunch from Home "+": meal type required, a tag, changing grams, removing a food
**Screen:** Home "+" → Log meal › Review › ••• · **Covers:** REQ-NAV-003, REQ-LOG-003, REQ-LOG-007 (review), Q-031 (tags) · **Start:** Home, today selected · **Data:** Rice, raw, milled 80 g then 60 g; Red gram, dal 40 g; Paneer 100 g (removed); Lunch; tag Before training

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | Home › floating **+** | — | Log meal, today, no meal chip chosen |
| 2 | **Search foods**; type `rice raw milled`; tap **Rice, raw, milled** (356 kcal per 100 g); Grams eaten | `80` | "= 285 kcal · 6.4 g protein". Tap **Add** |
| 3 | Look under Review | — | "80 g · 285 kcal · 6.4 g protein"; **Save meal** still greyed out; below it "Choose the meal: Breakfast, Lunch, Snack or Dinner." |
| 4 | **Search foods**; type `red gram dal`; tap **Red gram, dal**; Grams eaten | `40` | "= 132 kcal · 8.7 g protein". Tap **Add**. "Total: 417 kcal · 15.0 g protein" |
| 5 | **Search foods**; type `paneer`; tap **Paneer**; leave Grams eaten | `100` | "= 258 kcal · 18.9 g protein". Tap **Add**. "Total: 675 kcal · 33.9 g protein" |
| 6 | Tap the **•••** on the "Rice, raw, milled" row | — | A sheet titled "Rice, raw, milled" with a **New grams** box holding `80`, "g", and buttons **Remove** and **Cancel** (no "Change to" button yet) |
| 7 | Clear New grams; type | `0` | Red "Enter whole grams from 1 to 2,000."; still no "Change to" button |
| 8 | Clear; type | `60` | A **Change to 60 g** button appears. Tap it |
| 9 | Look at the rice row | — | "60 g · 214 kcal · 4.8 g protein"; "Total: 604 kcal · 32.3 g protein" |
| 10 | Tap the **•••** on the "Paneer" row › **Remove** | — | Paneer is gone at once; "Total: 346 kcal · 13.4 g protein" |
| 11 | Tap the **Lunch** chip, then the **Before training** chip | — | Lunch filled blue; "Before training" filled dark grey; the "Choose the meal…" line is gone; **Save meal** enabled |
| 12 | Tap **Save meal** | — | Back on Home: Calories "566 of 2,000 kcal" · 28% · "1,434 kcal remaining"; Protein "27 of 100 g" · 27% · "73 g remaining" |
| 13 | **By meal** | — | Lunch slot: "Rice, raw, milled + 1 more", "346 kcal · 13.4 g protein" and a small "Before training" label. Eaten: 566 kcal; Protein 26.7 g, Carbs 78.9 g, Fat 15.2 g, Fibre 5.3 g |

**Final expected result:** a meal cannot be saved without a meal type; grams can be changed and
foods removed before saving; the tag shows on the card.

**Result**
- [ ] Pass
- [ ] Fail
- Actual result / notes:

### S3-11 · Edit a meal
**Screen:** Nutrition › Breakfast card ••• › Edit → Log meal · **Covers:** REQ-NUT-004, REQ-LOG-007 · **Start:** Nutrition › Consumed, today · **Data:** egg 50 g → 100 g

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | On the Breakfast card, tap **•••** | — | A sheet titled "Egg, poultry, whole, boiled + 1 more" with **Edit**, **Delete**, **Save to my meals**, **Cancel** |
| 2 | Tap **Edit** | — | Log meal with the date as plain text "Fri 30 Oct" (no chip, no ▾: the date of a logged meal is fixed), Breakfast chosen, both foods, "Total: 220 kcal · 13.2 g protein" |
| 3 | Tap **•••** on the egg row; clear New grams; type | `100` | **Change to 100 g**. Tap it |
| 4 | Look at the Review | — | Egg row "100 g · 148 kcal · 13.4 g protein"; "Total: 294 kcal · 20.0 g protein" |
| 5 | Tap **Save meal** | — | Back on Nutrition. Breakfast slot still has **one** card (replaced, not added), now "294 kcal · 20.0 g protein" |
| 6 | Look at the Eaten card | — | 640 kcal; Protein 33.4 g, Carbs 78.9 g, Fat 20.4 g, Fibre 5.3 g |

**Final expected result:** Edit opens the meal filled in with its date fixed, and saving replaces
the same meal.

**Result**
- [ ] Pass
- [ ] Fail
- Actual result / notes:

### S3-12 · Your own food, and its checks
**Screen:** Nutrition › Snack "+" → Log meal › Enter your own food · **Covers:** REQ-LOG-007 (your own food; fibre optional) · **Start:** Nutrition › Consumed, today · **Data:** "Test snack bar", 400 / 20 / 45 / 15 / fibre empty, 50 g

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | In the **Snack** slot tap its round **+** | — | Log meal, today, **Snack** chosen |
| 2 | Tap **Enter your own food** | — | A sheet "Enter your own food", "Type the values from the label, per 100 g.", then an **unlabelled box (the food name)**, then boxes "kcal per 100 g", "Protein per 100 g (g)", "Carbs per 100 g (g)", "Fat per 100 g (g)", "Fibre per 100 g (g, optional)", "Grams eaten"; **Add** greyed out; **Cancel** |
| 3 | In the unlabelled name box type | `Test snack bar` | — |
| 4 | kcal per 100 g | `950` | Red "Enter a number with at most one decimal." under it; **Add** greyed out. (The limit is 900; the message does not name it) |
| 5 | Clear kcal; type | `12.55` | The same red message |
| 6 | Clear kcal; type | `400` | The message is gone |
| 7 | Protein, Carbs, Fat | `20`, `45`, `15` | No red messages; **Add** still greyed out (grams missing) |
| 8 | Leave Fibre empty; Grams eaten | `50` | **Add** enabled |
| 9 | Tap **Add** | — | Review: "Test snack bar", "50 g · 200 kcal · 10.0 g protein"; "Total: 200 kcal · 10.0 g protein" |
| 10 | Tap **Save meal** | — | Nutrition: Snack card "Test snack bar", "200 kcal · 10.0 g protein" |

**Final expected result:** your own food needs a name, kcal, protein, carbs, fat and grams; fibre
may stay empty; values over the limit or with two decimals cannot be added.

**Result**
- [ ] Pass
- [ ] Fail
- Actual result / notes:

### S3-13 · Checkpoint: today's totals after three meals
**Screen:** Nutrition › Consumed; Home · **Covers:** REQ-NUT-002, REQ-HOME-003, REQ-HOME-004 · **Start:** Nutrition › Consumed, today · **Data:** none

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | Look at the Eaten card | — | "840 kcal"; Protein 43.4 g, Carbs 101.4 g, Fat 27.9 g, Fibre 5.3 g (the snack has no fibre, so it adds nothing there) |
| 2 | Look at the slots | — | Breakfast: one card (294 kcal); Lunch: one card (346 kcal, "Before training"); Snack: one card (200 kcal); Dinner: "Tap to add what you ate" |
| 3 | Bottom bar: **Home** | — | Calories "840 of 2,000 kcal", "42%", "1,160 kcal remaining"; Protein "43 of 100 g", "43%", "57 g remaining" |

**Final expected result:** Nutrition and Home add up the same three meals.

**Result**
- [ ] Pass
- [ ] Fail
- Actual result / notes:

---

## Part C: Saved meals and other days

### S3-14 · Save to my meals
**Screen:** Nutrition › Breakfast card ••• › Save to my meals · **Covers:** REQ-NUT-004, REQ-SAVED-001 · **Start:** Nutrition › Consumed, today · **Data:** name `Test breakfast`

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | Breakfast card **•••** › **Save to my meals** | — | A sheet "Save to my meals" with a Name box holding "Egg, poultry, whole, boiled + 1 more", **Save**, **Cancel** |
| 2 | Clear the Name box | (empty) | **Save** greyed out |
| 3 | Type | `Test breakfast` | **Save** enabled. Tap it |
| 4 | Tap the **Saved** tab | — | One card "Egg, poultry, whole, boiled + 1 more" with "294 kcal · 20.0 g protein" and "•••" (the card shows the foods; the name is used when re-logging) |
| 5 | Tap the **Consumed** tab | — | The breakfast is still there, unchanged |

**Final expected result:** the meal is copied into Saved under the name typed, and the logged meal
stays.

**Result**
- [ ] Pass
- [ ] Fail
- Actual result / notes:

### S3-15 · Add a saved meal inside Log meal (nothing saved)
**Screen:** Home "+" → Log meal › Saved meals · **Covers:** REQ-SAVED-001, REQ-LOG-007 · **Start:** Home, today selected · **Data:** saved meal "Test breakfast"

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | Home › floating **+** › **Saved meals** | — | A sheet "Add a saved meal" with a button "Test breakfast (Egg, poultry, whole, boiled + 1 more)" and **Cancel** |
| 2 | Tap that button | — | Review lists the egg (100 g) and the milk (200 g); "Total: 294 kcal · 20.0 g protein"; the **Breakfast** chip is now chosen (taken from the saved meal) |
| 3 | Tap the back arrow | — | Home, no question asked; Calories still "840 of 2,000 kcal" (nothing saved) |

**Final expected result:** a saved meal's foods can be added to a new meal, and its meal type is
used when none was chosen.

**Result**
- [ ] Pass
- [ ] Fail
- Actual result / notes:

### S3-16 · Re-log a saved meal to yesterday; view a past day
**Screen:** header 📅 → Nutrition › Saved › card → "Log …" sheet · **Covers:** REQ-SAVED-001, Q-036, REQ-DATE-001, REQ-NUT-003 · **Start:** Home, today selected · **Data:** yesterday; Breakfast

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | Header **📅** | — | A month calendar ("October 2026"), today filled blue, later days greyed out, **Close** |
| 2 | Tap yesterday's date (use ‹ if yesterday is in last month) | — | The calendar closes; the header shows yesterday's date without "Today ·"; Home shows "Showing Thu 29 Oct" and **Back to today** |
| 3 | Bottom bar: **Nutrition** › **Saved** tab; tap the card's text (not its •••) | — | A sheet "Log Test breakfast", "To Thu 29 Oct", the meal chips with **Breakfast** chosen, **Log meal**, **Cancel** |
| 4 | Tap **Log meal** | — | The sheet closes |
| 5 | Tap the **Consumed** tab | — | "Showing Thu 29 Oct" banner; Breakfast card "Egg, poultry, whole, boiled + 1 more", "294 kcal · 20.0 g protein"; Eaten 294 kcal, Protein 20.0 g, Carbs 9.9 g, Fat 19.5 g, Fibre 0.0 g; yesterday's status box filled green |
| 6 | Bottom bar: **Home** | — | Calories "294 of 2,000 kcal" · 15% · "1,706 kcal remaining"; Protein "20 of 100 g" · 20% · "80 g remaining" |
| 7 | Tap **Back to today** | — | Header "Today · <date>"; Calories "840 of 2,000 kcal" again |

**Final expected result:** the saved meal is logged to the selected past date in its meal type,
and Home, Nutrition and the week strip show each day's own meals.

**Result**
- [ ] Pass
- [ ] Fail
- Actual result / notes:

### S3-17 · Log to an earlier day with the date chip; estimated values in the review
**Screen:** Home "+" → Log meal › date chip → "Log this meal to" · **Covers:** REQ-LOG-002, Q-037, D-26 decision 3 · **Start:** Home, today selected · **Data:** 2 days ago; Dinner; Wheat flour, atta 60 g; Ghee 5 g

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | Home › floating **+**; tap the chip "Today, Fri 30 Oct ▾" | — | A sheet "Log this meal to" with 7 rows: "Today, Fri 30 Oct" (highlighted) "3 meals logged"; "Yesterday, Thu 29 Oct" "1 meal logged"; then five earlier days, each with its status (2 and 3 days ago: "Nothing logged"); buttons **Another day…** and **Cancel** |
| 2 | Tap **Another day…** | — | The month calendar; later days greyed out. Tap **Close**: the calendar closes and the date stays today |
| 3 | Tap the chip again; tap the **third** row (2 days ago, e.g. "Wed 28 Oct") | — | The chip now reads "Wed 28 Oct ▾" (no "Today,") |
| 4 | Tap **Dinner** | — | Dinner chosen |
| 5 | **Search foods**; type `atta`; tap **Wheat flour, atta**; Grams eaten | `60` | "= 192 kcal · 6.3 g protein". **Add** |
| 6 | **Search foods**; type `ghee`; tap **Ghee**; Grams eaten | `5` | "= 45 kcal · 0.0 g protein". **Add** |
| 7 | Look at the Review | — | Ghee row "5 g · 45 kcal · 0.0 g protein · estimated"; atta row without "estimated"; "Total: 237 kcal · 6.3 g protein" |
| 8 | **Save meal** | — | Home, still today: Calories "840 of 2,000 kcal" (unchanged) |
| 9 | Header **📅** › tap the date 2 days ago › bottom bar **Nutrition** › **Consumed** | — | "Showing Wed 28 Oct"; Dinner card "Wheat flour, atta + 1 more", "237 kcal · 6.3 g protein"; Eaten 237 kcal, Protein 6.3 g, Carbs 38.5 g, Fat 5.9 g, Fibre 6.8 g |
| 10 | **Back to today** | — | Today again |

**Final expected result:** the meal is saved on the day chosen in the chip, not on today, and the
estimated ghee is marked "estimated".

**Result**
- [ ] Pass
- [ ] Fail
- Actual result / notes:

### S3-18 · Date limits: no future days, 90 days back
**Screen:** week strip, header 📅, Log meal calendar · **Covers:** REQ-DATE-001, Q-017, REQ-LOG-002 (MVP default, D-23: 90 days) · **Start:** Home, today selected · **Data:** none

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | On Home's week strip, tap a day after today (if today is Sunday, skip to step 2) | — | Its date is greyed out and nothing happens |
| 2 | Tap **›** (next week) at the right end of the strip | — | Nothing happens (it is greyed out in the current week) |
| 3 | Header **📅**; tap **›** next to the month name | — | Nothing happens (no later month); later days greyed out. **Close** |
| 4 | Header **📅**; tap **‹** until it stops | — | It stops at the month that holds the day 89 days before today (e.g. August 2026 when today is 30 Oct); in that month, days before that day are greyed out and cannot be tapped. **Close** |
| 5 | Home › floating **+** › date chip › **Another day…** | — | The same limits: later days and days more than 89 days back are greyed out. **Close**, then back arrow |

**Final expected result:** no future date can be chosen anywhere, and nothing older than the 90 days
held on the phone (today and the 89 days before it).

**Result**
- [ ] Pass
- [ ] Fail
- Actual result / notes:

---

## Part D: Photos, links and barcodes

### S3-19 · Meal photo: take, remove before saving, save, view
**Screen:** Nutrition › Lunch ••• › Edit → Photo (optional) · **Covers:** REQ-LOG-006, REQ-NFR-006, plan phone check 5, ADR-0002 step 5, ADR-0001 check 3 · **Start:** Nutrition › Consumed, today · **Data:** a photo of a plate or any object (nothing personal)

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | Lunch card **•••** › **Edit**; scroll to "Photo (optional)"; tap **Take photo** | — | First time only: Android asks for the camera. Choose **While using the app** |
| 2 | Take a photo and confirm it (✓ / OK) | — | "Preparing the photo…" briefly, then a small square thumbnail and **Remove photo**; the three photo buttons are gone |
| 3 | Tap **Remove photo** | — | The three photo buttons come back |
| 4 | Tap **Choose from gallery**; pick any non-personal picture | — | The thumbnail and **Remove photo** again |
| 5 | Tap **Save meal** | — | Nutrition: the Lunch card shows a small thumbnail between its text and "•••"; totals unchanged (840 kcal) |
| 6 | Tap the thumbnail | — | A dark full-screen view with the photo ("Loading photo…" first if needed) and **Close**. No download or share button. Tap **Close** |
| 7 | *Optional, on the PC, read only:* Supabase dashboard › Storage › bucket `meal-photos` › `meals/<your user ID>/` | — | One `<id>.jpg` of about 200 KB or less and one `<id>-thumb.jpg`. Download the `.jpg`; in Windows, right-click › Properties › Details shows **no GPS** section |
| 8 | *If you denied the camera in step 1:* tap **Take photo** again | — | Red "FitSphere needs the camera to take a photo. You can choose one from the gallery instead." |

**Final expected result:** a photo can be taken or chosen, removed before saving, saved with the
meal, shown as a thumbnail and opened view-only. (Removing it from the bucket is checked in the
cleanup, C-02.)

**Result**
- [ ] Pass
- [ ] Fail
- Actual result / notes:

### S3-20 · Public image link with the privacy warning
**Screen:** Nutrition › Snack ••• › Edit → Add an image link instead · **Covers:** REQ-LOG-010, plan phone check 6 · **Start:** Nutrition › Consumed, today · **Data:** `http://example.com/meal.jpg`, then `https://example.com/meal.jpg`

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | Snack card ("Test snack bar") **•••** › **Edit**; tap **Add an image link instead** | — | A sheet "Add an image link", "A link to your own image on another site, starting with https://", a box, and only **Cancel** |
| 2 | Type | `http://example.com/meal.jpg` | Red "Enter a link that starts with https://"; still only **Cancel** |
| 3 | Clear; type | `https://example.com/meal.jpg` | A **Continue** button appears. Tap it |
| 4 | Read the next sheet | — | "Add this link?" and "Anyone who has this link can view it. FitSphere cannot delete content stored on other sites."; **Add link** and **Cancel** |
| 5 | Tap **Cancel** | — | Back on Log meal with the three photo buttons: no link was added |
| 6 | Repeat steps 1 (from **Add an image link instead**) to 4, then tap **Add link** | `https://example.com/meal.jpg` | "Image link: example.com" and **Remove link** |
| 7 | **Save meal** | — | Nutrition: the Snack card shows "Image link: example.com ↗" in blue |
| 8 | Tap "Image link: example.com ↗" | — | The phone's browser opens `https://example.com/meal.jpg` (the page may say "not found"; FitSphere only opens it). Come back to FitSphere |

**Final expected result:** only an https link is accepted, it is added only after the warning is
confirmed, Cancel adds nothing, and the saved link opens in the browser.

**Result**
- [ ] Pass
- [ ] Fail
- Actual result / notes:

### S3-21 · Barcode: scan a product with the camera and add it in grams
**Screen:** Home "+" → Log meal › Scan barcode · **Covers:** REQ-LOG-007, ADR-0006 rule 2, plan phone check 3 · **Start:** Home, today selected · **Data:** a packaged Indian food with a barcode; 3 days ago; Snack; 30 g

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | Home › floating **+**; date chip › the **fourth** row (3 days ago, "Nothing logged") | — | The chip shows that date |
| 2 | Tap **Snack**; tap **Scan barcode** | — | A sheet "Scan barcode". Only if the camera isn't allowed yet: "FitSphere needs the camera to scan a barcode." and **Allow camera**; tap it and allow. Then a camera view, "Or type the digits under the barcode:", a box, a greyed **Look up**, **Close** |
| 3 | Point the camera at the product's barcode | — | "Looking up the barcode…", then the product's name (with its brand in brackets when known) |
| 4a | **If** it shows "Per 100 g: <k> kcal · <p> g protein" and a Grams eaten box with `100`: clear it and type | `30` | "= <k × 0.3> kcal · <p × 0.3> g protein" (e.g. 500 kcal per 100 g → 150 kcal). Small text "Contains data from Open Food Facts, available under the Open Database License."; buttons **Add**, **Scan another barcode**, **Close**. Tap **Add** |
| 4b | **If** it shows "Open Food Facts doesn't have this product's kcal and protein. Enter them from the label." | — | **Enter your own food** opens the own-food sheet with the product's name already filled. Enter the label's values per 100 g and Grams eaten `30`, then **Add** |
| 4c | **If** it shows "This product isn't in Open Food Facts yet. Enter the values from the label." | — | Try another product for this test (the not-found case is S3-22) |
| 5 | Look at the Review | — | The product, "30 g · … kcal · … g protein" |
| 6 | **Stay on this Log meal screen** and continue with S3-22 | — | — |

**Final expected result:** a scanned barcode is looked up through FitSphere's API, shown with Open
Food Facts' attribution, and added in grams.

**Result**
- [ ] Pass
- [ ] Fail
- Actual result / notes (product, kcal and protein per 100 g shown):

### S3-22 · Barcode: typed digits, a wrong format, and a product that isn't found
**Screen:** Log meal › Scan barcode (typed) › Enter your own food · **Covers:** REQ-LOG-007, ADR-0006 validation 4, plan phone check 3 · **Start:** the Log meal screen left open in S3-21 · **Data:** `1234567`; a second product's digits; a product Open Food Facts doesn't know

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | Tap **Scan barcode**; tap the digits box and type | `1234567` | Red "Enter the 8 to 14 digits under the barcode."; **Look up** greyed out |
| 2 | Clear; type the 8 to 14 digits printed under a **second** product's barcode | (digits) | No red text; **Look up** enabled. Tap it: "Looking up the barcode…", then the product (as S3-21 step 4a, 4b or 4c). Tap **Scan another barcode** without adding it |
| 3 | Scan or type the barcode of a product Open Food Facts doesn't know (a local shop or bakery item works best) | (digits) | "This product isn't in Open Food Facts yet. Enter the values from the label." with **Enter your own food**, **Scan another barcode** and **Close**. If every product you try is found, write "N/A: all found" below and skip to step 6 |
| 4 | Tap **Enter your own food** | — | The own-food sheet, name box empty |
| 5 | Type a name, the label's kcal, protein, carbs and fat per 100 g (fibre optional), Grams eaten `30`; **Add** | (label values) | Review now lists the S3-21 product and this one |
| 6 | **Save meal** | — | Home (today unchanged: 840 kcal) |
| 7 | Header **📅** › the date 3 days ago › **Nutrition** › Consumed | — | A Snack card "<first product> + 1 more" (or the one product) with the summed kcal and protein; then **Back to today** |

**Final expected result:** typed digits must be 8 to 14 long; a typed barcode is looked up like a
scanned one; a product that isn't found can be logged as your own food.

**Result**
- [ ] Pass
- [ ] Fail
- Actual result / notes:

### S3-23 · Barcode coverage: 20 Indian packaged foods (a measurement)
**Screen:** Log meal › Scan barcode · **Covers:** ADR-0006 validation 1, ADR-0001 check 2 · **Start:** Home, today selected · **Data:** 20 different packaged foods (biscuits, namkeen, atta, dal, oil, ghee, milk, curd, paneer, tea, spices, noodles, chocolates, juices, etc.)

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | Home › floating **+** › **Scan barcode** | — | The scanner |
| 2 | Scan product 1; note the result in the table below; tap **Scan another barcode** | — | One of: the product with kcal and protein (found); "Open Food Facts doesn't have this product's kcal and protein…" (found, no values); "This product isn't in Open Food Facts yet…" (not found) |
| 3 | Repeat for products 2 to 20 | — | — |
| 4 | **Close**; back arrow | — | Home; nothing saved |

| # | Product | Found with kcal and protein | Found without values | Not found |
|---|---|---|---|---|
| 1 | | ☐ | ☐ | ☐ |
| 2 | | ☐ | ☐ | ☐ |
| 3 | | ☐ | ☐ | ☐ |
| 4 | | ☐ | ☐ | ☐ |
| 5 | | ☐ | ☐ | ☐ |
| 6 | | ☐ | ☐ | ☐ |
| 7 | | ☐ | ☐ | ☐ |
| 8 | | ☐ | ☐ | ☐ |
| 9 | | ☐ | ☐ | ☐ |
| 10 | | ☐ | ☐ | ☐ |
| 11 | | ☐ | ☐ | ☐ |
| 12 | | ☐ | ☐ | ☐ |
| 13 | | ☐ | ☐ | ☐ |
| 14 | | ☐ | ☐ | ☐ |
| 15 | | ☐ | ☐ | ☐ |
| 16 | | ☐ | ☐ | ☐ |
| 17 | | ☐ | ☐ | ☐ |
| 18 | | ☐ | ☐ | ☐ |
| 19 | | ☐ | ☐ | ☐ |
| 20 | | ☐ | ☐ | ☐ |
| | **Totals** | ___ / 20 | ___ / 20 | ___ / 20 |

**Final expected result:** every scan ends in one of the three outcomes, with no crash and no
"Barcode lookup isn't available right now…" message. The counts are a measurement for ADR-0006,
not a pass mark.

**Result**
- [ ] Pass
- [ ] Fail
- Actual result / notes:

---

## Part E: Offline and sync

Turn on **Aeroplane mode** from Android's quick settings and check that **Wi-Fi and mobile data are
both off** (some phones keep Wi-Fi on in aeroplane mode). Keep FitSphere open: don't swipe it away
or reload it, because the development build loads its code from the PC. A message about the
development server being disconnected can be ignored. Run S3-24 and S3-25 in one go.

### S3-24 · Offline: search 20 common foods
**Screen:** Log meal › Search foods, offline · **Covers:** ADR-0006 validation 2, REQ-ACC-005, plan phone check 1 · **Start:** Home, today selected, **aeroplane mode on** · **Data:** the 20 words below

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | Home › floating **+** › **Search foods** | — | The search sheet works; no "needs an internet connection" text |
| 2 | Type each word, clearing between them | `atta`, `rice`, `dal`, `paneer`, `ghee`, `milk`, `egg`, `banana`, `potato`, `onion`, `tomato`, `spinach`, `cauliflower`, `apple`, `almond`, `jaggery`, `ragi`, `bajra`, `jowar`, `soya` | Each word lists at least one food (e.g. `dal`: "Bengal gram, dal", "Black gram, dal", "Green gram, dal", "Lentil dal", "Red gram, dal"; `ghee`: "Ghee … · estimated"), and the IFCT acknowledgement stays under the list |
| 3 | **Close** (stay on Log meal for S3-25) | — | — |

Known, not a failure: Hindi names that IFCT doesn't use find nothing (`toor`, `moong`, `chana`,
`curd`, `roti`, `idli`, `dosa`, `oats`). Use "red gram", "green gram", "bengal gram".

**Final expected result:** all 20 searches find foods with no connection.

**Result**
- [ ] Pass
- [ ] Fail
- Actual result / notes (words that found nothing):

### S3-25 · Offline: log a meal, barcode needs internet, then sync
**Screen:** Log meal offline; Nutrition; Account › Development · **Covers:** REQ-NFR-004, ADR-0007 step 1 (meals), plan phone check 4 · **Start:** the Log meal screen from S3-24, still offline · **Data:** Banana, ripe, robusta 120 g; Snack

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | Tap **Scan barcode**; type | `8901234567890` then **Look up** | "Looking up a barcode needs an internet connection." with **Enter your own food**, **Scan another barcode**, **Close**. Tap **Close** |
| 2 | Tap **Snack**; **Search foods**; type `banana robusta`; tap **Banana, ripe, robusta**; Grams eaten | `120` | "= 126 kcal · 1.5 g protein". **Add** |
| 3 | **Save meal** | — | Home: Calories "966 of 2,000 kcal", 48%, "1,034 kcal remaining"; Protein "45 of 100 g", 45%, "55 g remaining" |
| 4 | **Nutrition** › Consumed | — | Snack slot: the "Test snack bar" card and a new "Banana, ripe, robusta" card "126 kcal · 1.5 g protein" with **"Waiting to sync"**. Eaten 966 kcal, Protein 44.9 g, Carbs 129.8 g, Fat 28.3 g, Fibre 7.6 g |
| 5 | Turn **aeroplane mode off**; wait up to 30 seconds with FitSphere open | — | "Waiting to sync" disappears from the banana card |
| 6 | Account (round letter) › Development | — | "Sync: synced". Back to Nutrition |
| 7 | *Optional, on the PC, read only:* Supabase dashboard › Table Editor › schema `app` › `meals` | — | A row for today with `meal_type` = snack and `kcal` = 126 (don't edit rows) |

If "Waiting to sync" stays after a minute, switch to another app and back (sync also runs when the
app returns to the screen), then see Troubleshooting.

**Final expected result:** a meal logged offline counts at once on the phone, is marked "Waiting to
sync", and syncs by itself when the connection returns. The barcode lookup alone says it needs the
internet.

**Result**
- [ ] Pass
- [ ] Fail
- Actual result / notes:

---

## Part F: Deleting and getting data back

### S3-26 · Delete a meal (Cancel first)
**Screen:** Nutrition › meal ••• › Delete · **Covers:** REQ-NUT-004 · **Start:** Nutrition › Consumed, today, online · **Data:** the banana snack from S3-25

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | On the "Banana, ripe, robusta" card tap **•••** › **Delete** | — | A sheet "Delete this meal?" with a red **Delete** and **Cancel** |
| 2 | Tap **Cancel** | — | The banana card is still there; Eaten 966 kcal |
| 3 | **•••** › **Delete** › **Delete** | — | The card is gone; Eaten 840 kcal, Protein 43.4 g, Carbs 101.4 g, Fat 27.9 g, Fibre 5.3 g |
| 4 | **Home** | — | Calories "840 of 2,000 kcal"; Protein "43 of 100 g" |

**Final expected result:** a meal is deleted only after confirming, and the totals drop by its
values.

**Result**
- [ ] Pass
- [ ] Fail
- Actual result / notes:

### S3-27 · Delete a saved meal
**Screen:** Nutrition › Saved › ••• › Delete · **Covers:** REQ-SAVED-001 · **Start:** Nutrition, online · **Data:** "Test breakfast"

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | **Saved** tab; tap the card's **•••** | — | A sheet titled "Test breakfast" with **Delete** and **Cancel** |
| 2 | **Delete** | — | "Delete this saved meal?" with a red **Delete** and **Cancel** |
| 3 | **Delete** | — | The Saved tab shows its empty text again (S3-02 step 2) |
| 4 | Header **📅** › yesterday › **Consumed** | — | Yesterday's breakfast logged from it in S3-16 is still there (deleting a saved meal never deletes logged meals). **Back to today** |

**Final expected result:** the saved meal is gone after confirming; meals logged from it stay.

**Result**
- [ ] Pass
- [ ] Fail
- Actual result / notes:

### S3-28 · Meals come back after log out and sign in
**Screen:** Account › Log out → Sign in → Nutrition · **Covers:** REQ-ACC-008, REQ-NFR-004 (the server copy), REQ-LOG-006 · **Start:** Home, online, nothing "Waiting to sync" · **Data:** your test account's email and password

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | Account (round letter) › **Log out** | — | The sign-in screen at once. If instead "<n> entries are not on the server yet. If you log out now, they are deleted from this phone." appears, tap **Stay signed in**, check the connection, wait until "Sync: synced", and try again |
| 2 | Sign in with the test account | (email, password) | Home, today. Calories "840 of 2,000 kcal" once the first sync is done (a few seconds) |
| 3 | **Nutrition** › Consumed (today) | — | Breakfast 294 kcal; Lunch 346 kcal with "Before training" and its photo thumbnail (it may first say "Loading photo…"); Snack "Test snack bar" with "Image link: example.com ↗" |
| 4 | Check yesterday, 2 days ago and 3 days ago (📅) | — | Yesterday: Breakfast 294 kcal. 2 days ago: Dinner 237 kcal. 3 days ago: the barcode Snack. **Saved** tab: empty (the deletion was kept) |
| 5 | **Back to today**; Home › **+** › **Search foods** › `atta` | — | "Wheat flour, atta" (the food list downloaded again). **Close**, back arrow |

**Final expected result:** after the phone's copy is deleted at log out, every meal, its values,
tags, photo and link, and the deleted saved meal's absence come back from the server.

**Result**
- [ ] Pass
- [ ] Fail
- Actual result / notes:

---

## Part G: Dishes (blocked)

### S3-29 · Log a dish in portions — **BLOCKED**
**Status: Blocked by missing data. Do not run.** On 2026-10-30, `docs/data/standard-recipe-sheet.csv`
has **0 approved** rows (24 `pending`, chicken curry `blocked`), so `foods:import` imports 0 dishes
and the phone has none to find. The dish code is built (D-28); S3-06 checks that no dish appears.
A dish goes live only when the owner weighs its recipe, fills its row and marks it `approved` in a
merged pull request, and `npm run foods:import -w @fitsphere/api` runs again. Nobody fills in or
approves a row without the owner's measurements; the chicken curry stays `blocked`.

**Screen:** Log meal › Search foods › a dish (portion stepper) · **Covers:** D-28, plan phone check 8 · **Data:** the first approved dish (e.g. "Boiled egg", per piece, if it is the one approved); 1.5 then 2 portions

Steps to run once a dish is approved (values come from its approved row; none exist today):

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | Home › floating **+** › **Search foods**; type the dish's name | e.g. `boiled egg` | The dish listed **first**, with "Dish · <k> kcal per piece · estimated" (or "per katori (200 ml)"), then the IFCT foods |
| 2 | Tap the dish | — | "One portion is one piece: <k> kcal · <p> g protein (estimated)"; a stepper "−  1 portion  +"; "= <k> kcal · …"; **Add**. No grams box and no ingredient fields |
| 3 | Tap **−** | — | "0.5 portions"; **−** greyed out (cannot go lower) |
| 4 | Tap **+** 19 times | — | "10 portions"; **+** greyed out |
| 5 | Tap **−** until it shows | "1.5 portions" | "= <k × 1.5> kcal · …". Tap **Add** |
| 6 | Review | — | "1.5 portions · … kcal · … g protein · estimated" |
| 7 | Tap the dish's **•••**; tap **+** once | — | **Change to 2 portions**. Tap it: "2 portions · <k × 2> kcal …" |
| 8 | Choose a meal; **Save meal** | — | Home's Calories and Protein rise by the dish's values for 2 portions |
| 9 | Search `chicken curry` and any still-pending dish | — | No "Dish ·" row for them |

**Result**
- [ ] Blocked (expected today)
- [ ] Pass
- [ ] Fail
- Actual result / notes:

---

## Cleanup (after S3-28)

| # | What | How | Confirm |
|---|---|---|---|
| C-01 | Delete today's meals | Nutrition › Consumed (today): **•••** › **Delete** › **Delete** on the Breakfast, Lunch and Snack cards | Eaten "–"; Home "0 of 2,000 kcal" |
| C-02 | Check the photo left storage (optional, PC, read only) | After C-01 and the next sync, Supabase › Storage › `meal-photos` › `meals/<your user ID>/` | The lunch photo's `.jpg` and `-thumb.jpg` are gone (plan phone check 5) |
| C-03 | Delete the other days' meals | 📅 › yesterday, 2 days ago, 3 days ago; delete each card the same way; then **Back to today** | Each day shows "Eaten –" and its status box is empty |
| C-04 | Targets | Leave them for the Training guide (it uses Weekly workouts 4) | — |
| C-05 | Finish | If you stop here rather than continuing with Training: Ctrl+C once in the `dev:phone` terminal | It stops the API, the tunnel and Expo and empties `EXPO_PUBLIC_API_URL` |

Deleted meals stay on the server as empty rows marked deleted (by design). The barcode lookups stay
in the shared product cache `app.barcode_products`, which holds no user data.

## Troubleshooting
| Symptom | Likely cause and what to do |
|---|---|
| Search says "Downloading the food list needs an internet connection." while online | The list has never reached the phone. Check Account › Development: "Sync: failed" usually means migrations 0006 and 0007 are not applied (P-02), so every sync fails and the list is never fetched. Check `.dev-phone/api.log` |
| "API: unreachable" on Account | `dev:phone` isn't running, or the tunnel changed. Restart `npm run dev:phone`, then force-stop and reopen the app |
| App stuck on "Reloading…" | Force-stop the app (Android Settings › Apps › FitSphere › Force stop) and open it again |
| "Cannot find native module 'ExpoCamera'" | The phone runs an older build: install the 2026-10-29 development build (P-03) |
| "Barcode lookup isn't available right now. Try again later, or enter your own food." | The API couldn't reach Open Food Facts. Check `OFF_CONTACT` in `apps/api/.env` and `.dev-phone/api.log`; try again later |
| A meal card says "Not saved" and Home shows "This meal wasn't saved: … Edit or discard it." | The server refused the change. Note the reason text and the steps; don't discard it before reporting |
| "Waiting to sync" never clears | Confirm Wi-Fi or data is on; switch apps and come back; check "Sync:" on Account › Development |

## Results summary
| Test | Title | Result | Notes |
|---|---|---|---|
| S3-01 | Nutrition tab, empty day | | |
| S3-02 | Diet plan and Saved empty states | | |
| S3-03 | Log meal screen; leaving without saving | | |
| S3-04 | Food search basics | | |
| S3-05 | Estimated kcal, hidden rows, aliases | | |
| S3-06 | Dishes not offered (none approved) | | |
| S3-07 | Grams validation | | |
| S3-08 | Breakfast by search in grams | | |
| S3-09 | Home follows the meal | | |
| S3-10 | Lunch: meal type, tag, change grams, remove | | |
| S3-11 | Edit a meal | | |
| S3-12 | Your own food and its checks | | |
| S3-13 | Checkpoint: three meals | | |
| S3-14 | Save to my meals | | |
| S3-15 | Saved meal inside Log meal | | |
| S3-16 | Re-log to yesterday | | |
| S3-17 | Date chip, earlier day, estimated ghee | | |
| S3-18 | Date limits | | |
| S3-19 | Meal photo | | |
| S3-20 | Public image link | | |
| S3-21 | Barcode scanned and added | | |
| S3-22 | Barcode typed, wrong format, not found | | |
| S3-23 | Barcode coverage (20 products) | | __ found / 20 |
| S3-24 | Offline search (20 foods) | | |
| S3-25 | Offline logging and sync | | |
| S3-26 | Delete a meal | | |
| S3-27 | Delete a saved meal | | |
| S3-28 | Data back after log out and sign in | | |
| S3-29 | Dish in portions | Blocked | 0 approved recipes |
