# Q-049 Brief for Legal: Questions and Evidence

- Status: Draft, prepared for Legal. **Legal has not reviewed or approved anything yet:** Q-049
  is open and blocks real users ([`mvp-scope.md`](../product/mvp-scope.md) slice 8; ADR-0002 to
  ADR-0005).
- Owner: Project owner (D-01). Answers: Legal.
- Last updated: 2026-11-05 (D-50: L-17, the Compendium of Physical Activities; E-20). 2026-11-04 (the profile, REQ-ACC-011, D-38). Before that: 2026-10-30
- Record: [Q-049](../architecture/constraints-and-assumptions.md#account-security-and-quality)

This brief collects, in one place, what FitSphere needs Legal to answer before real users, and
the evidence for each question. It adds no new decisions. Each question cites the record it comes
from. D- numbers are the owner's decisions in
[`owner-decisions-2026-10-27.md`](../product/owner-decisions-2026-10-27.md); Q-, R- and C- numbers
are in [`constraints-and-assumptions.md`](../architecture/constraints-and-assumptions.md).

Nothing here is legal advice. A statement such as "the owner decided" or "accepted risk" records
the owner's choice, not Legal's approval.

## 1. FitSphere in brief

- **What it is:** a commercial fitness app for Android. Phase 1 serves users in India only (D-09).
  The first release (the MVP) has one kind of user, the Personal Training User. They log their own
  meals, body weight, measurements, steps, sleep and workouts against targets they set themselves
  (D-20). Coaches and Head Coaches come after the MVP.
- **Who uses it:** adults. Sign-up asks the person to confirm "I am 18 or older". FitSphere does
  not verify this (D-18, Q-066).
- **Data:** body, health and meal data, including meal photos, treated as sensitive personal data
  (REQ-NFR-002). Sign-in uses an email address and a password (D-05).
- **Status:** built and tested with synthetic data only. **There are no real users.**

### Where data is kept

| Place | What it holds | Location |
|---|---|---|
| Supabase (database, file storage, sign-in) | Accounts, all logged data, meal photos | Mumbai (ADR-0002, ADR-0003). Free plan, no backups (D-16, accepted risk R-005) |
| The API (FitSphere's server code) | Nothing stored; it is the only path to the data (ADR-0002) | The owner's PC during development; Google Cloud Run in Mumbai once Q-087 is settled |
| The user's phone | An encrypted copy of the user's own recent data (ADR-0007) | The phone |

### External services, and what each receives

| Service | Receives | When | Where it processes data |
|---|---|---|---|
| Open Food Facts | The barcode digits only, with FitSphere's name and the owner's contact address in the request (ADR-0006 rule 2) | Barcode lookups, built | Not recorded |
| Google (Gemini AI) | Meal text and photos, only after the user turns on AI meal reading (invariant #3, REQ-ACC-004). No name, email or user ID (ADR-0005) | AI meal reading, MVP slice 7, not built | May be outside India (ADR-0005) |
| Resend | Email addresses, for sign-up and password-reset emails (ADR-0004) | Release slice, not set up | Not recorded |
| Google Play | The app's listing and downloads | Release | Not applicable |
| Expo (EAS Build) | The app's source code, to build it; no user data | Development and release | Not applicable |
| Cloudflare Quick Tunnel | Test traffic between the owner's phone and PC, synthetic data only (D-19) | Development only | Not recorded |

## 2. Questions for Legal

Each question gives the facts, FitSphere's current approach, and the answer needed. "MVP" marks
what the first release needs; "post-MVP" marks parts of Q-049 that apply only once coaches exist
(D-20).

### A. Personal data: India's Digital Personal Data Protection Act 2023 (C-003, Q-049)

**L-01 Where data is stored and processed (MVP).**
- Facts: everything FitSphere stores is in Mumbai (table above). The AI provider may process meal
  text and photos outside India (ADR-0005). Where Resend and Open Food Facts process data, and
  where the API's logs will be kept on Cloud Run, is not recorded (ADR-0002: "Where logs are stored
  is checked against Q-049"). Logs exclude health data (invariant #7).
- Question: does the Act, or any rule under it, restrict any of these flows, and must the user be
  told about any of them?
- Also asked, post-MVP: may media be stored outside India with a cheaper provider (Q-091,
  ADR-0008)?

**L-02 Notice and consent for using the app (MVP).**
- Facts: no privacy notice or policy is in the repository yet. Sign-up records the time and the
  version of the age-confirmation text shown (REQ-ACC-010). No acceptance of a notice or of terms
  is recorded.
- Question: what notice must users get, what consent is needed to process their health data, and
  how must each be recorded?

**L-03 Consent for AI meal reading (MVP, slice 7).**
- Facts: AI is off until the user turns it on. The server checks consent immediately before every
  AI call (invariant #3). Each change records on, off, the time and the version of the consent
  text; one toggle covers typed or spoken text, photos and labels (Q-065, MVP default). The
  provider may process requests outside India, and how long it keeps them is to be checked
  against its terms (ADR-0005). The consent text is written, version `2026-10-30`
  (`AI_CONSENT_TEXT`, E-19); the switch and its record come with slice 6 and the AI calls with
  slice 7 (D-31).
- Question: is this consent record enough, and what must the consent text say?

**L-04 Deleting an account (MVP).**
- Facts: "Delete account" deletes the user's data and files and the sign-in account. Only the
  security logs required by REQ-NFR-005 are kept, without health data. A public web page will
  explain how to ask for deletion by email (Q-048 MVP default, REQ-ACC-009). There are no backups
  in phase 1 (R-005). Once backups exist, how long they keep deleted data is open (REQ-LOG-006).
  The page's draft text, with its open points marked, is
  [`account-deletion-page.md`](account-deletion-page.md) (D-31).
- Question: is this what the Act requires to be deleted and kept, and on what timeline?

**L-05 How long data is kept (MVP).**
- Facts: the server keeps a user's data while the account exists (D-14). A user's media is never
  deleted automatically while the account exists (D-16). Every admin access to user data must be
  logged, and the log kept for 1 year (D-13, D-14, REQ-NFR-005); the log is not in the data model
  yet. The owner
  is the only operator and reviews their own access; dashboard access is outside the log
  (accepted risk R-003).
- Question: are these periods acceptable, and is anything else required, given that phase 1 has
  no backups (R-005)?

**L-06 Age (MVP).**
- Facts: users confirm "I am 18 or older"; FitSphere records the confirmation but does not verify
  it (D-18, Q-066).
- Question: is a self-declared confirmation enough? Post-MVP: what would use by people under 18
  need (backlog B-16)?

**L-07 Public links instead of uploads (MVP).**
- Facts: a user may add an https link to an image they keep on another site instead of uploading
  a photo. Before saving, the app shows "Anyone who has this link can view it. FitSphere cannot
  delete content stored on other sites." The user must confirm (REQ-LOG-010). FitSphere cannot
  delete or revoke that content (accepted risk R-004; D-16, D-17).
- Question: is this warning enough?

**L-07a The profile (MVP; D-38).**
- Facts: in Settings the user may add, all optional, a photo, their name, date of birth, sex,
  height, phone number (+91, not verified) and address; the weight shown is their latest weigh-in,
  and the sign-in email is shown read-only (REQ-ACC-011). FitSphere does not use these details for
  anything yet, shows them to no one else in the MVP (D-20), never sends them to another service,
  never logs them, and deletes them, with the photo, with the account (REQ-ACC-009). They are
  stored in Mumbai with the rest (ADR-0002); the date of birth must give an age of 18 or more.
- Question: may FitSphere collect contact details (phone, address) it does not use yet (data
  minimisation), and what must the notice say about them and about the body details?

**L-08 Coaches (post-MVP).**
- What a coach sees of a trainee's data (Q-059). Whether the trainee's permission step for a Head
  Coach meets the Act's consent rules, and how long its answers are kept after an account is
  deleted (REQ-ROLE-013, D-13).

### B. The IFCT 2017 food values and NIN's terms (D-25, accepted risk R-007)

**L-09 Using IFCT 2017 without NIN's written permission (MVP).**
- Facts: FitSphere's food list holds the values of 542 foods from the *Indian Food Composition
  Tables 2017* (IFCT 2017), published by the National Institute of Nutrition (NIN), Hyderabad.
  - The values are kept in a CSV file in FitSphere's private GitHub repository. They are loaded
    into the database and sent to each user's phone, which keeps a copy for offline search.
  - Each meal keeps the values for the amount eaten.
  - The app shows the book's own citation wherever IFCT values are shown (D-25). Since D-44
    (2026-11-04) it is one tap away: Search foods has an i ("Food sources") that opens it, with
    INDB's credit; it is not on screen until tapped.
  - The book's copyright page says:
    > The use and dissemination of the data in this book is encouraged. This publication can be
    > reproduced for personal use with full acknowledgment of the source. However, no part of this
    > publication can be stored or reproduced in any electronic format for creating a product
    > without the prior written permission of the National Institute of Nutrition, Hyderabad.
- FitSphere's current approach: the owner decided to use the list without asking NIN for
  permission, and accepted the risk as R-007, "not a release blocker" (D-25).
- Question: what is FitSphere's exposure under these terms, and what would reduce it (for example
  asking NIN for permission, changing the attribution, or removing the data)? Is a citation one tap
  away, behind an i, "full acknowledgment of the source", or must it stay on screen (D-44)? The owner's decision
  stands unless the owner changes it; Legal's view informs that choice.

**L-10 Where the values were copied from (MVP).**
- Facts: the values were copied from a 17-page compilation of IFCT 2017, not from NIN's book. Its
  compiler is not named; its file metadata names ReportLab and 2026-09-25. Its own note says
  "Written permission from NIN … is required before shipping this in a commercial application"
  ([`food-list-sources.md`](../data/food-list-sources.md)).
- Question: does copying from a third-party compilation add any issue beyond L-09?

**L-11 Other NIN documents (MVP).**
- Facts: four other NIN documents were read while deciding how to define dishes. FitSphere uses
  none of their contents as data, with one exception: 1 katori = 200 ml, the size NIN's 2024
  *Dietary Guidelines for Indians* calls medium (D-26). Their terms include:
  - the 2024 guidelines: nearly the same "for creating a product" clause as the IFCT book;
  - the 2011 manual: "Readers are not supposed to either reproduce / copy / reprint the same for
    commercial purpose."
  - All five PDFs are kept on the owner's PC, outside the repository. FitSphere's documents quote
    short passages from them.
  - Details and hashes: [`docs/sources/README.md`](../sources/README.md).
- Question: may FitSphere use the 200 ml katori size, keep the copies, and quote those passages?

**L-16 Brands' own labels (MVP).**
- Facts: since D-49 (2026-11-04) FitSphere keeps a sheet of packaged foods with the values their
  brands publish on their own websites (`docs/data/brand-labels-sheet.csv`). Only the energy,
  protein, carbohydrate, fat, fibre and serving are copied, never descriptions or images; each
  row keeps the page and date; the owner approves each row. The websites are "all rights
  reserved".
- Since D-52 (2026-11-06) 187 more rows: about half read from shops' listings (Blinkit, Flipkart,
  Amazon, BigBasket, Swiggy Instamart, Spencer's), mostly from the shop's photo of the pack's label,
  some from the shop's typed text; 51 from files the owner made with another AI tool; one (Catch Chat
  Masala) from Open Food Facts (ODbL, see L-13). They carry the server-only flag `scrap`.
- Since D-53 (2026-11-06) 408 more rows (bread, biscuits and most other categories) hold an AI tool's estimates from its
  general knowledge, not read from any label, flagged `llm` on the server; the app shows them like
  the other brand labels, and its credit says the values are as printed on each product's label
  (R-012).
- Questions: may FitSphere copy these nutrition facts from the brands' websites into its food list?
  Does it matter that the same facts are printed on the packs, as FSSAI requires? Should FitSphere
  ask brands, or prefer reading packs? May it copy the values from a shop's listing, or from the
  shop's photo of the pack? May it show an AI's estimate under a brand's name without saying it is
  an estimate?

**L-15 The Indian Nutrient Databank's recipes (MVP).**
- Facts: since D-46 (2026-11-04) the food list holds INDB's 1,014 recipes with their values and
  servings ([`food-list-sources.md`](../data/food-list-sources.md)).
  - INDB is published with an open-access article (CC BY 4.0); its data, on GitHub, names no
    licence.
  - Its recipes come from two copyrighted cookbooks (*The Art & Science of Cooking*, *Basic Food
    Preparation*) and from websites; its values mostly from IFCT 2017 (L-09).
  - FitSphere copies the recipe names and the values per 100 g and per serving, not the
    ingredients or methods; it credits the article and the databank behind Search foods' i.
  - The owner accepted the risk (R-009) without asking the authors.
- Questions: may FitSphere use INDB's data in the app as it does? Is the credit enough, and in the
  right place? Should the authors be asked for permission, and do the cookbooks' or NIN's terms
  reach the values?

### C. Dishes: FitSphere's standard-recipe method (D-26 answer 3, amended 2026-10-30)

**L-12 Dish values calculated from IFCT values (MVP).**
- Facts:
  - A dish such as "1 roti" is defined by FitSphere's own standard-recipe sheet
    ([`standard-recipe-sheet.csv`](../data/standard-recipe-sheet.csv)). The owner weighs the raw
    ingredients of each recipe and approves it.
  - A dish's values are IFCT's values per 100 g × the raw grams of each ingredient in one portion,
    added up. They are marked "estimated". The one exception is the boiled egg, which uses IFCT's
    own value for a boiled egg (M004) per gram of the cooked egg.
  - For oils and ghee, which IFCT gives no energy value, FitSphere uses 9 kcal per gram of fat. This
    is the general factor in FAO Food and Nutrition Paper 77.
  - NIN's guidelines, the Indian Nutrient Databank and USDA data are not used for the dishes.
    (INDB's recipes are listed as foods of their own since D-46: L-15.)
  - No dish has values yet; the sheet's gram fields are empty.
- Questions:
  - Are values calculated from IFCT values covered by the same NIN terms (L-09)?
  - What should the app say about where a dish's values come from?
  - Is a statement needed that the values are estimates, beyond the "estimated" label?

### D. Open Food Facts and the Open Database License (ADR-0006 rule 2)

**L-13 The share-alike duty (MVP).**
- Facts:
  - Barcode lookups use Open Food Facts, whose database is available under the Open Database
    License (ODbL), a "share-alike" licence (ADR-0006).
  - Only the barcode digits are sent. A product found is stored in its own table, `barcode_products`,
    with its name, brand, values per 100 g and the address of its Open Food Facts page. That table
    is kept apart from the IFCT list, to keep the share-alike duty to that table (ADR-0006 rule 2;
    Legal to confirm).
  - The app shows "Contains data from Open Food Facts, available under the Open Database License"
    where a product is shown.
  - Since D-48 (2026-11-04, ADR-0009), FitSphere also takes Open Food Facts' **whole data export**:
    its 9,764 products sold in India with usable values (name, brand, values per 100 g, serving)
    go in their own table, `packaged_foods`, and a copy goes to every phone, for search by name and
    brand. The credit is behind Search foods' i.
  - When a user adds a product to a meal, the meal keeps the product's name and its values for the
    amount eaten. The phone keeps a copy of each meal.
  - FitSphere stores no product images.
- Questions:
  - Does keeping the products in their own table limit the share-alike duty to that table, now that
    a copy of the Indian products is on every phone (D-48)? Must FitSphere offer that copy under
    the ODbL?
  - Are users' meals that copy a product's values a derivative database, a produced work, or
    neither?
  - What must FitSphere publish or offer, and is the attribution text enough, and shown in the
    right places?

### E. The Compendium of Physical Activities' values (D-50, accepted risk R-011)

**L-17 Calories burned estimated with the Compendium's METs (MVP).**
- Facts: since D-50 (2026-11-05) FitSphere's exercise list names, for most exercises, an activity of
  the *2024 Adult Compendium of Physical Activities* and copies its MET value unchanged
  ([`exercise-list-sources.md`](../data/exercise-list-sources.md)). The app estimates calories
  burned as MET × the user's weight × the time, marks the result "estimated", and credits the
  Compendium where it is shown; a number typed from a machine or watch replaces it.
  - The Compendium's website says: "The Adult, Older Adult, and Wheelchair Compendia are free to use
    for commercial purposes", and asks that MET values are not changed and that the Compendium is
    cited.
  - The journal article that publishes it (Journal of Sport and Health Science, 2024) is under CC
    BY-NC-ND 4.0, which does not allow commercial use.
  - FitSphere copies 145 activity codes and their METs (104 for the list, 41 more for running's,
    walking's and cycling's speeds), not the Compendium's descriptions. The owner
    accepted the risk for now (R-011) without asking the authors.
- Questions: does the website's statement allow FitSphere's use, given the article's licence? Is the
  credit enough, and in the right place? Should the authors be asked (the site gives
  compendiumpa@gmail.com)?

### F. Home-style foods from an AI tool's estimates (D-59, accepted risk R-013)

**L-18 Typical values estimated by an AI tool (MVP).**
- Facts: since D-59 (2026-11-06) FitSphere lists home-style forms of daily foods (31 bread forms so
  far: a slice, butter toast, bread omelette), with values another AI tool estimated from its
  general knowledge for a typical home recipe, approved by the owner. They show untagged, before the
  user's own foods, without "estimated"; the sources sheet behind Search foods' i says they are
  typical values for a home recipe. They name no brand.
- Questions: is that enough for users to know these values are estimates? Does a calorie app need
  to say more where values are not measured or published?

### G. Anything else before real users

**L-14 What else is needed (MVP).**
- Question: what else must be in place before the release? For example: the privacy notice
  (L-02), a contact for complaints, the deletion-request web page (L-04), the terms of use, the
  Google Play listing's data declarations, and the data-processing terms with each provider in
  section 1.

## 3. Evidence checklist

"In the repository" items are in FitSphere's private GitHub repository. Items marked "To obtain"
or "Not written yet" are not available yet.

| # | Evidence | Where | For | Status |
|--:|---|---|---|---|
| E-01 | System boundary, external services, trust boundaries | [`system-context.md`](../architecture/system-context.md), [`flow.md`](../../flow.md) | L-01 | In the repository (Draft) |
| E-02 | What is stored, field by field, and on the phone; retention | [`data-model.md`](../contracts/data-model.md) | L-01, L-04, L-05 | In the repository (Draft) |
| E-03 | Data categories, threats, permission matrix, open risks | [`data-and-threat-model.md`](../security/data-and-threat-model.md) | L-01 to L-08 | In the repository (Draft) |
| E-04 | Requirements: REQ-NFR-002, REQ-NFR-005, REQ-ACC-004, REQ-ACC-009, REQ-ACC-010, REQ-ACC-011, REQ-LOG-010 | [`requirements.md`](../product/requirements.md) | L-02 to L-07a | In the repository (Draft) |
| E-05 | Owner decisions D-09, D-13, D-14, D-16 to D-20, D-25 to D-27, D-38 | [`owner-decisions-2026-10-27.md`](../product/owner-decisions-2026-10-27.md) | All | In the repository (Accepted) |
| E-06 | Accepted risks R-003, R-004, R-005, R-007, R-008; MVP defaults | [`constraints-and-assumptions.md`](../architecture/constraints-and-assumptions.md) | All | In the repository |
| E-07 | Hosting in Mumbai; media links; logs | [ADR-0002](../architecture/decisions/ADR-0002-backend-and-hosting.md), [ADR-0003](../architecture/decisions/ADR-0003-primary-database.md) | L-01, L-05 | In the repository (Accepted) |
| E-08 | Sign-in, emails through Resend | [ADR-0004](../architecture/decisions/ADR-0004-accounts-auth-and-notifications.md) | L-01, L-02, L-06 | In the repository (Accepted) |
| E-09 | AI provider, consent record | [ADR-0005](../architecture/decisions/ADR-0005-ai-meal-reading.md) | L-01, L-03 | In the repository (Accepted); AI not built |
| E-10 | Food data: IFCT list, the Indian Nutrient Databank's recipes (no licence stated, credited; D-46, R-009), Open Food Facts (barcodes; since D-48 also its Indian products for search, ADR-0009); brands' own labels from their websites, approved by the owner (D-49, R-010); USDA FoodData Central's FNDDS (public domain, CC0; D-39) archived, not served (D-47) | [ADR-0006](../architecture/decisions/ADR-0006-food-data.md) | L-09 to L-13 | In the repository (Accepted) |
| E-11 | Where the IFCT values come from, the terms, the citation, the dish method | [`food-list-sources.md`](../data/food-list-sources.md) | L-09 to L-12 | In the repository (Draft) |
| E-12 | The NIN documents read, with hashes and terms | [`docs/sources/README.md`](../sources/README.md) | L-09 to L-11 | In the repository (Draft) |
| E-13 | The NIN PDFs and the IFCT compilation PDF | `D:\fitsphere-data\` on the owner's PC, identified by the hashes in E-11 and E-12 | L-09 to L-11 | On the owner's PC; available on request |
| E-14 | The IFCT values as used, and the recipe sheet | [`data/foods/ifct2017-foods.csv`](../../data/foods/ifct2017-foods.csv), [`standard-recipe-sheet.csv`](../data/standard-recipe-sheet.csv) | L-09, L-12 | In the repository |
| E-15 | Texts the app shows: the IFCT citation and Open Food Facts' attribution (`IFCT_ACKNOWLEDGEMENT`, `OFF_ATTRIBUTION` in `packages/shared/src/contracts.ts`); the public-link warning (`LINK_WARNING` in `apps/mobile/src/components/MealPhotoField.tsx`); "I am 18 or older" (`apps/mobile/src/auth/texts.ts`) | The code | L-06, L-07, L-09, L-13 | In the repository |
| E-16 | The licences and terms of IFCT 2017 and Open Food Facts | Quoted in E-11 and E-12; [ODbL page](https://wiki.openfoodfacts.org/ODBL_License) | L-09 to L-13 | Read 2026-10-27 to 2026-10-30; current text to obtain for the review |
| E-17 | Each provider's data-processing terms: Supabase, Google Cloud (Cloud Run, Gemini), Resend, Expo, Open Food Facts | — | L-01, L-03, L-14 | To obtain |
| E-18 | The privacy notice, terms of use, deletion-request page, complaints contact | Deletion page draft: [`account-deletion-page.md`](account-deletion-page.md) | L-02, L-04, L-14 | Deletion page drafted 2026-10-30 (D-31), with its open points marked; the others not written yet |
| E-19 | The AI consent text | `AI_CONSENT_TEXT` in `packages/shared/src/contracts.ts` | L-03 | Written 2026-10-30, version `2026-10-30` (D-31); not yet reviewed |
| E-20 | The Compendium's PDF, its terms as quoted, and the codes and METs the exercise list uses | [`exercise-list-sources.md`](../data/exercise-list-sources.md), [`data/exercises/exercise-list.csv`](../../data/exercises/exercise-list.csv); the PDF on the owner's PC, identified by its hash there | L-17 | In the repository (Draft) |

## 4. How answers are recorded

Legal's answers update the Q-049 row and the documents each one affects. Where an answer changes
a decision, it goes to the owner as a new D- decision. Until Legal has answered, FitSphere has no
real users ([`mvp-scope.md`](../product/mvp-scope.md) slice 8). The release-blocking tasks are
listed in [`backlog.md`](../product/backlog.md).
