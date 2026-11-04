-- Indian food data only (D-47; REQ-LOG-007; docs/data/food-list-sources.md): USDA's FNDDS foods
-- leave the food list. They are kept, not served, in two archive tables, so they can come back
-- later. Meals already logged with a USDA food keep it, as each meal holds its own values; a USDA
-- serving in one is checked against the archive. The rules of 0001 apply: schema `app`, row level
-- security on with no policies.
create table app.usda_foods (
  code text primary key check (code ~ '^[0-9]{8}$'),
  name text not null check (name <> ''),
  food_group text not null,
  protein_g numeric(6,2) not null check (protein_g >= 0),
  fibre_g numeric(6,2) not null check (fibre_g >= 0),
  fat_g numeric(6,2) not null check (fat_g >= 0),
  carbs_g numeric(6,2) not null check (carbs_g >= 0),
  kcal numeric(6,2) not null check (kcal >= 0)
);

create table app.usda_food_portions (
  code text not null references app.usda_foods (code) on delete cascade,
  seq integer not null check (seq between 1 and 99),
  label text not null check (char_length(label) between 1 and 80),
  grams numeric(7,2) not null check (grams > 0 and grams <= 2000),
  primary key (code, seq),
  unique (code, label)
);

alter table app.usda_foods enable row level security;
alter table app.usda_food_portions enable row level security;

-- Move what the food list holds; their servings go with them (on delete cascade).
insert into app.usda_foods (code, name, food_group, protein_g, fibre_g, fat_g, carbs_g, kcal)
  select code, name, food_group, protein_g, fibre_g, fat_g, carbs_g, kcal from app.foods where source = 'usda_fndds';
insert into app.usda_food_portions (code, seq, label, grams)
  select code, seq, label, grams from app.food_portions where source = 'usda_fndds';
delete from app.foods where source = 'usda_fndds';

alter table app.foods drop constraint foods_source_check;
alter table app.foods add constraint foods_source_check check (source in ('ifct2017', 'indb'));
