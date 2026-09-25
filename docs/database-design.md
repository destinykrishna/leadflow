# LeadFlow Database Design & Strategy

## 1. Overview & Technology Stack
- **Database**: MongoDB 8+
- **ODM**: Mongoose 9.x (Node.js)
- **Language**: TypeScript 7+ (NodeNext ES Modules)
- **Testing Engine**: `mongodb-memory-server` 11.x

---

## 2. Multi-Tenant Scoping Standard

### 2.1 The `brokerageId` Field
All tenant-scoped models must declare:
```ts
brokerageId: {
  type: Schema.Types.ObjectId,
  ref: 'Brokerage',
  required: [true, 'brokerageId is required for tenant isolation'],
  index: true,
}
```

### 2.2 Indexing Rules
1. **Compound Indexes**: When creating query indexes on tenant-scoped collections (e.g. `email`, `status`, `createdAt`), `brokerageId` must be the leading key in the compound index:
   ```ts
   // Scoped duplicate checking within a brokerage
   schema.index({ brokerageId: 1, email: 1 }, { unique: true });
   
   // Scoped pipeline status queries sorted chronologically
   schema.index({ brokerageId: 1, status: 1, createdAt: -1 });
   ```
2. **Cross-Tenant Uniqueness**: Uniqueness constraints for tenant resources (e.g., lead email within a brokerage) are compound unique indexes on `{ brokerageId: 1, email: 1 }`. This allows separate brokerages to independently register the same lead email without collision, while preventing duplicate entries within any single brokerage.

### 2.3 Query Scoping Helper
To prevent developer error and ensure tenant boundaries are never crossed, queries pass through `withBrokerageScope`:
```ts
const filter = withBrokerageScope(brokerageId, { status: 'NEW' });
// filter is typed and guaranteed to have: { brokerageId: Types.ObjectId, status: 'NEW' }
```

---

## 3. Core Domain Models (Phase 1, Prompt 2)

### 3.1 Brokerage (Tenant Root)
- **Collection**: `brokerages`
- **Fields**:
  - `name`: String (required, trimmed, 2-100 chars)
  - `slug`: String (optional, trimmed, lowercase, unique, sparse)
  - `plan`: Enum `['FREE', 'STARTER', 'GROWTH', 'ENTERPRISE']`, default `'STARTER'`
  - `status`: Enum `['ACTIVE', 'SUSPENDED', 'TRIAL']`, default `'ACTIVE'`
  - `timestamps`: `true` (`createdAt`, `updatedAt`)
- **Indexes**:
  - `{ name: 1 }`
  - `{ status: 1 }`
  - `{ slug: 1 }` (unique, sparse)

### 3.2 User (Staff & Agents)
- **Collection**: `users`
- **Fields**:
  - `brokerageId`: ObjectId (ref: `Brokerage`, conditionally required for `BROKERAGE_ADMIN`, `ADVISOR`, `CLIENT`; null/optional for `PLATFORM_ADMIN`, indexed)
  - `name`: String (required, trimmed, max 100)
  - `email`: String (required, lowercase, trimmed, validated format)
  - `passwordHash`: String (required)
  - `role`: Enum `['PLATFORM_ADMIN', 'BROKERAGE_ADMIN', 'ADVISOR', 'CLIENT']`, default `'ADVISOR'`
  - `status`: Enum `['ACTIVE', 'INACTIVE', 'SUSPENDED']`, default `'ACTIVE'`
  - `phone`: String (optional, trimmed)
  - `timestamps`: `true`
- **Indexes**:
  - `{ brokerageId: 1, email: 1 }` (unique: true, partial filter for non-null `brokerageId` — scoped user uniqueness)
  - `{ email: 1 }` (unique: true, partial filter for `role: 'PLATFORM_ADMIN'` — global platform admin uniqueness)
  - `{ brokerageId: 1, role: 1 }`
  - `{ brokerageId: 1, status: 1 }`

### 3.3 Lead (CRM Pipeline Entries)
- **Collection**: `leads`
- **Fields**:
  - `brokerageId`: ObjectId (ref: `Brokerage`, required, indexed)
  - `firstName`: String (required, trimmed, max 60)
  - `lastName`: String (required, trimmed, max 60)
  - `email`: String (required, lowercase, trimmed, validated format)
  - `phone`: String (optional, trimmed)
  - `status`: Enum `['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']`, default `'NEW'`
  - `source`: Enum `['WEBSITE', 'REFERRAL', 'ZILLOW', 'REALTOR', 'CAMPAIGN', 'MANUAL', 'OTHER']`, default `'MANUAL'`
  - `score`: Number (min 0, max 100, default 0)
  - `assignedTo`: ObjectId (ref: `User`, optional, indexed)
  - `notes`: String (optional, max 5000)
  - `customFields`: Map of Mixed (default empty Map)
  - `timestamps`: `true`
