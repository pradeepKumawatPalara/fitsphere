# Home and daily tracking slice plan

- Status: **Accepted**, approved by the project owner on 2026-10-29 (D-23)
- Owner: Project owner (D-01)
- Last updated: 2026-10-29 (steps 1 to 7 built and opened as pull requests #11 to #17; the owner's
  checks are pending)
- Builds on: [`mvp-scope.md`](../product/mvp-scope.md) section 5, slice 2 (D-18, D-20); the
  [Skeleton slice](skeleton-slice.md); the contracts in [`docs/contracts/`](../contracts/);
  [`test-strategy.md`](../quality/test-strategy.md);
  [`definition-of-done.md`](../quality/definition-of-done.md); ADR-0001 to ADR-0007

This is the second MVP slice. It builds the Personal Training User's daily screen:
- the user's own targets;
- the bottom navigation and the common header;
- the Home cards and tiles;
- the measurements sheet.

It also builds `npm run dev:phone` (D-22 answer 5). The MVP is the Personal Training User view
only (D-20).

Where the contracts define something, this plan does not repeat it.

## Progress
| Step | Status | Branch |
|---|---|---|
| 1. `npm run dev:phone` | Pull request #11; its check is in the batch at the end | `home/01-dev-phone` |
| 2. Server: daily data in the contracts, schema and sync | Pull request #12. Migration 0002 runs on `fitsphere-dev` with the batch at the end | `home/02-server-daily-data` |
| 3. Phone: local schema v2, store and sync client | Pull request #13 | `home/03-phone-daily-data` |
| 4. Navigation shell | Pull request #14 | `home/04-navigation` |
| 5. Own targets, calories and protein cards, workout tracker | Pull request #15. The generic number sheet is built here, for the targets, instead of in step 6 | `home/05-targets-and-cards` |
| 6. Steps and sleep tiles | Pull request #16 | `home/06-steps-sleep` |
| 7. Measurements card and sheet; close-out | Built; automated checks pass | `home/07-measurements` |
| Owner's checks at the end of the slice | Pending: merge, migration 0002 on `fitsphere-dev`, phone checks 1 to 7 | — |

## Scope
| In this slice | Requirements |
|---|---|
| Four-tab bottom navigation; the common header (selected date, calendar, avatar that opens Account) | REQ-NAV-001, REQ-NAV-002 |
| The header with the user's name; the week strip; calories and protein cards; steps and sleep tiles; the workout tracker; the measurements card | REQ-HOME-001…004, REQ-HOME-006…008 |
| The measurements sheet: date, cm/in, mandatory waist fields, optional fields, save and close | REQ-MEAS-001…006 |
| The user's own five targets, labelled "Set by you", recording who set each and when | REQ-ROLE-007 (groundwork for invariant #2) |
| Steps, sleep, measurements and targets work offline and sync | REQ-NFR-004, REQ-NFR-001 (self-access, D-20) |

These move to the slice that supplies their data:
- **Slice 3, Meal logging:**
  - the "eaten" values on the calories and protein cards, which show 0 until then;
  - the week strip's status box (Q-019);
  - the "By meal" link (REQ-HOME-005);
  - the "+" button (REQ-NAV-003).
- **Slice 4, Training:** the workout count and the Mon–Sun dots, which show 0 and empty until
  then.

## Decisions
**1. No new packages in the app, so no EAS build is expected.**
- expo-router 58 bundles its own tab navigator. `expo-router/build/layouts/TabsClient.js`
  needs only `react-native` and `react-native-safe-area-context`, which the build already has.
- `dev:phone` uses only Node 24.
- If a native change does turn up, Claude Code tells the owner before any build (D-19).

**2. Workflow (D-21, unchanged).**
- One branch and one pull request per step. Each pull request builds on the one before it.
- Steps run back to back.
- Work stops only when the owner is needed. Here that is once, at the end: merging, the Supabase
  migration and the phone checks.
- The owner merges, in step order, once CI is green.

