# Glossary

- Status: Draft
- Owner: Product owner (Q-001)
- Last updated: 2026-10-27

Defines terms the documents use loosely. Where a meaning is not decided, the entry says so and
links the open question in
[`constraints-and-assumptions.md`](../architecture/constraints-and-assumptions.md#open-questions);
it does not settle it. Role descriptions live in [`product-brief.md`](product-brief.md#target-users).

## People and roles

| Term | Meaning | Source |
|---|---|---|
| Personal Training User | The role used to log and view one's own food, body metrics and workouts. It is a role an account holds, not a kind of person. Whether every account has it is open (Q-007). | BRD §1.2; REQ-ROLE-001 |
| Trainee | A Personal Training User who is directly assigned to a Coach. The BRD writes "trainees/users". | BRD §1.2, §1.3; REQ-ROLE-005 |
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
| Coach record | The BRD's term for what a Head Coach adds, views, updates and deletes. **Not defined:** whether it is the coach's user account itself, or a separate record (for example the head-coach-to-coach assignment) linked to an account. | BRD §1.2, §1.3; REQ-ROLE-003; Q-058 |
| Trainee record | The same question one level down: what a Coach adds, views, updates and deletes. | BRD §1.2, §1.3; REQ-ROLE-005; Q-058 |

Until Q-058 is answered, together with how records are added (Q-009) and what deleting one does
(Q-010):
- do not assume that deleting a Coach or trainee record deletes a user account or its data;
- do not assume a record can exist before the person has an account.
