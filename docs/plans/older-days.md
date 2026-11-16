# Older days: any past date, read online (plan)

- Status: **Accepted** (the owner, in chat, 2026-11-16: "Old days load online", "Any date, no real
  limit", then "design is approve"; see "The owner's answers")
- Owner: Project owner (D-01)
- Last updated: 2026-11-16
- Decision: D-106
- Builds on: the calendar and selected date (D-23, D-34, REQ-NAV-002, REQ-DATE-001), the date strip
  Monday to Sunday and its one-week swipe (D-79), the past-date banner (REQ-DATE-002), the phone's 90
  days and older history read online (ADR-0007 rule 1; the weigh-in and workout routes, REQ-PRG-001,
  REQ-TRN-004)
- Requirements: REQ-DATE-001 amended
- Design: the canvas boards `OlderDays` (one screen, eight states) and `OlderDaysStates` (every state,
  dark and light), "2.2 Calendar and 2.3 Home · older days (D-106)". The canvas
  (https://claude.ai/artifact/WvdLa9fzyBFrdHcgDf7RTE) could not be opened from the account used on
  2026-11-16; the boards are added, titled approved, once it can.
- Server: one read-only route, no migration. Phone: no schema change, no new build.

## What the owner asked
2026-11-16: "Currently there is the validations of 90 days that user can go only 90 days past form the
caleder. I want to remove this validatios. Now User can go back past date as much User wants."

## The owner's answers
1. How older days work: **"Old days load online"** (the phone keeps 90 days and reads an older day from
   the server when it is shown), over the phone keeping all history.
2. How far back: **"Any date, no real limit"**, over back to the account's start. 1 January 2000 is the
   technical floor (MVP default).
3. "canva first", then "design is approve".

## What the user sees
- **The calendar** (the header's), **the date strip** (Home, Nutrition, Training), **Log meal's date** and
  **the measurements sheet** go back to any date. Future dates still cannot be chosen (Q-017).
- **A day of the last 90**: as before, from the phone, offline too.
- **An older day**: the "Showing <date>" banner, with the year when it is of another year ("Showing Wed
  12 Mar 2025"), and while the day is not shown yet a second line under a rule:
  - "Loading this day…" (a caramel spinner icon);
  - offline: "This day is more than 90 days ago. Connect to the internet to see it.";
  - failed: "Couldn't load this day." in the danger colour, with **Try again**.

  Meanwhile Home's Calories shows "–" with an empty bar and its target, the nutrients "–", the tiles
  "–" (not "+ Add"), the measurements card "–"; Nutrition's Eaten card "–"; Training no "No workouts
  on …". Once read, the day shows and changes as any day.
- **The calendar's older month**: in place of the month's workouts, "Loading this month…" or "Connect
  to the internet to see this month's meals and workouts." (or "Couldn't load this month's meals and
  workouts."); no day marked until it is read; every day can be picked.

## How it works
- **Server:** `GET /v1/users/{userId}/days?from&to` (api-conventions): the user's weigh-ins, steps,
  sleep, measurements, workouts and meals of those days, at most 42, as the sync pull sends them,
  deleted meals and workouts included. The route and the pull share the same SQL (`DAY_KIND_ROWS` in
  `apps/api/src/sync.ts`). Self-access only (`authorizeDaysRead`, 404 for anyone else, T-01).
- **Phone:** `useOlderDays(from, to, today)` (`src/sync/SyncProvider.tsx`) reads the part of a range
  before the phone's 90 days once this app session, the first screen to show it asking (one read even
  when Home, Nutrition and Training ask at once). `replaceDays` (`src/local/store.ts`) replaces that
  range's synced entries with the server's in one transaction (pending and rejected entries stay,
  D-14) and holds the range: `pruneSynced` leaves held days until the app starts again. Offline, the
  range is read once a sync reaches the server. Screens read the phone as before.
  `useShownOlderDays` reads the selected day's week and the strip's week; the header's calendar, the
  month shown; Log meal and the measurements sheet, their date's week.
- **The strip** draws only the weeks beside the one shown and the one a swipe slides to: back to 2000
  is over a thousand weeks.

## Unchanged
Training's All workouts (the phone's 90 days, then "Load older"), Progress (its chart and lists), an
exercise's History, the Profile's latest weight: each keeps its own rule. ADR-0007 is unchanged: rule 1
already reads older history online.

## Tests
- API (integration, `days.test.ts`): each kind of the days asked for and nothing outside them, deleted
  meals sent as deleted, one day and 42 days, refused ranges and fields; another user and an unknown ID
  get 404, no or a bad token 401, no account 403. The route listing test names its authorization test.
- Phone: `olderDays.test.ts` (which days are read; replace, pending kept, held through a prune, gone
  after a restart; deleted meals; the fetch online, failed, offline); `calendar.test.tsx` (back past the
  90 days to March 2025 with its marks read online, the day chosen with its year; offline month line;
  the strip past the 90 days; Try again then the day's data; the offline banner line);
  `WeekStrip.test.tsx` (back to 2000: three weeks drawn, swipes one week).

## Risks
- More reads of the user's health data from the server, each only the user's own and only when shown;
  older days stay on the phone (encrypted, ADR-0007 rule 5) only while the app is open.
- The beta's Cloud Run API must have this route before beta phones read older days; until then those
  phones say "Couldn't load this day." Deploy the API first.
- No phone check has been run; the owner checks it on the phone.
