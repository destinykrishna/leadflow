# LeadFlow — Agent Instructions

## Project
LeadFlow

## Current Phase
Phase 3 — Lead Management & Ingestion (Prompt 2: Lead Ingestion Reliability & Closeout Completed)

## Architecture
- **Monorepo Topology**:
  - `client/`: React 19, Vite, TanStack Query, Tailwind CSS.
  - `server/`: Express 5, Mongoose 9, TypeScript ESM, Zod.
  - `worker/`: BullMQ, Redis, asynchronous document verification & email processors.
  - `packages/shared/`: Shared domain contracts, constants, schemas.
  - `docs/`: Persistent architecture and database documentation (`docs/architecture.md`, `docs/database-design.md`, `docs/auth-security.md`, `docs/lead-ingestion.md`).
- **Server Layer Structure**:
  - `src/config/`: Environment configuration (`env.ts`) & database connection lifecycle (`database.ts`).
  - `src/models/`: Domain schemas and models with strict indexing, `brokerageId` scoping, `webhookSecret` integration, and `Session` rotation management.
  - `src/repositories/`: Lean data access layer enforcing tenant isolation (`withBrokerageScope`, `ScopedRepository`, `clientRepository`, `documentRepository`, `leadRepository`).
  - `src/services/`: Domain business logic orchestration (`token.service.ts`, `auth.service.ts`, `authorization.service.ts`, `lead-ingestion.service.ts`).
  - `src/controllers/`: HTTP route controllers (`auth.controller.ts`, `brokerage.controller.ts`, `client.controller.ts`, `document.controller.ts`, `lead-ingestion.controller.ts`).
  - `src/middleware/`: Authentication context (`auth.middleware.ts`), RBAC guards (`rbac.middleware.ts`), webhook authentication (`webhook-auth.middleware.ts`), and centralized operational error handling (`error.middleware.ts`).
  - `src/routes/`: Express API routes (`auth.routes.ts`, `brokerage.routes.ts`, `client.routes.ts`, `document.routes.ts`, `lead.routes.ts`).
  - `src/validators/`: Zod runtime validation schemas (`auth.validators.ts`, `common.validators.ts`, `lead.validators.ts`).
  - `src/utils/`: Pino logger (`logger.ts`), custom errors (`errors.ts`), password/token hashing (`password.ts`), cookie helpers (`cookie.ts`).
  - `src/types/`: Domain TypeScript types and interfaces.
- **Testing Architecture**: Vitest test runner with isolated in-memory MongoDB via `mongodb-memory-server`.

## Technology
- **Runtime & Language**: Node.js (>=20.19.0), TypeScript 7 (NodeNext ESM).
- **Backend API**: Express 5.2.1, Mongoose 9.10.2, Zod 4.6.5, Pino 10.3.1, bcryptjs 3.0.3, jsonwebtoken 9.0.3, cookie-parser 1.4.7, express-rate-limit 8.7.0.
- **Database**: MongoDB 8+ (tested via `mongodb-memory-server` 11.3.0).
- **Background Jobs**: BullMQ 6.3.8, ioredis 6.0.0.
- **Real-Time**: Socket.IO 4.8.3.
- **Testing**: Vitest 5.0.1, Supertest 7.3.0.

## Domain Rules
- Use `Brokerage` as the business domain term (never `Tenant`).
- Four user roles supported: `PLATFORM_ADMIN`, `BROKERAGE_ADMIN`, `ADVISOR`, `CLIENT`.
- `PLATFORM_ADMIN` is a system-level role operating across the platform (`brokerageId` is optional/null).
- `BROKERAGE_ADMIN`, `ADVISOR`, and `CLIENT` are tenant-level roles and strictly require `brokerageId`.
- Tenant isolation key is `brokerageId: Types.ObjectId`.
- All tenant-scoped models must declare `brokerageId` (required, indexed) and `timestamps: true`.
- Compound unique constraints on tenant models must be scoped by `brokerageId` (e.g. `{ brokerageId: 1, email: 1 }`).
- Operational errors must inherit from `AppError` with explicit HTTP status codes and error codes.
- Do not over-engineer repositories; use them where they provide clear value for tenant isolation.

