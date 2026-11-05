# Exercise list plan

- Status: **Accepted** (the owner, in chat, 2026-11-05: "I approve the plan"; on the Compendium's
  terms: "Compendium agree for now")
- Owner: Project owner (D-01)
- Last updated: 2026-11-05
- Builds on: D-29 (Training slice), D-34 (Training's cards), D-41 (the weekly workouts card), D-42
  (the workout screen), the redesign's locked 4.3 (the exercise sheet). Takes into the MVP the
  exercise-list half of backlog E-17, and per-set rows and duration from E-14 (decision D-50, to be
  written)
- Requirements: REQ-TRN-003, REQ-TRN-004, REQ-TRN-005

## What the owner asked
2026-11-04: "When user is adding the exercises, user should be able to see Picker for exercise
names, should auto populate the names, KGs should be visible for weight trainings. For example,
user type Dumbell > System will show all related options > on user selection > system will ask KGs
mandatory. If user select Pushups then weights are not mandatory. Create the list of all exercises
and weight trainings and store it in our DB that app will use while user search the exercise."

2026-11-05: "When the running is asked ask the distance, speed and related feature, running on
treadmills. So add each type of exercise that a person can perform. Cardio as well." Then: "please
add Calories burned, A separate weight and reps for each set, Heart rate". Then: "Ignore for now to
merge to the Home dashboard. Let track the calories burn on the Training tab only."

The owner's choices:
1. The list is FitSphere's own, written by us: exercise names are everyday words, so no licence
   question. The owner checks the list in the pull request.
2. A name that is not in the list can still be saved.
3. For a bodyweight exercise (push-ups, pull-ups, dips...) the weight field is hidden.
4. Calories burned: the app estimates them, and the user can replace the estimate with the number
   from their machine or watch.
5. Calories burned and heart rate are entered on each exercise.
6. Calories burned are tracked on the Training tab only, for now: they change nothing on Home, its
   calorie target or its calories card.

## How each exercise is logged
Every exercise in the list has one of eight types. The type decides the fields the exercise sheet
asks for. A field marked * must be filled in; the others may be left empty.

| Type | Fields | Examples |
|---|---|---|
| Weight and reps | Each set: Reps*, Weight* | Dumbbell bench press, Barbell squat, Lat pulldown, Cable fly, Kettlebell swing |
| Reps | Each set: Reps* | Push-up, Pull-up, Crunch, Burpee, Jumping jack, Surya Namaskar (rounds), Dand, Baithak |
| Time | Each set: Time* | Plank, Side plank, Wall sit, Dead hang |
| Weight and time | Each set: Weight*, Time* | Farmer's walk, Weighted plank |
| Distance and time | Time*, Distance | Running, Walking, Cycling, Swimming, Hiking |
| Treadmill | Time*, Speed, Incline, Distance | Treadmill running, Treadmill walking, Incline walk |
| Cardio machine | Time*, Distance, Level | Exercise bike, Elliptical, Rowing machine, Stair climber |
| Time only | Time* | Yoga, Zumba, Aerobics, Skipping, Badminton, Cricket, Football, Boxing |

- **Sets:** the first four types have one row per set, each with its own reps, weight or time
  ("Set 1: 10 × 40 kg, Set 2: 8 × 45 kg"). "Add set" adds a row with the last row's values; each row
  can be removed. 1 to 20 sets.
- **Every type** also has, all optional: Calories burned, Average heart rate and Highest heart rate.
  The "sets" types also have Time spent, which is used only for the calorie estimate.
- Weight is typed in the lifting unit setting, kg or lb (REQ-TRN-005). Distance is typed in km and
  speed in km/h (MVP default: there is no distance unit setting; miles go to the backlog).
- Running, walking and the other "Distance and time" exercises show the average speed and the pace
  ("10.0 km/h · 6:00 /km") once both the time and the distance are filled in. On a treadmill the
  speed typed is shown instead.
- A name of the user's own asks "Log as": Sets and reps (the default, weight optional), Time (each
  set's time, weight optional) or Cardio (time, distance optional). Its calories are not estimated
  (it has no activity value); they can be typed.

## Calories burned
- **The estimate:** calories = the exercise's activity value (MET) × the user's weight in kg × the
  time in hours, the Compendium's standard formula, rounded to a whole kcal and marked "estimated".
  - The MET comes from the **2024 Adult Compendium of Physical Activities**: each exercise in the
    list names one Compendium activity code and its MET, copied unchanged from the Compendium's PDF
    (kept outside the repository, like the other sources), never from memory. The owner checks them
    with the list.
  - The weight is the latest weigh-in on or before the exercise's day. With none, the sheet says
    "Log your weight to see an estimate".
  - The time is the cardio time, the sets' times added up, or for weight-and-reps and reps
    exercises the Time spent, if typed. With no time, there is no estimate.
  - The estimate is made when the exercise is saved and kept with it, so a later weigh-in does not
    change old workouts. Editing the exercise makes it again.
- **Typed:** the user can type their machine's or watch's number in place of the estimate, 1 to
  5,000 kcal. A typed number is kept as typed.
- **Where it shows, on Training only:** each exercise's row on the workout screen shows its
  calories, and the workout its total ("Burned 420 kcal"); each date card on Training shows the
  day's total ("420 kcal burned"), including workouts waiting to sync. A total that holds an
  estimate is marked "estimated".
- **Not on Home or Progress:** Home's calories card, the targets and Progress's averages do not
  change; Home's workouts card and its day sheet show what they show today.
- **Labels, as Log meal's:** an estimate reads "420 kcal · estimated", as Log meal marks INDB's and
  the dishes' values (D-44, D-46), so the user knows it is a guess; a typed number has no label. The
  Compendium is named, with how the estimate is made, in a sheet behind an i on the exercise sheet,
  as Log meal's food sources are behind Search foods' i (D-44) and as the Compendium's website asks.
  The owner, 2026-11-05: "you can [show] this label as we show in the log meal, so the user may get
  idea about it."

## Heart rate
Average and highest heart rate, typed by the user, 30 to 250 beats a minute; the highest is not
below the average. Shown on the exercise's row. Nothing reads it from a watch.

## Scope, in three steps
Each step is its own branch and pull request, in this order, tested by the owner on the phone
before it is pushed. All the canvas boards are designed first and locked together.

1. **The list and the types.**
   - `data/exercises/exercise-list.csv`, about 300 exercises, one row each: a code, the name, the
     group shown beside it (Barbell, Dumbbell, Kettlebell, Machine, Cable, Bodyweight, Band, Cardio,
     Sport, Yoga and mobility, Other), the type, the Compendium code and MET, and other names
     people search by (for example "DB", "dumbell", "pushup", "dand", "treadmill run").
   - Server: migration `0016_exercises.sql` makes `app.exercises` (reference data like the food
     list: no user, row level security on, no policies). `npm run exercises:import -w
     @fitsphere/api` replaces it whole from the CSV. `GET /v1/exercises?version=...` gives the list
     to any signed-in user, with a version so an unchanged list is not sent again.
   - The stored exercise's new shape, for all three steps at once, so saved data changes shape only
     once: its name and note, plus either sets (each with reps, weight and time, any of them empty)
     or cardio (time, distance, speed, incline, level); and calories (with "estimated" or not),
     average and highest heart rate and time spent. Canonical units (invariant 6): grams, seconds,
     metres, metres per hour, tenths of a percent, kcal, beats a minute. Limits (MVP defaults):
     1–20 sets; reps 1–200; time up to 24 hours; distance 0.01–500 km; speed 0.1–40 km/h; incline
     0–40 %; level 1–40. Every exercise saved so far reads as that many identical sets. The server
     checks each value's limits, as today; it does not check the list (see Not in scope).
   - Phone: schema version 13 adds an `exercises` table, filled after a sync reaches the server,
     as the food list is; searching works offline. Workouts' own table does not change.
   - The exercise sheet: typing lists up to 8 matching exercises under the name, each with its
     group. Every word typed must match the name or another name, ignoring case, so "dumbell" and
     "db bench" both find "Dumbbell bench press"; names starting with the first word come first.
     Picking one fills the name and shows its type's fields. A name typed in full counts as picked
     when it matches a list exercise exactly. A required field left empty shows its rule under it,
     for example "Enter the weight you lifted, from 0.1 to 500.0 kg." An exercise saved earlier
     keeps every field it already has a value in, even if the list now gives it another type, so
     editing never drops a value. "Log as" for the user's own names.
   - Rows on the workout screen, for example "Plank · 3 × 1:00", "Running · 30:00 · 5.00 km ·
     10.0 km/h · 6:00 /km", "Treadmill walking · 30:00 · 6.0 km/h · 8 % incline", "Exercise bike ·
     20:00 · level 8", "Yoga · 45:00". Training and Home show names only, as today; a cardio
     exercise counts toward the weekly workouts like any other (D-41).
2. **Each set on its own row.** The sets editor; rows read "3 × 10 × 40.0 kg" when every set is
   the same, and "10 × 40, 8 × 45, 6 × 50 kg" when not.
3. **Calories burned and heart rate.** The fields, the estimate, the credit, the workout's total on
   the workout screen and the day's total on Training's date cards.

Docs, with the step they belong to: D-50; REQ-TRN-003's and REQ-TRN-004's MVP notes; the data
model's exercise shape; the constraints rows for the exercise fields, the lifting weight, the sheet
and Training's cards; backlog E-14 (RPE and rest stay) and E-17 (suggestions from past workouts
stay), and new items for a distance unit and for burned calories on Home; a new
`docs/data/exercise-list-sources.md` and `docs/sources/README.md` for the Compendium; the risk and
Legal's item below.

