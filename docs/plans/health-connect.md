# Plan: Health Connect (Android) as a source of steps and weight

- Status: **Accepted** (the owner, 2026-11-20); step 1 in progress; open questions answered 2026-11-20 (the owner, 2026-11-20: ADR-0013's defaults accepted; this is **backlog** work, built after the current bug fixes, on its own branch)
- Requirements: a new REQ-ACC-012 (Connections, added in step 1); touches REQ-HOME-006 (steps), REQ-MEAS / weigh-ins (weight), REQ-ACC-002 and REQ-ACC-003 (units), REQ-NFR-002
- Decision: D-121 and ADR-0013 (Accepted, 2026-11-20). Backlog item B-29. Risk R-019, Legal L-20, release task RB-06.
- Invariants touched: #4, #5, #6, #7. #3 is not touched (no AI).
- Scope: Android, Health Connect, **steps and body weight only**. Not in this plan: heart rate, workouts, Apple Health, background reading, brands' direct APIs, file import, aggregators.
- Branch: its own, off `main`, in its own folder. Not on `feat/measurements-date-calendar`.

## What the user sees
1. **Settings › Connections** (a new row beside Profile) lists the sources. Only Health Connect is listed. Each row says Not connected, or Connected with the last read time, and the tested status (Works, Partial or Not supported, set by the owner after Phase 2; shown as nothing until then).
2. **Connect:** a short screen says what is read (steps and body weight), that it is only read, and that it can be stopped at any time. **Allow** opens Android's own permission screen for those two types.
   - Android 14 and later: Health Connect is there. Older: if the Health Connect app is missing, the screen says so and links to the Play Store; if the phone cannot have it, the row says "Not available on this phone".
   - Permission refused: the row stays Not connected with "Allow steps and weight in Health Connect to connect." Nothing is read.
3. **After Connect:** the last 30 days are read once, then on every app open and on pull to refresh (Home). A line on the Connections screen says "Read just now: 12 days of steps, 3 weigh-ins".
4. **On Home, Progress and the measurement and steps sheets:** a value that came from the device shows a small "Health Connect" tag. A value the user typed shows no tag.
5. **Editing an imported value** turns it into the user's own: the tag goes, and no later read changes it.
6. **Disconnect:** reading stops at once; the app asks **Keep** or **Remove** the imported values. Remove deletes the rows still tagged Health Connect (the user's own values are untouched). The user can also withdraw access in Android's settings; the next app open sees it and shows Not connected.
7. A failed read (Health Connect busy or erroring): the old values stay and the Connections screen says "Couldn't read. Try again." Logging by hand is never affected (invariant #4).

## The rules for what is imported
- **Steps:** Health Connect gives steps in intervals; the day's total is the sum over the day in Asia/Kolkata (invariant #5), counting each source app's records once (Health Connect's own aggregate, which removes overlap, not a sum done by us). Today's total is read again each time, so it grows through the day.
- **Weight:** each weigh-in is dated by its time in Asia/Kolkata; it is stored in whole grams (invariant #6) as now. If a day has several, the latest of the day is kept. Values outside 20 kg to 300 kg are skipped, as the database already refuses them.
- **One value per day:** both tables hold one row per user and day (`app.step_counts`, `app.weigh_ins`: `unique (user_id, day)`). So:
  - no row for the day: the import adds one, tagged Health Connect;
  - a row tagged Health Connect: the import updates it (steps grow through the day; a newer weigh-in replaces it);
  - **a row the user typed: never touched** (ADR-0013, "manual wins").
- **Steps over the limit:** `step_counts` allows 1 to 200,000 a day (migration 0032, D-100); a day over 200,000, or with 0 steps, is skipped, not clipped. *(The first draft said 100,000, the limit before 0032; found in step 2. The owner's answer to Q-B, "skip", stands: only the number is corrected.)*
- **The same read twice** makes no change and no duplicate.
- **Never an AI call, never logged:** the values and the reasons for a skip are never logged (invariant #7); only counts and error kinds, on the phone.

## Data
- **Migration `0036_health_source.sql`** (the next free number; 0035 is another branch's): a `source` column on `app.step_counts` and `app.weigh_ins`, text, not null, default `'manual'`, check in (`'manual'`, `'health_connect'`). An existing row stays `'manual'`. The API takes `source` on a change and refuses a change that would turn a `'manual'` row into `'health_connect'` (the server enforces the rule, not only the phone).
- **A connections record per user and source** (the phone needs to know it, and a reinstall should show it): a small table `app.health_connections` (user, source, connected at, last read at; one row per user and source, RLS as the others), or `sync_meta`-style phone storage only. **Proposed: phone only** (`sync_meta`), no server table: the permission is the phone's, a new phone must ask again anyway, and it avoids another table holding health-related state. The owner can choose the server table instead.
- **Shared contract:** `packages/shared/src/contracts.ts` gains `source` on the weigh-in and steps changes and their pulled rows.
- **Phone schema version:** one more (the number taken at build time); the local `step_counts` and `weigh_ins` tables gain `source`.
- **Units:** nothing changes: grams stay grams; kg and lb are display only.
- **Delete account** already removes the user's rows by `on delete cascade`; imported rows go with them. The deletion page's text names Health Connect data (to add).

## Phone modules
- `src/health/` (new): `HealthSource` (the adapter's shape: `isAvailable`, `requestAccess`, `hasAccess`, `readSteps(days)`, `readWeights(days)`), `healthConnect.ts` (the one Android adapter), `importHealth.ts` (the mapping, the day and unit rules and the manual-wins rule, with no knowledge of Health Connect), `useHealthSync.ts` (reads on app open and on pull to refresh; one read at a time).
- `src/screens/ConnectionsScreen.tsx` and its route under `src/app/`; a row in Settings; the tag component beside Home's steps and weight values.
- The library: **`react-native-health-connect`** (MIT), proposed after the check below. **No dependency is added until the owner says yes to it** (this is that question, below).
- The adapter is the only file that imports the library, so a test uses a fake adapter and Apple Health later is one more file.

## Build, store and risk
- **A native module: a new EAS development build and a new `preview` APK** (an `app.json` plugin and the Android permissions `READ_STEPS` and `READ_WEIGHT`; Health Connect's permission-rationale activity). **Tell the owner before every build (D-19);** 15 free Android builds a month. No iOS change.
- **Google Play:** the Health Connect declaration and the privacy policy's text before any Play release; internal testing and the `preview` APK work without them. A Play Console task for the owner (RB-style release item, to add to the backlog's list).
- **Legal (Q-049):** health-store data is new data held; add it to the brief. A new risk, R-019 (to number on approval): an import can be wrong if a brand's app writes wrong data; shown tagged, editable and removable.
- **No server deploy is needed for the phone to read**, but migration 0036 and the updated API must be on `fitsphere-dev` before a phone with this build syncs a source (and on the Cloud Run beta's database, which is the same). **Run only when the owner says so.**

## Tests (synthetic data only)
- `importHealth` (a fake adapter): steps summed by Asia/Kolkata day, a record just before and just after midnight on each side; weights to whole grams; the latest of a day wins; out-of-range skipped; no row, a Health Connect row and a manual row for the day: add, update, leave alone; the same read twice; today's steps growing.
- API: `source` accepted and stored; a change turning `'manual'` into `'health_connect'` refused; an edit of a Health Connect row by the user turns it `'manual'`; authorization (self only, nobody else's rows); migration 0036 on a database with old rows.
- Shared contract: the schemas accept `source`, refuse other values.
- Phone: Connect (granted, refused, Health Connect missing, phone too old); the first read of 30 days; a read on app open and on pull to refresh, one at a time; the tag shows for imported and not for typed values; editing an imported value clears the tag and survives the next read; Disconnect with Keep and with Remove (only tagged rows go); access withdrawn in Android; a failed read keeps old values; hand logging works throughout; nothing logged.
- Not testable here: Health Connect itself. Phase 2 below is the real test.

## Phase 2: device tests (the owner's phone and devices)
For each device the owner has (for example Fastrack, Fitbit, a scale), on the dev build: read steps and weight, compare with the device's own app for three days, and record **Works**, **Partial** or **Not supported** with a note in `docs/operations/health-device-tests.md` (new). The Connections screen shows a status only for a device marked there. Heart rate and workouts are a later plan, once steps and weight work.

## Steps (one pull request each, once approved)
1. **Documents and the library check:** REQ-ACC-012, D-number, risk R-019, the backlog row, the Q-049 brief; the library chosen with the owner's word.
2. **Migration 0036, shared contract, API rule** with tests.
3. **Phone, without the library:** `importHealth`, `useHealthSync`, the local schema, the tag and the Connections screen, all on a fake adapter, with tests.
4. **The Health Connect adapter, `app.json` plugin and permissions;** the owner's word, then the EAS development build.
5. **Phase 2:** the owner's device tests, then the statuses.

## The library check (step 1, 2026-11-20)
**Proposed: `react-native-health-connect`, version 4.1.3, pinned exactly.** What I found, from the package's registry
entry, its repository and its README, and Google's Health Connect documents (sources at the end of this section):
- **Fit:** an Expo config plugin ships inside the package since v4 (no separate `expo-health-connect`; that one is
  deprecated and breaks the build if both are installed); the permission delegate is registered automatically, so no
  `MainActivity` edit. It cannot run in Expo Go, so it needs the development build, as the plan already says.
- **Maintenance:** MIT licence; 4.1.3 published 2026-08-06; the repository was last pushed 2026-08-26, is not
  archived, and has about 425 stars and 60 open issues. A small community project, not Google's (R-019).
- **Android floor:** Health Connect needs `minSdkVersion` 26 (Android 8). The README's Expo example also sets
  compile and target SDK 36 through `expo-build-properties`, which would be one more development dependency.
- **Our versions:** the app is on Expo `~58.0.20`, React Native 0.88, React 19.3. The package's peer dependencies
  say `expo: *`, `react-native: *`, so nothing is declared to conflict, but **I have not built it with them**; the
  first EAS build in step 4 is the proof. If it fails, the fallbacks are an older 4.x, or a small Expo module of our own
  around Google's client (more work; only if needed).
- **Permissions:** the README shows the plugin but not which Android permissions it adds to the manifest. Step 4
  must confirm `READ_STEPS` and `READ_WEIGHT` (and Health Connect's permission-rationale screen) end up in the built
  app, and that **no other** permission is added. If the plugin adds more or none, we set them ourselves.
- **Steps:** Google's documents say to read a day's steps with the aggregate call, which removes overlap between
  apps (only steps and sleep are de-duplicated this way). I have not confirmed that this library exposes aggregation;
  step 4 checks it. If it does not, steps would be summed from records of the phone's own source only, and the plan's
  wording changes with the owner's word.
- **The 30-day limit:** by default an app reads the 30 days before the permission was first granted, and anything
  older needs the extra history permission (`READ_HEALTH_DATA_HISTORY`); one search result said apps reading their
  own data on Android 14 and later have no such limit. This plan uses 30 days and does not ask for the history
  permission, so it is safe either way.
- **Play Console:** the library's README says the old Google Form for the Health Connect declaration is retired on
  3 September 2026 and the declaration is now made in Play Console; approval can take up to 7 days, then a whitelist
  takes a further 5 to 7 business days. This is RB-06; it does not block the owner's own testing.

Sources: [library on npm](https://www.npmjs.com/package/react-native-health-connect),
[its repository and README](https://github.com/matinzd/react-native-health-connect),
[Google: read aggregated data](https://developer.android.com/health-and-fitness/health-connect/aggregate-data),
[Google: track steps](https://developer.android.com/health-and-fitness/health-connect/features/steps),
[Google: data types](https://developer.android.com/health-and-fitness/health-connect/data-types).
The registry and README were read directly; Google's pages only through search summaries, so re-read them at step 4.

**Q-E, answered by the owner (2026-11-20): yes** — `react-native-health-connect` 4.1.3, pinned, added in step 4 (not before).

## Step 3 as built, and where it differs from the plan above (2026-11-23)
- **No pull to refresh.** The app has no pull-to-refresh anywhere, so a read happens when the app opens, when
  it returns to the foreground, and on **Read now** on the Connections screen. (The plan said "pull to refresh
  on Home"; building that gesture is a separate change.)
- **Each read covers the last 30 days**, not only new data: it is idempotent, and picks up late-arriving data.
- **Remove needed a server change** the plan had missed: `healthImport.remove` (shared contract, API handler,
  tests, `api-conventions.md`). Other signed-in phones keep their copies until those leave their 90 days.
- **The tag is on Home's Steps and Weight tiles only.** Progress, Weight history and the sheets do not show it yet.
- **The adapter is a stub** (`src/health/healthSource.ts`, answers "not supported") until step 4; the Connections
  screen therefore says "Not available on this phone." in every build made now.
- **Phone schema version 24** (`weigh_ins.source`, `steps.source`, default `manual`); the phone keeps the
  connection record in `sync_meta` (Q-A).
- New: `src/health/` (`types`, `healthSource`, `importHealth`, `HealthSyncProvider`), `ConnectionsScreen`, route
  `connections`, a Connections row in Settings, `QuickTile`'s `tag`, `removeImportedValues` and `countImported`
  in `local/store.ts`, a quiet drop of an import the server refused (`MANUAL_VALUE_EXISTS`).

## Owner's answers (2026-11-20)
- **Q-A:** the connection record is on the phone only (`sync_meta`); no server table.
- **Q-B:** a day over the limit is skipped, not clipped; the limit is not widened (200,000 steps, not the 100,000 first written: see "The rules for what is imported").
- **Q-C:** the owner accepts a proposed layout (the "What the user sees" section above) in place of a canvas board. Once built, the owner checks it on the phone before it counts as locked.
- **Q-D:** the first test device is a **Fastrack** watch. Phase 2 starts with it; other devices are added later. Whether the Fastrack's app writes steps and weight to Health Connect is unknown until tested; if it does not, the row stays unlisted (ADR-0013 criterion 12).
