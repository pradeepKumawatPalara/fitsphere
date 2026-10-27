# Project Invariants

Always-on rules for any FitSphere change. Each links to its authoritative source; D- numbers
refer to `docs/product/owner-decisions-2026-10-27.md`.

1. **Authorization is server-side.** A user can access another person's data only through an
   **accepted** link: Coach → their accepted trainees; Head Coach → the coaching activity of
   their accepted coaches (never a coach's own personal logs), and a trainee's data only after
   that trainee has been notified and has agreed. Head Coaches may then view and edit those
   trainees' plans (D-08). Removing a link ends access to all of that person's data, including
   past data. Changes queued offline are re-authorized on the server at sync time. UI hiding is
   not access control. (C-002, REQ-NFR-001, D-06, D-07, D-10)
2. **Client cannot edit coach-set targets.** (REQ-PLAN-001)
3. **No AI call without recorded consent.** Check consent on the server immediately before
   sending any meal text, photo, voice or label to an AI service. (C-004, REQ-ACC-004)
4. **Non-AI logging always works.** Food database, barcode and saved meals must not depend
   on AI. (C-005)
5. **Phase 1 serves India only.** "Today" and day membership use Asia/Kolkata, never server
   local time. Store timestamps in UTC, and store the day the user chose (REQ-LOG-002) as its
   own field — never derive it from the timestamp alone. (C-006, REQ-DATE-004, D-09)
6. **Units are display settings.** Store body weight, lifting weight and measurements in one
   canonical unit each; convert only for display/input. (REQ-ACC-002/003, MEAS-003)
7. **Sensitive data stays out of logs, analytics and fixtures.** Use synthetic test data only.
   (REQ-NFR-002)
8. **Blocked requirements stay unbuilt** until their Q- item is answered: REQ-PLAN-006 (Q-035),
   REQ-ACC-009 (Q-048).
