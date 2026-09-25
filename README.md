# LeadFlow

> High-performance, multi-tenant lead management and brokerage operations platform for modern real estate and mortgage firms.

LeadFlow is built to streamline lead ingestion, client conversion, and document workflows for brokerage operations—specifically tailored to high-trust financial domains such as expat mortgage and financing advisory.

---

## Key Features

### 🏢 Strict Multi-Tenant Brokerage Isolation
- **Domain-First Multi-Tenancy**: Data model structured around `Brokerage` entities (shared database, shared collection with indexed tenant discrimination).
- **Automated Query Scoping**: Centralized `ScopedRepository` pattern binds all reads and writes to `{ brokerageId }` from verified server context.
- **Anti-IDOR Defense**: Guessed resource IDs from neighboring tenants resolve to `null` and return HTTP 404 (`NotFoundError`), completely preventing cross-tenant existence enumeration.
- **Client Case Isolation**: Portal clients can only view and manage their own profile and uploaded documents, preventing lateral access across expat cases within the same brokerage.

### 🔐 Robust Authentication & Role-Based Access Control (RBAC)
- **4 Distinct User Roles**:
  - `PLATFORM_ADMIN`: System-level administrator managing brokerages and global platform health.
  - `BROKERAGE_ADMIN`: Manages brokerage settings, advisors, and team configurations.
  - `ADVISOR`: Manages pipeline leads, clients, document verification, and tasks.
  - `CLIENT`: Self-service expat client portal for uploading checklist documents and tracking case status.
- **Dual JWT + Session Rotation**: Short-lived access tokens (15m) paired with long-lived refresh tokens (7d).
- **RFC 6819 Breach Detection**: Refresh token rotation with family lineages; reuse attempts immediately revoke all active sessions in the family.
- **Hashed Session Storage**: Refresh tokens are SHA-256 hashed before persistence with MongoDB TTL auto-expiry.
- **Secure Cookie Delivery**: SameSite Lax, HTTP-only, secure cookie support with header/body fallbacks for API clients.

### ⚡ High-Throughput Webhook Lead Ingestion
- **Multi-Source Normalization**: Ingests leads from standard REST webhooks and external form providers (Typeform `form_response`), automatically extracting contact info, UTM campaign parameters, and custom fields.
- **Dual Webhook Authentication**: Authenticates external payloads via shared webhook secret (`x-webhook-secret` or Bearer token) or HMAC SHA-256 signatures (`x-signature-sha256`) with constant-time verification.
- **Anti-Enumeration Guard**: Unauthenticated probes fail immediately with uniform HTTP 401 responses, disclosing zero information about brokerage existence or account standing.
- **Deterministic Deduplication**: Enforces scoped unique identity on `{ brokerageId: 1, email: 1 }`. Duplicate submissions return HTTP 200 idempotently without creating duplicate records.
- **"Already Known" Person Detection**: Matches incoming leads against existing `Client` profiles in the brokerage, linking client IDs and preserving advisor assignments.
- **Tenant-Aware Ingestion Rate Limiting**: 1,000 requests/minute per verified brokerage placed after authentication. Protects brokerages from noisy neighbors sharing external webhook IPs (e.g. Typeform or Zapier egress).

### 📊 Realtime Lead Pipeline & Optimistic Concurrency
- **Stage Progression State Machine**: Strictly enforces forward pipeline moves: `NEW → CONTACTED → QUALIFIED → PROPOSAL → NEGOTIATION → WON / LOST`. Disallows stage skipping, self-transitions, and backward moves.
- **Terminal Stage Guarantees**: `WON` and `LOST` represent final lifecycle states with zero allowed outgoing transitions. Early drop-off to `LOST` is permitted from any active intermediate stage.
- **Zero-Infrastructure Optimistic Concurrency**: Prevents lost updates using native MongoDB conditional updates matching exact status and `__v` versioning. Concurrent updates return HTTP 409 `ConflictError` cleanly without locking.
- **Socket.IO Realtime Broadcasting**: Live pipeline stage updates broadcast to verified brokerage rooms (`brokerage:<brokerageId>`) and `platform:admins` post-commit.
- **Tenant-Isolated WebSocket Security**: Handshake authentication enforces JWT verification, database active-user status, and active-brokerage checks. Clients are strictly excluded from internal brokerage pipeline rooms, and client room manipulation attempts are blocked. Zero sensitive PII exposed in socket event payloads.

