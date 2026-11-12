# Project Instructions for Claude Code

## Purpose
FitSphere is a coach-led fitness app. Clients log food, body metrics and workouts against
targets set by their coach; Coaches manage their trainees; Head Coaches manage Coaches.
**The MVP delivers only the Personal Training User view (D-20):** users set their own targets;
Coach and Head Coach are post-MVP.

## Current phase
**Fixing the owner's phone-test bugs (from 2026-11-04).** The redesign (D-35), household units
(D-36) and the profile (D-38) are merged into `main` (pull request #51, 2026-11-04). The owner
tests on the phone and reports bugs; each fix, or small group, is its own branch and pull request
off `main`. Data-loss and sync bugs first.

**Marks, accents, brand rows and plain foods in a search — built on branch `fix/search-marks` (D-86,
D-88, D-89 and D-91, 2026-11-12), in its own folder `D:\fitsphere-search-marks` (removed once
merged).** From the search QA report (QA-04, QA-09 to QA-12): D-91 lists the plain food the search
names first ("potato" finds IFCT's "Potato, brown skin, big" first: not a brand's or packaged, named as
typed, or with a part in brackets, or IFCT's with a comma; `plainFor` in `FoodSearchSheet.tsx`). Search
foods reads any mark typed as a space ("paneer!", "#biryani",
"egg+white" find what the words find), leaves out a word of marks alone ("aloo & gobi" as "aloo
gobi") and does not count marks towards D-72's three characters ("on!" as "on"); only % counts
("55%"). D-88: accents are ignored, typed or in names and brands ("nestle" finds Nestlé), in the exact
match and in telling brands apart too (D-78); phone schema version 21 clears the food list's version,
so each phone downloads the list once. D-89: a "N brands" row holds only foods alike in energy ("Gold"
is four rows) and counts a brand once however it is written (`brandKey` in `FoodSearchSheet.tsx`);
`docs/data/brand-names-sheet.csv` (747 rows, all approved by the owner on 2026-11-12) gives Open Food Facts' brands one
spelling or their maker, applied by `foods:import` (`apps/api/src/foods/brandNames.ts`) to approved
rows only. Never approve a row without the owner's word. The rule is `readName` and `withoutAccents`
in `apps/mobile/src/local/store.ts`; SQL (My foods, dishes) reads a keyboard's marks and the accented
letters the same way. No migration, no new build. **On `fitsphere-dev`: `foods:import` once rows are
approved; only when the owner says so.**

**Workout days in the header's calendar — built on branch `feat/calendar-workouts` (D-84,
2026-11-12), in `D:\fitsphere`.** Canvas boards `CalendarWorkouts*` C locked (version 89), then
`CalendarMealIcon*` B locked (version 93): no green days. The header's month calendar puts a green
apple (the Nutrition tab's icon) under each day with a meal and a green dumbbell under each day with a
workout Training lists, counts the month's workouts under its name ("3 workouts") and has a key under
the days; screen readers hear each day's meals and workouts. Log meal's calendar keeps its
dots. Phone app only: no server change, no migration, no phone schema change, no new build.

**Measurements due on Home — built on branch `feat/measurements-due` (D-85, 2026-11-12), on top of
`feat/calendar-workouts`, in `D:\fitsphere`.** Canvas boards `MeasurementsDue*` C locked (version 91).
On today, with none for today, Home's Measurements card says when measurements were last logged ("Last
logged 8 days ago, on Tue 20 Oct."); once more than 7 days have passed, or with none, a caramel "Due"
badge beside the title and Add measurements filled (`TextButton` `strong`). Past dates and Progress
unchanged. Phone app only: no server change, no migration, no phone schema change, no new build.

**An exercise's page: Progress, History and How to — built on branch `feat/exercise-details` (D-82,
2026-11-11), with D-81, in `D:\fitsphere-exercise-details`.** Plan: `docs/plans/exercise-details-page.md`
(Accepted), REQ-TRN-008; canvas boards `ExerciseDetail*` locked (version 79), `WorkoutIcons*` C chosen
(version 81). Progress in the bar at each workout exercise's foot (Progress, Edit, Remove, with words),
and How to do it in Add exercise, open the exercise's page
(`components/ExerciseDetailsPage.tsx`, a whole page over the screen; the numbers in
`src/exerciseStats.ts`): Progress (three records with their days, the workouts, a graph for 4W, 12W or
All; a lift's Est. 1RM, Heaviest or Volume), History (the bests on top, a lift's Best 1RM, Heaviest and Best volume, and as tags on each card's
date line; Load older)
and How to (the video, else the owner's default `EXERCISE_DEFAULT_VIDEO_URL`, opened outside the app;
the first place's steps, Watch for, muscles and equipment; "General guidance, not personal advice. Stop
if anything hurts."). `GET /v1/exercises` sends `details`; phone schema version 20. No migration beyond
D-81's 0028, no new build. Touching Progress's graph shows a workout's value in a bubble and its
numbers under the graph (canvas `ProgressTouch*`, C locked in version 87). **D-83, Workout in
progress** (backlog E-29; canvas `WorkoutRunningBar*`, B locked in version 87): while a workout's timer
runs or is paused, a pill above the tabs at the right, and over an exercise's page, shows it and opens
it (`components/WorkoutInProgress.tsx`, in `app/(tabs)/_layout.tsx`); one timer at a time: meanwhile
another workout's Start workout and Resume are greyed, saying why. An exercise logged twice on a day is
one card and one dot, its sets one after another.

**The exercise library's details — built on branch `feat/exercise-details` (D-81, 2026-11-11), in its
own folder `D:\fitsphere-exercise-details` (removed once merged).** The owner's
`Gym_Exercise_Library (1).xlsx` (kept outside the repository) gives each of the library's 2,090 rows
its primary muscle, muscles worked, equipment, tags, how-to steps 1 to 3, what to watch for and video
address (blank for now): `docs/data/exercise-library-details.csv`, made by
`npm run exercise-details:convert` and checked row by row against the review sheet, loaded by
`exercises:import` into `app.exercise_details` (migration `0028_exercise_details.sql`), one row per
library row, each place of an exercise with its own values, as the file writes them. Since D-82 the
first place's are sent to the phone for an exercise's How to. **On `fitsphere-dev`:
migration 0028 before `exercises:import`; only when the owner says so.**

**Each product once, and names that were only the brand — built on branch
`fix/search-one-per-product` (D-78 and D-80, 2026-11-11), in `D:\fitsphere`.** D-78 (phone only):
Search foods shows each branded product once, its brand label, its Open Food Facts barcodes and its
copies saved with no brand together (`onePerProduct` in `FoodSearchSheet.tsx`); the copy shown keeps
its own serving (D-56 could borrow another barcode's, which the server refused). D-80 (server data):
the packaged foods named only by their brand (131), then 8 more at the owner's word (a name and
brand swapped, "Maggi" under Nestlé, two colas at 0 kcal), are kept, renamed or left out as
`docs/data/packaged-name-fixes.csv` says (86, 7, 46 of 139), applied by `foods:import`. No migration, no
phone schema change, no new build. **On `fitsphere-dev`: `foods:import` again; only when the owner
says so.**

**Date strip, Monday to Sunday — built on branch `fix/week-strip-mon-sun` (D-79, 2026-11-11), in its
own folder `D:\fitsphere-weekstrip` (removed once merged).** Canvas boards `WeekStripMonSun*` locked
(version 75). The strip on Home, Nutrition and Training shows a week, Monday to Sunday (was 7 days
ending today, D-34); this week's days after today are greyed, cannot be picked and are "not
available" to screen readers; the arrows and swipes move a week at a time, within the 90 days.
Phone app only: no server change, no migration, no new build.

**Targets by date — built on branch `feat/target-history` (D-77, 2026-11-11), in its own folder
`D:\fitsphere-targets` (removed once merged).** Plan: `docs/plans/target-history.md` (Accepted),
REQ-ROLE-007, REQ-ROLE-018; canvas boards `TargetsDated*`, `TargetHistory*` and `HomeTargetsByDate*`
locked (version 73). A target change starts today and holds until the next; the days before keep
theirs (Home and Insight show each date's; the workout tracker its week's Sunday's; Progress today's).
Your targets says since when each value holds and opens Target history (`TargetHistoryScreen.tsx`,
route `target-history`): every change by day, or one target's values with their dates. The targets
set before hold from the day the account was created. Migration `0027_target_history.sql`
(`app.targets.day`, one row per user, kind and day); phone schema version 19 (`targets` keyed by kind
and day). No new build. **On `fitsphere-dev`: migration 0027 before the updated API; only when the
owner says so.**

**More measures for a food — built on branch `feat/food-measures` (D-76, 2026-11-11), in its own
folder `D:\fitsphere-measures` (removed once merged).** Plan: `docs/plans/food-measures.md`
(Accepted), REQ-LOG-007; canvas boards `FoodMeasures*` locked (version 71). The food page's Measure
wheel: a serving that holds several things also gives one of them ("2 slices" gives Slice, "Plate (4
pc)" gives Piece; 244 foods, added to `app.food_portions` by `foods:import`), and oz (28.35 g, a
serving named "oz") for every listed and packaged food; each measure shows its grams beside its name,
the food's own first, then Grams, then oz. No migration, no phone schema change, no new build. More
units for foods with none ("Part B") waits for the owner. **On `fitsphere-dev`: `foods:import` with
this API; only when the owner says so.**

**Meal insight — built on branch `feat/meal-insight` (D-70, 2026-11-10).** Plan:
`docs/plans/meal-insight.md` (Accepted), REQ-NUT-005, REQ-NUT-006, REQ-ROLE-007. Each logged meal's
card in Nutrition › Consumed has an Insight icon before Edit; the Insight page (`InsightScreen.tsx`,
route `insight`, the numbers in `src/insight.ts`) shows the day or a meal: its kcal against the daily
target (no budget per meal), protein, carbs, fat and fibre against their daily targets, and the top
foods. Your targets adds daily carbs (10–1,000 g), fat (5–500 g) and fibre (5–100 g), grouped under
Food and Activity and body. Migration `0024_nutrient_targets.sql`; no phone schema change, no new
build. **On `fitsphere-dev`: migration 0024 before the updated API; only when the owner says so.**

**Log meal holds the date's meals — built on branch `fix/log-meal-save-stay` (D-68, 2026-11-10).**
No "AI meal reading is coming soon" box; a meal tapped shows its foods on the date, to add to or
remove from; Save saves every meal changed and stays (the back arrow leaves); a green tick on each meal
with food (no step turns green); back, or another date, with changes not saved asks first. Editing
from a meal's pencil is unchanged. Phone app only: no server change, no migration, no new build.

**Workout timer — built on branch `feat/workout-timer` (D-71, 2026-11-10), in its own folder
`D:\fitsphere-timer` (removed once merged).** Plan: `docs/plans/workout-timer.md` (Accepted),
REQ-TRN-003, REQ-TRN-004; canvas boards `WorkoutTimer*` and `TrainingTimer*` locked (version 68). A
workout of today has **Start workout** in a bar at its foot; then the time in minutes and seconds,
Pause or Resume, and Mark done ("Done · total time", pauses left out; Resume today only); a timer
started can be finished after midnight; Training's rows say "Running", "Paused" or "Done" with the
time; a timed workout is listed before its first exercise but counts only with one (D-41). The time
comes from the clock (`app.workouts.timer_*`, migrations `0025_workout_timer.sql` and `0026_workout_timer_count.sql`; phone schema
version 18, `workouts.timer`). No new build. **On `fitsphere-dev`: migrations 0025 and 0026 before the updated
API; only when the owner says so.**

**Training tab: By day and All workouts — built on branch `feat/training-tab` (D-65, 2026-11-10),
in its own folder `D:\fitsphere-training` (removed once merged); on top of D-63.** The date strip at
the top of Training (a green mark on each workout day) replaces the date chip; "By day" shows the
selected date's workouts under "Log workout for <date>"; "All workouts" groups the history by month,
the newest open, the others folded. No "No training plan yet" card for now; a workout with no
exercise is not listed (Training, Home's day sheet) nor counted when numbering. Phone app only: no server
change, no migration, no new build.

**Exercise library — built on branch `feat/exercise-library` (D-67, 2026-11-10), on top of
`feat/training-tab`, in `D:\fitsphere-training`.** Plan: `docs/plans/exercise-library.md` (Accepted),
REQ-TRN-003. The owner's `Gym_Exercise_Library.xlsx` (from the owner's AI tool, kept outside the
repository) joins the exercise list through the review sheet `docs/data/exercise-library-sheet.csv`:
1,832 new exercises (47 replacing ours, our names kept as other names), 2,119 in all, each with its
places (category and sub-group; `app.exercises.places`, migration `0022_exercise_places.sql`, phone
schema version 16). The exercise sheet, now a whole page with a back arrow, has Category and
Sub-group to narrow the search. **On
`fitsphere-dev`: migration 0022 before the updated API, then `exercises:import`; only when the owner
says so.**

**Exercise list — built on branch `feat/exercise-list` (D-50, 2026-11-05).** Plan:
`docs/plans/exercise-list.md` (Accepted), REQ-TRN-003; screens 4.1 to 4.3 locked. The exercise sheet
searches FitSphere's own list of 334 exercises (`data/exercises/exercise-list.csv`, `app.exercises`,
migration `0016_exercises.sql`, `npm run exercises:import`, `GET /v1/exercises`, phone schema version
13), each with one of eight types (weights needed on every set; no weight for bodyweight; timed sets;
cardio with distance, a treadmill's speed and incline, a machine's level); each set on its own row; a
name of the user's own asks "Log as". Exercises saved before read as identical sets. Step 3, on
branch `feat/calories-burned` (off `feat/exercise-list`): calories burned (the 2024 Adult Compendium's
METs, by speed for running, walking and cycling, `data/exercises/speed-mets.csv`, migration
`0017_exercise_speed_mets.sql`, phone schema version 14; typed in place of the estimate;
`docs/data/exercise-list-sources.md`, accepted risk R-011, Legal L-17; Training tab only, not Home)
and heart rate. **On `fitsphere-dev`: migrations 0012 to 0017 before the updated API, then
`foods:import` and `exercises:import`; only when the owner says so.**

**Create a saved meal — built on branch `feat/saved-meal-create` (D-69, 2026-11-10).** Nutrition ›
Saved's "Create a saved meal" asks the name first, then a screen adds foods from Search foods and
changes them (`SavedMealScreen.tsx`, route `saved-meal`; the foods code shared with Log meal in
`components/MealFoods.tsx`). A saved meal keeps no meal: logging one asks the meal each time, with
"Change amounts first" opening Log meal with its foods for that day only. The same foods are never
saved twice. REQ-SAVED-001…003. Migration `0023_saved_meals_any_meal.sql`, phone schema version 17;
the exercise library's 0022 and phone version 16 (D-67) are included word for word. Migration 0023
is applied on `fitsphere-dev` (2026-11-10).

**More foods — built on branch `feat/more-foods` (D-39, 2026-11-04).** Plan: `docs/plans/more-foods.md`
(Accepted), REQ-LOG-011. USDA FoodData Central's FNDDS foods (CC0, 5,431, with their servings as USDA
weighs them) joined IFCT's in the food list; since D-47 they are archived (`app.usda_foods`, migration
0013), not served: Indian food data only. Your own food takes a unit and
quantity and can be saved to My foods. Migration `0011_more_foods.sql`, sync changes `myFood.set` and
`myFood.delete`, phone schema version 10. `npm run usda:convert` makes `data/foods/usda-fndds-*.csv`
from USDA's download (kept outside the repository). **On `fitsphere-dev`: migration 0011 before the
updated API, then `foods:import`; only when the owner says so.**

