# Slice 4, Training: manual test guide

- Status: **Ready to run.** No result is recorded yet; only the tester marks Pass or Fail.
- Prepared: 2026-10-30, from `main` at `c24546b` (slices 3 and 4 merged), by reading the app's code
  and tests. Every text in quotes below is copied from the code.
- Plan: [`training-slice.md`](../plans/training-slice.md), "Owner's checks at the end of the slice",
  phone checks 1 to 8 (D-29).
- Companion guide: [`slice-3-manual-testing.md`](slice-3-manual-testing.md) (Meal logging). Run it
  first; this guide reuses its prerequisites.

## How to use this guide
- Run the tests **in the order written**: later tests use the workouts earlier tests create, and
  the expected weekly counts depend on it.
- Tick **Pass** only if every "You should see" line and the final expected result match. Otherwise
  tick **Fail** and write what you saw (a screenshot helps).
- **Synthetic data only.** The exercises, weights and notes below are test values.
- **Android shows button labels in capitals.** **Log workout** appears on the phone as
  LOG WORKOUT. (It was named "Log workout" until D-37, 2026-11-03.)
- "Today" and "7 days ago" are IST days. Examples use Fri 30 Oct 2026 and Fri 23 Oct 2026; your
  dates will differ. **Run the whole guide within one IST day**, away from midnight.
- The header at the top of each tab shows the **selected date** ("Today · Fri 30 Oct", or just
  "Fri 23 Oct" for a past day). A new workout is created on that date. **📅** opens the calendar.
- Running these tests writes synthetic workouts for your test account to `fitsphere-dev`. The
  cleanup deletes them; a deleted workout stays on the server as an empty row marked deleted, by
  design. S4-18 also saves a weight, steps and sleep for today, which the app cannot delete.

## What is covered

| Area | Status | Tests |
|---|---|---|
| Training tab: "No training plan yet.", **Log workout**, "Workouts you have logged" | Implemented | S4-01 |
| Starting a workout (on the selected date; counts at once, even empty) | Implemented | S4-03, S4-11, S4-13 |
| Exercises: name, sets, reps, weight in kg (optional), note (optional) | Implemented | S4-04 to S4-06 |
| Exercise limits and messages; Cancel saves nothing | Implemented | S4-07, S4-08, S4-10 |
| Editing and removing an exercise | Implemented | S4-09, S4-10 |
| Deleting a workout, after confirming | Implemented | S4-12, S4-15 |
| Several workouts on one day | Implemented | S4-11 |
| Past dates and the history (newest first, last 90 days on the phone) | Implemented | S4-13, S4-17 |
| Home workout tracker ("N of T · M left", "target reached", Mon to Sun circles) | Implemented | S4-02, S4-03, S4-11 to S4-15 |
| Offline workouts and sync | Implemented | S4-14 |
| "Load older": older workouts from the server, view-only | Implemented | S4-16 |
| Workouts come back after log out and sign in | Implemented | S4-17 |
| Weight, steps and sleep still save (regression) | Implemented (slice 2) | S4-18 |
| Up to 30 exercises per workout | Implemented | S4-19 (optional) |
| Training plans or workout templates from a coach; logging a planned workout | **Not implemented** (post-MVP, D-20; REQ-TRN-001, REQ-TRN-006, REQ-TRN-007; backlog B-21). The tab always says "No training plan yet." | — |
| Choosing exercises from a list, exercise instructions, images or videos | **Not implemented.** Names are typed freely; there is no exercise library (Q-042 MVP default). Name suggestions are backlog E-17 | — |
| A workout timer, a "Finish" or "Complete" step, duration, rest, RPE | **Not implemented.** Each change saves at once; **Done** only goes back (D-29). Duration, RPE and rest are backlog E-14 | — |
| Different reps or weight per set | **Not implemented** (backlog E-14) | — |
| Changing a workout's date | **Not implemented** (backlog E-15): the date is fixed when the workout starts | — |
| Editing or deleting workouts older than 90 days | **Not implemented** (backlog E-16): they are view-only | — |
| Lifting weight in lb | **Not implemented** until the Settings slice: kg only | — |
| Workout progress charts or records | **Not implemented** (Progress slice, slice 5). The Progress tab shows the weight history only | — |

