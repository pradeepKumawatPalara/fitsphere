-- The workout timer (D-71, REQ-TRN-003; docs/plans/workout-timer.md). "Start workout" starts a
-- timer on a workout of today; it can be paused and resumed, and marked done. A workout keeps it in
-- four columns, all empty until the timer is started:
--   timer_started_at       when "Start workout" was first tapped (UTC);
--   timer_counted_seconds  the time counted before the current run, 0 to 24 hours;
--   timer_running_since    while it runs, when it was last started or resumed (UTC);
--   timer_done_at          once it is marked done, when (UTC).
-- It runs, is paused or is done, never running and done at once. A deleted workout keeps no timer,
-- as it keeps no exercises (0007). The values are checked by the API too (packages/shared).

alter table app.workouts
  add column timer_started_at timestamptz,
  add column timer_counted_seconds integer,
  add column timer_running_since timestamptz,
  add column timer_done_at timestamptz;

alter table app.workouts add constraint workouts_timer check (
  (timer_started_at is null and timer_counted_seconds is null and timer_running_since is null and timer_done_at is null)
  or (
    timer_started_at is not null
    and timer_counted_seconds between 0 and 86400
    and (timer_running_since is null or timer_done_at is null)
  )
);

alter table app.workouts add constraint workouts_deleted_no_timer check (
  deleted_at is null or timer_started_at is null
);
