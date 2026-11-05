# Exercise list sources

- Status: Draft
- Owner: Project owner (D-01)
- Last updated: 2026-11-05 (D-50)
- Data: [`data/exercises/exercise-list.csv`](../../data/exercises/exercise-list.csv), 334 exercises
- Loaded by: `npm run exercises:import -w @fitsphere/api` into `app.exercises` (migration 0016); served
  by `GET /v1/exercises`

## The list
FitSphere's own list, written for FitSphere on 2026-11-05 at the owner's request (D-50) from the
everyday names of gym, home, cardio, yoga and sports exercises, with Indian names people search by
(for example *dand*, *baithak*, *Surya Namaskar*, *kushti*). It is not copied from any app, website or
exercise database. The owner checks it in the pull request; a change is a change to the CSV and
`exercises:import` again, with no app update.

Each row has:

| Column | What it holds |
|---|---|
| `code` | The exercise's key: lower-case words joined by hyphens |
| `name` | The name shown, 1 to 80 characters |
| `group` | The group shown beside it: barbell, dumbbell, kettlebell, machine, cable, bodyweight, band, cardio, sport, yoga (shown "Yoga and mobility"), other |
| `log_type` | How it is logged, which decides the fields the app asks for (below) |
| `compendium_code`, `met` | The Compendium activity it is estimated as, and that activity's MET, unchanged; empty when the Compendium lists no such activity |
| `aliases` | Other names to search by, separated by `;` |

No two names or other names may be the same once case, spaces, hyphens, apostrophes and doubled
letters are ignored (so "Dumbell" and "Dumbbell" are one), and another name may not just repeat the
name; the import refuses the whole file otherwise.

## How each type is logged
| Type | Fields | Count |
|---|---|---|
| `weight_reps` | Each set: reps and a weight, both needed | 146 |
| `reps` | Each set: reps; no weight field (bodyweight and bands) | 73 |
| `time` | Each set: a time | 10 |
| `weight_time` | Each set: a weight and a time | 7 |
| `distance_time` | A time and a distance; the average speed and pace shown | 20 |
| `treadmill` | A time, speed, incline and distance | 3 |
| `cardio_machine` | A time, distance and level | 8 |
| `time_only` | A time | 67 |

## The METs: the 2024 Adult Compendium of Physical Activities
Calories burned are estimated as MET × the user's latest weight in kg × the time in hours (D-50).
Each exercise names one Compendium activity, and its MET is copied unchanged.

