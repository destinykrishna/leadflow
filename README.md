# LeadFlow

LeadFlow is an intelligent, multi-tenant lead management and brokerage operations platform designed for modern real estate brokerages.

---

## Current Status: Phase 2 — Authentication & Authorization
- **Phase 1, Prompt 1**: Foundation & Scaffolding established.
  - Database connection lifecycle management and configuration.
  - Multi-tenant brokerage isolation query helpers and contracts.
  - Centralized application and operational error classes.
  - Zod validation infrastructure and common schemas.
  - Vitest test infrastructure with in-memory MongoDB (`mongodb-memory-server`).
- **Phase 1, Prompt 2**: Core Database Models implemented.
  - Implemented 8 core Mongoose models: `Brokerage`, `User`, `Lead`, `Client`, `Document`, `Task`, `EmailTemplate`, and `PipelineTrigger`.
  - Enforced strict brokerage tenant isolation with compound indexes (`{ brokerageId: 1, ... }`).
  - Added duplicate detection for leads and clients with cross-brokerage tolerance.
- **Phase 1, Prompt 3**: Domain Alignment & Final Audit.
  - Aligned User/RBAC roles with assignment requirements: `PLATFORM_ADMIN`, `BROKERAGE_ADMIN`, `ADVISOR`, and `CLIENT`.
  - Treated `PLATFORM_ADMIN` as a system-level role with optional `brokerageId` and global email uniqueness.
  - Enforced strict `brokerageId` requirement and scoped uniqueness for `BROKERAGE_ADMIN`, `ADVISOR`, and `CLIENT`.
  - Added `Client.userId` to link client portal user accounts with client profiles.
  - Added `PAYSLIP` to `Document` types for German mortgage expat workflows.
  - Added test seed fixture (`server/tests/fixtures/seed.fixture.ts`).
- **Phase 2, Prompt 1**: Authentication Foundation implemented.
  - Password hashing and verification via `bcryptjs` with salt round guarantees.
  - Dual JWT + refresh session strategy: short-lived access tokens (15m) and long-lived refresh tokens (7d).
  - Stateful session tracking via `Session` model with SHA-256 hashed storage (`tokenHash`) and TTL index auto-eviction.
  - RFC 6819 refresh token rotation and breach reuse detection with immediate session family invalidation.
  - Secure HTTP-only cookies (`httpOnly: true`, `sameSite: 'lax'`, `secure: env.isProduction`) with body fallback for API clients.
  - Login flow supporting all 4 roles (`PLATFORM_ADMIN`, `BROKERAGE_ADMIN`, `ADVISOR`, `CLIENT`), verifying active user and brokerage status.
  - Authentication middleware (`authenticate`) establishing strongly-typed `req.user` context with tenant discrimination (`brokerageId: null` for platform admins vs string for brokerage users).
  - Rate limiting on auth routes via `express-rate-limit` with test environment bypass.
- **Phase 2, Prompt 2**: Authorization, RBAC & Tenant Isolation implemented.
  - Reusable RBAC guards: `requireRoles` (HTTP 403 `FORBIDDEN` on role mismatch), `requireSameBrokerage` (HTTP 403 `BROKERAGE_ISOLATION_VIOLATION` on URL param mismatch), and `requireActiveUser` (HTTP 401 on suspended accounts).
  - Generic `ScopedRepository<T, TDoc>` automatically scoping database queries to `{ brokerageId: user.brokerageId }` based on trusted server context.
  - Anti-IDOR defense: Cross-brokerage guessed MongoDB IDs return HTTP 404 (`NotFoundError`) rather than 403, completely preventing cross-tenant existence enumeration.
  - Client-level ownership isolation via `AuthorizationService`: `CLIENT` accounts are strictly restricted to their own profile (`client.userId === req.user.id`) and uploaded documents (`doc.uploadedBy === req.user.id`), blocking horizontal access across expat cases in the same brokerage.
  - `PLATFORM_ADMIN` cross-brokerage access permitted on platform endpoints (`/api/brokerages`) and resource inspections without tenant restriction.
