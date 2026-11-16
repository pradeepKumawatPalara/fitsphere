# The iOS app (plan)

- Status: **Accepted** (the owner, in chat, 2026-11-16; see "The owner's answers"). Built on branch
  `feat/ios-app`, in `D:\fitsphere-ios`.
- Owner: Project owner (D-01)
- Last updated: 2026-11-16
- Decision: D-104: the iOS app, iPhone only, built and tested now and released with Android
- Builds on: D-02 (Android and iOS), D-10 answer 8 (iOS deferred until an iPhone is available),
  ADR-0001 validation step 5 (the iOS compile check), backlog B-01 (iOS release) and B-24 (iOS
  compile check), D-19 (EAS builds only, the owner told before every build), D-101 (the API on Cloud
  Run, the test build's EAS profile `preview`)
- Risk: R-001 (iOS-only bugs found late), closed only by testing on a real iPhone
- Requirements: none changed. The iOS app is the same app; every REQ holds as it is.
- No server change, no migration, no phone schema change.

## What the owner asked
2026-11-16: "We have built the android apk and that is under testing, while we test that and fix
the bugs. I want you to prepare the ios version of this app and perform coding standard testing at
your level and let me know the steps that we will be needing to get it live once we are done fixing
everything. Also list out the prerequisites needed for ios app hosting."

## The owner's answers
2026-11-16, to the four questions of the proposed plan: "1. Yes go ahead with the IOS 2 Iphone only
3 Yes I have Iphone for the testing 4 I will answer all the questions".
1. Go ahead now (D-104).
2. iPhone only: `ios.supportsTablet: false` (F4).
3. The owner has an iPhone for testing. Who joins Apple's program (the owner as an individual, or the
   company) is the owner's step and does not change the code.
4. The owner answers Apple's questions, the encryption one included (F10): until the owner gives the
   answer to keep in `app.json`, App Store Connect asks it at each upload (MVP default).

## Where we stand
- The app is one Expo codebase (ADR-0001). There is no separate iOS code to write: EAS Build
  compiles the same code for iOS in the cloud, so no Mac is needed.
- `app.json` already has an iOS section (`bundleIdentifier` `com.fitsphere.app`, the same name as
  the Android package) and the camera and photo permission texts.
- No iOS build has ever been made, so nothing has been tested on an iPhone (R-001).
- `eas.json` on `main` has only the `development` profile; `preview` (the test APK, D-101) is on the
  local branch `feat/eas-preview`, not pushed yet. The iOS profiles below go on top of it.

## Coding checks run (2026-11-16, on `main` at 4b488ae)
| Check | Result |
|---|---|
| `npm run lint` (ESLint, every workspace) | Passed, no errors or warnings |
| `npm run typecheck` (API, mobile, shared) | Passed, no errors |
| `npm test`: mobile (Jest) | 79 suites, 970 tests passed |
| `npm test`: API (Vitest) | 25 files, 243 tests passed |
| `npm test`: shared (Vitest) | 3 files, 102 tests passed |
| `npm run test:integration` | Not run: needs a database |
| `expo-doctor` | Not run: it downloads the latest package from the internet, which this session was not allowed to do. The owner can run `npx expo-doctor` in `apps/mobile` |
| iOS settings Expo would build with (`npx expo config --type introspect`) | Read; findings below |

The mobile tests run with React Native's test preset, whose default platform is iOS, so the app's
logic and screens are already tested as iOS reads them. They cannot test the keyboard, pop-ups,
camera or anything drawn by iOS itself; that needs an iPhone.

