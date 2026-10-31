# Settings and account slice plan

- Status: **Accepted**, approved by the project owner on 2026-10-30 (D-S1, a temporary ID until
  the slice is merged)
- Owner: Project owner (D-01)
- Last updated: 2026-10-30 (every step built: pull requests #43, #45, #46 and #47, and step 5's;
  Progress (slice 5) merges first, then these are rebased and their IDs made final: D-31, E-21 on,
  RB-04)
- Builds on: [`mvp-scope.md`](../product/mvp-scope.md) section 5, slice 6 (D-18, D-20); the
  [Training slice](training-slice.md); the contracts in [`docs/contracts/`](../contracts/);
  [`test-strategy.md`](../quality/test-strategy.md);
  [`definition-of-done.md`](../quality/definition-of-done.md); ADR-0004, ADR-0005, ADR-0007

This is the sixth MVP slice, for the Personal Training User only (D-20). It builds:
- Appearance: System, Light or Dark, with helper text; System follows the phone;
- the lifting-weight and body-weight units, kg or lb, each on its own, applied everywhere a weight
  is typed or shown, through the shared unit helpers;
- the "AI meal reading" switch and its record, off by default, with no AI call (moved here from
  slice 7, D-S1);
- "Country and time zone: India · Kolkata" as fixed text (D-09, D-S1);
- change password; log out (already built);
- delete account: the user's data, files and sign-in account, and the text of the web page that
  explains how to ask for deletion by email.

It is built **in parallel with slice 5, Progress**, in its own worktree. Where the contracts define
something, this plan does not repeat it.

## Progress
| Step | Status | Branch |
|---|---|---|
| 1. Server: settings sync and the consent record | Pull request #43 | `settings/01-server-settings` |
| 2. Server: delete account | Pull request #45 (after #43) | `settings/02-delete-account` |
| 3. Phone: settings on the phone and units everywhere | Pull request #46 (after #45) | `settings/03-phone-units` |
| 4. Phone: light and dark theme | Pull request #47 (after #46) | `settings/04-theme` |
| 5. Settings screen, change password, delete account; close-out | Pull request #48 (after #47) | `settings/05-settings-screen` |
| Owner's actions and checks at the end of the slice | Pending: the secret key, migration 0008 on `fitsphere-dev`, phone checks 1 to 9 | — |