**3. MVP defaults** chosen under D-18 answer 3. They are listed in
[`constraints-and-assumptions.md`](../architecture/constraints-and-assumptions.md#mvp-defaults-d-18)
and in each pull request.

| Question | MVP default |
|---|---|
| Where users set their targets (left to this plan by REQ-ROLE-007) | A "Your targets" screen. It opens from Account (the avatar), and from "Set a target" on the calories, protein and workout cards when no target is set |
| Q-014 Do targets apply from a date, or to past days too? | One current value per target. It applies to every day shown, past days included. No target history in the MVP |
| Target ranges | Calories 500–10,000 kcal; protein 10–500 g; steps 1–100,000; weekly workouts 1–14; target body weight 20–300 kg with one decimal (Q-028) |
| Removing a target | Not in the MVP. A target can be changed but not removed |
| "Set by" label | Always "Set by you" in the MVP. The server stores who set the target from the sign-in token, never from the request. "Set by <name>" comes with coaches (backlog B-21) |
| The username in the header (REQ-HOME-001) | No name is collected at sign-up, so the header uses the part of the email before "@". The avatar shows its first letter |
| Account screen | The avatar opens "Account". It shows the email, "Your targets", Log out and the development-only tools that were on Home (kept for SC-02, SC-04, SC-08 and SC-13). The Settings slice adds the settings |
| Tabs not built yet | Nutrition and Training show "Coming in a later update". Progress shows the existing weight history until the Progress slice. The tabs have text labels only, so no icon package is needed |
| How far back the selected date goes | The last 90 IST days, which the phone holds (ADR-0007 rule 1). The calendar and the week strip's back arrow stop there. Older days are viewed in Progress (slice 5) |
| Calendar (REQ-NAV-002) | A month-grid sheet. Future days and days outside the 90-day window are disabled. The selected date is shared by all tabs and resets to today when the app starts |
| Sleep | Typed in hours with one decimal (Q-028), stored as whole minutes (0–1,440). It belongs to the date selected when it is logged |
| Measurements storage (REQ-MEAS-003: "a contract decision") | Whole millimetres (invariant #6), typed with one decimal in cm or in. Every field is 10–250 cm (Q-028), in either unit |
| The cm/in toggle | Starts at cm. The last choice is remembered on this phone only |
| The measurements sheet's date | Opens on Home's selected date, as Q-011 does for "+". It can be changed to another past day within the window |
| Q-026 "current week" | The Mon–Sun week of the selected date, since all on-screen data follows it (REQ-DATE-001) |
| Measurements validation | "Save measurements" needs both waist values to be valid, and every optional field that is filled. Notes are 500 characters or fewer. An existing entry for the day pre-fills the sheet |
| Workout tracker texts | "N of T · K left"; "N of T · target reached" once N reaches T; with no target, "Set a weekly workout target" |
| Rejected-change texts | One per type, as for weight: "These steps weren't saved: <reason>. Edit or discard it.", and likewise for sleep, measurements and targets |

## Data and API
The contracts are updated first: [`data-model.md`](../contracts/data-model.md),
[`api-conventions.md`](../contracts/api-conventions.md) and
[`error-model.md`](../contracts/error-model.md).

**Migration `0002_daily_tracking.sql`.** Every table is in schema `app`, has row level security
turned on with no policies, takes `change_seq` through the touch trigger, and has an index on
(`user_id`, `change_seq`).
- `step_counts`: day; steps 0–100,000; `recorded_at`.
- `sleep_logs`: day; `sleep_minutes` 0–1,440.
- `measurements`: day; `upper_waist_mm` and `lower_waist_mm`, not null; optional `chest_mm`,
  `hips_mm`, `arm_mm` and `thigh_mm`; each 100–2,500. Optional `notes`, 500 characters or fewer.
- These three are unique on (`user_id`, `day`) and are **Health** data.
- `targets`:
  - `kind` is one of `calories`, `protein`, `steps`, `weekly_workouts` and `body_weight`;
  - `value` is an integer whose range is checked per kind, with body weight in grams;
  - `set_by_user_id` references `users`, with `on delete set null` for backlog E-02;
  - `set_at`;
  - unique on (`user_id`, `kind`).

**Sync change types.** All go through `POST /v1/sync`; there are no new routes.
- `steps.set`, `sleep.set` and `measurements.set` work like `weighIn.set`: one value per day, a
  new one replaces the old (Q-030), and `DAY_IN_FUTURE` applies.
- `target.set` takes `{ kind, value, setAt }`. Input is strict, so a request that names who set
  the target is refused.
- Every change needs the Personal Training User role. The change the server receives last wins
  (Q-075).

**Pull.**
- `pull` gains `steps`, `sleep`, `measurements` and `targets`. These are added fields, so the API
  stays `/v1`.
- One query reads the five tables in the order of the shared `change_seq`: at most 500 rows a
  page, with one cursor.
- The 90-day window applies to the day tables. Targets are always sent.

**API code.** In `apps/api/src/sync.ts`, the single `weighIn.set` branch becomes a table of
change handlers (schema, checks, write). The once-only check, the result shape and the lock on the
user's row stay as they are.

**Phone.** The local schema goes to version 2.
- New tables `steps`, `sleep` and `measurements`, keyed by day, and `targets`, keyed by kind;
  each has `sync_state`.
- The migration keeps the existing weigh-ins and outbox and clears the sync cursor, so the first
  sync after the update pulls the new kinds.
- Store functions take a description of each kind: its table, its outbox key (`$.day` or
  `$.kind`) and its columns.
- Outbox lookups match on the change type as well as the key. In the Skeleton they match on the
  day only, which would mix kinds.

## Steps
Each step lists its requirements, what it builds and its automated tests. The owner's checks for
the whole slice are batched at the end, as the owner asked.

### Step 1: `npm run dev:phone` (D-22 answer 5; D-19 answer 6; runbook step 8)
**Builds**
- `apps/api/scripts/dev-phone.ts`, with its pure helpers in `dev-phone-lib.ts`.
- Root script `dev:phone`. It needs no dependencies.
- What it does, in order:
  1. Starts the API with `npm run dev -w @fitsphere/api`, run through `node` and npm's own
     script with no shell, and waits for `http://127.0.0.1:3000/v1/health`.
  2. Starts `cloudflared tunnel --url http://127.0.0.1:3000` and reads the tunnel's address from
     its output.
  3. Writes only `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` and keeps every other line. If the
     file is missing, it stops and says so.
  4. Waits until `/v1/health` answers through the tunnel.
  5. Starts `npm run start -w @fitsphere/mobile` in the same terminal, so the QR code and Expo's
     keys work.
- The API's and the tunnel's output go to `.dev-phone/api.log` and `.dev-phone/tunnel.log`,
  which git ignores. The script never prints the tunnel's address or any other `.env` value.
- On Ctrl+C, or when any of the three stops, it stops the other two (`taskkill /T` on Windows)
  and empties `EXPO_PUBLIC_API_URL`.
- If `cloudflared` is not installed, or the tunnel does not answer within 60 seconds, it says so
  and cleans up.
- This plan, D-23, `CLAUDE.md` "Current phase" and the docs index.

**Tests**
- Reading the address from sample `cloudflared` output. The samples are built at run time, so
  CI's check for committed tunnel addresses stays clean.
- Rewriting `.env`: set, empty, add the line when missing, keep CRLF line endings, leave other
  lines untouched.

**Docs:** runbook step 8 (one command; the three terminals stay as the fallback); test-strategy
tools.

### Step 2: Server: daily data in the contracts, schema and sync (REQ-HOME-006, REQ-MEAS-*, REQ-ROLE-007, REQ-NFR-001, REQ-NFR-004)
**Builds**
- `packages/shared`:
  - the new change types and their strict data schemas;
  - ranges and conversions in `units.ts`: sleep hours to and from minutes; cm and in to and
    from millimetres; target ranges per kind;
  - the pull schema.
- Migration 0002, the change handlers and the pull across the five tables.
- The contract documents.

**Tests**
- Shared: ranges; one decimal of cm, in or hours converts there and back unchanged; unknown
  fields are refused. In CI these run in both time zones.
- Database: the checks and the unique rules.
- Integration:
  - each type is accepted, and a second value for the day replaces the first;
  - `DAY_IN_FUTURE`;
  - an out-of-range value gives `VALIDATION_FAILED`;
  - a change is applied once only for its `changeId`;
  - `set_by_user_id` is always the caller.
- The pull:
  - pages across the kinds with a small page size;
  - applies the 90-day window to day data but not to targets;
  - never returns another user's rows.
- Self-access suite: a second user's sync never changes or returns the first user's steps, sleep,
  measurements or targets, even with the same day, kind and `changeId`.
- Log test: a sync carrying measurement notes and values logs none of them.

### Step 3: Phone: local schema v2, store and sync client (REQ-NFR-004; ADR-0007 rules 1, 2 and 7)
**Builds**
- The store, working from the description of each kind.
- The local migration from version 1 to version 2.
- `syncNow` applies every kind in the pull.
- `SyncProvider` gains `save(kind, data)`; `saveWeight` stays as a thin wrapper.

**Tests** (in-memory SQLite)
- The Skeleton's weight tests pass unchanged.
- For each kind:
  - a saved entry is pending;
  - an accepted one is synced;
  - a rejected one is kept until discarded, and discarding brings back the server's value.
- A pull never overwrites a pending change of the same kind and key, but does update other kinds
  for that day.
- Pruning skips targets and never removes pending or rejected entries.
- Migrating from version 1 keeps the weigh-ins and the outbox and clears the cursor.

### Step 4: Navigation shell (REQ-NAV-001, REQ-NAV-002, REQ-HOME-001, REQ-DATE-001…003)
**Builds**
- `src/app/(tabs)/_layout.tsx` with expo-router's `Tabs`: `home`, `nutrition`, `training` and
  `progress`. `/home` keeps its path, so the existing redirects still work.
- A selected-day provider shared by the tabs.
- `AppHeader`: date, name, calendar button and avatar.
- `CalendarSheet`, a month grid. The week strip's back arrow stops at 90 days.
- `account.tsx`, holding Log out and the development tools moved off Home.
- Placeholder tabs. Progress hosts the weight history.

**Tests**
- Four tabs, each opening its screen.
- The header on every tab; the avatar opens Account.
- The calendar disables future and out-of-window days. Choosing a day updates Home and the week
  strip.
- The banner and "Back to today" still work.

### Step 5: Own targets, calories and protein cards, workout tracker (REQ-ROLE-007, REQ-HOME-003, REQ-HOME-004, REQ-HOME-007)
**Builds**
- `targets.tsx`: five rows, each with its value or "Not set", and "Set by you". Editing uses the
  shared number sheet. Pending and rejected states are shown.
- `TargetProgressCard`, used for kcal and for grams. The eaten totals come from one function that
  returns 0 until slice 3.
- `WorkoutTracker`. The count and the dots come from one function that returns 0 until slice 4.

**Tests** (the REQ-ROLE-007 and REQ-HOME-003 criteria)
- With no target: the kcal eaten only, and "Set a target".
- Target 2000 and 1500 eaten: 75% and 500 kcal remaining.
- Over target: the bar is full in the warning colour, with "X kcal over"; for protein, "X g
  over".
- "0 of 5 · 5 left", and the text for no target.
- "Set by you" on every target; out-of-range values are refused.

### Step 6: Steps and sleep tiles (REQ-HOME-006)
**Builds**
- `EntrySheet` becomes a generic `NumberEntrySheet` (title, unit, parse, rule), used for weight,
  steps, sleep and targets.
- The Steps and Sleep tiles, next to Weight.
- `RejectedChanges` covers every kind, and Edit opens the matching sheet.

**Tests**
- "+ Add", then the value; a new value replaces it.
- Steps are whole numbers from 0 to 100,000; sleep is 0–24 h with one decimal.
- The rejected texts per type; weight behaves as before.

### Step 7: Measurements card and sheet; close-out (REQ-HOME-008, REQ-MEAS-001…006)
**Builds**
- `MeasurementsSheet`: X, a date stepper, the cm/in toggle, the waist fields with their
  guidance, and an expandable section with the optional fields and notes.
- `MeasurementsCard`.

**Tests** (the REQ-MEAS-006 criteria)
- With only the upper waist entered, Save is disabled.
- X after typing saves nothing.
- Inches convert to millimetres; the sheet pre-fills; optional fields are checked.
- The card is hidden once the selected week has an entry, and shown for a week without one.

**Close-out** (in this step's pull request)
- Record the results in ADR-0007: offline steps, sleep and measurements, extending its step 1.
- Update the test strategy, the runbook, the data and error documents, and the MVP defaults in
  `constraints-and-assumptions.md`.
- Add the new edge cases to `backlog.md`: removing a target, Home for days older than 90 days, and
  target history (Q-014).
- In `requirements.md`, record where users set their targets (REQ-ROLE-007), and note that
  REQ-HOME-005 and REQ-NAV-003 come with slice 3.
- Link this plan from `mvp-scope.md` slice 2; update `CLAUDE.md` and the docs index.

## Owner's checks at the end of the slice
1. Merge the seven pull requests in step order, each with green CI (D-21).
2. Supabase: run `npm run migrate -w @fitsphere/api` against `fitsphere-dev`. It applies 0002.
3. Phone checks, on the existing development build (no new build), with test data only:
   1. **`dev:phone`:** `npm run dev:phone` starts all three, and Account › Development shows
      "API: ok". Ctrl+C stops all three, and afterwards `EXPO_PUBLIC_API_URL` in
      `apps/mobile/.env` is empty.
   2. **Navigation:**
      - four tabs;
      - the header shows the date, the calendar and the avatar on every tab;
      - the avatar opens Account;
      - the calendar refuses future days, and days more than 90 days back.
   3. **Targets:** set all five; each shows "Set by you". The calories card shows 0% and the whole
      target remaining, and so does protein. The workout tracker shows "0 of T · T left".
   4. **Steps and sleep:** log both, then replace them. Out-of-range values are refused. On a
      past day picked from the calendar, the banner shows and the values belong to that day.
   5. **Measurements:**
      - Save stays disabled until both waist values are entered;
      - values in inches, the optional fields and notes all save;
      - X saves nothing;
      - the card hides for this week and shows again on a previous week.
   6. **Offline:** in airplane mode with the app open (no reload; Skeleton decision 8), log
      steps, sleep and measurements and change a target. After reconnecting, all of them sync.
      Log out and sign in again: everything comes back from the server.
   7. **Weight still works:** the tile, and the history from the Progress tab.

## Risks
- **Refactoring sync could break weight logging.** The Skeleton's weight tests stay unchanged and
  must pass, and the pull across kinds is tested with a page size of 2.
- **The owner's phone database already holds data.** The migration from version 1 is tested. It
  clears the cursor, so the next sync pulls everything again, which is harmless.
- **`dev:phone` on Windows: Ctrl+C and process trees.**
  - The script stops each process tree with `taskkill /T` and cleans up on any exit.
  - If the script itself is killed, the next run replaces the address; the runbook says how to
    empty it by hand.
- **Tunnel addresses in test files:** the samples are built at run time, so CI's check stays
  clean.
- No other new risks: no native code, no new accounts and no Supabase setting changes; only the
  migration.

## Verification
- On the PC and in CI, for every pull request: `npm run lint`, `npm run typecheck`, `npm test`
  (both time zones in CI) and `npm run test:integration`.
- Each pull request says what passed, what failed and what was not run.
- End to end: the owner's checks above. Results are recorded in this plan's progress table, and in
  ADR-0007 where they apply.
