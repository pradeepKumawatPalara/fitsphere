# ADR-0012: A photo of a meal is read and estimated by AI, with no consent step

- Status: **Accepted** by the project owner on 2026-11-20 (D-120; the owner's answers to its open questions are below)
- Date: 2026-11-20
- Decision owner: Project owner
- Related requirements: REQ-LOG-006, REQ-LOG-009, REQ-ACC-004
- Related constraints: C-003, C-004, C-005, C-008; invariants #3, #4, #6, #7
- Supersedes: **in part** ADR-0010 and ADR-0005, for a photo of a meal only (the camera and the
  gallery choice in Log meal's "Add a photo"):
  1. "The AI names foods; it never gives nutrition" (ADR-0010's Decision; ADR-0005's flow). For a photo
     the AI also gives each food's portion weight and its values.
  2. "The phone matches each food to its own food list (ADR-0006)", and D-118's "Look up online".
     A photo no longer uses the food list.
  3. "Consent is asked once and checked on the server before every call" (ADR-0010, ADR-0005,
     invariant #3, C-004, REQ-ACC-004). A photo is sent with no consent step.
  Everything else in ADR-0010 and ADR-0005 stands: voice (text only) and the barcode estimate keep their
  consent, their food-list matching and their rules; one AI module in the Node API; OpenAI
  `gpt-6-luna` through the Responses API with `store: false`; the key only in the API's environment;
  nothing logged; no daily limit, OpenAI's monthly cap alone.

## Context
D-118 made a photo read like a spoken meal: OpenAI names the foods, the phone finds each in its own
list, and a food not in the list can be looked up online. The owner (2026-11-20) wants this changed for
upload and camera photos only: the AI identifies the items, their quantities and their nutrition
values, the food list is not used, the same screens show each food's configuration, and no consent is
asked. Voice and barcode stay as they are. The model stays `gpt-6-luna`.

Known: the photo already leaves the phone only shrunk and without metadata (about 200 KB, JPEG);
OpenAI keeps requests to the Responses API up to 30 days for abuse monitoring whatever `store` says
(R-017). Uncertain: how close a photo's portion and values are to the truth (measured in validation);
whether Legal accepts a photo being sent without a consent step (Q-049).

## Decision criteria
1. **Must:** the owner's instruction: no consent step; no food list; the AI gives items, quantity and values.
2. **Must:** every other invariant holds: #4 non-AI logging always works; #7 nothing sensitive logged or
   kept; #6 units are display only.
3. **Must:** the user can see and correct every number before it is logged.
4. **Should:** the least change to the screens and the data already built (D-117's Estimated items).
5. **Should:** the user knows a photo is read by AI, without a consent question.

## Options considered
### Option A — Keep the consent check, ask once elsewhere
Consent collected once at sign-up or first use of any AI feature, with the Settings switch; no prompt in
the photo flow.
- Benefits: invariant #3 and C-004 unchanged; the photo flow is as smooth as the owner wants.
- Costs and risks: a new sign-up step or a new first-use step elsewhere.
- Fit: meets every constraint. **The owner chose B instead.**

### Option B — No consent for a photo, a notice instead (**the owner's choice**)
The photo is sent when the user picks or takes it. The "Add a photo" sheet says plainly that the photo
is read by AI (OpenAI). Voice and barcode keep their consent.
- Benefits: the fewest taps; the photo flow stays one step.
- Costs and risks: breaks invariant #3, C-004 and REQ-ACC-004 for a photo, which the project protects;
  a photo can show people or places; Legal has not reviewed the AI use (Q-049). Needs the owner's
  explicit decision and Legal told.
- Fit: needs an exception to invariant #3, written in the rules, not silently.

### Option C — No consent for every AI feature
- Costs: far beyond the request; rejected without further study.

## Decision
**B**, with these parts:
- **Where nutrition comes from, for a photo:** the AI. For each food it sees: a plain name, the
  quantity and unit as seen, the portion's weight in grams, and per 100 g kcal, protein, carbs, fat and
  fibre. Every value is shown as **Estimated**, editable, and logged only after the user taps Add. Nothing
  from it enters the shared food tables.
- **No food list, no online lookup:** a photo reading never searches `app.foods`, `app.packaged_foods`,
  `app.barcode_products` or Open Food Facts.
- **If the AI cannot answer** (no key, offline, OpenAI failing or at its monthly limit, an answer out of
  contract, no food seen): the user sees "No data available" and "Enter your own food" still works
  (invariant #4). No partial or guessed answer.
- **A new route:** `POST /v1/ai/photo-estimate`. `photo-parse` (names only, with consent) stays for builds
  already out, and is removed once none use it.
- **No consent step.** The server does not check consent for this route. A notice on the sheet says the
  photo is read by AI. A user who has turned AI reading off in Settings still blocks it (see Open
  questions: the owner decides).
- **Server checks on the answer:** the values in range (kcal 0 to 900 per 100 g; protein, carbs, fat,
  fibre 0 to 100; grams above 0 up to 2,000 a food; at most 20 foods); kcal within 25% of 4 x protein +
  4 x carbs + 9 x fat, else the food is dropped; anything else out of contract is a failure.
- **Model and limits unchanged:** `gpt-6-luna`, `reasoning.effort: "none"`, `store: false`;
  `max_output_tokens` raised from 800 to about 2,000 and the server's wait from 20 to 30 seconds, the
  phone's from 25 to 35, because each food now carries more fields. Readings are still counted by day,
  never refused.
- **Privacy rules that stay:** only the shrunk photo is sent, never a name, email or user ID; the photo
  and the answer are never logged or stored by the server or kept by the phone.

## Why this option wins
It is the owner's choice, and it reuses what is built: D-117's Estimated items and "Check the estimate"
screen, the photo shrinking and the AI module. The server's range and energy checks, the "Estimated"
marks and editing before Add keep unverified numbers out of the log unseen.

## Why alternatives were rejected
A keeps the protection but adds a step elsewhere that the owner chose not to have. C changes far more
than was asked.

## Counterfactual
If Legal finds a photo cannot be sent to OpenAI without consent (Q-049), A is the better choice, and the
change is small: the server's consent check returns to the route and the phone asks once.

## Consequences and accepted trade-offs
- Invariant #3, C-004 and REQ-ACC-004 gain an exception for a photo; the owner approves its wording.
- A photo of a plate can show people or places and goes to OpenAI with no question asked (R-017, widened).
- The values are AI estimates for every food, so they can be well off, mostly the portion's weight
  (R-018, widened), and the same dish can differ from the food list's value or between two photos.
- The user's Settings switch no longer covers photos (unless the owner keeps the proposed block).
- Easier: one tap less; no mismatch between what the photo shows and what the food list holds.

## Validation plan
1. 30 synthetic meal photos of common Indian dishes with known values, as ADR-0010's `ai:check` did:
   the share of foods named right, the portion's weight and kcal error against the known values, the
   count of answers refused by the server's checks, and the price per reading. The owner sets what is
   good enough before it ships; no figure is promised here.
2. Contract, parser (a fake client, never a real call in tests), route (no consent step; counted; nothing
   logged) and phone tests, as in `docs/plans/photo-estimate-ai.md`.
3. Legal's answer on this exception, asked in the Q-049 brief.

## Revisit conditions
- Legal says a consent step is needed for photos.
- The measured error of the estimates is too large for the owner.
- The monthly OpenAI cap is reached often because of the larger answers.

## Open questions and handling
Answered by the owner on 2026-11-20:
- **Q-A:** A user who switched AI reading off in Settings still has photos not read: an explicit "off"
  still blocks it (the owner: "go with your suggestion").
- **Q-B:** The notice on the "Add a photo" sheet is approved: "The photo is read by AI (OpenAI) to
  estimate the foods and their nutrition. It is not saved."
- **Q-C:** The consent text and its version are **left as they are**: no new text, no new version, no
  one asked again. Voice and barcode keep asking as now. (The owner: "keep as usual".)

## References
- `docs/plans/photo-estimate-ai.md`; ADR-0010, ADR-0005, ADR-0006; D-115, D-117, D-118
- `.claude/rules/project-invariants.md` #3, #4, #6, #7; C-004; REQ-ACC-004; R-017, R-018; Q-049
- OpenAI data controls: requests to `/v1/responses` kept up to 30 days (read 2026-11-17, ADR-0010)

## Amendment, 2026-11-24 (D-122): a spoken meal is estimated the same way
The owner extended this decision to what the user SPEAKS in Search foods ("use photo rule, no consent step"):
- `POST /v1/ai/voice-estimate` takes the spoken words (text, never audio; 2 to 500 characters) and answers the same
  shape as `POST /v1/ai/photo-estimate`, from the same OpenAI module (`estimateText`, its own fixed instructions,
  the same strict schema and consistency check). No consent step; a recorded "off" in Settings blocks it; counted by
  day, no daily limit; nothing logged or stored.
- The phone does not use the food list for a spoken meal; the foods are Estimated, open in "Check the estimate" and
  are added as the user's own estimated foods in grams. "Check the estimate" gains a Quantity box that moves with the
  amount.
- Typed words in Search foods use the food list; words typed in Log meal's box and the barcode estimate keep
  ADR-0010's consent and food-list matching.
- This partly reverses ADR-0010 for voice ("the AI never gives nutrition"). Validation 1 (the accuracy of the
  estimates) should be run for spoken meals as for photos before release; Legal's answer on the exception (Q-049)
  covers both. Revisit if Legal requires consent.
