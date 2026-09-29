# LeadFlow

> Multi-tenant lead management and brokerage operations platform for modern real estate and mortgage firms.

LeadFlow streamlines external lead ingestion, real-time pipeline management, client conversion, and document workflows for loan advisory and mortgage brokerages. Built with a security-first, multi-tenant architecture, LeadFlow ensures complete isolation between brokerages while providing advisors and borrowers with a collaborative operating environment.

---

## 🌐 Live Application & Demo Access

- **Live Web Application**: [https://leadflow-lemon-two.vercel.app](https://leadflow-lemon-two.vercel.app)
- **Production API Server**: [https://leadflow-api-k1i2.onrender.com](https://leadflow-api-k1i2.onrender.com)
- **Comprehensive User Manual**: [`USER_MANUAL.md`](USER_MANUAL.md)

### Demo Accounts & Quick Sign-In

The application includes one-click demo login buttons directly on the sign-in screen at [`https://leadflow-lemon-two.vercel.app/login`](https://leadflow-lemon-two.vercel.app/login):

| Role | Email | Brokerage Slug | Default Password | Workspace Scope |
| :--- | :--- | :--- | :--- | :--- |
| **Brokerage Admin** | `klaus.mueller@berlin-mortgages.de` | `berlin-expat-mortgages` | `Password123!` | Brokerage settings, team, triggers, templates |
| **Loan Advisor** | `elena.schmidt@berlin-mortgages.de` | `berlin-expat-mortgages` | `Password123!` | Pipeline, leads, client cases, tasks, document reviews |
| **Borrower (Client)** | `alex.expat@gmail.com` | `berlin-expat-mortgages` | `Password123!` | Self-service case dashboard, document upload checklist |
| **Platform Admin** | `admin@leadflow-platform.com` | *(None required)* | `Password123!` | Global brokerage provisioning, cross-tenant health |

---

## ⚡ Key Capabilities

### Strict Multi-Tenant Isolation
- **Domain-Level Tenancy**: All core domain records are partitioned by `brokerageId` using a shared database with indexed tenant discrimination.
- **Automated Query Scoping**: A centralized `ScopedRepository` pattern binds read and write operations to the authenticated user's `brokerageId`, preventing accidental tenant boundary bleed.
- **Anti-IDOR Concealment**: Requests targeting resources belonging to other brokerages return HTTP 404 (`NotFoundError`), completely preventing cross-tenant identifier enumeration.
- **Client Case Privacy**: Borrowers are strictly scoped to their own case and documents (`userId === req.user.id`), preventing lateral access to other clients within the same firm.

### Real-Time Kanban Pipeline
- **Strict State Machine**: Enforces a linear qualification progression (`NEW → CONTACTED → QUALIFIED → PROPOSAL → NEGOTIATION → WON / LOST`) with terminal stage immutability for `WON` and `LOST`.
- **Optimistic Concurrency Control**: Uses native MongoDB conditional version matching (`__v`) to prevent lost updates without requiring distributed locking mechanisms.
- **WebSocket Synchronization**: Live pipeline stage updates broadcast to tenant-specific Socket.IO rooms (`brokerage:<brokerageId>`), keeping advisor screens in sync without manual refreshes.
- **Interactive UI**: Drag-and-drop Kanban board powered by `@dnd-kit` with optimistic updates, rollback on failure, multi-dimensional search/source filtering, and responsive drawer workspaces.

### Automated Lead Ingestion & Webhooks
- **External Form Integration**: Direct ingestion from Google Forms via Google Apps Script, Typeform, and REST webhooks into normalized pipeline leads.
- **Dual Webhook Authentication**: Authenticates payloads using shared webhook secrets or HMAC SHA-256 signatures with constant-time verification.
- **Tenant-Aware Rate Limiting**: 1,000 requests/minute per verified brokerage placed after authentication to protect tenants from noisy neighbors sharing egress IPs.
- **Deterministic Deduplication**: Compound index on `{ brokerageId: 1, email: 1 }` absorbs concurrent duplicates idempotently without creating duplicate records.
- **Known Client Recognition**: Automatically matches incoming leads against existing client profiles, linking client records and preserving assigned advisors.

### Borrower Portal & Client Conversion
- **One-Click Case Conversion**: Converts qualified pipeline leads into active borrower cases while atomically provisioning dedicated client portal credentials.
- **Self-Service Borrower Dashboard**: Clean, accessible portal area where applicants review their loan milestones, target loan amounts, dynamic Loan-to-Value (LTV %), and advisor contact details.
- **Document Verification Checklist**: Guided document upload center with clear requirements (KYC, payslips, bank statements, sale agreements) and transparent verification feedback.

### Asynchronous Document Processing
- **Decoupled Cloud Storage**: Files are uploaded through an in-memory Multer pipeline (10MB limit, whitelisted MIME types: PDF, JPEG, PNG, WEBP, TIFF) and stored in ImageKit under isolated tenant folder structures.
- **Background Worker Queue**: Document verification is offloaded to BullMQ workers on Redis, avoiding blocked HTTP connections during file inspection.
- **Resilient Recovery Sweeper**: Background sweeper service scans for stalled or orphaned documents, re-enqueueing them automatically with audit trail notes.
- **Simulated Verification Engine**: Workers run simulated document verification with configurable latency, terminal rejections, and retry backoff.

### Pipeline Triggers & Automation
- **Event-Driven Actions**: Configured stage triggers automatically generate follow-up advisor tasks and queue outbound notification emails when leads advance stages.
- **Dynamic Template Substitution**: Template engine renders personalized borrower emails supporting dot-notation placeholders (`{{lead.firstName}}`, `{{advisor.name}}`).
- **Asynchronous Email Queue**: Emails are queued through BullMQ (`email-delivery`) with mock delivery, exponential backoff retries, and operational PII masking (`maskEmail`).

---

## 🏛️ System Architecture

```
                       ┌─────────────────────────────────────────┐
                       │   External Sources (Webhooks / Forms)   │
                       └────────────────────┬────────────────────┘
                                            │ HMAC SHA-256 / Secret
                                            ▼
┌──────────────────┐           ┌─────────────────────────┐           ┌──────────────────┐
│  React 19 Client │◄──HTTP/WS─┤   Express 5 API Server  ├──BullMQ──►│  BullMQ Workers  │
│  (Advisors &     │           │   - Scoped Repositories │           │  - Doc Verify    │
│   Borrowers)     │           │   - Socket.IO Server    │           │  - Email Queue   │
└──────────────────┘           └────────────┬────────────┘           └─────────┬────────┘
                                            │                                  │
                                            ▼                                  ▼
                               ┌─────────────────────────┐           ┌──────────────────┐
                               │   MongoDB 8 (Mongoose)  │           │   Redis 7 Cache  │
                               │   - Tenant Compound Idx │           │   & Job Broker   │
                               └─────────────────────────┘           └──────────────────┘
```

### Monorepo Topology

```
leadflow/
├── client/                 # React 19 + Vite frontend application
│   ├── src/
│   │   ├── features/       # Domain modules (pipeline, leads, clients, tasks, auth, portal)
│   │   ├── components/     # Reusable UI primitives (Radix UI, command palette, drawers)
│   │   ├── hooks/          # Shared custom hooks (useAuth, useSocket, useNavigationShortcuts)
│   │   └── lib/            # API client, WebSocket singleton, utilities, Zod validation
├── server/                 # Express 5 REST API & WebSocket server
│   ├── src/
│   │   ├── config/         # Environment configuration (Zod) and MongoDB lifecycle
│   │   ├── controllers/    # Route controllers with tenant context
│   │   ├── middleware/     # Authentication, RBAC, tenant rate limiting, error handling
│   │   ├── models/         # Mongoose models with compound tenant indexes
│   │   ├── queues/         # BullMQ queues, workers, and document recovery sweeper
│   │   ├── repositories/   # Lean scoped data access layer (`ScopedRepository`)
│   │   ├── routes/         # Express API route declarations
│   │   ├── services/       # Domain business logic orchestration
│   │   ├── sockets/        # Socket.IO authentication and room isolation
│   │   └── utils/          # Pino logger, password hashing, template renderer, PII mask
│   └── tests/              # Vitest test suite with in-memory MongoDB
├── worker/                 # Standalone BullMQ worker process entrypoint
└── docs/                   # System design specifications and operational runbooks
    ├── architecture.md     # Multi-tenancy, service boundaries, and system topology
    ├── auth-security.md    # Token lifecycle, RBAC matrix, and IDOR defenses
    ├── database-design.md  # Schema definitions, compound indexes, and query patterns
    ├── lead-ingestion.md   # Webhook specifications, HMAC verification, and burst ingestion
    ├── lead-pipeline.md    # Pipeline Kanban state machine, optimistic concurrency, and APIs
    ├── client-cases.md     # Client conversion, portal authentication, and case access APIs
    ├── document-storage.md # Object storage, ImageKit integration, and folder namespacing
    ├── document-processing.md # Asynchronous queue, worker lifecycle, and reconciliation
    ├── pipeline-triggers.md   # Pipeline triggers, task automation, and email queuing
    └── GOOGLE_FORMS_LEAD_SOURCE_RUNBOOK.md # Google Forms + Apps Script integration runbook
```

---

## 🛠️ Technology Stack

| Layer | Technologies | Description |
| :--- | :--- | :--- |
| **Backend API** | Node.js 20+, Express 5.2, Mongoose 9.10, Zod 4.6, Pino 10.3 | High-throughput REST API with strict runtime validation |
| **Frontend** | React 19.2, Vite 8.3, TanStack Query 5.103, Tailwind CSS v4 | Responsive, accessible SPA with optimistic mutations |
| **Real-Time** | Socket.IO 4.8 | Tenant-isolated WebSocket updates across brokerages |
| **Background Jobs** | BullMQ 6.3, ioredis 6.0 | Reliable asynchronous job processing with bounded retries |
| **Object Storage** | ImageKit SDK (`@imagekit/nodejs` v7) | Cloud file storage with tenant-isolated path hierarchies |
| **Database** | MongoDB 8+ | Document store with compound tenant indexing |
| **Testing** | Vitest 5.0, Supertest 7.3, `mongodb-memory-server` 11.3 | Automated testing with isolated in-memory databases |

---

## 🚀 Quickstart

### Prerequisites
- **Node.js**: `>= 20.19.0`
- **npm**: `>= 10.0.0`
- **MongoDB**: Local or hosted MongoDB instance (automated tests run in-memory)
- **Redis**: Local or hosted Redis instance (required for BullMQ background workers)

### 1. Installation
Clone the repository and install workspace dependencies:

```bash
git clone https://github.com/destinykrishna/leadflow.git
cd leadflow
npm install
```

### 2. Environment Configuration
Create the root and server environment configurations:

```bash
cp .env.example .env
cp server/.env.example server/.env
```

Verify the key variables in `server/.env`:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/leadflow
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your-secure-jwt-secret-min32chars!
JWT_REFRESH_SECRET=your-secure-refresh-jwt-secret-min32chars!
COOKIE_SECRET=your-secure-cookie-secret
CORS_ORIGIN=http://localhost:5173
```

### 3. Database Seeding
Populate the database with sample brokerages, users across all 4 roles, pipeline leads, and automation triggers:

```bash
npm run seed
```

### 4. Running the Development Environment
Start all services (Express API server, background worker, and Vite frontend) concurrently:

```bash
npm run dev
```

Alternatively, start individual workspaces:
```bash
# Start backend API server (port 5000)
npm --prefix server run dev

# Start background worker process
npm --prefix worker run dev

# Start frontend application (port 5173)
npm --prefix client run dev
```

---

## 🧪 Testing & Verification

LeadFlow maintains a comprehensive automated test suite covering unit logic, integration endpoints, tenant isolation, and critical user journeys.

```bash
# Run all server and client test suites
npm test

# Run only backend tests
npm --prefix server test

# Run only frontend tests
npm --prefix client test

# Check TypeScript types across all packages
npm run typecheck

# Build frontend production bundle
npm run build
```

### Verified Test Results
- **Backend Test Suite**: **443 tests passed across 23 test files** (`vitest`)
- **Frontend Test Suite**: **131 tests passed across 17 test files** (`vitest`)
- **Total Test Suite**: **574 tests passed across 40 test files** with 0 failures
- **Type Checking**: Clean TypeScript compilation with 0 errors across `client`, `server`, and `worker`
- **Critical QA Journey Runner**: 33 passed, 0 failed via `npm --prefix server run qa`

### Load Benchmarks (Autocannon)
Benchmarked against realistic multi-tenant datasets (measured via `server/scripts/benchmark.ts`):
- **Health Check Baseline**: ~5,580 req/s (p50: 1ms)
- **7-Stage Pipeline Board (200 Leads)**: ~234 req/s (p50: 40ms)
- **Indexed Lead Queries**: ~442 req/s (p50: 21ms)
- **Task Listing**: ~356 req/s (p50: 27ms)
- **Webhook Ingestion**: 1,735–2,184 req/s (p50: 4–10ms)
- **Burst Capacity**: Sustained 500 requests/minute with 1,000 req/min per-tenant rate limit

---

## 🐳 Docker Deployment

A complete production stack (MongoDB, Redis, API Server, and Background Worker) can be started using Docker Compose:

```bash
# Build and run all services
docker compose up -d --build
```

The compose stack provisions:
- `mongodb`: MongoDB 8.0 on port 27017 with persistent volume
- `redis`: Redis 7-alpine on port 6379 with persistent volume
- `server`: Express 5 REST API + Socket.IO on port 5000 (`Dockerfile.server`)
- `worker`: BullMQ asynchronous document and email processor (`Dockerfile.worker`)

---

## 🔌 Webhook Ingestion Example

External leads can be sent to a brokerage's dedicated webhook endpoint:

```bash
curl -X POST https://api.yourdomain.com/api/leads/webhook/<BROKERAGE_ID> \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: <BROKERAGE_WEBHOOK_SECRET>" \
  -d '{
    "firstName": "Rahul",
    "lastName": "Sharma",
    "email": "rahul.sharma@example.com",
    "phone": "+91 98765 43210",
    "city": "Bengaluru",
    "propertyType": "Apartment",
    "propertyValue": 8500000,
    "loanAmount": 6500000,
    "monthlyGrossIncome": 180000,
    "employmentType": "Salaried",
    "preferredContactTime": "Evening",
    "source": "WEBSITE",
    "campaign": "q1_home_loans"
  }'
```

### Ingestion Responses
- **`201 Created`**: New lead created and placed in the `NEW` pipeline stage.
- **`200 OK`**: Duplicate lead recognized on `{ brokerageId, email }` and returned idempotently (`"isDuplicate": true`).
- **`401 Unauthorized`**: Missing or invalid webhook credentials (anti-enumeration protected).
- **`429 Too Many Requests`**: Rate limit exceeded for the verified brokerage (1,000 req/min).

For detailed setup instructions on integrating Google Forms via Google Apps Script, see the [Google Forms Runbook](docs/GOOGLE_FORMS_LEAD_SOURCE_RUNBOOK.md).

---

## 📚 Technical Documentation

Detailed technical documentation and architectural specifications are located in [`docs/`](docs/):

- [Architecture & Isolation](docs/architecture.md) — Multi-tenancy model, service boundaries, and system topology
- [Authentication & Security](docs/auth-security.md) — Dual JWT tokens, session rotation, and RBAC matrix
- [Database Schema & Indexes](docs/database-design.md) — Schemas, compound indexes, and query performance
- [Lead Ingestion & Webhooks](docs/lead-ingestion.md) — Webhook specifications, HMAC signing, and burst handling
- [Lead Pipeline & Concurrency](docs/lead-pipeline.md) — State machine, optimistic concurrency, and WebSocket sync
- [Client Cases & Conversion](docs/client-cases.md) — Lead conversion logic and portal account provisioning
- [Document Storage & ImageKit](docs/document-storage.md) — Object storage abstraction and folder namespacing
- [Document Processing & BullMQ](docs/document-processing.md) — Asynchronous verification queue and recovery sweeper
- [Pipeline Triggers & Automations](docs/pipeline-triggers.md) — Event-driven trigger rules, tasks, and email queuing
- [Google Forms Integration Runbook](docs/GOOGLE_FORMS_LEAD_SOURCE_RUNBOOK.md) — Step-by-step external form connection guide
- [Product User Manual](USER_MANUAL.md) — End-to-end user manual and walkthrough for all four roles

---

## ⚖️ Intentional Limitations & Scaling Considerations

1. **Document Verification Engine**: Document verification currently executes simulated inspection logic (configurable inspection delay, sample rejection rules, and retryable error handling) inside BullMQ workers. In production, this worker interfaces with commercial OCR or KYC verification APIs (e.g. AWS Textract, Persona).
2. **Email Delivery Provider**: Pipeline email notifications are queued through BullMQ with mock delivery and operational PII masking. The delivery worker is designed for drop-in transactional email providers (Resend, SendGrid, Amazon SES) using the configured `RESEND_API_KEY`.
3. **In-Memory Rate Limiting**: The current webhook rate limiter utilizes an in-memory store keyed by verified brokerage ID. For horizontally scaled multi-instance API deployments behind a load balancer, configuring `rate-limit-redis` coordinates rate counters across nodes.
4. **Worker Process Separation**: In local development, background workers can run concurrently within the project. For high-volume production deployments, worker processes should run as dedicated, isolated containers (`npm --prefix worker run dev` or `Dockerfile.worker`) to keep heavy CPU and I/O workloads off the HTTP event loop.

---

## 📄 License

MIT © LeadFlow Contributors
