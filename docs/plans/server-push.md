# Plan: server push notifications (a later step after the phone-only notifications)

- Status: **Draft, kept as a plan only (2026-11-24). Nothing is built; no code has changed.** Waiting for the owner's answers below.
- Owner: Project owner (D-01)
- Follows: `docs/plans/notifications.md` (the phone-only list and local notifications, built) and ADR-0014 (Proposed).
- Extends: ADR-0004 rule 6 (Expo's push service for server-sent push), backlog B-22 and B-23, REQ-ROLE-016.
- Wanted by the owner: a push that arrives on the phone when something happens elsewhere, as a message does ("whenever a new message arrives"), even when the app is closed.

## Why it is separate
The phone-only version needs only the phone's clock and logs. A push that arrives from outside needs the server and an
event to trigger it. The client app has no messaging, coach or community (D-20); those come from the Coach view, built by
another team on the same database (D-90). So the first thing to settle is which events send a push.

## Open questions (the owner)
- **Q-S1: Which events send a push?** For example: a message from a coach, a coach changing a target or plan, an invitation or link request (REQ-ROLE-016), a server-side event of the user's own. Until answered, nothing can be built.
- **Q-S2:** Who sends them: this API, or the Coach team's application through this API?
- **Q-S3:** Does the push carry any text from the event (a message body), or only "You have a new message"? (Lock screens can be read by others; the local ones carry no health values, REQ-NOT-006.)
- **Q-S4:** Is the in-app list the record for these too (the list's `source` field is `server` for them)?
- **Q-S5:** The Firebase project for Android (`com.fitsphere.app`) and its FCM key in EAS: who creates it? The iPhone needs Apple's push key with the Apple Developer Program (D-104).
- **Q-S6:** Timing: with the release, or after?

## What would be built (once Q-S1 is answered)
**Server (this API):**
1. A table for each phone's push token: user, token, platform, created, last seen; one user may have several phones. Migration with `on delete cascade` from the user.
2. `POST /v1/push-tokens` to register or refresh a token, and `DELETE` to remove it (on logout, token cleanup when Expo reports a dead token). Authorization: a user's own tokens only (invariant #1).
3. A sender module: takes an event and a user, checks that user's per-type switches (the same switches as the phone's settings, kept on the server for these kinds), calls Expo's push service, records the result, removes tokens Expo says are invalid. Never logs the text or the token.
4. The events' triggers (Q-S1). Timed sends would need Cloud Scheduler or similar (a new paid service, C-008).
5. A deploy of the API to Cloud Run before beta phones can receive anything (the owner's word).

**Phone:**
6. After the phone's permission (already asked in context by the local version), get the Expo push token and send it to the server; send it again when it changes; remove it on sign-out.
7. A notification that arrives with the app open or closed is shown and a tap opens its route (the local version already does this); the server's rows join the same list with `source = server`.
8. A new development build (D-19: tell the owner first).

**Accounts and documents:**
9. Firebase project and FCM V1 key uploaded to EAS (B-23); Apple's push key for the iPhone.
10. A replacement or extension of ADR-0014 choosing Option B for these kinds; updates to ADR-0004's validation step, the data and threat model, and `constraints-and-assumptions.md`.
11. Legal's review (Q-049): the token, and the event data passing through Expo and Google (FCM).

## Requirements to propose (after Q-S1)
- REQ-NOT-008 A push arrives for the chosen events, with the app closed.
- REQ-NOT-009 A user's push token is stored for that user only and removed on sign-out and when invalid.
- REQ-NOT-010 Per-type switches and quiet hours apply to server pushes too.

## Tests (planned)
- Token registration and removal, and that no other user's token is read or sent to (authorization).
- The sender with a fake Expo service: a send per phone, an invalid token removed, the user's switch off sends nothing, quiet hours.
- Text rules: nothing sensitive in any push body (snapshot of every template).
- Phone checks on the new build: a push arrives with the app closed, a tap opens the screen, after sign-out none arrives, with permission refused none arrives.

## Risks
- Expo's push service and Firebase are third parties that see that a push was sent, and the text if any (Q-S3).
- Delivery is best effort; battery savers on some phones still delay it.
- The Coach team's events are theirs: this plan only supplies the way to send, not the events.
