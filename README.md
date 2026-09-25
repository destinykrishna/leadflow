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

### 📄 Expat Mortgage Document Verification
- Domain-tailored checklist types including `PAYSLIP` (*Gehaltsabrechnung*), `BANK_STATEMENT`, `ID_DOCUMENT`, and `TAX_RETURN`.
- Asynchronous verification pipeline architecture prepared for background workers.

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
│   │   ├── repositories/   # Lean scoped data access layer
│   │   ├── routes/         # Express API routes with tenant-aware rate limiting
│   │   ├── services/       # Domain business logic orchestration
│   │   ├── utils/          # Logger, custom error hierarchy, password helpers
│   │   └── validators/     # Zod runtime validation schemas
│   └── tests/              # Vitest test suite with in-memory MongoDB
├── worker/                 # BullMQ + Redis background worker service
├── packages/
│   └── shared/             # Shared TypeScript types, constants, and schemas
└── docs/                   # System and architecture design specifications
    ├── architecture.md     # Multi-tenancy, service boundaries, and system topology
    ├── auth-security.md    # Token lifecycle, RBAC matrix, and IDOR defenses
    ├── database-design.md  # Schema definitions, compound indexes, and query patterns
    └── lead-ingestion.md   # Webhook specs, HMAC verification, and burst ingestion
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

*Note: Chronological execution logs and internal development tracking are maintained separately in `PROMPTS.md` and `AGENTS.md`.*

---

## License

MIT © LeadFlow Contributors
