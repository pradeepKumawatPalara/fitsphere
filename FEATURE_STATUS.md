# Feature Status

**Last updated:** 2026-11-02
**Overall progress:** 68% (11 of 22 features completed)
**Based on:** the code on branch `ui-refresh` (main plus the UI refresh). Overall progress is the average of the Completion column. "Completed" means the code is built; the checks on a phone are still to be run before release.

## Summary

| # | Feature | Status | Completion |
|---|---------|--------|------------|
| 1 | Bottom navigation (Home, Nutrition, Training, Progress) | ✅ Completed | 100% |
| 2 | Header with selected date, calendar and profile avatar | ✅ Completed | 100% |
| 3 | Floating "+" quick-log button | ✅ Completed | 100% |
| 4 | Personal Training User view | 🟡 In Progress | 75% |
| 5 | Head Coach role | ⏳ Pending | 0% |
| 6 | Coach role | ⏳ Pending | 0% |
| 7 | Role selector and role switching | ⏳ Pending | 0% |
| 8 | Date handling (global) | 🟡 In Progress | 75% |
| 9 | Home dashboard | ✅ Completed | 100% |
| 10 | Measurements logging | ✅ Completed | 100% |
| 11 | Nutrition: Consumed | ✅ Completed | 100% |
| 12 | Nutrition: Diet plan | ⏳ Pending | 0% |
| 13 | Nutrition: Saved | ✅ Completed | 100% |
| 14 | Log Meal (without AI) | 🟡 In Progress | 80% |
| 15 | AI meal reading (text, voice, photo, label) | ⏳ Pending | 0% |
| 16 | Training | 🟡 In Progress | 60% |
| 17 | Progress | 🟡 In Progress | 85% |
| 18 | Appearance (System, Light, Dark) | ✅ Completed | 100% |
| 19 | Units for lifting weight and body weight | ✅ Completed | 100% |
| 20 | AI meal reading consent toggle | ✅ Completed | 100% |
| 21 | Country and time zone | 🟡 In Progress | 25% |
| 22 | Change password, log out, delete account | ✅ Completed | 100% |

## Details

### 1. Bottom navigation (Home, Nutrition, Training, Progress) — ✅ Completed (100%)
Nothing pending.

### 2. Header with selected date, calendar and profile avatar — ✅ Completed (100%)
Nothing pending.

### 3. Floating "+" quick-log button — ✅ Completed (100%)
Nothing pending.

### 4. Personal Training User view — 🟡 In Progress (75%)
**Done:**
- Home, Nutrition, Training, Progress and Settings are available
- The user logs their own food, body metrics and workouts
- The user sets their own targets ("Your targets")

**Pending:** Targets and training plans assigned by a coach, and switching to another role, are not built.

### 5. Head Coach role — ⏳ Pending (0%)
**Pending:** No Head Coach view, no coach management (add, view, update, delete) and no view of the coaches' trainees. The database only reserves the role and link tables.

### 6. Coach role — ⏳ Pending (0%)
**Pending:** No Coach view, no trainee management, and no way to set targets, diet plans or training plans for trainees.

### 7. Role selector and role switching — ⏳ Pending (0%)
**Pending:** There is no role selector in the profile; the app shows only the Personal Training User view.

### 8. Date handling (global) — 🟡 In Progress (75%)
**Done:**
- Pick a past date from the header calendar or the Monday-to-Sunday week strip
- Home and Nutrition follow the selected date
- "Back to today" banner on Home and Nutrition
- Today is highlighted in blue

**Pending:** Only the last 90 days can be picked. Training and Progress don't follow the selected date or show the banner. Days always use India time, not a user setting.

### 9. Home dashboard — ✅ Completed (100%)
Nothing pending.

### 10. Measurements logging — ✅ Completed (100%)
Nothing pending.

### 11. Nutrition: Consumed — ✅ Completed (100%)
Nothing pending. (The date strip changes week with arrows instead of scrolling freely.)

### 12. Nutrition: Diet plan — ⏳ Pending (0%)
**Pending:** Only the tab and a "No diet plan yet" message exist. The coach's target card, the "How to use this plan" guide and the meal cards with Options 1 to 3 are not built.

### 13. Nutrition: Saved — ✅ Completed (100%)
Nothing pending.

### 14. Log Meal (without AI) — 🟡 In Progress (80%)
**Done:**
- Back button and date chip (opens on the selected day, normally Today)
- "Log this meal to" sheet: Today, Yesterday, five earlier days with their status, and "Another day…"
- Breakfast, Lunch, Snack and Dinner, plus Before training and Dessert tags
- Search database, Scan barcode and Saved meals (plus "Enter your own food")
- Meal photo from the camera, and the logging tips
- Review of the foods before saving

**Pending:** The "Eaten before" (past meals) option and the collapsible Examples section (Best, Vague, Say) are not built.

### 15. AI meal reading (text, voice, photo, label) — ⏳ Pending (0%)
**Pending:** No "Speak or type what you ate" box, no "Speak your meal" button, and no AI reading of text, voice, meal photos or nutrition labels. The consent check before each AI call is also still to come. Log Meal shows "AI meal reading is coming soon".

### 16. Training — 🟡 In Progress (60%)
**Done:**
- "No training plan yet" empty state
- "Log workout", with exercises as sets × reps × weight and a note
- "Workouts you have logged" history, including older workouts loaded from the server
- Lifting weights in the unit chosen in Settings

**Pending:** The coach's day-by-day training plan and the how-to guide for each exercise are not built.

### 17. Progress — 🟡 In Progress (85%)
**Done:**
- "Weight over 4 weeks" card with the change, the weekly rate and the not-enough-data message
- Average calories against the target, and "Meals logged: X of Y days"
- Weight trend chart with 1W, 4W, 12W, 26W and All, and an empty state
- Week-by-week table (weight, calories, protein, steps) with a Target row
- Measurements section with "Add first" and the weekly waist tip

**Pending:** The "Pre" baseline row and tapping a week to open its details are not built.

### 18. Appearance (System, Light, Dark) — ✅ Completed (100%)
Nothing pending.

### 19. Units for lifting weight and body weight — ✅ Completed (100%)
Nothing pending.

### 20. AI meal reading consent toggle — ✅ Completed (100%)
Nothing pending.

### 21. Country and time zone — 🟡 In Progress (25%)
**Done:**
- Settings shows "India · Kolkata"
- Every day is counted in India time

**Pending:** The user cannot change the country or the time zone.

### 22. Change password, log out, delete account — ✅ Completed (100%)
Nothing pending.