- **Phase 3, Prompt 1**: Lead Ingestion Foundation implemented.
  - External lead webhook endpoints (`POST /api/leads/webhook/:brokerageId` and `/api/leads/ingest/:brokerageId`).
  - Webhook authentication supporting both shared secret (`x-webhook-secret` / Bearer token) and HMAC SHA-256 signatures (`x-signature-sha256`) with timing attack mitigation (`crypto.timingSafeEqual`).
  - Normalization layer accepting standard JSON lead payloads and external form providers (Typeform `form_response`), automatically extracting names, email, phone, UTM tags, and custom fields.
  - Strict tenant scoping: client-supplied `brokerageId` in body payloads is completely stripped/ignored; tenant identity is bound strictly to the authenticated route brokerage.
  - Deterministic duplicate detection on `{ brokerageId: 1, email: 1 }` with idempotent repeated delivery handling (HTTP 200 with `isDuplicate: true`), returning existing lead without creating duplicate documents.
  - Concurrent race condition resilience: catches MongoDB code 11000 duplicate key conflicts to resolve the existing record safely.
  - 150 unit & integration tests passing with zero failures. Phase 3 Prompt 1 complete.
- **Phase 3, Prompt 2**: Lead Ingestion Reliability & Closeout implemented.
  - Anti-enumeration defense in `verifyWebhookAuth`: Unauthenticated callers probing webhook URLs receive uniform HTTP 401 `UnauthorizedError` without DB execution, preventing brokerage ID existence and status discovery.
  - Person "already known" detection: Detects when incoming leads belong to existing `Client` records within the brokerage (`isAlreadyKnown: true`, `knownAs: 'CLIENT'`), attaching `existingClientId` and inheriting existing advisor assignments.
  - Concurrency & burst reliability: Verified parallel duplicate deliveries and multi-tenant burst ingestion (20 concurrent requests across brokerages) with zero duplicate records and absolute tenant isolation.
  - Privacy observability: Masked PII (`maskEmail`) in structured ingestion logs without exposing secrets or sensitive custom fields.
  - Tenant-aware ingestion rate limiting (`brokerageIngestionLimiter`): 1,000 req/min per verified brokerage placed after webhook authentication, eliminating noisy-neighbor IP throttling and accommodating 500 req/min webhook bursts.
  - 164 unit & integration tests passing with zero failures. Lead Ingestion completed.

---

## Monorepo Structure

```
leadflow/
├── client/                 # React 19 + Vite frontend
├── server/                 # Express 5 + Mongoose 9 backend API
│   ├── src/
│   │   ├── config/         # Environment (env.ts) and database connection (database.ts)
│   │   ├── models/         # Domain models scaffolding
│   │   ├── repositories/   # Base repository & withBrokerageScope query helper
│   │   ├── services/       # Domain services scaffolding
│   │   ├── validators/     # Zod validation schemas and helpers
│   │   ├── utils/          # Pino logger and AppError / BrokerageIsolationError classes
│   │   └── types/          # Domain TypeScript types & IBrokerageScoped interface
│   └── tests/
│       ├── helpers/        # MongoMemoryServer database test setup
│       ├── unit/           # Unit tests (database, domain infrastructure)
│       ├── integration/    # Integration test suites
│       └── setup.ts        # Vitest global test lifecycle hooks
├── worker/                 # BullMQ + Redis background worker
├── packages/
│   └── shared/             # Shared contracts, constants, and schemas
├── docs/                   # Architectural & database design specifications
│   ├── architecture.md     # System architecture and multi-tenant isolation
│   └── database-design.md  # Database standards, indexing, and test strategy
├── AGENTS.md               # Persistent source of agent instructions and verified architecture
├── PROMPTS.md              # Chronological prompt tracking and execution log
└── package.json            # Root workspace scripts
```

---

## Technology Stack

- **Runtime**: Node.js >= 20.19.0
- **Language**: TypeScript 7 (ES Modules / NodeNext)
- **Backend API**: Express 5.2.1, Mongoose 9.10.2, Zod 4.6.5, Pino 10.3.1
- **Testing**: Vitest 5.0.1, mongodb-memory-server 11.3.0
- **Background Worker**: BullMQ 6.3.8, ioredis 6.0.0
- **Frontend**: React 19, Vite 8, TanStack Query 5, Tailwind CSS

---

## Developer Commands

```bash
# Typecheck across server, worker, and client
npm run typecheck

# Run test suite
npm run test

# Run tests with coverage
npm run test:coverage

# Build client bundle
npm run build
```

---

## Multi-Tenant Isolation
Multi-tenancy uses the **Brokerage** domain model. All tenant-scoped entities enforce `brokerageId` with compound indexing and query scoping via `withBrokerageScope`. Any cross-tenant access violation triggers an explicit `BrokerageIsolationError` (HTTP 403).
