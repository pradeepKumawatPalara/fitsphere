# Profile plan

- Status: **Accepted** (the owner, in chat, 2026-11-03: "approve lock it"; the screens 6.1 and 6.6
  locked at the same time)
- Owner: Project owner (D-01)
- Last updated: 2026-11-03
- Builds on: the Settings slice ([`settings-slice.md`](settings-slice.md), D-31); the meal photo
  pipeline (REQ-LOG-006, migration 0005); ADR-0002, ADR-0004, ADR-0007; the redesign's 6.1
  ([`ui-redesign.md`](ui-redesign.md))

The owner asked for the user's basic details in Settings: name, photo, address, sex, age, height,
weight, phone number and email, with the server side to keep them. No requirement covers a profile
today, and some of this is new personal data, so this plan proposes a new requirement and lists
what Legal must review.

## The owner's answers (2026-11-03)
1. **Email:** shown in the profile, read-only. Changing the sign-in email stays out of the MVP
   (data model, `users.email`), as it is the account's identity for sign-in, password reset and
   invitations.
2. **Age:** the date of birth is stored; the age is worked out from it.
3. **Weight:** the latest weigh-in. The profile shows it, and changing it logs today's weigh-in
   with the existing entry sheet, so Home, Progress and the profile always agree (invariant 6).
4. **Address and phone:** collected, both optional and marked so; private to the user, never shown
   to anyone else or sent to another service, and deleted with the account. Legal's review (Q-049)
   must cover them before real users.

## Scope (proposed REQ-ACC-011, Profile)
| Field | Rule (MVP defaults, D-18) |
|---|---|
| Photo | Optional. Taken or chosen, cropped square and shrunk on the phone, as a meal photo is |
| Name | Optional, 1 to 60 characters. The header's "Hi, …" uses its first word; without one it stays the email's name, as today |
| Date of birth | Optional. Day, month and year; the age it gives must be 18 or more (REQ-ACC-010) and at most 120. The profile shows "Age N" |
| Sex | Optional: Female, Male, Other, or Prefer not to say |
| Height | Optional, 100 to 250 cm, stored in millimetres (invariant 6); shown and typed in cm, or in inches when the measurements' choice is inches |
| Weight | The latest weigh-in, with its date; "Log today's weight" opens the weight entry sheet (REQ-HOME-006) |
| Phone number | Optional. A 10-digit Indian mobile number (phase 1 serves India only, invariant 5), stored as +91 and the 10 digits; not verified |
| Address | Optional: line 1, line 2 (optional), city, state and a 6-digit PIN code. Either empty, or line 1, city, state and PIN all given |
| Email | The sign-in email, read-only: "Your sign-in email can't be changed yet." |

Where: Settings opens with a Profile card (the photo, the name and the email) and "Edit profile",
which opens a Profile screen; the Account section keeps Your targets, Change password, Log out and
Delete account. The header's avatar shows the photo when there is one.

Not in this plan: changing the email; verifying the phone; showing any of it to a coach (no coaches
in the MVP, D-20); using the details for anything else, such as calorie suggestions.

## Data and API
- **Migration 0010:** `app.profiles`, one row per user (`user_id`, the fields above, the photo's
  media ID, `set_at`, `updated_at`, `change_seq`), row level security on with no policies, deleted
  with the user. `app.media` gains `kind` (`meal` or `profile`), and `meal_id` is required only for
  meal photos.
- **Sync:** a new change type, `profile.set`, carries the whole profile; the change received last
  wins (ADR-0007 rule 2). The server checks every field again and refuses a date of birth under 18.
  The pull returns the profile. Self-access only (D-20): no route reads another user's profile.
- **Photo:** the meal photo routes (upload and viewing links), for a media ID of kind `profile`;
  the files go to the same private bucket, `meal-photos`, so no new storage set-up is needed. A
  replaced or removed photo is deleted from storage, as a meal's is.
- **Delete account** (REQ-ACC-009): deletes the profile and its photo; the account deletion page and
  the delete screen's list add "your profile".
- **Logs:** no profile value is ever logged (invariant 7).

## Phone
- Schema version 9: a `profile` table; the photo in the encrypted photo cache (ADR-0007 rule 5).
  Editing works offline and syncs; a new photo uploads once online, as a meal photo does.
- Screens: the Settings card; the Profile screen; the header's greeting and avatar.

## Privacy (needs Legal, Q-049)
- New data: name, photo, date of birth, sex, height, phone and address. Date of birth, sex and
  height are body data, treated as health data (invariant 7, REQ-NFR-002); address and phone are
  contact data.
- Updated with this plan: the data and threat model's data categories, Legal's brief and evidence
  checklist, the account deletion page, and the privacy notice's list (when it is written).

## Steps
1. Server: the contract, migration 0010, the sync type and pull, media kinds, deletion. Tests.
2. Phone: schema version 9, the Profile screen, the Settings card, the header. Tests.
3. Docs: REQ-ACC-011, data model, API conventions, threat model, Legal's brief, the deletion page.

## Tests
- Shared: every field's rule, the under-18 refusal, the address all-or-nothing rule.
- API (integration): `profile.set` accepted and pulled; refused when invalid; only the user's own;
  the photo of kind `profile`; deleting the account removes the profile and its photo; migrations
  and the row level security list.
- Phone: the version 9 upgrade; the Profile screen saves offline and syncs; each problem under its
  field; the greeting and avatar use the profile; the weight row logs today's weigh-in.

## Progress
Built on branch `ui-redesign` (not pushed), 2026-11-03 to 2026-11-04, as D-38:
- Step 1, the server: the contract (`profileSetDataSchema`, `isAcceptedDateOfBirth`), migration
  0010, `profile.set` and the pull's `profiles`, media kinds, deletion. Shared and API
  (integration) tests pass.
- Step 2, the phone: schema version 9, the Profile screen, the Settings card, the header's
  greeting and avatar, "Your profile" among refused changes. Mobile tests pass.
- Step 3, the docs: REQ-ACC-011, the data model, API conventions, the threat model, Legal's brief
  (L-07a), the deletion page, the MVP defaults.

## Owner's steps
- ~~Approve this plan and lock the screens~~ (done, 2026-11-03).
- On `fitsphere-dev`, only when the owner says so: migration 0010 **before** running the updated
  API (until then the sync fails, as with 0008 on 2026-11-02).
- Check on the phone: no new development build is needed (no native code changed).

## Risks
- Collecting contact data the app does not use yet (data minimisation); accepted by the owner,
  pending Legal (Q-049).
- The photo pipeline changes for meals too (media kinds); covered by the existing meal photo tests.