- **Indexes**:
  - `{ brokerageId: 1, email: 1 }` (unique: true — scoped duplicate lead detection)
  - `{ brokerageId: 1, createdAt: -1 }` (pipeline Kanban full board / chronological sorting)
  - `{ brokerageId: 1, status: 1, createdAt: -1 }` (pipeline Kanban / filter ordering)
  - `{ brokerageId: 1, assignedTo: 1, createdAt: -1 }` (advisor assigned lead chronological sorting)
  - `{ brokerageId: 1, assignedTo: 1, status: 1 }` (agent dashboard views)
  - `{ brokerageId: 1, score: -1 }` (lead qualification ranking)

### 3.4 Client (Converted Leads & Active Accounts)
- **Collection**: `clients`
- **Fields**:
  - `brokerageId`: ObjectId (ref: `Brokerage`, required, indexed)
  - `userId`: ObjectId (ref: `User`, optional, indexed — links authenticated portal user to client profile)
  - `firstName`: String (required, trimmed, max 60)
  - `lastName`: String (required, trimmed, max 60)
  - `email`: String (required, lowercase, trimmed, validated format)
  - `phone`: String (optional, trimmed)
  - `status`: Enum `['ACTIVE', 'INACTIVE', 'ARCHIVED']`, default `'ACTIVE'`
  - `type`: Enum `['BUYER', 'SELLER', 'BOTH', 'OTHER']`, default `'BUYER'`
  - `assignedTo`: ObjectId (ref: `User`, optional, indexed)
  - `leadId`: ObjectId (ref: `Lead`, optional, indexed — original converted lead origin)
  - `address`: Embedded subdocument `{ street, city, state, postalCode }`
  - `timestamps`: `true`
- **Indexes**:
  - `{ brokerageId: 1, email: 1 }` (unique: true — client uniqueness per brokerage)
  - `{ brokerageId: 1, createdAt: -1 }` (chronological client listing)
  - `{ brokerageId: 1, status: 1 }`
  - `{ brokerageId: 1, assignedTo: 1 }`
  - `{ brokerageId: 1, leadId: 1 }`
  - `{ brokerageId: 1, userId: 1 }`

### 3.5 Document (Verification & Files)
- **Collection**: `documents`
- **Fields**:
  - `brokerageId`: ObjectId (ref: `Brokerage`, required, indexed)
  - `title`: String (required, trimmed, max 200)
  - `fileUrl`: String (required, trimmed)
  - `fileKey`: String (optional, trimmed — cloud storage key)
  - `fileSize`: Number (optional, min 0)
  - `mimeType`: String (optional, trimmed)
  - `type`: Enum `['IDENTIFICATION', 'PAYSLIP', 'BANK_STATEMENT', 'INCOME_PROOF', 'CONTRACT', 'TAX_RETURN', 'OTHER']`, default `'OTHER'`
  - `status`: Enum `['PENDING', 'PROCESSING', 'VERIFIED', 'REJECTED']`, default `'PENDING'` (BullMQ worker target)
  - `uploadedBy`: ObjectId (ref: `User`, required, indexed)
  - `clientId`: ObjectId (ref: `Client`, optional, indexed)
  - `leadId`: ObjectId (ref: `Lead`, optional, indexed)
  - `verificationNotes`: String (optional, max 2000)
  - `verifiedAt`: Date (optional)
  - `timestamps`: `true`
- **Indexes**:
  - `{ brokerageId: 1, createdAt: -1 }` (brokerage document chronological listing)
  - `{ brokerageId: 1, status: 1, createdAt: -1 }` (status-filtered chronological listing)
  - `{ brokerageId: 1, clientId: 1, createdAt: -1 }`
  - `{ brokerageId: 1, leadId: 1, createdAt: -1 }`
  - `{ brokerageId: 1, status: 1 }`
  - `{ brokerageId: 1, uploadedBy: 1 }`
  - `{ status: 1, createdAt: 1 }` (BullMQ recovery sweeper)
  - `{ status: 1, updatedAt: 1 }` (BullMQ stalled job sweeper)

### 3.6 Task (Broker & Agent Tasks)
- **Collection**: `tasks`
- **Fields**:
  - `brokerageId`: ObjectId (ref: `Brokerage`, required, indexed)
  - `title`: String (required, trimmed, max 200)
  - `description`: String (optional, max 5000)
  - `status`: Enum `['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']`, default `'PENDING'`
  - `priority`: Enum `['LOW', 'MEDIUM', 'HIGH', 'URGENT']`, default `'MEDIUM'`
  - `dueDate`: Date (optional, indexed)
  - `assignedTo`: ObjectId (ref: `User`, required, indexed)
  - `leadId`: ObjectId (ref: `Lead`, optional, indexed)
  - `clientId`: ObjectId (ref: `Client`, optional, indexed)
  - `completedAt`: Date (optional)
  - `timestamps`: `true`
