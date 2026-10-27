# Product Brief

- Status: Draft
- Owner: Project owner (D-01)
- Last updated: 2026-10-27
- Source: [`source/business-requirements.txt`](source/business-requirements.txt)

## Problem
Coached fitness clients need one place to record what they eat, how their body changes and
what training they do, measured against targets their coach sets. Coaches need to set those
targets and plans and see their clients' adherence; head coaches need oversight of a team of
coaches.

Evidence: not yet documented. *(Open — Q-002: what user research or business case supports this?)*

## Target users
| Actor | Description |
|---|---|
| Personal Training User (trainee / client) | Logs food, weight, steps, sleep, measurements and workouts; follows coach-set targets and plans. May also use the app without a coach. |
| Coach | Manages directly assigned trainees; sets calorie/protein targets, diet plans and training plans. |
| Head Coach | Invites and manages Coaches; sees counts of their coaching activity (D-13), and sees a trainee's data and sets their plans and targets only while that trainee allows it (D-10, D-13). |

One person may hold several roles and switch between them in their profile (REQ-ROLE-001).
In the MVP every user is 18 or older (D-18, REQ-ACC-010); use by people under 18 is post-MVP.

## Goals
1. Make daily logging quick (floating "+", text/voice/photo meal entry, saved meals).
2. Show the client their progress against coach-set targets (calories, protein, weight, workouts).
3. Let coaches deliver diet and training plans and track trainees.
4. Give head coaches oversight of coaches and their trainees.
5. Keep AI processing of meal data consent-based (REQ-ACC-004).

Long-term aspiration — **not a proven capacity target**: FitSphere aims to support up to
20 million users. Phase 1 starts on free tiers (C-008); the backend and database decisions
(ADR-0002, ADR-0003) must show how they can grow toward this without a rewrite, and what each
stage would cost (D-15).

## Scope (first release: the MVP — D-18)
The first release is the MVP in [`mvp-scope.md`](mvp-scope.md) (D-18): the basic product from
the BRD sections 1–11, captured as REQ IDs in [`requirements.md`](requirements.md) — navigation
and global date handling, Home dashboard, measurements, Nutrition (Consumed / Diet plan / Saved),
Log meal (incl. AI reading), Training, Progress, Account & settings, and the three role views.
Parts marked **Post-MVP** wait for later releases; they and deferred edge cases are listed in
[`backlog.md`](backlog.md).

Phase 1 releases on Android first; iOS follows once an iPhone is available for testing (D-10).

The MVP comes first; slices within it are not decided. A suggested first vertical slice is in
[`../architecture/constraints-and-assumptions.md`](../architecture/constraints-and-assumptions.md#suggested-first-slice).

## Non-goals (proposed — confirm, Q-003)
- Payments, subscriptions or coach billing.
- In-app chat/messaging between coach and client (not in BRD).
- Wearable / health-platform sync for steps and sleep (BRD implies manual entry; Q-015).
- Medical advice or clinical diagnosis.

## Future scope (not in phase 1)
Recorded from the [owner decisions](owner-decisions-2026-10-27.md); not built now. Post-MVP items
are tracked in [`backlog.md`](backlog.md).
- Premium plans that gate the Head Coach role and limit how many coaches and trainees each plan
  allows (D-06). These would need payments, which are a proposed non-goal for the first release.
- Users outside India and multiple time zones (D-09).
- Invitation channels other than email and in-app, such as SMS or WhatsApp (D-11).
- A fourth role, **Platform Admin**, for the business owner, with the rights needed to run
  FitSphere as a business (D-13). Not designed yet; which of its rights include users' health
  data, and under what controls, is open (Q-086). In phase 1 the project owner is the only
  operator.
- Voice recordings and video uploads (view-only): users can store voice recordings and upload
  videos, and play them in the app; there is no download feature (D-16). Storage is decided in
  ADR-0008 (planned); limits and quotas are open (Q-090). Phase 1 keeps voice meal entry
  (REQ-LOG-005), recognised on the phone only, with no audio stored (D-16, D-18); coaches' how-to videos and users'
  own photos can already be added as YouTube or other public links (D-16).

## Success measures
Not defined in the BRD. *(Open — Q-004.)* Candidate measures for the owner to choose from:
weekly active loggers, % of days with meals logged (the Progress "days logged" metric),
coach-to-trainee plan delivery rate.

## Assumptions and open questions
All tracked centrally in
[`../architecture/constraints-and-assumptions.md`](../architecture/constraints-and-assumptions.md).