- Source: Herrmann SD, Willis EA, Ainsworth BE, et al. 2024 Adult Compendium of Physical Activities:
  a third update of the energy costs of human activities. *Journal of Sport and Health Science*,
  2024;13(1):6–12. [pacompendium.com](https://pacompendium.com/)
- File: "2024 Adult Compendium – PDF File",
  `https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf`,
  downloaded on 2026-11-05: 563,091 bytes, 28 pages, SHA-256
  `ac30234b8f8f813837e282773cfcb3e0fe062334777c2f7b3213429c4fbc251c`. Kept outside the repository, in
  `D:\fitsphere-data\compendium-2024-11-05\` ([`docs/sources/README.md`](../sources/README.md)).
- Terms, as the Compendium's home page gives them under "Using the Compendium" (read 2026-11-05):
  "The Adult, Older Adult, and Wheelchair Compendia are free to use for commercial purposes."
  "Please do not change MET values or combine activities with different MET levels." "Please cite
  the Compendium website or publication(s)." The journal article itself is published under CC
  BY-NC-ND 4.0, which does not allow commercial use. The owner accepted the risk for now (R-011);
  Legal is asked (Q-049, L-17).
- FitSphere copies only the codes and METs below, never the Compendium's descriptions, and credits the
  Compendium where calories are estimated.

How an exercise's activity was chosen:
- Lifting with free weights, machines, cables, kettlebells and bands: 02054, resistance training at
  varied resistance; squats and deadlifts and their variants 02052; the Olympic lifts 02050;
  kettlebell swings 02058.
- Bodyweight: the calisthenics activities the Compendium names by example: push-ups, pull-ups, sit-ups
  and lunges 02022; crunches and planks 02024; jumping jacks, burpees and battle ropes 02020; squats
  and other bodyweight resistance 02056; back extensions 02030; jumps and mountain climbers 02214.
- Carries: 17019 (a heavy load, moderate pace); the suitcase carry 17018.
- Cardio, classes, yoga, dance and sports: the activity of the same name; running at a
  self-selected pace (12145); walking at a self-selected speed (17255); treadmill walking at 5.6 to
  6.3 km/h (17358).
- One MET each exercise, whatever the speed typed (MVP default, D-50; backlog E-26).
- Kabaddi and kho-kho: the Compendium lists neither, so they have no MET, and calories are only
  typed.

How it was checked (2026-11-05): the PDF's table was read row by row (1,100 activities; the last
running row, 12620, ran into the next heading's rows when read and is not used); every code and MET
in the list was compared with it and matched; the import's own checks passed.

## The codes the list uses
| Code | MET | Page | Exercises |
|---|---|---|---|
| 01009 | 8.5 | 1 | Mountain biking |
| 01014 | 7.0 | 1 | Cycling |
| 01200 | 6.8 | 1 | Exercise bike, Air bike |
| 01270 | 9.0 | 2 | Spin class |
| 02000 | 7.3 | 2 | Aerobics |
| 02004 | 7.8 | 2 | Step aerobics |
| 02005 | 4.8 | 2 | Low-impact aerobic dance |
| 02006 | 8.0 | 2 | High-impact aerobic dance |
| 02008 | 5.0 | 2 | Boot camp workout |
| 02020 | 7.5 | 2 | Burpee, Jumping jack, High knees, Bear crawl and 1 more |
| 02022 | 3.8 | 2 | Push-up, Knee push-up, Incline push-up, Decline push-up and 23 more |
| 02024 | 2.8 | 2 | Crunch, Bicycle crunch, Reverse crunch, V-up and 15 more |
| 02030 | 3.5 | 2 | Back extension |
| 02032 | 6.0 | 2 | Bodyweight circuit |
| 02035 | 5.0 | 2 | Circuit training |
| 02040 | 7.5 | 2 | Functional fitness workout |
| 02048 | 5.0 | 2 | Elliptical trainer |
| 02050 | 6.0 | 2 | Power clean, Hang clean, Clean and jerk, Snatch |
| 02052 | 5.0 | 2 | Barbell back squat, Barbell front squat, Barbell box squat, Barbell overhead squat and 22 more |
| 02054 | 3.5 | 2 | Barbell bench press, Barbell incline bench press, Barbell decline bench press, Close-grip bench press and 123 more |
| 02056 | 3.0 | 2 | Wall push-up, Bodyweight squat, Hindu squat, Pistol squat and 10 more |
| 02058 | 9.8 | 2 | Kettlebell swing |
| 02065 | 9.3 | 2 | Stair climber |
| 02068 | 11.0 | 2 | Skipping |
| 02070 | 7.3 | 2 | Rowing machine |
| 02078 | 11.0 | 3 | Shuttle run |
| 02080 | 6.8 | 3 | Ski erg |
| 02101 | 2.3 | 3 | Stretching |
| 02103 | 1.8 | 3 | Mat Pilates |
| 02105 | 2.8 | 3 | Pilates |
| 02115 | 2.8 | 3 | Arm bike |
| 02150 | 2.3 | 3 | Hatha yoga |
| 02155 | 3.0 | 3 | Hot yoga |
| 02160 | 4.0 | 3 | Power yoga |
| 02170 | 2.0 | 3 | Nadi shodhana pranayama |
| 02175 | 2.3 | 3 | Yoga |
| 02180 | 3.5 | 3 | Surya Namaskar |
| 02185 | 2.7 | 3 | Vinyasa yoga |
| 02214 | 11.0 | 3 | Jump squat, Jumping lunge, Mountain climber, Tuck jump and 3 more |
| 02230 | 5.8 | 3 | Hooping |
| 02310 | 6.5 | 4 | Zumba |
| 03025 | 4.5 | 4 | Bollywood dance, Indian classical dance |
| 03033 | 5.0 | 4 | Bhangra, Garba |
| 03042 | 6.0 | 4 | Ballroom dancing |
| 03070 | 3.8 | 4 | Contemporary dance |
| 03090 | 4.8 | 4 | Salsa dancing |
| 12020 | 7.5 | 15 | Jogging |
| 12025 | 4.8 | 15 | Spot jogging |
| 12140 | 9.3 | 15 | Cross-country running |
| 12145 | 10.5 | 16 | Running, Treadmill running |
| 15010 | 4.3 | 17 | Archery |
| 15025 | 9.0 | 17 | Badminton match |
| 15030 | 5.5 | 17 | Badminton |
| 15055 | 7.5 | 17 | Basketball |
| 15100 | 12.3 | 17 | Boxing |
| 15110 | 5.8 | 17 | Punching bag |
| 15120 | 7.8 | 17 | Boxing sparring |
| 15125 | 9.3 | 17 | Shadow boxing |
| 15150 | 4.8 | 18 | Cricket |
| 15240 | 3.0 | 18 | Frisbee |
| 15250 | 8.0 | 18 | Ultimate frisbee |
| 15255 | 4.5 | 18 | Golf |
| 15300 | 3.8 | 18 | Gymnastics |
| 15330 | 8.0 | 18 | Handball |
| 15350 | 7.8 | 18 | Hockey |
| 15430 | 10.3 | 19 | Martial arts |
| 15433 | 11.3 | 19 | Judo |
| 15457 | 7.3 | 19 | Kickboxing |
| 15533 | 8.0 | 19 | Rock climbing |
| 15534 | 8.8 | 19 | Bouldering |
| 15580 | 5.0 | 20 | Skateboarding |
| 15590 | 7.0 | 20 | Roller skating |
| 15591 | 7.5 | 20 | Inline skating |
| 15605 | 9.5 | 20 | Football match |
| 15610 | 7.0 | 20 | Football |
| 15652 | 7.3 | 20 | Squash |
| 15660 | 4.0 | 20 | Table tennis |
| 15670 | 3.3 | 20 | Tai chi |
| 15675 | 6.8 | 20 | Tennis |
| 15685 | 4.5 | 20 | Tennis doubles |
| 15690 | 8.0 | 20 | Tennis singles |
| 15700 | 6.3 | 20 | Trampoline |
| 15710 | 4.0 | 20 | Volleyball |
| 15725 | 8.0 | 20 | Beach volleyball |
| 15730 | 6.0 | 21 | Wrestling |
| 17012 | 7.8 | 21 | Trekking |
| 17018 | 4.5 | 21 | Suitcase carry |
| 17019 | 6.5 | 21 | Farmer's walk, Kettlebell farmer's carry, Overhead carry, Sandbag carry |
| 17035 | 7.0 | 21 | Incline walk |
| 17080 | 6.0 | 22 | Hiking |
| 17110 | 6.5 | 22 | Race walking |
| 17131 | 6.8 | 22 | Stair climbing |
| 17200 | 4.8 | 22 | Brisk walking |
| 17255 | 4.0 | 22 | Walking |
| 17302 | 4.3 | 22 | Nordic walking |
| 17358 | 4.8 | 23 | Treadmill walking |
| 18070 | 3.5 | 23 | Boat rowing |
| 18100 | 5.0 | 23 | Kayaking |
| 18240 | 5.8 | 24 | Freestyle swimming laps |
| 18255 | 4.8 | 24 | Backstroke |
| 18265 | 5.3 | 24 | Breaststroke |
| 18270 | 13.8 | 24 | Butterfly stroke |
| 18310 | 6.0 | 24 | Swimming |
| 18355 | 5.5 | 25 | Water aerobics |