- **Indexes**:
  - `{ brokerageId: 1, dueDate: 1, createdAt: -1 }` (upcoming tasks sorted by due date)
  - `{ brokerageId: 1, status: 1, dueDate: 1 }` (overdue task filtering)
  - `{ brokerageId: 1, createdAt: -1 }` (chronological task listing)
  - `{ brokerageId: 1, assignedTo: 1, status: 1 }`
  - `{ brokerageId: 1, dueDate: 1, status: 1 }`
  - `{ brokerageId: 1, leadId: 1 }`
  - `{ brokerageId: 1, clientId: 1 }`
  - `{ brokerageId: 1, idempotencyKey: 1 }` (unique partial index)

### 3.7 EmailTemplate (Automated & Manual Email Compositions)
- **Collection**: `emailtemplates`
- **Fields**:
  - `brokerageId`: ObjectId (ref: `Brokerage`, required, indexed)
  - `name`: String (required, trimmed, max 100)
  - `slug`: String (required, trimmed, lowercase, max 100)
  - `subject`: String (required, trimmed, max 200)
  - `body`: String (required)
  - `variables`: Array of Strings (default `[]`)
  - `isActive`: Boolean, default `true`
  - `timestamps`: `true`
- **Indexes**:
  - `{ brokerageId: 1, slug: 1 }` (unique: true — template identifier scoped to brokerage)
  - `{ brokerageId: 1, isActive: 1 }`
  - `{ brokerageId: 1, name: 1 }`

### 3.8 PipelineTrigger (Automated Transitions)
- **Collection**: `pipelinetriggers`
- **Fields**:
  - `brokerageId`: ObjectId (ref: `Brokerage`, required, indexed)
  - `name`: String (required, trimmed, max 100)
  - `fromStage`: String (optional — wildcard or specific prior stage)
  - `toStage`: String (required, target transition stage)
  - `actionType`: Enum `['CREATE_TASK', 'SEND_EMAIL', 'NOTIFICATION']`, required
  - `actionConfig`: Subdocument `{ taskTitle, taskPriority, dueDaysOffset, templateId, recipientType }`
  - `isActive`: Boolean, default `true`
  - `timestamps`: `true`
- **Indexes**:
  - `{ brokerageId: 1, toStage: 1, isActive: 1 }`
  - `{ brokerageId: 1, actionType: 1 }`

---

## 4. Architectural & Schema Decisions

### Decisions Made (Prompt 2 & 3)
1. **Compound Uniqueness over Global Uniqueness**:
   - `Lead`, `Client`, `User`, and `EmailTemplate` use compound unique indexes prefixed with `brokerageId`.
   - Result: Brokerage A and Brokerage B can independently register the same lead email (`lead@gmail.com`) without database collisions.
2. **User/RBAC Terminology Realignment (Prompt 3)**:
   - Updated roles to match `assignment.md`: `PLATFORM_ADMIN`, `BROKERAGE_ADMIN`, `ADVISOR`, `CLIENT`.
   - `PLATFORM_ADMIN` is a platform-level role with optional `brokerageId` and global email uniqueness.
   - `BROKERAGE_ADMIN`, `ADVISOR`, and `CLIENT` strictly require `brokerageId` for tenant boundary protection.
3. **Portal Account Connection (Prompt 3)**:
   - Added `Client.userId` referencing `User` (`role: 'CLIENT'`) enabling authenticated client portal workflows where expat borrowers log in and upload payslips/documents.
4. **Document Model Domain Alignment (Prompt 3)**:
   - Added `PAYSLIP` to `Document.type` enum to match the German mortgage expat checklist (payslips, ID, bank statements).
5. **Lean Subdocuments vs Separate Collections**:
   - `Client.address` is stored as an embedded subdocument (`{ _id: false }`) since address data is 1:1 and always accessed with client profile.
   - `PipelineTrigger.actionConfig` is embedded as a typed subdocument rather than a polymorphic relational table.
6. **Optimized Compound Indexes**:
   - Lead queries support the pipeline view (`{ brokerageId: 1, status: 1, createdAt: -1 }`) and advisor assignment views (`{ brokerageId: 1, assignedTo: 1, status: 1 }`).
   - Task queries index `{ brokerageId: 1, assignedTo: 1, status: 1 }` and `{ brokerageId: 1, dueDate: 1, status: 1 }` for pending deadline notifications.

### Unresolved / Deferred Decisions (Future Prompts)
1. **Password Hashing Lifecycle Hook**:
   - Stored as `passwordHash` string in the model. Actual hashing with `bcryptjs` will be attached during Phase 2 (Authentication & Authorization) rather than premature pre-save hooks in Prompt 2.
2. **Soft Delete vs Hard Delete**:
   - Status enums support `'INACTIVE'` / `'ARCHIVED'` / `'CANCELLED'`. Explicit soft-delete plugins or timestamps (`deletedAt`) deferred until controller/service logic dictates retention rules.
3. **Dynamic Pipeline Stages Customization**:
   - Default stages (`['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']`) are established on the Lead model. Brokerage-customized pipeline stage definitions are deferred to future configuration requirements.
