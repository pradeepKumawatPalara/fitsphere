# Skeleton slice plan

- Status: **Accepted** — approved by the project owner on 2026-10-28 (D-18 answer 14)
- Owner: Project owner (D-01)
- Last updated: 2026-10-28 (D-19: development on the owner's phone with EAS Build; no emulator.
  D-20: the MVP is the Personal Training User view only; steps 11 and 12 moved to the backlog,
  step 9 simplified to self-access)
- Builds on: [`mvp-scope.md`](../product/mvp-scope.md) (D-18), the contracts in
  [`docs/contracts/`](../contracts/), [`test-strategy.md`](../quality/test-strategy.md),
  [`definition-of-done.md`](../quality/definition-of-done.md), ADR-0001 to ADR-0007

The Skeleton is the first implementation slice. It proves the riskiest foundations before any
feature work:
- the monorepo and CI;
- sign-in through Supabase (ADR-0004);
- IST dates (invariant #5);
- weight logging online and offline (ADR-0007);
- server-side authorization, which is self-access only in the MVP (invariant #1, D-20);
- the ADR-0001 to ADR-0007 validation steps that fit this slice.

Where the contracts define something, this plan does not repeat it.

## Progress
| Step | Status | Branch |
|---|---|---|
| 1. Monorepo, tooling and CI | Done (merged 2026-10-28) | `skeleton/01-monorepo-ci` |
| 2. App shell on the phone | Done (merged 2026-10-28; phone check in ADR-0001) | `skeleton/02-app-shell` |
| 3. Shared dates, units and contract schemas | Built 2026-10-28; waiting for CI and the phone check | `skeleton/03-shared-dates-units` |
| 4. Database schema and migrations | Built 2026-10-28; waiting for CI and the owner's Supabase checks | `skeleton/04-database-schema` |
| 5. API foundations and account setup | Built 2026-10-28; waiting for CI and the owner's check on the PC | `skeleton/05-api-foundations` |
| 6. Sign-up, verify, sign in, account setup, log out | Built 2026-10-28; waiting for CI, the EAS build and the phone checks | `skeleton/06-sign-up-sign-in` |
| 7–10 | Not started | — |
| 11 (push check) and 12 (iOS compile check) | Moved to the backlog by D-20: B-23 and B-24 | — |

## Before step 1 (owner; no code)
1. Install EAS CLI, sign in to Expo, and link the app to an EAS project
   ([runbook](../operations/runbook.md) step 2). Turn on USB debugging on the phone for the
   "USB + adb" checks (runbook step 3). No JDK, Android SDK or emulator (D-19).
2. Install PostgreSQL 17 for Windows, for the tests (native install, not Docker: D-18 answer 14).
3. Create `apps/api/.env` and `apps/mobile/.env` from the examples and fill them in.
4. Supabase checks (runbook step 5):
   - an asymmetric JWT signing key is in use;
   - **Confirm email** and **Confirm phone** are both on.

Step 1 needs none of these; step 2 needs item 1, step 4 needs items 2 and 3, and step 5 needs
item 4.

## Decisions
Approved with this plan. Decisions 2, 3 and 5, and the native PostgreSQL for tests, are also
recorded as D-18 answer 14. D-20 changed decision 5.

**1. Tools and dependencies**

| Where | Packages | Why |
|---|---|---|
| Root (dev) | `typescript` (`~6.0`, the version Expo SDK 58 uses; typescript-eslint supports up to 6.0), `eslint`, `typescript-eslint`, `@eslint/js`, `@types/node` | Strict types and lint, run in CI |
| `packages/shared` | `zod`; dev: `vitest` | One strict schema for the app and the API ("Strict input"); IST dates and units |
| `apps/api` | `fastify`, `jose`, `pg`; dev: `vitest`, `@types/pg` | Fastify's built-in logger can remove fields by configuration (log rule), and its route hook supports the route-listing test. `jose` checks tokens against JWKS. `pg` with plain SQL |
| `apps/mobile` | Expo SDK 58 (blank TypeScript), `expo-router`, `expo-dev-client`, `@supabase/supabase-js`, `expo-secure-store`, `expo-sqlite` (SQLCipher), `expo-crypto`, `expo-network`; dev: `jest-expo`, `jest`, `@types/jest`, `@testing-library/react-native`, `react-dom` (pinned to the app's React version, see below) | ADR-0001, ADR-0004 rule 3, ADR-0007; Expo's documented test path |
| `apps/mobile`, added in step 6 | `react-native-url-polyfill` | JavaScript only, so no new build. supabase-js needs a full `URL` implementation, and Supabase's React Native guide installs this package for it |
| Root (dev), for the app | `eslint-plugin-react-hooks`, `eslint-plugin-expo` | In place of `eslint-config-expo`: version 58 bundles a React plugin that fails on ESLint 10 (step 2). These are the two plugins from it that matter here, at the versions it uses |
| The PC, globally (not a project dependency) | `eas-cli` (26.0.0 on 2026-10-28) | Development builds on EAS (D-19); installed globally as Expo's guide does, or run with `npx eas-cli@26`. `apps/mobile/eas.json` sets the minimum version |
| The PC (not a project dependency) | `cloudflared`, from Cloudflare's GitHub releases | The development tunnel from the phone to the API (D-19 answer 6, Q-093): Cloudflare's Quick Tunnel, free and with no account |

- Each package is installed in the first step that uses it.
- Deliberately **not** added: a date library (IST is a fixed +05:30 offset), an ORM, `dotenv`
  (Node 24 has `--env-file`), a TypeScript runner (Node 24 runs the API's TypeScript directly),
  Prettier, and `@expo/ngrok` (Expo's own tunnel is the default, D-19).
- Migrations are numbered SQL files applied by a small, tested runner.
- Workspaces use npm, which needs no extra tool. Expo sets up Metro for monorepos from SDK 52.
- **One copy of React.** Two copies break the app at runtime (Expo's monorepo guide). Expo's
  command-line tools pull in `react-dom` as an optional peer, and an unpinned one asks for a newer
  React than the app's. So `apps/mobile` pins `react-dom` to the app's React version, and the
  root `overrides` pin both. Check with `npm ls react react-dom --all`: one version of each.

**2. Workflow** (changed by D-21 on 2026-10-28)
- One branch and one pull request per step.
- The owner merges it on GitHub once CI is green and the step's check is done.
- Steps 3 to 10 run back to back. Work stops only when the owner is needed: Supabase or the
  owner's accounts, a phone check, a cloud build, or a decision on privacy, security or a D-
  decision. Each stop lists the pull requests to merge, the phone checks and what is needed.
- Each pull request targets `main`. Until the step before it is merged, it also shows that step's
  commits, so the pull requests are merged in step order.
- *Before D-21: work stopped after every step.*

**3. Minimum password length: 8.** Supabase's docs advise against less. There are no character
rules; leaked-password checks need the Pro plan.

**4. App identity: Android application ID `com.fitsphere.app`, link scheme `fitsphere`.** The
application ID cannot change after the first Play Store upload, and the Firebase setup for push
(backlog B-23) depends on it.

**5. The push check is post-MVP (D-20).** It was kept in the Skeleton under D-13 and D-18
answer 14. D-20 moved it, with the iOS compile check, to the backlog (B-23, B-24), so the
Skeleton needs no Firebase project and no `expo-notifications`.

**6. New MVP default, recorded in step 10:** a new account's body-weight unit is kg (the BRD says
"Weight (kg)"). The Skeleton shows kg until the Settings slice adds the setting (REQ-ACC-003).

**7. Claude Code is denied reading or writing `.env` files** by the committed
`.claude/settings.json` ([runbook](../operations/runbook.md) step 6).

**8. Builds and devices (D-19, 2026-10-28).**
- Development builds come from EAS Build (`development` profile) and are installed on the
  owner's phone from the EAS link. There is no emulator and no local Android build.
- A new build is needed only when native code changes:
  - a package with native code is added or upgraded;
  - a native setting in `app.json` changes;
  - the Expo SDK is upgraded.
- Claude Code tells the owner before each build.
- Live code: `npm run start -w @fitsphere/mobile` (`expo start --dev-client --tunnel`).
- The API from the phone (D-19 answer 6): a Cloudflare Quick Tunnel to the API on the PC, only
  while testing, with test data only, and closed after use. Its address is never committed
  (runbook step 8).
- A development build loads its code from the PC each time it starts, so it cannot be reopened
  with the network off. Checks that reopen the app offline, and checks that read the phone's
  files, are marked **USB + adb**.

## Steps
Each step lists its requirements, what it builds, its automated tests, and a check the owner
runs. Test names start with the REQ ID or ADR step they check.

### Step 1: Monorepo, tooling and CI (definition of done; test strategy, "Where checks run")
**Builds**
- Root `package.json` with npm workspaces for `apps/*` and `packages/*`, and scripts `lint`,
  `typecheck`, `test` and `test:integration`.
- `tsconfig.base.json` (strict) and `eslint.config.js`.
- `.gitignore` additions: `node_modules`, build output, `.expo`, and `apps/mobile/android` and
  `apps/mobile/ios` (generated at build time).
- `packages/shared`, exporting only the API base path.
- `apps/api` with an app factory and `GET /v1/health`.
- `.github/workflows/ci.yml`:
  - runs on pushes to `main` and on every pull request, with `permissions: contents: read` and
    actions pinned to a major version;
  - lint, type-check, unit tests; shared date tests under `TZ=Asia/Kolkata` and
    `TZ=America/Los_Angeles`;
  - a job with a `postgres:17` service container (the major version is confirmed against
    Supabase in step 4).
- `.claude/settings.json` with the `.env` deny rules.
- Test-strategy "Tools" and the runbook's install and check commands.

**Tests:** health returns `{ "status": "ok" }`, through Fastify's in-process request helper.

**Owner's check (PC)**
- `npm run lint`, `npm run typecheck` and `npm test` pass.
- With the API started (`npm run dev -w @fitsphere/api`), `http://127.0.0.1:3000/v1/health` in a
  browser shows `{"status":"ok"}`.
- CI is green on the pull request.

### Step 2: App shell on the phone (ADR-0001 step 1; D-19)
**Builds**
- A blank TypeScript Expo app in `apps/mobile`, keeping its existing `.env.example`.
- `expo-router` and `expo-dev-client`.
- `app.json` with the name, the `fitsphere` scheme and the `android.package` from decision 4.
- `eas.json` with a `development` profile: a development client (Gradle's debug build) with
  internal distribution, which gives an install link and QR code.
- One EAS Android development build, installed on the phone from its link.
- `npm run start -w @fitsphere/mobile` runs `expo start --dev-client --tunnel`.
- A screen that imports a value from `@fitsphere/shared` (proves the workspace link) and calls
  `GET /v1/health`.
- How the phone reaches the API during development: a Cloudflare Quick Tunnel (D-19 answer 6,
  Q-093), started and stopped as in the runbook's step 8. A CI step fails if a Quick Tunnel
  address is committed.

**Tests:** jest-expo set up; the screen shows "API: ok" or "API: unreachable".

**Phone check (OnePlus Nord CE4)**
- The build installs from the EAS link and opens.
- With `npm run start -w @fitsphere/mobile` running, the app loads its code through the tunnel.
  A change to the screen's text shows on the phone without a new build.
- With the API and the tunnel running, it shows "API: ok"; stop the API and "Check again" shows
  "API: unreachable".
- Stop the tunnel afterwards and empty `EXPO_PUBLIC_API_URL` (runbook step 8).
- Result recorded in ADR-0001.

### Step 3: Shared dates, units and contract schemas (REQ-DATE-001…004, REQ-HOME-006; invariants #5 and #6)
**Builds**
- `packages/shared/src/dates.ts`: `istToday`, `istDayOf`, `isFutureIstDay`, `addDays`, and the
  Mon–Sun IST week.
- `units.ts`: kg or lb with one decimal, to and from whole grams; 20,000–300,000 g.
- `contracts.ts`: strict Zod schemas for `POST /v1/me`, the sync request and response,
  `weighIn.set`, the error body and the error codes.

**Tests**
- `18:29:59Z` is still the same IST day; `18:30:00Z` is the next.
- 23:50 IST belongs to that IST date (REQ-DATE-004).
- Week edges and future days.
- A one-decimal kg value converts to grams and back unchanged.
- Out-of-range values are refused, and so are unknown fields.
- In CI, all of these run in two time zones.

**Phone check**
- The screen shows "Today (IST): …".
- In the phone's date and time settings, turn off the automatic time zone and choose Los
  Angeles: the IST date stays right while the clock changes. Set it back afterwards.

### Step 4: Database schema and migrations (data model; ADR-0003 (a)–(e); ADR-0002 step 2)
**Builds**
- `apps/api/migrations/0001_skeleton.sql`, built from `data-model.md`:
  - schema `app` and the `app.change_seq` sequence;
  - tables `users`, `user_roles`, `links`, `head_coach_permission_answers`, `weigh_ins` and
    `applied_changes`;
  - checks and the partial unique index;
  - row level security turned on with no policies.
- `user_roles`, `links` and `head_coach_permission_answers` are created so that links can be
  added later without rework (D-20). In the MVP only the database tests below write `links` and
  `head_coach_permission_answers`; no route, screen or other fixture does.
- A migration runner: each numbered file runs in one transaction, applied files are recorded,
  and an applied file that was later edited is refused.

**Tests (local PostgreSQL)**
- (a) A second active coach link for one trainee is refused.
- (b) Switching is all-or-nothing.
- (d) An ended link keeps its row.
- Checks on weight range and link status.
- (c) A weekly-average query over 10,000 synthetic weigh-ins: the time is recorded, with no
  target (Q-050).

**Owner's checks (Supabase; no phone)**
- Run the migrations on `fitsphere-dev`.
- Turn **Enable Data API** off. One given command shows the auto-generated REST endpoint returns
  nothing (ADR-0002 step 2, ADR-0003 (e)).
- A script measures database growth per 10,000 synthetic weigh-ins, then deletes them (R-005
  trigger estimate).

### Step 5: API foundations and account setup (REQ-ACC-010, REQ-ROLE-001/002, REQ-NFR-001/002; ADR-0004 rules 3–4; ADR-0002 step 6)
**Builds**
- One `auth` module:
  - checks tokens against the project's JWKS: issuer, audience, `role` and expiry, and refuses
    anonymous sessions;
  - reads the Supabase user record only at account setup, for `email_confirmed_at`.
- The access module: every route declares its rule, and anything not declared is refused.
- The error model: error shape, request IDs, the 100 KB body limit, no CORS.
- A logger configured to drop bodies, headers, tokens and email addresses.
- `GET /v1/me` and `POST /v1/me`.

**Tests:** as in test-strategy "Account and sign-in" and the 401 cases. Tokens are signed by a
key made for each test run.
- An expired token, one signed by another key, the wrong audience, and an anonymous session are
  all refused.
- `ACCOUNT_SETUP_REQUIRED`, `AGE_CONFIRMATION_REQUIRED` and `EMAIL_NOT_VERIFIED`.
- The stored email comes from Supabase, never from the request body.
- A second setup call returns `200` and changes nothing.
- The route-listing test.
- The log-content test.

**Owner's check (PC):** with the API running against `fitsphere-dev`,
`curl http://localhost:3000/v1/me` returns `401` with a request ID and no detail.

### Step 6: Sign-up with 18+, verify, sign in, account setup, log out (REQ-ACC-010, REQ-ACC-008; D-11, D-18, Q-080)
**Owner, first:** in Supabase, add the redirect URL `fitsphere://**`, set the minimum password
length (decision 3), and keep email links at 24 hours or less. The actual menu paths are
recorded in the runbook.

**Builds**
- The supabase-js client with the publishable key; the session kept in SecureStore, with
  storage errors handled.
- Screens: Sign up (the "I am 18 or older" box disables the button until ticked; the
  confirmation and its text version are saved in user metadata), Check your email, Sign in,
  Account setup (asks the 18+ question only if the metadata lacks it), and Home showing the
  email and Log out.
- The deep link from the verify email.
- Neutral texts from the error model; named "needs internet" warnings.
- In development builds only: a "test expired token" button. It keeps the current access token
  inside the app and, after more than an hour, sends it to `/v1/me`; `401` is expected. The
  token never leaves the phone.

**Tests (Supabase faked)**
- The button stays disabled until the box is ticked.
- Every Supabase outcome shows the same text: success, already registered,
  `email_address_not_authorized`, no network.
- The sign-in failure text and the offline warnings.
- Account setup sends the confirmation and the text version.

**Phone checks:** these use about 2 emails, within the built-in sender's 2 per hour.
1. Sign up with your own address and see the neutral text.
2. Try to sign in before verifying: it is refused (Q-080).
3. Open the email link on the phone, from its email app.
4. Sign in, complete account setup, and Home shows your email.
5. Log out.
6. Sign up again with your address, then with an address outside your team: same text. One
   given command calls Supabase Auth directly with the publishable key, to check it never says
   "User already registered" (ADR-0004 step 2; timing waits for Resend).
7. After an hour, the expired-token button gets `401` (ADR-0004 step 3).
8. Supabase Auth working with the Data API off is proven by checks 1–4 (ADR-0002 step 2,
   ADR-0004 step 3).

### Step 7: Forgot password and set a new password (REQ-ACC-010; D-11)
**Builds:** `resetPasswordForEmail`, whose link `fitsphere://reset-password` opens "Set a new
password" (`updateUser`).

**Tests:** the neutral text for every outcome; the password rules; handling of the link.

**Phone check (1 email)**
- Request a reset for your address, open the link on the phone, set a new password, log out,
  and sign in with the new password.
- A reset for an address outside your team shows the same text.

### Step 8: Encrypted phone database and outbox (ADR-0007 rules 1, 5 and 7; REQ-NFR-004)
**Builds**
- `expo-sqlite` with `useSQLCipher: true`.
- A random 32-byte key from `expo-crypto`, kept in SecureStore.
- At start, `PRAGMA cipher_version` must return a row before `PRAGMA key`. If it doesn't, the
  app stops with an error and never runs unencrypted.
- Local tables `weigh_ins`, `outbox` and `sync_meta`, one user per database.
- Log-out logic: with an empty outbox, delete the database and its key; otherwise warn first
  (MVP default).
- A development-only check that writes and reads 1,000 synthetic rows with timings.

**Tests:** outbox, pruning and log-out decisions against an in-memory repository; the "SQLCipher
missing" path.

**Phone checks**
- The start-up check passes.
- With the app open, turn on airplane mode: the 1,000-row check passes, and its times are
  recorded (ADR-0001 step 4). Do not reload the app while offline (decision 8).
- **USB + adb:** copy the database file off the phone with a given `adb … run-as` command
  (development builds are debuggable, which `run-as` needs); a SQLite viewer cannot open it
  (ADR-0007 step 6).

### Step 9: Sync and weigh-in reads; the self-access authorization suite (REQ-NFR-001, REQ-NFR-004, REQ-HOME-006; T-02; D-20)
**Builds**
- `POST /v1/sync` exactly as in `api-conventions.md`:
  - once-only through `applied_changes`, with the user-row lock and `change_seq`;
  - checks per change: `DAY_IN_FUTURE`, `VALIDATION_FAILED`, `ROLE_NOT_ENABLED`,
    `UNKNOWN_CHANGE_TYPE`;
  - the cursor, the 90-day window, pages of 500, and `413` above 100 changes.
- `GET /v1/users/{userId}/weigh-ins` through the access module, with one rule in the MVP: the
  user themselves (D-20). The user's ID stays in the path, so coach access can be added later as
  a rule, not a new route.

**Tests**
- The sync list and the authorization table in the test strategy: the user gets their own
  weigh-ins; anyone else gets `404`.
- No other user's data: a second user's sync never changes or returns the first user's
  weigh-ins, even with the same day and `changeId`; no route writes another user's weigh-ins.
- The log test with a weight value.
- Post-MVP (D-20; backlog B-19 to B-21): the link, Head Coach permission and coach-target cases
  of ADR-0002 step 4 and ADR-0004 step 4, with the fixtures that build links and answers.

**Owner's check:** the integration suite is green on the PC and in CI. No phone check in this
step.

### Step 10: Log and view weight, online and offline (REQ-HOME-006, REQ-DATE-001/002/003, REQ-NFR-004, REQ-ACC-008; ADR-0007 rules 1, 2, 6 and 7)
**Builds**
- Home:
  - a Mon–Sun IST week strip: today highlighted, past days selectable, previous-week arrow,
    future days disabled;
  - the past-date banner with "Back to today";
  - the Weight tile: "+ Add" or the value, e.g. "70.3 kg".
- The entry sheet: one decimal, 20–300 kg, and a new value replaces the day's value.
- Saving writes locally and to the outbox, then syncs. Sync also runs when the app starts or
  comes back to the foreground, and when the connection returns.
- A rejected change shows "…Edit or discard it."
- History: 90 days from the phone, plus "Load older" online, with a named warning offline.
- The log-out warning becomes reachable.
- Records MVP default 6.

**Tests**
- Tile, banner, strip, disabled future days, value range and the rejected-change screen.
- The sync client: a failed sync keeps the outbox; a rejected change is kept; the pull is
  applied; pruning never removes pending or rejected entries.

**Phone checks**
1. Log today's weight, then change it: the new value replaces the old.
2. Pick a past day: the banner shows; log a weight; "Back to today" returns. Future days cannot
   be picked.
3. **ADR-0007 step 1 (USB + adb):** in airplane mode, log a weight, force-stop and reopen the app
   (the entry is still pending), then go back online: it syncs. Log out and sign in again: the
   server restores exactly one value for that day. To reopen offline, the app's code comes over
   USB (`adb reverse tcp:8081 tcp:8081` with `npx expo start --dev-client --localhost`, no
   tunnel; decision 8). The given commands also make sure the API cannot be reached over USB
   while the phone is offline.
4. **ADR-0007 step 4:** turn automatic date off and set the phone one day ahead. A weight for
   its "today" is rejected (`DAY_IN_FUTURE`) and stays, even after a restart, until you discard
   it. Set the date back afterwards.
5. **ADR-0007 step 5:** with the time zone set to Los Angeles at a time when its date differs
   from India's, the entry still gets the IST day.
6. Log out with a pending entry: the warning appears, and "Stay signed in" keeps you signed in.
7. **ADR-0001 step 6:** a development-only screen shows the history list with 200 synthetic
   rows; scroll it. This counts as partial until a low-end phone is available.

**Close-out** (in step 10's pull request; it was part of step 12 until D-20)
- Record every validation result, with its date, in ADR-0001, 0002, 0003, 0004 and 0007.
- Update the test-strategy tools, the runbook commands, `CLAUDE.md` "Current phase" and the docs
  index.
- Add anything deferred to `backlog.md`.

Steps 11 (push check) and 12 (iOS compile check) are no longer in the Skeleton: D-20 moved them
to the backlog as B-23 and B-24, with what each needs.

## Risks
- **R-002, framework surprises:** they would show up first in step 2 (the first EAS build) and
  step 8 (SQLCipher). The fallback is ADR-0007 rule 5 (encrypting fields); if encryption would
  break a feature, it goes to the owner (D-14). Before D-19, a local build on the PC
  (`expo run:android`, 2026-10-28) stopped twice: at Windows' 260-character path limit in the
  native build, and at a Gradle download that timed out on the owner's network. It never produced
  an app.
- **EAS free plan (D-19):** 15 Android builds a month, in a low-priority queue, so a build may
  wait. Packages with native code are added in steps 6 (`expo-secure-store`), 8 (`expo-sqlite`,
  `expo-crypto`) and 10 (`expo-network`). With step 2, that is about 4 builds in the Skeleton,
  plus any that fail. If the limit blocks work for two months in a
  row, ADR-0001's revisit condition applies.
- **Expo's tunnel (D-19):** while it runs, the development server has a public address. It serves
  the app's code, which holds only publishable values. Stop it when not in use. If the tunnel
  service is down, live code stops; `--tunnel ngrok`, or the development server over USB
  (decision 8), are the fallbacks.
- **The API tunnel (D-19 answer 6):** while it runs, anyone who has its address can reach the
  API on the PC. Until step 5 that is only the health check; from step 5 on, every other route
  needs a valid sign-in token, and the Supabase development project holds test data only. The
  tunnel runs only while testing and is stopped afterwards; each run gets a new address, which
  stops working when the tunnel stops. Quick Tunnels have no uptime guarantee (Cloudflare); if
  one fails, start a new one.
- **Built-in email (team addresses only, 2 per hour):** steps 6 and 7 are paced for it. ADR-0004
  step 2's timing part waits for Resend.
- **Re-testing first sign-up with the same address:** it needs the old test account removed from
  both Supabase Auth and the development database, because `users.email` is unique. A
  development-only script is added if needed.
- **Free project pauses after 1 week without activity:** resume it as in the runbook.
- **Known `npm audit` findings in development tools (2026-10-28), no fix available:** a `zod`
  3.x copy inside Expo's command-line tools (memory exhaustion on oversized input, high; fixed in
  4.6.6, which step 3 uses) and `deepmerge` 4.3.1 in Expo's config loader and Jest (prototype
  pollution, low; no fixed release). Neither is in the app bundle or the API. npm's suggested fix
  downgrades Expo to SDK 51, so it is not applied. Re-check at each step.

## Verification (end to end, after step 10)
On a fresh install on the phone (uninstall the app, then install it again from the same EAS link;
no new build):
1. Sign up, verify, sign in.
2. Log a weight offline; it syncs.
3. Log out and sign in: the history is restored from the server.

Also: `npm run lint`, `npm run typecheck`, `npm test` and `npm run test:integration` pass on the
PC; CI is green; every result is recorded in the ADRs. Each report says what passed, what failed
and what was not run.
