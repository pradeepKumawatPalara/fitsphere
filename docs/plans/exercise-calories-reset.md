# Calories burned changed by you: say so, and use the estimate again (plan)

- Status: **Accepted** (the owner, in chat, 2026-11-16: "Lock it B"; see "The owner's answers")
- Owner: Project owner (D-01)
- Last updated: 2026-11-16
- Decision: D-107
- Builds on: calories burned, estimated or typed (D-50, REQ-TRN-003), the exercise page (D-67), the
  messages after typing stops (D-99)
- Requirements: REQ-TRN-003 amended (a note under D-50's calories)
- Design: the canvas's "4.3 Exercise page · Calories burned changed by you · B LOCKED (D-107)"
  (boards `ExerciseCalories` and `ExerciseCaloriesOptions`, proposed in version 110, B locked in
  version 111):
  https://claude.ai/artifact/WvdLa9fzyBFrdHcgDf7RTE
- Phone app only: no server change, no migration, no phone schema change, no new build (the arrow
  icon, Lucide's RotateCcw, is in the app's icon package already).

## What the owner asked
2026-11-16: on Add exercise and Edit exercise, a way to put Calories burned back to the number the
app works out ("system generated") once the user has changed it, or at least a notice that it was
changed. Plan and canvas first, and wait for approval.

## What happens today
- Calories burned shows the estimate, marked "estimated", with how it was worked out under it.
- Once the user types in the box, the estimate is gone. The line under it says "As you typed it,
  from your machine or watch." Clearing the box does not bring the estimate back: an empty box saves
  no calories.
- Edit exercise on an exercise saved with a typed number shows that number. The estimate can't be
  brought back there either.
- So nothing says the number is no longer the estimate, and the only way back is to remove the
  exercise and add it again.

## What the user sees (the canvas's options)
The example: Running, 30 min, 5.00 km (10.0 km/h), a 70.0 kg weigh-in. The estimate is 9.3 MET ×
70.0 kg × 0.5 h = 326 kcal. 360 is the number typed from a watch. Each option is shown in four
states: Estimated, Typed, Cleared (typed, then emptied) and Edit exercise (saved with 360 typed).

- **A · recommended.** The box says "edited" before kcal, where it said "estimated". Under it:
  "**Changed by you.** The estimate is 326 kcal." and a caramel link, "↺ Use the estimate · 326
  kcal". Emptied: "**Empty:** no calories will be saved. The estimate is 326 kcal." and the same
  link.
- **B.** A small caramel "Edited" tag next to the label, and an arrow button at the end of the box.
  Under it: "The estimate is 326 kcal: tap the arrow to use it."
- **C · a notice only.** As A's "edited" and line, with no link. To get the estimate back, the user
  types it, and it is then saved as a typed number.

In A and B, tapping the link or the arrow puts the estimate back in the box, marked "estimated",
with its usual line. It then follows the time and the distance again, as before the user typed.
Saved, it counts as an estimate ("· estimated" on the workout and Training's day card), as today.
The typed number is gone; the user can type it again.

In every option:
- The notice and the way back show only when there is an estimate to go back to. An exercise of
  the user's own, one with no activity value, one with no time yet, or a day with no weigh-in has no
  estimate: its line is unchanged.
- A number typed equal to the estimate still counts as typed. It stays as it is if the time
  changes later.
- Screen readers hear the link or arrow as "Use the estimate, 326 kcal". After it is tapped, they
  hear "Calories burned: the estimate, 326 kcal".
- The "i" sheet ("How calories are estimated") is unchanged.

## Questions for the owner
1. **A, B or C?** Recommended: **A**. It works one-handed, its words say what happens, and it
   needs no icon to be learned.
2. **The workout's exercise card.** Today it already tells the two apart: "326 kcal · estimated"
   or "360 kcal" typed. Recommended: unchanged. The other choice is "360 kcal · edited" on the card
   too.

## How it is built (after approval)
On branch `feat/exercise-calories-reset` off `main`, in `D:\fitsphere-exercise-calories` (removed
once merged).
- `apps/mobile/src/workouts.ts`: `caloriesHelp` returns the chosen option's line when calories are
  typed or emptied and an estimate exists. A new `caloriesChanged(kcal, estimated)` says when the
  notice and the way back show.
- `apps/mobile/src/components/ExerciseSheet.tsx`: the box's mark "edited" (A, C). The link (A) or
  the arrow button (B) sets `kcal` back to `null`, so the estimate shows and is saved as it is
  today (`parseExercise` unchanged), and announces it to screen readers. B's tag goes in the
  label's row, beside the "i".
- Docs: D-107 in `owner-decisions-2026-10-27.md` (after D-106 once PR #111 merges); REQ-TRN-003's
  note and the requirements' "Last updated"; CLAUDE.md's current phase. The chosen boards are
  titled LOCKED.

## Tests
In `apps/mobile/src/screens/workout.test.tsx`, beside "calories typed from a machine or watch
replace the estimate":
- typed: "edited", the line with the estimate, and the link (or arrow);
- the link puts the estimate back, marked "estimated"; saved, the exercise's calories are the
  estimate (`estimated: true`);
- emptied: the "Empty" line and the link;
- Edit exercise saved with a typed number: the notice and the link; used, then saved, the estimate;
- no estimate (own name, no weigh-in): no notice, no link, the line as today;
- the screen-reader label and announcement.
Then the full mobile jest run, typecheck and ESLint.

## Risks
- A tap on the link loses the typed number at once (no undo). It is one number, easy to type
  again; asking first would slow the common case.
- The line under the box grows to two lines on a narrow phone with a large font. It wraps; it is
  not cut.

## Not in this change
How the estimate is worked out (D-50), the "i" sheet, the workout and Training's cards (unless
question 2 says otherwise), and the server.

## The owner's answers (in chat, 2026-11-16)
1. "Lock it B": the Edited tag beside the label and the arrow at the box's end. The canvas's boards
   are titled LOCKED: B (version 111).
2. Not answered: the recommended default is built as an MVP default, the workout's and Training's
   cards unchanged (constraints' MVP defaults).

## Results (2026-11-16)
Built as B. `caloriesChanged` (`apps/mobile/src/workouts.ts`) gives the estimate to go back to;
`caloriesHelp` says "The estimate is 326 kcal: tap the arrow to use it." (emptied: "Empty: no
calories will be saved." before it); `ExerciseSheet.tsx` shows the Edited tag in the label's row and
the arrow as the box's own button (`Box`'s new `after`), which sets the calories back to the estimate
and announces it (`AccessibilityInfo.announceForAccessibility`). A number out of range keeps the arrow
beside its message. Tests: six in `workout.test.tsx`, "D-107 calories changed by you" (four fail on
the old code; the two that check nothing shows pass either way), and the D-50 typed test's line
updated. Not run yet: the owner's check on the phone.