## Scope
| In this slice | Requirements |
|---|---|
| Appearance: System, Light or Dark with helper text; System follows the phone | REQ-ACC-001 |
| Lifting-weight and body-weight units, kg or lb, independent, applied everywhere | REQ-ACC-002, REQ-ACC-003, REQ-TRN-005, REQ-HOME-006 (Q-024) |
| The AI meal-reading consent switch and record: off by default; each change records on or off, the server's time and the consent text's version; no AI call | REQ-ACC-004 (the record; D-S1) |
| "Country and time zone: India · Kolkata", fixed text | REQ-ACC-006 (still *Won't*: nothing can be changed; D-09, D-S1) |
| Change password; log out (already built) | REQ-ACC-007, REQ-ACC-008 |
| Delete account: the data, the files and the sign-in account; the web page's text | REQ-ACC-009 (Q-048 MVP default) |

Not in this slice:
- AI calls and the server's consent check before each one (slice 7);
- the owner's logged path for acting on a deletion request sent by email, with the admin access
  log (REQ-NFR-005, ADR-0004 rule 8): release-blocking item RB-S1;
- asking for the password again before deleting an account (backlog E-01);
- links and the "no longer linked" message (D-20, backlog B-19).

## Decisions
**1. Working beside slice 5.**
- IDs: D-S1 for this plan's approval and the owner's choices, E-S1… for new backlog edge cases,
  RB-S1 for the release-blocking item. They are temporary and get their numbers when the slice is
  merged.
- The server migration is `0008_settings.sql` and the phone schema takes version 7: main ends at
  0007 and version 6, and slice 5 has neither a migration nor a phone schema change. Both are
  checked again before each pull request. The migration runs on Supabase only when the owner says
  so.
- Shared files get small additions only, placed apart from slice 5's where possible.
- This slice owns the theme module (`apps/mobile/src/theme.tsx`: `ThemeColors`, `LIGHT_COLORS`,
  `DARK_COLORS`, `useTheme()`) and the unit hooks (`apps/mobile/src/settings/SettingsProvider.tsx`:
  `useBodyWeightUnit()`, `useLiftingWeightUnit()`). Slice 5's Progress screens read them. Each hook
  has a safe default (light, kg) without its provider. Whichever slice merges second makes the
  one-line switch from slice 5's stand-ins.
- Slice 6 does not touch the Progress screens (`app/(tabs)/progress.tsx`, `src/progress/`,
  `ProgressScreen`); slice 5 leaves the contents of `HistoryScreen.tsx` and `WeighInList.tsx` to
  slice 6.
- Before each pull request, the branch is rebased on the latest main (the later steps on the step
  before them) and every check is run again.

**2. No new packages, so no EAS build.** Theme and units are plain JavaScript and React Native.

**3. Workflow as D-21.** One branch and one pull request per step; steps run back to back; the
owner's merges, the secret key, the migration and the phone checks are batched at the end.

**4. Deleting the sign-in account (D-S1 answer 4).** The API uses a Supabase secret key, on the
server only (`SUPABASE_SECRET_KEY`), for one call: Supabase Auth's admin "delete user". Without it,
Delete account answers that it is not available and deletes nothing.

**5. MVP defaults** chosen under D-18 answer 3. They are listed in
[`constraints-and-assumptions.md`](../architecture/constraints-and-assumptions.md#mvp-defaults-d-18)
in the step that builds each one, and in each pull request.

| Question | MVP default |
|---|---|
| Where settings live | Per account: they sync through the outbox like targets, so they work offline and come back after logging out and signing in. Before sign-in the app follows the phone's theme. With nothing chosen: System, kg, kg |
| What the theme covers | The app's own colours, the headers and tab bar (expo-router's navigation theme) and the status bar. Android's own dialogs and the keyboard follow the phone's setting |
| Theme helper text | System: "Matches your phone's light or dark setting." Light: "Always light." Dark: "Always dark." |
| Limits in lb | Each limit is converted from grams and rounded inwards to one decimal, so every value typed stays within the limits in grams |
| cm or in for measurements | Unchanged: the toggle in the measurements sheet, remembered on the phone only (D-23); not a setting |
| Changing AI consent | Online only, through `PUT /v1/me/ai-consent`; the server records its own time. Offline, the switch shows the last known choice, disabled, with "Changing this needs an internet connection." Every change is kept |
| Consent text (version `2026-10-30`; Legal reviews it, Q-049) | "When it is on, the meal text you type or speak, and the meal and label photos you choose to read, are sent to Google's Gemini AI service to estimate what you ate. They may be processed outside India. You check the result before it is saved. Voice is turned into text on your phone; recordings are not sent. Off by default; you can turn it off at any time." |
| The Settings screen | The avatar's "Account" screen keeps its route and is titled "Settings": Appearance; Units; AI meal reading; Country and time zone; Account (email, Your targets, Change password, Log out, Delete account); then the development tools, in development builds only |
| Change password | Asks for the current password and a new one (8–72 characters, as at sign-up). The current one is checked by signing in again; then `updateUser`; then the user's other devices are signed out (`signOut({ scope: 'others' })`). Online only |
| Confirming deletion | A separate screen lists what is deleted, then "Delete my account", then a confirmation dialog. Online only. Afterwards the phone's database is deleted, the user is signed out, and the sign-in screen says "Your account has been deleted." |
| Links when an account is deleted | No links exist (D-20). The deletion still removes any `links` rows and their permission answers, so they can never block it |
| Record of a deletion | The request's log line (route, status, user ID, request ID) and an "account deleted" line, with no email address or health data. The admin access log comes with RB-S1 |

## Data and API
The contracts are updated first: [`data-model.md`](../contracts/data-model.md) (`settings`,
`ai_consents`), [`api-conventions.md`](../contracts/api-conventions.md) (`setting.set`, the pull,
the consent routes, `DELETE /v1/me`) and [`error-model.md`](../contracts/error-model.md).

- **Shared:** `THEME_PREFERENCES`; `SETTING_SET` and its strict data, checked per name;
  `DEFAULT_SETTINGS`; `AI_CONSENT_TEXT` and `AI_CONSENT_TEXT_VERSION`; the consent request and
  response; the `settings` list in the pull.
- **Migration `0008_settings.sql`:** `app.settings`, keyed by (`user_id`, `name`), with the touch
  trigger; `app.ai_consents`, one row per change. Row level security on with no policies; both
  deleted with the user.
- **Sync:** `setting.set` replaces the setting's value; the pull always includes changed settings,
  like targets.
- **Routes:** `GET` and `PUT /v1/me/ai-consent` (access `account`, the caller's own record);
  `DELETE /v1/me` (access `signedIn`, so a deletion stopped part-way can be finished). Deletion
  runs in an order that is safe to repeat:
  1. without the secret key or storage, `503 SERVICE_UNAVAILABLE` and nothing is deleted;
  2. the files of every meal photo the user has, deleted ones included, are removed; if that fails,
     `503` and nothing in the database has changed;
  3. in one transaction, the user's links and permission answers, then the user's row, which takes
     every other table with it;
  4. the Supabase sign-in account is deleted (already gone counts as done);
  5. `204`.
- **Phone:** a `settings` table (version 7) and a `setting` kind keyed by name, like targets;
  `SettingsProvider`; the unit hooks; the consent's last known state in `sync_meta`.

## Steps
### Step 1: Server: settings sync and the consent record (REQ-ACC-001…004, REQ-NFR-001)
**Builds:** the shared schemas; migration 0008; `setting.set` and the pull; the two consent
routes; the contract documents; this plan, D-S1, the slice rows in `mvp-scope.md`, REQ-ACC-004 and
REQ-ACC-006, J-10, `CLAUDE.md` and the docs index.

**Tests**
- Shared: every setting's values and the wrong ones; strict fields; the defaults; the consent
  request with its version.
- `settings.test.ts`: applied and pulled; a later change replaces the earlier one; once only by
  `changeId`; changed settings only after a cursor; `VALIDATION_FAILED` without the values;
  `ROLE_NOT_ENABLED`; a second user with the same name and `changeId` never changes or receives the
  first user's settings.
- `ai-consent.test.ts`: the authorization blocks (401, 403, self only); `null` before any choice;
  on then off gives two rows with the server's times and the version; the latest wins; a wrong
  version, a missing or unknown field records nothing; the log has the route only.
- `migrate.test.ts`, `schema.test.ts` (the checks, row level security, the cascade), `sync.test.ts`
  and `routes.test.ts` list the new migration, tables, pull list and routes.

### Step 2: Server: delete account (REQ-ACC-009)
**Builds:** `deleteUser` in the auth module with `SUPABASE_SECRET_KEY` (server only; in
`.env.example` and the runbook's configuration names); the deletion module and `DELETE /v1/me`;
ADR-0004 rule 7 notes; the web page's text, `docs/legal/account-deletion-page.md` (how to delete
in the app; how to ask by email, with the address left for the owner until FitSphere's domain
exists; what is deleted and what is kept, with any period left for the owner and Legal); RB-S1 in
the backlog and in `CLAUDE.md`.

**Tests** (`delete-account.test.ts`, with fake storage and a fake Supabase Auth admin):
- With synthetic data in every table a user owns and two meal photos, one deleted: no row of the
  user is left and every file is removed; a second user's rows and files are untouched.
- The admin call names the user's sign-in ID and alone carries the secret key.
- Without the key or storage: `503` and nothing deleted. Storage failing: `503`, nothing deleted.
  Supabase Auth failing after the data is gone: `503`, and a second call finishes; Auth answering
  "not found": `204`.
- Signed in with no account: only the sign-in account is deleted. `401` without a valid token.
- The log has no email address, key or health value.

### Step 3: Phone: settings on the phone and units everywhere (REQ-ACC-002, REQ-ACC-003)
**Builds:** local version 7, the `setting` kind and `SettingsProvider` with its hooks; the body
weight and lifting weight constants replaced by the setting in `format.ts`, `dayValues.ts`,
`targets.ts`, `workouts.ts` and the screens that use them (the Home tile and sheet,
`RejectedChanges`, `TargetsScreen`, `WeighInList`, `ExerciseSheet`, `WorkoutScreen`).

**Tests:** a setting saved offline is pending, then synced; a pull never overwrites a waiting
change; migrating from version 6 keeps the data. In lb: the Home tile and sheet, the target and
the history show lb; 154.3 lb is kept and shown back unchanged; switching to kg converts what is
shown. The lifting unit converts workout weights on its own. Every limit in lb and one step outside
it. The kg tests pass unchanged.

### Step 4: Phone: light and dark theme (REQ-ACC-001)
**Builds:** `theme.tsx` (the colour tokens, the two palettes, `ThemeProvider`, `useTheme`,
`themedStyles`); themed `Text` and `TextInput` in `components/ui.tsx`; the theme and the navigation
theme in the root layout, with the status bar following them; every screen and component reading
its colours from the theme.

**Tests:** System follows the phone; Light and Dark override it. Body text, muted text, the primary
colour and error text have a contrast of at least 4.5:1 on the background and on cards in both
palettes. A guard test fails on a hex colour outside `theme.tsx`, and on `Text` or `TextInput`
imported from `react-native` outside `ui.tsx`. The screen tests pass.

### Step 5: Settings screen, change password, delete account; close-out (REQ-ACC-001…009)
**Builds:** the Settings screen; `change-password` and `delete-account` screens; the notice on the
sign-in screen after a deletion.

**Tests:** choosing a theme or unit saves it and the app follows at once; the consent switch calls
the API, and is disabled offline; change password: a wrong current password, a short or unchanged
new one, success (other devices signed out, the phone's data kept), offline; delete account:
Cancel does nothing; confirming calls the API, deletes the phone's database, signs out and shows
the notice; `503` keeps the user signed in with a message to try again; offline.

**Close-out:** the MVP defaults in `constraints-and-assumptions.md`; the new backlog edge cases;
the device checks in `test-strategy.md`; ADR-0004's validation results; `mvp-scope.md`, the docs
index, `CLAUDE.md` and this plan's progress.

New backlog edge cases: E-S1, a photo upload link issued less than 10 minutes before the account
is deleted can still put one file in storage afterwards; E-S2, a sign-in account Supabase fails to
delete after the data is gone, with the app restarted before trying again; E-S3, a weight at the
very top of its range shown in lb.

## Owner's actions and checks at the end of the slice
1. Merge the five pull requests in step order, each with green CI.
2. Create a Supabase **secret key** (Project Settings → API Keys) and put it only in
   `apps/api/.env` as `SUPABASE_SECRET_KEY`. Never in the app's `.env`, never committed.
3. When the owner says so: `npm run migrate -w @fitsphere/api` against `fitsphere-dev`. One run
   applies 0006, 0007 and 0008.
4. Phone checks on the existing development build (no new build), with test data only; the owner
   starts `npm run dev:phone`:
   1. Settings shows Appearance, Units, AI meal reading, "India · Kolkata" and Account.
   2. Dark, then Light: every tab, sheet and screen is readable. System follows the phone's own
      dark mode when it is switched.
   3. Body weight in lb: the Home tile, the weight history and the target show lb. Type 154.3 lb;
      switch to kg: 70.0 kg.
   4. Lifting weight in lb: workout weights convert; body weight keeps its own unit.
   5. Offline (airplane mode): change a unit; it applies at once and syncs after reconnecting. Log
      out and sign in: the settings come back.
   6. AI meal reading: on, then off, online. Offline, the switch is disabled with its message.
   7. Change password: a wrong current password is refused; the new password works after logging
      out and signing in.
   8. Delete a throwaway test account that has a meal photo: the sign-in screen shows the notice;
      the old password no longer signs in; in the Supabase dashboard the test user is gone, and so
      are its photo files.
   9. Weight, steps, sleep, meals and workouts still save.
   - If the phone has run this slice's code before it was merged, log out once first, so the phone
     database is recreated at the right schema version.

## Risks
- **System may not follow the phone on the current build**, because `app.json` sets
  `"userInterfaceStyle": "light"`. Light and Dark work either way. If check 4.2 fails, the fix is
  `"automatic"` with `expo-system-ui` and a new EAS build; the owner is asked first.
- **Step 4 touches about 35 files.** The change is mechanical, guarded by the hex-colour test, and
  agreed with slice 5; conflicts are expected only in the root layout and `store.ts`.
- **The secret key can do anything in Supabase Auth.** It stays on the server, is used by one
  function, is never logged, and tests use a fake.
- **A deletion stopped part-way** is finished by calling again; the steps are ordered so a retry
  is always safe.
- **E-S1:** a photo still being uploaded during the deletion can leave one file.
- **RB-S1:** acting on a deletion request sent by email needs the owner's logged admin path,
  which is not built yet; it must be before real users.
- **Merge conflicts with slice 5** in the shared lists (the store, the root layout, the docs):
  expected and small; fixed by the rebase before each pull request, with every check run again.

## Verification
- For every pull request, on the PC and in CI: `npm run lint`, `npm run typecheck`, `npm test`
  (both time zones in CI) and `npm run test:integration` (this worktree's `TEST_DATABASE_URL`).
  Each pull request says what passed, what failed and what was not run.
- End to end: the owner's checks above, recorded in this plan's progress table and in ADR-0004's
  validation results (step 7, account deletion).
