-- Saved meals keep no meal (D-69, REQ-SAVED-003): a saved meal is the user's own name and its
-- foods, logged to whichever meal the user chooses each time. The content rule no longer asks for a
-- meal type; the column stays, unused, and is cleared when a saved meal is saved again or deleted.
-- A deleted saved meal still keeps nothing but its ID and when it was deleted.

do $$
declare
  rule text;
begin
  -- 0004 left the rule unnamed; find it by what it checks.
  select conname into strict rule
    from pg_constraint
   where conrelid = 'app.saved_meals'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) like '%deleted_at%';
  execute format('alter table app.saved_meals drop constraint %I', rule);
end
$$;

alter table app.saved_meals add constraint saved_meals_content check (
  (deleted_at is null and name is not null and items is not null and kcal is not null and protein_g is not null)
  or (deleted_at is not null and name is null and meal_type is null and items is null and kcal is null
      and protein_g is null and carbs_g is null and fat_g is null and fibre_g is null and tags = '{}')
);
