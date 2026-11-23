# Plan: an exercise's time worked out from its reps, and its calories with it

- Status: **Accepted and built** on branch `feat/measurements-date-calendar` (the owner, 2026-11-20: "numbers are fine, show minutes and seconds, then start building"; weights 4 s, bodyweight 3 s, rest not counted)
- Requirements: REQ-TRN-003 (an exercise's sets, time and calories burned; D-50, D-107), REQ-TRN-004
- Decision: to be recorded on approval (the next D- number)
- Builds on: calories burned, estimated or typed (D-50, R-011), the exercise list (D-50, D-67, `app.exercises`),
  Calories burned changed by you (D-107), the exercise page (D-111, D-112)
- Invariants touched: #6 (units: a time is stored in seconds), #7 (made-up data in tests)
- Design: the exercise page's "Time spent" box already exists; what changes is its starting value and one line
  of text. **If the box changes shape (see "Open questions", 3), the canvas boards come first.**

## What the owner asked
2026-11-20: on a workout, an exercise's time should not be typed from nothing. The app should fill it in from
**one rep's time**, kept in our database, so that when the user adds sets or reps the time grows and the
calories burned grow with it. The time stays visible and editable, and the calories stay editable as now.
The owner's answers: **one value per type of exercise; rest between sets is not counted.**

## What happens today
- A weights or bodyweight exercise has an optional "Time spent" (whole minutes, `durationSeconds` in the
  workout). Empty, there is no calorie estimate: "Add the time spent to see an estimate."
- The estimate is `MET × weight in kg × time in hours` (`estimateCalories`, `src/workouts.ts`).
- The exercise list (`app.exercises`) has each exercise's type (`log_type`), MET and details, but nothing
  about how long a rep takes.
- Only two of the eight types are done in reps: `weight_reps` (121 exercises of the owner's list of 334 at
  the start; more in the 2,119 of the library) and `reps` (bodyweight, 60). The others already carry a time:
  `time` and `weight_time` take a time on each set, and the four cardio types take a time of their own.

## What changes

### 1. The data: one number per type
- A new column **`seconds_per_rep`** on `app.exercises` (whole seconds, 1 to 30, nullable).
- Filled from a small sheet, **`data/exercises/type-times.csv`**, one row per type:

  | log_type | seconds_per_rep |
  |---|---|
  | weight_reps | **4** (proposed) |
  | reps | **3** (proposed) |

  The two numbers are **proposals for the owner to set**; nothing in the app or the data says what a rep
  really takes (a slow lift and a fast push-up differ). The other six types stay empty: they do not use it.
- `exercises:import` writes each exercise's `seconds_per_rep` from its type's row. A per-exercise value can
  replace it later by adding a column to the review sheet; this plan does not.
- Migration `0035_exercise_seconds_per_rep.sql` (adds the nullable column; nothing else, no data change to
  anyone's workouts).

### 2. The API
- `GET /v1/exercises` also sends `secondsPerRep` (a number or null) for each exercise: one more field in
  `listedExerciseSchema` (`packages/shared`). The phone's copy of the list takes it as a new column
  (phone schema version 24, which clears the list's version so each phone downloads it once, as before).

### 3. The phone's exercise page
- **The time.** For an exercise with a `secondsPerRep`, the "Time spent" box starts as
  *total reps in all its sets × seconds per rep*, rest not counted, and **follows the sets and reps** as they
  change: adding a set or a rep, or changing reps, changes the time.
  - 3 sets of 10 reps at 4 s: 30 reps × 4 s = 120 s = 2 min.
- **Editable.** Once the user types in the time, it is theirs and stops following the reps (the same rule as
  Calories burned: typed wins, D-107). A small line under the box says how it was worked out ("From 30 reps ×
  4 s. Type your own time to replace it."), and an arrow puts it back, as the calories' arrow does.
- **Calories.** Unchanged: the estimate is worked out from the time shown, so it rises with the reps; typed
  calories still replace it, with the Edited tag and the arrow.
- **Reopening a saved exercise.** The saved time is kept. If it equals what the reps give (so it was not
  typed), it goes on following the reps; if it differs, it is the user's. **No flag is stored** to tell them
  apart.
- **What gets no prefilled time:** an exercise with no `secondsPerRep` (timed sets, cardio, the user's own
  exercises), and one with no reps typed yet. They behave exactly as today.

## What does not change
- **`app.workouts`**: no migration. The time is saved in the field that exists (`durationSeconds`), the
  calories with their typed-or-estimated flag as now.
- **Past workouts** keep their time and calories; nothing is recalculated unless the user edits that exercise.
- Cardio, timed sets and the workout timer (D-71) are untouched; the timer is the workout's own time, not an
  exercise's.
- No new native module: no new build.

## Tests
- `estimateCalories`/`effortOf`: reps × seconds per rep for the two types, rest not counted, no time with no
  reps or no `secondsPerRep`.
- The exercise sheet: the time appears and grows as sets or reps are added; typing it stops it following; the
  arrow puts it back; a saved exercise whose time matches its reps keeps following, one that differs does not;
  calories follow the time and typed calories still win.
- Import: each type's seconds reach every exercise of that type; a type with no row stays empty; a value out
  of range is refused.
- API/contracts: the exercise list carries `secondsPerRep`; a phone on the older schema is told to download
  the list again.

## Risks
- **The two numbers are guesses.** A rep's time varies with the lift, the person and the tempo, so the time
  and the calories are rough and say so ("estimated", the line under the box). R-011 (the Compendium's METs
  are used for a general person) covers the calories; this adds a second estimate on top of it, which the
  user can overwrite.
- **Same exercise, different numbers over time.** If the owner changes a type's seconds, new estimates differ
  from old workouts of the same exercise; old ones are not touched.

## Rollout
- Migration 0035, then the updated API, then `exercises:import` on `fitsphere-dev`, which the Cloud Run beta
  shares. **Only when the owner says so**; the beta's Cloud Run API needs this API before beta phones get the
  new field (the older phone schema ignores it until updated).
- Phone app: JavaScript only after the list arrives (no new build).

## The owner's answers (2026-11-20)
1. The numbers: **4 s** a rep for weights, **3 s** for bodyweight.
2. Setup time per set: not asked again; **not counted** (only reps count).
3. The box: **minutes and seconds**. Built as two small boxes, Min and Sec, in the half-width cell beside
   Calories (the old single minutes box was the same width); the label shows **From reps** or **Edited**,
   and an arrow brings the reps' time back. The layout was not redrawn on the canvas: the owner can ask for a
   change after seeing it on the phone.
4. Own exercises: no prefilled time (as proposed).

## Open questions for the owner (answered above)
1. **The two numbers:** is 4 s a rep for weights and 3 s for bodyweight right, or what should they be?
2. **Sets:** should the time count only reps (as written), or add a fixed time per set (a few seconds to get
   into position)? The owner said rest is not counted; setup time per set is not covered.
3. **The box:** "Time spent" is whole minutes today, so a short set (for example 30 reps × 3 s = 90 s) shows
   1 or 2 minutes, and the calories are computed from that rounding. Should the box show **minutes and
   seconds** (as cardio's time does)? That is a design change and needs the canvas first.
4. **Own exercises** (a name typed that is not in the list) have no type and so no prefilled time. Is that
   right?

## Not in this plan
A per-exercise time, rest between sets, a time for cardio or timed sets, recalculating past workouts, a
stored "this time was automatic" flag.
