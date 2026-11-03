# FitSphere — UI/UX Context Summary (reusable)

A summary of the design work done for FitSphere (Nov 2026): the visual language, screen patterns, UX rules, every locked screen and the decisions behind them. Use it as the starting brief for another app that should feel the same.

- **Live references (Claude artifacts, private to Mudit):**
  - *FitSphere Design System*: tokens, type, components
  - *FitSphere Screens — Visual Direction*: all locked phone screens with their states under **Tweaks**
- **Full specs in the FitSphere repo:** `docs/design/design-system.md` plus one `docs/design/F0x-*-ui.md` per feature.

---

## 1. How the design was made (process worth repeating)

1. **Spec first.** Requirements live in `spec.md` with IDs (e.g. `AUTH-001`) and acceptance criteria. Every screen maps to IDs.
2. **Design system before screens.** Palette, type, radius and components were fixed first; screens only use tokens.
3. **One screen at a time, then lock.** Each screen was shown on a canvas, iterated, then explicitly **locked**. Locked means implemented exactly as designed; changes go through a new requirement.
4. **Every state designed, not just the happy path.** Each board has a **Tweaks → state/step** switch: default, typing, loading, error, empty, success.
5. **Decisions captured as they're made.** Anything the spec left open (password rules, ranges, label wording) was decided in the design and written into the feature's UI doc and `spec.md` §18.
6. **Handoff = Markdown per feature.** A `*-ui.md` per feature, with screens top-to-bottom, exact copy, states, rules and implementation notes, read by Claude Code at `/feature-ui`.

**Lessons from the feedback rounds**
- **Don't copy the reference app.** Reference screenshots are for *behaviour only*. Layout, card style and placement must be original.
- **Fitness / sporty / gym vibe** was the brief. A first "calm, rounded" pass was rejected as too generic.
- **Headings are never italic.** Italic is reserved for hero numbers.
- **Body text is always regular (400).** Bold body text was hard to read. Bold is only for headings, numbers, labels and buttons.
- The user prefers **design only, no explanations unless asked**, and **one screen at a time**.

---

## 2. Visual direction

**Sporty, gym-floor look.** Condensed UPPERCASE type like scoreboards and gym signage, sharp 4 px corners, segmented "plate" progress bars, and a signature **cut corner with diagonal Caramel stripes**. Numbers lead; where there's a target they **count down** ("1,180 KCAL LEFT"). It stays calm about results: going over a target is gold, never red.

### 2.1 Brand palette (only these six)
| Name | Hex |
|---|---|
| Midnight teal | `#11212D` |
| Slate | `#3D4D55` |
| Taupe | `#A79E9C` |
| Sand | `#D3C3B9` |
| Caramel | `#B58863` |
| Onyx | `#161616` |

**Dark** (the hero theme) = Midnight teal background, warm Sand-white text, Taupe secondary text.
**Light** = pale Sand background, Midnight text, Slate secondary text.
**Caramel is the single accent** in both themes. The theme follows the phone setting (System) by default.

### 2.2 Colour tokens
| Token | Dark | Light | Use |
|---|---|---|---|
| bg | `#11212D` | `#F4EFEC` | Screen background |
| surface | `#182B37` | `#FBF8F6` | Cards, sheets |
| surfaceRaised | `#213744` | `#FFFFFF` | Icon buttons, active segment |
| surfaceSunken | `#0C1820` | `#EDE5E0` | Inputs, tab bar, toggle tracks |
| border | `#2C4250` | `#DDD1CA` | 1 px outlines, dividers |
| track | `#263C49` | `#E6DCD6` | Empty bar segments |
| ink | `#F1EAE5` | `#11212D` | Primary text, numbers |
| inkMuted | `#A79E9C` | `#3D4D55` | Labels, hints |
| inkSubtle | `#6F7F88` | `#8A817F` | Placeholders, disabled, future days |
| accent | `#C99A73` | `#7D5434` | Caramel as text/marks: today, links, active tab |
| accentTint | `#3A332C` | `#F3E6DA` | Banners, icon tiles, selected rows |
| primary | `#B58863` | `#B58863` | Primary buttons, selected states, avatar |
| primaryPressed | `#9C7150` | `#9C7150` | Pressed |
| onPrimary | `#161616` | `#161616` | Text on primary (dark text on caramel, not white) |
| success | `#7FB89A` | `#3F7A5C` | Done states (sage) |
| warning | `#E8C37C` | `#96650F` | Over target (soft gold) |
| danger | `#E5806F` | `#B0463A` | Errors, destructive (terracotta) |
| scrim | `rgba(5,10,14,.66)` | `rgba(17,33,45,.40)` | Behind sheets |
| stripe | `rgba(201,154,115,.08)` | `rgba(125,84,52,.07)` | Signature stripes |
| Macros | protein = accent · carbs `#E3D5CC`/`#A88B74` · fat `#8FA9B5`/`#3D4D55` · fiber `#6D8592`/`#6F8D9B` | | Always labelled |

