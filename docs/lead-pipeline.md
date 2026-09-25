# LeadFlow Pipeline Architecture & State Machine

## 1. Overview
The LeadFlow Pipeline provides mortgage brokerages and advisors with a deterministic, real-time-ready Kanban board for tracking expat leads through their conversion lifecycle:

```
[ NEW ] ───► [ CONTACTED ] ───► [ QUALIFIED ] ───► [ PROPOSAL ] ───► [ NEGOTIATION ] ───► [ WON ]
   │                 │                 │                │                 │
   ▼                 ▼                 ▼                ▼                 ▼
[ LOST ]          [ LOST ]          [ LOST ]         [ LOST ]          [ LOST ]
```

---

## 2. Lead Stages & Transition Rules

### 2.1 Supported Stages
- `NEW`: Ingested lead awaiting initial advisor outreach.
- `CONTACTED`: Advisor has initiated phone/email outreach.
- `QUALIFIED`: Expat profile evaluated (income, EU residency/Blue Card, down payment).
- `PROPOSAL`: Mortgage rate proposals and bank financing offers submitted.
- `NEGOTIATION`: Bank conditions, interest rate lock, and terms under discussion.
- `WON`: Case successfully signed and approved by lender (terminal stage).
- `LOST`: Disqualified or dropped-off lead (terminal stage).

### 2.2 Transition Constraints
```typescript
export const VALID_STAGE_TRANSITIONS: Record<LeadStatus, readonly LeadStatus[]> = {
  NEW: ['CONTACTED', 'LOST'],
  CONTACTED: ['QUALIFIED', 'LOST'],
  QUALIFIED: ['PROPOSAL', 'LOST'],
  PROPOSAL: ['NEGOTIATION', 'LOST'],
  NEGOTIATION: ['WON', 'LOST'],
  WON: [],
  LOST: [],
};
```

1. **Strict Forward Progression**: Leads progress strictly to the adjacent forward stage. Stage skipping (e.g. `NEW → QUALIFIED` or `NEW → WON`) is rejected (`400 VALIDATION_ERROR`).
2. **Terminal Stages**: `WON` and `LOST` permit zero outgoing transitions. Once reached, leads cannot be reopened or moved (`400 VALIDATION_ERROR`).
3. **Drop-Off (LOST)**: Leads may be marked `LOST` from any active intermediate stage.
4. **No Backward Transitions**: Moving backward (e.g. `QUALIFIED → CONTACTED`) is prohibited to maintain clean pipeline analytics.
5. **No Self-Transitions**: Moving to the exact same stage is rejected (`Lead is already in stage '<stage>'`).

---

## 3. Database-Level Optimistic Concurrency Control

### 3.1 The Problem
When two advisors simultaneously view the pipeline board and attempt to advance or disqualify the same lead:
- Advisor A moves Lead from `NEW` to `CONTACTED`.
- Advisor B moves Lead from `NEW` to `LOST`.
Without concurrency control, whichever write commits last silently overwrites the previous transition without notification (lost update).

### 3.2 The Solution: Atomic Conditional Update
LeadFlow solves this entirely inside MongoDB using Mongoose's internal document versioning (`__v`) and atomic conditional match filters:

```typescript
const matchFilter = {
  _id: objectId,
  status: lead.status, // exact status read before mutation
  __v: lead.__v,       // exact version read before mutation
  brokerageId: userContext.brokerageId,
};

const updatedLead = await Lead.findOneAndUpdate(
  matchFilter,
  {
    $set: { status: targetStage },
    $inc: { __v: 1 },
  },
  { returnDocument: 'after' }
);
```

1. **Atomic Matching**: Only one concurrent request can match `{ status: 'NEW', __v: 0 }`.
2. **Winner**: Updates `status` and increments `__v` to `1` in a single ACID operation, returning HTTP 200.
3. **Loser**: Finds 0 matching documents because `__v` is now `1` and `status` has changed. The server detects the zero-write conflict, verifies that the lead exists, and immediately returns HTTP 409 `ConflictError` (`code: 'CONFLICT'`).
4. **Zero Overhead**: Zero external locks, Redis dependencies, or distributed transactions required.

