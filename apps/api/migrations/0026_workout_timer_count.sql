-- The workout timer (D-71): a timer once started always has its count. 0025's rule let a timer with
-- a start and no count through, since a check whose value is null passes; this rule names it.
-- Nothing the API sends breaks it (the count is required in `workout.set`), so every stored row
-- already follows it.

alter table app.workouts drop constraint workouts_timer;

alter table app.workouts add constraint workouts_timer check (
  (timer_started_at is null and timer_counted_seconds is null and timer_running_since is null and timer_done_at is null)
  or (
    timer_started_at is not null
    and timer_counted_seconds is not null
    and timer_counted_seconds between 0 and 86400
    and (timer_running_since is null or timer_done_at is null)
  )
);
