# Plan: Health Connect: sleep, a 20-minute refresh and a how-to-connect guide

- Status: **Sleep left out (the owner, 2026-11-24: "leave the sleep, build the rest").** Built on branch `feat/health-connect-refresh-guide`: the 20-minute refresh while the app is open and not in the background (`REFRESH_MINUTES`, `HealthSyncProvider.tsx`), the "Updates about every 20 minutes / Last updated" line, a "What FitSphere reads" card with today's steps and weight, a "Before you connect" list, and the How to connect page (`HealthGuideScreen.tsx`, route `health-guide`). Phone app only: no migration, no phone schema change, no native change, no new build. Everything below about **sleep** (its table, migration 0037, permission, rows and Allow state) is **not built** and stays here only as a proposal for later; the "Data", "Build and risk" and sleep rules do not apply to this branch. Background refresh and a Home sleep card were not chosen.
- Extends `docs/plans/health-connect.md` (Accepted, D-121, ADR-0013). That plan put **sleep and background reading out of scope**, so this is a scope change: it needs a new D-number and an ADR-0013 amendment (or a short ADR) on approval.
- Requirements: REQ-ACC-012 (Connections); a new REQ-ACC-013 (sleep from Health Connect); REQ-NFR-002.
- Invariants touched: #4 (hand logging unaffected), #5 (day = Asia/Kolkata), #7 (no values in logs). #3 not touched (no AI).
- Design: canvas "Health Connect: sleep and guide" (https://claude.ai/artifact/4cfhUi7KNg2iHwmueDwpuf), four screens, dark and light. Approved by the owner on 2026-11-24 ("Go ahead with design"); not yet marked locked.
- Branch: its own, off `main`, in its own folder. Not on `feat/measurements-date-calendar`.

## What the user sees (matches the canvas)
1. **Connections, connected:** Health Connect panel, "Updates about every 20 minutes" with the last update time, **Read now**; a card "What FitSphere reads" with Steps, Weight and **Sleep** (each with its latest value, day and source app); a "How to connect" row; Disconnect.
2. **Connections, not connected:** Connect, plus a three-step "Before you connect" list and "See the full guide".
3. **How to connect** (new screen, route `health-guide`): four steps (install Health Connect; open it, it links FitSphere to other apps; connect Fastrack or Google Fit to it; Profile › Connections › Health Connect), a "Not showing yet?" tip, Go to Connections.
4. **Sleep not allowed:** Steps and weight keep working; the Sleep row says "Not allowed in Health Connect" with **Allow**, which reopens Android's permission screen.

## Rules
- **Sleep:** Health Connect `SleepSession` records, read only. A night belongs to the India day it **ends** in (the morning you woke), so "last night" shows under today. A day's value is the total minutes asleep, overlapping sessions counted once (merge intervals on the phone). Stored as whole minutes, 1 to 1,440 a day; outside that, skipped, not clipped (same rule as steps).
- **No manual sleep entry exists**, so there is no "manual wins" rule and no `source` column: every sleep row came from Health Connect. Disconnect › Remove deletes all of them, here and on the server.
- **Same 30-day window and same read** as steps and weight (`IMPORT_DAYS`); a read twice changes nothing.
- **Permissions:** Sleep is a third, separate permission. Today `hasAccess()` needs both steps and weight, or the app says "withdrawn". Rule change: **steps and weight granted = connected**; a missing Sleep permission only greys the Sleep row. A person already connected is not disconnected by this update; they see Allow.
- **Refresh:** a timer of 20 minutes while the app is open and in front, plus the existing reads on open, return to the foreground and Read now. One read at a time (existing guard). The line shows "Last updated <time>".
- Values and skip reasons are never logged (invariant #7).

## Data
- **Migration `0037_sleep_nights.sql`** (next free number at writing; check before building): `app.sleep_nights (user_id, day, minutes, updated_at, unique (user_id, day))`, check `minutes between 1 and 1440`, RLS and `on delete cascade` as `app.step_counts`.
- **Shared contract:** `sleep.set` sync change; `STEPS`-style range constants; `removeImported` also deletes sleep rows; pulled rows include sleep.
- **Phone:** local `sleep_nights` table, one phone schema version (taken at build time); `importFromHealth` gains `readSleep`; `HealthSource` gains `readSleep(from, to)`; the adapter asks for `SleepSession` read.
- **Permission rationale and Play:** the Android permission `READ_SLEEP` and the Health Connect declaration gain sleep (RB-06 for the owner).
- **Not stored on the server:** the connection state and refresh time stay on the phone, as now.

## Phone modules
`src/health/healthConnect.ts` (sleep read, the three-permission check), `importHealth.ts`, `HealthSyncProvider.tsx` (the 20-minute timer, the Sleep-missing state), `ConnectionsScreen.tsx` (the card, Allow, the guide row), new `HealthGuideScreen.tsx` and route, `src/local/store.ts` (sleep table and `countImported`), `app.json` (permission). Hours and minutes format: "7 h 25 min", a small helper in `src/format.ts`.

## Build and risk
- **A new native permission: a new EAS development build and `preview` APK.** The plugin's permission list changes. **Tell the owner before every build (D-19).**
- Migration 0037 and the updated API must reach `fitsphere-dev` (and so the Cloud Run beta) before a phone with this build syncs sleep. **Only when the owner says so.**
- Legal (Q-049): sleep is new health data held; add it to the brief. Risk R-019 covers wrong data from a brand's app.

## Tests (synthetic data only)
- `importHealth`: sleep per Asia/Kolkata day by end time, a session across midnight, two overlapping sessions merged, a nap, out-of-range skipped, the same read twice, no row / an earlier import / a changed value.
- Adapter and provider: Sleep permission missing leaves connected and shows Allow; all three missing reads nothing; steps and weight withdrawn still shows Not connected; the 20-minute timer reads once per tick, not while a read runs, stops when the app is in the background and when disconnected (fake timers).
- API and contract: `sleep.set` accepted and range-checked, self only, nobody else's rows; Remove deletes sleep; migration 0037 on a database with old rows.
- Phone screens: the four canvas states, the guide's steps and links, Read now, Disconnect with Keep and Remove.
- Not testable here: Health Connect itself and Android's timing; the owner checks on the phone.

## Decisions needed (defaults used if the owner does not answer, D-18)
1. **Refresh while the app is open only (default), or also in the background?** Background needs a new library (Android's work scheduler, about 15 minutes at best and not exact), another native module and a battery and Play review. Default: open and in front only, text "about every 20 minutes".
2. **Where sleep shows (default: Connections only).** A Home or Progress sleep card is a separate screen design and plan.
3. **What sleep shows (default: last night's total).** Stages and weekly views later.

## Steps (one pull request each, once approved)
1. Documents: D-number, ADR-0013 amendment, REQ-ACC-013, backlog row, Q-049 brief line.
2. Migration 0037, shared contract, API, with tests.
3. Phone without the library change: sleep import, store, the timer, the Connections screen and the guide, on a fake adapter, with tests.
4. The adapter's sleep read and the `app.json` permission, then the owner's word for the EAS build.
5. The owner's phone check of the four screens and a real sleep read.