### 🔄 Client Conversion & Case Foundation
- **Server-Side Conversion Eligibility**: Enforces that only qualified leads (`QUALIFIED`, `PROPOSAL`, `NEGOTIATION`, `WON`) can be converted into active cases; raw inquiries (`NEW`, `CONTACTED`) and dead inquiries (`LOST`) are rejected with HTTP 400.
- **Atomic Concurrency Defense**: Prevents duplicate client creation under concurrent conversion attempts using atomic single-document claims (`Lead.findOneAndUpdate`), partial unique compound indexes (`{ brokerageId: 1, leadId: 1 }` and `{ brokerageId: 1, userId: 1 }`), and tenant unique identity (`{ brokerageId: 1, email: 1 }`).
- **Client Portal Identity Linkage**: Automatically provisions or links a dedicated `User` account (`role: 'CLIENT'`, `status: 'ACTIVE'`) with bcrypt hashed password. Blocks non-client account contamination.
- **Preserved Lineage & Advisor Assignment**: Establishes bidirectional references (`client.leadId` and `lead.convertedClientId`) and preserves advisor assignments across conversion.
- **IDOR-Immune Case Access**: Expat clients access personal cases via `GET /api/clients/me` (derived strictly from token identity) and `GET /api/clients/:id` (returning uniform HTTP 404 on ID mismatch).

### 📁 Document Upload & Storage Foundation (ImageKit Integration)
- **Decoupled Storage Service**: Storage operations abstracted behind `IStorageService` and `ImageKitStorageService` using `@imagekit/nodejs` v7 with mock-mode support for offline testing.
- **Server-Controlled Namespacing**: Files organized under deterministic tenant and client folders: `/leadflow/brokerage_<id>/clients/<clientId>/` with strict character sanitization.
- **Strict Size & MIME Enforcement**: Multer in-memory upload pipeline limits file uploads to 10MB and whitelists valid document formats (`PDF`, `JPEG`, `PNG`, `WEBP`, `TIFF`).
- **Client Case IDOR Defense**: Expat clients are strictly restricted to uploading and retrieving documents within their own case. Cross-client and cross-tenant attempts return HTTP 403 / HTTP 404 without data leaks.
- **Compensating Rollback Architecture**: If database record persistence fails after an ImageKit upload, the system automatically triggers a compensation deletion in ImageKit, preventing orphaned storage files.
- **Zero Credential Exposure**: ImageKit private keys remain strictly server-side; client uploads are proxied through authenticated API endpoints (`POST /api/documents/upload`, `GET /api/documents`, `GET /api/documents/:id`).

