# Workout timer plan

- Status: **Accepted** (the owner, in chat, 2026-11-10: "approve, lock it")
- Owner: Project owner (D-01)
- Last updated: 2026-11-10
- Builds on: D-29 (a workout is saved at once, no draft and no "Finish" step), D-41 (a workout
  counts toward the week once it has an exercise), D-63 and D-65 (the workout page and the Training
  tab as they are now). Decision D-71 (D-70 is the meal insight)
- Requirements: REQ-TRN-003, REQ-TRN-004
- Design: the canvas's "4.2 A workout · PROPOSED (D-71): the workout timer" (boards `WorkoutTimer`,
  `WorkoutTimerStates`, `TrainingTimer`, `TrainingTimerStates`, version 66; locked in version 68)
- Branch: `feat/workout-timer`, in its own folder `D:\fitsphere-timer` (removed once merged)

## What the owner asked
2026-11-10: "in the log workout of the Training tab I want to have a start work button where when
the User click it shows a stopwatch/timer that count time in minutes and seconds and when the work
out has been done user can marke this workout done. and total time is calculated. User can stop the
timer and resume at the any time. this is enable for the today date only."

## What the user sees (the canvas)
On the workout page (opened by "Log workout for today", or a workout's pencil):

1. **Not started.** For a workout of today, a bar fixed at the bottom of the page holds one big
   button, **Start workout**.
2. **Running.** The bar shows **Workout time** counting up in minutes and seconds ("12:34"; from
   an hour, "1:05:12"), a green **Running** tag, and two buttons: **Pause** and **Mark done**.
   Exercises are added and changed as now while it runs.
3. **Paused.** The time stops; the tag turns gold, **Paused**; **Pause** becomes **Resume**, which
   counts on from where it stopped. Pause and resume as often as wanted.
4. **Done.** **Mark done** stops the timer for good and the bar goes away. Under the title a green
   panel says **Done · total time 52:40**: the time counted, pauses left out. A **Resume** on the
   panel (today only) undoes a Mark done tapped by mistake and counts on.
5. **Another day.** A workout of another date has no Start workout and no bar. One that was timed
   shows its done panel, without Resume.

On the Training tab, in By day and All workouts, each workout's row gets one more line when it has
a timer: **● Running · 12:34** (green, counting), **Paused · 31:08** (gold) or **✓ Done · 52:40**. A
workout with no timer looks as it does now.

## The rules (MVP defaults, D-18)
- **Start workout is for today only** (the owner's words): it shows only on a workout whose date is
  today in India (invariant 5). The Resume after Mark done is also today only.
- **A timer already started can always be paused, resumed and marked done**, whatever the date: a
  workout started at 11:40 pm can be finished after midnight. It stays on the date it was logged to.
- **The time counts from the clock, not from the app being open.** Leaving the page, closing the
  app or turning the phone off does not stop it; coming back shows the right time. Only Pause and
  Mark done stop it.
- **Up to 24 hours.** A timer left running shows at most 24:00:00 (the longest time an exercise
  holds, D-50); the clock going backwards never takes time away.
- **Mark done is not required.** A workout is still saved at every change (D-29); the timer only
  adds its time. A workout logged without the timer stays as it is now.
- **A workout whose timer has started is listed** on Training, and Home's day sheet, before its
  first exercise ("No exercises"), so a running workout is never lost. This changes D-65's
  "a workout with no exercise is not listed" for timed workouts only. It still **counts toward the
  week only once it has an exercise** (D-41, unchanged), and Mark done with no exercise is allowed
  (it keeps the time).
- Each workout has its own timer; nothing stops two workouts' timers running at once.
- Deleting a workout deletes its timer with it (the delete message is unchanged, D-63).

## How the time is stored
Each workout gets a `timer`, or none:

| Field | What it holds |
|---|---|
| `startedAt` | When Start workout was first tapped (UTC) |
| `countedSeconds` | The time counted before the current run, 0 to 86,400 |
| `runningSince` | While running, when it was last started or resumed (UTC); otherwise none |
| `doneAt` | Once marked done, when (UTC); otherwise none |

Running = `runningSince` set; paused = neither set; done = `doneAt` set (never both). The time shown
is `countedSeconds` plus the time since `runningSince`, at most 24 hours. Pause and Mark done add
the run to `countedSeconds`. Every tap (Start, Pause, Resume, Mark done) is saved on the phone at
once and synced like any other change to the workout (ADR-0007); it works offline.

## How it is built
**Shared contract** (`packages/shared/src/contracts.ts`): `workoutTimerSchema`, and `timer` on
`workoutSetDataSchema`, `workoutSchema` (the pull and the history). A change that carries no `timer`
(sent by an app from before this change) keeps the timer stored.

**Server** (`apps/api`): migration `0025_workout_timer.sql` adds four columns to `app.workouts`
(`timer_started_at`, `timer_counted_seconds`, `timer_running_since`, `timer_done_at`), with checks:
all empty or started with a count; the count from 0 to 86,400; never running and done at once; a
deleted workout has none. Migration `0026_workout_timer_count.sql` makes the count required once
the timer has started (0025's rule let a start with no count through: a check on a null passes).
`workout.set` stores the timer; the sync pull and `GET
/v1/users/{userId}/workouts` send it. Authorization is unchanged: a user's own workouts only
(invariant 1).

**Phone** (`apps/mobile`):
- Phone schema version 18: a `timer` column on the phone's `workouts` table (JSON); workouts stored
  before read as no timer. `startWorkout` saves none.
- `workouts.ts`: the timer's sums and steps (time now, start, pause, resume, mark done), each a pure
  function of the time given, and the row's line ("Running · 12:34").
- A small `useNow` hook that redraws once a second, only while a timer runs on screen.
- `components/WorkoutTimerBar.tsx`: the bottom bar (Start workout; or the time, its tag, Pause or
  Resume, Mark done).
- `WorkoutScreen.tsx`: the bar for today's workouts and for any timer not done; the done panel.
- `TrainingScreen.tsx`: the timer line on each row; `listedWorkouts` lists a workout whose timer
  has started.
- Lucide icons already in the app: `Play`, `Pause`, `Check`, `CircleCheck`. JavaScript only: **no new
  development build**.

**Documents:** D-71 in the owner decisions (after D-70); REQ-TRN-003 and REQ-TRN-004; the data model
(`workouts`, phone schema version 18); `docs/plans/ui-redesign.md` rows 4.1 and 4.2; new phone
checks S4-22 to S4-26 in `docs/testing/slice-4-manual-testing.md`; CLAUDE.md's current phase.

## Tests
- **Shared:** the timer's shape (running and done together, a count over 24 hours or below 0 are
  refused); a change with and without `timer`.
- **Server, integration:** migrations 0025 and 0026's checks; `workout.set` with a timer is stored and pulled;
  one without `timer` keeps it; a deleted workout loses it; the history sends it; the migration
  list.
- **Phone:** the timer's sums with fixed times (pauses left out, 24-hour cap, clock going back);
  the phone database upgrade from 17 to 18 keeps every workout; on the workout page: Start workout
  only today, the time counts, Pause stops it, Resume counts on, Mark done shows the total and hides
  the bar, Resume after done only today, yesterday's running timer can still be paused and marked
  done; on Training: Running, Paused and Done lines; a started workout with no exercise is listed
  but not counted on Home.
- **Phone checks (S4-22 to S4-26)** for the owner: start, pause, resume; close the app and reopen
  (time still right); mark done and see the total on Training; another day has no Start; a workout
  that runs past midnight.

## Risks
- **The phone's clock.** The time comes from the phone's clock; if the user changes it while a
  timer runs, the time is off (never below the time already counted, never over 24 hours).
- **No lock-screen timer or alert.** The time is seen only in the app; a notification or a
  lock-screen timer needs a native module and a new development build (not in this change).
- **Two phones** changing the same workout's timer: the last change wins, as for exercises.

## Not in this change
Reset to 0:00, laps and rest timers, sound or vibration, a lock-screen timer, the time on Home,
typing the total by hand, using the time to estimate calories, a "Start workout" on the Training
tab itself.

## Owner's steps
1. ~~Approve this plan and lock the canvas boards~~ (done, 2026-11-10).
2. After the build: migrations 0025 and 0026 on `fitsphere-dev` **before** running the updated API (the
   command is given then); no `foods:import`, no new build.
3. Test on the phone from `D:\fitsphere-timer` (copy `apps/api/.env` and `apps/mobile/.env` from
   `D:\fitsphere`), then say "push".
