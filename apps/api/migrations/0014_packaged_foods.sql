-- Packaged foods sold in India, from Open Food Facts' data (D-48; ADR-0009; REQ-LOG-007;
-- docs/data/food-list-sources.md): searchable by name and brand, kept in their own table, apart from
-- FitSphere's food list, as ADR-0006 rule 2 keeps Open Food Facts' data apart (the ODbL share-alike
-- duty stays with it; Legal to confirm, Q-049). Replaced whole by `foods:import`. Reference data, not
-- personal: no user_id and no change_seq. The rules of 0001 apply: schema `app`, row level security
-- on with no policies.
create table app.packaged_foods (
  barcode text primary key check (barcode ~ '^[0-9]{8,14}$'),
  name text not null check (char_length(name) between 1 and 120),
  brand text check (brand is null or char_length(brand) between 1 and 80),
  -- Per 100 g, as the label gives them (per 100 ml for a drink, taken as 100 g).
  kcal numeric(6,2) not null check (kcal >= 0 and kcal <= 1000),
  protein_g numeric(6,2) not null check (protein_g >= 0 and protein_g <= 100),
  carbs_g numeric(6,2) not null check (carbs_g >= 0 and carbs_g <= 100),
  fat_g numeric(6,2) not null check (fat_g >= 0 and fat_g <= 100),
  fibre_g numeric(6,2) check (fibre_g is null or (fibre_g >= 0 and fibre_g <= 100)),
  -- One serving, when the label gives it in grams.
  serving_grams numeric(7,2) check (serving_grams is null or (serving_grams > 0 and serving_grams <= 2000))
);

alter table app.packaged_foods enable row level security;
