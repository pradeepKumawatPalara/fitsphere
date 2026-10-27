# Product and System Flows

- Status: Draft
- Owner: Project owner (D-01)
- Last updated: 2026-10-27

High-level only. Components below are **logical**. Chosen so far: React Native with Expo
(ADR-0001, Accepted, D-12); a TypeScript Node.js API with Supabase PostgreSQL and file storage in
Mumbai (ADR-0002, ADR-0003, Accepted, D-17); sign-in, AI meal reading, food data and offline sync
(ADR-0004 to ADR-0007, Accepted, D-18). See `docs/architecture/decisions/`. The MVP is defined in
[`docs/product/mvp-scope.md`](docs/product/mvp-scope.md) (D-18). Detailed schemas will live in
`docs/contracts/`.

## Main user journey (trainee daily loop)
See [`docs/product/user-journeys.md`](docs/product/user-journeys.md) J-01 to J-07.

```mermaid
flowchart TD
    A[Open app] --> B{Signed in?}
    B -- No --> S[Sign in: email and password · REQ-ACC-010] --> C
    B -- Yes --> C[Load active role · REQ-ROLE-002]
    C -- Personal Training User --> H[Home for selected date]
    C -- Coach --> CV[Coach view: accepted trainees]
    C -- Head Coach --> HV[Head Coach view: coaches and trainees who agreed]
    H --> P["+ Log meal"]
    P --> M{Method}
    M -- Text / voice recognised on the phone / photo --> K{AI consent on?}
    K -- No --> ASK[Ask for consent] -->|Declined| ALT
    ASK -->|Accepted| AI
    K -- Yes --> AI[AI parses items] --> R[User reviews · A-006] --> SAVE
    M -- Search / barcode / saved --> ALT[Non-AI picker] --> SAVE
    SAVE[Save meal entry] --> T[Totals vs coach targets update]
    H --> W[Log weight / steps / sleep / measurements] --> T
    H --> TR[Training: plan or empty workout] --> T
    T --> PR[Progress trends]
```

## Coach / Head Coach flow

```mermaid
flowchart LR
    HC[Head Coach] -- invite · accept · unassign · REQ-ROLE-003 --> CO[Coach]
    HC -- coaching activity: counts only · D-10 · D-13 --> CO
    HC -. data, plans and targets of trainees who allowed it · REQ-ROLE-004 · REQ-ROLE-013 .-> TE
    CO -- invite · accept · unassign · REQ-ROLE-005 --> TE[Trainee]
    CO -- targets, diet plan, training plan · REQ-ROLE-006 --> TE
    TE -- logs food, body metrics, workouts --> DATA[(Trainee data)]
    CO -- reads adherence --> DATA
```

## System/data flow (logical)

```mermaid
flowchart TD
    subgraph Device["User device (untrusted)"]
        APP[Mobile app · Android first · C-007]
        LOCAL[(On-device store · Expo SQLite, encrypted · ADR-0007)]
    end
    subgraph Backend["FitSphere backend (trusted)"]
        API[API]
        AUTHN[Authentication · Supabase Auth · ADR-0004]
        AUTHZ[Authorization: one access module · C-002 · ADR-0004]
        SVC[Domain services: logging, plans, progress, sync]
        CONSENT[Consent check · C-004]
        DB[(Database: users, roles, links, entries, plans, food list)]
        FILES[(Media storage: meal photos)]
    end
    subgraph External["External services (third party)"]
        AIP[AI meal reading · Gemini · ADR-0005]
        FOOD[Barcode lookup · Open Food Facts · ADR-0006]
        EMAIL[Email · Resend · ADR-0004]
        PUSH[Push · Expo push · ADR-0004]
    end
    APP --> LOCAL
    APP -- HTTPS · queued changes re-authorized --> API
    API --> AUTHN --> AUTHZ --> SVC
    SVC --> DB
    SVC --> FILES
    SVC --> CONSENT
    CONSENT -- only if consent recorded --> AIP
    SVC -- barcode numbers --> FOOD
    SVC -- invitation, verification and reset emails --> EMAIL
    SVC -- invitation and link-ended alerts --> PUSH
    PUSH --> APP
```

Trust boundaries: device ↔ backend (all input untrusted; all authorization on backend);
backend ↔ each external service (sensitive meal data leaves our control — consent and data
processing terms required, Q-049). The full list of people, external systems and trust
boundaries is in [`docs/architecture/system-context.md`](docs/architecture/system-context.md).

Failure paths to design: AI/food-database timeout or error (keep user input, offer
alternatives); offline device (log on the device and sync later; every queued change is
re-authorized at sync — REQ-NFR-004, ADR-0007); consent withdrawn mid-request; a link that ends
(the former coach's or Head Coach's app deletes that trainee's data on its next sync — D-13); a
phone with no sync for 30 days (clear drafts and other people's data, keep the user's own
unsynced entries; the server stays the permanent record — D-14).

Voice meal entry is recognised on the phone, so the voice never reaches the backend or any
external service (D-18, ADR-0005).

## Open questions affecting flows
Q-049 (Legal) and Q-066 (minimum age, before real users). Q-075 and Q-077 have MVP defaults
(D-18). See
[`docs/architecture/constraints-and-assumptions.md`](docs/architecture/constraints-and-assumptions.md).
