# ADR-0004: Accounts, sign-in, authorization and notifications

- Status: **Accepted** by the project owner on 2026-10-27 under the D-18 pre-approval. The check
  against the requirements, invariants, threat model, D-01 to D-18 and ADR-0001 to ADR-0003
  found only small inconsistencies, which the existing decisions already settled. They were
  fixed in the same change, before acceptance.
- Updated 2026-10-27: the owner's later answers to Q-066 and T-05 (D-18 answers 12 and 13) are
  recorded in "Open questions and handling". The decision is unchanged.
- Date: 2026-10-27
- Decision owner: Project owner
- Related requirements: REQ-ACC-007…010, REQ-ROLE-001…017, REQ-NFR-001, REQ-NFR-005
- Related decisions: C-002, C-008, D-05 (email + password), D-06/D-10/D-11/D-13/D-14/D-15/D-16, D-18 (MVP, pre-approval, coach view); threats T-01, T-04, T-05, T-06, T-07
- Builds on: ADR-0002 (Node API + Supabase), ADR-0003 (PostgreSQL)

## Context
MVP needs email + password accounts with verification and reset; neutral messages that
never reveal whether an email is registered; invitations by email (new users) and in-app
(existing users); push notifications; one in-app Notifications list; server-side
authorization for every request; and account deletion (Google Play requires an in-app
path and a web page to request deletion). One developer, free tiers first.

## Decision criteria
1. **Must:** proven, managed password handling (no home-made password storage).
2. **Must:** every request authorized by the Node API from link and permission data.
3. **Must:** neutral sign-up/reset messages (REQ-ACC-010, T-01).
4. **Must:** emails from FitSphere's own domain with SPF/DKIM/DMARC (D-13).
5. **Should:** free at MVP scale; replaceable later (ADR-0002 growth path).

## Options considered
- **A — Supabase Auth** (already in the stack): email + password, verification and reset;
  issues signed tokens the Node API can verify. Its built-in email sender is limited
  (reported 4 emails/hour, often spam) — production needs a custom email service.
- **B — Firebase Auth:** capable and free at small scale, but adds a second vendor next to
  Supabase.
- **C — Own sign-in code in Node:** full control, but password storage, reset tokens and
  brute-force protection by one developer is high security risk.
- **D — Hosted identity services (e.g. Auth0, Clerk):** strong features; per-user pricing
  at scale; another vendor. Not price-checked here.

## Decision
**Option A — Supabase Auth**, with the rules under "Recommended option". Accepted by the project
owner on 2026-10-27 under the D-18 pre-approval. This answers Q-082 (Resend, from a domain
FitSphere owns) and Q-083 (Expo push).

Accepted while these were still open: Q-049 (Legal), Q-066 (minimum age) and whether sign-up
must use the invited address (T-05). "Open questions and handling" below says how each is
handled. Buying the domain is a paid item that needs the owner's sign-off at purchase (C-008).

## Recommended option
**A — Supabase Auth, with these rules:**
1. **Email:** Supabase sends sign-in emails through a custom email service; FitSphere's
   invitation emails use the same service: **Resend** — free plan 3,000
   emails/month, 100/day, up to 3 domains (checked 2026-10-27). Needs a domain FitSphere
   owns (a paid domain, roughly ₹800–1,500/year — confirm at purchase) with SPF, DKIM and
   DMARC set up.
2. **Neutral messages:** the app always shows the neutral texts from REQ-ACC-010 whatever
   Supabase returns. If testing shows Supabase's responses or timing reveal registration,
   sign-up and reset are routed through the Node API, which returns one identical
   response.
3. **Tokens:** the app stores Supabase session tokens in the phone's secure storage
   (Expo SecureStore). The Node API verifies the token on every request and maps it to
   FitSphere's own user ID (ADR-0002 replaceability). The app calls Supabase Auth only to
   sign up, sign in, reset a password and refresh the session; all app data goes through the
   Node API (ADR-0002). Supabase Auth must keep working with the Data API off (ADR-0002
   validation step 2).
