# Plan: First sign-in onboarding (welcome, about you, starting weight, Health Connect, all set)

- Status: **Accepted** (the owner, 2026-11-24: "Plan approved, start building"; the three open points were left at their defaults). Steps 1 to 3 are **built** on branch `feat/onboarding` (documents, migration `0037_onboarding.sql`, API and the five screens with tests); step 4, the owner's phone check, is open. Design **locked by the owner on 2026-11-24**.
- Bug it fixes: a new user who creates an account lands straight on Home. There is no onboarding; after the email link and sign-in the only extra screen is "Set up your account" (the 18+ box, `AccountSetupScreen`, only for accounts without it). `docs/plans/ui-redesign.md` records "the app has no onboarding beyond Account setup", so adding one needs the owner's decision (D-124 below).
- Requirements: a new REQ-ACC-013 (First sign-in onboarding), added in step 1; touches REQ-ACC-001 to 003 (units), REQ-ACC-011 (profile name), REQ-ACC-012 (Health Connect), the weigh-in requirement (starting weight), REQ-PLAN targets (starting numbers).
- Decision: D-124 (to record on approval). No ADR is changed. Legal (Q-049): the starting numbers and the new steps add no new kind of data.
- Invariants touched: #4 (every step is skippable; logging by hand never depends on it), #5 (the starting weight is dated today in Asia/Kolkata), #6 (weight stored in grams, units are display only), #7 (no values in logs, synthetic test data). #3 not touched (no AI).
- Design: canvas https://claude.ai/artifact/KqxThVuViLEZyoYU9oGL4s, second row: F1 and F2 Welcome (dark, light), G About you, H Starting weight, I Health Connect (Android only), J All set. The first row (A, B, D, E, the old targets screens) is **dropped** by the owner and is not built.
- Branch: its own, off `main`, in its own folder.

