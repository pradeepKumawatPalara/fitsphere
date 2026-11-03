-- Household units of the food list (D-36): the approved rows of
-- docs/data/household-measures-sheet.csv, loaded by `npm run foods:import` with the food list.
-- Reference data, not personal: no user_id and no change_seq. As in 0001, the table lives in schema
-- `app` with row level security turned on and no policies.

-- The grams one unit of a food holds, of its edible part, as the owner weighed it. A row exists
-- only while its sheet row is approved; it goes with its food when the food leaves the list.
create table app.food_measures (
  source text not null,
  code text not null,
  measure text not null check (measure in ('teaspoon', 'tablespoon', 'katori', 'glass', 'piece')),
  grams numeric(6,2) not null check (grams > 0 and grams <= 1000),
  updated_at timestamptz not null default now(),
  primary key (source, code, measure),
  foreign key (source, code) references app.foods (source, code) on delete cascade
);

alter table app.food_measures enable row level security;
