# ADR-0010: AI meal reading's provider (OpenAI) and where nutrition comes from

- Status: **Accepted** by the project owner on 2026-11-17 (D-108)
- Date: 2026-11-17
- Decision owner: Project owner
- Related requirements: REQ-LOG-005, REQ-LOG-009, REQ-ACC-004, REQ-ACC-005
- Related constraints: C-003, C-004, C-005, C-008; invariants #3, #4, #7
- Supersedes: **in part** ADR-0005: its Decision and Recommended option's provider (Gemini 3.1
  Flash-Lite), its flow step 4 (unmatched items use the AI's estimate) and the answer to Q-063. The
  rest of ADR-0005 stands: one AI module in the Node API; consent checked on the server right before
  each call; only the meal text or photo is sent, never a name, email or user ID; nothing AI-related is
  logged; on-device voice only, the mic hidden otherwise; no audio kept; the user reviews before
  saving; label photos deleted once read. ADR-0005's 15 readings a user a day is replaced too: no daily
  limit (D-108).

## Context
ADR-0005 chose Gemini 3.1 Flash-Lite and planned that the AI returns grams and that unmatched foods take
the AI's estimate. Before slice 7 was built the owner chose OpenAI, set up a project with a hard monthly
spending limit, and asked that the AI name foods only, never give nutrition (D-108). The first use is
voice from the Search foods box (E-28): on-device speech becomes text, the text is read by the AI, and
the phone finds the foods in its own food list.

## Decision criteria
ADR-0005's, unchanged:
1. **Must:** the provider does not use FitSphere users' data to train or improve its models.
2. **Must:** returns structured results.
3. **Must:** low cost per meal, with a hard spending limit.
4. **Should:** good with Indian foods and Indian-English, Hinglish and Hindi descriptions.
5. **Should:** replaceable, behind one AI module.

## Options considered
- **A — Gemini 3.1 Flash-Lite, paid tier** (ADR-0005). Meets 1 to 3 on its 2026-10-27 check. Not set up:
  no billing for AI on the Google project yet (Q-087's AI part).
- **B — OpenAI `gpt-6-luna`, Responses API.** Set up by the owner: a project with a $10 a month hard
  limit and a key limited to the Responses API (D-108).
  - Criterion 1: OpenAI's data controls say data sent to the API is not used to train or improve its
    models unless the organisation opts in. Requests to `/v1/responses` are kept up to 30 days for abuse
    monitoring, whatever `store` says; Zero Data Retention needs OpenAI's approval. `store: false` keeps
    no application state (read 2026-11-17).
  - Criterion 2: strict JSON-schema output (`text.format`), checked again by FitSphere.
  - Criterion 3: the owner's hard limit; the price per reading is measured in validation.
  - Processing in India: OpenAI lists inference residency in India for `gpt-6-luna` on the Responses
    API, for a project created in India with approved Zero Data Retention (read 2026-11-17). Not set up:
    the owner's project is a global one, so requests may be processed outside India (Q-094).

## Decision
**B — OpenAI `gpt-6-luna` through the Responses API**, in the one AI module (`apps/api/src/ai/`):
- Model from `OPENAI_MODEL`; `reasoning.effort: "none"`; `store: false`; `max_output_tokens` about 800.
- `text.format`: a hand-written strict JSON schema; every field required, no extra fields, nullable
  fields as `[type, "null"]`, the unit from FitSphere's measure words. Checked again with zod; anything
  else is a failure.
- **The AI names foods; it never gives nutrition.** Each item: the words spoken, a plain English name,
  quantity, unit, preparation, what was unclear. The phone matches each to its own food list
  (ADR-0006) and works out the values as for a searched food. An item with no match is shown under "Not
  in our food list" with Search and Own food; no AI estimate is ever used (replaces ADR-0005 step 4 and
  Q-063's answer).
- **Limits:** none in the app (D-108): OpenAI's hard monthly limit, set by the owner, is the only cap.
  Readings made are counted by user and India day in `app.ai_readings`, never refused. Any OpenAI failure, the limit
  included, is `SERVICE_UNAVAILABLE`, and the user's words are kept.
- **Consent:** asked once in the app, at the first reading (D-108), and checked on the server before
  every call, against the current consent text's version (invariant #3). The text names OpenAI.
- **The key** is in the API's environment only (`OPENAI_API_KEY`); never printed, logged or committed.
  Without it, the route answers 503.

## Why this option wins
It meets the must criteria on the provider's published terms, it is set up with a hard spending limit
now, and its strict-schema output fits the module. Removing nutrition from the AI's answer makes the
values identical to a hand-searched food's and keeps unverified numbers out of the user's log.

## Why alternatives were rejected
A is not set up for billing, and the owner chose B (D-108). A stays possible behind the same module.

## Counterfactual
If `gpt-6-luna`'s reading of Indian meals is poor in validation, or Legal needs processing in India that
the owner's OpenAI project cannot give, switch the model or provider behind the module, or move to an
India project with Zero Data Retention.

## Consequences
- Meal text, a user's health-related data, is processed by OpenAI, possibly outside India, and kept up
  to 30 days for abuse monitoring (risk R-017). Legal confirms before real users (Q-049).
- People who agreed to the Gemini consent text are asked again once.
- Foods missing from the food list cannot be logged by voice; the user searches or adds their own food.
- Paid use is signed off by the owner (D-108, C-008).

## Validation plan
ADR-0005's steps 1, 3, 4 and 5 for voice, with this provider:
1. `apps/api/scripts/meal-parse-check.ts`: about 30 made-up meals (English, Hindi, Hinglish) to the real
   model; check the items, quantities and units; record time and tokens. Run only on the owner's word.
2. Consent never chosen, off, or on the old text → no call leaves the API (automated test).
3. On the lowest-end Android phone available, network off: a spoken meal becomes text; on a phone
   without on-device recognition the mic is hidden.
4. Check whether an India project with Zero Data Retention is available to the owner (Q-094).

## Validation results
- **Step 1, 2026-11-17** (`npm run ai:check`, the owner's word; 30 made-up meals: 12 English, 10
  Hinglish, 6 Hindi in Devanagari, 2 with no food): 30 of 30 read, none failed, every answer within the
  contract. Each food named as said, Hindi words turned into English names (chawal → rice, doodh →
  milk, dahi → curd, anda → egg); quantities and units right, Hindi numbers included (aadha 0.5, dedh
  1.5, teen 3); a bowl read as katori; both self-corrections kept only the correction; "bada chammach"
  as tablespoon; "ek packet Maggi" as 1 serving; amounts not said left empty with "how much"; unclear
  kinds noted ("which dal", "which biryani"); no food for "I skipped lunch today", nor for the text
  trying to give instructions. Time: 1.7 s on average, 7.0 s for the first call, 0.8–3.2 s for the
  rest. Tokens: about 1,750 in (mostly the fixed instructions) and 12–112 out a reading; 52,420 in
  and 1,927 out in all. The price per reading is not worked out here (OpenAI's price for the model not
  checked).

## Revisit conditions
Accuracy below what the owner accepts; OpenAI's limit reached in normal use; OpenAI changes its data-use
terms or prices; Legal requires processing in India.

## Open questions and handling
| Question | Handling |
|---|---|
| Q-040 accuracy | Measured by the check script; the owner decides |
| Q-049 Legal | Blocks real users, not development; the consent text and R-017 go to Legal |
| Q-094 processing in India | Open: an India project needs OpenAI's Zero Data Retention approval |

## References (read 2026-11-17)
- Data controls in the OpenAI platform: https://developers.openai.com/api/docs/guides/your-data
- Data residency: https://developers.openai.com/api/docs/guides/data-residency
- Introducing data residency in Asia: https://openai.com/index/introducing-data-residency-in-asia/