Not testable by hand (covered by the automated tests): a change the server refuses ("This workout
wasn't saved: <reason>. Edit or discard it."), a workout deleted on another phone ("This workout is
not on this phone."), and another user's workouts never being returned.

## Prerequisites

| # | What | How to confirm |
|---|---|---|
| P-01 | Slice 3 guide prerequisites P-01 to P-06 are done: `main` at `c24546b` or later; **migration 0007 applied** (`npm run migrate -w @fitsphere/api` printed `Applied: 0006_dishes.sql, 0007_workouts.sql` or `Nothing to apply.`); the 2026-10-29 development build; `npm run dev:phone` running; signed in with the test account | Account › Development shows "Sync: synced" and "API: ok". No new build is needed for Training (no new native code) |
| P-02 | **Weekly workouts** target is 4: Account › **Your targets** › **Weekly workouts** › type `4` › **Save** | The row shows "4 workouts" and "Set by you". With another target T, read "of 4" as "of T". With none, Home shows "<n> workouts this week" and **Set a weekly workout target** |
| P-03 | Clean start: Training shows "No workouts logged yet." If it lists workouts from earlier testing in this week or the week of 7 days ago, open each and delete it (**Delete workout** › **Delete**), or write down how many there are and add them to every count below | — |
| P-04 | Only if the phone ever ran a Training build from before the merge (temporary schema): Account › **Log out**, then sign in again, so the phone's database is created at the current version | — |
| P-05 | The selected date is today: the header shows "Today · <date>". If not, tap **Back to today** on Home | — |

## Test data

| Used in | Exercise | Sets | Reps | Weight (kg) | Note | Shown as |
|---|---|---|---|---|---|---|
| S4-04, S4-09 | Bench press | 3 | 10, then 12 | 40, then `42,5` | `Synthetic test note` | "3 sets  10 × 40.0 kg", then "3 sets  12 × 42.5 kg" (D-63) |
| S4-05 | Push-ups (removed in S4-10) | 3 | 15 | empty | empty | "3 × 15" |
| S4-06 | Squat | 4 | 8 | 60.5 | empty | "4 × 8 × 60.5 kg" |
| S4-08 | Test max (removed) | 20 | 200 | 500, then 0.1 | empty | "20 × 200 × 500.0 kg", then "20 × 200 × 0.1 kg" |
| S4-13 | Deadlift (7 days ago) | 3 | 5 | 80 | empty | "3 × 5 × 80.0 kg" |
| S4-14 | Lunges (offline) | 3 | 12 | empty | empty | "3 × 12" |

Limits (MVP defaults, D-29): name 1 to 80 characters; sets 1 to 20; reps 1 to 200; weight empty or
0.1 to 500.0 kg with at most one decimal (a dot or a comma); note up to 500 characters; up to 30
exercises per workout.

### Expected Home count ("Workouts this week", today's week)
| After | Text | Filled circles |
|---|---|---|
| Start | "0 of 4 · 4 left" | none |
| S4-03 | "1 of 4 · 3 left" | today's |
| S4-11 | "2 of 4 · 2 left" | today's only (one circle per day) |
| S4-12 | "1 of 4 · 3 left" | today's |
| S4-13 | "1 of 4 · 3 left" (the workout 7 days ago counts in its own week) | today's |
| S4-14 | "2 of 4 · 2 left" | today's |
| S4-15 | "4 of 4 · target reached", then "2 of 4 · 2 left" | today's |

---

## Part A: The Training tab and starting a workout

### S4-01 · Training tab before any workout
**Screen:** Training · **Covers:** REQ-TRN-002, REQ-TRN-004, D-20, plan phone check 1 · **Start:** Home, today selected · **Data:** none

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | Bottom bar: **Training** | — | The header with "Today · <date>" |
| 2 | Look at the top of the screen | — | A grey box "No training plan yet."; under it the button **Log workout** |
| 3 | Look below the button | — | The heading "Workouts you have logged" and "No workouts logged yet." |
| 4 | Look at the bottom | — | A **Load older** button |
| 5 | Look for anything else | — | No workout list or templates, no exercise library, no plan to follow (not in the MVP) |

**Final expected result:** the Training tab shows the empty state with its exact texts.

**Result**
- [ ] Pass
- [ ] Fail
- Actual result / notes:

### S4-02 · Home workout tracker before any workout
**Screen:** Home › "Workouts this week" · **Covers:** REQ-HOME-007 · **Start:** Training · **Data:** Weekly workouts target 4

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | Bottom bar: **Home**; scroll down past the Weight, Steps and Sleep tiles | — | A card "Workouts this week" with "0 of 4 · 4 left" |
| 2 | Look under that text | — | Seven empty (outlined) circles with the letters M, T, W, T, F, S, S under them |

**Final expected result:** the tracker shows no workouts against the target of 4.

**Result**
- [ ] Pass
- [ ] Fail
- Actual result / notes:

### S4-03 · Log workout; it counts at once
**Screen:** Training › Log workout → Workout · **Covers:** REQ-TRN-003, Q-025, REQ-HOME-007, plan phone check 2 · **Start:** Home, today selected · **Data:** none

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | Bottom bar: **Training**; tap **Log workout** | — | A screen with the title bar "Workout" and a back arrow. Inside: "Workout · Fri 30 Oct" (today), possibly "Waiting to sync" for a moment, "No exercises yet.", and buttons **Add exercise**, **Done** and a red **Delete workout** |
| 2 | Tap **Done** | — | Training. "No workouts logged yet." is gone; one row: "Fri 30 Oct" and "No exercises" (and "waiting to sync" only until it syncs) |
| 3 | Bottom bar: **Home** | — | "Workouts this week": "1 of 4 · 3 left"; today's circle filled blue |

**Final expected result:** a workout is created on today the moment it starts, with no exercises,
and counts toward the week at once.

**Result**
- [ ] Pass
- [ ] Fail
- Actual result / notes:

---

## Part B: Exercises

### S4-04 · Add an exercise with a weight and a note
**Screen:** Training › workout row → Workout › Add exercise · **Covers:** REQ-TRN-003, REQ-TRN-005, Q-042, plan phone check 3 · **Start:** Home, today selected · **Data:** Bench press, 3, 10, 40, `Synthetic test note`

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | **Training**; tap the row "Fri 30 Oct · No exercises" | — | The workout screen from S4-03 |
| 2 | Tap **Add exercise** | — | A sheet "Add exercise" with "Exercise name" (keyboard open), then "Sets", "Reps" and "Weight in kg (optional)" side by side, then "Note (optional)"; buttons **Save exercise** and **Cancel** (no Remove button for a new exercise) |
| 3 | Exercise name | `Bench press` | — |
| 4 | Sets, Reps, Weight in kg | `3`, `10`, `40` | — |
| 5 | Note | `Synthetic test note` | — |
| 6 | Tap **Save exercise** | — | The sheet closes. "No exercises yet." is gone; a card "Bench press", "3 sets  10 × 40.0 kg", "Synthetic test note" |

**Final expected result:** the exercise is saved at once with its sets, reps, weight in kg (one
decimal shown) and note.

**Result**
- [ ] Pass
- [ ] Fail
- Actual result / notes:

### S4-05 · Add an exercise without a weight
**Screen:** Workout › Add exercise · **Covers:** REQ-TRN-003, Q-042 (weight optional) · **Start:** the workout screen from S4-04 · **Data:** Push-ups, 3, 15, weight empty, note empty

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | Tap **Add exercise** | — | An empty "Add exercise" sheet |
| 2 | Exercise name, Sets, Reps | `Push-ups`, `3`, `15` | — |
| 3 | Leave Weight and Note empty; tap **Save exercise** | — | A second card "Push-ups" and "3 × 15" (no weight, no note line) |

**Final expected result:** an exercise without a weight is saved and shown as sets × reps only.

**Result**
- [ ] Pass
- [ ] Fail
- Actual result / notes:

### S4-06 · Add a third exercise; the history row
**Screen:** Workout › Add exercise; Training · **Covers:** REQ-TRN-003, REQ-TRN-004 · **Start:** the workout screen · **Data:** Squat, 4, 8, 60.5

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | **Add exercise**; Exercise name, Sets, Reps, Weight | `Squat`, `4`, `8`, `60.5` | — |
| 2 | **Save exercise** | — | Third card "Squat", "4 × 8 × 60.5 kg" |
| 3 | Tap **Done** | — | Training row: "Fri 30 Oct" and "3 exercises · Bench press, Push-ups, Squat" |
| 4 | **Home** | — | Still "1 of 4 · 3 left" (exercises don't add workouts) |

**Final expected result:** the history row counts the exercises and names them.

**Result**
- [ ] Pass
- [ ] Fail
- Actual result / notes:

### S4-07 · Exercise limits and messages; Cancel saves nothing
**Screen:** Workout › Add exercise · **Covers:** REQ-TRN-003, Q-042 limits (D-29), Q-029, plan phone check 3 · **Start:** Training › today's row → workout · **Data:** the values below

The red message appears under "Note (optional)" and changes only when you tap **Save exercise**
again. Fields are checked in order: name, sets, reps, weight, note.

| # | Tap / do | Enter or select | You should see after tapping **Save exercise** |
|---|---|---|---|
| 1 | **Add exercise**; leave everything empty; **Save exercise** | — | "Enter a name of up to 80 characters." The sheet stays open |
| 2 | Exercise name only spaces | `   ` | The same message |
| 3 | Exercise name | `Test validation` (Sets empty) | "Enter sets from 1 to 20." |
| 4 | Sets | `0` | "Enter sets from 1 to 20." |
| 5 | Sets | `21` | "Enter sets from 1 to 20." |
| 6 | Sets `3`; Reps | `0` | "Enter reps from 1 to 200." |
| 7 | Reps | `201` | "Enter reps from 1 to 200." |
| 8 | Reps `10`; Weight | `0` | "Enter a weight from 0.1 to 500.0 kg, with at most one decimal, or leave it empty." |
| 9 | Weight | `500.1` | The same weight message |
| 10 | Weight | `40.25` | The same weight message (two decimals) |
| 11 | *Optional:* clear Weight; Exercise name (81 characters) | `Test exercise name that is far too long for the limit of eighty characters, ok 12` | "Enter a name of up to 80 characters." |
| 12 | Tap **Cancel** | — | The sheet closes. The workout still has exactly Bench press, Push-ups and Squat; no "Test validation" |
| 13 | **Add exercise**; type `Cancel check`, `1`, `1`; press Android **Back** instead of saving | — | The sheet closes; nothing is added |

A note over 500 characters is refused with "Notes can be up to 500 characters." (covered by the automated
tests; too long to type by hand).

**Final expected result:** values outside the limits are refused with the message for the first
wrong field, nothing is saved until every field is valid, and Cancel or Back saves nothing.

**Result**
- [ ] Pass
- [ ] Fail
- Actual result / notes:

### S4-08 · The ends of each range are accepted
**Screen:** Workout › Add exercise / Edit exercise · **Covers:** Q-042 limits (D-29) · **Start:** the workout screen · **Data:** Test max, 20, 200, 500, then 0.1

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | **Add exercise**; Exercise name, Sets, Reps, Weight | `Test max`, `20`, `200`, `500` | — |
| 2 | **Save exercise** | — | A card "Test max", "20 × 200 × 500.0 kg" |
| 3 | Tap the "Test max" card | — | A sheet "Edit exercise", filled in: `Test max`, `20`, `200`, `500.0`; buttons **Save exercise**, **Remove exercise**, **Cancel** |
| 4 | Weight | `0.1` | **Save exercise**: the card shows "20 × 200 × 0.1 kg" |
| 5 | Tap the card; **Remove exercise** | — | "Test max" is gone; Bench press, Push-ups and Squat remain |

**Final expected result:** 20 sets, 200 reps, 500.0 kg and 0.1 kg are all accepted.

**Result**
- [ ] Pass
- [ ] Fail
- Actual result / notes:

### S4-09 · Edit an exercise (a comma as the decimal mark)
**Screen:** Workout › exercise card → Edit exercise · **Covers:** REQ-TRN-003, plan phone check 3 · **Start:** the workout screen · **Data:** Bench press: reps 12, weight `42,5`

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | Tap the "Bench press" card | — | "Edit exercise" filled in: `Bench press`, `3`, `10`, `40.0`, `Synthetic test note` |
| 2 | Reps | `12` | — |
| 3 | Weight (type a comma; if the keyboard has no comma, type `42.5`) | `42,5` | — |
| 4 | **Save exercise** | — | The card shows "3 × 12 × 42.5 kg" and still "Synthetic test note"; it keeps its place at the top |

**Final expected result:** the edit replaces the exercise's values, and a comma is read as a
decimal mark.

**Result**
- [ ] Pass
- [ ] Fail
- Actual result / notes:

### S4-10 · Remove an exercise without confirmation; Cancel keeps an edit unsaved
**Screen:** Workout › exercise card → Edit exercise · **Covers:** REQ-TRN-003 (MVP default: removing an exercise asks nothing), Q-029 · **Start:** the workout screen · **Data:** Push-ups; Squat sets 5 (cancelled)

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | Tap the "Push-ups" card; tap **Remove exercise** | — | The sheet closes and "Push-ups" is gone at once, with no question asked |
| 2 | Tap the "Squat" card; change Sets | `5` | — |
| 3 | Tap **Cancel** | — | "Squat" still shows "4 × 8 × 60.5 kg" |
| 4 | **Done** | — | Training row: "Fri 30 Oct", "2 exercises · Bench press, Squat" |

**Final expected result:** an exercise is removed straight away, and a cancelled edit changes
nothing.

**Result**
- [ ] Pass
- [ ] Fail
- Actual result / notes:

---

## Part C: More workouts, deleting, other days

### S4-11 · Two workouts on one day
**Screen:** Training; Home tracker · **Covers:** REQ-TRN-003, REQ-HOME-007 (D-29: several a day, each counts, one circle) · **Start:** Training, today selected · **Data:** none

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | Tap **Log workout** | — | A new workout: "Workout · Fri 30 Oct", "No exercises yet." |
| 2 | **Done** | — | Training lists two rows for today, newest first: "Fri 30 Oct · No exercises", then "Fri 30 Oct · 2 exercises · Bench press, Squat" |
| 3 | **Home** | — | "2 of 4 · 2 left"; only today's circle filled |

**Final expected result:** a second workout on the same day is allowed and counts; the day still
has one circle.

**Result**
- [ ] Pass
- [ ] Fail
- Actual result / notes:

### S4-12 · Delete a workout (Keep first)
**Screen:** Workout › Delete workout · **Covers:** REQ-TRN-003, plan phone check 5 · **Start:** Training · **Data:** the empty workout from S4-11

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | Tap the row "Fri 30 Oct · No exercises" | — | Its workout screen |
| 2 | Tap **Delete workout** | — | A red-bordered box: "Delete Workout N on Fri 30 Oct?" (N is its number that day) and "You can't undo this." (it has no exercises), with **Keep** and a red **Delete** (D-63) |
| 3 | Tap **Keep** | — | The box closes; the workout is still open; **Delete workout** is back |
| 4 | **Delete workout** › **Delete** | — | Back on Training; only "Fri 30 Oct · 2 exercises · Bench press, Squat" is left |
| 5 | **Home** | — | "1 of 4 · 3 left" |

**Final expected result:** a workout is deleted only after confirming, and it leaves the history
and the weekly count.

**Result**
- [ ] Pass
- [ ] Fail
- Actual result / notes:

### S4-13 · A workout on a past date
**Screen:** header 📅 → Training › Log workout · **Covers:** REQ-TRN-003, Q-011, REQ-HOME-007 (D-23: the selected date's week), plan phone check 4 · **Start:** Home, today selected · **Data:** 7 days ago; Deadlift 3, 5, 80

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | Header **📅**; tap the date 7 days before today (use ‹ if it is in last month) | e.g. 23 | The header shows "Fri 23 Oct" (no "Today ·"); Home shows "Showing Fri 23 Oct" and **Back to today** |
| 2 | **Training**; **Log workout** | — | "Workout · Fri 23 Oct" |
| 3 | **Add exercise**: Exercise name, Sets, Reps, Weight | `Deadlift`, `3`, `5`, `80` | **Save exercise**: "Deadlift", "3 × 5 × 80.0 kg" |
| 4 | **Done** | — | Training: today's row first, then "Fri 23 Oct · 1 exercise · Deadlift" |
| 5 | **Home** (Fri 23 Oct still selected) | — | "Workouts this week": "1 of 4 · 3 left", with that weekday's circle filled (the week of 23 Oct) |
| 6 | Tap **Back to today** | — | "1 of 4 · 3 left" with only today's circle filled: the Deadlift workout is not in this week |

**Final expected result:** a workout started with a past date selected belongs to that day, is
listed under it, and counts only in that day's week.

**Result**
- [ ] Pass
- [ ] Fail
- Actual result / notes:

---

## Part D: Offline, target, history and data back

Before S4-14: check the header says "Today · <date>". For offline, turn on **Aeroplane mode** and
check that **Wi-Fi and mobile data are both off**. Keep FitSphere open; don't swipe it away or
reload it (the development build loads its code from the PC). A message about the development
server being disconnected can be ignored.

### S4-14 · Offline: start a workout, add an exercise, then sync
**Screen:** Training, Workout, Home, offline · **Covers:** REQ-NFR-004, ADR-0007 step 1 (workouts), plan phone check 6 · **Start:** Training, today selected, **aeroplane mode on** · **Data:** Lunges 3, 12

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | **Log workout** | — | "Workout · Fri 30 Oct" and **"Waiting to sync"** under it |
| 2 | **Add exercise**: Exercise name, Sets, Reps | `Lunges`, `3`, `12` | **Save exercise**: "Lunges", "3 × 12"; "Waiting to sync" still shown |
| 3 | **Done** | — | Training: newest first "Fri 30 Oct · 1 exercise · Lunges" with "waiting to sync", then "Fri 30 Oct · 2 exercises · Bench press, Squat", then "Fri 23 Oct · 1 exercise · Deadlift" |
| 4 | **Home** | — | "2 of 4 · 2 left" (a workout waiting to sync counts) |
| 5 | Turn **aeroplane mode off**; wait up to 30 seconds with FitSphere open; go to **Training** | — | "waiting to sync" is gone from the Lunges row |
| 6 | Account (round letter) › Development | — | "Sync: synced" |
| 7 | *Optional, on the PC, read only:* Supabase dashboard › Table Editor › schema `app` › `workouts` | — | Rows for your workouts; in the Bench press row, `exercises` holds `"weightGrams": 42500` (the weight is stored in grams, invariant #6). Don't edit rows |

If "waiting to sync" stays after a minute, switch to another app and back, then see Troubleshooting.

**Final expected result:** a workout started and filled offline is kept on the phone, counts at
once, and syncs by itself when the connection returns.

**Result**
- [ ] Pass
- [ ] Fail
- Actual result / notes:

### S4-15 · Weekly target reached, then back
**Screen:** Training; Home tracker · **Covers:** REQ-HOME-007 (D-23 "target reached") · **Start:** Training, today selected, online · **Data:** two empty workouts

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | **Log workout** › **Done**; again **Log workout** › **Done** | — | Two new rows "Fri 30 Oct · No exercises" at the top |
| 2 | **Home** | — | "4 of 4 · target reached"; only today's circle filled |
| 3 | **Training**; open each "No exercises" row; **Delete workout** › **Delete** | — | Both are gone |
| 4 | **Home** | — | "2 of 4 · 2 left" |

**Final expected result:** at the target the tracker says "target reached", and deleting workouts
lowers the count again.

**Result**
- [ ] Pass
- [ ] Fail
- Actual result / notes:

### S4-16 · "Load older": offline warning, then online
**Screen:** Training › Load older · **Covers:** REQ-TRN-004, ADR-0007 rules 1 and 6 (D-29), plan phone check 7 · **Start:** Training · **Data:** none

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | Turn **aeroplane mode on** (Wi-Fi and data off). On Training, scroll to the bottom; tap **Load older** | — | "Loading older workouts needs an internet connection." above the button |
| 2 | Turn **aeroplane mode off**; wait about 10 seconds; tap **Load older** | — | The message changes to "No workouts from <day 179 days ago> to <day 90 days ago>." For today = Fri 30 Oct 2026: "No workouts from Mon 4 May to Sat 1 Aug." |
| 3 | Tap **Load older** again | — | The next 90 days back: for today = 30 Oct, "No workouts from Tue 3 Feb to Sun 3 May." |
| 4 | *Only if older workouts exist on the account:* look at the rows added under the list | — | They show date and summary, never "waiting to sync", and tapping them opens nothing (view-only) |

If step 2 says "Something went wrong. Try again later.", the API could not answer: check Account ›
Development "API: ok", then Troubleshooting.

**Final expected result:** older workouts need the internet and say so offline; online, each tap
reads 90 more days from the server and shows them view-only, or says there are none.

**Result**
- [ ] Pass
- [ ] Fail
- Actual result / notes:

### S4-17 · Workouts come back after log out and sign in
**Screen:** Account › Log out → Sign in → Training, Home · **Covers:** REQ-NFR-004, REQ-ACC-008, plan phone check 6 · **Start:** Home, online, nothing "waiting to sync" · **Data:** the test account's email and password

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | Account (round letter) › **Log out** | — | The sign-in screen at once. If "<n> entries are not on the server yet. If you log out now, they are deleted from this phone." appears, tap **Stay signed in**, wait until "Sync: synced", and try again |
| 2 | Sign in with the test account | (email, password) | Home, today |
| 3 | **Training** (allow a few seconds for the first sync) | — | "Fri 30 Oct · 1 exercise · Lunges", "Fri 30 Oct · 2 exercises · Bench press, Squat", "Fri 23 Oct · 1 exercise · Deadlift". The deleted workouts are absent |
| 4 | Tap the Bench press row | — | "3 × 12 × 42.5 kg", "Synthetic test note"; "Squat", "4 × 8 × 60.5 kg". **Done** |
| 5 | **Home** | — | "2 of 4 · 2 left" |

**Final expected result:** every workout, exercise, weight and note comes back from the server, and
deleted workouts stay deleted.

**Result**
- [ ] Pass
- [ ] Fail
- Actual result / notes:

### S4-18 · Weight, steps and sleep still save (regression)
**Screen:** Home › Weight, Steps, Sleep tiles · **Covers:** REQ-HOME-006, plan phone check 8 · **Start:** Home, today selected · **Data:** 70.5 kg; 8000 steps; 7.5 h

These values replace any weight, steps or sleep already saved for today on the test account, and
the app has no way to delete them. Skip this test if that matters.

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | Tap the **Weight** tile | `70.5` | A sheet "Weight · Fri 30 Oct" with a box and "kg". Type the value, **Save**: the tile shows "70.5 kg" |
| 2 | Tap the **Steps** tile | `8000` | Sheet "Steps · Fri 30 Oct". **Save**: the tile shows "8,000 steps" |
| 3 | Tap the **Sleep** tile | `7.5` | Sheet "Sleep · Fri 30 Oct". **Save**: the tile shows "7.5 h" |
| 4 | Wait a few seconds | — | No tile says "Waiting to sync" or "Not saved" |

**Final expected result:** the slice-2 tiles still save and sync next to the workouts.

**Result**
- [ ] Pass
- [ ] Fail
- [ ] Skipped
- Actual result / notes:

### S4-19 · Up to 30 exercises per workout (optional, about 10 minutes)
**Screen:** Workout › Add exercise · **Covers:** Q-042 limit (D-29) · **Start:** Training, today selected · **Data:** names `E1` to `E30`, sets `1`, reps `1`

| # | Tap / do | Enter or select | You should see |
|---|---|---|---|
| 1 | **Log workout** | — | A new workout |
| 2 | **Add exercise** 30 times | `E1` … `E30`, `1`, `1` | After the 30th, the **Add exercise** button is replaced by "A workout holds up to 30 exercises." |
| 3 | Tap any card › **Remove exercise** | — | **Add exercise** comes back |
| 4 | **Delete workout** › **Delete** | — | The workout is gone; Home "2 of 4 · 2 left" |

**Result**
- [ ] Pass
- [ ] Fail
- [ ] Skipped
- Actual result / notes:

---

## Cleanup

| # | What | How | Confirm |
|---|---|---|---|
| C-01 | Delete the test workouts | **Training**: open each row (Lunges, Bench press and Squat, Deadlift) › **Delete workout** › **Delete** | "No workouts logged yet."; Home "0 of 4 · 4 left" |
| C-02 | Server rows (optional, PC, read only) | After the next sync: Supabase › Table Editor › `app.workouts` | Your rows remain with `deleted_at` filled and `exercises` empty (by design, so other phones learn of the deletion) |
| C-03 | Targets | Leave or change them in Account › **Your targets** | — |
| C-04 | Stop | Ctrl+C once in the `dev:phone` terminal | It stops the API, the tunnel and Expo and empties `EXPO_PUBLIC_API_URL` |

## Troubleshooting
| Symptom | Likely cause and what to do |
|---|---|
| "Sync: failed" on Account, and workouts keep "waiting to sync" while online | Migration 0007 (or 0006) is not applied on `fitsphere-dev` (P-01); check `.dev-phone/api.log` |
| "Load older" says "Something went wrong. Try again later." | The API couldn't be reached or refused the request. Check "API: ok" on Account › Development and `.dev-phone/api.log` |
| App stuck on "Reloading…" | Force-stop the app (Android Settings › Apps › FitSphere › Force stop) and open it again |
| A row says "not saved" in red, and Training or Home shows "This workout wasn't saved: … Edit or discard it." | The server refused the change. Note the reason text and the steps; don't discard it before reporting |
| A workout was created on the wrong day | Check the header's date before tapping **Log workout**: a workout uses the selected date, which stays where you left it until you tap **Back to today** or restart the app |

## Results summary
| Test | Title | Result | Notes |
|---|---|---|---|
| S4-01 | Training tab before any workout | | |
| S4-02 | Home tracker before any workout | | |
| S4-03 | Log workout | | |
| S4-04 | Exercise with weight and note | | |
| S4-05 | Exercise without weight | | |
| S4-06 | Third exercise; history row | | |
| S4-07 | Limits and messages; Cancel | | |
| S4-08 | Range ends accepted | | |
| S4-09 | Edit an exercise (comma) | | |
| S4-10 | Remove an exercise; cancelled edit | | |
| S4-11 | Two workouts on one day | | |
| S4-12 | Delete a workout | | |
| S4-13 | Workout on a past date | | |
| S4-14 | Offline workout and sync | | |
| S4-15 | Target reached | | |
| S4-16 | Load older | | |
| S4-17 | Data back after log out and sign in | | |
| S4-18 | Weight, steps, sleep (regression) | | |
| S4-19 | 30 exercises (optional) | | |
