# Glossary

- Status: Draft
- Owner: Project owner (D-01)
- Last updated: 2026-10-27

Defines terms the documents use loosely. Where a meaning is not decided, the entry says so and
links the open question in
[`constraints-and-assumptions.md`](../architecture/constraints-and-assumptions.md#open-questions);
it does not settle it. Role descriptions live in [`product-brief.md`](product-brief.md#target-users).

## People and roles

| Term | Meaning | Source |
|---|---|---|
| Personal Training User | The role used to log and view one's own food, body metrics and workouts. It is a role an account holds, not a kind of person. Any account can turn it on (D-06, D-10). | BRD §1.2; REQ-ROLE-001 |
| Trainee | A Personal Training User who has accepted a Coach's invitation (D-06); at most one coach at a time (D-11). The BRD writes "trainees/users" and "directly assigned". | BRD §1.2, §1.3; REQ-ROLE-005, REQ-ROLE-009 |
| Self-directed user | A Personal Training User with no coach. | REQ-ROLE-007 |
| Client | The BRD overview's word for a trainee ("clients log their food intake … against targets set by their coach"). Same meaning as trainee. | BRD §1.1; REQ-PLAN-001 |
| Operator | Whoever runs FitSphere's systems. Not a role in the app. In phase 1 this is the project owner only, with no support staff; every admin access to user data is logged (D-13) and the log is reviewed monthly (D-14). | REQ-NFR-005; R-003 |
| Platform Admin | *Future scope.* A fourth role for the business owner, with the rights needed to run FitSphere as a business. Not designed; which of its rights include users' health data is open (Q-086). | D-13 |

Usage *(proposed — owner to confirm)*:
- Use **Personal Training User** for the role and **trainee** only for someone who has a coach.
  Some documents use "trainee" for any Personal Training User (e.g. journeys J-01 to J-07); read
  those in context.
- Prefer **trainee** to **client** in new text, because "client" also means the client app
  (ADR-0001). Keep "client" when quoting the BRD.

## Accounts and records

| Term | Meaning | Source |
|---|---|---|
| User account | One person's sign-in identity. One account can hold several roles (assumption A-002, not confirmed). | REQ-ACC-010; A-002 |
| Coach record | The accepted link between a Head Coach and a Coach — not a user account (D-10). It has no editable fields (D-11); the BRD's "delete" means removing (unassigning) it. | BRD §1.2, §1.3; REQ-ROLE-003; D-07, D-10, D-11 |
| Trainee record | The accepted link between a Coach and a trainee — not a user account (D-10). It has no editable fields: the BRD's "update" means editing the trainee's plans and targets, and "delete" means removing the link (D-11). | BRD §1.2, §1.3; REQ-ROLE-005; D-07, D-10, D-11 |
| Notifications list | The one in-app list where invitations, Head Coach permission requests and "no longer linked" messages appear, so none is lost if push notifications are off (D-15). | REQ-ROLE-009, REQ-ROLE-013, REQ-ROLE-014 |
| External link | A link to content a user stores on another site, such as YouTube, added instead of an upload (D-16): a coach's exercise how-to video, or a user's own photo. FitSphere stores only the link. When a link between people ends, it hides the link from the former coach or Head Coach but cannot delete the content or stop people who have the link from viewing it (R-004). | REQ-LOG-010, REQ-TRN-001 |
| View-only media | Photos, and later audio and video, that can be viewed or played in the app but not downloaded (D-16). Not copy protection: screenshots and screen recordings remain possible. | REQ-NFR-006 |
| Coaching activity | What a Head Coach sees about each of their coaches. Without a trainee's permission it is counts only: number of trainees; how many have allowed, declined or not answered; plans sent. No trainee names or data (D-13). Never the coach's own personal logs (D-10). | REQ-ROLE-004, REQ-ROLE-010 |

What follows from that:
- The link exists only after the invited person accepts (REQ-ROLE-009).
- A trainee has at most one coach, and a coach at most one Head Coach (D-11).
- A link ends by removal, by leaving (REQ-ROLE-014) or by switching (REQ-ROLE-015). Ending it
  deletes no data (D-07) and ends access to all of that person's data, including past data
  (D-10, D-11). The other side gets a neutral message, "X is no longer linked with you" (D-13,
  D-14). The former coach's or Head Coach's app then deletes that trainee's data from the phone
  on its next sync (D-13); nothing is deleted on the server, which is the permanent record (D-14).

## Releases

| Term | Meaning | Source |
|---|---|---|
| MVP | The first release: the basic product in [`mvp-scope.md`](mvp-scope.md), Android first. | D-18 |
| MVP default | An answer to an open question used for the MVP. Set by the owner in `mvp-scope.md` section 4, or chosen by Claude Code under D-18 (the simplest option that keeps every invariant) and listed in [`constraints-and-assumptions.md`](../architecture/constraints-and-assumptions.md#mvp-defaults-d-18). Any can be changed later. | D-18 |
| Post-MVP | Not in the MVP; listed in [`backlog.md`](backlog.md). | D-18 |
