# Health Connect device tests (D-121, plan step 5)

Status: **not started.** Needs the EAS development build with `react-native-health-connect` (plan step 4) installed
on the owner's Android phone, and each device to test. Real values from the owner's own devices stay on the owner's
phone: **write nothing from the app's data into this file except the result and a short note** (invariant #7).

A device or app is named on the Connections screen only after a row below says Works, Partial or Not supported.

## Before you start
1. The development build is installed; Settings › Connections shows **Health Connect** with a Connect button
   (not "Not available on this phone"). If it says Not available, note the phone's Android version here and stop.
2. The device's own app (for the Fastrack, its companion app) is installed, signed in and synced.
3. In that app's settings, allow it to **write steps and weight to Health Connect** (the exact wording differs by app).
4. Open Android's Health Connect app › App permissions (or Data and access) and confirm the device's app is
   listed under steps and weight.

## Test for each device (one row in the results table each)
Do this over **three days** so a full day's total and a few weigh-ins can be compared.

| # | Check | Pass when |
|---|---|---|
| 1 | Connect | Android's permission screen asks for **steps and body weight only**; after Allow, the row says Connected |
| 2 | Refuse | Choosing Don't allow leaves Not connected, with "Allow steps and weight in Health Connect to connect." |
| 3 | First read | "Read just now" counts days of steps and weigh-ins; Home shows the values with the Health Connect tag |
| 4 | Steps match | The day's steps on Home are within about 2% of the total in the device's own app (note both numbers) |
| 5 | Steps grow | Walk, sync the device, tap Read now: today's steps rise |
| 6 | Weight match | A weigh-in made on the device (scale or manual entry in its app) appears on its day, within 0.1 kg of the device's own value |
| 7 | Day edges | A weigh-in or steps near midnight land on the right India day |
| 8 | Typed wins | Type steps or weight for a day that has an import: your value stays after Read now, and the tag is gone |
| 9 | Two apps | With a second app also writing steps (for example, the phone's own step counter), the total is not double what the device's app shows |
| 10 | Disconnect | Keep leaves the values; Remove deletes them from Home (and, once the API is deployed, from the server); typed values stay |
| 11 | Withdraw | Removing FitSphere's access in Android's Health Connect shows Not connected at the next app open |
| 12 | Reopen | Closing and opening the app reads again with no tap |

## Results

| Device or app | Android version | Tested on | Result (Works / Partial / Not supported) | Notes (what failed or differed) |
|---|---|---|---|---|
| Fastrack (watch) | | | | |

**Works:** checks 1 to 12 pass for steps and weight. **Partial:** connects and reads, but one thing fails (say which:
for example, a watch that writes steps but not weight). **Not supported:** the device's app writes nothing to Health
Connect, or the values are wrong.

## After the tests
- Tell Claude the results; the Connections screen then names each tested device with its status.
- A result of Not supported or Partial for the Fastrack is information for the client, not a defect to hide: the
  screen says so plainly.
- Heart rate and workouts are a separate plan, started only once steps and weight work (ADR-0013).
