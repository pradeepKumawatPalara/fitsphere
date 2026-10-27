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
| Head Coach | Invites and manages Coaches; sees their coaching activity, and a trainee's data only after that trainee agrees (D-10). |

One person may hold several roles and switch between them in their profile (REQ-ROLE-001).

## Goals
1. Make daily logging quick (floating "+", text/voice/photo meal entry, saved meals).
2. Show the client their progress against coach-set targets (calories, protein, weight, workouts).
3. Let coaches deliver diet and training plans and track trainees.
4. Give head coaches oversight of coaches and their trainees.
5. Keep AI processing of meal data consent-based (REQ-ACC-004).

## Scope (first release — proposed, pending owner approval)
All features in the BRD sections 1–11, captured as REQ IDs in [`requirements.md`](requirements.md):
navigation and global date handling, Home dashboard, measurements, Nutrition (Consumed / Diet
plan / Saved), Log meal (incl. AI parsing), Training, Progress, Account & settings, and the
three role views.

Phase 1 releases on Android first; iOS follows once an iPhone is available for testing (D-10).

Release slicing is not decided. A suggested first vertical slice is in
[`../architecture/constraints-and-assumptions.md`](../architecture/constraints-and-assumptions.md#suggested-first-slice).

## Non-goals (proposed — confirm, Q-003)
- Payments, subscriptions or coach billing.
- In-app chat/messaging between coach and client (not in BRD).
- Wearable / health-platform sync for steps and sleep (BRD implies manual entry; Q-015).
- Medical advice or clinical diagnosis.

## Future scope (not in phase 1)
Recorded from the [owner decisions](owner-decisions-2026-10-27.md); not built now.
- Premium plans that gate the Head Coach role and limit how many coaches and trainees each plan
  allows (D-06). These would need payments, which are a proposed non-goal for the first release.
- Users outside India and multiple time zones (D-09).

## Success measures
Not defined in the BRD. *(Open — Q-004.)* Candidate measures for the owner to choose from:
weekly active loggers, % of days with meals logged (the Progress "days logged" metric),
coach-to-trainee plan delivery rate.

## Assumptions and open questions
All tracked centrally in
[`../architecture/constraints-and-assumptions.md`](../architecture/constraints-and-assumptions.md).
