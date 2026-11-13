-- The ranges the owner set on 2026-11-13 (D-100). The API checks the same ranges, and the text rules
-- the database does not repeat (a name's letters, a PIN code's first digit), in packages/shared.
-- Numbered 0032: 0031 is kept for another branch's migration.

-- A person's height may be 50 to 300 cm ("Person Heght can be from 50 CM to 300 cm."), in place of
-- 100 to 250 cm (D-38). Still whole millimetres (invariant #6), or null.
alter table app.profiles drop constraint profiles_height_mm_check;
alter table app.profiles add constraint profiles_height_mm_check check (height_mm between 500 and 3000);

-- A day's steps may be 1 to 200,000 ("steps range should be: 1 to 200000"), in place of 0 to 100,000
-- (Q-028). A day already saved with 0 steps stays: the new check holds for what is saved from now on.
alter table app.step_counts drop constraint step_counts_steps_check;
alter table app.step_counts add constraint step_counts_steps_check check (steps between 1 and 200000) not valid;

-- The daily targets ("caloroies range 0 to 10000, Protein range o to 500g, carbs 0 to 1000, [fat] 0 to
-- 1000, fiber 0 to 200, steps 0 to 200000"): each may be 0; fat up to 1,000 g, fibre up to 200 g,
-- steps up to 200,000. Weekly workouts and body weight are as 0024 set them.
alter table app.targets drop constraint targets_value;
alter table app.targets add constraint targets_value check (
  (kind = 'calories' and value between 0 and 10000)
  or (kind = 'protein' and value between 0 and 500)
  or (kind = 'steps' and value between 0 and 200000)
  or (kind = 'weekly_workouts' and value between 1 and 14)
  or (kind = 'body_weight' and value between 20000 and 300000)
  or (kind = 'carbs' and value between 0 and 1000)
  or (kind = 'fat' and value between 0 and 1000)
  or (kind = 'fibre' and value between 0 and 200)
);
