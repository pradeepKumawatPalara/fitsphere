-- Units from the owner's food database (D-102): its Default Unit and Allowed Units for each food it
-- lists (Indian_Food_Database_CONSOLIDATED (1).xlsx, kept outside the repository), loaded from
-- docs/data/food-units-sheet.csv by `foods:import`. A listed food's units are servings in
-- app.food_portions, as before; a packaged food's go in their own table, beside the one serving its
-- label gives (app.packaged_foods.serving_grams). Each food's page opens on its Default Unit.
-- Numbered 0033: 0031 is kept for another branch's migration.

alter table app.foods
  add column opens_on text check (opens_on is null or char_length(opens_on) between 1 and 80);
alter table app.packaged_foods
  add column opens_on text check (opens_on is null or char_length(opens_on) between 1 and 80);

create table app.packaged_food_portions (
  barcode text not null references app.packaged_foods (barcode) on delete cascade,
  seq integer not null check (seq between 1 and 99),
  label text not null check (char_length(label) between 1 and 80),
  grams numeric(7,2) not null check (grams > 0 and grams <= 2000),
  primary key (barcode, seq),
  unique (barcode, label)
);
alter table app.packaged_food_portions enable row level security;

-- Every serving a food has had, with its grams: rows are added, never removed. A meal logged in a
-- serving whose grams the food list later changes (the owner's database replaces a serving's grams,
-- D-102) can still be saved again, and a saved meal still logged: the sync accepts a serving that is
-- listed now or was before. `source` is a food source, or 'barcode' for a packaged food.
create table app.food_portion_history (
  source text not null,
  code text not null,
  label text not null check (char_length(label) between 1 and 80),
  grams numeric(7,2) not null check (grams > 0 and grams <= 2000),
  primary key (source, code, label, grams)
);
alter table app.food_portion_history enable row level security;

insert into app.food_portion_history (source, code, label, grams)
  select source, code, label, grams from app.food_portions
  on conflict do nothing;
insert into app.food_portion_history (source, code, label, grams)
  select 'barcode', barcode, 'Serving', serving_grams from app.packaged_foods where serving_grams is not null
  on conflict do nothing;

-- One food in a meal may now weigh up to 10,000 g (D-102, was 2,000), so a meal's totals may pass
-- 999,999.99: two more digits. Values already saved are unchanged.
alter table app.meals
  alter column kcal type numeric(10,2),
  alter column protein_g type numeric(10,2),
  alter column carbs_g type numeric(10,2),
  alter column fat_g type numeric(10,2),
  alter column fibre_g type numeric(10,2);
alter table app.saved_meals
  alter column kcal type numeric(10,2),
  alter column protein_g type numeric(10,2),
  alter column carbs_g type numeric(10,2),
  alter column fat_g type numeric(10,2),
  alter column fibre_g type numeric(10,2);
