# Runbook

- Status: Draft
- Owner: Project owner (D-01)
- Last updated: 2026-10-29 (Meal logging slice: `OFF_CONTACT`; meal photo storage)

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
| EAS CLI | 26.0.0 or later, installed globally | Android development builds on EAS (D-19) |
| `cloudflared` | Latest release, from Cloudflare's GitHub releases (`cloudflared-windows-amd64.msi`). It does not update itself on Windows | The development tunnel to the API (D-19 answer 6, step 8). No Cloudflare account |
| Android platform-tools (`adb`) only | Any recent version | The "USB + adb" checks (D-19). No Android Studio, JDK, Android SDK or emulator |
| An Android phone | The owner's OnePlus Nord CE4, with a USB cable that carries data | Every device check (D-19). The lowest-end phone available for ADR-0001 step 6 |
| Supabase account | Free plan, project in South Asia (Mumbai) | Database and sign-in (ADR-0002, ADR-0004) |
| Expo account | Free plan: 15 Android builds a month | Android development builds and the development server's tunnel (D-19). Post-MVP (D-20): the EAS iOS compile check (ADR-0001 step 5) and push credentials (ADR-0001 step 7) |
| Firebase project | Free | **Post-MVP (D-20, backlog B-23)**, not needed for the Skeleton: FCM credentials for push on Android (ADR-0001 step 7, D-13 answer 9, ADR-0004 rule 6) |
| PostgreSQL 17 on the PC | Installed natively for Windows, not in Docker (owner's choice, D-18 answer 14) | Integration, authorization and database tests; Supabase's current default is PostgreSQL 17 |
| A password manager | Any | Where secret values are kept (see "Secrets on the PC") |

Not needed for the Skeleton: Resend and a domain (the Release slice, D-20), or a Google Cloud billing
account (Q-087).

### Owner's PC, checked 2026-10-28
Read-only checks from VS Code; nothing was installed or changed.
- Node 24.21.0 and npm 11.19.0: usable (24 LTS).
- `origin` is the GitHub repository; `main` tracks `origin/main`.
- A JDK, the Android SDK and an emulator are installed, but are no longer needed (D-19). The
  `platform-tools` entry in the user `Path` is set; VS Code terminals see it only after VS Code
  is restarted.
- No PostgreSQL yet; the owner chose a native install of PostgreSQL 17 (D-18 answer 14). Docker
  Desktop is installed but is not used for the test database.
- IPv6 works, but nothing needs it: every script connects through the session pooler
  (`DATABASE_URL`, owner's decision, 2026-10-28).
- Not stated by the owner: a real Android phone, a password manager, a Firebase project.

### 1. Node.js and Git
1. In PowerShell, run `node --version` and `git --version`.
2. If Node is not 26.x or 24.x, install Node 26 LTS from nodejs.org, then open a new terminal and
   check again. If nodejs.org does not yet label 26 as LTS, use 24 LTS and update this line.

### 2. EAS CLI and the development build (D-19)
Android builds run on EAS, in the cloud: no Android Studio, JDK, Android SDK or emulator is
needed. The Expo account comes first (step 4). *Not yet verified on the owner's PC.*
1. Install EAS CLI: `npm install --global eas-cli`, then `eas --version` (26.0.0 was current on
   2026-10-28; `apps/mobile/eas.json` requires at least that). Without the global install,
   `npx eas-cli@26` in place of `eas` works the same; the first build was started that way.
2. Sign in: `eas login`, then `eas whoami`. The development server's tunnel needs the same
   sign-in: from `apps/mobile`, `npx expo whoami` must show the same account; if it does not, run
   `npx expo login`.
3. Once, **from `apps/mobile`**: `eas init`. It creates the EAS project and writes its ID and
   account into `apps/mobile/app.json` (`extra.eas.projectId`, `owner`). Commit that change;
   neither is a secret. Run from the repository root, it creates a second `app.json` there
   instead (seen 2026-10-28).
4. Build only when native code changes (Skeleton plan, decision 8); Claude Code asks first. From
   `apps/mobile`: `eas build --platform android --profile development`. The free plan allows 15
   Android builds a month, in a low-priority queue, so a build may wait. At the end, the command
   prints a link and a QR code.
5. Install: open the link, or scan the QR code, on the phone; download the app; when Android
   asks, allow the browser to install apps. Reinstalling the same build later from the same link
   does not use a build.
6. Optional check of what EAS uploads: `eas build:inspect --platform android --stage archive
   --output <an empty folder outside the repository>`. `apps/mobile/.env` must not be in it:
   EAS CLI leaves out what `.gitignore` excludes.

### 3. The phone over USB (only for "USB + adb" checks)
Android's platform-tools (`adb`) is the only Android tool kept (D-19). If it ever needs
reinstalling, use Android's standalone "SDK Platform Tools" download and add its folder to the
user `Path`.
1. On the phone: **Settings › About phone** (Samsung: **Settings › About phone › Software
   information**) → tap **Build number** seven times until "You are now a developer!".
2. **Settings › Developer options** → turn on **USB debugging**.
3. Connect the phone with a data cable and accept the "Allow USB debugging?" prompt on the phone.
4. Run `adb devices`; the phone must be listed as `device`. If it is missing or `unauthorized`,
   install the phone maker's USB driver for Windows (Android's "Install OEM USB drivers" page)
   and accept the prompt again.

**Copy the phone's database off the phone (Skeleton step 8, ADR-0007 step 6).** Development
builds are debuggable, which `run-as` needs. The file holds synthetic test data only. In
PowerShell, from any folder outside the repository:
1. `cmd /c "adb exec-out run-as com.fitsphere.app cat files/SQLite/fitsphere.db > fitsphere-copy.db"`
   (through `cmd`, because PowerShell 5.1 changes binary output when it redirects it).
2. `[Text.Encoding]::ASCII.GetString((Get-Content .itsphere-copy.db -Encoding Byte -TotalCount 15))`
   An unencrypted SQLite file starts with `SQLite format 3`; an encrypted one shows random
   characters. A SQLite viewer, if one is installed, reports that the file is not a database.
3. Delete the copy: `Remove-Item .itsphere-copy.db`.

### 4. Accounts and two-factor sign-in
Turn on two-factor sign-in for every account below as soon as it exists (ADR-0002 step 1,
ADR-0004 rule 8, D-16):
- **GitHub** — the repository and GitHub Actions. On GitHub Free, private repositories get 2,000
  Actions minutes a month; public repositories are free.
- **Supabase** — create an organization, then the project in step 5.
- **Expo** — needed for EAS Build (the Android development builds, D-19) and for the development
  server's tunnel. Post-MVP (D-20): the iOS simulator build, which needs no Apple account, and
  push credentials.
- **Firebase** (Google account) — post-MVP (D-20, backlog B-23); not needed for the Skeleton. A
  project used only for FCM push credentials. The steps follow
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
   - **Session pooler** (port 5432): `DATABASE_URL`, used on the PC by the API, the migrations
     and `db:growth`. The shared pooler works over IPv4.
   - **Direct connection**: not used. The owner decided on 2026-10-28 that the migrations use
     the session pooler too, so there is one database connection string.
   - The **transaction pooler** (port 6543) is for Cloud Run later (Q-087). It does not support
     prepared statements.
9. **Meal photo storage** (Meal logging slice; ADR-0002 rules 3 and 4). Menu names may differ;
   record the actual path here.
   - **Storage → New bucket:** name it (for example `meal-photos`) and put the name in
     `STORAGE_BUCKET`. **Public bucket off.** Restrict the file size to **1 MB** and the allowed
     types to **`image/jpeg`**.
   - **Storage → Settings → S3 Connection:** turn the S3 connection on (Supabase's docs say
     presigned links need it). Copy the **endpoint** into `STORAGE_S3_ENDPOINT` and the
     **region** into `STORAGE_S3_REGION`.
   - **New access key:** save the access key ID and the secret into the password manager, then
     into `STORAGE_S3_ACCESS_KEY_ID` and `STORAGE_S3_SECRET_ACCESS_KEY`. Supabase's docs say these
     keys "provide full access to all S3 operations across all buckets and bypass RLS policies":
     server only, never in the app.
   - Copy the five names exactly from `apps/api/.env.example`: the four connection names contain
     `_S3_`, `STORAGE_BUCKET` does not. With any of them missing, the API answers 503 for photo
     links, and `check:storage` stops and lists the six names it needs (the five and
     `SUPABASE_URL`).
   - Run `npm run check:storage -w @fitsphere/api`; every line should say PASS.

   **Done on `fitsphere-dev` (Mumbai), 2026-10-29 (owner).** Storage is configured and checked
   from the PC; the checks with a real photo on the phone are still pending (below). The menu
   paths are not recorded yet.
   - **Bucket:** `meal-photos`, private (Public bucket off), file size limit 1 MB, allowed type
     `image/jpeg`. Its name is in `STORAGE_BUCKET`.
   - **S3 connection:** on; its endpoint and region are in `STORAGE_S3_ENDPOINT` and
     `STORAGE_S3_REGION`.
   - **Credentials:** an S3 access key, used by the API only; its ID and secret are in
     `STORAGE_S3_ACCESS_KEY_ID` and `STORAGE_S3_SECRET_ACCESS_KEY` in `apps/api/.env` on the PC,
     never in the app or the repository.
   - **`npm run check:storage -w @fitsphere/api`, on the PC with the Data API off: 8 of 8 PASS,
     exit code 0.** It wrote one small synthetic file under `checks/` and removed it:
     - upload with an upload link: HTTP 200;
     - viewing links last at most 5 minutes: `X-Amz-Expires=300`;
     - read back with a viewing link: HTTP 200, same bytes;
     - no reading without a link (private bucket): HTTP 400;
     - only JPEG accepted (bucket rule): HTTP 415;
     - files over 1 MB refused (bucket rule): HTTP 413;
     - an expired viewing link (signed for 1 second, used after 3) stops working: HTTP 400;
     - removed, the file is gone: HTTP 404.
   - **Not checked against Supabase:** the upload links' 10 minutes (600 seconds, D-27). The API
     sets it, and its unit tests check it (`apps/api/src/storage/mediaStorage.test.ts`).
   - **Pending, on the phone** (new development build; meal-logging slice plan, phone check 5): a
     real photo's ~200 KB copy and thumbnail in the bucket, no location data in the photo, the
     photo shown in the app, and its files gone after a removal syncs.

   Also recorded in ADR-0002, "Validation results".

**Done on `fitsphere-dev`, 2026-10-28 (owner)**, with the dashboard's menu paths:
- Items 3 and 4: **Authentication → Sign In / Providers → Email**. Confirm email is on, the
  link expiry is left at 1 hour and the minimum password length is 8. Phone sign-in is off and
  Confirm phone is not turned on; `npm run check:signup` (ADR-0004 step 2) shows whether item 4
  is still needed.
- Item 5: **Project Settings → JWT Keys**. The current key is ECC (P-256). The legacy shared
  secret (HS256) is under "Previously used keys", not revoked.
- Item 6: **Authentication → URL Configuration**. `fitsphere://**` is added; the Site URL is
  unchanged.
- Item 2: Enable Data API is off and `check:data-api` passed; the menu path is not recorded yet.
- Migration `0001_skeleton.sql` is applied, and `db:growth` has been run (ADR-0003).

Sign-in emails in the Skeleton come from Supabase's built-in sender, which delivers only to
members of the project's team, at most 2 emails an hour (`email_address_not_authorized` for
anyone else). Manual sign-up checks therefore use the owner's own team address and are paced
accordingly. Resend replaces it in the Release slice, before the MVP release (D-20; ADR-0004
rule 1).

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
| `npm run test:integration` | Integration, authorization and database tests. They drop and recreate schema `app` in `TEST_DATABASE_URL` (from the environment, or else from `apps/api/.env`), and refuse a Supabase address |
| `npm run dev -w @fitsphere/api` | Runs the API at `http://127.0.0.1:3000` and restarts it on changes; reads `apps/api/.env` if it exists |
| `npm run migrate -w @fitsphere/api` | Applies new migration files from `apps/api/migrations/` to `DATABASE_URL`, each in one transaction; refuses a file that was edited after it was applied |
| `npm run db:growth -w @fitsphere/api` | Writes 10,000 synthetic weigh-ins to `DATABASE_URL` inside one transaction, prints the PostgreSQL version and the growth, then rolls everything back (R-005) |
| `npm run check:data-api -w @fitsphere/api` | Calls Supabase's auto-generated REST endpoint with the publishable key and prints PASS when it returns no data (ADR-0002 step 2) |
| `npm run check:storage -w @fitsphere/api` | Through the S3 connection, with the Data API off: uploads one small synthetic file with an upload link, reads it back with a viewing link (5 minutes), checks that it cannot be read without a link, that a non-JPEG and a file over 1 MB are refused, that an expired link stops working, and that removing it works. Prints status codes only (ADR-0002 steps 2 and 5) |
| `npm run foods:import -w @fitsphere/api` | Loads `data/foods/ifct2017-foods.csv` into `app.foods` on `DATABASE_URL` (after `migrate`). Checks the whole file first; imports nothing if a row is wrong; running it again gives the same table (`docs/data/food-list-sources.md`) |
| `npm run check:signup -w @fitsphere/api -- <address>` | Calls Supabase Auth's sign-up directly with the publishable key for an address that already has an account, and prints PASS when the answer does not say it is registered (ADR-0004 step 2). It may send one email |