---

## 4. API Endpoints & Role Authorization

| Endpoint | Method | Authorized Roles | Description |
| :--- | :--- | :--- | :--- |
| `/api/leads/pipeline` | `GET` | `PLATFORM_ADMIN`, `BROKERAGE_ADMIN`, `ADVISOR` | Returns leads grouped across all 7 stages with counts |
| `/api/leads` | `GET` | `PLATFORM_ADMIN`, `BROKERAGE_ADMIN`, `ADVISOR` | Lists leads; supports `stage`, `assignedTo`, `search`, and `groupBy=stage` |
| `/api/leads/:id` | `GET` | `PLATFORM_ADMIN`, `BROKERAGE_ADMIN`, `ADVISOR` | Retrieves single lead with populated advisor details |
| `/api/leads/:id/stage` | `PATCH` | `PLATFORM_ADMIN`, `BROKERAGE_ADMIN`, `ADVISOR` | Moves lead stage with optimistic concurrency and transition validation |
| `/api/leads/:id/status` | `PATCH` | `PLATFORM_ADMIN`, `BROKERAGE_ADMIN`, `ADVISOR` | Alias route for stage updates |

- **CLIENT Role Isolation**: Users with role `CLIENT` receive HTTP 403 `ForbiddenError` if attempting to list, view, or mutate pipeline leads.
- **Tenant Isolation**: Non-platform-admin queries are strictly scoped to `req.user.brokerageId`. Requesting a lead belonging to another brokerage returns HTTP 404 `NotFoundError` (anti-IDOR defense, concealing existence).
- **Client-Supplied Brokerage IDs**: Any client-supplied `brokerageId` in query strings or request bodies is discarded for tenant roles.

---

## 5. Realtime Socket.IO Pipeline Updates

### 5.1 Architecture & Connection Lifecycle
LeadFlow integrates Socket.IO on top of the existing HTTP server (`httpServer = http.createServer(app)`) via `server/src/sockets/`.

- **Authentication Middleware (`socketAuthMiddleware`)**:
  - Validates JWT access token passed via `auth.token`, `Authorization: Bearer <token>` header, or `accessToken` cookie.
  - Enforces database active-user status and active-brokerage checks (rejecting suspended brokerages or users).
  - Establishes verified `socket.data.user` context.
- **Server-Controlled Room Assignments (`registerSocketHandlers`)**:
  - `BROKERAGE_ADMIN` & `ADVISOR`: Placed strictly into their isolated brokerage room: `brokerage:<brokerageId>`.
  - `PLATFORM_ADMIN`: Placed into `platform:admins` room to monitor platform-wide pipeline activity.
  - `CLIENT`: Placed strictly into private `client:<userId>` room. **Expat clients never join internal brokerage rooms and never receive pipeline events.**
  - **Room Manipulation Defense**: Client-initiated `join`, `join_room`, or `subscribe` events are intercepted and rejected (`403 FORBIDDEN`).
  - **Dynamic Subscription**: Only `PLATFORM_ADMIN` may dynamically subscribe to individual brokerage rooms via `subscribe_brokerage`.

### 5.2 Event Payload & PII Protection
When `leadPipelineService.moveLeadStage` successfully persists a stage transition in MongoDB, it invokes `emitPipelineStageChanged`:

```typescript
export interface PipelineStageChangedBroadcastPayload {
  leadId: string;
  brokerageId: string;
  previousStage: LeadStatus;
  newStage: LeadStatus;
  version: number;
  timestamp: string;
  updatedBy: {
    id: string;
    name: string;
    role: string;
  };
}
```

- **Events Emitted**: `pipeline:stage_changed` and `lead:stage_changed`.
- **Target Rooms**: `brokerage:<brokerageId>` and `platform:admins`.
- **Zero Sensitive Data**: Emits only state metadata (stages, version, timestamp, actor). Zero lead emails, phone numbers, notes, financial data, or tokens are broadcast.
- **Post-Commit Guarantee**: Emitted exclusively after `atomicUpdateStage` commits. If the update fails (due to validation error or 409 concurrency conflict), zero events are emitted.

