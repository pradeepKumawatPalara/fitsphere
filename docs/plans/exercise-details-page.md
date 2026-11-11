# Exercise details page plan

- Status: **Accepted** (the owner, in chat, 2026-11-11: "lock it", on the canvas's version 78; the
  icon left to FitSphere: the chart, the board's default; locked in version 79)
- Owner: Project owner (D-01)
- Last updated: 2026-11-11
- Builds on: D-81 (each library row's muscles, equipment, tags, how-to steps, what to watch for and
  video address, on the server), D-67 (the exercise library), D-50 (the exercise list and its eight
  types), D-63 (a row per set), D-71 (the workout timer), ADR-0007 (the phone keeps the last 90 days)
- Decision: D-82. Requirements: the new REQ-TRN-008 (exercise details); REQ-TRN-003, REQ-TRN-004,
  REQ-TRN-005 (the lifting unit) touched
- Design: the canvas's "4.4 Exercise details · PROPOSED (D-82)" (boards `ExerciseDetail`,
  `ExerciseDetailStates`, `ExerciseDetailEntry`, `ExerciseDetailEntryStates`)
- Branch: `feat/exercise-details`, with D-81, in the folder `D:\fitsphere-exercise-details` (on main
  7297984); D-81 and D-82 go in as their own commits

## What the owner asked
2026-11-11, with four pictures of a "Dumbbell Shrug" page (tabs Progress, History, How to): "I want
to add the one more implementations to each Excercise in the Fitsphere that HOw to Perform this
Excecise. and Video to perform. See the Data that has already been provided for each Excercise.
Hisotry of the Excercise performed by the User. and the Best Time of the User. And Progress taab as
well see the images. You can add your point to these 3 tabs aswell. come up with the plan and canva
design . Wait for my approval. Once I approve start building it".

## What the user sees

### Opening the page
- **From a workout** (4.2): each exercise's card ends in a bar with **Progress**, **Edit** and
  **Remove**, each an icon and a word, a third of the card's width; Progress opens the page. (Built
  first as a chart icon before the pencil and bin; after a phone test the owner asked for other
  layouts and chose C of four, canvas version 81.) Tapping the card still edits the exercise.
- **From Add exercise** (4.3): once an exercise of the list is picked, a **How to do it** link under
  the name opens its page on How to, and the back arrow returns to the form as it was.
- The page is a whole page with a back arrow, like Target history; it opens on **Progress** when the
  user has logged the exercise before, otherwise on **How to**.

### The header
The exercise's name, and under it the muscles it works ("Traps · Upper back · Forearms"); with no
details, its category and sub-group, or its group ("Cardio").

### Progress tab
- **Three record cards**, each with the date it was made. For a lift: **Estimated 1RM**, **Best set**
  ("70.0 × 8") and **Best session** (the most weight moved in one workout, "560 kg"). Other kinds have
  their own (the table below): a bodyweight exercise shows Most reps, Best session (reps) and
  Workouts; running shows Longest distance, Fastest pace and Workouts.
- **A line under them:** "6 workouts · first on Mon 14 Sep · last on Fri 30 Oct".
- **The graph**, with **4W**, **12W** and **All**: a dot per workout. For a lift, three choices of what
  it shows: **Est. 1RM**, **Heaviest** and **Volume** (added); one measure for the other kinds. With
  fewer than two workouts in the range: "A graph needs two workouts with this exercise in this range."
- Under the 1RM graph: "An estimate from your best set each workout (weight × reps). It is a guide
  to the trend, not a lift to attempt."
- **Never done:** "Log this exercise in a workout to see your progress." and **How to do it**.
- Weights in the user's lifting unit, kg or lb (REQ-TRN-005).

### History tab
- **A card per workout** with the exercise, newest first: the date (and "Workout 2" when the day has
  several), every set as the workout page shows them ("Set 1  10 × 60.0 kg", D-63), the workout's
  best set in bold, and a line for a lift: "Volume 1,620 kg · Est. 1RM 88.5 kg"; for running, "6:00
  /km · 10.0 km/h".
- **BEST** marks the workout that holds the best set ever (the user's "best time" for a timed or
  cardio exercise: the longest hold, the longest run).
- Tapping a card opens that workout.
- **Load older** at the foot, as on Training: the phone keeps the last 90 days; older workouts are
  read online and kept only while the page is open.
- **Never done:** "No workouts with this exercise yet."

### How to tab
- **The video**, first: a card with a play button, "Watch the video" and "youtube.com · opens outside
  FitSphere"; tapping opens it in YouTube or the browser (answer 3). It is the exercise's own address
  when the file gives one; otherwise, for every exercise of the list, the owner's default video,
  `https://www.youtube.com/watch?v=IT94xC35u6k` (none of the 2,090 rows has its own yet). A name the
  user typed has no video. Nothing is loaded from the video site until the card is tapped.
- **How to do it:** the steps, numbered 1 to 3.
- **Watch for:** the mistakes to avoid, as the file writes them.
- **Muscles worked** as chips, the primary muscle filled, and **Equipment** as a chip.
- **In the library:** "Dumbbell › Shoulders".
- A small note at the foot: "General guidance, not personal advice. Stop if anything hurts."
  (answer 2).
- **No details** (our own exercises the library does not list, such as Running, and names the user
  typed): the video card (not for a typed name), then "There's no how-to for this exercise yet. Your
  progress and history are in the other tabs." The other two tabs work for every name.