## What the iOS review found
| # | What | Effect on iPhone | Fix |
|---|---|---|---|
| F1 | `app.json` `"userInterfaceStyle": "light"` writes `UIUserInterfaceStyle = Light` | Appearance "System" is always light on iPhone; Light and Dark work (the Settings plan's risk) | `"automatic"`. Android unchanged: it reads this only with `expo-system-ui`, which the app does not have |
| F2 | The camera plugin adds a microphone text, "Allow FitSphere to access your microphone", though the app records no sound | Apple asks for every permission text to say why; a generic one for an unused permission can be rejected | `expo-camera` plugin `microphonePermission: false` |
| F3 | The secure-store plugin adds a Face ID text, "Allow FitSphere to access your Face ID biometric data", though the app does not use Face ID | As F2 | `expo-secure-store` plugin `faceIDPermission: false` |
| F4 | `ios.supportsTablet: true` | The app is offered on iPad, where it may turn sideways (iPad allows landscape); App Store Connect then asks for iPad screenshots too, and nothing was designed for iPad | `false` (the owner: "Iphone only"). iPads can still run it as an iPhone app |
| F5 | The floating Log meal button and the Workout in progress pill use `elevation`, Android's shadow | No shadow on iPhone: flat, less clearly above the page | Add iOS shadow values with the same look; Android unchanged |
| F6 | The sign-in screens lift the footer on `keyboardDidShow` (the only event on Android) | On iPhone the footer jumps up after the keyboard has finished opening | Listen to `keyboardWillShow`/`keyboardWillHide` on iOS |
| F7 | Number fields use `number-pad` and `decimal-pad` | The iPhone's number pad has no Done or Return key: the keyboard closes only by tapping outside the field | Check on the iPhone (IOS-06); if awkward, a "Done" bar over the number pad (iOS only) |
| F8 | Sheets and pages are React Native `Modal`s; Android's Back button closes them | iPhones have no Back button, and iOS shows one pop-up at a time: a sheet opened while another is closing may not appear | A quick code search finds a Cancel, Close or back control in every file with a sheet; each sheet, and the pop-up order, is checked on the iPhone (IOS-04) |
| F9 | The sign-in session and the database key live in the iPhone's Keychain | iOS usually keeps the Keychain after the app is deleted: reinstalled, the app may open already signed in, with an empty phone database | Check on the iPhone (IOS-12) that everything downloads again; if not, clear the Keychain on the first run after an install |
| F10 | No `ITSAppUsesNonExemptEncryption` | App Store Connect asks about encryption (export compliance) on every build: the app uses HTTPS and SQLCipher for the phone's database | The owner answers at each upload; once the owner gives the answer to keep, `ios.config.usesNonExemptEncryption` |
| F11 | No app-level privacy manifest (`ios.privacyManifests`) | React Native, `expo-constants` and `expo-file-system` ship their own; if Apple's upload check names a missing reason (email "ITMS-91053"), the upload is refused | Add the reasons that Apple's check names after the first upload |

Checked and fine for iOS: the icon (1024×1024, no transparency, as the App Store requires); the
`fitsphere://` links for email confirmation and password reset (iOS registers the scheme); every
address is HTTPS (Cloud Run, Supabase), as iOS requires; sign in by email only, so "Sign in with
Apple" is not required; account deletion in the app (D-31), which Apple requires; the photo
picker (iOS's own, needs no permission to choose a photo); no Android-only code (`BackHandler`,
`ToastAndroid`, `PermissionsAndroid`); fonts load by file, as iOS needs; Log meal's "leave without
saving?" uses `usePreventRemove`, which also catches the iPhone's swipe back (IOS-05).

React Native here needs **iOS 15.1 or later**; the first build confirms Expo's minimum.

## What this branch changes
1. `app.json`: F1 (`userInterfaceStyle` `automatic`), F2 (`expo-camera` `microphonePermission:
   false`), F3 (`expo-secure-store` `faceIDPermission: false`), F4 (`supportsTablet: false`). The
   iOS settings Expo builds with were compared before and after: only the light-only style, the two
   texts and the iPad's orientations changed. Android's settings and permissions are the same, so
   no new Android build.
2. `eas.json` (on top of `feat/eas-preview`, whose two commits this branch carries until that branch
   is merged):
   - `ios-simulator`: `ios.simulator: true`, the compile check (B-24, ADR-0001 step 5); needs no
     Apple account.
   - `production`: extends `preview` (its addresses), `distribution: store`, `autoIncrement: true`,
     an app bundle on Android. For TestFlight and the App Store; `eas submit` asks for the App Store
     Connect app the first time.
   - `development` is unchanged: built for iOS, it installs on an iPhone registered with
     `eas device:create`, for live code as on Android (runbook, "The iOS app").
3. F5: `FLOATING_SHADOW` in `src/theme.tsx`, used by `LogMealButton.tsx` and
   `WorkoutInProgress.tsx` (iOS's shadow; Android keeps elevation 6). F6: `FormScreen.tsx` listens to
   the "will" keyboard events too, which only iOS sends.
4. Tests: `src/appConfig.test.ts` (the iPhone settings, the permission texts, SQLCipher on, the iOS
   shadow) and, in `src/screens/inputs.test.tsx`, each sign-in form's footer moving on iOS's "will"
   events.
5. Documents: the owner decisions (D-104), `mvp-scope.md`, backlog B-01 and B-24, the constraints'
   A-001, C-008, R-001 and MVP defaults, ADR-0001's step 5 note, the runbook ("The iOS app" and its
   accounts table), CLAUDE.md.

No new package. Every iOS build is an EAS cloud build: **the owner is told before each one** (D-19).

### Checks on the branch (2026-11-16)
| Check | Result |
|---|---|
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| Mobile tests | 80 suites, 982 tests passed (12 new) |
| API tests | 25 files, 243 tests passed. In the first run, in the new folder, one test timed out at 5 seconds (`routes.test.ts`); run again, alone and with the rest, it passed: no API file is changed |
| Shared tests | 3 files, 102 tests passed |
| The iOS compile check (`ios-simulator`) | Not run: an EAS build, at the owner's word |

## Checks on an iPhone (before the release)
| ID | Check |
|---|---|
| IOS-01 | Install from TestFlight; the app opens; sign up; the confirmation email's link opens the app |
| IOS-02 | Forgot password: the email's link opens Reset password in the app |
| IOS-03 | Appearance System, Light, Dark; the phone's dark mode switched while the app is open |
| IOS-04 | Every sheet and page opens and closes, one after another (Log meal: day, Search foods, a food's page, the amount, Barcode, Own food, Saved) |
| IOS-05 | Log meal with changes not saved: swipe back from the screen's edge asks first |
| IOS-06 | Every number field: the keyboard opens and closes, and the sheet's button stays above it |
| IOS-07 | Barcode: allow the camera, scan; and with the camera refused, typing the digits still works |
| IOS-08 | Meal photo: choose one and take one |
| IOS-09 | Offline (airplane mode): log a meal, a workout and a weight; online again, they sync |
| IOS-10 | Workout timer: start, lock the phone for a few minutes, unlock: the time is right |
| IOS-11 | An exercise's How to video opens outside the app |
| IOS-12 | Delete the app, install it again: signed in or not, every log comes back after sign-in |
| IOS-13 | Log out deletes the phone's data; Delete account works |
| IOS-14 | Screens on a phone with a notch or Dynamic Island and on a small iPhone: nothing under the status bar or the home bar |
| IOS-15 | The Android test list's checks repeated on the iPhone |

## Going live: the steps
**A. Before any iOS build**
1. ~~The owner decides D-104~~ Done, 2026-11-16.
2. The owner joins the Apple Developer Program (see Prerequisites).
3. This branch's changes, as a pull request, at the owner's "push".

**B. Compile, then test on an iPhone**
4. The compile check: one `eas build -p ios --profile ios-simulator` (no Apple account).
5. In App Store Connect: the bundle ID `com.fitsphere.app` and the app record "FitSphere" (if the
   name is taken on the App Store, another one).
6. `eas build -p ios --profile production`: EAS creates the signing certificate and provisioning
   profile with the owner's Apple sign-in, or an App Store Connect API key.
7. `eas submit -p ios`: the build goes to TestFlight; internal testers (people on the owner's App
   Store Connect team) install it with the TestFlight app, without Apple's review.
8. The iPhone checks (IOS-01 to IOS-15); fixes on branches as for Android. A fix to the app's code
   can be tried at once on an iPhone with the iOS development build (live code through the tunnel,
   runbook "The iOS app"); TestFlight needs a new build for each round (EAS's iOS build limit, below).

**C. Release** (with Android's, once the bugs are fixed)
9. The release-blocking tasks RB-01 to RB-05, Legal's review (Q-049), email through Resend from
   FitSphere's domain (D-20), Confirm email on (RB-03), and the API and Supabase moved to Mumbai
   (D-101).
10. The privacy policy and support pages online (needed by both stores).
11. App Store Connect's listing: name, subtitle, description, keywords, category Health & Fitness,
    screenshots, support and privacy policy addresses, age rating questions, price free,
    availability India only (invariant 5).
12. App Privacy ("nutrition label"): what the app collects (health and fitness, body measurements,
    name, email, phone, address, date of birth, photos, user ID), all linked to the user, none used
    for tracking; Legal checks it with Q-049.
13. Export compliance answered (F10).
14. App Review's sign-in: a test account with synthetic data, confirmed, with notes on how to use
    the app.
15. Submit for review; on approval, release by hand (or phased). Fix anything Apple raises and
    submit again.
16. After the release: App Store Connect's crash reports and reviews; renew the membership each year.

## Prerequisites
| What | Why | Notes |
|---|---|---|
| Apple Developer Program membership | Needed for TestFlight and the App Store | US$99 a year (D-03, checked 2026-10-27; confirm on Apple's site before paying, C-008). As an individual (the owner's name shows as the seller) or an organisation (the company's name; needs a D-U-N-S number and can take longer to verify) |
| An Apple ID with two-factor authentication | Signs in to the developer account and App Store Connect | Owner's |
| At least one iPhone | Testing (D-10, R-001) | iOS 15.1 or later; the TestFlight app installed |
| A Mac | Not needed | EAS Build compiles and signs in the cloud; `eas submit` uploads |
| Expo account | Builds | Already in use. The free plan's iOS builds are counted apart from Android's (ADR-0001, checked 2026-10-27: 15 iOS builds a period; confirm on Expo's site) |
| App Store Connect API key (optional) | Lets `eas submit` upload without signing in each time | Made in App Store Connect, kept by EAS, never committed |
| Bundle ID and app name | The app's identity | `com.fitsphere.app` registered; "FitSphere" free on the App Store, else another name |
| Privacy policy page and support page | Required in the listing | Not written yet; Legal (Q-049) |
| Account deletion | Required by Apple | In the app already (D-31); the emailed path is RB-04 |
| Backend | The same as Android | No change for iOS: the same API (HTTPS, Cloud Run), Supabase and `fitsphere://` links |
| Store material | The listing | Screenshots at the largest iPhone size App Store Connect asks for, the text, the icon (ready) |
| Review account | Apple signs in to review | Synthetic data only (invariant 7) |

"Hosting" an iOS app is Apple's: the App Store holds and delivers it. There is nothing to host on
FitSphere's side beyond the API and database the Android app already uses.

## Risks
- **iOS-only bugs** (R-001): only the iPhone checks find them; each round of fixes costs an iOS build.
- **The app name**: "FitSphere" may already be taken on the App Store.
- **Apple's review** can ask for changes (permission texts, health claims, the review account); each
  answer is a new build or a reply.
- **The free plan's build limit**: plan the iOS builds. The iOS development build tries code fixes
  live; a TestFlight build is still needed for each round, because the app has no over-the-air
  updates.

## Not in this plan
iPad layouts; push notifications (post-MVP, D-20); Sign in with Apple (not required); Apple Health
(not in the MVP); over-the-air updates (a new package, its own decision).
