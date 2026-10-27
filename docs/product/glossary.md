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
| Operator | Whoever runs FitSphere's systems. Not a role in the app. In phase 1 this is the project owner only, with no support staff; every admin access to user data is logged (D-13). | REQ-NFR-005 |
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
| Coaching activity | What a Head Coach sees about each of their coaches. Without a trainee's permission it is counts only: number of trainees; how many have allowed, declined or not answered; plans sent. No trainee names or data (D-13). Never the coach's own personal logs (D-10). | REQ-ROLE-004, REQ-ROLE-010 |

What follows from that:
- The link exists only after the invited person accepts (REQ-ROLE-009).
- A trainee has at most one coach, and a coach at most one Head Coach (D-11).
- A link ends by removal, by leaving (REQ-ROLE-014) or by switching (REQ-ROLE-015). Ending it
  deletes no data (D-07) and ends access to all of that person's data, including past data
  (D-10, D-11). The former coach's or Head Coach's app then deletes that trainee's data from the
  phone on its next sync (D-13).
