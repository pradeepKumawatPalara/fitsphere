# Maestro tests

Flows that drive the FitSphere app on a real Android phone over USB (D-119; no emulator, D-19): ten
smoke flows, run before each hand-over of a build to testers, and five regression flows for the
tracker's Critical rows. Each flow starts from a clean app (`clearState`), signs in with the robot
account (but `smoke-03` and `regression-acc-03`, which never sign in) and cleans up after itself, so
they can run in any order and again and again. The tracker rows are those of the tester's tracker,
kept outside the repository with the tester's guide.

## Smoke flows (tag `smoke`)

| Flow | What it checks | Tracker rows |
|---|---|---|
| `smoke-01-sign-in.yaml` | Sign in with a valid account opens Home | ACC-06 |
| `smoke-02-wrong-password.yaml` | A wrong password and an unknown email get one neutral message | ACC-07 |
| `smoke-03-sign-up-checks.yaml` | Create an account keeps its button greyed for a bad email and a short password | ACC-05 |
| `smoke-04-log-lunch.yaml` | "2 roti" in Search foods logs Chapati/Roti to Lunch; Home shows 146 kcal; the lunch is deleted | FOOD-10, HOME-04 |
| `smoke-05-roti-twice.yaml` | Roti added again asks "Already in this meal": Add to existing joins, Keep separate keeps two lines | FOOD-05 |
| `smoke-06-steps-sleep-weight.yaml` | Steps 0, 200,001 and letters refused, 1 and 200,000 kept; sleep 24.1 and 7.25 refused, 0.5 and 24 h kept; 70 kg shown | HOME-06, HOME-07, HOME-08 (kg only) |
| `smoke-07-log-workout.yaml` | A workout with Back Squat (High Bar), 3 sets, and a 20-minute walk shows on Training with the dumbbell; Delete workout asks first and says what goes | TRAIN-02, TRAIN-05 |
| `smoke-08-workout-timer-pill.yaml` | Start, Pause, Resume and Mark done; the Workout in progress pill on Home and Nutrition opens the workout | TRAIN-13, TRAIN-14 (no drag) |
| `smoke-09-calorie-target.yaml` | A new calorie target holds from today, a day last week keeps its old one; remaining = target minus eaten | SET-02, HOME-04 |
| `smoke-10-log-out.yaml` | Log out opens Sign in with nothing of the user, after Back and after a relaunch | ACC-10 |

## Regression flows (tag `regression`)

| Flow | What it checks | Tracker rows |
|---|---|---|
| `regression-acc-03-age-unticked.yaml` | With a good email and password, Sign up stays greyed until "I am 18 or older" is ticked and greys again when it is unticked; Sign up is never pressed | ACC-03 |
| `regression-food-01-search-paneer.yaml` | "paneer" in Search foods logs IFCT's Paneer (1 katori, 395 kcal) to Lunch; Lunch gets its green tick and Home shows 395 kcal; the lunch is deleted | FOOD-01 |
| `regression-food-14-quantity-scaling.yaml` | Chapati/Roti at 2, 4 and 1 chapati: calories, protein, carbs, fat and fibre each worked out from the grams (doubled 4.2 g of protein shows 8.5 g, as 4.23 g doubled is 8.46 g); nothing is added | FOOD-14 |
| `regression-cal-05-offline-saves.yaml` | In flight mode a meal, a workout, steps, sleep, weight, measurements and the protein target save on the phone and wait to sync; with flight mode off they sync; the day is put back | CAL-05 |
| `regression-acc-11-log-out-unsent.yaml` | In flight mode a lunch logged makes Log out warn first; Stay signed in keeps it; Log out and delete them deletes it, and signing in again online shows it never reached the server | ACC-11 |

`subflows/` holds steps the flows share (`cal-05-put-back.yaml`, `delete-roti-lunch.yaml`). Maestro runs
only the top-level files of a folder, so they never run on their own.

Left to people: dragging the pill and reopening the app (TRAIN-14), the timer while the phone is
locked (TRAIN-16), kg to lb (HOME-08), and the target limits (SET-01).

## Install on Windows

1. Java 17 or newer: `java -version`.
2. Maestro: download `maestro.zip` from the latest release at
   <https://github.com/mobile-dev-inc/maestro/releases>, unzip it (for example to `C:\maestro`) and add
   its `bin` folder (`C:\maestro\maestro\bin`) to the user's `Path`. Check with `maestro --version` in
   a new PowerShell window. On a recent Java it prints three "WARNING: Final field …" lines on each
   run: they are harmless.
3. `adb`: Android SDK Platform-Tools, the standalone download (no Android Studio, D-19), its folder on
   `Path`.