4. **Authorization:** one access module in the Node API decides every read and write from
   the links, Head Coach permissions and the roles the user has turned on, as stored in the
   database (invariant #1). Deny by default. Every API route calls it. A test suite covers
   the permission matrix in the threat model, including the coach view (D-18, Q-059). The
   "active role" in the app only changes the screens; the server checks roles turned on,
   links and permissions, not which role is active (REQ-ROLE-002).
5. **Invitations:** stored in the database; single-use, 7-day expiry (D-13/D-14);
   max 20 per user per day, resends included (Q-073, D-18). New email → email with sign-up
   link; existing user → in-app Notifications list + push. The inviter always sees
   "Invitation sent". The API returns the same response in the same time whichever channel
   is used, for example by sending the email or push after responding (REQ-ROLE-011, T-01).
   - Resend and cancel (Q-073, REQ-ROLE-017): a resend replaces the earlier invitation, whose
     link stops working; a cancelled invitation can no longer be accepted (T-05). There is no
     separate cap on pending invitations; they expire after 7 days (MVP default).
   - The inviter's pending list shows a declined invitation as pending until it expires, so a
     decline does not reveal that the address is registered (REQ-ROLE-011).
6. **Push notifications:** Expo's push service — free, 600 notifications/second per
   project (checked 2026-10-27). Store builds use FitSphere's own credentials — for
   Android, Firebase Cloud Messaging (FCM); confirm in Expo's credentials guide. The
   Notifications list in the database is the record; push is a best-effort alert
   (REQ-ROLE-016).
   - Push text names the sender and the kind of message and carries no health data. The MVP
     sends only invitations, Head Coach permission requests and "no longer linked" messages.
   - Logging out removes that phone's push token from the server (MVP default).
7. **Account deletion (Q-048 default, D-18):** in-app "Delete account" asks the user to
   confirm, then calls the API. The API deletes the user's data from the database and file
   storage, ends all their links (the other side gets the neutral "no longer linked"
   message), and deletes the Supabase account. Only the security logs required by
   REQ-NFR-005 are kept, without health data (Legal to confirm, Q-049). Former coaches' and
   Head Coaches' phones delete the user's data on their next sync (ADR-0007 rule 3).
   - A simple web page explains how to request deletion by email, as Google Play requires.
     The owner acts on an emailed request only after confirming it from the account's
     registered address, and only through the logged admin path (rule 8).
8. **Owner access:** two-factor sign-in on Supabase, Google Cloud, GitHub, Expo and the
   email service. No admin screens in the MVP (Platform Admin is post-MVP — D-13, D-18). The
   logged admin path required by D-16 and REQ-NFR-005 is a small set of owner-only API
   commands, such as deleting an account on an emailed request; each use is written to the
   admin access log. The owner never browses user data in the dashboards (D-16).

## Why alternatives were rejected
B adds a second vendor for the same job; C carries security risk for one developer;
D adds cost and a vendor without an MVP need.

## Counterfactual
If Supabase Auth cannot meet the neutral-message rule even through the Node API, or
sign-in cost at scale becomes the main cost (ADR-0002 stage 3), revisit with B or D.

## Consequences
- Small yearly cost for a domain (owner sign-off at purchase, C-008); email free up to
  100/day — enough for MVP testing, watch it at launch.
- Clear single place for permission logic, testable in isolation.
- Notification text passes through Expo and Google (FCM); it carries no health data (rule 6).

## Validation plan (first slice)
1. Sign-up → verification email arrives (not in spam) from FitSphere's domain.
2. Sign-up and reset with registered vs unregistered emails: same message, similar timing.
3. Token verified by the Node API; expired token rejected. Supabase Auth works with the
   Data API off (shared with ADR-0002 step 2).
4. Permission tests: coach cannot read another coach's trainee; Head Coach cannot read a
   trainee who declined; a trainee cannot change a coach-set target (invariant #2).
5. Push received on an Android phone; none after that phone logs out.
6. Invitations to a registered and an unregistered address: same response, similar timing;
   a cancelled or replaced invitation can no longer be accepted.
7. Account deletion with synthetic data: rows and files gone, links ended, the other side
   gets the message, the sign-in account deleted, the admin log holds no health data.

*D-20 (2026-10-28):* the MVP has no Coach or Head Coach, so steps 4, 5 and 6, and the link part
of step 7, run post-MVP with links, push and invitations (backlog B-18 to B-22). The decision is
unchanged. Step 1's emails from FitSphere's domain run in the MVP's Release slice.

Record each result, with its date, under "Validation results". A failed step that the rules
above cannot fix triggers the revisit conditions; changing the decision needs a new ADR that
supersedes this one.

## Validation results
None yet.

## Revisit conditions
Email volume nears 100/day; neutral-message validation fails; Supabase Auth pricing or
limits change; iOS release (push credentials for Apple).

## Open questions and handling
| Question | Handling |
|---|---|
| Q-082 email service and domain | Answered by this ADR (Resend + owned domain); owner buys the domain (C-008 sign-off) before the Release slice, which sets up Resend for the sign-up and reset emails (D-20; previously "before the invitations slice") |
| Q-083 push service | Answered by this ADR (Expo push; FCM credentials for Android) |
| Q-073 invitation rules | Answered for the MVP (D-18): rule 5 |
| Q-080 unverified accounts, link validity | MVP default (D-18): an account must verify its email before it can sign in; verification and reset links expire within 24 hours (exact value set at setup and recorded under "Validation results") |
| Q-059 which trainee data a coach sees | Answered (D-18): permission matrix in the threat model, enforced by the access module (rule 4) |
| Q-066 minimum age | Answered for the MVP (D-18 answer 12): 18 or older; sign-up requires an "I am 18 or older" confirmation (REQ-ACC-010). Use by people under 18 is post-MVP (backlog B-16; Legal, Q-049) |
| T-05 must sign-up use the invited address? | Answered (D-18 answer 13): an invitation can be accepted only by an account with the invited email address; the API checks this on acceptance (REQ-ROLE-008, REQ-ROLE-009) |
| Q-049 Legal | Does not block development; blocks real users |

## References (checked 2026-10-27)
- Resend pricing: https://resend.com/pricing
- Supabase built-in email limits (secondary): https://makerkit.dev/docs/next-supabase-turbo/going-to-production/authentication
- Expo push FAQ (free, rate limit): https://docs.expo.dev/push-notifications/faq/
- Google Play account deletion requirement: https://support.google.com/googleplay/android-developer/answer/13327111
