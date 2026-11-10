# Exercise library plan

- Status: **Accepted** (the owner, in chat, 2026-11-10: "approve, lock it")
- Owner: Project owner (D-01)
- Last updated: 2026-11-10
- Builds on: D-50 (the exercise list, its eight types and the Compendium's METs), D-63, D-65 (the
  Training tab), the redesign's locked 4.3 (the exercise sheet). Decision D-67
- Requirements: REQ-TRN-003, REQ-TRN-004
- Design: the canvas's "4.3 Exercise sheet · PROPOSED: Category and Sub-group" (boards
  `ExerciseLibrary` and `ExerciseLibraryStates`, version 48; locked)
- Review sheet: [`docs/data/exercise-library-sheet.csv`](../data/exercise-library-sheet.csv), for
  the owner to check

## What the owner asked
2026-11-10: "In the d:/fitssphere-data I have added a new file: Gym_Exercise_Library. reads it and
Dumped it into our Fitsshere excesice database. SO that when the USer search for it. It can see the
Rssult." Then:
1. Two new dropdowns in the exercise sheet, Category and Sub-group, as the file's sheets have them.
   Category shows the categories; Sub-group shows all the sub-groups. The category chosen decides
   the sub-groups offered, and both decide the exercise names found. The name can still be searched
   with neither chosen.
2. The exercises already in our list keep an empty category and sub-group for now.
3. Where the new list cannot estimate calories, the field stays empty and the user types the value.
4. For each new exercise we decide whether it needs sets, a timer or other values, and write a CSV
   for the owner to check.

## The file
`D:\fitsphere-data\Gym_Exercise_Library.xlsx` (kept outside the repository, 152,944 bytes): a
summary, the tab "All Exercises" (2,090 rows: number, category, sub-group, exercise) and one tab
per category with the same rows. 39 categories, from Barbell to Rehab / Prehab / Corrective; 59
sub-group names (Chest, Legs, Snatch Family, Anti-Extension / Plank...). 20 categories have no
sub-groups: the file says "All", which the app shows as "No sub-groups".

## The review sheet
`docs/data/exercise-library-sheet.csv`, one row per row of the file, in its order:

| Column | What it holds |
|---|---|
| `row`, `category`, `sub_group`, `name` | The file's row number, category, sub-group (empty for "All") and name |
| `status` | `new`; `repeat of row N` (the same exercise listed again in another place: one exercise, found under both); or `in our list as <name>, gets this place` (already in FitSphere's list, by name or another name: that exercise takes this row's category and sub-group) |
| `code` | The exercise's key; for a repeat or one already in our list, that exercise's |
| `group` | The group the list already shows (barbell, dumbbell, cardio...), from the category |
| `log_type`, `why` | How it is logged, one of the eight types (below), and why |
| `compendium_code`, `met` | The 2024 Compendium activity its calories are estimated with, or empty: no estimate, calories typed |
| `aliases` | For a new exercise that replaces one of ours, our exercise's name and other names, so old workouts and searches still find it |
| `near_duplicate` | For the 84 new names that looked like one of ours, and 5 more found by hand: "replaces our …", "the same as our …, listed in another category" or "kept apart from our …" |
| `note` | A renamed exercise and why |