### 🎨 Premium Frontend Architecture & Auth Shell
- **Modern UI Stack**: React 19.2, Vite 8.3, Tailwind CSS v4 (`@tailwindcss/vite`), TanStack Query 5.103, React Router 7.18, and Radix UI accessible primitives.
- **Financial B2B SaaS Design System**: Authoritative typography, neutral canvas (`slate-50`), deep cobalt/sapphire primary (`#2563eb`), zero em-dashes, and strict WCAG AA contrast compliance following `design-taste-frontend`.
- **User-Centric UI**: Distraction-free interface showing users only the information needed to complete mortgage workflows, with zero implementation noise or technical status claims.
- **Operations Dashboard**: Real-time performance dashboard for `BROKERAGE_ADMIN` and `ADVISOR` featuring 5 core KPIs (Total Leads, Active Pipeline, Pre-Qualified, Won Cases, Active Clients), 7-stage pipeline volume distribution, recent borrower activity, and pending operational tasks.
- **Interactive Kanban Drag-and-Drop**: Reliable drag-and-drop powered by React 19-compatible `@dnd-kit` (`@dnd-kit/core`, `@dnd-kit/utilities`) with `PointerSensor` (5px activation threshold) and `KeyboardSensor`.
- **State Machine Enforcement**: Client-side validation enforcing the exact backend qualification sequence (`NEW → CONTACTED → QUALIFIED → PROPOSAL → NEGOTIATION → WON / LOST`), rejecting invalid drops and terminal moves with actionable feedback notices.
- **Optimistic Updates & Concurrency Rollback**: Instant card relocation with rollback snapshot on network failure, paired with graceful HTTP 409 concurrency conflict handling that alerts advisors and auto-refreshes the board.
- **Realtime Socket.IO Pipeline Synchronization**: Live subscription to `pipeline:stage_changed` and `lead:stage_changed` reconciling remote advisor moves across columns without duplicate cards or stale counts.
- **7-Stage Pipeline Board**: Complete linear qualification columns (`NEW`, `CONTACTED`, `QUALIFIED`, `PROPOSAL`, `NEGOTIATION`, `WON`, `LOST`) with lead volume summaries, real-time search filtering, horizontal scrolling, and restrained visual drag feedback with `DragOverlay`.
- **Cmd/Ctrl+K Command Palette**: Fast, keyboard-accessible command palette (`⌘K` / `Ctrl+K`) for rapid page navigation, workspace URL copying, sidebar toggling, and role-scoped commands.
- **Natural Keyboard Navigation**: Power-user keyboard shortcuts and two-key chords (`G then P` for Pipeline, `G then L` for Leads, `G then C` for Clients, etc.) with physical `<kbd>` keycaps and an accessible cheat sheet dialog (`?`).
- **Collapsible Navigation Rail**: Desktop sidebar with fluid toggle (`⌘B` / `Ctrl+B`) supporting an icon-rail mode with accessible tooltips and clear active states.
- **Reusable Primitives**: Fully accessible `Button`, `Input`, `Card`, `Badge`, `Dialog`, `Avatar`, `Loader`, `Skeleton`, `EmptyState`, and `ErrorState`.
- **Typed API & Refresh Interceptor**: Axios instance configured with `withCredentials: true`, in-memory access token storage, and automatic 401 token refresh queue handling.
- **Role-Aware Protected Shell**: `useAuth` hook with transparent session restoration, role-based navigation and protected routes for `/app` (advisors & brokerage admins), `/portal` (expat clients), and `/admin` (platform superadmins).
- **Focused Login Experience**: Clean, focused sign-in interface with subtle demo-role switcher pills for testing all 4 roles out of the box.


### ⚙️ Asynchronous Document Processing (BullMQ & Redis)
- **Non-Blocking Upload Flow**: Document uploads store the file and persist metadata with status `PENDING`, enqueueing a background verification job to BullMQ rather than blocking HTTP responses.
- **Enqueue Failure Isolation**: If Redis experiences a transient outage during document upload, the HTTP request completes with HTTP 201; the document is safely persisted in MongoDB in `PENDING` state with zero external error leakage.
- **Background Reconciliation Sweeper**: Automated sweeper (`document-recovery.service.ts`) periodically scans for stale `PENDING` documents and stalled `PROCESSING` documents (from crashed or ungracefully terminated workers), resetting their status with audit notes and re-enqueueing for verification.
- **Persisted Tenant Boundary Validation**: Workers validate the job payload against the database document via `withBrokerageScope`. Any cross-tenant tampering attempt raises security alerts and throws an `UnrecoverableError` without altering external records.
- **Atomic State Transitions**: Concurrency control uses atomic conditional queries (`{ _id, brokerageId, status: 'PENDING' }` to `PROCESSING`), preventing simultaneous duplicate processing across distributed workers.
- **Realistic Verification Simulation**: Simulates slow document inspections with configurable delays, modeling both terminal verification rejections (`REJECTED`) and retryable transient timeouts.
- **Bounded Retries with Backoff**: Configured with 3 attempts and exponential backoff for transient failures. If retries are exhausted, the failure handler automatically marks the document `REJECTED` with an explanatory note, ensuring documents are never left stuck in `PROCESSING`.
- **Realtime Status Broadcasting**: Socket.IO events (`document:status_changed`) broadcast committed status updates to tenant brokerage rooms (`brokerage:<brokerageId>`), platform admin rooms (`platform:admins`), and private client rooms (`client:<userId>`) with zero credential exposure. Supported across separate worker processes via Redis pub/sub.

