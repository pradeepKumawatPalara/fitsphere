# Targets by date plan

- Status: **Accepted** (the owner, in chat, 2026-11-11: "as recommended", then "lock it")
- Owner: Project owner (D-01)
- Last updated: 2026-11-11
- Answers: Q-014 ("do target changes apply from a date or to past days too?"), whose MVP default
  (D-23: one value per target, shown on every day) this replaces; closes backlog E-11. Decision
  D-77 (D-76 is food measures)
- Requirements: REQ-ROLE-007 (changed), REQ-ROLE-018 (new: Target history), REQ-HOME-003,
  REQ-HOME-004, REQ-HOME-007, REQ-NUT-005
- Design: the canvas's "6.2 Targets by date · LOCKED (D-77)" (boards `TargetsDated`,
  `TargetsDatedStates`, `TargetHistory`, `TargetHistoryStates`, `HomeTargetsByDate`,
  `HomeTargetsByDateStates`, version 72; locked in version 73)
- Branch: `feat/target-history`, in its own folder `D:\fitsphere-targets` (removed once merged)

## What the owner asked
2026-11-11: "If the user changes his target regarding any point like calories, daily protein, carbs
and so on, that latest value is also reflected to the old dates as well, which is wrong. As an end
user I have completed the target of yesterday and from today and for future I have set the new
targets. So whenever the target value is changed, the value should only be reflected to today and
future dates until the user changes the target again. For the past dates, targets should be those
which were on that date. I also want to maintain the history of each target by date, so the user
can see their own past targets as well."

## Why it happens today
The app keeps **one value per target** (Q-014's MVP default, D-23). A new value overwrites the old
one, on the phone and on the server, so every date shown (Home, Insight) reads the newest value.
The old values are not kept anywhere. The fix needs a change to how targets are stored, not only to
the screens.

## What the user sees (the canvas)
1. **Your targets.** The same tiles. Each tile's small line says since when its value holds:
   "Set by you · since 2 Nov", or "Set by you · from today" after a change today. Under the tiles,
   a new row **Target history** opens the new page.
2. **The entry sheet** (tapping a tile), one new line under the number: "From today, Wed 11 Nov.
   Earlier days keep the target they had." Nothing else changes.
3. **Target history** (new page, back arrow). A row of choices: **All**, Calories, Protein, Carbs,
   Fat, Fibre, Steps, Workouts, Body weight.
   - **All**: every change, newest first, under its date: "Daily calories 2,000 → 2,200 kcal".
     The first value of a target reads "Set to 2,000 kcal".
   - **One target** (e.g. Calories): its value now and since when, then each earlier value with its
     dates: "2 Nov – 10 Nov · 9 days · 2,000 kcal".
   - A target never set: "No calorie target yet" with **Set a target**. No targets at all: one
     message and **Set a target**.
4. **Home on a past date**: the calories and protein card use that date's targets; the workouts
   card uses that week's target. On a date before any target was set, the card says "No target on
   this day" in place of the Set a target button (setting one now would not change that day).
   Today looks as now.
5. **Insight on a past date**: the same: that date's calories, protein, carbs, fat and fibre
   targets, and "No target on this day" before any target.

**Progress does not change**: its Target row and "Target 2,000 kcal a day" show your targets now
(answer 3).

## The rules
- **A change starts today** (the day in India, invariant 5) and holds for every day after it, until
  the next change. Days before it keep the value they had. This is the owner's rule.
- **One value per target per day.** Changing the same target twice on one day keeps the last value
  of that day; the history shows that one.
- **Saving the value already in force changes nothing** (no line in the history).
- **Weekly workouts:** a week uses the target in force on its Sunday; for this week, that is
  today's target. So a change on Wednesday counts for this whole week (the owner's "from today").
- **Offline:** a change made offline belongs to the day it was made on the phone, even when it
  syncs a day later. Two phones changing the same target on the same day: the change the server
  receives last wins (Q-075, as now). Changes on different days are all kept.
- A target still can't be removed (D-23), and past values can't be edited: the history is
  read-only. Each value records who set it, so coach-set targets can follow later (invariant 2).
- The history is health data like the targets: it goes with the account when deleted (REQ-ACC-009),
  and no one else sees it (invariant 1, D-20).

## The owner's answers (2026-11-11, "as recommended")
1. **Days before the first target** have **no target**: "No target on this day" (Home, Insight),
   and Target history ends with "Before <date> · No target".
2. **Targets already set before this update** are **kept for every past day** back to the
   account's first day (the app never kept their older values, so nothing seen now changes); the
   history starts with the next change.
3. **Progress is left as it is**: today's targets in its Target row and its 4-week card.

## How targets are stored
Each target becomes a list of values by date:

