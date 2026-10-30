# Training slice plan

- Status: **Accepted**, approved by the project owner on 2026-10-29 (D-29)
- Owner: Project owner (D-01)
- Last updated: 2026-10-30 (rebased onto slice 3's step 8, #38: migration 0007, phone schema
  version 6, IDs D-29 and E-14 to E-17). 2026-10-29 (steps 1 to 4 built; the owner's checks are
  pending)
- Builds on: [`mvp-scope.md`](../product/mvp-scope.md) section 5, slice 4 (D-18, D-20); the
  [Home and daily tracking slice](home-daily-tracking-slice.md); the contracts in
  [`docs/contracts/`](../contracts/); [`test-strategy.md`](../quality/test-strategy.md);
  [`definition-of-done.md`](../quality/definition-of-done.md); ADR-0007

This is the fourth MVP slice, for the Personal Training User only (D-20). It builds:
- the Training tab: "No training plan yet", "Start an empty workout" and "Workouts you have
  logged";
- logging exercises as sets × reps × weight with an optional note (Q-042), in kg until the
  Settings slice adds the lifting unit;
- workouts offline and through sync, with the outbox, re-authorization and rejected-change rules
  of the other kinds (ADR-0007);
- the real count and dots in the Home workout tracker (REQ-HOME-007).

It is built **in parallel with slice 3, Meal logging** (D-26), in its own worktree. Where the
contracts define something, this plan does not repeat it.

## Progress
| Step | Status | Branch |
|---|---|---|
| 1. Server: workouts in the contracts, schema, sync and history route | Pull request #23 | `training/01-server-workouts` |
| 2. Phone: local schema, store and sync client | Pull request #25 | `training/02-phone-workouts` |
| 3. Training tab and workout screen | Pull request #27 | `training/03-training-screens` |
| 4. Home workout tracker; close-out | Pull request #28 | `training/04-home-tracker` |
| Owner's checks at the end of the slice | Pending: merge after #38 (rebased onto it on 2026-10-30, numbers final), migration 0007 on `fitsphere-dev`, phone checks 1 to 8 | — |

## Scope
| In this slice | Requirements |
|---|---|
| Training tab: the empty state, "Start an empty workout", the workout history | REQ-TRN-002, REQ-TRN-003, REQ-TRN-004 |
| Exercises as sets × reps × weight with an optional note; lifting weight in kg, stored in grams | REQ-TRN-003, REQ-TRN-005 (kg only until the Settings slice) |
| The Home workout tracker counts real workouts; an empty workout counts (Q-025) | REQ-HOME-007 |
| Workouts work offline and sync; self-access only | REQ-NFR-004, REQ-NFR-001 (D-20) |

Not in this slice: training plans from a coach and logging a planned workout (REQ-TRN-001,
REQ-TRN-006, REQ-TRN-007; post-MVP, backlog B-21), and the lifting-unit setting (Settings slice).