`TEST_DATABASE_URL` must be a URL, `postgres://postgres:<password>@localhost:5432/fitsphere_test`.
If the password holds `/`, `#`, `?`, `@`, `%` or a space, write those characters percent-encoded
(for example `/` as `%2F`), or give the local `postgres` user a password without them. Create the
database once with `createdb -U postgres fitsphere_test` (PostgreSQL's `bin` folder).

The API runs its TypeScript files directly on Node 24, with no build step. From Skeleton step 5 it
needs `DATABASE_URL`, `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in `apps/api/.env`; without
them it stops at start and names the missing ones. Every route except `/v1/health` needs a
Supabase access token. It listens only on
the PC's own loopback address, so nothing else on the network can reach it; how the phone reaches
it is step 8. Check: `http://127.0.0.1:3000/v1/health` in a browser shows
`{"status":"ok"}`. Use `127.0.0.1` rather than `localhost`: on this PC `localhost` resolves to the
IPv6 address `::1` first, which the API does not listen on, so some tools wait before falling
back. Stop the API with Ctrl+C in its terminal.

### 8. Running the app on the phone (D-19)
*Not yet verified on the phone.*
1. Start the development server: `npm run start -w @fitsphere/mobile`, which runs
   `expo start --dev-client --tunnel`. Expo CLI 58 uses Expo's own tunnel service, which needs
   the sign-in from step 2. It prints a QR code.
2. On the phone, scan the QR code with the camera, or open FitSphere and type the address the
   terminal shows. The app loads its code through the tunnel; a saved change shows on the phone
   without a new build.
3. While the tunnel runs, the development server has a public address. It serves the app's
   code, which holds only publishable `EXPO_PUBLIC_` values. Stop it with Ctrl+C when done.
4. If the tunnel fails ("Couldn't create a signed tunnel URL" or "Tunnel connection has been
   closed"), check https://status.expo.dev/ and restart the server. The CLI's own suggestion is
   `npx expo start --tunnel ngrok`, which uses ngrok instead.
5. **The API from the phone: a development tunnel** (D-19 answer 6, Q-093). Use it only while
   testing, with test data only, and close it when done. Its address is never committed: it
   goes only in `apps/mobile/.env`, which git ignores, and CI fails if a Quick Tunnel address is
   committed. The tunnel is Cloudflare's Quick Tunnel: no account, and a new address each run.
   Verified on the owner's phone on 2026-10-28 (Skeleton step 2: "API: ok").

   **One command** (D-22 answer 5; *not yet run on the owner's PC*): from the repository root,
   `npm run dev:phone`. It needs `apps/api/.env` and `apps/mobile/.env` filled in (step 6),
   `cloudflared` on the `PATH`, and the Expo sign-in from step 2.
   - It starts the API on `127.0.0.1:3000`, then the tunnel, and waits until the tunnel is
     connected.
   - It writes the tunnel's address into `apps/mobile/.env` as `EXPO_PUBLIC_API_URL`, keeping
     every other line, and checks `/v1/health` through the tunnel.
   - Then it starts the development server in the same terminal, with its QR code.
   - The API's and the tunnel's output go to `.dev-phone/api.log` and `.dev-phone/tunnel.log`,
     which git ignores. The script never prints the address.
   - **Stop:** Ctrl+C once. It stops all three and empties `EXPO_PUBLIC_API_URL`. It does the same
     when any of the three stops by itself, saying which one and where its log is.
   - It refuses to start if an API already answers on port 3000, or if `apps/mobile/.env` is
     missing.
   - If the window is closed instead, the address can stay in `.env`. The next run replaces it;
     otherwise, empty it by hand as in "Stop" below.

   **By hand** (the fallback), in three terminals from the repository root:
   1. The API: `npm run dev -w @fitsphere/api`. It listens on `127.0.0.1:3000` only.
   2. The tunnel: `cloudflared tunnel --url http://127.0.0.1:3000`. It prints an address of the
      form `https://<random-words>.trycloudflare.com`.
   3. In `apps/mobile/.env`, set `EXPO_PUBLIC_API_URL` to that address, with no trailing slash.
      Then start the development server, or restart it if it was running:
      `npm run start -w @fitsphere/mobile`.
   4. Check from the PC: `<address>/v1/health` in a browser shows `{"status":"ok"}`.

   **Stop**, after every test session:
   1. Ctrl+C in the tunnel's terminal. The address stops working at once.
   2. Ctrl+C in the API's and the development server's terminals.
   3. Empty `EXPO_PUBLIC_API_URL` in `apps/mobile/.env`, so an old address is never reused or
      copied.

   - While the tunnel runs, anyone who has the address can reach the API. Until Skeleton step 5
     that is only `GET /v1/health`; from step 5 on, every other route needs a valid sign-in
     token. The Supabase development project holds test data only.
   - Do not paste the address into issues, pull requests or chats. The app's screen shows it,
     so leave it out of screenshots.
   - Quick Tunnels have no uptime guarantee, allow up to 200 requests in flight (more get
     `429`), and do not support Server-Sent Events (Cloudflare's docs). The Skeleton needs none
     of these. If a tunnel stops working, stop it and start a new one; it gets a new address,
     so update `.env` and restart the development server.
6. **"USB + adb" checks** (Skeleton plan, decision 8): connect the phone as in step 3, run
   `adb reverse tcp:8081 tcp:8081`, and from `apps/mobile` start the server with
   `npx expo start --dev-client --localhost`. The app then loads its code over USB, which keeps
   working in airplane mode. Then run `adb reverse --list`: it must show only `tcp:8081`. If
   `tcp:3000` is listed, run `adb reverse --remove tcp:3000`, so the API cannot be reached over
   USB while the phone is offline. Afterwards, `adb reverse --remove-all`.
7. **Plain HTTP:** a development build is Gradle's debug build. The debug manifest that Expo
   generates allows plain HTTP; release builds do not. The tunnel's address is HTTPS, so the
   route to the API does not rely on this.
8. SQLite encryption (SQLCipher) needs a development build, not Expo Go, and fails silently when
   missing; the app checks at start that it is active (data model, "On the phone").

### References (local setup)
Checked 2026-10-27:
- Node.js release schedule: https://github.com/nodejs/Release (schedule.json) and https://nodejs.org/en/about/previous-releases
- Expo SDK versions: https://docs.expo.dev/versions/latest/
- Expo environment setup (Android, Windows, development build, local): https://docs.expo.dev/get-started/set-up-your-environment/
- Expo environment variables: https://docs.expo.dev/guides/environment-variables/
- Expo SQLite (SQLCipher): https://docs.expo.dev/versions/latest/sdk/sqlite/
- EAS simulator builds: https://docs.expo.dev/build-reference/simulators/
- EAS build profiles (`developmentClient`, `distribution`): https://docs.expo.dev/eas/json/ (checked 2026-10-28)
- EAS app versions (`appVersionSource`): https://docs.expo.dev/build-reference/app-versions/ (checked 2026-10-28)
- What EAS CLI uploads (`.gitignore`, `.easignore`): https://docs.expo.dev/build-reference/easignore/ (checked 2026-10-28)
- Cloudflare Quick Tunnels (no account, limits): https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/ (checked 2026-10-28)
- `cloudflared` downloads (Windows: GitHub releases, no automatic updates): https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/ (checked 2026-10-28)
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
| `DATABASE_URL` | API, `migrate` and `db:growth` | PostgreSQL connection string: the session pooler on the PC; the transaction pooler on Cloud Run later. The migrations use the session pooler; there is no separate migration connection (owner's decision, 2026-10-28) | **Yes** (contains the database password) |
| `SUPABASE_URL` | API, `check:data-api`, `check:signup` and `check:storage` | `https://<project-ref>.supabase.co`. The API derives the token issuer and the signing-key address from it | No |
| `SUPABASE_PUBLISHABLE_KEY` | API | Sent to Supabase Auth when the API reads the signed-in user at account setup | No (safe to publish) |
| `PORT` | API | Port the API listens on, on the PC. `npm run dev:phone` sets it to 3000 for the API it starts | No |
| `LOG_LEVEL` | API | `info` by default | No |
| `STORAGE_S3_ENDPOINT`, `STORAGE_S3_REGION` | API, `check:storage` | Supabase Storage's S3 endpoint and region (step 5, item 9). Without all five storage names, photo links answer "not available" | No |
| `STORAGE_BUCKET` | API, `check:storage` | The private meal-photo bucket | No |
| `STORAGE_S3_ACCESS_KEY_ID` | API, `check:storage` | The S3 access key's ID | No, but kept in `.env` |
| `STORAGE_S3_SECRET_ACCESS_KEY` | API, `check:storage` | The S3 access key's secret: full access to every bucket, bypassing storage policies. Server only, never in the app | **Yes** |
| `OFF_CONTACT` | API | A contact email address for the owner, sent to Open Food Facts in the User-Agent (`FitSphere/1.0 (<address>)`), as Open Food Facts asks. Without it, barcode lookups answer "not available right now" and nothing is sent | No, but kept in `.env` and never committed |
| `EXPO_PUBLIC_SUPABASE_URL` | App | Same value as `SUPABASE_URL` | No (built into the app) |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | App | The publishable key | No (built into the app) |
| `EXPO_PUBLIC_API_URL` | App | Address of the API. During development, the tunnel's address while a tunnel runs, and empty otherwise (D-19 answer 6, step 8). `npm run dev:phone` writes and empties it. Never committed | No (built into the app's code served by the development server) |
| `TEST_DATABASE_URL` | Tests | Local or CI PostgreSQL for integration tests; synthetic data only | No — a local test database, never the Supabase project |

Files with credentials, never committed. Both are for push, which is post-MVP (D-20, backlog
B-23); neither is needed for the Skeleton:
- the FCM service-account key (JSON) — a secret, kept in the password manager and uploaded to
  Expo's credentials;
- the app's Firebase configuration file (`google-services.json`) — kept out of the repository;
  it reaches the EAS build as an EAS environment variable of the file type.

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
