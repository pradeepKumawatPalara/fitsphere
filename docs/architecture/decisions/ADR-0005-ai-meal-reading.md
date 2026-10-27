# ADR-0005: AI meal reading (text, photo, voice)

- Status: **Accepted** by the project owner on 2026-10-27 under the D-18 pre-approval. The check
  against the requirements, invariants, threat model, D-01 to D-18 and ADR-0001 to ADR-0003
  found one conflict that touched privacy: the phone's speech service could receive the voice
  before the server's consent check (invariant #3, C-004). The owner answered it before
  acceptance (D-18: on-device recognition only). Small fixes were applied in the same change.
- Date: 2026-10-27
- Decision owner: Project owner
- Related requirements: REQ-LOG-004/005/006/009/010, REQ-ACC-004/005
- Related decisions: C-003, C-004, C-005, C-008, D-03 (free first), D-16 (audio deleted; consent checked right before each AI call), D-18 (MVP; voice answer)
- Builds on: ADR-0002 (Node API; media rules 3, 6 and 8), ADR-0006 (food data)

## Context
Users describe a meal by typing, speaking or photographing it (or a nutrition label). AI
turns that into food items with quantities. Rules: AI only with recorded consent, checked
on the server right before each call (C-004, invariant #3); logging must still work with AI
off (C-005); the user reviews before saving (A-006); the data is personal health data;
budget is tight.

## Decision criteria
1. **Must:** provider does **not** use FitSphere users' data to train or improve its models.
2. **Must:** reads text and images; returns structured results (items, grams, raw/cooked).
3. **Must:** low cost per meal, with a hard spending limit.
4. **Should:** good with Indian foods and Indian-English descriptions.
5. **Should:** replaceable — one AI module in the Node API.

## Options considered
- **A — Google Gemini API, free tier:** free, but Google's pricing page says free-tier
  data **is used to improve Google's products** (checked 2026-10-27). Fails criterion 1
  for health data. Acceptable only for developer testing with made-up meals.
- **B — Google Gemini API, paid tier, Flash-Lite model:** paid-tier data is not used to
  improve products. Cheapest listed: Gemini 3.1 Flash-Lite at $0.25 per million input
  tokens and $1.50 per million output tokens (checked 2026-10-27). Reads text and images.
- **C — Other paid AI APIs (e.g. OpenAI, Anthropic small models):** comparable abilities;
  prices not checked here. Kept as alternatives behind the same module.

## Decision
**B — Gemini 3.1 Flash-Lite on the paid tier**, through one AI module in the Node API, with the
rules under "Recommended option". Accepted by the project owner on 2026-10-27 under the D-18
pre-approval, after the owner answered the voice conflict (D-18: on-device recognition only).
Paid use starts only after the owner signs off the billing account and the monthly cap (C-008,
Q-087).

Accepted while these were still open: Q-040 (accuracy — measured in validation), Q-049 (Legal)
and Q-087 (billing account). "Open questions and handling" below says how each is handled.

## Recommended option
**B — Gemini 3.1 Flash-Lite on the paid tier**, through one AI module in the Node API.
- **Development:** test with made-up meals only (free tier allowed for that; invariant #7).
- **Before real users:** paid tier, after the owner's sign-off (C-008).
- **Flow:**
  1. Typed (or spoken, see Voice) text goes from the app to the Node API. A photo — meal or
     label — is uploaded to file storage with a short-lived upload link, like any photo
     (ADR-0002 rule 3); the API reads it from there.
  2. Immediately before each AI call, the API checks the user's recorded consent
     (invariant #3; ADR-0002 rule 6).
  3. The API calls the AI, asking for strict JSON: food name, quantity in grams, raw/cooked,
     confidence.
  4. The API matches the items to the food list (ADR-0006) for nutrition values; unmatched
     items use the AI's estimate, marked "estimated" (answers Q-063).
  5. The app shows the list for review: each item with its quantity, kcal and protein (MVP
     default, Q-062). Nothing is saved until the user confirms (A-006).
- **What reaches the AI:** only the meal text or photo — no name, email or user ID. Requests
  and responses are kept out of logs (invariant #7). A pasted public image link
  (REQ-LOG-010) is never fetched by FitSphere (ADR-0002 rule 8), so AI never reads it.
- **Voice (MVP — owner's answer, D-18; answers Q-038):** the app asks the phone for
  **on-device** speech recognition, so the voice never leaves the phone. Only the resulting
  text is used, and it reaches AI only through the flow above, after the consent check. No
  audio is uploaded or stored (D-16). On a phone that cannot recognise speech on the device,
  the microphone button is hidden and the user types. A keyboard's own voice typing is the
  user's choice and outside FitSphere's control.
- **Label photos:** deleted from file storage once the reading finishes (D-18, Q-064). If
  the reading fails, the phone keeps its copy as an unfinished draft so the user can retry
  (REQ-LOG-009; draft rules in ADR-0007 rule 4).
- **Limits:** max 15 AI readings per user per day (MVP default); a hard monthly cap on
  readings, enforced in the AI module, plus a budget alert on the billing account; AI off
  until the user consents (A-007); if AI fails, input is kept and non-AI methods are offered.
- **Consent record (MVP default, Q-065):** each change stores on/off, the time and the
  version of the consent text shown. One toggle covers typed or spoken text, photos and
  labels. Legal confirms (Q-049).

### Rough cost (estimate, not measured)
A typed meal ≈ 500 input + 300 output tokens ≈ **$0.0006**. A photo costs more (image
tokens; measure in validation). Example: 1,000 users × 3 AI meals/day × 30 days =
90,000 readings ≈ **$50–$100/month**. Measure real token use in validation.

## Why alternatives were rejected
A uses health data to improve the provider's products. C is not cheaper on known
information and adds no MVP benefit; it stays possible behind the module.

## Counterfactual
If Indian-food accuracy is poor in validation, or another provider is cheaper with the
same data-use terms, switch providers (module design makes this small).

## Consequences
- First usage-based cost (AI); needs a Google Cloud billing account (Q-087) and the owner's
  sign-off (C-008), plus the monthly cap.
- Health data is processed by Google. This is the one flow where meal data may leave India:
  stored data stays in Mumbai (ADR-0002, ADR-0003), but the provider may process requests
  elsewhere. Legal confirms before real users (Q-049, C-003).
- How long the provider keeps requests (for example, for abuse monitoring) is checked against
  its terms before real users (Q-049).
- Voice depends on the phone: phones that cannot recognise speech on the device get no
  microphone button (backlog B-15).

## Validation plan
1. 30 typed Indian meals (e.g. "2 roti, 1 katori dal, 150 g cooked rice"): check items and
   grams; record accuracy.
2. 10 meal photos and 5 nutrition labels: same.
3. Record average tokens and cost per reading.
4. Consent off → confirm no call leaves the API.
5. On the lowest-end Android phone available, with the network off: a spoken meal becomes
   text. On a phone without on-device recognition, the microphone button is hidden.
6. A label photo is deleted from storage after reading; a pasted image link is never sent
   to AI.
7. Check whether the provider offers processing in India, and how long it keeps requests.

Record each result, with its date, under "Validation results". A failed step that the rules
above cannot fix triggers the revisit conditions; changing the decision needs a new ADR that
supersedes this one.

## Validation results
None yet.

## Revisit conditions
Accuracy below what the owner accepts; monthly AI cost above the cap; provider changes
its data-use terms or prices (Gemini Flash prices listed as introductory change on
1 Jan 2027 for some models — Flash-Lite 3.1 not marked introductory; recheck).

## Open questions and handling
| Question | Handling |
|---|---|
| Q-038 voice | Answered by the owner (D-18): on-device recognition only; the voice never leaves the phone |
| Q-040 accuracy | Measured in validation; owner decides acceptable level |
| Q-062 what the review list shows | MVP default (D-18): item, quantity, kcal and protein; estimates marked |
| Q-063 where nutrition values come from | Answered by this ADR and ADR-0006: food list first, else the AI's estimate, marked |
| Q-064 label photos | Answered for the MVP (D-18): deleted once read |
| Q-065 consent record | MVP default (D-18): on/off, time, consent-text version; Legal confirms (Q-049) |
| Q-049 Legal | Blocks real users, not development |
| Q-087 billing/card | Needed before paid AI use; owner sign-off (C-008) |

## References (checked 2026-10-27)
- Gemini API pricing and data use by tier: https://ai.google.dev/pricing
- Project: owner-decisions D-16, D-18; ADR-0002 media rules 3, 6 and 8
