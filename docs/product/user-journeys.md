# User Journeys

- Status: Draft
- Owner: Product owner (Q-001)
- Last updated: 2026-10-27

Journeys reference REQ IDs; behaviour details live in [`requirements.md`](requirements.md).
Steps marked *(assumed)* rely on an assumption or open question.

## J-01 Trainee logs a meal by typing (AI on)
Actor: Personal Training User · REQ-NAV-003, LOG-001..004, LOG-009, NUT-002/003, HOME-003/004
1. On Home, taps the floating "+". Log meal opens, date chip = today.
2. Selects meal type (e.g. Lunch); optionally adds a tag.
3. Types "150 g cooked rice, 200 g dal, 1 roti".
4. AI returns items with quantities and nutrition; user reviews and confirms *(assumed, A-006)*.
5. Returns to Home/Nutrition: Eaten summary, calories and protein cards update.

Alternates:
- **AI consent off** → app asks for consent (REQ-ACC-004); if declined, user uses Search database / Scan barcode / Saved.
- **AI fails or times out** → input kept; retry or switch method.
- **Logging for another day** → date chip → "Log this meal to" sheet → Yesterday or "Another day…" (REQ-LOG-002).
- **Voice / photo** → same flow starting from "Speak your meal" or camera (REQ-LOG-005/006).

## J-02 Trainee logs a meal without AI
Actor: Personal Training User · REQ-LOG-007, ACC-005
1. "+" → Search database (or Scan barcode).
2. Picks food, sets quantity, chooses meal type, saves.
3. Totals update. Works with AI off.

## J-03 Trainee re-logs a saved meal
REQ-NUT-004, SAVED-001/002
1. In Consumed, opens a logged meal's "•••" → "Save to my meals".
2. Another day, Nutrition › Saved → taps the meal → logged to selected date *(slot per Q-036)*.

## J-04 Trainee logs weight and weekly measurements
REQ-HOME-006, HOME-008, MEAS-001..006, PRG-006
1. Home → Weight tile "+ Add" → enters value (unit per setting).
2. Home Measurements card → bottom sheet, date = today, chooses cm/in.
3. Enters upper and lower waist (Save enables), optionally expands for chest/hips/arms/thighs/notes.
4. Saves. Progress › Measurements shows the entry.
Alternate: taps X → exits, nothing saved.

## J-05 Trainee reviews a past day
REQ-DATE-001..003
1. Taps a past day on the week strip (or calendar).
2. All cards show that day; banner shows the date with "Back to today".
3. Taps "Back to today" → returns to today.

## J-06 Trainee follows the training plan
REQ-TRN-001..005, HOME-007
1. Training tab → today's plan from coach, with exercise how-to.
2. Logs sets in the lifting unit setting *(fields per Q-042)*.
3. Workout appears in history; Home workout tracker increments (e.g. "2 of 5 · 3 left").
Alternate: no plan → "No training plan yet" → "Start an empty workout".

## J-07 Trainee checks progress
REQ-PRG-001..006
1. Progress → weight change over 4 weeks and weekly rate (or not-enough-data message).
2. Changes chart range 1W…All; reads week table vs Target row; taps a week for details.

## J-08 Coach onboards a trainee and sets a plan
Actor: Coach · REQ-ROLE-001, 002, 005, 006
1. Profile → role selector → Coach. Coach view lists assigned trainees.
2. Adds a trainee *(mechanism per Q-009)*.
3. Opens the trainee, sets calorie and protein targets and weekly workout target *(Q-013)*.
4. Builds a diet plan (meals with up to 3 options, protein source first) and a training plan, and sends them.
5. Trainee's Diet plan shows "Set by your coach" targets; Training shows the plan.
Failure: Coach tries to open a trainee assigned to another coach → refused (REQ-ROLE-005).

## J-09 Head Coach manages coaches
Actor: Head Coach · REQ-ROLE-001, 003, 004
1. Profile → role selector → Head Coach *(how the role is granted per Q-006)*.
2. Adds a Coach *(Q-009)*; views coach list and each coach's trainees.
3. Updates or deletes a Coach *(effect on trainees per Q-010)*.
Failure: attempts to view a coach outside their hierarchy → refused.

## J-10 User changes settings
REQ-ACC-001..008
Theme, lifting unit, body-weight unit, AI meal reading consent, country/time zone, change password, log out.
Delete account → separate flow (**blocked, Q-048**).