## How the numbers are worked out
Only workouts the phone holds count (the last 90 days), plus older ones loaded on the page. A
workout's exercise belongs to the page when its name, ignoring case, hyphens and doubled letters,
is the exercise's name or one of its other names (so a workout saved as "Barbell bench press"
before D-67 counts for "Barbell Flat Bench Press"); for a name the user typed, that name.

| Kind (from the sets saved) | Record cards | Graph | Best set (BEST) |
|---|---|---|---|
| Weight and reps | Estimated 1RM, Best set, Best session (volume) | Est. 1RM, Heaviest or Volume | The highest estimated 1RM |
| Reps only (bodyweight) | Most reps, Best session (total reps), Workouts | Most reps | The most reps |
| Time only (a hold) | Longest, Best session (total time), Workouts | Longest | The longest |
| Weight and time (a carry) | Heaviest, Longest, Workouts | Heaviest | The heaviest, then the longest |
| Distance and time (running) | Longest distance, Fastest pace, Workouts | Distance | The longest distance |
| Treadmill (speed) | Longest time, Fastest speed, Workouts | Time | The longest time |
| Machine (level) | Longest time, Highest level, Workouts | Time | The longest time |
| Time only (a class) | Longest, Total time, Workouts | Time | The longest |

- **Estimated 1RM** = weight × (1 + reps ÷ 30) (the Epley formula), from sets of 1 to 12 reps (a set
  of 1 rep is its own weight), rounded to 0.5 kg or 1 lb. The picture's 70 kg × 8 gives 88.5 kg.
- **Volume** = the weight × reps of every set of the workout added up.
- **Pace** = time ÷ distance; **speed** as typed on a treadmill.

## The data
- **Server:** `GET /v1/exercises` sends each exercise's `details` (primary muscle, muscles worked,
  equipment, tags, steps, what to watch for, video address, and the place they come from), or null
  when the library has none. An exercise in several places sends its first place's (answer 4); the
  video, from its first place that has one. No migration: D-81's table is read. The list's version
  changes, so the phone downloads it again once (about 0.5 MB more).
- **Shared contract:** `listedExerciseSchema` gets `details` (null when absent), and the default
  video's address is one constant, `EXERCISE_DEFAULT_VIDEO_URL`, used when an exercise has none. An
  older app ignores the new field.
- **Phone:** schema version 20: `exercises.details` (JSON), the list's version cleared so the next
  download fills it.
- **History and Progress** read the workouts on the phone; **Load older** uses the existing
  `GET /v1/users/{userId}/workouts` and keeps the matches on the page only. No server change.

## The owner's answers (2026-11-11)
1. **Opening from a workout:** "add the ICON and keep the ICOn Vertically Align", then, on the canvas's
   version 77 (the icons one above the other, an info icon): "lets show me icon Horizontally. and the
   icon of the top out of three should be other": a new icon before the pencil and the bin, the three
   in a row; its picture chosen from a chart, a book and a dumbbell (canvas version 78).
2. **The AI-written how-to:** "show the message as you suggest": shown with the note "General
   guidance, not personal advice. Stop if anything hurts.", and a qualified person checks the text
   before real users (added to "Before real users").
3. **The video:** "If the video link is not available by default show this link and open on you
   tube: https://www.youtube.com/watch?v=IT94xC35u6k": opened in YouTube or the browser (no new
   build); that address for every exercise with none of its own.
4. **Different details in different places:** "show first category detail".
5. **The "Workout in progress" bar:** "keep it hoold Remide me later": on hold (backlog), the owner
   reminded when this page is merged.

## Not in this plan (later)
The workout-in-progress bar (on hold, answer 5); a list of "your exercises" on the Progress tab; the
video inside the app; choosing which place's details to show.

## Risks
- **The AI-written steps** shown to users may be wrong or unsafe for some people (proposed R-015).
  The note on the page, a qualified person's check before real users (answer 2), Legal's review
  (Q-049).
- **One default video for every exercise** (answer 3): the same video opens from every exercise until
  the file gives each its own; the card says "Watch the video", not that it shows this exercise.
- **90 days on the phone:** records and All show only what the phone holds unless older workouts are
  loaded; the line "Your last 90 days. Load older in History adds earlier workouts." says so.
- **A bigger list download** once (about 0.5 MB).

## Tests
- API: `GET /v1/exercises` sends Dumbbell shrug's details, the first place's for Devil Press, null for
  Running; the version changes with the details.
- Shared: the contract accepts details and null.
- Phone: schema 20; the numbers (`src/exerciseStats.ts`: 1RM, best set, volume, pace and the records
  for each kind, ranges, names and other names matched, sessions by date); the page's three tabs and
  their empty states; opening from a workout and from Add exercise; Load older; kg and lb.

## Steps
1. Server and shared: details in `GET /v1/exercises` (integration test).
2. Phone: schema 20 and `src/exerciseStats.ts` (unit tests).
3. Phone: the page (`components/ExerciseDetailsPage.tsx`, a whole page over the workout or Add
   exercise, as the exercise page, D-67; a route pushed from Add exercise would open under it) with its
   three tabs; the numbers in `src/exerciseStats.ts`; older workouts through `src/olderWorkouts.ts`,
   shared with Training.
4. Phone: the two ways in (the workout's info icon, Add exercise's How to do it).
5. Docs: D-82, REQ-TRN-008, the data model, the API conventions, the redesign's 4.4, the backlog (the
   workout-in-progress bar on hold; the trainer's check before real users), CLAUDE.md.

## Checks
Lint, types, the unit tests (server, shared, phone) and the integration tests; then the owner's phone
test: open from a workout's info icon and from Add exercise; each tab for a lift, a bodyweight
exercise, running and a name of your own; kg and lb; Load older; the video opens the default video in
YouTube.
