# FitSphere Design System (locked 2026-11-02)

Source of truth for every screen. Live reference: the **FitSphere Design System** and **FitSphere Screens** artifacts in Claude.
Put this file at `docs/design/design-system.md`. F00 implements it as theme tokens; every feature uses it.

## Direction
Sporty, gym-floor look: condensed UPPERCASE type like scoreboards and gym signage, sharp 4 px corners, segmented "plate" bars, and a signature cut corner with diagonal Caramel stripes. Numbers lead; where there's a target, they count **down** ("1,180 KCAL LEFT"). Calm about results: going over a target is gold, never red.

**Do not copy the reference app's layout or style.** The UI reference screens are for behaviour only.

## Brand palette (only these six)
| Name | Hex |
|---|---|
| Midnight teal | `#11212D` |
| Slate | `#3D4D55` |
| Taupe | `#A79E9C` |
| Sand | `#D3C3B9` |
| Caramel | `#B58863` |
| Onyx | `#161616` |

## Colour tokens
Theme follows the phone setting (System) by default; Dark is the hero theme for demos.

| Token | Dark | Light | Use |
|---|---|---|---|
| `bg` | `#11212D` | `#F4EFEC` | Screen background |
| `surface` | `#182B37` | `#FBF8F6` | Cards, tab bar, sheets |
| `surfaceRaised` | `#213744` | `#FFFFFF` | Icon buttons, active segment |
| `surfaceSunken` | `#0C1820` | `#EDE5E0` | Inputs, tab bar (dark), segment track |
| `border` | `#2C4250` | `#DDD1CA` | 1 px outlines, dividers |
| `track` | `#263C49` | `#E6DCD6` | Empty bar segments |
| `ink` | `#F1EAE5` | `#11212D` | Primary text and numbers |
| `inkMuted` | `#A79E9C` | `#3D4D55` | Labels, hints, secondary text |
| `inkSubtle` | `#6F7F88` | `#8A817F` | Placeholders, disabled, future days |
| `accent` | `#C99A73` | `#7D5434` | Caramel as text/marks: today, links, active tab, protein |
| `accentTint` | `#3A332C` | `#F3E6DA` | Quiet caramel fill: banners, icon tiles |
| `primary` | `#B58863` | `#B58863` | Primary buttons, selected day, + Log, avatar |
| `primaryPressed` | `#9C7150` | `#9C7150` | Pressed primary |
| `onPrimary` | `#161616` | `#161616` | Text/icons on primary |
| `protein` | = accent | = accent | Protein |
| `carbs` | `#E3D5CC` | `#A88B74` | Carbs |
| `fat` | `#8FA9B5` | `#3D4D55` | Fat |
| `fatTint` | `rgba(143,169,181,.14)` | `rgba(61,77,85,.10)` | Icon tile (Log meal's Scan barcode, D-58) |
| `fiber` | `#6D8592` | `#6F8D9B` | Fiber |
| `success` | `#7FB89A` | `#3F7A5C` | Done states, password rules met |
| `successTint` | `rgba(127,184,154,.14)` | `rgba(63,122,92,.10)` | Success banners |
| `loggedDayTint` | `rgba(127,184,154,.17)` | `rgba(63,122,92,.14)` | A day with a meal in the header's month calendar (D-84) |
| `warning` | `#E8C37C` | `#96650F` | Over target |
| `warningTint` | `rgba(232,195,124,.14)` | `rgba(150,101,15,.10)` | Icon tile (Log meal's Saved meals, D-58) |
| `danger` | `#E5806F` | `#B0463A` | Errors, destructive |
| `dangerTint` | `rgba(229,128,111,.12)` | `rgba(176,70,58,.08)` | Error banners |
| `focus` | `#E3D5CC` | `#11212D` | 2 px focus ring |
| `scrim` | `rgba(5,10,14,.66)` | `rgba(17,33,45,.40)` | Behind sheets |
| `stripe` | `rgba(201,154,115,.08)` | `rgba(125,84,52,.07)` | Signature diagonal stripes |

Every status uses an icon or word as well as colour.

## Typography
Fonts: **Barlow Condensed** (600, 700, 800; 800 italic) and **Barlow** (400–700), from `@expo-google-fonts/barlow-condensed` and `@expo-google-fonts/barlow`.

| Style | Font | Size / line | Weight | Case | Use |
|---|---|---|---|---|---|
| `heroNumber` | Barlow Condensed | 84 / 76 | 800 italic | — | The one hero number (kcal left) |
| `display` | Barlow Condensed | 44–52 / 0.95× | 800 | UPPER | Screen headings (never italic) |
| `screenTitle` | Barlow Condensed | 40 / 40 | 800 | UPPER | Headings on pushed screens |
| `sheetTitle` | Barlow Condensed | 36 / 38 | 800 | UPPER | Bottom-sheet titles |
| `metric` | Barlow Condensed | 22–28 | 800 | UPPER | Stat values |
| `button` | Barlow Condensed | 20 (secondary 18) | 800, +1.5 letter-spacing | UPPER | Buttons |
| `link` | Barlow Condensed | 14–17 | 700–800, +1 | UPPER | Text links |
| `label` | Barlow Condensed | 13 / 16 | 700, +1.5 | UPPER | Field labels, overlines (inkMuted) |
| `tab` | Barlow Condensed | 12 / 14 | 700, +1.2 | UPPER | Tab labels |
| `body` | Barlow | 15 / 22 | 400 | Sentence | Descriptions |
| `input` | Barlow | 17 / 24 | 400 | — | Field values (passwords +2 letter-spacing) |
| `listTitle` | Barlow | 16 / 22 | 500 | Sentence | Settings/list row titles |
| `small` | Barlow | 13–14 / 20 | 400 | Sentence | Hints, errors, rules |

**Body text is always regular (400).** Bold is only for headings, numbers, labels and buttons (Barlow Condensed), and for an inline value inside a sentence (600).

Use tabular figures for numbers. Support the phone's text-size setting.

## Shape and spacing
- Radius: `xs` 2 (bar segments) · `sm` 4 (cards, inputs, buttons, slots, icon tiles) · `md` 8 (header icon buttons, avatar, + Log) · `sheet` 16 (sheet top corners).
- Spacing (4-pt grid): screen gutter 16 (auth screens 20), card padding 14–16, gap between cards 10–12, between fields 18.
- **Signature corner:** auth screens and sheets have a 200×200 diagonal-stripe triangle in the top-right corner (`stripe`, 135°, 10 px gap / 4 px line), clipped to `polygon(40% 0, 100% 0, 100% 60%)`. The Home hero card has a 32 px cut corner (top-right) plus the stripes.
- Heights: inputs 54, primary button 56, secondary button 52, icon buttons 40–44, tab bar 64 + safe area.
- Touch targets ≥ 44×44.

## Components (used by F01)
- **Input:** `surfaceSunken`, 1.5 px `border`, radius 4, 54 high, 14 px left padding. Label above (`label`). Focus: border `accent`. Error: border `danger` and message below (icon + `small` in `danger`). Password fields have a show/hide eye button (44×44).
- **Primary button:** full width, 56 high, radius 4, `primary` fill, `onPrimary` text, `button` style, optional → arrow icon. Disabled: 40 % opacity, not pressable. Loading: a spinner replaces the label and the width stays the same.
- **Secondary button:** 52 high, transparent, 1.5 px `border`, `ink` text. *Strong* (D-85): the same size filled `primary`, `onPrimary` text, to make a card's action stand out (Home's Add measurements once due).
- **Text link:** `link` style in `accent`, no underline.
- **Banner:** radius 4, 12/14 padding, icon + `small` text. Variants: info (`accentTint`), success (`successTint` + `success` border), error (`dangerTint` + `danger` border).
- **Password strength:** 3 segments (4 high, radius 2, 4 gap) plus a rule checklist. A met rule is `success` with a tick; unmet is `inkMuted` with a dot.
- **Code input:** 6 boxes, 64 high, `surfaceSunken`, 2 px border (active `accent`, error `danger`), digits in Barlow Condensed 34/800. One hidden input with `textContentType="oneTimeCode"` / `autoComplete="sms-otp"` and paste support.
- **Bottom sheet:** `surface`, top radius 16, grab handle 40×4, `scrim` behind, signature stripes, 56 px icon tile, `sheetTitle`, buttons stacked.
- **Wordmark:** "FIT" in `ink` + "SPHERE" in `accent`, Barlow Condensed 18/800, letter-spacing 3. Text only; there is no logo yet.
- **Icons:** Lucide (`lucide-react-native`), 2 px stroke, outline.