### 🤖 Pipeline Triggers, Tasks & Email Automation (BullMQ + Redis)
- **Configured Stage Triggers**: Automatically executes business rules when a lead enters any pipeline stage (e.g. `NEW` on ingestion, intermediate stages via `PATCH /api/leads/:id/stage`, and `WON` on client conversion).
- **Automated Advisor Task Creation**: Creates high-priority follow-up tasks with dynamic due dates calculated from `dueDaysOffset` and `dueHoursOffset`. Supports overdue-safe `PENDING` status with virtual `isOverdue` calculation.
- **Asynchronous Email Workflows**: Renders and dispatches stage emails via dedicated BullMQ `email-delivery` queue, completely decoupling external email provider latency from HTTP pipeline requests.
- **Dynamic Template Substitution**: Supports recursive regex-based template rendering with dot notation (`{{firstName}}`, `{{advisor.name}}`, `{{brokerage.name}}`, `{{customFields.*}}`).
- **Atomic Multi-Tenant Idempotency**: Prevents duplicate tasks or double-sending emails under concurrent stage updates using atomic `TriggerExecution` records (`{ brokerageId: 1, idempotencyKey: 1 }`) and `Task` partial filter indexes (`{ brokerageId: 1, idempotencyKey: 1 }` where `$type: 'string'`).
- **Bounded Exponential Backoff**: Retries transient provider failures up to 3 times with exponential delays. Terminal provider rejections throw `UnrecoverableError` to halt futile retry loops.
- **PII Masking & Zero Secrets**: Email addresses are masked in Pino operational logs (`maskEmail`), keeping all API tokens and client credentials secure.
- **Post-Commit Side Effects**: All automations trigger strictly after database transactions/atomic updates succeed, ensuring side effects are never generated for rolled-back or rejected stage transitions.

### 🚀 Production Hardening & High-Throughput Performance
- **Optimized Compound Indexes**: Comprehensive compound indexes across `Lead`, `Task`, `Document`, and `Client` ensure zero in-memory sorts for Kanban pipeline boards (`{ brokerageId: 1, createdAt: -1 }`), assigned advisor filtering, task due dates (`{ brokerageId: 1, dueDate: 1, createdAt: -1 }`), and document status queries.
- **Defensive Query Pagination Bounds**: Strict limit and offset pagination bounds (`limit` / `page`) on `GET /api/tasks` and `GET /api/documents` prevent memory exhaustion under high dataset volumes.
- **Autocannon Load Benchmarking**: Fully benchmarked with Autocannon against realistic multi-tenant data:
  - **Baseline Routing**: 5,583 req/s (p50: 1ms)
  - **Pipeline Kanban Board**: 234 req/s (p50: 40ms, returning 200 leads across 7 stages)
  - **Filtered Leads**: 442 req/s (p50: 21ms)
  - **Task Queries**: 356 req/s (p50: 27ms)
  - **Document Listing**: 360 req/s (p50: 27ms)
  - **Webhook Ingestion**: 1,735 to 2,184 req/s (p50: 4-10ms)
