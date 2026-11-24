# ADR-0013: Health stores (Health Connect first) as a source of the user's own data

- Status: **Accepted** by the project owner on 2026-11-20 (D-121; the defaults in the Decision accepted; backlog work, not MVP). Plan: `docs/plans/health-connect.md`. Nothing here is built.
- Date: 2026-11-20
- Decision owner: Project owner
- Related requirements: REQ-ACC-002, REQ-ACC-003 (units), REQ-LOG-002 (the day the user chose), REQ-NFR-002 (sensitive data); a new requirement for connections is to be added with the plan
- Related constraints: C-005, C-006; invariants #3, #4, #5, #6, #7; D-19 (builds), D-20 (MVP scope)
- Supersedes: None. Adds a data source; it does not change ADR-0001, ADR-0002 or ADR-0007.

## Context
The owner wants FitSphere to bring in data that a user's watch, band or scale already records, so the
user does not type it twice. The findings list many devices (Apple Watch, Galaxy Watch, Pixel Watch,
Fitbit, Garmin, Fastrack, Noise, boAt, Amazfit, Xiaomi, Withings, Omron, Oura, Whoop, Polar) and apps
(Strava, Google Fit, Samsung Health, MyFitnessPal). Most of them do not talk to FitSphere. They write to
the phone's health store (Health Connect on Android, Apple Health on iPhone), and an app may read the
store once the user allows it.

Known (to be re-checked against Google's and Apple's documents when the plan is written):
- Health Connect is part of Android 14 and later; on older Android it is a separate Play Store app.
- The user grants access per data type on the operating system's own screen and can withdraw it.
- Health Connect gives an app no push: the app has to read. Reading while the app is closed needs an
  extra permission.
- By default an app reads only the days from the moment access is granted back about 30 days, unless
  the extra history permission is granted.
- Google's Play Store asks for a Health Connect declaration before an app that reads it is released.
- Reading Health Connect needs native code, so a new EAS development build (D-19).

Uncertain: which brands' own apps really write to Health Connect, and how well (steps, weight, heart
rate and workouts differ by brand). Only a test with real devices settles this. Whether Legal accepts the
use (Q-049).

## Decision criteria
1. **Must:** the user chooses what is shared, on the operating system's own permission screen, and can
   disconnect at any time.
2. **Must:** the invariants hold: #4 logging by hand always works; #5 each reading belongs to the day
   in Asia/Kolkata; #6 canonical units, converted only for display; #7 nothing sensitive in logs,
   analytics or fixtures.
3. **Must:** an imported value never silently replaces something the user typed.
4. **Must:** the user can tell which values came from a device and which they typed.
5. **Should:** no cost, no new server provider and no account with a third party for the first release.
6. **Should:** one design that a second source (Apple Health, then others) can join without rework.
7. **Should:** small and reviewable; the offline path of ADR-0007 is reused, not replaced.

## Options considered
### Option A — Read the phone's health store on the phone, one adapter per source (Health Connect first)
One Connections screen in Settings. Each source is an adapter on the phone that asks permission, reads,
and converts to FitSphere's own shape. The result is written to the phone's local database and travels
to the server through the existing outbox and sync (ADR-0007).
- Benefits: free; reaches most watches, bands and scales through their own apps; the user's health
  data goes from their phone to FitSphere's server only, with no third party in between; reuses sync.
- Costs and risks: Android only at first; coverage depends on each brand's app writing to the store;
  needs a native module and a new development build; Play Store declaration; reading only while the
  app is open in the first release.
- Fit against constraints: meets every criterion; see the decision below for the rules.
- Evidence and uncertainty: coverage is unproven until Phase 2's device tests.

### Option B — Each brand's own cloud API (Fitbit, Garmin, Withings, Polar, Oura, Whoop)
The server connects to each brand with OAuth and webhooks.
- Benefits: works without a health store; some brands give more detail; can run in the background.
- Costs and risks: one integration, one developer account, one review and one set of terms per brand;
  tokens and webhooks to keep safe on the server; the user's data passes through the brand and then
  FitSphere; the work grows with every brand. Garmin's and some others' programmes can have
  conditions or fees (not verified here).
- Fit: possible later for a brand that is proven and wanted; too much for a first release.

### Option C — A paid aggregator (one service covering many brands)
- Benefits: one integration reaches many devices.
- Costs and risks: a monthly cost per user or per connection; a third party holds the user's health
  data; a new provider for Legal and for Q-049.
- Fit: only if many users ask for devices no other route reaches; not now.

### Option D — File import (for MyFitnessPal and similar)
- Benefits: free; needs no permission from a brand.
- Costs and risks: manual for the user; one parser per file format.
- Fit: useful for apps with no other route, later.