## Tenant Model
- Multi-tenancy follows the shared database, shared collection pattern with tenant discrimination.
- Every tenant query must strictly enforce `withBrokerageScope(brokerageId, filter)`.
- Cross-tenant data access attempts must throw `BrokerageIsolationError` (HTTP 403 / `BROKERAGE_ISOLATION_VIOLATION`).
- Socket.IO rooms are scoped per brokerage (`brokerage:<brokerageId>`); no global broadcasts of tenant data.
- Worker job payloads must carry `brokerageId` to verify tenant authorization during asynchronous processing.

## Architectural Decisions
- **Decision (Phase 1, Prompt 1)**: Configured NodeNext ESM modules across the server workspace.
- **Decision (Phase 1, Prompt 1)**: Integrated Mongoose 9 with `QueryFilter<T>` typing and created `withBrokerageScope` helper for safe, uniform query filtering.
- **Decision (Phase 1, Prompt 1)**: Standardized on `mongodb-memory-server` with global hooks in `tests/setup.ts` to guarantee test isolation without external database prerequisites.
- **Decision (Phase 1, Prompt 1)**: Established centralized error hierarchy (`AppError`, `BrokerageIsolationError`, `ValidationError`, `NotFoundError`).
- **Decision (Phase 1, Prompt 2)**: Implemented 8 core domain models (`Brokerage`, `User`, `Lead`, `Client`, `Document`, `Task`, `EmailTemplate`, `PipelineTrigger`) with full Mongoose 9 schemas, strict enum validations, and timestamps.
- **Decision (Phase 1, Prompt 2)**: Structured cross-brokerage duplicate tolerance by defining compound unique indexes on `{ brokerageId: 1, email: 1 }` (for `User`, `Lead`, `Client`) and `{ brokerageId: 1, slug: 1 }` (for `EmailTemplate`), enabling independent tenant operations without cross-tenant collisions.
- **Decision (Phase 1, Prompt 2)**: Embedded `Client.address` and `PipelineTrigger.actionConfig` as typed subdocuments (`_id: false`) to avoid unnecessary relational joins for tightly coupled 1:1 data.
- **Decision (Phase 1, Prompt 3)**: Aligned user roles with `assignment.md`: `PLATFORM_ADMIN`, `BROKERAGE_ADMIN`, `ADVISOR`, and `CLIENT`. Configured conditional validation on `User.brokerageId` so platform admins are not bound to a tenant, while enforcing strict tenant scoping on all other roles.
- **Decision (Phase 1, Prompt 3)**: Linked `Client.userId` to connect portal user accounts with client profiles, and expanded `Document.type` to include `PAYSLIP` for German mortgage expat workflows.
- **Decision (Phase 1, Prompt 3)**: Created test seed fixture (`server/tests/fixtures/seed.fixture.ts`) populating all 4 user roles and domain models for automated testing. Phase 1 complete.
- **Decision (Phase 2, Prompt 1)**: Implemented dual JWT + refresh session strategy. Access tokens are short-lived (15m) and self-contained with tenant context (`brokerageId`). Refresh tokens are long-lived (7d) and tracked via `Session` documents with SHA-256 hashed storage (`tokenHash`) and MongoDB TTL auto-expiry.
- **Decision (Phase 2, Prompt 1)**: Integrated RFC 6819 refresh token rotation and reuse detection using token family lineages (`family` UUID). Any replay attempt of an invalidated/replaced token triggers immediate revocation of all sessions in that family. Added unique `tokenId` (UUID) to payload to ensure distinct cryptographic signatures under sub-millisecond rotations.
- **Decision (Phase 2, Prompt 1)**: Handled multi-tenant login resolution for all 4 roles. `PLATFORM_ADMIN` authenticates globally with `brokerageId: null`. Tenant roles require an active user and active brokerage. Disambiguation across duplicate cross-brokerage emails supported via `brokerageSlug` or `brokerageId`.
- **Decision (Phase 2, Prompt 1)**: Configured secure HTTP-only cookies (`httpOnly: true`, `sameSite: 'lax'`, `secure: env.isProduction`) with body fallback for API clients. Added auth route rate limiting (`express-rate-limit`) with test environment bypass.
- **Decision (Phase 2, Prompt 1)**: Implemented `authenticate` middleware establishing strongly typed `req.user` context while enforcing database validation on user active status.
- **Decision (Phase 2, Prompt 2)**: Established centralized authorization primitives: `requireRoles` (HTTP 403 `FORBIDDEN` on unauthorized role), `requireSameBrokerage` (HTTP 403 `BROKERAGE_ISOLATION_VIOLATION` on URL param tenant mismatch, allowing `PLATFORM_ADMIN` cross-tenant access), and `requireActiveUser` (HTTP 401 on suspended/inactive account).
- **Decision (Phase 2, Prompt 2)**: Implemented generic `ScopedRepository<T, TDoc>` automatically scoping read and write operations to `{ brokerageId: user.brokerageId }` from trusted `req.user` server context, eliminating controller-level tenant query omissions.
- **Decision (Phase 2, Prompt 2)**: Enforced anti-IDOR protection with zero cross-tenant information leakage. Querying a guessed ID belonging to another brokerage or client returns `null` mapping to HTTP 404 (`NotFoundError`), completely concealing resource existence.
- **Decision (Phase 2, Prompt 2)**: Implemented `AuthorizationService` enforcing strict `CLIENT` role profile and document ownership (`userId === req.user.id` and `uploadedBy === req.user.id`), blocking lateral access to fellow expat clients within the same brokerage. Phase 2 complete.
- **Decision (Phase 2, Prompt 2 Audit)**: Completed focused audit of RBAC and tenant isolation. Hardened `requireSameBrokerage` against missing route parameters, added defensive ObjectId validation and service layer assertions to `BrokerageController.getBrokerageById`, guarded against falsy `uploadedBy` in `AuthorizationService`, and verified that the 7 skipped test suites are future phase stubs (`describe.todo`) with no skipped RBAC/tenant tests. Total 119 tests passing.
- **Decision (Phase 3, Prompt 1)**: Built Lead Ingestion Foundation supporting external webhooks (`POST /api/leads/webhook/:brokerageId` and `/api/leads/ingest/:brokerageId`). Implemented dual authentication via `x-webhook-secret` / Bearer token or HMAC SHA-256 (`x-signature-sha256`) with constant-time verification (`crypto.timingSafeEqual`). Normalization layer accepts standard JSON leads and external provider format (Typeform `form_response`), automatically extracting domain fields while discarding untrusted client `brokerageId` in request bodies. Scoped repository (`LeadRepository`) enforces deterministic duplicate detection on `{ brokerageId: 1, email: 1 }` and catches concurrent race conditions (MongoDB code 11000) to return existing leads idempotently (`isDuplicate: true`, HTTP 200) without crashing or creating duplicate documents. Total 150 tests passing.
- **Decision (Phase 3, Prompt 2)**: Hardened Lead Ingestion for reliability, concurrency, and privacy. Implemented anti-enumeration defense in `verifyWebhookAuth` returning uniform HTTP 401 `UnauthorizedError` to unauthenticated callers, preventing discovery of brokerage existence or active/suspended status. Implemented "already known" person detection in `LeadRepository.ingestLead` matching existing `Client` records within the brokerage, linking `existingClientId`, marking `knownAs: 'CLIENT'`, and inheriting current advisor assignments. Hardened MongoDB duplicate-key race condition absorption under high-volume burst ingestion. Masked PII (`maskEmail`) in structured ingestion logs. Phase 3 Lead Ingestion closed out with 159 passing tests.
- **Decision (Phase 3, Rate Limiting Fix)**: Replaced IP-based limiter with tenant-aware `brokerageIngestionLimiter` (1,000 req/min per verified brokerage) ordered strictly after `verifyWebhookAuth`. Keyed by `req.webhookBrokerage._id`, ensuring unauthenticated probes cannot consume brokerage quota and preventing noisy brokerages from throttling neighboring tenants sharing webhook egress IPs. Verified 500-request burst ingestion without throttling. Total 164 tests passing.

## Rules
- Do not invent requirements.
- Inspect existing code before modifying it.
- Preserve established architecture.
- Do not implement future phases.
- Run tests/typecheck after changes.
- Document architectural decisions.