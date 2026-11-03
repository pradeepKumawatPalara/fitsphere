# F04 — Account & settings: UI design (LOCKED)

| | |
|---|---|
| **Status** | UI locked 2026-11-02 |
| **Spec IDs** | ACCT-001, ACCT-002, ACCT-003, ACCT-006 (screen also hosts ACCT-004, 007, 008, 009 entry points) |
| **Design source** | Canvas board *F04 · Account & settings* (Tweaks → view: settings / time-zone-picker) |
| **Put at** | `docs/features/F04-account/ui-design.md` |

## Screen (scrolling, opened from the avatar)
1. Back chevron; title "ACCOUNT" (44/800).
2. **Profile row:** a 64×64 avatar (radius 8, `primary`, initial), name (Barlow Condensed 24/800), "@mudit · mudit@example.com" (body 14, `inkMuted`), an "EDIT" outline button (edits name and username).
3. **APPEARANCE:** 3 equal blocks (84 high, radius 4): SYSTEM (monitor icon), LIGHT (sun), DARK (moon). Selected is `primary` fill with `onPrimary`; the others have a 1.5 px `border`. Helper text under it changes with the choice:
   - System: "Follows your phone: light by day, dark at night if your phone does."
   - Light: "Always light, whatever your phone is set to."
   - Dark: "Always dark, whatever your phone is set to."
   Default is **System**. It applies instantly.
4. **UNITS** card with two rows, each with a compact KG | LB toggle (52-wide options, `surfaceSunken` track, selected `primary`):
   - "Body weight" / "Weigh-ins and progress"
   - "Lifting weights" / "Workouts and history"
5. **REGION** card: globe icon, "Country and time zone" / "India · Kolkata · UTC +5:30", chevron → time-zone sheet. Helper: "Sets when your day starts and ends."
6. **PRIVACY** card: "AI meal reading" with a switch (square, radius 4; **off by default**). Text: "We'll ask before any meal text, photo, voice note or label is sent to AI. Food search, barcodes and saved meals work without it." (Wired in F12.)
7. **SECURITY** card: Change password → (F01) · **Log out** (`accent`, bold) → sheet (F01) · **Delete account** (`danger`) → F16.
8. App version, centred, 12 px `inkSubtle`.

List-row titles are Barlow 500 16; secondary lines are Barlow 400 13 `inkMuted`.

## Time-zone sheet
Sheet (760 high): "TIME ZONE" title, a search field ("Search country or city", `accent` border when focused), and a list of rows "Country · City" with "UTC +5:30" underneath. The selected row is in `accent` with a tick. Footer note: "Logs you've already made stay on the day you made them."

## Rules
- Unit changes only change display; stored values stay in kg and cm.
- Every setting saves immediately (no Save button) and syncs to the account.