## What the user sees (matches the canvas)
Order after sign-up: Sign up → Check email → email link (Verified) → Sign in → **Welcome → About you (1 of 3) → Starting weight (2 of 3) → Health Connect (3 of 3, Android only) → All set → Home.**
1. **Welcome (F):** "Welcome. Let's set you up." Three lines (log food, log workouts, see progress), **Get started**, "Takes about a minute". No skip here: Get started is the way in. Follows the phone's light or dark (the redesign's rule), so F1 and F2 are one screen.
2. **About you (G):** optional name; Body weight kg or lb; Weights you lift kg or lb; a fixed "India · IST" row. **Next**, **Skip** (top). Saves the name (profile) and the two units (settings) when Next is pressed. Skip saves nothing.
3. **Starting weight (H):** a −0.1 / +0.1 stepper around the number (it opens the keypad on tap), "Weighed on Today" with **Change**, **Save and next**, **Skip** (top). Between 20 and 300 kg (the existing weigh-in range, shown in the user's unit); saves a normal weigh-in dated today (or the chosen day, not in the future). Back goes to About you.
4. **Health Connect (I):** shown only on Android with Health Connect available; elsewhere the flow goes from Starting weight to All set and the counter reads "of 2". **Connect Health Connect** uses the existing connect flow and its permission screen; **Maybe later** and **Skip** go on without connecting. Points to Profile › Connections and its guide.
5. **All set (J):** a summary of what was chosen (units, starting weight, daily targets, Health Connect); a step skipped reads "Not set". **Go to Home** ends onboarding. Nothing else on this screen can be skipped past.
6. **Back and Skip:** Back returns one step with the values kept; Skip moves on without saving that step. The progress bar has one segment a step.

## The rules
- **Who sees it:** only an account that has not finished it. Every account that exists when this ships is marked finished (a migration backfill), so existing users never see it. A new sign-up sees it **once**, ending at Go to Home.
- **Where it starts:** straight after the account check, in place of Home, on the phone that signs up or signs in. Not before the email is verified and the user has signed in (that part is unchanged).
- **Quitting half way:** each step saves when it is completed, so values are never lost. The next time the app opens signed in, and the account is not finished, onboarding comes back **at the step left** (kept on the phone); on another phone it starts at Welcome with the saved values already filled in.
- **Starting numbers for targets:** the design has no targets screen, so Go to Home saves common starting targets, **only for a kind the user has not already set**: 2,000 kcal, 120 g protein, 250 g carbs, 65 g fat, 30 g fibre, 8,000 steps and 4 workouts a week (the numbers in the old forms; every one inside the approved ranges, D-100). No target body weight is set. They start today and are changed in Your targets (target history, D-77, keeps the dates). The text under All set says they are common numbers, not advice made for the user (copy for the owner to confirm, point 2 below).
- **Offline:** the account check already needs the internet. Steps save on the phone and sync like any entry; **Go to Home** needs no internet (the finished flag is queued and sent when the connection is back; until sent, the phone keeps its own copy so Home opens).
- **Never blocks:** a failed save shows the usual message on that step and a way to skip it; the user can always reach Home (invariant #4).

## Data
- **The finished flag lives on the server**, so a new phone or a reinstall does not show onboarding again to someone who finished it. Proposed: `app.users.onboarded_at timestamptz null`, **a migration (next free number at build time) that adds it and sets it to now for every existing row**, plus the reason in its comment. `GET /v1/me` returns it (`onboardedAt`, null until finished); a small route (or a sync change) sets it once when Go to Home is pressed, and refuses to clear it. The Coach team's shared tables are not touched (D-90: `app.users` gains a column, so the change is written here with its decision, tests and docs, as that decision says).
- **Shared contract:** `MeResponse` gains `onboardedAt`; the new route's request and response schemas.
- **Phone:** `sync_meta` keys `onboarding_step` (the step to resume at) and `onboarded` (a copy of the flag, so app start can decide without waiting for the internet). No phone schema version change (`sync_meta` takes new keys).
- **Nothing new for the values:** name goes through `profile.set`, units through `setting`, weight through `weighIn`, targets through `target.set`, Health Connect through the existing connect. All exist and already sync.
- **Delete account** already removes the user's rows by `on delete cascade`; the column goes with the user.

## Phone modules
- `src/screens/onboarding/`: `WelcomeScreen`, `AboutYouStep`, `StartingWeightStep`, `HealthConnectStep`, `AllSetScreen` and a small `OnboardingFlow` (the step, Back and Skip, the saves); route `src/app/onboarding.tsx` (no header, like Sign in). Reuses `FormScreen`, `TextButton`, `DisplayHeading`, `Wordmark`, the weight parsing in `src/format.ts` and `HealthSyncProvider`'s `connect`.
- `src/onboarding.ts`: the pure rules (which steps apply, the starting target values and "only if unset", the resume step), so they are tested without screens.
- `src/screens/navigation.ts`: `goAfterAccountCheck` sends `ready` with no `onboardedAt` to `/onboarding`, else `/home`. `src/app/index.tsx` (app start with a session) does the same from the phone's `onboarded` copy. Home does not open for an unfinished account.
- `src/app/_layout.tsx`: the `onboarding` screen in `NO_HEADER`.

## Build and risk
- **JavaScript only: no native change, no new build** (D-19 stays untouched). The migration and the updated API must be on `fitsphere-dev` (and so the Cloud Run beta) **before** a phone with this change signs in: an API that does not return `onboardedAt` would make the app treat everyone as finished, which is the safe side. **Run only when the owner says so.**
- Risk: a user stuck in onboarding because the flag cannot be sent. Mitigated by the phone's own copy and the queue. Risk: an existing user shown it by mistake. Mitigated by the backfill and a migration test on a database with old rows.

## Tests (synthetic data only)
- Pure rules (`onboarding.ts`): the steps with and without Health Connect; the counter ("of 3", "of 2"); starting targets only for kinds not set; every value inside TARGET_RANGES; the resume step.
- API: `GET /v1/me` returns `onboardedAt` null for a new account and a time after finishing; setting it twice keeps the first time; it cannot be cleared; self only (no other user's flag); migration on a database with old users marks them all finished.
- Shared contract: the schemas accept and refuse as above.
- Phone, end to end on fakes: a new account goes Welcome → ... → All set → Home and never sees it again; an existing account (flag set) goes straight to Home; Skip on every step reaches Home with nothing saved; Next saves the name and the two units; Starting weight saves a weigh-in today in grams in the chosen unit, refuses outside 20 to 300 kg, Change picks another day, never a future one; quitting at step 2 and reopening resumes at step 2 with Welcome's choices kept; another phone starts at Welcome with saved values filled in; Health Connect step hidden on a phone without it, Connect works and a refused permission continues; Go to Home with no internet still opens Home and sends the flag later; targets already set by the user are not replaced; a failed save shows the message and Skip still works; screens in light and dark and with a large font; screen reader labels (the progress, the steppers, the units).
- Not testable here: Android's own permission screen; the owner checks on the phone.

## Open points for the owner (defaults used if no answer, D-18)
1. **Existing users never see it** (backfill): proposed default. Say if accounts with no targets set should see it once.
2. **The starting targets and their text:** the numbers above, saved as the user's targets at Go to Home, with the line "common numbers, not advice made for you" added to All set. The design shows "Starting numbers" there; the extra line is not on the locked canvas. Say if you would rather save nothing and let Your targets stay empty.
3. **Welcome has no Skip** (Get started only); the other steps do.

## Steps (one pull request each, once approved)
1. **Documents:** D-124, REQ-ACC-013, the backlog row, `ui-redesign.md` note, the canvas link.
2. **Migration, shared contract, API** (`onboarded_at`, `/v1/me`, the set route) with tests.
3. **Phone: the rules, the five screens and the flow, the guard in `navigation.ts` and `index.tsx`,** with tests on fakes.
4. **The owner's phone check** (a new account on `fitsphere-dev`, Android first), then fixes.