All text pairs meet WCAG AA in both themes. Every status also has an icon or word, never colour alone.

### 2.3 Typography
- **Barlow Condensed** (600/700/800, 800 italic) for headings, numbers, labels, buttons and tabs, always UPPERCASE.
- **Barlow** (400/500) for running text, sentence case.

| Style | Spec | Use |
|---|---|---|
| Hero number | BC 84/76, 800 **italic** | One per screen ("1,180") |
| Display heading | BC 44–56, 800, line-height ~0.95, **not italic** | Screen headings; the 2nd line is in accent ("WELCOME / BACK") |
| Screen title | BC 40/40, 800 | Pushed screens ("ACCOUNT") |
| Sheet title | BC 32–40, 800 | Bottom sheets |
| Metric | BC 22–28, 800 | Stat values |
| Button | BC 20, 800, +1.5 letter-spacing | Primary buttons |
| Label / overline | BC 13/16, 700, +1.5 letter-spacing, inkMuted | Field labels, card overlines |
| Tab | BC 12/14, 700, +1.2 | Tab bar |
| Body | Barlow 15/22, **400** | Descriptions |
| Input | Barlow 17/24, **400** | Field values |
| List title | Barlow 16/22, 500 | Settings rows |
| Small | Barlow 13–14, **400** | Hints, errors, rules |

Use tabular figures for numbers. Text scales with the phone's text size.

### 2.4 Shape, spacing and signature motifs
- **Radius:** 2 (bar segments) · **4 (default: cards, inputs, buttons, slots)** · 8 (header icon buttons, avatar, + LOG pill) · 16 (sheet top corners).
- **Spacing:** 4-pt grid; screen gutter 16 (auth screens 20); card padding 14–16; card gap 10; field gap 18.
- **Heights:** input 54 · primary button 56 · secondary 52 · icon button 40–44 · tab bar 64 + safe area. Touch targets ≥ 44.
- **Signature stripe corner:** a 200×200 triangle in the top-right of auth screens, tab screens and sheets. Diagonal stripes at 135° (10 px gap, 4 px line), clipped to `polygon(40% 0, 100% 0, 100% 60%)`.
- **Cut-corner hero card:** the main card has a 32 px chamfer top-right with stripes behind it.
- **Segmented "plate" bars** instead of smooth progress bars: 20 segments (14 high) for the primary metric, 10 (10 high) for secondary; gap 3, radius 2.
- **Wordmark:** "FIT" in ink + "SPHERE" in accent, BC 18/800, letter-spacing 3. Text only; no logo yet.
- **Icons:** Lucide, 2 px stroke, outline only.

---

## 3. Components

| Component | Spec |
|---|---|
| **Primary button** | Full width, 56, radius 4, primary fill, onPrimary text, optional → arrow. Disabled = 40 % opacity, never hidden. Loading = spinner replaces the label and the width stays the same. |
| **Secondary button** | 52, transparent, 1.5 px border, ink text |
| **Text link** | BC uppercase in accent, no underline ("FORGOT PASSWORD?", "LOG IN") |
| **Input** | surfaceSunken, 1.5 px border, radius 4, 54 high, label above (never a placeholder-as-label). Focus = accent border. Error = danger border + icon + message below. Password fields have an eye toggle. |
| **Password strength** | 3 segments + live rule checklist; met = success tick, unmet = muted dot |
| **Code input** | 6 boxes, 64 high, BC 34/800 digits; active = accent border; error = all danger; paste and auto-submit |
| **Block toggle** | 2–3 equal blocks, 52–56 high, selected = primary fill (units, sex, theme) |
| **Mini toggle** | KG \| LB, 52-wide options inside a sunken track (settings rows) |
| **Stepper** | ± square buttons (44–56) around a big italic number; tap the number to type |
| **Quick-add chips** | +500 / +1,000 / preset values, 40 high, radius 4 |
| **Banner** | radius 4, icon + small text. Info = accentTint · success = successTint + border · error = dangerTint + border |
| **Bottom sheet** | surface, top radius 16, grab handle, scrim, stripe corner, close X top-left, date/context top-right, BC title, actions stacked at the bottom |
| **List card** | surface card with rows divided by 1 px borders; title Barlow 500, subtitle 400 muted; chevron for navigation |
| **Selectable list row** | selected = accentTint background, accent title, filled square radio |
| **Option card** | large card with icon + BC title + body description; selected = primary fill |
| **Empty value** | "–" (never 0); empty tiles show "+ LOG" in accent |
| **Avatar** | square, radius 8, primary fill, initial in BC |

---