- **High-Burst & Noisy-Neighbor Resilient**: Validated 500/min lead ingestion capacity with 2x headroom (1,000 req/min per verified brokerage limit). Noisy tenants hitting rate limits cannot starve or slow down neighboring brokerages.

---

## Monorepo Architecture

```
leadflow/
├── client/                 # React 19 + Vite frontend application
├── server/                 # Express 5 + Mongoose 9 REST API
│   ├── src/
│   │   ├── config/         # Environment parsing (Zod) and DB lifecycle
│   │   ├── controllers/    # HTTP route controllers
│   │   ├── middleware/     # Auth, RBAC, webhook verification, error handling
│   │   ├── models/         # Mongoose schemas with compound tenant indexes
│   │   ├── queues/         # BullMQ queues, workers (documents & emails), recovery service
│   │   ├── repositories/   # Lean scoped data access layer
│   │   ├── routes/         # Express API routes with tenant-aware rate limiting
│   │   ├── services/       # Domain business logic orchestration
│   │   ├── sockets/        # Realtime WebSocket server & authentication
│   │   ├── utils/          # Logger, custom error hierarchy, password helpers, template engine
│   │   └── validators/     # Zod runtime validation schemas
│   └── tests/              # Vitest test suite with in-memory MongoDB
├── worker/                 # BullMQ + Redis background worker service
└── docs/                   # System and architecture design specifications
    ├── architecture.md     # Multi-tenancy, service boundaries, and system topology
    ├── auth-security.md    # Token lifecycle, RBAC matrix, and IDOR defenses
    ├── database-design.md  # Schema definitions, compound indexes, and query patterns
    ├── lead-ingestion.md   # Webhook specs, HMAC verification, and burst ingestion
    ├── lead-pipeline.md    # Pipeline Kanban state machine, optimistic concurrency, and APIs
    ├── client-cases.md     # Client conversion, portal authentication, and case access APIs
    ├── document-storage.md # Object storage, ImageKit integration, and folder namespacing
    ├── document-processing.md # Asynchronous queue, worker lifecycle, and reconciliation
    └── pipeline-triggers.md   # Pipeline triggers, task automation, and email queuing
```

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend API** | Node.js (>=20.19), Express 5.2, Mongoose 9.10, Zod 4.6, Pino 10.3 |
| **Frontend** | React 19, Vite 8, TanStack Query 5, Tailwind CSS |
| **Background Jobs** | BullMQ 6.3, ioredis 6.0 |
| **Database** | MongoDB 8+ (tested with `mongodb-memory-server`) |
| **Testing** | Vitest 5.0, Supertest 7.3 |
| **Language & Module** | TypeScript 7, NodeNext ES Modules (`"type": "module"`) |

---

## Quickstart

### Prerequisites
- **Node.js**: `>= 20.19.0`
- **npm**: `>= 10.0.0`
- **MongoDB**: Local or hosted MongoDB instance (tests run automatically in-memory)

### 1. Installation
Clone the repository and install workspace dependencies:

```bash
git clone https://github.com/destinykrishna/leadflow.git
cd leadflow
npm install
```

### 2. Environment Configuration
Copy the example environment configuration:

```bash
cp .env.example .env
cp server/.env.example server/.env
```

Review and update the variables in `.env` as needed:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/leadflow
JWT_SECRET=your-secure-jwt-secret-min32chars!
JWT_REFRESH_SECRET=your-secure-refresh-jwt-secret-min32chars!
COOKIE_SECRET=your-secure-cookie-secret
CORS_ORIGIN=http://localhost:5173
```

### 3. Running the Test Suite
The project includes a comprehensive automated test suite testing multi-tenancy, authentication, RBAC, and high-volume burst lead ingestion:

```bash
# Run all unit and integration tests
npm test

# Run tests with code coverage
npm run test:coverage
```

### 4. Running the Development Server
```bash
# Start backend server
npm --prefix server run dev

