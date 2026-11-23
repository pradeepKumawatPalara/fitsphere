-- How long one rep takes (docs/plans/exercise-time-per-rep.md): the phone fills an exercise's time from
-- its reps, so the time and the calories burned grow as sets and reps are added. One value per type of
-- exercise, from data/exercises/type-times.csv by `npm run exercises:import`; rest is not counted. Only
-- the types done in reps have one (weights and bodyweight); the others are null. The workouts are not
-- touched: the time is saved in the field they already have.
alter table app.exercises
  add column seconds_per_rep smallint check (seconds_per_rep is null or seconds_per_rep between 1 and 30);