## Decisions
**1. Working beside slice 3.**
- IDs: D-29 for this plan's approval, E-14 to E-17 for the new backlog edge cases. They were
  temporary while the slice was built and got these numbers when it was rebased onto slice 3's
  step 8 (#38) on 2026-10-30.
- The server migration is `0007_workouts.sql`, the next number after slice 3's `0006_dishes.sql`
  (it was built as a temporary 0010 and renamed when rebased). It runs on Supabase only when the
  owner says so.
- The phone schema takes version 6, after slice 3's meals (3), photos (4) and dishes (5). It was
  built as version 3 and moved to the end of the list when rebased, since phones already hold 4.
- Shared files get small additions only, placed apart from slice 3's where possible, so that most
  merges are clean.
- Slice 3's phone step needs the same store support for entries keyed by an ID, with deletion.
  Step 2 builds it in its own commit. If slice 3 lands its own version first, step 2 uses that one
  instead of adding a second (it did: the rebase kept slice 3's).
- Before each pull request, the branch is rebased on the latest main (the later steps on the step
  before them) and every check is run again.

**2. No new packages, so no EAS build.** The screens use React Native and expo-router only.

**3. Workflow as D-21.** One branch and one pull request per step; steps run back to back; the
owner's merges, the migration and the phone checks are batched at the end.

**4. MVP defaults** chosen under D-18 answer 3. They are listed in
[`constraints-and-assumptions.md`](../architecture/constraints-and-assumptions.md#mvp-defaults-d-18)
in the step that builds each one, and in each pull request.

| Question | MVP default |
|---|---|
| Lifting unit (REQ-TRN-005) | kg until the Settings slice adds the setting. Stored in whole grams (invariant #6), so a later lb setting converts the history shown. Typed with at most one decimal, 0.1–500.0 kg |
| Exercise fields (Q-042) | Name (1–80 characters, typed freely; no exercise list); sets 1–20; reps 1–200, the same for every set; weight optional (empty means no weight, e.g. push-ups, shown as "3 × 10"); note optional, up to 500 characters. Up to 30 exercises a workout. No per-set rows, duration, RPE or rest |
| Starting a workout | "Start an empty workout" creates the workout at once on the header's selected date (as Q-011 does for "+") and opens it. It counts toward the week at once, even with no exercises (Q-025) |
| Saving | Each change (add, edit or remove an exercise) is saved on the phone at once and queued for sync. There is no draft and no "Finish" step, so nothing can be lost; "Done" goes back |
| A workout's date | Fixed when it starts; to log another day, pick that date first |
| Deleting | "Delete workout" asks for confirmation; removing an exercise does not. A deletion syncs as `workout.delete`, and the server keeps an empty row so other phones learn of it |
| Several workouts on one day | Allowed. Each counts; the day's dot marks the day |
| Home count | The workouts on the phone in the Mon–Sun week of the selected date (D-23), including those waiting to sync |
| History | Newest first: the last 90 days from the phone. "Load older" reads 90 more days at a time from the server, online only (ADR-0007 rules 1 and 6), with the warning "Loading older workouts needs an internet connection." Older workouts are view-only |
| Training tab texts | "No training plan yet." (D-20), the "Start an empty workout" button, then "Workouts you have logged". Each row: the date, "N exercises" or "No exercises", the first names, and "waiting to sync" or "not saved" |
| Rejected text | "This workout wasn't saved: <reason>. Edit or discard it." Edit opens the workout |
| Exercise sheet close | Cancel saves nothing, as Q-029 |

## Data and API
The contracts are updated first: [`data-model.md`](../contracts/data-model.md) (`workouts`),
[`api-conventions.md`](../contracts/api-conventions.md) (`workout.set`, `workout.delete`, the pull,
`GET /v1/users/{userId}/workouts`) and [`error-model.md`](../contracts/error-model.md).

- **Migration `0007_workouts.sql`**: `app.workouts`, keyed by (`user_id`, `id`)
  with the ID made on the phone. `exercises` is a JSON array, null exactly when the workout is
  deleted. Row level security on with no policies; the touch trigger; **Health** data.
- **Sync:** `workout.set` replaces the whole workout (the day rules apply, but a day may hold
  several); `workout.delete` keeps an empty row. The pull returns workouts of the last 90 IST days,
  a deleted one as `deleted: true`.
- **History route:** `GET /v1/users/{userId}/workouts`, modelled on the weigh-ins route, with a
  cursor on the last day and ID. Self-access only in the MVP (`authorizeWorkoutRead`).
- **Phone:** a `workouts` table keyed by `id`. The store learns kinds keyed by an ID, with a delete
  change type, JSON columns and pulled deletions. `SyncProvider` gains `startWorkout`,
  `save('workout', …)` and `remove('workout', …)`.

## Steps
### Step 1: Server: workouts in the contracts, schema, sync and history route (REQ-TRN-003, REQ-TRN-004, REQ-NFR-001, REQ-NFR-004)
**Builds:** the shared schemas and the lifting-weight range; migration 0007; the two change
handlers and the pull; the history route and its access rule; the contract documents; this plan,
D-29, `CLAUDE.md` and the docs index.

**Tests**
- Shared: every limit and one step outside it; strict fields; at most 30 exercises; the pulled
  union; one decimal of kg converts to grams and back unchanged.
- `workouts.test.ts`:
  - a workout is applied and pulled; an empty workout and several on one day are accepted;
  - a second change replaces the whole workout; once only by `changeId`;
  - `DAY_IN_FUTURE`; `VALIDATION_FAILED` without the values; `ROLE_NOT_ENABLED`;
  - a deletion keeps an empty row and is pulled as deleted; a later save restores it; deleting an
    unknown ID changes nothing;
  - the 90-day window, and paging across kinds with a page size of 2;
  - self-access: a second user with the same workout ID and `changeId` never changes, deletes or
    receives the first user's workout;
  - the route: 200 for the user, 404 for anyone else, 401 and 403 as for weigh-ins; days, order,
    deleted workouts left out, paging within one day, bad cursors and queries;
  - the table's checks, the per-user key and the cascade;
  - the log holds no exercise name, note, weight or query value.
- `migrate.test.ts`, `schema.test.ts` (row level security on every table) and `sync.test.ts` list
  the new migration, table and pull list.

### Step 2: Phone: local schema, store and sync client (REQ-NFR-004; ADR-0007 rules 1, 2 and 7)
**Builds:** the store's support for ID keys and deletion (its own commit); the workout kind and
the local migration; `syncNow`, `SyncProvider` and the fake server.

**Tests** (in-memory SQLite)
- The existing weight and daily tests pass unchanged.
- A saved workout is pending, then synced; a rejected one stays until discarded, and discarding
  brings back the server's copy.
- Deleting removes it locally and queues the delete; a pulled deletion removes the local copy.
- A pull never overwrites a workout whose change is still waiting.
- Pruning removes synced workouts older than 90 days, never pending ones.
- Migrating from version 2 keeps the data and clears the cursor.

### Step 3: Training tab and workout screen (REQ-TRN-002…005)
**Builds:** `TrainingScreen` (empty state, start button, rejected workout changes, history, "Load
older"); the `workout/[id]` route with `WorkoutScreen` and `ExerciseSheet`; the parsing and
display helpers with `LIFTING_WEIGHT_UNIT = 'kg'`; the workout subject in `RejectedChanges`.

**Tests**
- The empty state and the headings; four tabs still open their screens.
- Starting on a past selected date puts the workout on that day.
- The exercise sheet: a name is required; the limits for sets, reps, weight and note; weight
  optional with one decimal; Cancel saves nothing.
- Edit and remove an exercise; delete a workout only after confirming.
- Offline: start a workout and add an exercise, then reconnect: synced.
- "Load older": the named warning offline; older workouts listed online, view-only.
- The rejected text, and Edit opens the workout.

### Step 4: Home workout tracker; close-out (REQ-HOME-007)
**Builds:** the tracker's count and dots from the week's workouts; Edit on a rejected workout
opens it.

**Tests:** one empty workout shows "1 of 5 · 4 left" and its dot; two on one day count 2 with
one dot; another week's workouts are not counted; "target reached"; a past week picked with the
selected date.

**Close-out:** the MVP defaults in `constraints-and-assumptions.md`; E-14 to E-17 in
`backlog.md`; notes on REQ-TRN-003, REQ-TRN-004, REQ-TRN-005 and REQ-HOME-007; ADR-0007's
validation results; the device checks in `test-strategy.md`; the links in `mvp-scope.md` and the
docs index; `CLAUDE.md`; this plan's progress.

New backlog edge cases: E-14 per-set reps and weights, and the other Q-042 fields (duration,
RPE, rest); E-15 changing a workout's date; E-16 editing or deleting workouts older than 90 days,
online; E-17 exercise-name suggestions from past workouts.

## Owner's checks at the end of the slice
1. Merge the four pull requests in step order, each with green CI, after slice 3's step 8 (#38).
   They are rebased onto it, with the migration number, the phone schema version and the IDs made
   final.
2. When the owner says so: `npm run migrate -w @fitsphere/api` against `fitsphere-dev`, only once
   the migration has its final number on main.
3. Phone checks on the existing development build (no new build), with test data only; the owner
   starts `npm run dev:phone`:
   1. Training shows "No training plan yet.", "Start an empty workout" and an empty history.
   2. Start a workout: Home shows "1 of T · T−1 left" and today's dot.
   3. Add two exercises, one with a weight and a note and one without a weight; edit one, remove
      one. Values outside the limits are refused.
   4. Pick a past day in the calendar and start a workout: it is listed under that day and counts
      in that week.
   5. Delete a workout, after the confirmation: the count drops.
   6. Offline (airplane mode, with the app open): start a workout and add exercises; after
      reconnecting they sync. Log out and sign in: the workouts come back.
   7. "Load older": offline, the named warning; online, the older workouts, or none.
   8. Weight, steps and sleep still save.
   - If the phone has run slice 3's code before it was merged, log out once first, so the phone
     database is recreated at the right schema version.

## Risks
- **Merge conflicts with slice 3** in the shared lists (the change handlers, the pull, the local
  migrations, the docs): expected and small; they are fixed by the rebase before each pull
  request, with every check run again.
- **Clashing phone schema versions** if one phone runs both slices before they are merged: the
  phone checks run on merged code, and the note in check 3 covers the rest.
- **Changing the store could break the earlier kinds:** the existing store, daily and sync tests
  stay unchanged and must pass.
- **A renumbered migration that was already applied** would stop the migration runner: it runs on
  Supabase only once its number is final (0010 was applied only to test databases).

## Verification
- For every pull request, on the PC and in CI: `npm run lint`, `npm run typecheck`, `npm test`
  (both time zones in CI) and `npm run test:integration` (this worktree's `TEST_DATABASE_URL`).
  Each pull request says what passed, what failed and what was not run.
- End to end: the owner's checks above, recorded in this plan's progress table and in ADR-0007.
