# Project Invariants

Always-on rules for any FitSphere change. Each links to its authoritative source.

1. **Authorization is server-side.** Every read/write checks the caller's granted roles and
   hierarchy (self; coach → directly assigned trainees; head coach → managed coaches and their
   trainees). UI hiding is not access control. (C-002, REQ-NFR-001)
2. **Client cannot edit coach-set targets.** (REQ-PLAN-001)
3. **No AI call without recorded consent.** Check consent on the server immediately before
   sending any meal text, photo, voice or label to an AI service. (C-004, REQ-ACC-004)
4. **Non-AI logging always works.** Food database, barcode and saved meals must not depend
   on AI. (C-005)
5. **Dates use the user's time zone.** Compute "today" and day membership from the user's
   configured time zone, never server local time. Store timestamps unambiguously (UTC +
   the user's zone). (C-006, REQ-DATE-004)
6. **Units are display settings.** Store body weight, lifting weight and measurements in one
   canonical unit each; convert only for display/input. (REQ-ACC-002/003, MEAS-003)
7. **Sensitive data stays out of logs, analytics and fixtures.** Use synthetic test data only.
   (REQ-NFR-002)
8. **Blocked requirements stay unbuilt** until their Q- item is answered: REQ-PLAN-006 (Q-035),
   REQ-ACC-009 (Q-048).
