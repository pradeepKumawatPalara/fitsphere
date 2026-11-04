-- The user's profile and profile photos (REQ-ACC-011; docs/plans/user-profile.md;
-- docs/contracts/data-model.md). The rules of 0001 apply: schema `app`, row level security on with
-- no policies, and every insert and update of synced data takes a number from `app.change_seq` for
-- the sync pull.

-- The user's own basic details, one row per user, synced like settings (the change received last
-- wins). Every field is optional. Private to the user: never seen by a coach or Head Coach in the
-- MVP (D-20), never logged (invariant #7), deleted with the account (REQ-ACC-009). The date of
-- birth, sex and height are body data, treated as health data; the phone and the address are
-- contact data (Legal reviews both, Q-049). The height is in whole millimetres (invariant #6); the
-- weight is not here, being the latest weigh-in. The API checks the age a date of birth gives
-- (18 to 120, REQ-ACC-010), as it depends on today.
create table app.profiles (
  user_id uuid primary key references app.users (id) on delete cascade,
  name text check (char_length(name) between 1 and 60),
  date_of_birth date,
  sex text check (sex in ('female', 'male', 'other', 'prefer_not_to_say')),
  height_mm integer check (height_mm between 1000 and 2500),
  phone text check (phone ~ '^\+91[6-9][0-9]{9}$'),
  address_line1 text check (char_length(address_line1) between 1 and 100),
  address_line2 text check (char_length(address_line2) between 1 and 100),
  city text check (char_length(city) between 1 and 60),
  state text check (char_length(state) between 1 and 60),
  pin_code text check (pin_code ~ '^[0-9]{6}$'),
  -- The profile photo's row in app.media, of kind 'profile'.
  photo_media_id uuid,
  set_at timestamptz not null,
  change_seq bigint not null default nextval('app.change_seq'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- An address is empty, or has line 1, the city, the state and the PIN code.
  check (
    (address_line1 is null and address_line2 is null and city is null and state is null and pin_code is null)
    or (address_line1 is not null and city is not null and state is not null and pin_code is not null)
  )
);

create trigger profiles_touch before update on app.profiles
  for each row execute function app.touch_synced_row();

alter table app.profiles enable row level security;

-- A photo is now a meal's or the profile's. Profile photos use the same private bucket and links
-- (ADR-0002 rules 1–5); only a meal photo names its meal. Every existing row is a meal photo.
alter table app.media add column kind text not null default 'meal' check (kind in ('meal', 'profile'));
alter table app.media alter column kind drop default;
alter table app.media alter column meal_id drop not null;
alter table app.media add constraint media_meal_photo_has_meal check ((kind = 'meal') = (meal_id is not null));
