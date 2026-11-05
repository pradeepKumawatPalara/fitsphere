-- Speed bands for the exercise list (D-50; the owner, 2026-11-05: "a person who works faster will burn
-- calories more"): for running, walking and cycling, the 2024 Adult Compendium of Physical Activities'
-- activities by speed, each with its MET unchanged (docs/data/exercise-list-sources.md). The phone
-- estimates calories with the band starting at the highest speed at or below the exercise's speed,
-- and with the exercise's own MET when its speed is not known. Reference data, as app.exercises:
-- loaded from data/exercises/speed-mets.csv by `npm run exercises:import`, row level security on and
-- no policies.
create table app.exercise_speed_mets (
  exercise_code text not null references app.exercises (code) on delete cascade,
  from_kmh numeric(4,1) not null check (from_kmh >= 0),
  compendium_code text not null check (compendium_code ~ '^[0-9]{5}$'),
  met numeric(4,1) not null check (met > 0),
  primary key (exercise_code, from_kmh)
);

alter table app.exercise_speed_mets enable row level security;
