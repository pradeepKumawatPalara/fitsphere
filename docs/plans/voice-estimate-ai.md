# Plan: Speak your meal, estimated by AI (D-122, ADR-0012 amended), with a Quantity box

Status: Accepted by the owner in chat, 2026-11-24 (see D-122). Branch `feat/health-connect-refresh-guide`.
Requirements: REQ-LOG-005, REQ-LOG-009; invariants #3 (exception, written), #4, #7.

## What the user sees
- Search foods › Speak your meal: the words are read by AI at once (no consent sheet); the foods are listed ticked and
  tagged Estimated, "Estimated by AI from what you said".
- Each food opens in "Check the estimate": name, **Quantity** (new), Amount in grams, values per 100 g, "This portion".
  Quantity and Amount follow each other.
- Failure: "No data available"; AI reading off in Settings: "AI reading is off". Typed search is the food list.

## Server
- `PhotoEstimator.estimateText(text)` (`apps/api/src/ai/photoEstimator.ts`): the photo estimate's schema and checks,
  its own instructions (`VOICE_ESTIMATE_INSTRUCTIONS`), the words as `input_text`.
- `POST /v1/ai/voice-estimate` (`routes/aiVoiceEstimate.ts`): request `mealParseRequestSchema`, response
  `photoEstimateResponseSchema`; setup, validation, Settings "off" check, call, count.

## Phone
- `estimateSpoken` (`api/photoMeal.ts`); `readSpoken` in `components/VoiceMeal.tsx` (speech only; Log meal's typed
  words keep `afterListening`).
- `PhotoFood.quantity` and `.unit` (`photoMeal.ts`); `PhotoFoodSheet` Quantity box.

## Tests
API: estimator (`photoEstimator.test.ts`), route (`ai-voice-estimate.test.ts`, route listed in `routes.test.ts`).
Phone: `voicemeal.test.tsx`, `photomeal.test.tsx`. Fake client and fake server only; synthetic data.

## Not in this plan
No migration, no phone schema change, no new build, no deploy (the beta's Cloud Run API needs this API first).
