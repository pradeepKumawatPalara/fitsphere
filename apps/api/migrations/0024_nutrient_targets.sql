-- Daily carbs, fat and fibre targets (D-70, REQ-ROLE-007): three more kinds of the user's own
-- target, in whole grams, shown against what was eaten on the Insight page (REQ-NUT-005). 0002 left
-- the two checks on app.targets unnamed (the kinds, and each kind's range); they are found by what
-- they check, dropped, and added again, named, with the new kinds. Nothing else changes.

do $$
declare
  rule text;
begin
  for rule in
    select conname
      from pg_constraint
     where conrelid = 'app.targets'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) like '%calories%'
  loop
    execute format('alter table app.targets drop constraint %I', rule);
  end loop;
end
$$;

alter table app.targets add constraint targets_kind check (
  kind in ('calories', 'protein', 'steps', 'weekly_workouts', 'body_weight', 'carbs', 'fat', 'fibre')
);

-- kcal, grams of protein, steps, workouts a week, body weight in grams (D-23); grams of carbs, fat
-- and fibre (D-70).
alter table app.targets add constraint targets_value check (
  (kind = 'calories' and value between 500 and 10000)
  or (kind = 'protein' and value between 10 and 500)
  or (kind = 'steps' and value between 1 and 100000)
  or (kind = 'weekly_workouts' and value between 1 and 14)
  or (kind = 'body_weight' and value between 20000 and 300000)
  or (kind = 'carbs' and value between 10 and 1000)
  or (kind = 'fat' and value between 5 and 500)
  or (kind = 'fibre' and value between 5 and 100)
);
