# Error Model

- Status: Draft — written for the Skeleton slice
- Owner: Project owner (D-01)
- Last updated: 2026-10-30 (Settings slice, step 3: rejected-change text for settings; D-31).
  2026-10-29 (Training slice: rejected-change text for workouts; D-29). 2026-10-29
  (Home and daily tracking slice: rejected-change texts for steps, sleep, measurements and targets;
  D-23). 2026-10-28 (Skeleton step 5: `details` is `null` outside
  `VALIDATION_FAILED`)
- Builds on: [`api-conventions.md`](api-conventions.md); invariants #1 and #7; REQ-ACC-010, REQ-NFR-001, REQ-NFR-004

One error shape for the whole API, a fixed list of codes, and the rules for what an error may
say. Codes are stable: the app decides what to do from the code, never from the message.

## Error shape
Every error response has this body:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Some fields are not valid.",
    "retryable": false,
    "requestId": "8b0e7c1e-3f0a-4a51-9c39-2f0d5d7b6a10",
    "details": [
      { "field": "changes[0].data.weightGrams", "issue": "out_of_range" }
    ]
  }
}
```

| Field | Rules |
|---|---|
| `code` | One of the codes below. Upper case with underscores |
| `message` | Short, safe English text the app may show. Never contains health data, email addresses, tokens, SQL, stack traces or internal names |
| `retryable` | `true` only when sending the same request again later can succeed |
| `requestId` | The same value as the `X-Request-Id` response header; ties the error to the server log |
| `details` | Only for `VALIDATION_FAILED`: the field path and an issue name (`required`, `invalid_format`, `out_of_range`, `unknown_field`, `too_many`). Never the submitted value. `null` for every other code, and for a body that is not JSON |

## What errors may reveal
- **Another person's data:** when the caller may not see a person or their data, the API answers
  `404 NOT_FOUND`, exactly as for an ID that does not exist. A caller cannot tell "exists but not
  allowed" from "does not exist" (invariant #1, T-01).
- **Whether an email address is registered:** never, in any message (REQ-ACC-010, D-11). Sign-up
  and password reset go to Supabase Auth, and the app shows the neutral texts below whatever
  Supabase returns (ADR-0004 rule 2).
- **Values:** errors name the field, never the value that was sent (invariant #7).
- **Internals:** unexpected failures return `INTERNAL_ERROR` with a generic message; the detail
  goes only to the server log, without health data.

## Codes

### Whole-request errors
| HTTP | Code | When | Retryable | What the app does |
|---|---|---|---|---|
| 400 | `VALIDATION_FAILED` | The request is malformed: wrong types, missing or unknown fields, a body that is not JSON | No | Fix the request; this is a bug if it happens in the app |
| 400 | `AGE_CONFIRMATION_REQUIRED` | Account setup without `ageConfirmed: true` (REQ-ACC-010) | No | Show the "I am 18 or older" step |
| 401 | `AUTH_REQUIRED` | No token, or the token is invalid, expired, for another project or audience, or anonymous. The response also carries `WWW-Authenticate: Bearer` | No | Refresh the session once and retry; if it fails again, go to sign-in |
| 403 | `ACCOUNT_SETUP_REQUIRED` | Signed in, but the FitSphere account is not set up yet | No | Run account setup (`POST /v1/me`) |
| 403 | `EMAIL_NOT_VERIFIED` | Account setup while Supabase Auth does not show the email as confirmed (Q-080) | No | Ask the user to verify their email |
| 403 | `ROLE_NOT_ENABLED` | The caller's own function needs a role they have not turned on, e.g. logging weight without the Personal Training User role (REQ-ROLE-002) | No | Offer to turn the role on |
| 404 | `NOT_FOUND` | The resource does not exist, **or the caller may not see it** | No | Show "Not available" |
| 413 | `PAYLOAD_TOO_LARGE` | Body over the size limit, or more than 100 changes in one sync | No | Send smaller batches |
| 429 | `RATE_LIMITED` | Too many requests (reserved; not used in the Skeleton) | Yes, after `Retry-After` | Wait and retry |
| 500 | `INTERNAL_ERROR` | Unexpected server failure | Yes | Keep queued changes; retry later |
| 503 | `SERVICE_UNAVAILABLE` | The database cannot be reached, e.g. the Supabase project is paused ([runbook](../operations/runbook.md#supabase-project-paused)) | Yes | Keep queued changes; retry later |

### Errors for one sync change
The sync endpoint answers `200` with a result for each change (ADR-0007). A change that cannot be
applied gets `status: "rejected"` and one of these codes. They are never retryable as they are:
the phone keeps a rejected change to the user's own data for the user to fix or discard, and
never removes it automatically (ADR-0007 rule 2, D-14).

| Code | When |
|---|---|
| `VALIDATION_FAILED` | The change's data is invalid, e.g. a weight outside 20–300 kg (Q-028), a malformed day, a missing waist value, a target outside its range, a workout with more than 30 exercises, or an unknown field |
| `DAY_IN_FUTURE` | The day is later than today in IST by the server's clock (REQ-DATE-001, Q-017, invariant #5). Not used for targets, which have no day |
| `ROLE_NOT_ENABLED` | The change needs a role the user has not turned on |
| `NOT_ALLOWED` | The user may not change this data, e.g. the link it depended on has ended (T-02). Not reachable in the Skeleton, where users write only their own data |
| `UNKNOWN_CHANGE_TYPE` | The server does not know the change `type` |

A rejected change's `error` is `{ "code", "message", "details" }`, with `details` always `null`,
so a change sent again gets exactly the same reply (api-conventions, "Once only").

`401`, `403 ACCOUNT_SETUP_REQUIRED`, `413`, `500` and `503` fail the whole sync request; the
phone keeps its outbox and tries again later.

## Texts the app shows
English only (Q-054). Messages for sign-in come from the app, not from Supabase, so they cannot
reveal whether an address is registered.

| Situation | Text | Source |
|---|---|---|
| After sign-up, whatever Supabase returns | "Check your email. If this address can be used for a new account, we've sent a link to finish signing up." | REQ-ACC-010, D-11; wording is an MVP default (D-18) |
| After "Forgot password", whatever Supabase returns | "If an account uses this address, we've sent a link to reset the password." | REQ-ACC-010, D-11; wording is an MVP default (D-18) |
| Sign-in fails | "Email or password is incorrect." | REQ-ACC-010 |
| Sign-in before the email is verified | "Verify your email first. Check your inbox for the link." Shown only if validation confirms it cannot reveal registration (ADR-0004 validation step 2); otherwise the sign-in failure text is used | REQ-ACC-010; Q-080 MVP default |
| Sign-up without the 18+ box ticked | The button stays disabled; the box reads "I am 18 or older" | REQ-ACC-010, D-18 |
| A step that needs internet while offline | "<Step> needs an internet connection." e.g. "Signing up needs an internet connection." | REQ-NFR-004, D-04, ADR-0007 rule 6 |
| A rejected weigh-in | "This weight wasn't saved: <reason>. Edit or discard it." with the reason from the code, e.g. "the date is in the future" | ADR-0007 rule 2 |
| A rejected meal or saved-meal change | "This meal wasn't saved: …", "This meal wasn't deleted: …", "This saved meal wasn't saved: …", "This saved meal wasn't deleted: …". A rejected deletion offers Discard only | ADR-0007 rule 2; MVP default (D-26) |
| A rejected steps, sleep, measurements or target change | The same, with its own subject: "These steps weren't saved: …", "This sleep wasn't saved: …", "These measurements weren't saved: …", "This target wasn't saved: …". For `ROLE_NOT_ENABLED` the reason reads "your account cannot log this" for every kind | ADR-0007 rule 2; MVP default (D-23) |
| A rejected workout change (saving or deleting) | "This workout wasn't saved: <reason>. Edit or discard it." Edit opens the workout | ADR-0007 rule 2; MVP default (D-29) |
| A rejected setting change | "This setting wasn't saved: <reason>. Edit or discard it.", under the setting's name ("Appearance", "Body weight unit", "Lifting weight unit"). Edit opens Settings | ADR-0007 rule 2; MVP default (D-31) |
| `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE` | "Something went wrong. Your entries are kept on this phone and will sync later." | REQ-NFR-004 |