What it holds now:
- **1,832 new exercises**, **41 repeats** and **217 rows already in our list**. 47 of the new ones
  replace one of ours (the owner's answer 4), so our list goes from 334 to 287, and the whole list
  from 334 to 2,119. The 217 rows give 187 of our 287 exercises a category and sub-group (some are
  listed twice); the other 100 keep none.
- How the new ones are logged: weight and reps 710, reps 511, time 408, time only 82, weight and
  time 70, distance and time 29, cardio machine 20, treadmill 2.
- **Calories:** 1,564 of the new ones get an estimate. Each uses one of the Compendium activities
  our list already uses, all checked against the Compendium's table on 2026-11-05, under the same
  rules (lifting 02054; squats and deadlifts 02052; Olympic lifts 02050; carries 17019; push-ups
  and lunges 02022; core 02024; jumps 02214; burpees and battle ropes 02020; stretching 02101;
  yoga 02175; Pilates 02103 and 02105; swimming strokes, machines, classes and runs as named).
  **268 have none**: sled work, skills (levers, planches), boxing drills, agility drills, foam
  rolling, rehab, most branded classes. Their calories field stays empty, and the sheet says, as
  today, "This exercise has no estimate: type the number from your machine or watch."
- **7 renamed**, so no two exercises share a name:
  - "Swimming", "Criss-Cross", "Hip Circles" and "Jackknife" under Pilates become "… (Pilates)",
    since each is another exercise of the same name.
  - "Warrior I", "Warrior II" and "Warrior III" become "Warrior 1", "Warrior 2" and "Warrior 3".
    The search counts a doubled letter once ("Dumbell" finds "Dumbbell"), so "II" would read as
    "I".
- **Names are kept as the file writes them** ("Barbell Flat Bench Press"), though our list writes
  "Barbell bench press". Changing their case would spoil names like EZ-Bar, RDL, SSB and HYROX.

The owner checks the sheet and changes any `log_type`, `compendium_code` or name in it. Nothing is
imported until the owner says so.

## How each exercise is logged (unchanged, D-50)
| Type | Fields |
|---|---|
| `weight_reps` | Each set: reps and a weight, both needed |
| `reps` | Each set: reps; no weight field |
| `time` | Each set: a time |
| `weight_time` | Each set: a weight and a time (carries, sled, loaded holds) |
| `distance_time` | A time and a distance; the speed and pace shown |
| `treadmill` | A time, speed, incline and distance |
| `cardio_machine` | A time, distance and level |
| `time_only` | A time (classes, workout formats such as AMRAP or "Murph") |

## What the user sees (the canvas)
- Above "Exercise name", side by side: **Category** ("All categories") and **Sub-group** ("All
  sub-groups"). Each opens a list under it, with each choice's count and a tick on the chosen one.
  "All categories" or "All sub-groups" clears the choice.
- **Sub-group** with no category lists all 59 sub-group names, A to Z. "Chest" then finds the chest
  exercises of every category. With a category, it lists only that category's sub-groups. For a
  category without sub-groups it reads "No sub-groups" and cannot be opened. Changing the category
  clears a sub-group it doesn't have.
- With a category or sub-group chosen and no name typed, the exercises in it show at once ("Barbell
  · Chest · 20 exercises"). Typing narrows them ("19 matches in Barbell · Chest"). The name field's
  placeholder says what it searches ("Search Barbell · Chest").
- Each match shows what isn't chosen yet: with nothing chosen, its category and sub-group ("Core /
  Abs · Plank"); with a category chosen, its sub-group; with both chosen, nothing. An exercise of our
  list without a category keeps its group ("Bodyweight").
- No match in the choice: "No exercise in Barbell · Chest matches "curl". Search them all, or keep
  your own name." with **Search all categories**, which clears both. A name of the user's own still
  saves with "Log as" (D-50).
- Picking an exercise works as today: its type's fields, then calories (estimated, or typed when it
  has none) and heart rate.
- The choices are not saved with the workout, which keeps each exercise's name only (D-50). They
  reset each time the sheet opens. Editing an exercise opens with none chosen.

## How it is built
Each step is its own branch and pull request. All of them stay in `D:\fitsphere-training`, after
the Training tab work (D-65) is committed on `feat/training-tab`.

1. **Server: the library and its places** (branch `feat/exercise-library`).
   - Migration `0022_exercise_places.sql` gives `app.exercises` a column `places` (jsonb, default
     `[]`): every category and sub-group an exercise is listed under. An exercise in two places,
     such as Push Press under Barbell › Shoulders and Olympic Weightlifting › Jerk Family, is one
     exercise with two places.
   - `exercises:import` also reads `docs/data/exercise-library-sheet.csv`. A `new` row adds an
     exercise; a `repeat` row adds a place to it; a row already in our list adds its place to our
     exercise (the owner's answer 2). The import keeps today's checks (no two names or
     other names alike, types and codes valid) and adds three: a code and MET only from the
     Compendium activities the list already uses; a category and sub-group on every new row; and
     the sheet's counts.
   - `GET /v1/exercises` sends each exercise's `places`. An older phone ignores the field, and it
     still gets the new exercises in its search.
2. **Phone: the pickers** (on top of step 1).
   - Phone schema version 16 adds `places` and a searchable `place_keys` to the phone's exercise
     table, and clears the list's version so it downloads again. Version 15 is taken by
     `fix/search-no-cap`, so that branch merges first.
   - The exercise sheet gets Category and Sub-group, the list shown with no name typed, the
     matches' tags and "Search all categories". The search keeps today's rules: every word typed must
     match, ignoring case, hyphens and doubled letters.
   - JavaScript only: no new build.
3. **Docs:** D-67; REQ-TRN-003; `docs/data/exercise-list-sources.md` (the library and its source);
   the data model; `CLAUDE.md`; the slice-4 phone test guide.

**On `fitsphere-dev`:** migration 0022 before the updated API, then `exercises:import`; only when
the owner says so.

## Tests
- Import: the sheet's rows load as 1,833 new exercises with their places and 39 extra places. It
  refuses a sheet with a duplicate name, an unknown type or category, or a code the list doesn't use.
- API: `places` sent; an exercise with two places listed once.
- Phone: the sub-groups follow the category; the list shows with no name typed; typing narrows within
  the choice; "Search all categories" clears both; an exercise without a MET shows no estimate and
  takes typed calories; an older exercise without places still shows with no choice made.
- Every existing check: lint, types, mobile and API tests, CI.

## Risks
- **Size:** 2,119 exercises instead of 334: about 500 KB of JSON, downloaded once per list
  version, then searched on the phone with SQLite as today. Watched in the phone checks.
- **Near-duplicates:** 84 new names look like ones we have (marked `maybe_same_as`). Both show in
  search until the owner merges or drops one in the sheet.
- **Source of the file:** the owner's AI tool (the owner's answer 3), recorded in
  `exercise-list-sources.md` for Legal (Q-049), as for the AI tool's food estimates (D-53). It holds
  only exercise names, categories and sub-groups, which are everyday words, as for our own list
  (D-50). Types and METs are FitSphere's own choices, from the Compendium.
- **METs:** copied unchanged from the 2024 Compendium, as before (R-011, L-17); no new activity
  codes.

## The owner's answers (in chat, 2026-11-10)
1. **The 39 repeats:** "Allow the sme excercise to the different category for now": one exercise,
   found under each of its places.
2. **The 218 rows already in our list:** "these are already in our list so you can copy paste these
   category and subgroup": our exercise takes the file's category and sub-group. This replaces the
   first request's "leave the category and sub group value empty" for these exercises; the others
   stay empty for now.
3. **The file's source:** "The file come from My AI tool".
4. **The 84 names that looked like ours:** "Keep the only one from the new Excel sheet". Each pair
   was checked by hand:
   - **47** are the same exercise: the sheet's replaces ours ("Barbell Flat Bench Press" for
     "Barbell bench press", "Standard Push-Up" for "Push-up"). Five of these were found by hand:
     Seated Dumbbell Shoulder Press, Front Plank (Forearm), Elliptical Cross-Trainer and the two
     Aerobics. Ours leaves the list; its name and other names become the new one's other names, so a
     workout saved as "Push-up" still finds it. One of our other names that is another exercise of
     the file ("power snatch", "crab walk") is not moved: Power Snatch and Crab Walk are exercises of
     their own.
   - **3** are our exercise listed in another category (Cable pull-through, Pallof press, Jumping
     lunge): ours keeps its name and takes that place too.
   - **37** are another exercise or a variant ("Standing Leg Curl" and our "Lying leg curl"; "Back
     Squat (Low Bar)" beside "Back Squat (High Bar)"): both stay.