## 4. App shell and navigation pattern

- **Bottom tab bar** (4 tabs: Home, Nutrition, Training, Progress): surfaceSunken, icon + UPPERCASE label. Active = accent plus a **3 px accent bar on the top edge** of the tab.
- **Header on every tab:** date overline on the left ("FRI · 06 NOV"); calendar button and square avatar (opens Account) on the right.
- **Title under the header:** BC 40, UPPERCASE, not italic. Home uses a greeting: "LET'S GO," in muted + the username.
- **Floating "+ LOG" pill** (Home and Nutrition only): 52 high, radius 8, primary, "+" with "LOG" in BC italic, bottom-right above the tab bar. Content leaves bottom padding so the pill never covers anything.
- **Date model:** every screen follows a selected date. Viewing a past day shows a banner with "BACK TO TODAY →". Future days are dimmed and can't be selected. Day boundaries use the user's time zone.

---

## 5. Locked screens (FitSphere F00–F06)

### Home (F00 + F03)
1. Header + "LET'S GO, MUDIT"
2. [Past-date banner]
3. **Week volume strip:** 7 vertical bars, each filled to that day's % of the calorie target. The selected day is outlined in accent with a primary fill; future days are dimmed.
4. **"FUEL · TODAY" hero card:** cut corner with stripes. "1,180 KCAL LEFT" (hero), "1,320 eaten · target 2,500", a 20-segment bar, then protein "86 / 110 G · 24 G LEFT" with a 10-segment bar. "BY MEAL →" link.
5. **Body strip:** one card split into 3 columns: WEIGHT · STEPS · SLEEP ("+ LOG" when empty)
6. **"TRAINING · THIS WEEK 3/5":** 5 session slots. Done = filled with a tick; open = dashed outline
7. **Waist check-in** action row (accentTint)
8. + LOG pill, tab bar

**Calendar sheet:** "PICK A DAY" + TODAY button, month navigation (next is disabled on the current month), a 6×7 grid of 44 px cells. Today is outlined, the selected day filled, logged days have a sage dot, future days are disabled.

### Auth (F01): 6 screens, a shared layout
Stripe corner, centred wordmark, an optional "STEP 1 OF 2" in accent, a two-line display heading (2nd line in accent), body sub-text, fields, then the primary button + secondary link pinned to the bottom above the keyboard.
- **Sign up:** "CREATE YOUR / ACCOUNT"; email, password with a live strength bar and rules, Terms checkbox, "CREATE ACCOUNT →", "Already have an account? LOG IN". The email-taken error never confirms that the account exists.
- **Log in:** "WELCOME / BACK", "FORGOT PASSWORD?" in the password label row. States: loading, wrong details (one generic message), too many attempts (5-min lockout), session expired (info banner).
- **Forgot password (4 steps):** request → "CHECK YOUR INBOX" (neutral wording, "works once, expires in 30 min", resend countdown, OPEN EMAIL APP) → "SET A NEW PASSWORD" → "LINK EXPIRED".
- **Verify email:** a 6-digit code (link as a fallback), resend countdown, "DO THIS LATER"; success = sage tile, "YOU'RE / IN", "SET UP MY PROFILE →".
- **Change password:** current / new / confirm; signs out other devices; success banner.
- **Log out:** a bottom sheet over Account: "LOG OUT?", "LOG OUT" / "STAY LOGGED IN".

### Onboarding (F02 + F05): 5 steps with a segmented progress bar and "n / 5" counter
1. **Profile:** avatar preview with the initial, name, @username (live availability check, suggestions when taken)
2. **Base:** country and time zone pre-filled from the phone (CHANGE), KG/LB block toggles for body weight and lifting
3. **Starting weight:** a big italic stepper number and the programme start date; "SKIP FOR NOW"
4. **About you:** sex, age, height, activity level (4 described options)
5. **Goal:** Lose fat / Maintain / Build muscle option cards, plus pace (Steady / Standard / Fast)
→ **Your plan:** cut-corner card "DAILY CALORIES 2,120 KCAL" plus protein / workouts / steps, and a collapsible "HOW WE WORKED IT OUT". "USE THIS PLAN →" / "ADJUST TARGETS"
→ **Ready to train:** summary card and "GO TO HOME →"

### Account & settings (F04): scrolling screen
Profile row (square avatar, name, @handle · email, EDIT) → **Appearance** (3 blocks: System / Light / Dark, with icons; helper text explains the choice) → **My targets** → **Units** (mini toggles) → **Region** (time zone → searchable sheet: "Logs you've already made stay on the day you made them.") → **Privacy** (AI meal reading switch, off by default, plain explanation) → **Security** (Change password · Log out in accent · Delete account in danger) → version.

