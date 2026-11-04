-- More foods (docs/plans/more-foods.md; D-39; REQ-LOG-007, REQ-LOG-011; docs/contracts/data-model.md):
-- USDA's FNDDS foods in the food list with their servings, and the user's own saved foods. The
-- rules of 0001 apply: schema `app`, row level security on with no policies, and every insert and
-- update of synced data takes a number from `app.change_seq` for the sync pull.

-- USDA FoodData Central's FNDDS 2021–2023 (public domain, CC0) joins IFCT 2017 in the food list
-- (ADR-0006 rule 1: the source recorded per item).
alter table app.foods drop constraint foods_source_check;
alter table app.foods add constraint foods_source_check check (source in ('ifct2017', 'usda_fndds'));

-- A USDA food's servings, as USDA labels them ("Medium or regular slice"), with their grams as USDA
-- publishes them (the owner's choice, 2026-11-04; unlike the household units of D-36, which the
-- owner measures). Reference data, replaced whole by `foods:import`.
create table app.food_portions (
  source text not null,
  code text not null,
  seq integer not null check (seq between 1 and 99),
  label text not null check (char_length(label) between 1 and 80),
  grams numeric(7,2) not null check (grams > 0 and grams <= 2000),
  primary key (source, code, seq),
  unique (source, code, label),
  foreign key (source, code) references app.foods (source, code) on delete cascade
);

-- The user's own foods, saved to log again (My foods): the user's own and private (D-20), synced
-- like saved meals. Values per 100 g or 100 ml for `g` and `ml`, otherwise per one of the unit.
-- A deleted one keeps only its ID and when it was deleted, so other phones learn of it. Deleted
-- with the account (REQ-ACC-009).
create table app.my_foods (
  user_id uuid not null references app.users (id) on delete cascade,
  id uuid not null,
  name text check (char_length(name) between 1 and 120),
  unit text check (unit in ('g', 'ml', 'piece', 'slice', 'cup', 'katori', 'bowl', 'glass', 'tablespoon', 'teaspoon', 'serving')),
  kcal numeric(7,2) check (kcal >= 0 and kcal <= 2000),
  protein_g numeric(6,2) check (protein_g >= 0 and protein_g <= 200),
  carbs_g numeric(6,2) check (carbs_g >= 0 and carbs_g <= 200),
  fat_g numeric(6,2) check (fat_g >= 0 and fat_g <= 200),
  fibre_g numeric(6,2) check (fibre_g >= 0 and fibre_g <= 200),
  saved_at timestamptz not null,
  deleted_at timestamptz,
  change_seq bigint not null default nextval('app.change_seq'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  check (
    (deleted_at is null and name is not null and unit is not null and kcal is not null and protein_g is not null
      and carbs_g is not null and fat_g is not null)
    or (deleted_at is not null and name is null and unit is null and kcal is null and protein_g is null
        and carbs_g is null and fat_g is null and fibre_g is null)
  )
);

create index my_foods_user_change_seq on app.my_foods (user_id, change_seq);

create trigger my_foods_touch before update on app.my_foods
  for each row execute function app.touch_synced_row();

alter table app.food_portions enable row level security;
alter table app.my_foods enable row level security;
