# Home Calories / Workout toggle plan

- Status: **Accepted** (the owner, in chat, 2026-11-23: "approved, go ahead with the build"); built on the branch, waiting for the owner's phone check
- Owner: Project owner (D-01)
- Last updated: 2026-11-23
- Decision: D-123 (to be recorded on approval; D-122 is reserved for notifications, confirm the number)
- Requirements: REQ-HOME-003 (Calories card), REQ-HOME-005 (By meal), REQ-TRN-002 to REQ-TRN-004 (workouts
  listed and numbered as Training does). Add REQ-HOME-009 for the Workout view.
- Design: the mock https://claude.ai/artifact/3ck4vk1pkwDFQSrUzUWyUJ (version 3). The project rule is that
  a screen is designed on the owner's canvas and locked before it is built: the mock is moved to the
  canvas as boards `HomeWorkoutToggle*` and locked first.
- Branch: `feat/home-workout-toggle` off `main`, in its own folder `C:/Users/Admin/Desktop/fitsphere-home-workout` (this PC has no D: drive; removed once
  merged). The current checkout (`fitsphere-notification-copy`) holds unrelated uncommitted notification work and
  is not used.

- Related: ADR-0011 (a training section on Home, Proposed) offered other options; the owner chose this toggle
  instead, so ADR-0011 is not built. D-103 and D-110 still hold: the Workout view is another view of the same card.

## What the owner asked
2026-11-23: a toggle icon beside the Calories title on Home. Tapping it turns Calories into a workout view
and "By meal" into "By workout". Calories stays as it is. The workout view is built like Calories, with the
toggle at the left. No burn goal: show kcal burned only. Remember the toggle.

## What the user sees
1. **Header.** A two-icon toggle (food, dumbbell) at the left of the card's header, before the title. The title
   follows it: "Calories" or "Workout". "By meal ›" or "By workout ›" stays at the right.
2. **Calories view.** Unchanged: kcal eaten against the target, the bar, then protein, carbs, fat and fibre
   (REQ-HOME-003, REQ-HOME-004).
3. **Workout view.** Same panel and spacing:
   - the big number, "520 kcal burned" (no goal, no remaining, no percentage);
   - a full bar under it (nothing to measure against);
   - a divider, then one row per workout in the style of the nutrient rows: "Workout 1", a bar, "4 exercises
     · 300 kcal". Each bar is sized against the day's biggest workout.
4. **By workout** opens Training for the selected date (as By meal opens Nutrition › Consumed).
5. **Remembered.** The last choice is kept on this phone and is still there after the app closes.

## The rules (MVP defaults, D-18)
- **Which workouts:** the selected date's workouts with at least one exercise (`listedWorkouts`, D-41, D-108),
  numbered "Workout 1", "Workout 2" in the order Training numbers them, so the names match.
- **kcal burned:** `caloriesBurned` (D-50): typed calories, else the estimate. A workout with no calories on
  any exercise shows "– kcal" and an empty bar; the total sums only what has calories. A day where none has
  calories shows "– kcal burned". If any part is estimated, the line says "estimated", as Training does.
- **Empty day:** "0 kcal burned" is not shown; the view says "No workouts logged" with "Log workout" (only for
  today, as Training). Past dates have no button.
- **Waiting and rejected workouts** show as Training does (a "waiting to sync" or "not saved" note on the row).
- **Older days** (D-106): workouts of a day older than the phone's 90 come from the same online read as the rest
  of the day; while it loads, dashes; offline or failed, the banner already on Home says so.
- **Nutrition bars are hidden** in the Workout view; the quick tiles below are unchanged in both.
- **Remembered choice** is kept on the phone only, in `sync_meta` under a new key `home_card_view`
  (`'calories'` or `'workout'`), as `workout_pill_corner` is (D-105): no server change, no migration, no phone
  schema change. A missing or unreadable value opens on Calories. It is not tied to the date or the account's
  data; signing out clears it with the rest of `sync_meta`.
- **Screen readers:** the toggle is a two-button group named "Show", each button "Calories eaten" or "Workouts",
  with its selected state; the card announces its title change.
- Dark and light themes use the existing tokens (`useTheme().colors`); no new colour.

## What changes in the code
- `apps/mobile/src/local/store.ts`: add `'home_card_view'` to `MetaKey` and note it in its comment.
- `apps/mobile/src/homeCardView.ts` (new): the pure functions: `readCardView(raw)` (unknown reads as Calories) and
  `workoutRows(workouts)` (names, exercise counts, kcal, bar share against the biggest, total, estimated flag).
- `apps/mobile/src/components/CardViewToggle.tsx` (new): the two-icon toggle (Lucide icons, existing tokens).
- `apps/mobile/src/components/WorkoutBurnCard.tsx` (new): the Workout view (big number, bar, rows), modelled on
  `TargetProgressCard` and `NutrientTargets`.
- `apps/mobile/src/screens/HomeScreen.tsx`: read the selected day's workouts (the same `listEntries(db,
  'workout', day, day)` call as Training), hold the view, load and save it with `getMeta` / `setMeta`; switch the
  panel's body and the right-hand link; the toggle goes in the header of the panel.
- Phone app only: no server change, no migration, no phone schema change, no new build (Lucide's `Dumbbell`
  and `Apple` icons are already in the package; check that both are used elsewhere, else they are still JavaScript only).

## Tests
- `homeCardView.test.ts`: unknown or missing meta reads Calories; rows numbered as Training numbers them;
  a workout with no exercise is left out; kcal summed, typed over estimated; a workout with no calories shows
  "–"; bars sized against the biggest and the biggest is full; none with calories gives no total.
- `HomeScreen` test: the toggle switches the title, the link ("By workout") and the body; the choice is saved
  and read back after a remount; the empty day text; Log workout only on today; By workout navigates to Training
  with the date.
- Existing Home tests for the Calories view must pass unchanged. Synthetic data only (invariant 7).
- Checks to run and report: the phone app's tests, type check and lint; nothing else is touched.

## Risks and open points
- **Bars with no goal** are relative, not progress: the top bar is always full. If that reads wrongly on the phone,
  the owner can drop the top bar later.
- **Day numbering and Training:** if Training's numbering changes, both must change together; the rows reuse
  Training's function (extract it if it is inline) so they cannot drift.
- Phone check for the owner, after the build: toggle on today, a past date, a day with no workout, a day with an
  unsynced workout, closing and reopening the app.

## Order of work
1. Owner approves this plan and the mock; the boards are locked on the canvas; D-123 and REQ-HOME-009 recorded.
2. Branch and folder made; tests written first; then the files above.
3. Checks run; pull request off `main` with the plan and requirement changes; the owner checks on the phone.
