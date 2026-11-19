# ADR-0011: A training section on Home, read from the phone's own workout data

- Status: **Proposed** — waiting for the decision owner. Nothing is built until it is Accepted and
  the Home screen's new design is locked on the owner's canvas (`docs/plans/ui-redesign.md`).
- Date: 2026-11-19
- Decision owner: Project owner
- Related requirements: REQ-HOME-* (Home), REQ-TRN-003, REQ-TRN-004, REQ-TRN-008, REQ-NAV-002
- Related constraints: C-005 (works without AI), D-04 (offline), D-20 (Personal Training User only),
  D-103 (Home's nutrients, no workouts card), D-108 (a workout with no exercise is not logged),
  D-110 (no weekly workout line on Home)
- Amends: nothing Accepted. It would reverse part of D-103 and D-110 only if option C below is chosen;
  that needs the owner's word.

## Context
Home leads with the selected day's food: a Calories card with protein, carbs, fat and fibre against the
day's targets (D-103), then weigh-in, steps and sleep tiles and a Measurements card. Training appears on
Home only as a green dumbbell under each day of the date strip. The "Workouts this week" card was removed
in D-103 and the "3 of 4 workouts this week" line in D-110, so Home shows nothing about the day's workouts,
time trained or calories burned, while Nutrition has a full section. The owner asked what training could
be added to Home to match.

All the data already exists on the phone: workouts and their exercises, the workout timer (D-71),
calories burned per exercise (D-50 step 3), and the exercise statistics behind Progress (D-82). Nothing
here needs the server, AI or a new table.

## Decision criteria
1. **Must:** reads only the phone's local data, so it works offline and without AI (C-005, D-04).
2. **Must:** follows the same rules as Training: a workout with no exercise is not listed or counted
   (D-108); the selected date, including an older date read online (D-106).
3. **Must:** health data stays out of logs and fixtures (invariant #7); units follow the display
   settings (invariant #6).
4. **Should:** matches Home's existing pattern (a card, a link to the full tab) and does not make
   Home much longer.
5. **Should:** no migration, no server change, no new build (D-19).

## Options considered
### Option A — a "Today's workout" card
- A card under the nutrition panel listing the selected date's workouts, each with its exercise count and
  timer state ("Running", "Paused", "Done · 42 min"). A "By workout" link opens the Training tab, as "By
  meal" opens Nutrition. With no workout: "No workout yet" and a Log workout button.
- Benefits: the direct counterpart of the Calories card; reuses Training's By-day list and rules.
- Costs: one more card on Home.
### Option B — the day's training numbers beside the nutrition numbers
- Calories burned, total workout time and sets or volume lifted for the date, each with a thin bar where a
  target exists.
- Benefits: puts food and training in one view, and calories burned beside calories eaten.
- Costs: calories burned is an estimate (a MET-based figure unless typed over), so it must be labelled as
  one; there is no target for time or volume yet, so those would be plain numbers.
### Option C — weekly workout progress ("3 of 4 workouts this week")
- Benefits: gives the weekly target a place on Home.
- Costs: the owner removed exactly this in D-103 and D-110. It returns only if the owner reverses them.
### Option D — a record or progress line
- "New best: Bench press 62.5 kg", or a last-4-weeks mini graph, from `exerciseStats.ts`.
- Benefits: motivating; data exists.
- Costs: not every day has something to show; the line would come and go.
### Option E — a start or repeat shortcut
- A Start workout button for today, or "Repeat last workout".
- Benefits: fewer taps to begin. Costs: "Repeat last workout" is new behaviour needing its own rules; the
  Workout in progress pill already covers a running workout.

## Decision (proposed)
Option A together with B, as one card or a card plus a short row, designed on the canvas as boards that
the owner locks. Option C stays out unless the owner reverses D-110. D and E go to the backlog
(`docs/product/backlog.md`). The card reads the phone's local database only: no new endpoint, migration or
phone schema version. Screen readers hear the same content as the card shows.

## Why this option wins
It gives training the same place on Home that food has, from data already on the phone, without
reversing a decision the owner made two days ago and without server or build changes.

## Why alternatives were rejected
C contradicts D-110 without the owner asking for it. D and E are useful but optional; E needs new rules.

## Counterfactual
If the owner wants a weekly target on Home, C becomes the better choice and D-110 is replaced by a new
decision. If Home grows too long on the phone, B alone, as a single row, would be the lighter choice.

## Validation
- Unit tests for the day's workout list and totals (a workout with no exercise left out; an older date;
  a running timer).
- A phone check on the owner's device, offline, on today and on a past date (no build needed).
- The owner locks the canvas boards before any code is written.

## Open questions
- Which options (A, B, C) does the owner choose, and is the weekly target to return to Home?
- Should calories burned show on Home at all, since it is an estimate (R-011)?
