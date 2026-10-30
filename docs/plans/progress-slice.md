# Progress slice plan

- Status: **Accepted**, approved by the project owner on 2026-10-30 (D-P1, a temporary ID until
  merged)
- Owner: Project owner (D-01)
- Last updated: 2026-10-30 (steps 1 and 2 opened as #41 and #42; step 3 built, with the close-out)
- Builds on: [`mvp-scope.md`](../product/mvp-scope.md) section 5, slice 5 (D-18, D-20); the
  [Home and daily tracking slice](home-daily-tracking-slice.md); the
  [Meal logging slice](meal-logging-slice.md); [`test-strategy.md`](../quality/test-strategy.md);
  [`definition-of-done.md`](../quality/definition-of-done.md); ADR-0007

This is the fifth MVP slice, for the Personal Training User only (D-20). It builds the Progress
tab:
- the "Weight over 4 weeks" card: the change and the weekly rate (REQ-PRG-001);
- average calories against the user's own target, and "Meals logged: X of Y days" (REQ-PRG-002,
  REQ-PRG-003);
- the weight trend chart with 1W, 4W, 12W, 26W and All (REQ-PRG-004);
- the week-by-week table with a Target row (REQ-PRG-005), without the "Pre" row and week details
  (post-MVP, backlog B-02);
- the Measurements section with "Add first" (REQ-PRG-006).

It is built **in parallel with slice 6, Settings and account**, which is built in
`D:\fitsphere-settings`. Progress only reads data that already exists: it needs no server change,
no migration and no new phone schema version.

## Progress
| Step | Status | Branch |
|---|---|---|
| 1. Calculations, range query, account start day | Pull request #41 | `progress/01-calculations` |
| 2. The Progress screen | Pull request #42 | `progress/02-screen` |
| 3. Weight trend chart; close-out | Built | `progress/03-chart` |
| Owner's checks at the end of the slice | Pending: the merges, then phone checks 1 to 7 | — |

## Scope
| In this slice | Requirements |
|---|---|
| Weight over 4 weeks: the change, the weekly rate, or the not-enough-data message | REQ-PRG-001 |
| Average daily calories against the user's own calorie target | REQ-PRG-002 |
| Meals logged: days with at least one meal out of the days counted | REQ-PRG-003 |
| Weight trend chart, 1W/4W/12W/26W/All, with its empty state | REQ-PRG-004 |
| Week-by-week table of body weight, calories, protein and steps, and a Target row with the user's own targets | REQ-PRG-005 (without the "Pre" row and week details) |
| Measurements list, "Add first" opening the existing measurements sheet | REQ-PRG-006 |

Not in this slice: the "Pre" row and week details (B-02); weeks and measurements older than the
90 days the phone holds (new backlog edge case); a target that changes over time (E-11).

## What already exists
- Weigh-ins have an online history route, `GET /v1/users/{userId}/weigh-ins` with `from`, `to`,
  `limit` (at most 500) and `cursor`. Meals, steps and measurements reach the phone only through
  sync, for the last 90 IST days (ADR-0007 rule 1); targets are always on the phone.
- `GET /v1/me` returns `user.createdAt`, which Q-044 needs.
- Body weight is shown with `formatWeight` and `fromGrams` from `@fitsphere/shared`; lengths with
  `fromMillimetres` and the phone's cm/in choice (`measurement_unit`).
- There is no chart or SVG package. The chart is drawn with plain React Native views, so no native
  package and no cloud build are needed.