# Start frontend application
npm --prefix client run dev
```

---

## Webhook Ingestion Example

External leads can be sent directly to a brokerage's dedicated webhook URL:

```bash
curl -X POST https://api.yourdomain.com/api/leads/webhook/<BROKERAGE_ID> \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: <BROKERAGE_WEBHOOK_SECRET>" \
  -d '{
    "firstName": "Anna",
    "lastName": "Schmidt",
    "email": "anna.schmidt@example.de",
    "phone": "+49 170 1234567",
    "loanAmount": 450000,
    "propertyValue": 550000,
    "source": "TYPEFORM",
    "campaign": "expat_mortgage_2026"
  }'
```

### Responses
- **`201 Created`**: New lead successfully created and assigned to the initial `NEW` pipeline stage.
- **`200 OK` (Duplicate/Idempotent)**: Returns existing lead without creating duplicates (`"isDuplicate": true`).
- **`401 Unauthorized`**: Missing or invalid credentials (anti-enumeration protected).
- **`429 Too Many Requests`**: Verified brokerage exceeded 1,000 requests/minute.

---

## Documentation

Comprehensive design specifications and architectural guidelines are available in [`docs/`](file:///c:/Users/Krishna/Desktop/3d-website/leadflow/docs):
- [Architecture & Isolation](file:///c:/Users/Krishna/Desktop/3d-website/leadflow/docs/architecture.md)
- [Authentication & Security](file:///c:/Users/Krishna/Desktop/3d-website/leadflow/docs/auth-security.md)
- [Database Schema & Indexes](file:///c:/Users/Krishna/Desktop/3d-website/leadflow/docs/database-design.md)
- [Lead Ingestion & Webhooks](file:///c:/Users/Krishna/Desktop/3d-website/leadflow/docs/lead-ingestion.md)
- [Lead Pipeline & Concurrency](file:///c:/Users/Krishna/Desktop/3d-website/leadflow/docs/lead-pipeline.md)
- [Client Cases & Conversion](file:///c:/Users/Krishna/Desktop/3d-website/leadflow/docs/client-cases.md)
- [Document Storage & ImageKit](file:///c:/Users/Krishna/Desktop/3d-website/leadflow/docs/document-storage.md)
- [Document Processing & BullMQ](file:///c:/Users/Krishna/Desktop/3d-website/leadflow/docs/document-processing.md)
- [Pipeline Triggers & Tasks](file:///c:/Users/Krishna/Desktop/3d-website/leadflow/docs/pipeline-triggers.md)

*Note: Chronological execution logs and internal development tracking are maintained separately in `PROMPTS.md` and `AGENTS.md`.*

---

## Intentional Limitations & Scaling Notes

1. **In-Memory Rate Limiting**: The current rate limiter (`express-rate-limit`) uses an in-memory counter keyed by verified brokerage ID. This provides zero network overhead and easily handles 2,000+ req/s per single Node instance. For horizontally scaled deployments across multiple API containers behind a load balancer, migrating the store to `rate-limit-redis` (connected to the shared Redis instance) will guarantee shared tenant quotas across all instances.
2. **Worker Separation in Production**: During development and testing, BullMQ workers and the document recovery sweeper run within the Express process for ease of operation. In high-volume production deployments, worker processes should run exclusively via `npm run start:worker` (`worker/src/worker.ts`) on dedicated worker instances to keep HTTP event loop latency strictly isolated from background CPU/IO workloads.
3. **Document Recovery Sweeper Frequency**: The background reconciliation sweeper polls MongoDB on a 60-second interval as a fail-safe recovery mechanism for orphaned `PENDING` and ungracefully terminated `PROCESSING` documents. Realtime BullMQ worker stall detection (`lockDuration: 30s`, `stalledInterval: 15s`) handles active job locks with lower latency.

---

## License

MIT © LeadFlow Contributors