## Not in scope
- Rest time and RPE (the rest of E-14), intervals and laps.
- Reading heart rate, calories or workouts from a watch or phone health app.
- Suggesting names from the user's past workouts (the rest of E-17).
- Miles and min/mile: km only for now.
- Muscle groups, pictures, how-to videos (REQ-TRN-001 is for coaches, post-MVP).
- Burned calories on Home: raising the day's food allowance ("eat back"), or showing on any Home
  card. Later, if the owner wants it (backlog).
- Burned calories in Progress.
- The server checking an exercise against the list (that a weighted exercise has a weight): the
  phone checks it. A later change to the list must never refuse a workout already saved or waiting
  to sync.

## Risks
- **The Compendium's terms (new risk R-011, Legal L-17):** its website says "The Adult, Older Adult,
  and Wheelchair Compendia are free to use for commercial purposes", asks that MET values are not
  changed and that the Compendium is cited; the journal article that publishes it carries a CC
  BY-NC-ND licence (non-commercial). Using it is the owner's accepted risk, as INDB's is (R-009),
  until Legal answers: accepted 2026-11-05 ("Compendium agree for now").
- **Estimates are rough:** a MET is an average for an activity, not for the user. The estimate is
  marked "estimated", can be replaced by the machine's or watch's number, and changes no target or
  food allowance.
