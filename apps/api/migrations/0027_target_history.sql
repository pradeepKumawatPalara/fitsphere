-- Targets by date (D-77, answering Q-014; REQ-ROLE-007, REQ-ROLE-018): each target value holds
-- from its IST day on, until the next value of that kind, so a change no longer rewrites the days
-- before it, and the values kept make the user's target history. `day` is the IST day the value
-- starts, the day it was set on the phone, kept as its own field (invariant 5).
--
-- The rows already here are the only values ever kept (D-23 kept one per kind): each starts on the
-- IST day its user's account was created, so every day shown keeps the target it showed before
-- (the owner's answer, 2026-11-11). One row per user, kind and day: a second change on the same day
-- replaces that day's value.

alter table app.targets add column day date;

update app.targets
   set day = (users.created_at at time zone 'Asia/Kolkata')::date
  from app.users
 where users.id = targets.user_id;

alter table app.targets alter column day set not null;

-- 0002 left the one-per-kind rule unnamed; it is found by its columns and dropped.
do $$
declare
  rule text;
begin
  for rule in
    select conname
      from pg_constraint
     where conrelid = 'app.targets'::regclass
       and contype = 'u'
       and pg_get_constraintdef(oid) = 'UNIQUE (user_id, kind)'
  loop
    execute format('alter table app.targets drop constraint %I', rule);
  end loop;
end
$$;

alter table app.targets add constraint targets_user_kind_day unique (user_id, kind, day);
