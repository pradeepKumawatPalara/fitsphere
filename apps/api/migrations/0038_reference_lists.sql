-- The food and exercise lists' versions, kept in the database (D-126, docs/plans/reference-list-egress.md).
-- GET /v1/foods and GET /v1/exercises used to read every row of their tables to work out the list's
-- version, even when the phone's copy was current: about 5.5 MB from the database on every sync, 11 GB
-- of Supabase egress in a month. Now a route reads this one row first, and reads the tables only when
-- the phone is behind.
--
-- `generation` goes up by one, and `version` is cleared, whenever any table of the list changes:
-- foods:import, exercises:import, a migration or an edit in the dashboard alike (the triggers below).
-- `version` is the hash the phone receives (the same as before D-126), written back by the API once it
-- has read the list for that generation; null until then.
--
-- Reference data, not personal: no user_id and no change_seq. The rules of 0001 apply: schema `app`,
-- row level security on with no policies.
create table app.reference_lists (
  name text primary key check (name in ('foods', 'exercises')),
  generation bigint not null default 1 check (generation >= 1),
  version text check (version is null or char_length(version) between 1 and 64)
);

alter table app.reference_lists enable row level security;

insert into app.reference_lists (name) values ('foods'), ('exercises');

-- The list named by the trigger's argument has changed.
create function app.reference_list_changed() returns trigger
language plpgsql as $$
begin
  update app.reference_lists set generation = generation + 1, version = null where name = tg_argv[0];
  return null;
end;
$$;

-- Once per statement, even one that changes no row: a list read again for nothing costs one read, a
-- change missed would leave phones with old values. Every table the route reads, and only those: the
-- USDA archive and food_portion_history never reach the phone.
create trigger reference_list_changed after insert or update or delete or truncate on app.foods
  for each statement execute function app.reference_list_changed('foods');
create trigger reference_list_changed after insert or update or delete or truncate on app.dishes
  for each statement execute function app.reference_list_changed('foods');
create trigger reference_list_changed after insert or update or delete or truncate on app.food_measures
  for each statement execute function app.reference_list_changed('foods');
create trigger reference_list_changed after insert or update or delete or truncate on app.food_portions
  for each statement execute function app.reference_list_changed('foods');
create trigger reference_list_changed after insert or update or delete or truncate on app.packaged_foods
  for each statement execute function app.reference_list_changed('foods');
create trigger reference_list_changed after insert or update or delete or truncate on app.packaged_food_portions
  for each statement execute function app.reference_list_changed('foods');

create trigger reference_list_changed after insert or update or delete or truncate on app.exercises
  for each statement execute function app.reference_list_changed('exercises');
create trigger reference_list_changed after insert or update or delete or truncate on app.exercise_speed_mets
  for each statement execute function app.reference_list_changed('exercises');
create trigger reference_list_changed after insert or update or delete or truncate on app.exercise_details
  for each statement execute function app.reference_list_changed('exercises');
