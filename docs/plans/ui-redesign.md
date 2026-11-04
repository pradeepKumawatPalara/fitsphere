# UI redesign plan

- Status: **Draft** (from the owner's instructions in chat, 2026-11-03); waiting for the owner's
  approval
- Owner: Project owner (D-01)
- Last updated: 2026-11-03 (module 1 built to 1.6; the full order of screens in Progress). Earlier:
  1.1 Sign in locked and built with the foundation, on `ui-redesign`; MVP defaults for the two
  contrast conflicts. Earlier the same day: the
  module plan; the owner chose to change the whole app's colours and fonts at once
- Builds on: D-35 and the design language in [`docs/design/`](../design/) (`design-system.md`,
  `FitSphere-UI-UX-context.md`); the theme module of the
  [Settings slice](settings-slice.md) (D-31); [`test-strategy.md`](../quality/test-strategy.md);
  [`definition-of-done.md`](../quality/definition-of-done.md)

A visual and UX redesign of the app the slices built. The server, the data and what each action
does stay as they are. The owner's rules for it (chat, 2026-11-03):
- Each screen uses only the data fields, actions and texts it has today: no new fields, features
  or flows. A UX improvement that needs new data or a server change is an optional note beside the
  design, never in it (listed below).
- The navigation stays as it is unless the owner approves a change.
- The F0x files in `docs/design/reference-fitsphere/` are style examples only; the layouts are
  original.

## How it works
1. **Design.** Each screen is drawn on the "FitSphere Redesign" canvas
   (https://claude.ai/artifact/XrKdW5ZWHQ6WRvk3wL3KoP, private to the owner; made again on 2026-11-03 after the signed-in account changed), with every state in
   dark and light.
2. **Lock.** The owner comments, or locks the screen. Only a locked screen is built.
3. **Build.** One commit per locked screen, all on one branch, `ui-redesign`, in the owner's own
   checkout (no second folder; owner, 2026-11-03); lint, typecheck and the tests pass before each
   commit. Pushed and a pull request opened only when the owner says. The owner checks the screen
   on the phone.
4. **Next screen.**

A shared part (a field, a button, the sheet frame) takes its new look with the first locked screen
that uses it, and then changes on every screen that uses it.

## Decisions so far
| Date | Decision |
|---|---|
| 2026-11-03 | D-35: the design language; Lucide icons; the Barlow fonts. |
| 2026-11-03 | **The whole app changes at once** (owner, chat): the new colours, fonts and icons replace the old ones everywhere with the first built screen; the layouts then follow screen by screen. Not two themes side by side. |
| 2026-11-03 | 1.1 Sign in locked (owner: "lock signin and go ahead"). |
| 2026-11-03 | 1.2 Sign up locked. Built with one change for contrast: a met password rule shows a green tick but keeps its text muted, as the light theme's green is 4.4:1 against the background, under the 4.5:1 that text this small needs. |
| 2026-11-03 | MVP defaults (D-18) for the two conflicts below, the owner having said to go ahead without choosing: field outlines take `inkSubtle`, placeholders `inkMuted`. The owner can choose the design's values instead. |

## Modules
| # | Module | Screens and sheets | Requirements |
|---|---|---|---|
| 0 | Foundation | Colour tokens (dark and light), the Barlow fonts, Lucide icons, the shared parts. No screen of its own: built with the first locked screen | REQ-ACC-001, REQ-NAV-001 |
| 1 | Sign-in and account setup | Sign in · Sign up · Check your email · Email verified / link expired · Forgot password (and sent) · Set a new password (and link invalid) · Account setup · App start | REQ-ACC-010, REQ-ACC-009 (the notice after deleting) |
| 2 | App shell and Home | Tab bar · header (date, calendar, avatar) · calendar sheet · date strip · calories and protein card · weight, steps and sleep tiles and their entry sheet · measurements card and sheet · workout tracker and day sheet · Log meal button · the notice for a change that wasn't saved | REQ-NAV-001 to 003, REQ-DATE-001 to 004, REQ-HOME-001 to 008, REQ-MEAS-001 to 006 |
| 3 | Nutrition and Log meal | Eaten summary · meal slots and cards · meal actions and confirmations · saved meals · Log meal: food search, barcode, your own food, portions, photo, date calendar | REQ-NUT-001 to 004, REQ-LOG-001 to 010, REQ-SAVED-001 and 002 |
| 4 | Training | Workout history · a workout · the exercise sheet | REQ-TRN-001 to 007 |
| 5 | Progress | Weight chart and its ranges · measurements · weight history | REQ-PRG-001 to 006 |
| 6 | Settings and account | Settings · Your targets · Change password · Delete account · Log out | REQ-ACC-001 to 009, REQ-ROLE-007 |

Not redesigned: the developer-only screens (`dev-history`, the API and database checks) and the
unused "Coming later" screen. The app has no onboarding beyond Account setup; adding one would be a
new flow.

## Progress
The order screens are designed and built in, one at a time; each is locked by the owner before it
is built. A notice or sheet that several screens share takes its new look with the first of them.

| Screen | Status |
|---|---|
| 0 Foundation | Built with 1.1: the tokens, the fonts, Lucide icons; the field, buttons, banner and form frame; the stripe corner and the wordmark |
| **1 Sign-in and account setup** | |
| 1.1 Sign in | Locked and built; the new development build (EAS `bb8ff50e`, 2026-11-03, with `react-native-svg`) is on the phone |
| 1.2 Sign up | Locked and built; with it the checkbox and a field's rule line took their new look |
| 1.3 Check your email | Locked and built; the sign-up text shows as a heading and its text, the same words |
| 1.4 Email verified | Locked and built; "Link expired" is the only new heading |
| 1.5 Forgot password | Locked and built |
| 1.6 Set a new password | Locked and built |
| 1.7 Account setup (the 18+ box) | Locked and built |
| 1.8 App start (while the app opens) | Locked and built |
| **2 App shell and Home** | |
| 2.1 Tab bar and header (date, calendar, avatar) | Locked and built: the app's own tab bar, the tab shown marked by a caramel bar (amends D-34 answer 9); the header's stripe corner sized to fit it |
| 2.2 Calendar sheet | Locked and built; with it every sheet took the new frame (card colour, grab handle, stripe corner, title in condensed capitals) |
| 2.3 Home: date strip, calories and protein card, weight, steps and sleep tiles, measurements card, workout tracker, Log meal button, the notice for a change that wasn't saved | Locked and built; with it the date strip (also on Nutrition), the measurements card (also on Progress), the unsaved-change notice (also on Training) and + LOG took their new look. The tracker keeps the app's full summary ("1 of 4 · 3 left"). Since D-41 (2026-11-04) the tracker reads "N workouts · target achieved" once met, and each day shows its count as a number |
| 2.4 Entry sheet for weight, steps and sleep | Locked and built; Your targets uses the same sheet |
| 2.5 Measurements sheet | Locked and built; with it every choice in the app (meal slots, Settings, Nutrition's tabs, the chart's ranges) became square blocks |
| 2.6 A day's workouts sheet | Locked and built. Since D-42 (2026-11-04) it opens for any day, with "Log another workout" |
| **3 Nutrition and Log meal** | |
| 3.1 Nutrition, Consumed: eaten summary, meal slots, meal cards | Locked and built. For contrast, each nutrient's colour is a square beside its name, the name in the muted ink (the light theme's carbs colour is about 3:1) |
| 3.2 Meal actions and confirmations | Locked and built; with it a sheet can open with a tile over its title (SheetHeading), used by 2.6 too |
| 3.3 Nutrition, Saved | Locked and built; a saved meal shows its name (an existing field) over its foods |
| 3.4 Nutrition, Diet plan | Locked and built |
| 3.5 Log meal | Locked and built; with it every pushed screen's header title is in condensed capitals. The meal tags are hidden (D-40, 2026-11-04) |
| 3.6 Food search and portions | Locked and built; the IFCT food-values credit stays under the results; with it the actions sheet (also used by the meal photo) took its new look. Since D-36, a food with household units offers Grams and its units as choice blocks above the amount (`household-units.md`). Since D-39 (locked 2026-11-04), My foods and USDA foods with their tags, USDA's servings and credit (`more-foods.md`). Since D-44 (2026-11-04, locked) the search fills the screen, with the credits behind an i. Since D-45 (2026-11-04, locked) what an amount adds shows protein, carbs, fat and fibre |
| 3.7 Barcode scan | Locked and built; with it an action can show an icon before its title |
| 3.8 Enter your own food | Locked and built; since D-39 (locked 2026-11-04), the unit, values per 100 g or ml or per one unit, the quantity, "Save to My foods", and editing or deleting a My food |
| 3.9 Meal photo | Locked and built; a logged meal's photo or link sits beside the meal card's icons; the viewer's text has its own colour, `onScrim`, readable on its dark backdrop in both themes |
| **4 Training** | |
| 4.1 Training: workout history | Locked and built; with it the button "Start an empty workout" is named "Log workout" (D-37). Since D-42 (2026-11-04, locked) each workout has its own row with a pencil and a bin, and each date "Log another workout". Since D-43 (2026-11-04, locked) a date chip above "Log workout", as Log meal's |
| 4.2 A workout | Locked and built; Done is fixed at the foot, as Log meal's Save meal, and Delete workout ends the list. Since D-42 (2026-11-04, locked) no Done, the title numbers the workout, and each exercise has a pencil and a bin |
| 4.3 Exercise sheet | Locked and built |
| **5 Progress** | |
| 5.1 Progress: weight and its chart, nutrition, the week, measurements | Locked and built; the chart is drawn with react-native-svg (in the app since D-35, so no new package or build), with the area under the line tinted |
| 5.2 Weight history | Locked and built; "No weights from … to …" writes its days as everywhere else ("Fri 8 May"; they were shown as 2026-05-08) |
| **6 Settings and account** | |
| 6.1 Settings | Locked and built; a Profile card on top (the photo, the name, the email, Edit profile); the choices as square blocks with icons; the account's rows with their icons |
| 6.2 Your targets and its entry sheet | Locked and built; tiles two by two with the target's icon, the body weight across both (the entry sheet is 2.4's) |
| 6.3 Change password | Locked and built; each problem shows under its field, and a changed password as a green banner (the banner's `success` tone) |
| 6.4 Delete account | Locked and built; the list's bullets became icons on a red tint |
| 6.5 Log out | Locked and built; its warning takes the place of Log out and Delete account, on a red tint |
| 6.6 Profile (new: the owner's request, 2026-11-03) | Locked and built with its plan `user-profile.md` (Accepted; D-38); the header greets by the profile's first name and its avatar shows the photo |

## Module 0: the foundation
Built in the commit of the first locked screen.

**Colour tokens.** `theme.tsx` takes the design's token names and values, dark and light, exactly
as `design-system.md` gives them. Every use in the app moves to its new name:

| Today | New token | Note |
|---|---|---|
| `background` | `bg` | |
| `surface` | `surface` | |
| `surfaceSelected` | `accentTint` | Chosen rows, chips and tags |
| `border` | `border` | Hairlines and cards |
| `text` | `ink` | |
| `textMuted` | `inkMuted` | Also placeholders (see conflict 2) |
| `textFaint` | `inkSubtle` | Disabled text, small print, field outlines (see conflict 1) |
| `primary` as a fill | `primary` | Buttons, the selected day, the avatar |
| `primary` as text, an icon, an outline or a link | `accent` | Caramel text fails contrast on the light background, so text takes `accent` |
| `primaryStrong` | `accent` | |
| `onPrimary` | `onPrimary` | |
| `error` | `danger` | |
| `over`, over a target | `warning` | Gold, never red (Q-022) |
| `over`, on Delete and Log out | `danger` | |
| `success`, `warning`, `track`, `scrim` | the same names | |
| `warningSurface` | `accentTint` | |
| `neutral`, `neutralLight` | `inkMuted`, `inkSubtle` | |
| `macroCarbs`, `macroFat`, `macroFibre` | `carbs`, `fat`, `fiber`; protein takes `accent` | |
| `scrimStrong` | `scrimStrong` | Kept for the photo viewer; not in the design |
| (none) | `surfaceRaised`, `surfaceSunken`, `primaryPressed`, `successTint`, `dangerTint`, `focus`, `stripe` | New |

**Fonts.** `@expo-google-fonts/barlow-condensed` and `@expo-google-fonts/barlow`, loaded at app
start through `expo-font` (already in the build); app start waits for them. On Android a custom
font does not follow `fontWeight`, so the shared `Text` picks the font file for each weight, and the
design's type styles (display, label, button, tab, metric, body, small) come from one place. Until
a screen is redesigned, its existing weights map to Barlow's.

**Icons.** `lucide-react-native` with `react-native-svg`, in place of Ionicons in the 7 files that
use them; `@expo/vector-icons` is removed. `react-native-svg` has native code, so this needs **one
new EAS development build**, which the owner is told about before it starts (D-19). Until the new
build is on the phone, the redesign branch does not run on it.

**Shared parts.** The field, the buttons, the checkbox, the banner, the form frame, the sheet frame
and the choice blocks take the design system's specs when the first locked screen uses them.

## Conflicts with the project's rules
Both settled for now as MVP defaults (see Decisions); the owner can choose otherwise.
1. **Field outlines.** The design draws an input's outline in `border` (about 1.6:1 on the dark
   background, 1.3:1 on the light). The app's tests require a field's edge to be at least 3:1, the
   WCAG minimum for a control's outline. Proposed: field outlines take `inkSubtle` (about 3.3:1 to
   4:1), a colour from the same palette.
2. **Placeholders.** The design's placeholder colour, `inkSubtle`, is 3.95:1 on the dark background;
   the app's tests require 4.5:1. Proposed: placeholders keep the muted text colour, `inkMuted`.

The other contrast tests carry over to the new names and pass with the design's values: `ink`,
`inkMuted`, `accent` and `danger` are at least 4.5:1 on `bg` and `surface` in both palettes, and
`onPrimary` on `primary` is about 5.7:1.

## Risks
- Until each screen is redesigned, it shows the new colours and fonts in its old layout (accepted
  by the owner, 2026-11-03).
- The foundation commit renames every colour in the app: a large but mechanical change, covered by
  the typecheck, the guard test and the screen tests.
- The new development build uses one of the free plan's 15 Android builds a month.

## Tests and checks
- Every commit: `npm run lint`, `npm run typecheck`, `npm test`. The theme's guard and contrast
  tests move to the new token names; the screen tests keep checking what each screen does.
- Each locked screen: the owner's check on the phone, on the new development build.
- Each module's pull request: CI.

## Optional notes (need new data or a server change)
None yet.