- **Heart rate is new health data:** sensitive like the rest (invariant 7); added to Legal's brief
  (Q-049).
- A wrong type or MET in the list: the owner checks the list; a fix is a CSV change and
  `exercises:import` again, with no app update.
- The stored exercise changes shape: tests cover every shape both ways through sync, and exercises
  saved before read and edit as they do now. Older exercises with a weighted name and no weight
  ask for the weight when edited; workouts not edited are untouched.

## Tests
- Shared: each shape's limits; an exercise saved before still reads, as identical sets.
- API: `GET /v1/exercises` needs sign-in, gives the list and its version, and sends nothing when the
  phone's version is current; the import refuses a bad CSV (repeated codes or names, unknown group
  or type, a MET out of range, a missing name); `workout.set` stores and returns each shape and
  refuses values out of range.
- Phone: schema version 13; the list replaced and searched (misspellings, short forms, order); the
  sheet for each type (fields shown, required, hidden), "Log as", values kept when the type changes;
  the sets editor; each row's text, with speed and pace; the estimate (with and without a weigh-in
  or a time, typed in its place, kept after a later weigh-in); heart rate limits; the workout's and
  Training's day totals (typed, estimated, waiting to sync); Home's calories card unchanged by
  calories burned; the list refreshed after a sync, and kept as is when offline.

## Owner's steps
- After step 1 merges, on `fitsphere-dev`: `npm run migrate -w @fitsphere/api` (0012 to 0016, if
  0012 to 0015 have not run yet), then `npm run foods:import -w @fitsphere/api` and
  `npm run exercises:import -w @fitsphere/api`, then reload the app. Steps 2 and 3 need no database
  command. No new phone build is needed.