| Field | What it holds |
|---|---|
| `kind` | calories, protein, carbs, fat, fibre, steps, weekly_workouts or body_weight (as now) |
| `day` | **New.** The day (India) the value starts; stored as its own field (invariant 5) |
| `value` | The value, in its canonical unit (invariant 6, as now) |
| `set_by_user_id`, `set_at` | Who set it and when (UTC), as now |

The value on a date is the one with the latest `day` on or before that date; none means no target
that day.

## How it is built
**Shared contract** (`packages/shared/src/contracts.ts`): `target.set` carries `day` (an India
day); the pulled target carries `day`.

**Server** (`apps/api`):
- Migration `0027_target_history.sql`: `app.targets` gets `day date not null`. Rows already there
  get the India day of the account's creation (answer 2). The rule "one row per user and kind"
  becomes "one row per user, kind and day"; an index on (user, kind, day).
- `target.set`: `day` is required and may not be after today in India (`DAY_IN_FUTURE`, as for the
  day data). Same user, kind and day: the value is replaced; another day: a new row.
- The sync pull sends every target row with its `day` (all of them, not only the last 90 days:
  a few rows per target).
- Authorization unchanged: a user's own targets only (invariant 1). Deleting the account deletes
  them (as now).

**Phone** (`apps/mobile`):
- Phone schema version 19: the phone's `targets` table is keyed by kind and day. Synced targets are
  fetched again at the next sync (the sync cursor is cleared, as earlier updates did); a target
  waiting to sync keeps its value and gets the day it was set, and so does its waiting change.
- `local/store.ts`: `targetsOn(db, day)` (each target's value on a date); `listTargets(db)` gives
  every value with its day. A target's entry is keyed by its kind and day.
- `sync/SyncProvider.tsx`: a target is saved with the IST day it is saved on.
- `targets.ts`: the "since" line, the history's changes and periods, the week rule.
- `TargetsScreen.tsx`: today's values, the since line, the Target history row; saving sends today's
  day; the same value saves nothing. `NumberEntrySheet.tsx`: an optional note line.
- New `TargetHistoryScreen.tsx`, route `target-history` (title "Target history").
- `HomeScreen.tsx`, `TargetProgressCard.tsx`, `WorkoutTracker.tsx` and a small
  `components/NoTargetNote.tsx`: the selected date's targets and week's target; "No target on this
  day" on a past date ("No target that week" for a past week).
- `InsightScreen.tsx` and `insight.ts`: the date's targets; "No target on this day".
- Progress unchanged (reads today's values).
- Lucide icons already in the app (`History`, `ChevronRight`, `ArrowRight`). JavaScript only: **no
  new development build**.

**Documents:** D-77 in the owner decisions (after D-76); Q-014 answered in
`constraints-and-assumptions.md`; backlog E-11 done; REQ-ROLE-007 changed and REQ-ROLE-018 added;
the data model (`targets`, phone schema version 19); `api-conventions.md` (`target.set`);
`docs/plans/ui-redesign.md` rows 2.3, 3.10, 6.2 and a new 6.7 Target history; the phone checks
below; CLAUDE.md's current phase.

## Tests
- **Shared:** `target.set` with a day; without one, refused.
- **Server, integration:** migration 0027 gives old rows the account's first day; two days of the
  same target are both kept; the same day is replaced; a future day is refused; the pull sends every
  row with its day; another user's targets are never sent; deleting the account removes them; the
  migration list.
- **Phone:** `targetsOn` before the first value, on the day of a change, after it; the week rule;
  the upgrade from 18 to 19 keeps a waiting target and its change; Home on a past date shows that
  date's target and "No target on this day"; Your targets' since line; the sheet's line; the same
  value saves nothing; Target history's All list and periods, in the body-weight unit.
- **Phone checks for the owner** (backlog S6-10 to S6-13): change a target today and see
  yesterday unchanged on Home and Insight; Target history after two changes; a change offline that
  syncs the next day; the workouts card in this week and last week.

## Risks
- **Right after the update** the phone fetches the targets again; offline until then, Your targets
  shows only the ones waiting to sync. One sync fixes it.
- **The owner's existing test accounts** have no older values (answer 2).
- **The phone's date** decides a change's day; a phone with a wrong date dates the change wrong
  (the server refuses a future day).

## Not in this change
Choosing the start date of a change (from tomorrow, from Monday), editing or removing a past value,
a chart of a target over time, Progress's week rows with their own targets (answer 3),
coach-set targets (post-MVP, B-21).

## Owner's steps
1. ~~Answer the three questions, approve the plan and lock the canvas boards~~ (done,
   2026-11-11).
2. After the build: migration 0027 on `fitsphere-dev` **before** running the updated API (the
   command is given then); no `foods:import`, no new build.
3. Test on the phone from `D:\fitsphere-targets`, then say "push".
