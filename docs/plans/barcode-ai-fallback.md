# Plan: a barcode found nowhere — name it, search our list, then an AI estimate

- Status: **Proposed** (the owner approved Option A of the design on 2026-11-19; this plan waits for approval)
- Requirements: REQ-LOG-007 (barcode), REQ-LOG-009 and REQ-ACC-004 (AI consent), REQ-LOG-011 (My foods)
- Decision: D-117 (to be recorded on approval); amends ADR-0010 (the amendment is already written)
- Invariants touched: #3 (consent checked on the server before the call), #4 (non-AI logging always works),
  #6 (values per 100 g, grams canonical), #7 (nothing from a request or answer logged)
- Design: canvas https://claude.ai/artifact/WiREUfrXoqt6t7towhWx6L, Option A, plus the shared Consent and
  Estimate screens. Not yet locked: the owner locks it after this plan (project rule).

## What the user sees (Option A, inside the existing Scan barcode sheet)
1. Open Food Facts and our table do not know the barcode: today's "not found" step gets a filled
   **Name this product** button above the outlined "Enter your own food".
2. The sheet shows a name box. **Search our food list** searches the phone's own list (the Search foods
   code, offline, no AI). A match opens as for any searched food.
3. No match, or "None of these": **Get an estimate**. First time only, a consent step names OpenAI.
4. The estimate: a yellow **Estimated** tag and a warning banner; kcal, protein, carbs, fat and fibre per
   100 g are editable; "Amount you ate (g)" with the live total; **Add**.
5. Any failure (offline, no key, OpenAI down or at its limit): an error banner and "Enter your own food"
   as now. Nothing is lost.

## Server
- `POST /v1/ai/barcode-estimate`, body `{ barcode, name }`, access `account`, the caller's own reading
  only. Order as `aiMealParse.ts`: estimator set up (else 503) → body valid → consent read right before
  the call (`AI_CONSENT_REQUIRED`) → call → count the reading (`app.ai_readings`) → answer.
- New file `apps/api/src/ai/productEstimator.ts` in the one AI module: OpenAI Responses API,
  `gpt-6-luna`, `reasoning.effort: "none"`, `store: false`, strict JSON schema, 12 s timeout. Sent:
  the product name and the barcode digits only; never a name, email or user ID. The name is data, never
  instructions. Answer: `{ name, brand, kcal, proteinG, carbsG, fatG, fibreG }` per 100 g, checked again
  with zod and against the My foods limits (kcal 0–900, grams 0–100, `myFoodValueMax`). An answer
  outside them, or whose kcal and macros disagree badly, is a failure, not shown.
- The barcode adds little for the AI (the name does the work); it is sent so the answer can be
  matched to the scan. No web search, no second provider, no extra cost beyond OpenAI's $10 cap.
- Nothing is stored on the server: not in `app.barcode_products` (shared, real data only), no new table,
  **no migration**.
- Shared contract in `packages/shared/src/contracts.ts`: `barcodeEstimateRequestSchema`
  (`barcodeSchema` + name 2 to 120 characters, as My foods) and `barcodeEstimateResponseSchema`.

## Phone
- `BarcodeSheet.tsx` gains steps `name`, `ourList`, `consent`, `estimating`, `estimate` beside its
  existing ones; new `apps/mobile/src/api/barcodeEstimate.ts` (same pattern as `aiMeal.ts`).
- "Saved for that user only": when the user taps **Add**, the estimate is also saved as an own food
  through the existing `myFood.set` sync change (per 100 g, named as the user left it, carrying the
  Estimated mark), so the next scan of that barcode is not found again but the food is found by name in
  My foods. No phone schema change. The exact way the mark and the barcode survive in an own food is
  checked in step 1 before building; if My foods cannot carry it without a schema change, I stop and ask.
- Consent: the existing one-time AI consent flow and `AI_CONSENT_TEXT_VERSION`. **Question for the owner:**
  does the current text ("meal text") cover a product name and barcode? If not, the text changes and the
  version moves on, and everyone is asked once more.
- JavaScript only: no new development build, no APK.

## Tests
- API unit: estimator with a fake OpenAI client (never a real call): good answer, out-of-range answer,
  malformed answer, provider failure, timeout, a name that tries to give instructions.
- API route: consent never given, off, old version → **no call leaves the API** (invariant #3); no key →
  503; invalid barcode (7 or 15 digits) or short name → `VALIDATION_FAILED`; reading counted; nothing
  from the request or answer in the logs.
- Shared: schema accepts and refuses the edges.
- Phone (same pattern as `barcode.test.tsx`): not found shows both buttons; our list found; no match →
  consent once → estimate with the tag and banner; edits change the total; Add adds and saves the own
  food; offline and failure keep "Enter your own food"; non-AI path unchanged without AI (invariant #4).
- Run: lint, typecheck, unit and integration tests; the integration ones need `fitsphere-dev`, so any I
  cannot run I report as not run.

## Risks
- **Wrong numbers.** The AI estimates from a name; some brands will be off. Mitigations: shown as
  Estimated with a warning, always editable, never shared, never silent. New accepted risk R-018, to the
  owner and Legal's list (Q-049) with R-017.
- **Cost:** about one small call per unknown barcode, under OpenAI's hard monthly cap.
- **Privacy:** a product name and barcode are not health data, but they go to OpenAI like meal text
  (kept up to 30 days, R-017).

## Steps (each its own pull request off `main`, CI green before merge)
1. Shared contract, `productEstimator.ts`, the route and their tests; check My foods can carry the mark.
2. The phone: API client, the Scan barcode sheet's new steps, tests.
3. Close-out: D-117, REQ-LOG-007 text, ADR note, risk R-018, CLAUDE.md "Current phase".

Branch `feat/barcode-ai-estimate`, in its own folder `D:\fitsphere-barcode-ai` (removed once merged).

## Not in this plan
No web search; no photo of the label (a later option); no shared saved products; no Cloud Run deploy.
**The beta's Cloud Run API needs this API before beta phones can estimate; deploy only when the owner
says so.** Until then a beta phone's call fails and the sheet falls back to "Enter your own food".
