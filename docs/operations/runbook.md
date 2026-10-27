# Runbook

- Status: Draft
- Owner: Project owner (D-01)
- Last updated: 2026-10-28

Only verified operational steps belong here (`docs/pre-development-guide.md` §5.10). Procedures
not yet known are marked *Not yet written* rather than guessed. D- numbers refer to
[`owner-decisions-2026-10-27.md`](../product/owner-decisions-2026-10-27.md).

Hosting is decided: Supabase in Mumbai on the Free plan (ADR-0002, ADR-0003, D-16, D-17); the
API runs on the developer's PC until Q-087 is settled.

## Local setup
For the Skeleton slice on Windows 11. Steps come from the official pages listed under
"References (local setup)", checked 2026-10-27. **None has been run on the owner's PC yet:**
mark each one verified, with the date, the first time it works, and correct it if it does not.
Commands that need the monorepo (install, run, test) are added when the Skeleton creates it.

### What is needed
| Item | Version or plan | Why |
|---|---|---|
| Node.js | **26 LTS** (Active LTS from 2026-10-28 on the Node.js release schedule). 24 LTS (maintenance until 2028-04-30) also works | API, tools, Expo CLI. Expo SDK 58 needs Node 22.13 or later |
| Git | Any recent version | Repository |
| Android Studio | Current version, with Android SDK Platform 36 (Android 16), SDK Build-Tools, Platform-Tools and the Emulator | Android development builds and the emulator (ADR-0001) |
| JDK | 17 (Microsoft Build of OpenJDK 17) | Android builds, as Expo's setup guide says |
| A real Android phone | The lowest-end one available, with a USB cable that carries data | Device checks (ADR-0001 step 6, ADR-0007) |
| Supabase account | Free plan, project in South Asia (Mumbai) | Database and sign-in (ADR-0002, ADR-0004) |
| Expo account | Free plan | EAS iOS compile check (ADR-0001 step 5) and push credentials (ADR-0001 step 7) |
| Firebase project | Free | FCM credentials for push on Android, used only for the push check (ADR-0001 step 7, D-13 answer 9, ADR-0004 rule 6) |
| PostgreSQL 17 on the PC | Installed natively for Windows, not in Docker (owner's choice, D-18 answer 14) | Integration, authorization and database tests; Supabase's current default is PostgreSQL 17 |
| A password manager | Any | Where secret values are kept (see "Secrets on the PC") |

Not needed for the Skeleton: Resend and a domain (invitations slice), or a Google Cloud billing
account (Q-087).

### Owner's PC, checked 2026-10-28
Read-only checks from VS Code; nothing was installed or changed.
- Node 24.21.0 and npm 11.19.0: usable (24 LTS).
- `origin` is the GitHub repository; `main` tracks `origin/main`.
- `JAVA_HOME` (machine-level) points to **JDK 26**, not 17. Fix in step 2.
- Android SDK: Platform 37 and Build-Tools 36.0.0 are installed; **Platform 36 is missing** and
  there is no NDK yet. The user-level `ANDROID_HOME` and the `platform-tools` entry in `Path` are
  set, but VS Code terminals see them only after VS Code is restarted.
- Emulator `emulator-5554` runs Android API level 37 (x86_64); `adb devices` lists it.
- No PostgreSQL yet; the owner chose a native install of PostgreSQL 17 (D-18 answer 14). Docker
  Desktop is installed but is not used for the test database.
- IPv6 works, so `MIGRATION_DATABASE_URL` can use the direct connection.
- Not stated by the owner: a real Android phone, a password manager, a Firebase project.

### 1. Node.js and Git
1. In PowerShell, run `node --version` and `git --version`.
2. If Node is not 26.x or 24.x, install Node 26 LTS from nodejs.org, then open a new terminal and
   check again. If nodejs.org does not yet label 26 as LTS, use 24 LTS and update this line.

### 2. Android Studio, SDK and emulator
1. Install Android Studio. In **SDK Manager**:
   - **SDK Platforms:** under Android 16 (Baklava), "Android SDK Platform 36" and "Sources for
     Android 36";
   - **SDK Tools:** at least one version of Android SDK Build-Tools, Android SDK Platform-Tools
     and Android Emulator.
2. Install JDK 17. Expo's guide uses Chocolatey: `choco install -y microsoft-openjdk17`. Without
   Chocolatey, install Microsoft Build of OpenJDK 17 from Microsoft's download page.
3. Add a **user** environment variable `ANDROID_HOME` = `%LOCALAPPDATA%\Android\Sdk`, and add
   `%LOCALAPPDATA%\Android\Sdk\platform-tools` to the user `Path`.
4. Open a new PowerShell and check: `Get-ChildItem -Path Env:` lists `ANDROID_HOME`, and
   `adb --version` prints a version.
5. In **Device Manager**, create a virtual device (a phone with Android 16) and start it once.

Expo's Windows steps do not mention `JAVA_HOME` or the NDK. If a build later says Java or the NDK
is missing, record the fix here.

If `JAVA_HOME` already points to another JDK (on the owner's PC, a machine-level JDK 26), add a
**user** environment variable `JAVA_HOME` with the JDK 17 folder; on Windows a user variable
overrides a machine variable of the same name. Open a new terminal; `echo $env:JAVA_HOME` must
show the JDK 17 folder. *Not yet verified with a build.*

### 3. A real Android phone over USB
1. On the phone: **Settings › About phone** (Samsung: **Settings › About phone › Software
   information**) → tap **Build number** seven times until "You are now a developer!".
2. **Settings › Developer options** → turn on **USB debugging**.
3. Connect the phone with a data cable and accept the "Allow USB debugging?" prompt on the phone.
4. Run `adb devices`; the phone must be listed as `device`. If it is missing or `unauthorized`,
   install the phone maker's USB driver for Windows (Android's "Install OEM USB drivers" page)
   and accept the prompt again.

### 4. Accounts and two-factor sign-in
Turn on two-factor sign-in for every account below as soon as it exists (ADR-0002 step 1,
ADR-0004 rule 8, D-16):
- **GitHub** — the repository and GitHub Actions. On GitHub Free, private repositories get 2,000
  Actions minutes a month; public repositories are free.
- **Supabase** — create an organization, then the project in step 5.
- **Expo** — needed for EAS Build, including the iOS simulator build, which needs no Apple
  account, and for push credentials.
- **Firebase** (Google account) — a project used only for FCM push credentials. The steps follow
  Expo's push notification setup guide and are written here once done; they were not part of
  the docs check on 2026-10-27. The FCM service-account key is a secret: upload it to Expo's
  credentials, keep it in the password manager, never in the repository.

### 5. Supabase development project
A Free project pauses after 1 week without activity ("Supabase project paused" below), so create
it when the Skeleton's database step starts.
1. Create a project named `fitsphere-dev` in **South Asia (Mumbai)** on the Free plan. Let the
   dashboard generate the database password and save it straight into the password manager.
2. **Data API:** turn off **Enable Data API** (ADR-0002). The checks that Supabase's REST
   endpoints return nothing and that Auth still works are device checks in the Skeleton
   (Supabase's docs do not say whether Auth works with it off).
3. **Authentication settings for the Email provider** (menu names may differ; record the actual
   path here):
   - **Confirm email** on (the default on hosted projects): an unverified account cannot sign
     in (Q-080 MVP default).
   - **Email OTP Expiration:** keep the default of 3,600 seconds (1 hour). It also covers reset
     links. Q-080 asks for 24 hours or less.
   - **Minimum password length: 8**, with no character-type rules (D-18 answer 14). Supabase's
     docs do not state its default and say anything under 8 is not recommended. Leaked-password
     protection needs the Pro plan, so it is not available.
4. **Confirm phone:** turn it on too, even though phone sign-in stays off. Supabase's sign-up
   reference says it returns an obfuscated user for an already-registered email only when both
   Confirm email and Confirm phone are on; otherwise it answers "User already registered", which
   reveals the address (T-01, REQ-ACC-010). The Skeleton checks this (ADR-0004 step 2).
5. **JWT signing keys:** check that the current key is an asymmetric key (ES256 recommended). The
   API verifies tokens with the keys published at
   `https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json`, which lists no keys while
   the project uses the legacy shared secret. If it does, create an ES256 key and rotate to it.
   Supabase's docs disagree on which kind new projects get, so check rather than assume.
6. **Redirect URLs:** add `fitsphere://**` so links in sign-in emails can open the app
   (`fitsphere` is the app's link scheme, set in the Skeleton).
7. **API keys:** use the new **publishable** key (`sb_publishable_…`) in the app. The **secret**
   key (`sb_secret_…`) is for servers only and is not needed in the Skeleton. Supabase is
   retiring the legacy `anon` and `service_role` keys by the end of 2026, so neither is used.
8. **Connection strings** (Connect button), saved in the password manager:
   - **Session pooler** (port 5432): what the API uses on the PC. The shared pooler works over
     IPv4.
   - **Direct connection**: for migrations. It needs IPv6 unless the paid IPv4 add-on is bought;
     if the PC's network has no IPv6, use the session pooler for migrations as well.
   - The **transaction pooler** (port 6543) is for Cloud Run later (Q-087). It does not support
     prepared statements.

Sign-in emails in the Skeleton come from Supabase's built-in sender, which delivers only to
members of the project's team, at most 2 emails an hour (`email_address_not_authorized` for
anyone else). Manual sign-up checks therefore use the owner's own team address and are paced
accordingly. Resend replaces it in the invitations slice (ADR-0004 rule 1).

### 6. Secrets on the PC
- Secret values live in two places only: the **password manager** (the record) and **`.env`
  files** on the PC that the code reads.
- `.env` files are never committed: `.gitignore` excludes `.env` and `.env.*` and allows only
  `.env.example`. Each package has a committed `.env.example` with the names below and no
  values.
- Expo builds every `EXPO_PUBLIC_` variable into the app in plain text, so only values that are
  safe to publish go there: the Supabase project URL and publishable key, and the API address.
  The database password and any secret key never go into the app.
- Since Expo SDK 58, Expo commands read `.env` but not variants such as `.env.test`; keep the
  app's values in `apps/mobile/.env`.
- Never paste secret values into chat, issues, commits, screenshots or logs. Claude Code is
  denied reading or writing `.env` files by the committed `.claude/settings.json`. This covers
  its file tools (Read, Grep, Glob, Edit, Write), not its shell commands, because Claude Code's
  sandbox is off.
- If a secret leaks: change it in the provider's dashboard first, then update the password
  manager and the `.env` file.

### 7. Install the code and run the checks
Verified on the owner's PC on 2026-10-28 (Node 24.21.0, npm 11.19.0). Run from the repository
root:

| Command | What it does |
|---|---|
| `npm install` | Installs every workspace (`apps/*`, `packages/*`) from `package-lock.json`. CI uses `npm ci` |
| `npm run lint` | ESLint over the whole repository |
| `npm run typecheck` | TypeScript checks in each workspace; no files are written |
| `npm test` | Unit tests in each workspace (Vitest) |
| `npm run test:integration` | Database tests; they need `TEST_DATABASE_URL`. None exist yet (Skeleton step 4) |
| `npm run dev -w @fitsphere/api` | Runs the API at `http://127.0.0.1:3000` and restarts it on changes; reads `apps/api/.env` if it exists |

The API runs its TypeScript files directly on Node 24, with no build step. It listens only on
the PC's own loopback address: the Android emulator reaches it at `10.0.2.2`, and nothing else
on the local network can. Check: `http://127.0.0.1:3000/v1/health` in a browser shows
`{"status":"ok"}`. Use `127.0.0.1` rather than `localhost`: on this PC `localhost` resolves to the
IPv6 address `::1` first, which the API does not listen on, so some tools wait before falling
back. Stop the API with Ctrl+C in its terminal.

### 8. Running the app against the API on the PC
*Not yet written; added in Skeleton step 2.* Points to verify then:
- From the emulator, the PC is `http://10.0.2.2:<port>`; from a phone over USB, run
  `adb reverse tcp:<port> tcp:<port>` and use `http://localhost:<port>`.
- Android blocks plain HTTP by default, and Expo's `usesCleartextTraffic` setting defaults to
  off. No official page says development builds allow it, so check on a device and, if needed,
  allow it in development builds only — never in a release build.
- SQLite encryption (SQLCipher) needs a development build, not Expo Go, and fails silently when
  missing; the app checks at start that it is active (data model, "On the phone").

### References (local setup)
Checked 2026-10-27:
- Node.js release schedule: https://github.com/nodejs/Release (schedule.json) and https://nodejs.org/en/about/previous-releases
- Expo SDK versions: https://docs.expo.dev/versions/latest/
- Expo environment setup (Android, Windows, development build, local): https://docs.expo.dev/get-started/set-up-your-environment/
- Expo environment variables: https://docs.expo.dev/guides/environment-variables/
- Expo SQLite (SQLCipher): https://docs.expo.dev/versions/latest/sdk/sqlite/
- EAS simulator builds: https://docs.expo.dev/build-reference/simulators/
- Android developer options: https://developer.android.com/studio/debug/dev-options
- Android OEM USB drivers: https://developer.android.com/studio/run/oem-usb
- Supabase built-in email limits: https://supabase.com/docs/guides/auth/auth-smtp
- Supabase signing keys and JWKS: https://supabase.com/docs/guides/auth/signing-keys and https://supabase.com/docs/guides/auth/jwts
- Supabase API keys: https://supabase.com/docs/guides/api/api-keys
- Supabase email link expiry: https://supabase.com/docs/guides/auth/auth-email-passwordless
- Supabase password security: https://supabase.com/docs/guides/auth/password-security
- Supabase sign-up response for existing emails: https://supabase.com/docs/reference/javascript/auth-signup
- Supabase connection strings: https://supabase.com/docs/guides/database/connecting-to-postgres
- Supabase redirect URLs for apps: https://supabase.com/docs/guides/auth/native-mobile-deep-linking
- GitHub Actions billing: https://docs.github.com/en/billing/concepts/product-billing/github-actions

## Configuration names
Names only. Values live in the password manager and in `.env` files that are never committed.

| Name | Used by | What it holds | Secret? |
|---|---|---|---|
| `DATABASE_URL` | API | PostgreSQL connection string: the session pooler on the PC; the transaction pooler on Cloud Run later | **Yes** (contains the database password) |
| `MIGRATION_DATABASE_URL` | API migrations | Direct connection, or the session pooler without IPv6 | **Yes** |
| `SUPABASE_URL` | API | `https://<project-ref>.supabase.co`. The API derives the token issuer and the signing-key address from it | No |
| `SUPABASE_PUBLISHABLE_KEY` | API | Sent to Supabase Auth when the API reads the signed-in user at account setup | No (safe to publish) |
| `PORT` | API | Port the API listens on, on the PC | No |
| `LOG_LEVEL` | API | `info` by default | No |
| `EXPO_PUBLIC_SUPABASE_URL` | App | Same value as `SUPABASE_URL` | No (built into the app) |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | App | The publishable key | No (built into the app) |
| `EXPO_PUBLIC_API_URL` | App | Address of the API, e.g. the PC during development | No (built into the app) |
| `TEST_DATABASE_URL` | Tests | Local or CI PostgreSQL for integration tests; synthetic data only | No — a local test database, never the Supabase project |

Files with credentials, never committed:
- the FCM service-account key (JSON) — a secret, kept in the password manager and uploaded to
  Expo's credentials;
- the app's Firebase configuration file (`google-services.json`) — kept out of the repository
  until the Skeleton decides how builds receive it.

GitHub Actions needs no secrets in the Skeleton: its tests use a PostgreSQL service container and
test signing keys made during the run.

## Deployment and rollback
*Not yet written.*

## Monitoring
*Not yet written.* The owner-review triggers for moving to Supabase Pro or adding backups
(D-16, R-005) are:
- database over 400 MB (Free plan limit: 500 MB);
- files over 800 MB (Free plan limit: 1 GB);
- monthly active users near 50,000;
- monthly viewing traffic (egress) over 4 GB. The Free plan has 5 GB of egress and a separate
  5 GB of cached egress (Supabase pricing page, checked 2026-10-27); watch both;
- any pause;
- any data-loss incident.

Where to read each figure will be written once the project exists.

## Backup and recovery
Phase 1 has **no backups** (D-16, accepted risk R-005): data lost on the server cannot be
restored. Recovery procedures: *Not yet written.*

## Common failures

### Supabase project paused
Supabase pauses Free-plan projects after 1 week of inactivity (Supabase pricing page). While
the project is paused, the app cannot sync; users' entries stay on their phones until they sync
(REQ-NFR-004).

Steps (project owner):
1. Sign in to the Supabase dashboard with two-factor sign-in (D-16).
2. Open the paused project and choose **Resume project** (Supabase docs, "Free project
   pausing").
3. Once it is running, confirm that the app syncs.
4. Record the pause. Any pause is an R-005 trigger: review moving to Supabase Pro or adding
   backups (D-16, C-008).

Do not browse user data in the dashboard while doing this (D-16, REQ-NFR-005).

Time limit: Supabase's current docs say a paused project can be restored for up to 1 year
after it was paused; a 2024 Supabase changelog said 90 days. Resume promptly and treat the
shorter limit as the safe one. After the limit, the dashboard offers a download of the
project's backup file and Storage objects instead of a restore (Supabase docs, checked
2026-10-27).

References: https://supabase.com/docs/guides/platform/free-project-pausing and
https://supabase.com/pricing

## Incident escalation
*Not yet written.* In phase 1 the project owner is the only operator (D-13).

## Owners
Every procedure: Project owner (D-01).
