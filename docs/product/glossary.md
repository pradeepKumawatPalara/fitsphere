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
| Trainee | A Personal Training User who has accepted a Coach's invitation (D-06). The BRD writes "trainees/users" and "directly assigned". | BRD §1.2, §1.3; REQ-ROLE-005, REQ-ROLE-009 |
| Self-directed user | A Personal Training User with no coach. | REQ-ROLE-007 |
| Client | The BRD overview's word for a trainee ("clients log their food intake … against targets set by their coach"). Same meaning as trainee. | BRD §1.1; REQ-PLAN-001 |

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
| Coach record | The accepted link between a Head Coach and a Coach — not a user account (D-10). The BRD's "delete" means removing (unassigning) it. | BRD §1.2, §1.3; REQ-ROLE-003; D-07, D-10 |
| Trainee record | The accepted link between a Coach and a trainee — not a user account (D-10). | BRD §1.2, §1.3; REQ-ROLE-005; D-07, D-10 |

What follows from that:
- The link exists only after the invited person accepts (REQ-ROLE-009).
- Removing a record ends the link and deletes no data (D-07). It also ends the remover's access to
  all of that person's data, including past data (D-10).
- What "update" changes on a record is still open (Q-081).
