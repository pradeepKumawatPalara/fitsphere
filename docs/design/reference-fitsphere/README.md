# Reference examples: FitSphere F0x UI designs

These files are **examples only** (D-35, 2026-11-03). They show how the design language in
[`../design-system.md`](../design-system.md) and
[`../FitSphere-UI-UX-context.md`](../FitSphere-UI-UX-context.md) was applied to the screens of a
separate FitSphere spec. They are kept as received.

- Do not build their features, screens or flows from them.
- Do not apply their decisions here: ranges, password and target rules, calculations, flows or
  copy.
- Their IDs (`AUTH-001`, `NAV-001`, `Q-01` and so on) belong to that spec's `spec.md`, which is
  not in this repository. They are not this repository's REQ- or Q- IDs, even where the numbers
  look alike.
- Ignore their "Put at `docs/features/...`" lines, the `/feature-start` and `/feature-ui`
  commands, and their implementation notes (such as F01's Supabase client calls). This app's
  stack is set by the accepted ADRs in `docs/architecture/decisions/`.

What to build comes from `docs/product/` and the slice plans; how it looks comes from the design
language. Use these files only to see that language in context.

| File | Shows |
|---|---|
| `F00-F03-home-shell-ui.md` | Tab shell, Home, the date strip and the calendar sheet |
| `F01-auth-ui.md` | Sign up, log in, password reset, email verification, change password, log out |
| `F02-onboarding-ui.md` | Onboarding steps |
| `F04-account-ui.md` | Account and settings, the time-zone sheet |
| `F05-targets-ui.md` | Targets: about you, goal, your plan, my targets |
| `F06-daily-metrics-ui.md` | Weight, steps and sleep entry sheets |
