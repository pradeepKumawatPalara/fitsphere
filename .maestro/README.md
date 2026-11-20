# Maestro smoke tests

Ten flows that drive the FitSphere app on a real Android phone over USB (D-119; no emulator, D-19).
Run them before each hand-over of a build to testers. Each flow starts from a clean app
(`clearState`), signs in with the robot account and cleans up after itself, so they can run in any
order and again and again. The tracker rows are those of the tester's tracker, kept outside the
repository with the tester's guide.

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

Left to people: dragging the pill and reopening the app (TRAIN-14), the timer while the phone is
locked (TRAIN-16), kg to lb (HOME-08), log out with unsent data in flight mode (ACC-11), and the
target limits (SET-01).

## Install on Windows

1. Java 17 or newer: `java -version`.
2. Maestro: download `maestro.zip` from the latest release at
   <https://github.com/mobile-dev-inc/maestro/releases>, unzip it (for example to `C:\maestro`) and add
   its `bin` folder (`C:\maestro\maestro\bin`) to the user's `Path`. Check with `maestro --version` in
   a new PowerShell window.
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
4. Install the test APK (EAS profile `preview`, runbook "Android test build"). The flows test the code
   inside the installed app: new code needs a new APK. The development build is not used: after
   `clearState` it opens on its launcher, not on Sign in.

## The robot account

One account on the development project with made-up data only, signed up in the app with its email
confirmed (an unconfirmed account also gets "Email or password is incorrect."). Its email and
password are given with `-e` on each run and never written into a file. `smoke-09` sets a calorie
target, which can't be removed; `smoke-04` and `smoke-05` read Home with or without one.

## Run

From the repository root, with the robot account's own email and password in place of the two
example values:

```powershell
# one flow
maestro test -e "EMAIL=robot@example.com" -e "PASSWORD=robot-password" .maestro/smoke-04-log-lunch.yaml

# all ten
maestro test -e "EMAIL=robot@example.com" -e "PASSWORD=robot-password" .maestro
```

- With more than one phone connected, add `--device` and the phone's id from `adb devices`.
- A JUnit report: `--format junit --output results.xml` (kept out of git).
- Each run's screenshots, screen dumps and logs are saved under `%USERPROFILE%\.maestro\tests\`,
  outside the repository; a failed step names its folder.

If a flow stops halfway, tidy up by hand before the next run: delete today's lunch (04, 05) or
workout (07, 08; this also stops its timer). For 09, run it again the same day, so today's calorie
target ends on 2,000 kcal again.
