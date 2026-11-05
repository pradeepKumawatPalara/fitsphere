-- The exercise list (D-50; docs/plans/exercise-list.md): FitSphere's own list of exercises, each with
-- the group shown beside it, how it is logged and, when the 2024 Adult Compendium of Physical
-- Activities lists the activity, the Compendium's code and MET, unchanged, for estimating calories
-- burned (docs/data/exercise-list-sources.md). Reference data, not personal: no user_id and no
-- change_seq. As in 0001, schema `app`, row level security on and no policies.

-- Loaded from data/exercises/exercise-list.csv by `npm run exercises:import`. Workouts keep each
-- exercise's name, not a link to this list, so changing the list never changes a saved workout.
create table app.exercises (
  code text primary key check (code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (name <> '' and length(name) <= 80),
  exercise_group text not null check (
    exercise_group in ('barbell', 'dumbbell', 'kettlebell', 'machine', 'cable', 'bodyweight', 'band', 'cardio', 'sport', 'yoga', 'other')
  ),
  log_type text not null check (
    log_type in ('weight_reps', 'reps', 'time', 'weight_time', 'distance_time', 'treadmill', 'cardio_machine', 'time_only')
  ),
  aliases text[] not null default '{}',
  compendium_code text check (compendium_code ~ '^[0-9]{5}$'),
  met numeric(4,1) check (met > 0),
  updated_at timestamptz not null default now(),
  check ((compendium_code is null) = (met is null))
);

alter table app.exercises enable row level security;
