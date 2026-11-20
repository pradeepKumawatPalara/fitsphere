# Plan: a photo of a meal, read by AI, foods found in our list, then online, then an estimate

- Status: **Proposed**, then replaced for a photo on 2026-11-20 by `docs/plans/photo-estimate-ai.md` (D-120, ADR-0012): a photo no longer uses the food list, "Look up online" or the consent step. This plan's server `food-lookup` route and its lookup for voice stay.
- Requirements: REQ-LOG-006 (meal photo), REQ-LOG-009 and REQ-ACC-004 (AI reading and consent), REQ-LOG-007, REQ-LOG-011
- Decision: D-118 (to be recorded on approval); builds on D-115 (voice) and D-117 (barcode estimate)
- Invariants touched: #3 (consent on the server before every call), #4 (non-AI logging always works), #6, #7

## What the user sees
1. In Search foods, under "Speak your meal": **Take a photo** and **Choose a photo** (camera or gallery only; no image links).
2. First time only, the consent step (the text now names photos). The photo is shrunk on the phone as the meal photo is (about 200 KB, no metadata) and sent; nothing is saved from this step.
3. OpenAI names the foods it sees (and an amount only when clear). Each is found in the phone's own food list as for Speak your meal and listed ticked for review; Add puts the ticked foods in Log meal.
4. A food not in our list sits under "Not in our food list" with **Look up online**: Open Food Facts by name, else an OpenAI estimate. The result opens in "Check the estimate", editable, marked estimated, added only after the user taps Add.
5. Any failure leaves the review or an ordinary notice; "Enter your own food" always works (invariant #4).

## Server
- `POST /v1/ai/photo-parse` `{ imageBase64 }` → `{ items }` (the same item shape as meal-parse: names, quantity, unit; never nutrition). Order: parser set up (503) → body valid → consent read right before the call → call → count the reading → answer.
- `POST /v1/ai/food-lookup` `{ name }` → Open Food Facts name search (only the food name sent); none → OpenAI estimate (`productEstimator`, barcode now optional). Answer carries `source`.
- Photo and answer are never logged or stored (invariant #7). No migration, no phone schema change.

## Consent
New text version `2026-11-20` names the photo and the Open Food Facts name search. **Proposed wording; the owner approves it.** Everyone who agreed to `2026-11-19` is asked once more.

## Risks
- A photo of a plate can show people or places; it goes to OpenAI (kept up to 30 days, R-017). Only the shrunk copy leaves, without metadata.
- Open Food Facts' first name match may be a different product: the page says so and the user checks it. AI estimates may be wrong: shown as estimates, editable (R-018).
- ADR-0006 allowed Open Food Facts for barcodes only: this adds a name search, an amendment the owner asked for ("the same API as the barcode").

## Not in this plan
Image links, photo storage for this step, several photos at once, a Cloud Run deploy. **The beta's Cloud Run API needs this API before beta phones can read photos; deploy only when the owner says so.** JavaScript only: no new build.