**AI-estimated brand labels — merged (pull request #70, D-53, 2026-11-06); 63 more on branch
`feat/llm-brand-labels-2`.** 408 rows
from the owner's files of an AI tool's estimates (not read from any label), approved by the
owner; flag `llm`, no page; plus twelve web-read rows flagged `scrap` (six of them replaced `llm`
estimates at the owner's word); products already in the database left out. The sheet holds 630
brand labels. Shown
like the other brand labels (the owner's choice; risk R-012). Migration `0019_food_flag_llm.sql`.
**On `fitsphere-dev`: migrations 0018 and 0019 applied and `foods:import` run (2026-11-06); after
this branch, `foods:import` again; only when the owner says so.**

**Home-style foods — built on branch `feat/home-foods` (D-59, 2026-11-06).** The everyday forms of
daily foods (a bread slice, butter toast, bread omelette) as source `home`, from the owner's files of
an AI tool's estimates, one food item at a time, in `docs/data/home-foods-sheet.csv` (flag `llm`);
92 so far (bread, roti, naan, kulcha and paratha). Listed in Search foods right after an exact match, untagged; logged in grams
or by their serving. Migration `0020_home_foods.sql`, risk R-013, Legal L-18. **On `fitsphere-dev`:
migration 0020 before the updated API, then `foods:import`; only when the owner says so.**

**Estimated dishes — built on branch `feat/estimated-dishes` (D-62, 2026-11-10).** 5,025 Indian
dishes from the owner's dish database (`Indian_Food_Database_MASTER.xlsx`, kept outside the
repository) as source `dish_estimate`, each with its type of dish's typical values and serving, in
`docs/data/dish-estimates-sheet.csv` (flag `llm`); 1,778 rows held back with their problem (1,259
weak matches, 519 whose type does not fit the dish). Listed after the dishes, before IFCT, marked
"estimated", found by their base food. Also 11 packaged products (`data/foods/off-india-extra.csv`),
and Search foods ignores marks and finds words typed together ("haldirams" finds Haldiram's). Migration
`0021_dish_estimates.sql`, risk R-014, Legal L-19. **On `fitsphere-dev`: migration 0021 before the
updated API, then `foods:import` (the owner's word, 2026-11-10).**

**Search order — built on branch `fix/search-order` (D-54, 2026-11-06), on top of
`feat/llm-brand-labels`.** Search foods: an exact match first (D-51), then My foods, brand labels,
packaged foods, INDB, then dishes and IFCT. Phone app only; no new build. Also on this branch (D-55):
hidden search words on brand labels (the sheet's `search_words` column, kept as aliases), so
"whole wheat atta" finds a "Chakki Atta", and group words ("pulses", "dairy", "spices") find the
whole group; needs `foods:import` again, no migration. Also (D-56): a packaged product listed under
several barcodes with the same brand, name and values shows once in search (phone only).

**More brand labels — merged (pull request #69, D-52, 2026-11-06).** 187 more rows
approved by the owner (dairy, grains, biscuits, masalas, oils, breakfast, noodles), from brands' sites,
shops' listings and the owner's files from another AI tool; each has `flag` `scrap`, a column kept on
the server only (`app.foods.flag`, migration `0018_food_flag.sql`), never sent to the phone, read by
nothing yet. No phone schema change. **On `fitsphere-dev`: migration 0018 before the updated API,
then `foods:import`; only when the owner says so.**

**Brand labels — built on branch `feat/brand-labels` (D-49, 2026-11-04).** Brands' own published
labels in `docs/data/brand-labels-sheet.csv`, read from the brand's or manufacturer's own website
first, then (D-52) a shop's listing of the product or the owner's files from another AI tool, each
row `proposed` until the owner approves it; approved rows join the food list as source
`brand_label`. Never approve a row without the owner's word; never fill a row from a model's
memory yourself (D-53: an AI tool's estimates come only in the owner's files, flagged `llm`). Migration `0015_brand_labels.sql`, phone schema version 12. Risk R-010, Legal L-16.
**On `fitsphere-dev`: migrations 0012 to 0015 before the updated API, then `foods:import`; only when
the owner says so.**

**Packaged foods — built on branch `feat/packaged-foods` (D-48, ADR-0009, 2026-11-04).** Open Food
Facts' products sold in India (9,764 with usable label values) are searchable by name and brand,
tagged "Packaged", in their own table `app.packaged_foods` (migration `0014_packaged_foods.sql`) and
on the phone (schema version 11); logged as barcode products, in grams or by their serving.
`npm run off:convert` makes `data/foods/off-india-products.csv` from Open Food Facts' export (kept
outside the repository). Legal asked about ODbL share-alike (L-13). **On `fitsphere-dev`: migrations
0012 to 0014 before the updated API, then `foods:import`; only when the owner says so.**

**Indian food data only — built on branch `feat/indian-only` (D-47, 2026-11-04).** USDA's foods leave
the food list for an archive (migration `0013_usda_archive.sql`); search shows dishes, INDB, IFCT and
My foods. **On `fitsphere-dev`: migrations 0012 and 0013 before the updated API, then `foods:import`;
only when the owner says so.**

**Indian recipes — built on branch `feat/indb-foods` (D-46, 2026-11-04).** The Indian Nutrient
Databank's 1,014 recipes join the food list, tagged "INDB", values estimated, each opening on its
serving; credited behind Search foods' i. No licence is stated for INDB's data: accepted risk R-009,
Legal asked (L-15). Migration `0012_indb_foods.sql`, no phone schema change. `npm run indb:convert`
makes `data/foods/indb-*.csv` from `INDB.xlsx` (kept outside the repository). **On `fitsphere-dev`:
migration 0012 before the updated API, then `foods:import`; only when the owner says so.**

**Profile — merged (pull request #51); migration 0010 applied on `fitsphere-dev` by the owner
(D-38, 2026-11-03 to 2026-11-04).** Plan: `docs/plans/user-profile.md` (Accepted), REQ-ACC-011. Settings
opens with a Profile card; the Profile screen keeps the user's photo, name, date of birth (18 or
older), sex, height (mm), phone (+91) and address, all optional, with the latest weigh-in and the
email read-only. Migration `0010_profiles.sql` (`app.profiles`, `app.media.kind`), sync change
`profile.set`, phone schema version 9. Any other database needs migration 0010 before this API
runs. Legal reviews the new data before real users (Q-049, L-07a).
The redesign's module 6 (6.1 to 6.6) is locked and built.

**Household units — merged (pull request #51); the owner's measurements pending (D-36,
2026-11-03).** Plan: `docs/plans/household-units.md` (Accepted). A listed food can be logged in a
teaspoon, tablespoon, katori, glass or piece once the owner has measured it in
`docs/data/household-measures-sheet.csv`; the starter rows are `pending` with no grams. Never fill
in or approve a row without the owner's measurements. Migration 0009 and `foods:import` ran on
`fitsphere-dev` on 2026-11-03 at the owner's go (0 units: no row approved yet). After approving
rows, run `foods:import` again.

**UI refresh — merged (pull request #50; D-33, D-34; 2026-11-02 to 2026-11-03).** Since restyled
again by the redesign (D-35). It was: the app restyled screen by screen and sheet by
sheet (TextButton, Field, the shared Sheet and FormScreen frames, one pill style, one Cancel
standard, scrim tokens), then the changes from the owner's two phone reviews: D-33 (an icon
package, `@expo/vector-icons`, JavaScript only and needing no new build; meal-card icons in place
of the ••• menu; Log meal's date as a calendar; clearer validation messages) and D-34 (Home's
workout days open their workouts; Training shows one card per date; the date strip shows 7 days
ending today; a food added again can join the one already in the meal; the calendar browses ahead;
weight ranges 1W, 1M, 3M, 6M and All; meal slots fold). Every automated check passes on the branch.
The owner checks it on the phone, then says when to push and open the pull request; CI has not run
on it yet. The rules and policy documents in `docs/prerequisitesDoc/` merge with it.

**Slice 5, Progress — merged; phone checks deferred to before the release (D-30, D-32;
2026-10-31).** Plan: `docs/plans/progress-slice.md` (Accepted). Built in parallel with slice 6, one
pull request per step: #41, #42 and #44, merged on 2026-10-30. Progress only reads existing data:
no server change, no migration, no phone schema version. Colours come from slice 6's
`src/theme.tsx` (`useTheme().colors`), and body weights go through `useProgressWeightUnit()`, which
returns slice 6's `useBodyWeightUnit()`. Every automated check passes on the merged main; no check
has been run on a phone: the 7 checks are backlog S5-01 to S5-07, mandatory before the release
(accepted risk R-006), on the current development build.

**Slice 3, Meal logging (no AI) — merged; dish recipes and phone checks pending (D-26,
2026-10-29; D-28, 2026-10-30).** Plan: `docs/plans/meal-logging-slice.md` (Accepted). Every step is
merged: steps 1 to 7 and the close-out (pull requests #18 to #32, 2026-10-29), and step 8 (dishes,
#38, with #33 to #37 and #39, 2026-10-30): the dish import, `GET /v1/foods` dishes and logging
dishes in portions. On `fitsphere-dev`, migrations 0002 to 0005 and `foods:import` are applied;
photo storage (private bucket `meal-photos`, S3 connection and access key) is configured and passed
`check:storage` 8 of 8 from the PC; `OFF_CONTACT` is set. Still open: migrations 0006 and 0007
(slice 4's) and `foods:import` on `fitsphere-dev`, run by the owner; the phone checks in the plan,
on the new EAS development build (approved 2026-10-29); and the recipes. A dish goes live only when
its row in `docs/data/standard-recipe-sheet.csv` is measured and marked `approved` by the owner
(starter set first: boiled egg, roti, phulka, plain rice, toor dal, moong dal, aloo gobi, idli,
plain dosa). Until then no dish values exist. Never fill in or approve a recipe row without the
owner's measurements; the chicken curry stays `blocked`.

**Slice 4, Training — merged; migration and phone checks pending (D-29, 2026-10-29).** Plan:
`docs/plans/training-slice.md` (Accepted). Built in parallel with slice 3, rebased onto its step 8
and merged on 2026-10-30: steps 1 to 4 are pull requests #23, #25, #27 and #28. The migration is
`0007_workouts.sql`, the phone schema version 6 and the IDs D-29 and E-14 to E-17. Still open:
migration 0007 on `fitsphere-dev` (after slice 3's 0006), run only when the owner says so; then the
slice's batched phone checks, on the current development build (no new build).

**Slice 6, Settings and account — merged; the owner's set-up pending, phone checks deferred to
before the release (D-31, D-32; 2026-10-31).** Plan: `docs/plans/settings-slice.md` (Accepted).
Built in parallel with slice 5 in the worktree `D:\fitsphere-settings`, one pull request per step:
#43 and #45 (merged 2026-10-30), #46, #47 and #48 (merged 2026-10-31). Migration
`0008_settings.sql` and phone schema version 7. Slice 6 owns the theme module
(`apps/mobile/src/theme.tsx`) and the unit hooks (`apps/mobile/src/settings/SettingsProvider.tsx`)
that Progress reads. Deleting the sign-in account uses a Supabase secret key on the server only
(`SUPABASE_SECRET_KEY`, D-31 answer 4). Still open, done by the owner and only when the owner says
so: the secret key in `apps/api/.env`, and migrations 0006 to 0008 on `fitsphere-dev` (one
`npm run migrate -w @fitsphere/api`). Every automated check passes on the merged main; no check has
been run on a phone: the 9 checks are backlog S6-01 to S6-09, mandatory before the release
(accepted risk R-006), on the current development build.

**Slice 2, Home and daily tracking — built, waiting for the owner (D-23, 2026-10-29).** Plan:
`docs/plans/home-daily-tracking-slice.md` (Accepted). Steps 1 to 7 (pull requests #11 to #17) are
merged; step 8 (D-24: the Measurements card shows and edits a date's measurements, changing Q-026)
is its own pull request. Then the owner applies migration 0002 to
`fitsphere-dev` (`npm run migrate -w @fitsphere/api`) and runs the slice's batched phone checks,
starting the API, the tunnel and Expo with `npm run dev:phone` (D-22). One branch and pull
request per step; CI must pass before merge.

**Skeleton slice — done with deferred checks (D-22, 2026-10-29).** Steps 1 to 10 are merged
(`docs/plans/skeleton-slice.md`). Its pending phone checks are backlog SC-01 to SC-13, to run
before the release (accepted risk R-006).

**Builds and devices (D-19).** No Android Studio, emulator or local Android builds. Development
builds come from EAS Build (`development` profile) and run on the owner's phone. Rebuild only when
native code changes, and **tell the owner before every cloud build** (free plan: 15 Android
builds a month). Live code: `npx expo start --dev-client --tunnel`. Checks that need a cable are
marked "USB + adb". The phone reaches the API on the PC through a Cloudflare Quick Tunnel, only
while testing, with test data only, closed after use; **never commit the tunnel's address**
(D-19 answer 6, runbook step 8).

**Personal Training User only (D-20).** No Coach or Head Coach roles, invitations, links, Head
Coach permission, Notifications list or push in the MVP; the role selector is hidden. Keep the
data model able to add links later without rework, but build no link or permission features or
screens. Authorization tests cover self-access and "no other user's data". Slices, in order:
Skeleton; Home and daily tracking; Meal logging (no AI); Training; Progress; Settings and
account; AI meal reading; Release (`mvp-scope.md` section 5).

**MVP first (D-18).** Build the basic product in `docs/product/mvp-scope.md`, Android first.
Post-MVP work and deferred edge cases go to `docs/product/backlog.md`. When an open question
that does not block safety or privacy has no answer, pick the simplest option that keeps every
invariant, record it as an "MVP default" in the pull request and in
`docs/architecture/constraints-and-assumptions.md`, and continue without asking. Never weaken
the invariants, owner decisions, privacy rules or accepted ADRs; those need the owner.

Approved stack:
- Mobile client: React Native with Expo, TypeScript (ADR-0001, Accepted — D-12).
- Backend: a TypeScript Node.js API, the only path to the data; Supabase's Data API is turned
  off (ADR-0002, Accepted — D-17).
- Database and file storage: Supabase PostgreSQL and Supabase Storage in Mumbai, on the Free
  plan in phase 1 with no backups (ADR-0002, ADR-0003, Accepted — D-17; D-16, R-005).
- API host: Google Cloud Run in Mumbai once Q-087 is settled; until then the API runs locally.
- Sign-in and authorization: Supabase Auth, with every request authorized by one access module
  in the Node API; email through Resend from a domain FitSphere owns (still required at the MVP
  release, D-20); Expo push, post-MVP (ADR-0004, Accepted — D-18).
- AI meal reading: Gemini 3.1 Flash-Lite on the paid tier, through one AI module; voice is
  recognised on the phone only (ADR-0005, Accepted — D-18). Paid use needs the owner's sign-off
  on billing and the monthly cap (C-008, Q-087).
- Food data: FitSphere's own food list plus Open Food Facts for barcodes (ADR-0006, Accepted —
  D-18), and Open Food Facts' Indian products for search by name and brand (ADR-0009, Accepted —
  D-48).
- Offline: Expo SQLite on the phone, an outbox and one sync endpoint (ADR-0007, Accepted — D-18).

The validation steps of ADR-0001 to ADR-0007 run in the first slices.
Not approved yet: audio/video media storage (ADR-0008).
Do not scaffold an app, add dependencies or pick frameworks until the relevant ADRs in
`docs/architecture/decisions/` are marked **Accepted** by the decision owner.

## Before real users
Release-blocking, not done yet (D-22; backlog "Release-blocking tasks"). Do them only when the
owner says so:
- RB-01: delete the GitHub copy of the branch `local/test-no-email`, which holds a test password.
  Leave the owner's local branch alone.
- RB-02: delete the Supabase test user that uses that password.
- RB-03: make sure Supabase **Confirm email** is on.
- RB-04 (D-31): the owner's logged admin path for deleting an account on an emailed
  request, then publishing the deletion page (`docs/legal/account-deletion-page.md`).
- RB-05 (D-82): a qualified person checks the exercises' How to text (the AI tool's steps and
  "Watch for", R-015).

Also before the release: the Skeleton checks SC-01 to SC-13 (R-006); the Progress and Settings
checks S5-01 to S5-07 and S6-01 to S6-09 (D-32, R-006); Legal's review (Q-049); and email through
Resend from FitSphere's domain (D-20).

## Sources of truth
- Documentation index and status: `docs/README.md`
- Product scope: `docs/product/product-brief.md`
- MVP scope and defaults (D-18, Accepted): `docs/product/mvp-scope.md`
- Backlog (post-MVP items, deferred edge cases): `docs/product/backlog.md`
- Requirements (REQ IDs): `docs/product/requirements.md`
- User journeys: `docs/product/user-journeys.md`
- Constraints, assumptions, open questions, risks (C-/A-/Q-/R- IDs): `docs/architecture/constraints-and-assumptions.md`
- Owner decisions (D- IDs, Accepted): `docs/product/owner-decisions-2026-10-27.md`
- Glossary: `docs/product/glossary.md`
- System context (Draft): `docs/architecture/system-context.md`
- Data and threat model, including the permission matrix (Draft): `docs/security/data-and-threat-model.md`
- System flows: `flow.md`
- Decisions: `docs/architecture/decisions/`
- Always-on invariants: `.claude/rules/project-invariants.md`
- Original business requirements (input, not edited): `docs/product/source/business-requirements.txt`
- Food list sources (IFCT 2017; used without NIN permission, D-25, accepted risk R-007), and
  dishes from FitSphere's standard-recipe sheet (D-26, amended): `docs/data/food-list-sources.md`,
  `docs/data/standard-recipe-sheet.csv`; brands' own labels (D-49): `docs/data/brand-labels-sheet.csv`
- Source documents read for the food data, for Legal's review (Q-049): `docs/sources/README.md`
  (the PDFs are kept outside the repository)
- Brief for Legal's review (Q-049), with the questions and the evidence checklist (not yet
  reviewed by Legal): `docs/legal/q-049-legal-brief.md`
- Contracts for the Skeleton slice (Draft): `docs/contracts/data-model.md`, `api-conventions.md`,
  `error-model.md`
- Verification (Accepted with the Skeleton plan): `docs/quality/test-strategy.md`, `definition-of-done.md`
- Current slice plan (Accepted): `docs/plans/progress-slice.md` (slice 5, built beside slice 6);
  `docs/plans/meal-logging-slice.md`; slice 4, built in parallel: `docs/plans/training-slice.md`;
  slice 6, built in parallel with slice 5: `docs/plans/settings-slice.md`; earlier slices:
  `docs/plans/home-daily-tracking-slice.md`,
  `docs/plans/skeleton-slice.md`
- Runbook (Draft — local setup, configuration names, paused project): `docs/operations/runbook.md`

If a referenced document does not exist, state that it is missing; do not invent its contents.

## Design source of truth
The app's design language (D-35, 2026-11-03). Follow it for UI work:
- `docs/design/design-system.md`: the brand palette, colour tokens for dark and light, type
  styles, shape, spacing and components.
- `docs/design/FitSphere-UI-UX-context.md`: the visual direction, components, the app-shell
  pattern, UX principles and copy rules. Its sections 5 (locked screens), 7 (decisions) and 8
  (tech choices) belong to the reference design and are examples only.

Examples only: `docs/design/reference-fitsphere/` (the `F0x-*-ui.md` files; see its README). Do
not build their features or apply their decisions here. What to build still comes from
`docs/product/` and the slice plans.

The project's rules come first: where a design file conflicts with an invariant, an owner
decision or an accepted ADR, those win and the conflict goes to the owner. Settled by D-35: the
icons are Lucide (`lucide-react-native`, in place of `@expo/vector-icons`; it needs
`react-native-svg` and so a new development build, so tell the owner before building), and the
fonts are Barlow Condensed and Barlow (`@expo-google-fonts/*`, no new build). "The user's time
zone" means Asia/Kolkata here (invariant 5). The redesign follows `docs/plans/ui-redesign.md`: each
screen is designed on the owner's canvas, locked by the owner, then built; the app's colours, fonts
and icons switched with the first screen, 1.1 Sign in (branch `ui-redesign`). Build only
locked screens.

## Working rules
1. Inspect the actual repository before proposing changes.
2. Read relevant requirements, rules, contracts and accepted ADRs before implementation.
3. Do not invent requirements, provider capabilities, benchmark results or security guarantees.
   If the requirements are ambiguous, check the Q- list and `mvp-scope.md`. Apply D-18 to
   questions that do not block safety or privacy; ask about the rest. Never guess silently.
4. For major choices, compare options against documented constraints and obtain human approval.
5. Do not silently change an Accepted ADR; propose a replacement ADR.
6. Treat health, body and meal data as sensitive in code, logs, tests, fixtures and output.
   Use synthetic data only.
7. Add or update tests for behavior changes.
8. Run relevant checks and report exactly what passed, failed or was not run.
9. Update the authoritative document when a requirement, contract or decision changes.
10. Prefer small, reviewable changes, each traceable to REQ IDs.

## Before coding
For non-trivial work: inspect first, prepare a plan that cites REQ IDs, identify risks and
tests, and wait for approval.
