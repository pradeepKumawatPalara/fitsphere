# Add exercise with less scrolling (plan)

- Status: **Accepted** (the owner, in chat, 2026-11-17: "Lock it B", with How to do it beside the exercise name; see "The owner's answers")
- Owner: Project owner (D-01)
- Last updated: 2026-11-17
- Decision: D-111
- Builds on: the exercise page (D-67), its fields (D-50, D-63), How to (D-82), calories changed by you
  (D-107), the messages after typing stops (D-99)
- Requirements: REQ-TRN-003 amended (how the exercise page lays out its fields; nothing it saves changes)
- Design: the canvas's "4.3 Exercise page · less scrolling · PROPOSED: A recommended" (boards
  `ExerciseScroll`, with Tweaks for option, state, theme and whole page, and `ExerciseScrollOptions`,
  every option as the whole page with a dashed line where the screen ends), proposed in version 113, B
  locked in version 114 with How to do it beside the name and a "No name yet" state:
  https://claude.ai/artifact/WvdLa9fzyBFrdHcgDf7RTE
- Phone app only: no server change, no migration, no phone schema change, no new build.

## What the owner asked
2026-11-17: "In the Add Excercise tab while Adding the details it has to much scrolling. for this come
up with the better canva desing and plan and wait for my approval".

## What happens today
Add exercise and Edit exercise are one page that scrolls, with every field one under another, each box
54 high: Category and Sub-group, the exercise name, its tag line (category · sub-group, how it is
logged, How to do it), the sets (a row each) and Add set, then Time spent, Calories burned with its line
under it, average and highest heart rate, the note, and Save exercise fixed at the foot.

With 3 sets the page runs about half a screen past the foot; with 6 sets about a screen. The keyboard
takes nearly half the screen while a set is typed, so the user scrolls between almost every field. Most
of the length is the fields that are optional and usually left as they are: Time spent, calories (an
estimate is already there), heart rate and the note, about 450 points together.

## The options (on the canvas)
The example: Behind-the-Neck Jerk, picked in Olympic Weightlifting, weight and reps, a 70.0 kg weigh-in,
15 min spent. Each option shows 3 sets, 6 sets and its details open, as the whole page.

- **A · recommended: fold.**
  - Once an exercise is picked, Category, Sub-group and the name become **one card**: the name, its tag
    line, How to do it, and **Change**, which opens the three again, as today.
  - The sets come right after, boxes 48 high (54 now).
  - Time spent, Calories burned, heart rate and the note fold under **one row, "More details
    (optional)"**, which says what they hold: "15 min · 105 kcal, estimated · heart rate and note
    empty". A tap opens them in place, as today's fields; another tap folds them.
  - With 3 sets, and with 6, the whole page fits the screen; it scrolls only once More details is open.
- **B · compact: everything shown, smaller.** The same page, boxes 44 high, labels shorter, Time spent
  beside Calories and the heart rates beside each other, the note one line. Nothing folds; 3 sets
  nearly fit, 6 sets still scroll.
- **C · details in a sheet.** A's card and sets; the optional fields in a sheet that opens from a
  "Details (optional)" row and closes with Done. Nothing scrolls on the page; the sheet hides the sets
  while it is open.

## What A would have kept (not built: the owner chose B)
- **More details opens by itself** when one of its fields needs attention: a value out of range
  (D-99's message), and on Edit exercise when the exercise has a time, typed calories, a heart rate or a
  note, so nothing saved is hidden. Calories changed by you (D-107's Edited tag and arrow) shows open.
- The fold is remembered while the page is open, not after it closes.
- Save exercise's line ("Check the … to save", D-99) names a folded field as now, and opens the fold.
- A name of the user's own (not in the list) has no card: its name box and "Log as" stay as today.
- Cardio (time, distance, speed, incline, level) is not optional: it stays out of the fold, as the sets.
- Screen readers hear the row as "More details, optional, collapsed: 15 min, 105 kcal estimated" and
  can open it; the card's Change is a button "Change the exercise".

## Questions for the owner
1. A, B or C? (A recommended.)
2. A: should the boxes go to 48 high (shown) or stay 54?
3. A: open More details by itself on Edit exercise when something is saved in it (recommended), or
   always start folded?

## The owner's answers (in chat, 2026-11-17)
"Lock it B with one small change slike how to do it should be side by side to the excercise name to
right side. will only visible when the here is the value for the excercise name. add this changes to
canva and start building it". So B, not A: questions 2 and 3 (A's box height and its fold) fall away.
How to do it moves from the tag line to the right of the Exercise name label, shown only while the name
holds an exercise of the list (How to needs the list's steps; a name of the user's own has none).

## How it is built (B)
- `apps/mobile/src/components/ExerciseSheet.tsx`: boxes 44 high (`box`), numbers 20, labels 6 above
  their boxes (`field`), fields 12 apart (`top`, `form`); Time spent and Calories in one row
  (`exercise-effort`; cardio: Calories alone), the calories' line under it; heart rates "Average HR" and
  "Highest HR"; the note one line under its label "Note (optional)" (the owner kept the label after the phone test; it was first the box's placeholder); How to do it in the name label's row
  (`exercise-how-to`), only with `match`; the tag line keeps the tag and how it is logged.
- `apps/mobile/src/components/ExercisePlacePickers.tsx`: Category and Sub-group 44 high.
- Accessibility labels unchanged, so screen readers and the tests find each field by its whole name.
- After the owner's phone test (2026-11-17): "estimated" in the half-wide calories box hid the number,
  so it moved beside the Calories label as a tag (`calories-estimated`), where D-107's Edited tag goes.
- Then ("the two input field is not align"): Calories' label row, taller with its info button and tag,
  set its box lower than Time spent's. The two labels now share one row and the two boxes the next
  (`exercise-effort-labels`, `exercise-effort-boxes`), so the boxes always line up.

## Tests (built)
- `workout.test.tsx` "D-111 the exercise page with less scrolling": How to do it beside the name only for
  an exercise of the list (none with no name or a name of the user's own); the optional fields two to a
  row with short labels, each read by its whole name, the note one line; cardio's Calories alone. All
  three fail on the old layout. The tag line's test now checks How to do it is not on it.

## Risks
- B still scrolls with many sets (6 sets run past the screen's foot), less than before.
- Smaller boxes (44) are still at the touch size the app keeps (44), so nothing becomes harder to tap.
- The page's tests find fields by their screen-reader names, which stay the same.

## Not in this change
The workout's own page (its cards and timer bar), the exercise lists (D-67), the sets' rules (D-63), the
calories estimate (D-50), and How to (D-82).
