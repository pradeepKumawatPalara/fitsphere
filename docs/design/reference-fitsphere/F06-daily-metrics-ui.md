# F06 — Daily metrics (weight, steps, sleep): UI design (LOCKED)

| | |
|---|---|
| **Status** | UI locked 2026-11-02 |
| **Spec IDs** | HOME-006 |
| **Design source** | Canvas board *F06 · Daily metrics* (Tweaks → metric: weight / weight-error / steps-edit / sleep) |
| **Put at** | `docs/features/F06-daily-metrics/ui-design.md` |

## Decisions
| Q | Decision |
|---|---|
| Q-14 ranges | Weight 20–300 kg (one decimal); steps 0–100,000 (whole); sleep 0h–16h in 15-min steps |
| Q-15 | Steps and sleep are **manual** in MVP (health-app sync later, UX-004) |
| Sleep date | Sleep logged on a day = the sleep that **ended** that morning ("Slept last night") |
| One entry per metric per day | Saving again updates it; "Delete entry" removes it |

## Entry sheet (opens from the Home body-strip tiles)
Bottom sheet over Home (`scrim`, `surface`, top radius 16, stripe corner, grab handle). Header: close (X) on the left, the selected date on the right ("FRI 06 NOV", `accent`). Title: the metric name (40/800).

- **Weight:** −0.1 / +0.1 steppers (56×56) around a big value "72.4 KG" (80 italic) with a 2 px `accent` underline. Tapping the number opens the decimal keypad. Helper: "Last weigh-in: **72.6 kg** on Wed · Tap the number to type". It pre-fills with the last weigh-in.
- **Weight error:** the underline turns `danger`; message "Enter a weight between 20 and 300 kg."; SAVE disabled.
- **Steps:** big "6,240 STEPS", with quick-add chips +500 / +1,000 / +2,500. Helper: "Daily target **8,000** · 1,760 to go" (or "Target hit" in `success`).
- **Sleep:** "SLEPT LAST NIGHT"; two columns, hours and minutes (80 italic), each with up/down buttons (hours ±1, minutes ±15). Quick chips: 6h · 7h 30m · 8h · 9h (the selected chip is `primary`).
- Footer: "SAVE" (56). When editing an existing entry: a "DELETE ENTRY" link (`danger`), with a confirmation.

## Home tiles after saving
Weight shows "72.4 kg", steps "6,240", sleep "7h 30m". An empty tile shows "+ LOG" (`accent`). Units follow Account.
