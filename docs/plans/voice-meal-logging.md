# Voice meal logging from the Search foods box (plan)

- Status: **Accepted** (the owner, in chat, 2026-11-17; see "The owner's answers")
- Owner: Project owner (D-01)
- Last updated: 2026-11-17
- Decision: D-108
- ADR: ADR-0010 (AI meal reading's provider and matching; replaces parts of ADR-0005)
- Builds on: E-28 (the mic, on hold since D-57), ADR-0005 (one AI module, on-device voice only, consent
  checked on the server), Search foods (REQ-LOG-007, D-96's amounts typed with a food), the food units
  (D-102), Log meal's review and Save (D-68)
- Requirements: REQ-LOG-005, REQ-LOG-009 and REQ-ACC-004 amended
- Design: canvas boards `VoiceMeal*` on a new canvas (the earlier one could not be opened from this
  account): options A (mic inside the box), B (mic beside the box, a review sheet) and C ("Speak your
  meal" row, a banner in Log meal), and `VoiceMealShared` (consent, permission, errors, Voice language),
  proposed 2026-11-17. **Locked the same day: C, with B's review sheet as its third screen**, board
  `VoiceMealLocked` (with `VoiceMealShared`): https://claude.ai/artifact/SjDTdqAtXqWgXJXvWAwav9.
- Branch: `feat/ai-meal-logging`, off `main`
- Server: a new AI module and route, migration `0034_ai_readings.sql` (0031 is held for another
  branch). Phone: a speech module, so **a new EAS development build** (D-19: the owner's word first).

## What the owner asked
2026-11-17: a microphone at the end of the Search foods box (Log meal › Search foods). What the user
says becomes text on the phone; with AI meal reading on, the text goes to the API, an AI model reads
which foods were said and how much, and the phone finds each food in its own food list and adds it to
the meal for review. The AI never gives calories or nutrition: those always come from the food list,
exactly as for a food searched by hand.

## Flow
1. **Mic.** A full-width "Speak your meal" row under the Search foods box (option C), only on a phone that can recognise speech on the
   device (`supportsOnDeviceRecognition()`); otherwise hidden (B-15). The microphone permission is
   asked on first use only; refused, a message says how to turn it on in the phone's settings.
2. **Listening.** A clear listening state, told in words, not colour alone. The phone's own
   recognizer, on the device (`requiresOnDeviceRecognition: true`), in the language chosen in
   Settings › Voice language (English (India), the default, or हिन्दी). The words appear live in the
   box, so the ordinary search runs on them. Listening ends on Done, after 6 seconds with no words, or
   after 30 seconds; a shorter pause doesn't end it (the owner's phone test, 2026-11-17: "keep hearing
   ... for 6 seconds even if someone is on mute", then "stop listen if there is a pause more than 6
   seconds"). The recognizer listens continuously; where the phone ends on a shorter pause, it is
   started again and the pieces heard are joined. No audio is uploaded or kept (D-16).
3. **Consent, asked once.** The first time listening stops and the user has never chosen, or chose on
   the old (Gemini) text, a consent sheet shows the new text, with **Turn on** and **Not now**.
   - Turn on: recorded with `PUT /v1/me/ai-consent`; the reading goes ahead.
   - Not now: recorded as off; the words stay in the box as an ordinary search. The sheet does not
     come back; while AI meal reading is off the mic still fills the box, with a short line saying it
     can be turned on in Settings.
   - The server checks the latest record right before every AI call either way (invariant #3).
4. **Reading.** The text (never audio) goes to `POST /v1/ai/meal-parse`. The answer lists the foods
   said: the words spoken, a plain English name, quantity, unit, preparation and what was unclear. No
   nutrition.
5. **Matching, on the phone.** Each food's name is searched exactly as Search foods searches
   (`searchFoodList`, the same sources and order); the first result is the match. The quantity and unit
   become the food's own amount by the rules of an amount typed with a food (`startFromSearch`, D-96;
   the food's units, D-102). With no quantity said, or a unit the food does not have, the food's
   opening unit × 1 is used and the item is marked **amount assumed** (phone only, until the meal is
   saved). The item is built with the same builders as a searched food, so its kcal and nutrients are
   the same.
6. **Review.** A sheet, "N foods found", lists the matched foods, each ticked and untickable, its name
   opening its amount; the unmatched under "Not in our food list" (step 7); "Add N foods · kcal". The
   ticked foods join Log meal's list through the same `onAdd` as Search foods, with a banner "Added N
   foods from what you said". The user
   changes, removes or adds foods and saves with Log meal's Save; nothing is saved before.
7. **Not in our food list.** Foods with no match are named in a notice ("Not in our food list"), with
   Search and Own food. If nothing matched, the notice shows and the words stay in the box.
8. **Errors keep the words** and offer ordinary search: offline; the service unavailable (also
   OpenAI's monthly limit reached). There is no daily limit (the owner, 2026-11-17).

## Server
- `apps/api/src/ai/`: the one AI module. OpenAI's Responses API, model from `OPENAI_MODEL`,
  `reasoning.effort: "none"`, `store: false`, `max_output_tokens` about 800, `text.format` a
  hand-written strict JSON schema (every field required, no extra fields, nullable fields as
  `[type, "null"]`, unit from FitSphere's measure words, "bowl" read as katori), checked again with
  zod. Only the meal text is sent: no name, email or user ID. Requests and answers are never logged.
  Fixed instructions with worked examples (Hinglish, Devanagari, self-corrections, brands, unknown
  dishes). A parser interface, so tests pass a fake.
- `POST /v1/ai/meal-parse`, account access: body `{ text }`, 2 to 500 characters; the latest consent,
  given on the current text version, checked right before the call, else `AI_CONSENT_REQUIRED` (403);
  no daily limit (the owner, 2026-11-17, after the phone test reached 15): each reading made is
  counted by user and Asia/Kolkata day, a refused or failed one not; any OpenAI failure, its monthly limit included, is
  `SERVICE_UNAVAILABLE`; no `OPENAI_API_KEY`, 503 as the other optional services.
- Migration `0034_ai_readings.sql`: `app.ai_readings (user_id, day, count)`, deleted with the user;
  one statement raises the count only while under the limit.
- No monthly cap in the app: OpenAI's own monthly limit ($10) is the cap (the owner, D-108).
- `packages/shared`: the request and answer contracts, the measure words, `AI_CONSENT_REQUIRED`, the
  new consent text and version.

## Phone
- `expo-speech-recognition` with its config plugin; the microphone and speech recognition permission
  texts (Android and iOS). `app.json` and its test no longer say the app asks for no microphone.
- `searchFoodList(db, text)`: the steps in Search foods' search, moved out of the component unchanged.
- `src/foodAmounts.ts`: `measuresOf`, `itemOf` and `startFromSearch`, moved out of `FoodDetail.tsx`
  unchanged.
- `src/voiceMeal.ts`: matching and amounts. The mic, listening state, consent sheet, notice, the
  amount-assumed mark and Settings › Voice language as the locked boards show.

## Tests (written first)
- API (a fake parser that counts its calls): consent never chosen, off, or on the old version → no
  call (ADR-0005 validation 4); the 15th reading allowed, the 16th refused, the next India day allowed;
  a reading handed back after a failure; text under 2 or over 500 characters, missing or extra fields;
  OpenAI errors, 429 and an unusable answer → `SERVICE_UNAVAILABLE`; no key → 503; the meal text never
  in the logs.
- Shared: the request and answer schemas; an answer with nutrition is refused.
- Phone: a found food; an unknown food; an assumed amount; katori, plate and piece; grams; Devanagari;
  a voice item's kcal equals a searched one's; the mic hidden without on-device recognition; Not now
  keeps the words; each error's message.
- `apps/api/scripts/meal-parse-check.ts`, by hand: about 30 made-up meals (English, Hindi, Hinglish)
  to the real model; prints the items, time and tokens. Run only on the owner's word (it spends from the
  monthly limit).

## The owner's answers (2026-11-17)
1. The owner is the one deciding ("I am the owner").
2. Consent: first "no consent", then, told that Legal is involved, "keep the consent just for first
   time": asked once, as in the flow's step 3.
3. Design: "built 2-3 design options on canvas and wait for my confirmation"; then "lock option C and
   add 3rd screen from option B (tick/untick searched food)". Consent text: "approved". Server: "go".
4. Monthly cap: "set on openAi side, dont do anything in App. BE it show error when limit reached".
5. The model can't be checked from here: "OKay, no problem"; the check script confirms it.
6. Unmatched foods: "show Not in our food list" (no AI estimate, changing ADR-0005 step 4).
7. Requirements: "update the existing ones".
8. Voice language in Settings: "yes, put it on canvas".
- MVP default (D-18, not answered): the amount-assumed mark is kept on the phone only.

## Not in this plan
Typed meal text read by AI, photos and labels (the rest of slice 7); voice on phones without
on-device recognition (B-15).
