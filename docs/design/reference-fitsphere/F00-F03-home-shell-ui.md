# F00 + F03 — App shell, Home and dates: UI design (LOCKED)

| | |
|---|---|
| **Status** | UI locked by Mudit, 2026-11-02 |
| **Spec IDs** | F00: NAV-001, NAV-002 · F03: DATE-001…004, HOME-001, HOME-002 (and the Home layout used by HOME-003…008 later) |
| **Design source** | "FitSphere Screens" canvas: board *Home + F03 · Dates* (Tweaks → view: today / past-date / calendar) |
| **Put at** | `docs/features/F00-…/ui-design.md` and `docs/features/F03-…/ui-design.md` (same file in both) |

Visual values: `docs/design/design-system.md`. **Body text is always Barlow 400.**

## Decisions (record in `spec.md` §18)
| Q | Decision |
|---|---|
| DATE-003 | Today is marked in **Caramel** (not blue) |
| Q-10 | Future dates can't be viewed or logged; they're shown dimmed (35 %) |
| Q-12 | Each week-strip day is a **vertical bar filled to that day's % of the calorie target** |
| Q-13 | Over target: the bar is full and turns `warning` gold; the text says "Over by N", never a negative "left" |
| Q-11 | Changing time zone never moves existing logs to another day |

## Tab shell (F00, NAV-001/002/003)
- **Tab bar:** 84 high including the safe area, `surfaceSunken`, top border. Four tabs: Home, Nutrition, Training, Progress, each with a Lucide icon (24) and an UPPERCASE `tab` label. Active tab: `accent` icon and label, plus a **3 px `accent` bar at the top edge** spanning the middle ~44 % of the tab. Inactive: `inkMuted`.
- **Header (every tab):** a row with the date overline on the left (`label` style, e.g. "FRI · 06 NOV") and on the right a 40×40 calendar button (`surfaceRaised`, radius 8) and a 40×40 avatar (radius 8, `primary` fill, the initial in Barlow Condensed 20/800 `onPrimary`), which opens Account.
- **Screen title** under the header: Barlow Condensed 40/42, weight 800, UPPERCASE, **not italic**. On Home it's the greeting: "LET'S GO," (in `inkMuted`) followed by the username.
- **+ LOG button** (Home and Nutrition only): a pill 52 high, radius 8, `primary`, "+" icon and "LOG" in Barlow Condensed 19/800 italic, 16 from the right edge and 98 from the bottom (above the tab bar). Opens Log meal. Accessibility label "Log meal".
- Content has 16 px gutters, 10 px between cards, and bottom padding so nothing hides under + LOG.
- Each tab screen has the signature stripe triangle in the top-right corner.

## Home (layout locked now; data arrives in later features)
Top → bottom:
1. Header + "LET'S GO, {USERNAME}".
2. **[Past-date banner]** (F03): `accentTint`, radius 4, clock icon, "WED 04 NOV" (Barlow Condensed 16/800) on the left, "BACK TO TODAY →" (`accent`) on the right.
3. **Week strip** (F03): 7 columns, gap 6. Each day is a bar 48 high (radius 4, `track`), filled from the bottom to that day's % of the calorie target. The selected day has a 2 px `accent` outline and a `primary` fill; other days use `inkSubtle`. The label under each bar is Barlow Condensed 13/700 (M, TU, W, TH, F, SA, SU), `accent` for today and the selected day. Future days are at 35 % and can't be tapped. Tapping a day selects it.
4. **Fuel card** (F05/F08): `surface`, radius 4, a **32 px cut corner** top-right with stripes behind it. Overline "FUEL · TODAY" (or "FUEL · WED 04 NOV") with "BY MEAL →" on the right. Hero "1,180" (84/76, 800 italic) next to "KCAL / LEFT" (`accent`). "**1,320** eaten · target **2,500**". A **20-segment bar** (14 high, radius 2, gap 3; filled segments `primary`). A divider, then "PROTEIN 86 / 110 G · 24 G LEFT" with a **10-segment bar** (10 high).
5. **Body strip** (F06): one card split into 3 columns by dividers: WEIGHT 72.4 kg · STEPS 6,240 · SLEEP "+ LOG" (`accent`).
6. **Training card** (F13): "TRAINING · THIS WEEK" with "3/5" (26/800 italic). **5 session slots** (40 high, radius 4): done = `primary` fill with a tick and the day name; open = 1.5 px dashed `inkSubtle` and "OPEN". Note under it: "2 sessions left · today done".
7. **Waist check-in row** (F07): `accentTint`, ruler icon, "WAIST CHECK-IN" and "Weekly · takes a minute", → arrow.

Until a feature exists, its card shows its empty state (dashes "–" or "+ LOG").

## Calendar sheet (F03, DATE-001)
Bottom sheet (`surface`, top radius 16, grab handle, `scrim`). "PICK A DAY" (32/800) with a "TODAY" outline button on the right. A month row with ‹ and › buttons; › is disabled on the current month. Weekday initials. A 6×7 grid of 44-high cells (radius 4): today has a 2 px `accent` outline; the selected day is `primary` fill with `onPrimary` text; a logged day has a 5 px `success` dot; days from other months are `inkSubtle`; future days are at 30 % and disabled. Legend: "• Days with meals logged". Tapping a day selects it and closes the sheet.

## Behaviour
- All data follows the selected date; switching tabs keeps it.
- "Today" and day boundaries use the time zone set in Account (`Asia/Kolkata` by default for India).
- The past-date banner shows whenever the selected day isn't today; "Back to today" resets it.
