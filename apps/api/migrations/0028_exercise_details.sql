-- The exercise library's details (D-81): the owner's file of 2,090 exercises (D-67) now also gives,
-- for each of its rows (an exercise in one category and sub-group), the primary muscle, the muscles
-- worked, the equipment, the tags for an exercise card, up to three how-to steps, what to watch for
-- and a video's address (blank in the file for now). One row here per row of the library, keyed by
-- the library's row number: an exercise listed in two places keeps each place's own details, as the
-- file writes them (they differ for 22 exercises), and two rows of one place stay two rows.
--
-- Reference data, as app.exercises: loaded from docs/data/exercise-library-details.csv by
-- `npm run exercises:import`, replaced whole with the list, row level security on and no policies.
-- Kept on the server only: GET /v1/exercises does not send them and the phone does not store them.
create table app.exercise_details (
  library_row integer primary key check (library_row > 0),
  exercise_code text not null references app.exercises (code) on delete cascade,
  category text not null check (category <> ''),
  sub_group text check (sub_group <> ''),
  primary_muscle text not null check (primary_muscle <> '' and length(primary_muscle) <= 40),
  muscles_worked text[] not null check (cardinality(muscles_worked) between 1 and 12),
  equipment text not null check (equipment <> '' and length(equipment) <= 40),
  tags text[] not null check (cardinality(tags) between 1 and 12),
  how_to text[] not null check (cardinality(how_to) between 1 and 3),
  watch_for text not null check (watch_for <> '' and length(watch_for) <= 300),
  video_url text check (video_url ~ '^https?://' and length(video_url) <= 500)
);

create index exercise_details_exercise_code on app.exercise_details (exercise_code);

alter table app.exercise_details enable row level security;
