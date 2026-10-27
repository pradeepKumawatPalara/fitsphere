# ADR-0001: Mobile client framework

- Status: **Proposed**
- Date: 2026-10-27
- Decision owner: Project owner
- Related requirements: REQ-NAV-*, REQ-LOG-005 (voice), REQ-LOG-006 (camera), REQ-LOG-007 (barcode), REQ-MEAS-001 (bottom sheets), REQ-NFR-004 (offline, proposed)
- Related constraints/decisions: C-007, C-008 (budget), D-01 (solo developer), D-02 (Android + iOS), D-03 (React Native / JS / Node preference), D-04 (offline), D-10 (Android-first)
- Supersedes: None

## Context
FitSphere needs one app for Android and iOS (D-02), built and maintained by one developer
working about 40 hours a week (D-01). The app must use the camera (meal photos, nutrition
labels), barcode scanning, microphone (voice meals), local storage for offline logging (D-04),
charts (Progress), and bottom sheets. The owner prefers React Native with JavaScript, but will
change if functionality or scalability would suffer (D-03). Budget is free tiers first (C-008).

Known: the owner develops on Windows and has neither a Mac nor an iPhone, so phase 1 is
Android-first and iOS testing waits until an iPhone is available (D-10).
iOS apps can only be compiled on macOS, either a local Mac or a cloud build service.

Note on "scalability": the number of users the system can serve depends on the backend and
database (ADR-0002, ADR-0003), not on the mobile framework. For the client, the real concerns
are runtime performance on low-end Android phones (common in India), long-term maintainability,
and access to device features.

## Decision criteria
1. **Must:** one codebase for Android and iOS that one person can maintain.
2. **Must:** camera, barcode (EAN-13 / UPC for food packs), microphone, local database.
3. **Must:** a way to build iOS apps from Windows (no Mac assumed).
4. **Should:** language the owner already knows; one language across app and backend.
5. **Should:** free to build and test at phase-1 volume.
6. **Should:** smooth on low-end Android devices.
7. **Should:** large ecosystem; Claude Code works well with it.

## Options considered

### Option A — React Native with Expo (development builds, EAS)
- Benefits:
  - Matches the owner's JavaScript skills; TypeScript can be shared with a Node backend
    (types, validation schemas).
  - Expo's camera library supports barcode scanning, including EAN-13, EAN-8, UPC-A and UPC-E.
  - Expo's cloud build service (EAS Build) compiles iOS apps without a Mac.
  - Over-the-air updates for JavaScript fixes without a full store release.
  - Very large ecosystem; well represented in Claude's training and docs.
- Costs and risks:
  - EAS free plan (checked 2026-10-27): up to 15 Android and 15 iOS builds per period, low
    priority queue, 45-minute build timeout, 1,000 monthly active users for over-the-air
    updates. Enough for development; may need the paid Starter plan (US$19/month at time of
    checking) near launch. Android builds can also run locally on Windows for free.
  - Third-party native libraries must support React Native's New Architecture, which is the
    only architecture from React Native 0.82 onward. Check each library before adopting it.
  - JavaScript-based UI can stutter on low-end phones if lists and charts are not built
    carefully.
- Fit against constraints: meets 1, 2, 3, 4, 5, 7; 6 needs care.
- Evidence and uncertainty: Expo and Play/Apple pricing pages read 2026-10-27; New
  Architecture status from a 2026 industry article — confirm against the React Native release
  notes at setup. Offline database choice (e.g. expo-sqlite vs. a sync library) belongs to
  ADR-0003 / the sync ADR, not here.

### Option B — React Native without Expo ("bare" React Native CLI)
- Benefits: same language as A; full control of native projects.
- Costs and risks: you maintain Android and iOS native projects yourself; iOS builds need a Mac
  or a separately configured cloud CI; native upgrades are a known time sink.
- Fit: meets 1, 2, 4, 7; fails 3 without extra paid tooling; weaker on 5 for a solo developer.
- Why it loses: all of its control is available from Option A when needed (Expo development
  builds allow custom native code), without the maintenance cost.

### Option C — Flutter (Dart)
- Benefits: consistent rendering and strong performance, including on low-end Android; mature
  camera, barcode and SQLite plugins; good charting.
- Costs and risks: Dart is a new language for the owner; the backend would be a second
  language (no shared code with Node); iOS builds from Windows need a cloud CI service.
- Fit: meets 1, 2, 6; partial on 3, 5; fails 4.
- Why it loses: its main advantage (rendering performance) is not a stated bottleneck for this
  app's screens (forms, lists, simple charts), and the cost is learning a new language alone.

### Option D — Native apps (Kotlin for Android + Swift for iOS)
- Benefits: best performance and earliest access to platform features.
- Costs and risks: two codebases, two languages, and iOS work needs a Mac.
- Fit: fails 1, 3, 4.
- Why it loses: doubles the work for one developer.

## Decision
Pending approval.

## Recommended option
**Option A — React Native with Expo, TypeScript, using development builds and EAS Build.**
It is the only option that meets every Must criterion with the owner's existing skills and
costs nothing until near launch.

## Why alternatives were rejected
See "Why it loses" under each option.

## Counterfactual
- **Flutter** would win if testing on real low-end Android phones showed unacceptable lag in
  the screens that matter (meal logging, Progress charts) after reasonable optimisation, or if
  the owner were already fluent in Dart.
- **Bare React Native** would win if a needed native SDK cannot work inside Expo's
  configuration system — unlikely given development builds.
- **Native** would win only with separate Android and iOS developers.

## Consequences and accepted trade-offs
- Easier: one TypeScript codebase; shared types with a Node backend; iOS builds from Windows.
- Harder: build minutes on the free tier are limited — plan builds, and develop mostly with
  local Android builds and the Android emulator.
- Costs accepted at release: Google Play US$25 once at Android release; Apple US$99/year only
  at iOS release (C-008, D-10).
- Risk accepted: iOS-only bugs will be found late (R-001, D-10).
- Commits: every native library must support the New Architecture.

## Validation plan (spike, ~1–2 days, before Accepted)
1. Create a blank Expo TypeScript app; run it on an Android emulator on Windows.
2. Scan an EAN-13 barcode from a real food pack with the camera.
3. Record 5 seconds of audio; take a photo.
4. Save and read 1,000 rows from a local SQLite database with the network off.
5. Run one EAS iOS build only to confirm it compiles; real-device iOS testing deferred (D-10).
6. Scroll a 200-row list on the lowest-end Android phone available.
Record results in this ADR, then the owner marks it Accepted or Rejected.

## Revisit conditions
- Spike step 6 shows visible lag that optimisation does not fix.
- EAS free limits block regular development for two months in a row.
- An iPhone becomes available — revisit the iOS test plan (R-001, D-10).
- A web dashboard for coaches becomes a requirement (F-01) — re-check whether React Native
  for Web or a separate web app fits.

## References
- Expo plans: https://docs.expo.dev/billing/plans/ and https://expo.dev/pricing (read 2026-10-27)
- Expo camera barcode types: expo-camera documentation (read 2026-10-27)
- Google Play registration fee: https://support.google.com/googleplay/android-developer/answer/6112435
- Apple Developer Program fee: https://developer.apple.com/programs/ (fee as reported 2026-10-27; confirm on Apple's site)
- React Native New Architecture status: https://ditto.com/blog/the-state-of-react-native-in-2026 (vendor blog — confirm in RN release notes)
- Project: `docs/product/owner-decisions-2026-10-27.md`