### My targets (F05)
"MY TARGETS" with a CUSTOM/CALCULATED tag. "Changes apply from today. Past days keep the targets they had." Rows with ± steppers (calories ±50, protein ±5, workouts ±1, steps ±500); edited rows show "Calculated: 2,120 · edited" in accent. "↺ RESET TO CALCULATED", "REDO GOAL SETUP", "SAVE TARGETS".

### Daily metrics (F06): bottom-sheet entry over Home
Close X + date, metric title. **Weight:** ±0.1 stepper, big italic value with an accent underline, last weigh-in hint (error = danger underline + message, Save disabled). **Steps:** big value + quick-add chips + "1,760 to go". **Sleep:** hours and minutes columns with up/down buttons + preset chips. Save; "DELETE ENTRY" when editing.

### Designed for direction only (not locked; restyle before use)
Nutrition › Consumed, Log meal, Workout in progress, and Progress existed in the first rounded visual pass. They need redoing in the sporty style before they're locked.

---

## 6. UX principles

1. **One hero number per screen**, counting down toward the target.
2. **Calm, not judging:** over target = gold "Over by N", never red or negative. Red only for errors and destructive actions.
3. **Thumb-first:** the primary action is full-width at the bottom; links sit where the thumb expects them.
4. **Every state designed:** empty, loading, error, success, disabled, past date.
5. **Never block the user without a way out:** skip, do later, reset to calculated, back to today.
6. **Privacy-safe auth messages:** never reveal whether an email is registered.
7. **Show your working:** calculated values come with a plain-language explanation and can be edited.
8. **Instant settings:** no Save button for preferences; changes apply immediately.
9. **History is preserved:** target, unit and time-zone changes never rewrite past days.
10. **Pre-fill sensibly:** time zone from the phone, last weigh-in, the slot you came from.

### Copy rules
- "You" for the user. Short and plain. No emoji, exclamation marks or clichés.
- UPPERCASE only via the display font (headings, labels, buttons, links). Body text is sentence case.
- Numbers: "2,500", a space before units ("110 g", "72.4 kg"), "kcal" (not "cal"), "–" for no data.
- Buttons are verbs: "Log in", "Save targets", "Use this plan".
- Empty states say what will appear and how.

---

## 7. Decisions made during design (FitSphere-specific, for reference)

| Topic | Decision |
|---|---|
| Today highlight | Caramel (spec said blue) |
| Sign-in | Email + password only |
| Password policy | 8+ characters, a number and a letter, checked live; 5 failed logins → 5-min lockout; reset link single-use, 30 min |
| Email verification | 6-digit code + link; "Do this later" allowed; 60 s resend cooldown |
| Username | 3–20 letters/numbers/_; unique; live check with suggestions |
| Targets | App-calculated (Mifflin–St Jeor × activity ± goal), **user-editable**, labelled Calculated/Custom; floors of 1,500 kcal (men) / 1,200 kcal (women); protein 1.6–2.0 g/kg |
| Week strip | Shows % of the calorie target per day |
| Ranges | Weight 20–300 kg (0.1); steps 0–100,000; sleep 0–16 h in 15 min steps |
| Steps/sleep source | Manual in the MVP (health sync later) |
| Sleep date | Sleep that ended that morning |
| Theme default | System; Dark is the demo/hero theme |
| AI consent | Off by default |
| Future dates | Not viewable or loggable |

---

## 8. Tech choices that pair with this UI
Expo (React Native) + TypeScript, Expo Router, TanStack Query, Supabase (Auth, Postgres with row-level security, Storage, Edge Functions, India region). Fonts from `@expo-google-fonts/barlow-condensed` + `@expo-google-fonts/barlow`. Icons from `lucide-react-native`. Session tokens in `expo-secure-store`. Tests: Jest + React Native Testing Library, DB/RLS tests, and Maestro for demo flows.

---

## 9. Reusing this in another app

**Keep:** the six-colour palette and tokens (or swap the palette but keep the token roles), Barlow Condensed + Barlow, 4 px radius, the stripe corner and cut-corner hero card, segmented bars, the components, the shell pattern, the UX principles, the copy rules and the one-screen-at-a-time lock process.

**Change per app:** the wordmark, tab names and icons, the hero metric, domain decisions (§7) and copy.

**Prompt to start the other app with Claude:**
> Use the attached FitSphere UI/UX context as the design language for this app: same palette tokens, Barlow Condensed + Barlow (headings uppercase, never italic; body text always regular 400), 4 px corners, signature diagonal-stripe corner and cut-corner hero card, segmented plate bars, the same components and UX principles. The layout must be original to this app; do not copy any reference app. Design one screen at a time on a canvas with every state under Tweaks, and wait for me to say "lock it" before moving on. After a feature's screens are locked, write a `docs/design/Fxx-*-ui.md` handoff with screens top to bottom, exact copy, states, decisions and implementation notes.
