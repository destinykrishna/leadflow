# LeadFlow — Client Conversion & Case Foundation Specification

## Overview

The Client Conversion & Case Foundation provides mortgage brokerages and advisors with a secure, atomic transition from qualified sales leads into active mortgage client cases. Once converted, expat clients receive dedicated portal credentials to log in, review their personal case, and prepare for mortgage document verification.

---

## 1. Domain Lifecycle & State Eligibility

### Pipeline Conversion Matrix

In German mortgage brokerage workflows, raw inquiries must be qualified before transitioning into active advisory cases:

| Lead Pipeline Stage | Convertible? | Rationale / HTTP Response |
| :--- | :--- | :--- |
| `NEW` | ❌ Disallowed | Raw uncontacted form submission; returns `400 ValidationError`. |
| `CONTACTED` | ❌ Disallowed | Initial contact made but qualification incomplete; returns `400 ValidationError`. |
| `QUALIFIED` | ✅ Allowed | Financial profile and mortgage viability verified. |
| `PROPOSAL` | ✅ Allowed | Bank loan comparison or pre-approval active. |
| `NEGOTIATION` | ✅ Allowed | Financing contract terms under negotiation. |
| `WON` | ✅ Allowed | Deal signed; conversion establishes portal case. |
| `LOST` | ❌ Disallowed | Disqualified or abandoned inquiry; returns `400 ValidationError`. |

### Post-Conversion Effects
- **Lead Status Transition**: Converted leads in `QUALIFIED`, `PROPOSAL`, or `NEGOTIATION` atomically advance to `WON`.
- **Bidirectional Relationship**:
  - `Client.leadId` stores the originating `Lead` `_id`.
  - `Lead.convertedClientId` stores the newly created `Client` `_id`.
- **Realtime Pipeline Notification**: When a lead stage transitions to `WON` during conversion, a `pipeline:stage_changed` event is broadcast to the brokerage's Socket.IO room (`brokerage:<brokerageId>`), automatically updating the advisor Kanban board.

---

## 2. Multi-Tenant Data Integrity & Concurrency Architecture

### Zero-Infrastructure Concurrency Protection

Duplicate client creation is prevented under concurrent conversion attempts using a three-tier defensive strategy:

```
[ Incoming Conversion Request ]
                │
                ▼
┌───────────────────────────────────────────────┐
│ Tier 1: Atomic Lead Conditional Update        │
│ Lead.findOneAndUpdate({                       │
│   _id: leadId, brokerageId,                   │
│   status: { $in: ELIGIBLE_STAGES },           │
│   convertedClientId: null                     │
│ }, { $set: { convertedClientId: newClientId }})│
└───────────────────────┬───────────────────────┘
                        │
       ┌────────────────┴────────────────┐
       ▼                                 ▼
[ Matched: 1 Request ]         [ Unmatched: Concurrent Race ]
       │                                 │
       │                                 ▼
       │                    HTTP 409 ConflictError
       ▼
┌───────────────────────────────────────────────┐
│ Tier 2: Partial Unique Database Indexes       │
│ Client: { brokerageId: 1, leadId: 1 } (unique)│
│ Client: { brokerageId: 1, userId: 1 } (unique)│
│ Lead:   { brokerageId: 1, convertedClientId } │
└───────────────────────┬───────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────┐
│ Tier 3: Compound Tenant Unique Identity       │
│ Client: { brokerageId: 1, email: 1 } (unique) │
│ User:   { brokerageId: 1, email: 1 } (unique) │
└───────────────────────────────────────────────┘
```

1. **Tier 1 — Atomic Single-Document Claim**: The database executes an atomic `findOneAndUpdate` asserting `convertedClientId: null`. If multiple concurrent requests fire, only one succeeds; remaining requests receive `null` and fail immediately with HTTP 409 (`ConflictError`).
2. **Tier 2 — Partial Unique Indexes**: Sparse/partial unique indexes guarantee that no two clients within the same brokerage can ever share a `leadId` or `userId`.
3. **Tier 3 — Tenant Scoped Unique Keys**: Compound indexes on `{ brokerageId: 1, email: 1 }` guarantee that no person can have duplicate client or user records within a brokerage.
4. **Defensive Rollback**: If client creation encounters a database collision, the atomic lead claim is rolled back and any newly provisioned user account is deleted to prevent orphaned records.

---

## 3. Client Portal Identity & Authentication

### User Provisioning & Linkage
- **Automatic Account Provisioning**: When converting a lead without an existing user account, a `User` record is created with:
  - `role: 'CLIENT'`
  - `status: 'ACTIVE'`
  - `brokerageId: lead.brokerageId`
  - `passwordHash`: bcrypt hashed password (from request body or cryptographically secure 16-character random token).
- **Existing User Account Reuse**: If a user with `role: 'CLIENT'` already exists for that email within the brokerage, the conversion links `client.userId` to that existing user without duplicating credentials.
- **Role Boundary Defense**: If an account with that email exists under a non-client role (e.g. `ADVISOR`), conversion is rejected with HTTP 409 (`ConflictError`) to prevent privilege contamination.

---

## 4. Client Case API & Anti-IDOR Protections

### Endpoints

| Method | Path | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/leads/:id/convert` | `PLATFORM_ADMIN`, `BROKERAGE_ADMIN`, `ADVISOR` | Converts lead into a client case. |
| `POST` | `/api/clients/convert/:leadId` | `PLATFORM_ADMIN`, `BROKERAGE_ADMIN`, `ADVISOR` | Alias conversion endpoint. |
| `GET` | `/api/clients/me` | `CLIENT` | IDOR-immune personal case profile lookup. |
| `GET` | `/api/clients/:id` | All Authenticated | Client case lookup (with strict ownership check). |
| `GET` | `/api/clients` | `PLATFORM_ADMIN`, `BROKERAGE_ADMIN`, `ADVISOR` | Lists brokerage clients. |

### IDOR Concealment Matrix

- **`GET /api/clients/me`**: Derives user identity exclusively from verified JWT server context (`req.user.id`). No client-supplied ID parameter exists, making ID manipulation structurally impossible.
- **`GET /api/clients/:id`**:
  - `CLIENT` role callers attempting to pass another client's ID (whether within the same brokerage or another) receive **HTTP 404 (`NotFoundError`)** via `AuthorizationService.authorizeClientAccess`. Zero information is disclosed regarding resource existence.
  - Staff callers (`ADVISOR`, `BROKERAGE_ADMIN`) querying client IDs belonging to other brokerages receive **HTTP 404 (`NotFoundError`)** via `ScopedRepository`.
  - `PLATFORM_ADMIN` retains cross-brokerage inspection capabilities.