## Decisions
**1. Working beside slice 6.**
- Slice 6 owns the theme and the unit settings; Progress uses them (agreed with the slice-6
  session on 2026-10-30):
  - **Colours:** every Progress colour, text included, comes from `useTheme().colors` in
    `apps/mobile/src/theme.tsx`, with slice 6's token names. If that file is not on main when step
    2 is opened, step 2 adds it with the light colours only; when the slices meet, slice 6's file
    is kept (the owner's answer, D-P1).
  - **Body-weight unit:** every Progress weight goes through one hook, `useProgressWeightUnit()`
    in `apps/mobile/src/progress/units.ts`. It returns `BODY_WEIGHT_UNIT` until slice 6's
    `useBodyWeightUnit()` is on main; whichever slice merges second changes that one line. The
    calculation and text functions take the unit as a parameter, and their tests use kg and lb.
  - **Length unit:** the phone's cm/in choice, unchanged.
- Slice 6 has migration `0008_settings.sql` and phone schema version 7; Progress has neither. The
  only shared lines are the `MetaKey` list in `store.ts` and possibly a screen line in
  `app/_layout.tsx`; a conflict there keeps both sides.
- Progress does not edit `HistoryScreen.tsx` or `WeighInList.tsx` (slice 6 restyles them), and
  reuses `MeasurementsCard` and `MeasurementsSheet` without changing them.
- IDs: D-P1 for this plan's approval, and E-P1 to E-P3 for the new backlog edge cases. They are
  temporary and get their final numbers when the slice is merged.
- Before each pull request, the branch is rebased on the latest main (the later steps on the step
  before them) and every check is run again.

**2. No new packages, so no EAS build.**

**3. Workflow as D-21.** One branch and one pull request per step; steps run back to back; the
owner's merges and the phone checks are batched at the end.

**4. The weekly rate (the owner's answer, D-P1).** Q-043's "weekly rate = change ÷ 4" assumes the
two weigh-ins are 28 days apart. The rate is the change ÷ the weeks between them, which is the same
at 28 days and correct for a user with one to three weeks of weigh-ins.

**5. MVP defaults** chosen under D-18 answer 3. They are listed in
[`constraints-and-assumptions.md`](../architecture/constraints-and-assumptions.md#mvp-defaults-d-18)
in the step that builds each one, and in each pull request.

| Question | MVP default |
|---|---|
| The cards' period | The last 28 IST days, today included (REQ-PRG-002's 4 weeks) |
| 4-week change (Q-043) | The latest weigh-in on the phone minus the weigh-in nearest 28 days before it, among those at least a week earlier (on a tie, the earlier one). Shown as "Down 1.2 kg since Fri 2 Oct", "Up …" or "No change since …", in the body-weight unit |
| Less than a week of weigh-ins | The change is measured from the oldest weigh-in and the rate is replaced by "Not enough data for a weekly rate yet. Log your weight for at least a week." (REQ-PRG-001). With one weigh-in, only the latest weight shows; with none, "No weigh-ins yet. Log your weight on Home." |
| Weekly rate | The change ÷ the weeks between the two weigh-ins (decision 4), shown as "Down 0.3 kg a week", "Up …" or "No weekly change" |
| Average calories (REQ-PRG-002) | The mean of the daily kcal over the days in the period with at least one meal (Q-043), in whole kcal: "1,850 kcal a day", with the calorie target. With no target: "No calorie target" and "Set a target"; with no meals: "No meals logged in the last 4 weeks." |
| Days logged (Q-044) | "Meals logged: X of Y days". X is the days in the period with at least one meal; Y counts from the IST day the account was created, at most 28. That day is read from `GET /v1/me` once and kept on the phone (`account_created_day`); while it is unknown (offline), Y is 28 |
| Which entries count | Every entry on the phone, including those waiting to sync, as on Home |
| Week table (REQ-PRG-005) | This Mon–Sun week and the 11 before it, which the phone always holds, newest first, none before the week the account was created; "This week", then each week's Monday ("19 Oct"). Each cell is the average over the week's days with an entry (Q-043): body weight with one decimal in the body-weight unit, kcal, protein in grams and steps as whole numbers; "–" when there is none |
| Target row | The first row: the calorie, protein, target body weight and daily steps targets, the user's own (D-20), one current value each (E-11); "–" when one is not set |
| Chart ranges (REQ-PRG-004) | 4W is shown first. 1W, 4W and 12W come from the phone, each weigh-in a point. 26W and All also read older weigh-ins online with the existing route, following its cursor; All starts at the day the account was created. They are kept in memory only (ADR-0007 rule 1) and plotted as weekly averages, one point per Mon–Sun week, so the chart stays light on a low-end phone. An account newer than 90 days reads nothing online |
| Chart empty state | Fewer than 2 points in the range: "Your trend shows once you have 2 weigh-ins in this range." |
| Chart offline (ADR-0007 rule 6) | 26W and All offline: "Showing 26 weeks of weight needs an internet connection." or "Showing all your weight needs an internet connection."; a failure: "Something went wrong. Try again later." |
| Chart look | A line through the points with a dot on each, the lowest and highest values at the left, the first and last dates below. Its accessibility label sums up the range |
| Measurements (REQ-PRG-006) | The phone's 90 days, newest first, each as the Home measurements card with "Edit measurements", and "Add measurements" above them. With none: "No measurements yet.", "Track your upper and lower waist once a week." and "Add first". Adding opens the sheet on today |
| The weight history | It stays, unchanged, on its own screen, opened by "All weigh-ins" on Progress, so the checks that use it still work |

## Steps
### Step 1: Calculations, range query, account start day (REQ-PRG-001…005)
**Builds:** `progress/calculations.ts` (the 4-week weight, average calories, days logged, the
week rows, the chart points and weekly averages, merging older weigh-ins); `progress/texts.ts`;
`progress/units.ts`; `progress/account.ts` (the account's creation day from `GET /v1/me`, kept
on the phone); `dailyNutrition` in `local/store.ts`, each day's kcal and protein between two days;
this plan, D-P1, the Q-043 rows, `CLAUDE.md` and the docs index.

**Tests**
- The weigh-in nearest 28 days back, ties, a rate over 4 weeks and over 10 days, less than a week,
  none and one, and a recent weigh-in passed over for one a week or more earlier.
- Averages count only days with meals; days logged for an older account, a 3-day-old one, one
  created today and an unknown creation day.
- The week rows: 12 weeks within the 90 days, none before the account's week, averages per
  week, a week across a month boundary.
- The chart points per range, weekly averages on Mondays, which ranges read online, and the
  phone winning over the server for a day.
- The texts in kg and lb; the creation day in IST, kept once, and none offline.
- `dailyNutrition` sums each day and leaves out days outside the range.

### Step 2: The Progress screen (REQ-PRG-001…003, REQ-PRG-005, REQ-PRG-006)
**Builds:** `ProgressScreen` (the weight card, the calories and days-logged card, the week table
with its Target row, the Measurements section) and the hook that reads the phone's data and
re-reads after each sync; the Progress tab opens it; the weight history moves to its own route,
`weight-history`, opened by "All weigh-ins"; the colours from the theme (decision 1).

**Tests:** each card with data and empty; the not-enough-data text; the Target row with and
without targets; the week table's values; "Add first" opens the sheet and the saved entry is
listed; Edit opens an entry; "All weigh-ins" opens the history; the existing history and tab
tests pass unchanged.

### Step 3: Weight trend chart; close-out (REQ-PRG-004)
**Builds:** the chart's geometry (points to dots and line pieces) and `WeightChart`, drawn with
views; the range buttons; reading older weigh-ins online with paging.

**Tests:** the geometry; the empty state with 0 or 1 point; switching ranges; 26W online with the
server's and the phone's weigh-ins; the named warning offline; the failure text; All across two
pages.

**Close-out:** the MVP defaults in `constraints-and-assumptions.md`; E-P1 to E-P3 in `backlog.md`;
notes on REQ-PRG-001 to REQ-PRG-006; the device checks in `test-strategy.md`; the links in
`mvp-scope.md` and the docs index; `CLAUDE.md`; this plan's progress.

New backlog edge cases: E-P1 the week table and measurements for weeks older than the 90 days
the phone holds, online (needs read routes); E-P2 tapping a chart point to see its value and date;
E-P3 the target body weight as a line on the chart.

## Owner's checks at the end of the slice
1. Merge the three pull requests in step order, each with green CI, rebased on the latest main
   with the IDs made final.
2. Phone checks on the existing development build (no new build), with test data only; the owner
   starts `npm run dev:phone`:
   1. Progress shows the weight card, average calories against the target, "Meals logged: X of Y
      days", the week table with the Target row, and Measurements.
   2. With less than a week of weigh-ins: the not-enough-data text.
   3. The chart: 1W, 4W and 12W switch; with fewer than 2 weigh-ins in a range, the empty state;
      26W and All online; in airplane mode, the named warning.
   4. "Add first" (or "Add measurements") opens the sheet; the saved entry is listed; Edit
      changes it, and Home's card shows the same entry.
   5. Change a target in Your targets: the Target row and the calories card follow.
   6. "All weigh-ins" opens the weight history, with "Load older".
   7. The table and the chart fit the screen without scrolling sideways.

## Risks
- **Slice 6 merges first:** `BODY_WEIGHT_UNIT` disappears and typecheck fails until
  `useProgressWeightUnit()` returns `useBodyWeightUnit()` (one line); two `theme.tsx` files are
  resolved by keeping slice 6's. The two sessions tell each other about any change of name.
- **A chart drawn with views on a low-end phone:** 12W has at most 84 points; 26W and All are
  weekly averages.
- **The creation day unknown offline:** "Meals logged" counts 28 days until it is read.

## Verification
- For every pull request, on the PC and in CI: `npm run lint`, `npm run typecheck`, `npm test`
  (both time zones in CI) and `npm run test:integration`. Each pull request says what passed,
  what failed and what was not run.
- End to end: the owner's checks above, recorded in this plan's progress table.