## Prepare the phone

1. Developer options on (tap the build number seven times in About phone), then **USB debugging** on.
   Some makers add a second switch for taps over USB ("USB debugging (Security settings)",
   "Disable permission monitoring"): turn it on if Maestro's taps do nothing.
2. Connect the cable, allow the PC when the phone asks, and check that `adb devices` lists the phone
   as `device`.
3. Animations off, so screens settle before each step: in Developer options set Window animation
   scale, Transition animation scale and Animator duration scale to off, or:
   ```powershell
   adb shell settings put global window_animation_scale 0
   adb shell settings put global transition_animation_scale 0
   adb shell settings put global animator_duration_scale 0
   ```
4. **Do Not Disturb on** while the flows run: a notification banner over the top of the screen hides
   the header's buttons, and a tap meant for Account lands on the banner instead.
5. Install the test APK (EAS profile `preview`, runbook "Android test build"). The flows test the code
   inside the installed app: new code needs a new APK. The development build is not used: after
   `clearState` it opens on its launcher, not on Sign in.

## The robot account

One account on the development project with made-up data only, signed up in the app with its email
confirmed (an unconfirmed account also gets "Email or password is incorrect."). Its email and
password are given with `-e` on each run and never written into a file. Targets can't be removed:
`smoke-09` sets a calorie target, so `smoke-04`, `smoke-05` and `regression-food-01` read Home with or
without one; `regression-cal-05` keeps a daily protein target of 120 g, which no other flow reads.
Today's steps, sleep, weight and measurements are one per day and are left as 7,500 steps, 7 h, 70 kg
and waists of 80 and 78 cm.

## Run

From the repository root, with the robot account's own email and password in place of the two
example values:

```powershell
# one flow
maestro test -e "EMAIL=robot@example.com" -e "PASSWORD=robot-password" .maestro/smoke-04-log-lunch.yaml

# the smoke flows, or the regression flows
maestro test --include-tags smoke -e "EMAIL=robot@example.com" -e "PASSWORD=robot-password" .maestro
maestro test --include-tags regression -e "EMAIL=robot@example.com" -e "PASSWORD=robot-password" .maestro

# all of them
maestro test -e "EMAIL=robot@example.com" -e "PASSWORD=robot-password" .maestro
```

- With more than one phone connected, add `--device` and the phone's id from `adb devices`
  (`maestro --device <id> test …`).
- A JUnit report: `--format junit --output results.xml` (kept out of git).
- Each run's screenshots, screen dumps and logs are saved under `%USERPROFILE%\.maestro\tests\`,
  outside the repository; a failed step names its folder.

## Flight mode (`regression-cal-05`, `regression-acc-11`)

- Maestro's `setAirplaneMode` (Android only). Both flows turn flight mode off in `onFlowComplete`,
  which runs whether the flow passes or fails. Stopping Maestro with Ctrl+C skips it: then turn flight
  mode off by hand, or with `adb shell cmd connectivity airplane-mode disable`. Maestro reaches the
  phone over the cable, so flight mode does not cut it off.
- Each flow checks the phone really is offline: an entry still says "Waiting to sync" a minute after
  it was saved. On the owner's OnePlus flight mode cut the network on the first run (2026-11-20).
  Android 13 and later keep Wi-Fi on in flight mode once it was turned back on there; such a phone
  fails that check. Turn flight mode on, Wi-Fi off and flight mode off once by hand, and it forgets.

## Writing a flow

- Read the labels in the app's code (most controls have an accessibility label), or point at them
  in `maestro studio`. A test ID (`testID`) is found with `id:`.
- A flow's `name` becomes the folder of its report, and Windows refuses `" : / \ | ? * < >` in it.
- Wait with `extendedWaitUntil`, never a fixed pause.
- `scrollUntilVisible` stops once any of the element is on screen: found with only its top edge
  showing, it is then tapped on the phone's gesture bar, or under the tabs and the + Log button. Before
  tapping something found near the end of a page, `scroll` once more. To check a line, scroll to the
  line itself (with `below:` when the same words show elsewhere). Not `centerElement`: an element near
  the end of a page never reaches the middle.
- Meal slots on Nutrition start folded: "Show Lunch meals" opens Lunch.

## If a flow stops halfway

What it logged stays and can make later flows fail too (a lunch left by 05 makes 09 fail), so tidy up
by hand before the next run: delete today's lunch (04, 05, `regression-food-01`) or workout (07, 08;
this also stops its timer). For 09, run it again the same day, so today's calorie target ends on
2,000 kcal again. `regression-cal-05` and `regression-acc-11` tidy their own leftovers at their start.
