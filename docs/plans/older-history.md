# Older dates without "Load older" (plan)

- Status: **Accepted** (the owner, in chat, 2026-11-18: "1 lock it A", "2 yes it should behave same it is
  right now. tapping should work", "3 Yes apply the same changes"; see "The owner's answers")
- Owner: Project owner (D-01)
- Last updated: 2026-11-18
- Decision: D-116 (drafted as D-115, which pull request #123 had taken for voice meal logging)
- Builds on: Training's All workouts (D-65), older workouts read online (D-29), Weight history (D-30),
  an exercise's History (D-82), older days (D-106), Progress's measurements by dates (D-114)
- Requirements: REQ-TRN-004 and REQ-TRN-008 amended; REQ-PRG-001's weight history amended
- Design: the canvas's "4.1 Training, 5.2 Weight history, 4.4 History · older dates without Load older",
  proposed in version 124 (boards `OlderWorkouts`, with Tweaks for option, state and theme,
  `OlderWorkoutsOptions`, every option and its states, `OlderElsewhere` and `OlderElsewhereStates`,
  Weight history and History with A), A locked in version 125:
  https://claude.ai/artifact/WvdLa9fzyBFrdHcgDf7RTE
- A (built): phone app only, no server change, no migration, no phone schema change, no new build, no
  Cloud Run deploy. B and C would have needed a server change and a Cloud Run deploy.

## What the owner asked
2026-11-18: "fitsphere -> Training tab -> all workouts: the Load Older button is confused the end user. SO I
want the New Ui desgin, plan to load the previous data like Beyond the 3 months data. may be I want the
custom date picker. or also check are we showing the load older button some where else in the
fitsphere. Do not start building first wait for my approval".

## What happens today
The phone keeps the last 90 days (ADR-0007 rule 1). Older data is read online and shown only, not kept
(rule 6), with a **Load older** button in three places:

| Where | Code | What one tap does |
|---|---|---|
| Training › All workouts | `screens/TrainingScreen.tsx` (`loadOlder`) | reads the 90 days before the oldest shown, opens the newest month it brings, or says "No workouts from Sat 23 May to Thu 20 Aug." |
| Progress › All weigh-ins › Weight history | `screens/HistoryScreen.tsx` (`loadOlder`) | the same for weigh-ins: "No weights from … to …" |
| An exercise's page › History | `components/ExerciseDetailsPage.tsx` (`loadOlder`) | the same for workouts with that exercise; Progress's note says "Load older in History adds earlier workouts." |

Nowhere else: Home and the calendar reach older days by date since D-106, and Progress's measurements
by a row of choices since D-114.

Why it confuses:
- It does not say how far it reads (90 days a tap) or which dates are shown: "All workouts" shows only
  the last 90 days until it is tapped.
- Reaching last year takes four or more taps, each with its own wait; a stretch with nothing gives a
  message and the user does not know whether to tap again.
- It sits at the very foot of a long list.
- The older cards it brings are greyed and do nothing when tapped, with no word why.
- Each tap reads at most 500 workouts (one page); a busy stretch could be cut short.

## The options (on the canvas)
The example: today Wed 18 Nov 2026; the phone holds Fri 21 Aug to Wed 18 Nov; workouts since Sat 2 Mar 2024.

- **A · recommended: a row of choices, as Progress's measurements (D-114, locked yesterday).**
  - Under By day and All workouts, a row that scrolls sideways: **Pick dates** (with a calendar icon),
    **Last 90 days** (chosen at first), then each year, 2026 back to 2000.
  - A line under it names what is shown: "21 workouts on 19 days · Fri 21 Aug – Wed 18 Nov".
  - A year shows that year's months, the newest open, as All workouts does now; "38 workouts on 35 days
    · Wed 1 Jan 2025 – Wed 31 Dec 2025".
  - Pick dates opens the same sheet as the measurements': From and To, each opening the calendar (1 Jan
    2000 to today), Cancel and Show; "Workouts older than 90 days load online."
  - While reading: "Loading workouts…"; offline: "Workouts older than 90 days need an internet
    connection." with Try again; a server error: "Couldn't load these workouts." with Try again; none:
    "No workouts from Sun 1 Jan 2023 to Sun 31 Dec 2023."
  - No Load older. One pattern across the app; the server already reads workouts and weigh-ins by dates.
- **B · every month listed.** All workouts lists every month that has a workout, back to the first one,
  each folded with its count, under a year heading ("2025"); the newest open; "86 workouts on 79 days ·
  since Sat 2 Mar 2024". Opening an older month reads it ("Loading June 2025…"). No button and no date
  picker: the months are the way back. Needs a new API that counts workouts by month
  (`GET /v1/users/{userId}/workout-months`), its tests, and a Cloud Run deploy; offline, the older months
  cannot be listed ("Older months need an internet connection."). It does not carry over to an
  exercise's History (the server would have to match exercise names).
- **C · no button: older months load by themselves at the end of the list.** Scrolling to the foot
  shows "Loading older workouts…" and adds the next older workouts, skipping empty stretches, until
  "That's every workout. Your first: Sat 2 Mar 2024." No date picker; the header's calendar still opens
  any date in By day. Needs the workouts API to read the newest workouts before a date (a new query
  option), its tests, and a Cloud Run deploy. Reading happens without the user asking, so a long scroll
  uses data.
- **Now** is drawn for comparison.

## Shared by every option (built with A)
- **An older card opens its date in By day.** In All workouts the cards older than the phone's 90 days
  are greyed and do nothing today. They would show a chevron and open that date in By day, which since
  D-106 reads an older date online and lists its workouts as any day's. Screen readers hear "Sat 27 Dec
  2025: 1 workout. Opens in By day".
- A date of another year shows its year ("Sat 27 Dec 2025"), as elsewhere (D-106).
- A workout on the phone wins over the server's copy for its day (a change waiting to sync), as D-114.
- Every read pages through the server's answer (500 at a time, at most 20 pages), so nothing is cut short.

## The two other places (A, on the canvas)
- **Weight history**: the same row at the top, "18 weigh-ins · Fri 21 Aug – Wed 18 Nov", the list as
  now, no Load older; "Weigh-ins older than 90 days need an internet connection."; "No weigh-ins from …
  to …".
- **An exercise's History**: the same row under the Progress, History and How to tabs; "6 workouts with
  this exercise · Fri 21 Aug – Wed 18 Nov"; the three bests on top are those of the dates shown; no Load
  older. Progress's note becomes "Your last 90 days, and the dates picked in History.", and its records
  and All count the last 90 days and the dates chosen in History (as built: the dates chosen now, not
  every date read since the page opened).

## MVP defaults (D-18; to record when built)
- The years go back to 2000, as the measurements' (D-106 lets a workout be logged on any past date), even
  where most are empty.
- The choice stays while the screen is open; Training comes back to Last 90 days when the app restarts.
- A year or dates are read again after a sync or a change, the list kept meanwhile (as D-114).

## Questions for the owner (answered below)
1. A, B or C? (A recommended: it is the custom date picker the owner mentioned, the same as Progress's
   measurements, and needs no server change or deploy.)
2. Older cards in All workouts open their date in By day (recommended), or stay as they are?
3. The same change for Weight history and an exercise's History (recommended), or Training only?

## The owner's answers (in chat, 2026-11-18)
1. "lock it A": the row of choices.
2. "yes it should behave same it is right now. tapping should work": an older card in All workouts keeps
   its look (the plain card, no pencil or bin) and a tap opens its date in By day, where its workouts open,
   change and delete as any day's.
3. "Yes apply the same changes": Weight history and an exercise's History get the same row.

## How it is built (A)
- `src/dateRange.ts` (new, from D-114's `measurementsRange.ts`): the choices (`DateChoice`, `yearRange`,
  `rangeYears`, `choiceRange`, `shownRange`), `fetchDatedPages` (every page, 500 a page, at most 20) and
  `useDatedList`, the list hook with a source per list (phone, online, what makes two the same). The
  online copy of a day the phone read whole (`holdsServerDay`, new in `local/store.ts`, set by
  `replaceDays`) gives way to the phone's, so a workout deleted on an older day leaves the list.
- `components/DateChoices.tsx` (new): the row of choices with Pick dates' sheet and calendar, and
  `RangeStatusView` (loading, offline, failed, each with Try again). `components/DatesSheet.tsx` (was
  `progress/MeasurementDatesSheet.tsx`): its "load online" line given by each list.
- `progress/MeasurementsSection.tsx`, `progress/measurementsRange.ts`: on the shared pieces; same look,
  same texts.
- `olderWorkouts.ts`: `fetchOlderWorkouts` reads every page; `WORKOUTS`, the source Training and the
  exercise page share; `OLDER_CHUNK_DAYS` gone.
- `screens/TrainingScreen.tsx`: the row and count line under the pills in All workouts; the months of the
  dates chosen; an older card a button with a chevron that shows its date in By day (`pickDay`); "No
  workouts in the last 90 days."; another year's days with their year in the labels; no Load older.
- `screens/HistoryScreen.tsx`, `components/WeighInList.tsx`: the row, count line and states above the
  list (the list's new `header`, `today` and `empty`).
- `components/ExerciseDetailsPage.tsx`, `exerciseStats.ts`: the row in History, the count line and
  states; another year's days with their year on the cards, bests and records (`today`, optional);
  Progress's note.
- `testing/fakeServer.ts`: the workouts route filters by dates, pages, and can fail, as the real one.
- Docs: D-116 in owner decisions, REQ-TRN-004, REQ-TRN-008, REQ-PRG-001, the constraints table, the data
  model, `ui-redesign.md` 4.1, 4.4 and 5.2, CLAUDE.md. The canvas boards LOCKED (version 125).

## Tests (built; each fails on the old code, which had no row of choices)
- `training.test.tsx` "D-116 All workouts by dates": the row and count line, no Load older, nothing read
  online for the last 90 days; a year read online, its months, the newest open, its days with the year,
  an older card opening its date in By day with its pencil and bin; a workout deleted on its older day
  leaving the year's list; this year reading online only the days before the 90; every page read; none;
  offline and Try again; a server error; Pick dates; logging ready while a year loads. The four Load
  older tests are replaced; the timer test reads 2026; the empty text is the new one.
- `home.test.tsx` "REQ-PRG-001 history by dates (D-116)": the last 90 days with the row; a year online,
  newest first with the year; none; offline and Try again.
- `exercisepage.test.tsx`: History's row and count line, 2026 read online, a card read online shown
  only, Progress counting it and its note; another year's cards and bests with the year.
- Progress's D-114 tests pass unchanged on the shared pieces.

## Risks
- A year read online can be large (a busy year, a few hundred workouts with their exercises); it is held
  in memory only while the screen shows it.
- Offline, only the last 90 days show, as now; the message says why.
- B and C change the server: the beta's Cloud Run API needs a deploy before beta phones see them (the
  owner's word first).

## Not in this change
By day, the date strip, the header's calendar (D-106), Progress's weight chart (its 6M and All already
read online), the measurements (D-114, kept as built), and what the phone keeps (90 days, ADR-0007).
