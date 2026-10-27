# Product and System Flows

- Status: Draft
- Owner: Tech lead (Q-001)
- Last updated: 2026-10-27

High-level only. Components below are **logical**; no technology is chosen (see
`docs/architecture/decisions/`). Detailed schemas will live in `docs/contracts/`.

## Main user journey (trainee daily loop)
See [`docs/product/user-journeys.md`](docs/product/user-journeys.md) J-01 to J-07.

```mermaid
flowchart TD
    A[Open app] --> B{Signed in?}
    B -- No --> S[Sign in · Q-047] --> C
    B -- Yes --> C[Load active role · REQ-ROLE-002]
    C -- Personal Training User --> H[Home for selected date]
    C -- Coach --> CV[Coach view: assigned trainees]
    C -- Head Coach --> HV[Head Coach view: coaches and their trainees]
    H --> P["+ Log meal"]
    P --> M{Method}
    M -- Text / voice / photo --> K{AI consent on?}
    K -- No --> ASK[Ask for consent] -->|Declined| ALT
    ASK -->|Accepted| AI
    K -- Yes --> AI[AI parses items] --> R[User reviews · A-006] --> SAVE
    M -- Search / barcode / eaten before / saved --> ALT[Non-AI picker] --> SAVE
    SAVE[Save meal entry] --> T[Totals vs coach targets update]
    H --> W[Log weight / steps / sleep / measurements] --> T
    H --> TR[Training: plan or empty workout] --> T
    T --> PR[Progress trends]
```

## Coach / Head Coach flow

```mermaid
flowchart LR
    HC[Head Coach] -- CRUD Coach records · REQ-ROLE-003 --> CO[Coach]
    HC -. view only? Q-021 .-> TE
    CO -- CRUD trainee records · REQ-ROLE-005 --> TE[Trainee]
    CO -- targets, diet plan, training plan · REQ-ROLE-006 --> TE
    TE -- logs food, body metrics, workouts --> DATA[(Trainee data)]
    CO -- reads adherence --> DATA
```

## System/data flow (logical)

```mermaid
flowchart TD
    subgraph Device["User device (untrusted)"]
        APP[Mobile app · C-007]
    end
    subgraph Backend["FitSphere backend (trusted)"]
        API[API]
        AUTHN[Authentication]
        AUTHZ[Authorization: role + hierarchy · C-002]
        SVC[Domain services: logging, plans, progress]
        CONSENT[Consent check · C-004]
        DB[(Database: users, roles, entries, plans)]
        FILES[(Media storage: meal photos)]
    end
    subgraph External["External services (third party)"]
        AIP[AI meal parsing · ADR-0005]
        FOOD[Food database / barcode lookup · Q-039]
        STT[Speech-to-text · Q-038]
    end
    APP -- HTTPS --> API
    API --> AUTHN --> AUTHZ --> SVC
    SVC --> DB
    SVC --> FILES
    SVC --> CONSENT
    CONSENT -- only if consent recorded --> AIP
    CONSENT -.-> STT
    SVC --> FOOD
```

Trust boundaries: device ↔ backend (all input untrusted; all authorization on backend);
backend ↔ each external service (sensitive meal data leaves our control — consent and data
processing terms required, Q-049).

Failure paths to design: AI/food-database timeout or error (keep user input, offer
alternatives); offline device (Open — offline logging not in BRD, Q-055); consent withdrawn mid-request.

## Open questions affecting flows
Q-006, Q-009, Q-021, Q-038, Q-039, Q-047, Q-049 — see
[`docs/architecture/constraints-and-assumptions.md`](docs/architecture/constraints-and-assumptions.md).
