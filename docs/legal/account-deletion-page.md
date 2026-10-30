# Account deletion page (draft)

- Status: **Draft**: the text of the public web page that explains how to delete a FitSphere
  account and how to ask for deletion by email, as Google Play requires (REQ-ACC-009; Q-048 MVP
  default, D-18). Not published.
- Owner: Project owner (D-01); reviewed by Legal (Q-049, L-04)
- Last updated: 2026-10-30 (Settings slice, step 2; D-S1)

## Before it is published
The parts in [square brackets] are not decided yet. Nothing in them may be filled in by guessing.
- [ ] The developer name exactly as the Google Play listing shows it.
- [ ] The deletion email address, at FitSphere's own domain (the same domain as the sign-up
      emails, D-20).
- [ ] How long an emailed request takes to handle.
- [ ] What is kept after deletion, and for how long. The documented proposal is the admin access
      log's entries about the account, without health data, for 1 year (REQ-NFR-005, D-14). Legal
      confirms it (Q-049).
- [ ] Whether FitSphere still has no backups at release (R-005); the sentence about backups is
      removed or changed if that changes.
- [ ] Slice 7 (AI meal reading): what the AI provider keeps of what was sent to it, if anything
      (ADR-0005; Legal, Q-049).
- [ ] The owner's logged path for acting on an emailed request is built (release-blocking task
      RB-S1). Until then no emailed request can be handled as ADR-0004 rule 8 requires.
- [ ] Legal's review (Q-049, L-04), then the page is published at a public address, and that
      address is entered in the Google Play listing.

---

## Page text

# Delete your FitSphere account

FitSphere is a fitness app by [developer name as shown on Google Play].

## Delete your account in the app
1. Open FitSphere and sign in.
2. Tap your initial at the top right of the screen to open **Settings**.
3. Tap **Delete account**, read what will be deleted, and confirm.

Your account and your data are deleted straight away. You need an internet connection.

## Ask us by email
If you cannot use the app, email [deletion address] from the email address you use to sign in to
FitSphere, with the subject "Delete my account". We reply to that address to check that the request
is yours before we delete anything, and we tell you when it is done. [We handle requests within
[time].]

## What is deleted
- Your sign-in account: your email address and password.
- Everything you logged in FitSphere: weights, steps, sleep, body measurements, meals and their
  photos, saved meals, workouts and targets.
- Your settings, and every record of your choices about AI meal reading.

When you delete your account in the app, the copy on your phone is deleted too. If you asked by
email, log out of the app or uninstall it to remove the copy on your phone.

[FitSphere keeps no backups, so deleted data cannot be restored.]

## What is kept
[What is kept, and for how long, as confirmed by the owner and Legal. Proposed: records of any
access to your account by FitSphere's operator, with no health data, for 1 year.]