## Decision
**Option A**, accepted by the owner on 2026-11-20, with B, C and D kept as later steps, taken only for a
source that is proven and needed. The parts accepted:

1. **First source:** Health Connect on Android. Apple Health follows on iPhone with the iOS release
   (D-104); the same screen and the same data shape.
2. **First data:** steps and body weight only. Heart rate and workouts are added once the first two work
   on real devices (the exercise's heart-rate fields and Training already exist).
3. **Where it lives:** the Connections row in Settings and its screen; a health-source module on the
   phone with one adapter per source; the phone's local database (`src/local/`); the existing sync
   endpoint and shared contracts (`packages/shared`). No new server route in the first release.
4. **Source on every imported value.** Each imported record carries a source ("health_connect") so the
   app can show it and the user can remove it. One migration and one phone schema version are needed.
5. **Manual wins.** An imported value fills a day that has no value of that kind. A value the user
   typed is never replaced by an import. Two imports for the same day and kind (for example, two
   weigh-ins) follow the rule written in the plan (proposed: the latest reading of the day).
6. **Day and unit.** The day is the reading's day in Asia/Kolkata (invariant #5); weight is stored in
   the canonical unit and converted only for display (invariant #6).
7. **Reading history.** First connect reads the last 30 days (the most Health Connect gives without
   the extra history permission). After that the app reads new data when it opens and on pull to
   refresh. No reading in the background in the first release.
8. **Minimum permissions.** Ask only for the data types in use, and only when the user taps Connect.
9. **Disconnect.** Stops reading at once and asks whether to keep or remove the imported values (each
   is marked with its source, so removal is exact).
10. **No AI.** Imported data is never sent to an AI service, so invariant #3 is not touched. If a later
    feature wants to, it needs its own decision.
11. **Scope.** The MVP is the Personal Training view (D-20) and this is a new feature. The owner decided
    (2026-11-20): **backlog** (B-29), built after the current bug fixes, on its own branch.
12. **Device list.** A device or app is listed on the Connections screen only after it has been tested
    and marked Works, Partial or Not supported. The list in the findings is a target, not a promise.

## Why this option wins
It is the only route that is free, needs no third party and no server provider, and already reaches
the most devices, because most watches write to the health store. It reuses the offline and sync design
of ADR-0007, and it leaves each later source as one more adapter.

## Why alternatives were rejected
- **B** multiplies accounts, reviews, tokens and terms with every brand, and cannot be justified before
  we know which brands the users have.
- **C** adds a monthly cost and a third party holding health data, with no evidence yet that the free
  routes fall short.
- **D** is manual for the user; it fits only apps with no other route.

## Counterfactual
If the device tests show that the brands the users own do not write to Health Connect, B for those
brands (or C, if there are many) becomes the better choice. If Legal says health-store data needs a
separate consent or cannot be held, the design changes before any release.

## Consequences and accepted trade-offs
- Easier: no typing for steps and weight; one place for connections; the next source is one adapter.
- Harder: a native module, so a new development build and a Play Store declaration; two sources for
  one value (typed and imported) to explain on screen.
- Riskier: more health data is held (a new entry for the risk list and for Legal's brief, Q-049); an
  import can be wrong if a brand's app writes wrong data (the user sees and can remove it); coverage
  differs by brand and cannot be promised.
- Not covered: iPhone, background reading, brands' direct APIs, aggregators and file import.

## Validation plan
1. **Library check** (before the plan is accepted): confirm the Health Connect library, its Expo plugin
   and its Android permissions against the current documents; no dependency is added until this ADR is
   Accepted.
2. **Tests on the phone side:** mapping to Asia/Kolkata days around midnight; unit conversion; manual
   wins; the same record read twice makes one; disconnect with keep and with remove; permission
   refused or withdrawn. Synthetic data only, with a fake adapter in tests.
3. **Device tests (Phase 2):** each device the owner has, steps and weight (then heart rate and
   workouts) compared with its own app, each marked Works, Partial or Not supported.
4. **Release checks:** Google's Health Connect declaration, the privacy text and the data deletion
   page cover the new data; Legal told (Q-049).

## Revisit conditions
- A brand the users own does not write to Health Connect (consider B for it).
- Many users ask for devices no free route reaches (consider C).
- Legal's answer on health-store data (Q-049).
- Health Connect's or Google Play's rules change.

## References
- `docs/architecture/decisions/ADR-0007-offline-storage-and-sync.md` (the path imports use)
- `.claude/rules/project-invariants.md` (#3 to #7)
- `docs/legal/q-049-legal-brief.md` (to add the new data)
- Google's Health Connect documentation and Play Console Health Connect declaration (to be read and
  cited when the plan is written; not read for this draft)
