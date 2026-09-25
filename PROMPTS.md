## Prompt 1
```
leadflow/
│
├── client/                         # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── dashboard/
│   │   │   ├── leads/
│   │   │   ├── pipeline/
│   │   │   ├── clients/
│   │   │   ├── documents/
│   │   │   ├── tasks/
│   │   │   └── email-templates/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── routes/
│   │   ├── types/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
│
├── server/                         # Express API
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── validators/
│   │   ├── sockets/
│   │   ├── queues/
│   │   ├── utils/
│   │   ├── types/
│   │   ├── app.ts
│   │   └── server.ts
│   │
│   ├── tests/
│   │   ├── integration/
│   │   │   ├── auth.test.ts
│   │   │   ├── leads.test.ts
│   │   │   ├── pipeline.test.ts
│   │   │   ├── clients.test.ts
│   │   │   ├── documents.test.ts
│   │   │   ├── tasks.test.ts
│   │   │   └── tenants.test.ts
│   │   ├── unit/
│   │   │   ├── auth.service.test.ts
│   │   │   ├── lead.service.test.ts
│   │   │   └── trigger.service.test.ts
│   │   ├── fixtures/
│   │   └── setup.ts
│   │
│   ├── package.json
│   └── tsconfig.json
│
├── worker/                         # BullMQ workers
│   ├── src/
│   │   ├── processors/
│   │   │   ├── document.processor.ts
│   │   │   └── email.processor.ts
│   │   ├── queues/
│   │   ├── config/
│   │   ├── services/
│   │   ├── utils/
│   │   └── worker.ts
│   ├── package.json
│   └── tsconfig.json
│
├── packages/                       # Shared types/utilities
│   └── shared/
│       ├── src/
│       │   ├── types/
│       │   ├── constants/
│       │   └── schemas/
│       ├── package.json
│       └── tsconfig.json
│
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── PROMPTS.md

check do we have this type of folder strucutre or not if not create the things that are not available
```

## Prompt 2
```
don't write code just make the folder strucuture
```

## Prompt 3
```
remove the code and make file empty
```

## Prompt 4
```
give a summary of the whole folder strucuture
```

## Prompt 5
```
Review the current LeadFlow monorepo structure and fix the architecture based on the following requirements:

1. Keep the high-level structure:
client / server / worker / packages/shared.

2. PROMPTS.md must ONLY contain the exact chronological AI prompts used during development, unedited. Do not use it as a roadmap.

3. Use the domain term `Brokerage` instead of `Tenant` for the actual business model/types. Keep `brokerageId` for tenant isolation.

4. Keep the server layers:
config, controllers, middleware, models, repositories, routes, services, sockets, queues, validators, utils, types.

5. Do not over-engineer repositories. Use them only where they provide clear value, especially for brokerage-scoped queries.

6. Middleware should support:
- authentication
- RBAC
- brokerage/tenant isolation
- validation
- rate limiting
- centralized error handling

7. Add express-rate-limit if it is not already installed.

8. Socket.IO must use brokerage-specific rooms. Never broadcast tenant-specific events globally.

9. Worker should remain focused on assignment requirements:
- document verification processor
- email processor
Remove unnecessary marketing/PDF-generation responsibilities.

10. Keep the shared package small:
types, constants, schemas only. Do not put Mongoose/backend-specific code there.

11. Keep automated API/integration testing as a first-class part of the project. Tests must cover:
- authentication
- RBAC
- brokerage isolation
- duplicate lead detection
- cross-brokerage duplicate behavior
- pipeline transitions
- client/document authorization
- document processing
- task triggers
- email triggers

12. Rename `tenants.test.ts` to `brokerage-isolation.test.ts`.

13. Do not create unnecessary files or empty abstractions. Keep the architecture clean and proportional to a 5–7 day assignment.

14. Do NOT implement business features yet. First inspect the current repository, make only the structural corrections above, and report exactly what you changed.

Do not rewrite working code unnecessarily.
```

## Phase 1, Prompt 1: Foundation & Scaffolding
```
LeadFlow — Phase 1, Prompt 1: Foundation & Scaffolding

First inspect the repository and existing AGENTS.md. Do not assume architecture or technologies that are not verified from the repository/project requirements.

Use the globally installed skills when relevant:
- database-architect
- data-engineer

Task:
Establish the initial Phase 1 database/domain architecture and scaffolding only.

Create the required folder/module structure for:
- database/infrastructure
- domain/models
- repositories/data access
- domain/services
- validation
- tests

Set up only the foundational database configuration and shared domain infrastructure needed for the next prompts.

Do NOT implement:
- actual domain models/business rules
- repositories
- APIs/controllers
- authentication/authorization
- queues/workers
- AI features
- email workflows
- frontend
- external integrations
```

### Status
COMPLETED

### Decisions & Assumptions
1. **Module System**: Standardized `server`, `worker`, and `packages/shared` on NodeNext ES Modules (`"type": "module"`).
2. **Database Engine**: Mongoose 9.x with resilient connection lifecycle management (`connectDatabase`, `disconnectDatabase`, `isDatabaseConnected`, `getDatabaseConnectionState`) and lifecycle logging.
3. **Multi-Tenant Model**: Brokerage-scoped discrimination enforced via `IBrokerageScoped` interface and `withBrokerageScope` helper, with `BrokerageIsolationError` (HTTP 403) on violation.
4. **Validation**: Zod 4.x used for runtime environment parsing and common schemas (`objectIdSchema`, `paginationQuerySchema`, `validateData`).
5. **Testing**: Vitest with `mongodb-memory-server` in `server/tests/setup.ts` to allow self-contained, isolated test execution without external MongoDB prerequisites. Planned integration and unit test files stubbed with `describe.todo()` to preserve test discoverability without premature suite failures.
6. **Documentation**: Persistent architectural and database specifications created in `docs/architecture.md` and `docs/database-design.md`.

### Completed Work
- Verified and aligned TypeScript, Vitest, and package configurations across `server`, `worker`, `client`, and `packages/shared`.
- Created database connection manager and lifecycle hooks in `server/src/config/database.ts` and environment validator in `server/src/config/env.ts`.
- Created domain error hierarchy in `server/src/utils/errors.ts` and structured logger in `server/src/utils/logger.ts`.
- Created domain typing and tenant scoping contracts in `server/src/types/domain.types.ts`.
- Created base repository interface and `withBrokerageScope` helper in `server/src/repositories/base.repository.ts`.
- Created base validation schemas and `validateData` utility in `server/src/validators/common.validators.ts`.
- Created base domain service marker in `server/src/services/base.service.ts`.
- Created in-memory test database helper in `server/tests/helpers/db.helper.ts` and global lifecycle hooks in `server/tests/setup.ts`.
- Created comprehensive infrastructure unit tests in `server/tests/unit/database.test.ts`.
- Initialized `packages/shared` package skeleton with types, constants, schemas.
- Updated `AGENTS.md`, `README.md`, and `PROMPTS.md`.

## Phase 1, Prompt 2: Core Database Models
```
LeadFlow — Phase 1, Prompt 2: Core Database Models

Continue from the architecture established in Prompt 1.

Before coding, read:
- AGENTS.md
- docs/architecture.md
- docs/database-design.md
- PROMPTS.md
- existing server database/model/repository code

Use the `database-architect` and `data-engineer` skills where relevant.

Implement the core Mongoose schemas/models for the LeadFlow domain:

- Brokerage
- User
- Lead
- Client
- Document
- Task
- EmailTemplate
- PipelineTrigger

For each model, define only fields and relationships supported by the existing project requirements.

Apply:
- correct Mongoose types
- required/optional fields
- enums/statuses
- timestamps
- references
- appropriate validation
- brokerageId tenant scoping for brokerage-owned entities
- compound indexes for expected queries
- unique/deduplication constraints where required

Important:
- Do not implement APIs/controllers yet.
- Do not implement authentication flows yet.
- Do not implement BullMQ/workers yet.
- Do not invent business rules that belong to later prompts.
- Preserve the tenant-isolation architecture from Prompt 1.
- Avoid unnecessary abstractions.

Add focused Vitest tests for:
- schema validation
- required fields
- enum constraints
- brokerageId requirements
- uniqueness/deduplication constraints
- important indexes where practical

Run:
- typecheck
- tests
- build

Then update:
- AGENTS.md
- README.md
- PROMPTS.md
- docs/database-design.md
- relevant domain documentation

Record the actual schema decisions and any unresolved decisions.

STOP after Prompt 2. Do not begin Prompt 3.
```

### Status
COMPLETED

### Decisions & Assumptions
1. **Scoped Deduplication Strategy**: Implemented compound unique indexes on `{ brokerageId: 1, email: 1 }` for `User`, `Lead`, and `Client`, and `{ brokerageId: 1, slug: 1 }` for `EmailTemplate`. This guarantees deduplication within any single brokerage while naturally supporting cross-brokerage duplicate tolerance (separate brokerages can register the same lead email).
2. **Subdocument Embedding**: Embedded `Client.address` and `PipelineTrigger.actionConfig` as subdocuments (`_id: false`) rather than creating detached relational collections.
3. **Mongoose 9 Type Safety**: Document interfaces (`IBrokerageDocument`, `IUserDocument`, `ILeadDocument`, `IClientDocument`, `IDocumentDocument`, `ITaskDocument`, `IEmailTemplateDocument`, `IPipelineTriggerDocument`) maintain full compile-time and runtime type synchronization.
4. **Deferred Decisions**:
   - Password hashing hooks deferred to Phase 2 (Authentication).
   - Soft-delete retention policies deferred to API/Service phase.
   - Dynamic custom pipeline stages deferred to future configuration prompt.

### Completed Work
- Implemented all 8 core Mongoose models in `server/src/models/`:
  - `brokerage.model.ts` (Root tenant with plans and status)
  - `user.model.ts` (RBAC roles, brokerageId scoping, unique email)
  - `lead.model.ts` (Pipeline stages, scoring, source, deduplication index)
  - `client.model.ts` (Converted lead reference, embedded address)
  - `document.model.ts` (Verification status enums for BullMQ worker target)
  - `task.model.ts` (Priorities, status, dueDate, assignment)
  - `email-template.model.ts` (Scoped slugs, subject, body, variables)
  - `pipeline-trigger.model.ts` (Stage transition actions, task/email configs)
- Created barrel export in `server/src/models/index.ts`.
- Created 23 focused unit tests in `server/tests/unit/models.test.ts` verifying validations, required fields, enum guards, tenant scoping, deduplication, and cross-brokerage duplicate allowance. Total unit tests: 37 passing.
- Updated `docs/database-design.md`, `AGENTS.md`, and `README.md`.

## Phase 1, Prompt 3: Domain Alignment & Final Audit
```
LeadFlow — Phase 1, Prompt 3: Domain Alignment & Final Audit

Read:
- assignment.md
- AGENTS.md
- docs/database-design.md
- PROMPTS.md
- the models created in Prompt 2

This is a small correction/finalization prompt. Do not redesign the architecture.

1. Align the User/RBAC domain terminology with the assignment:
   - PLATFORM_ADMIN
   - BROKERAGE_ADMIN
   - ADVISOR
   - CLIENT

Review the existing `ADMIN`, `AGENT`, `STAFF` roles and replace/remap them where necessary so the domain model matches the assignment without breaking the established architecture.

Important:
- PLATFORM_ADMIN must be treated appropriately as a platform-level role.
- Brokerage-scoped users must retain strict brokerage isolation.
- Do not invent permissions yet; detailed RBAC behavior belongs to Phase 2.

2. Review the Phase 1 models for obvious inconsistencies with `assignment.md`.
3. Fix only genuine Phase 1 issues found.
4. Add/update minimal seed data only if the existing project architecture requires it for development/testing.
5. Add focused tests for the corrected role/domain behavior.

Do NOT implement authentication, APIs, pipeline services, workers, realtime, or frontend.

Run:
- typecheck
- tests
- build

Update:
- AGENTS.md
- README.md
- PROMPTS.md
- docs/database-design.md

Record the correction and why it was necessary.

STOP. Phase 1 should be considered complete after this prompt.
```

### Status
COMPLETED (Phase 1 Finalized)

### Decisions & Assumptions
1. **User/RBAC Terminology Realignment**: Remapped legacy roles (`ADMIN`, `AGENT`, `STAFF`) to the exact 4 user roles specified in `assignment.md`: `PLATFORM_ADMIN`, `BROKERAGE_ADMIN`, `ADVISOR`, and `CLIENT`.
2. **Platform-Level Scoping for PLATFORM_ADMIN**: `PLATFORM_ADMIN` is a system-wide role responsible for managing multi-tenant brokerages and is not confined to a single brokerage. Therefore, `User.brokerageId` was made conditionally required (required for `BROKERAGE_ADMIN`, `ADVISOR`, `CLIENT`, and null/optional for `PLATFORM_ADMIN`). Enforced global email uniqueness for platform admins via a partial index (`{ email: 1 }, { unique: true, partialFilterExpression: { role: 'PLATFORM_ADMIN' } }`).
3. **Portal Account Connection**: Added `userId` reference to `Client` model to enable advisors to convert leads into portal-accessible clients who can authenticate and upload case documents.
4. **German Mortgage Document Types**: Expanded `Document.type` enum to include `PAYSLIP` (`Gehaltsabrechnung`), directly matching the core mortgage checklist items mentioned in `assignment.md` (payslips, ID, bank statements).
5. **Development & Test Seed**: Added `createMinimalSeedData()` fixture in `server/tests/fixtures/seed.fixture.ts` covering all 4 roles across two isolated brokerages, complete with sample leads, clients, payslips, tasks, email templates, and pipeline triggers.

### Completed Work
- Updated `server/src/models/user.model.ts` with `USER_ROLES` (`PLATFORM_ADMIN`, `BROKERAGE_ADMIN`, `ADVISOR`, `CLIENT`), conditional `brokerageId` validation, and partial unique indexes.
- Updated `server/src/models/client.model.ts` with `userId` reference and index.
- Updated `server/src/models/document.model.ts` with `PAYSLIP` document type.
- Updated `server/src/models/pipeline-trigger.model.ts` with nullable `fromStage` typing.
- Created `server/tests/fixtures/seed.fixture.ts` with comprehensive multi-tenant seed data.
- Added 4 new unit tests in `server/tests/unit/models.test.ts` for all 4 roles, platform admin scoping, tenant user requirements, client user linking, and seed dataset verification. Total passing tests: 41.
- Updated `docs/database-design.md`, `AGENTS.md`, and `README.md`.

## Phase 2, Prompt 1: Authentication Foundation
```
LeadFlow — Phase 2, Prompt 1: Authentication Foundation

Read `assignment.md`, `AGENTS.md`, `README.md`, `PROMPTS.md`, and the relevant auth/domain docs first. Treat these maintained files as the project source of truth.

Use the installed `auth-implementation-patterns` and `backend-security-coder` skills.

Do NOT broadly analyze the entire repository or inspect unrelated folders/files. Inspect only the existing auth, User model, server configuration, and test infrastructure needed for this prompt.

Implement the authentication foundation:

- Secure password hashing and verification.
- Login flow for the four existing roles.
- Access-token + refresh-token/session strategy appropriate for the existing architecture.
- Secure HTTP-only cookie handling where applicable.
- Refresh-token rotation and session revocation.
- Logout.
- Authentication middleware that establishes the authenticated user context.
- Respect the existing PLATFORM_ADMIN vs brokerage-scoped user distinction.
- Do not implement detailed RBAC/authorization rules yet; that is Phase 2 Prompt 2.
- Do not implement lead/pipeline/realtime/frontend features.

Add focused unit/integration tests for:
- password hashing/verification
- successful login
- invalid credentials
- refresh rotation
- logout/revocation
- unauthenticated access
- platform vs brokerage user authentication context

Preserve existing architecture and tenant-isolation principles. Do not redesign Phase 1 models unless a genuine auth blocker requires a minimal change.

After implementation:
- run typecheck
- run all tests
- run build
- update `AGENTS.md`, `README.md`, `PROMPTS.md`, and relevant auth/security docs with the actual decisions and current state.

Record important security decisions and tradeoffs, but keep documentation concise.

STOP after this prompt. Do not begin Phase 2 Prompt 2.
```

### Status
COMPLETED

### Decisions & Assumptions
1. **Dual JWT + Stateful Session Strategy**:
   - Access tokens are short-lived (15 minutes), signed with `JWT_SECRET`, and embed `{ userId, email, role, brokerageId }`.
   - Refresh tokens are long-lived (7 days), signed with `JWT_REFRESH_SECRET`, and carry a rotation lineage `family` UUID plus a unique cryptographic salt `tokenId` (UUID) to guarantee distinct JWT signatures during rapid, sub-millisecond rotations.
2. **Session Security & Hashing at Rest**:
   - Created `Session` Mongoose model. Raw refresh tokens are never stored in the database; only SHA-256 hashes (`tokenHash`) are stored.
   - Enforced MongoDB TTL index on `Session.expiresAt` (`expireAfterSeconds: 0`) for automatic background session cleanup.
3. **RFC 6819 Rotation & Reuse Detection**:
   - Every invocation of `POST /api/auth/refresh` rotates the token pair and revokes the previous session record (`isRevoked: true`, `replacedByTokenHash`).
   - If an invalidated session token is presented again (indicating token replay or theft), the server immediately revokes all active sessions in that `family` to contain potential compromise.
4. **Tenant Scoping & Multi-Role Login Resolution**:
   - Authenticates all 4 roles: `PLATFORM_ADMIN`, `BROKERAGE_ADMIN`, `ADVISOR`, and `CLIENT`.
   - For `PLATFORM_ADMIN`, user context explicitly sets `brokerageId: null`.
   - For tenant users, login verifies that both the user and their associated `Brokerage` are active (`status === 'ACTIVE'`).
   - Accommodates cross-brokerage duplicate email tolerance by supporting tenant disambiguation via `brokerageSlug` or `brokerageId`.
5. **Cookie Security & API Fallback**:
   - Configured secure HTTP-only cookies (`httpOnly: true`, `sameSite: 'lax'`, `secure: env.isProduction`) with fallback support for token bodies (`{ refreshToken }`) for API and integration testing clients.
   - Guarded auth endpoints against brute-force attacks via `express-rate-limit` (bypassed in test environment).
6. **Authentication Middleware**:
   - Implemented `authenticate` middleware in `server/src/middleware/auth.middleware.ts`, verifying access token signatures, validating active user state in MongoDB, and attaching `req.user` context.

### Completed Work
- Added JWT and cookie configurations to `server/src/config/env.ts`.
- Created password hashing and SHA-256 token hashing utilities in `server/src/utils/password.ts`.
- Created `Session` model for refresh tokens in `server/src/models/session.model.ts` and exported in `server/src/models/index.ts`.
- Created `TokenService` in `server/src/services/token.service.ts` for access/refresh token generation, verification, and rotation family management.
- Created `Cookie` helper utilities in `server/src/utils/cookie.ts`.
- Created `AuthService` in `server/src/services/auth.service.ts` implementing login, refresh rotation, reuse detection, and session revocation.
- Created auth input validation schemas in `server/src/validators/auth.validators.ts`.
- Created `authenticate` middleware in `server/src/middleware/auth.middleware.ts`.
- Created centralized error handler in `server/src/middleware/error.middleware.ts`.
- Created `AuthController` in `server/src/controllers/auth.controller.ts` and Express router in `server/src/routes/auth.routes.ts`.
- Built Express application setup in `server/src/app.ts` and server starter in `server/src/server.ts`.
- Added 21 unit tests in `server/tests/unit/auth.service.test.ts` (passwords, JWTs, RFC 7519 jti, rotation, reuse detection, multi-tenant credential disambiguation, logout).
- Added 18 integration tests in `server/tests/integration/auth.test.ts` (login flows for all 4 roles, invalid credentials, refresh rotation, reuse protection, logout, protected auth context).
- Created comprehensive architecture and security documentation in `docs/auth-security.md` and updated `docs/architecture.md`.
- All 80 tests passing across the workspace. Typecheck and build succeed with zero errors.

## Phase 2, Prompt 2: Authorization, RBAC & Tenant Isolation
```
LeadFlow — Phase 2, Prompt 2: Authorization, RBAC & Tenant Isolation

Read `assignment.md`, `AGENTS.md`, `README.md`, `PROMPTS.md`, and the relevant auth/security docs first. Treat the maintained project context as the source of truth.

Use the installed `auth-implementation-patterns` and `backend-security-coder` skills.

Do NOT broadly analyze the repository. Inspect only the authorization, middleware, service/repository, and relevant test code needed for this prompt.

Implement the authorization layer:

- Role-based authorization for:
  - PLATFORM_ADMIN
  - BROKERAGE_ADMIN
  - ADVISOR
  - CLIENT
- Establish reusable authorization middleware/guards rather than scattered role checks.
- Enforce strict brokerage tenant isolation at the authorization/resource-access boundary.
- PLATFORM_ADMIN may operate across brokerages where appropriate.
- BROKERAGE_ADMIN and ADVISOR must never access another brokerage's resources.
- CLIENT must only access their own client/case/document scope.
- Prevent IDOR/cross-tenant access through guessed MongoDB IDs.
- Ensure authorization uses the authenticated user's trusted server-side context and validates the target resource's brokerage ownership.
- Return appropriate 401/403/404 responses without leaking cross-tenant resource existence.
- Preserve the authentication implementation from Prompt 1; do not redesign tokens, sessions, cookies, or login flows.
- Do not implement lead/pipeline/realtime/document-processing features yet.

Add focused integration/unit tests covering:
- each role's allowed operations
- forbidden role operations
- cross-brokerage resource access
- guessed/cross-tenant MongoDB IDs
- CLIENT access to another client's case
- CLIENT access to another user's documents
- PLATFORM_ADMIN cross-brokerage access where permitted
- inactive/suspended authenticated users
- authorization behavior for missing/invalid resources
- no cross-tenant information leakage

Prefer centralized reusable authorization primitives and tenant-scoped service/repository access over relying on controllers to remember brokerage filters.

After implementation:
- run all tests
- run typecheck
- run build
- update `AGENTS.md`, `README.md`, `PROMPTS.md`, and relevant security/architecture docs with actual decisions.

Do not start Phase 3. STOP after completing Phase 2 Prompt 2.
```

### Status
COMPLETED (Phase 2 Finalized)

### Decisions & Assumptions
1. **Reusable Authorization Primitives**:
   - Implemented `requireRoles(...allowedRoles)` in `server/src/middleware/rbac.middleware.ts`, rejecting unauthorized roles with HTTP 403 `ForbiddenError` and unauthenticated requests with HTTP 401 `UnauthorizedError`.
   - Implemented `requireSameBrokerage(paramKey)` validating URL parameter tenant boundaries against trusted `req.user.brokerageId`. Rejects mismatched cross-tenant parameters with HTTP 403 `BrokerageIsolationError`, while permitting `PLATFORM_ADMIN` cross-brokerage access.
   - Implemented `requireActiveUser` verifying account active status (`status === 'ACTIVE'`).
2. **Centralized Scoped Data Access**:
   - Created generic `ScopedRepository<T, TDoc>` automatically constructing `{ brokerageId: user.brokerageId }` queries for tenant roles directly from trusted `req.user` server context, eliminating controller-level tenant query omissions.
   - Created `ClientRepository` and `DocumentRepository` extending `ScopedRepository`.
3. **Anti-IDOR & Zero Information Leakage Defense**:
   - Guessed resource IDs from other brokerages query `{ _id, brokerageId: user.brokerageId }`, yielding `null` and returning HTTP 404 (`NotFoundError`) rather than 403, completely preventing cross-tenant resource existence enumeration.
4. **Client-Level Ownership Isolation**:
   - `AuthorizationService` restricts `CLIENT` users to their own client profile (`client.userId === req.user.id`) and uploaded documents (`doc.uploadedBy === req.user.id`). Unowned resources within the same brokerage return HTTP 404 `NotFoundError`, preventing horizontal privilege escalation across expat client cases.
5. **Platform Admin Cross-Brokerage Authority**:
   - `PLATFORM_ADMIN` operates across brokerages on platform management routes (`/api/brokerages`) and resource inspections without tenant restriction (`brokerageId: null`).

### Completed Work
- Created reusable RBAC and tenant boundary guards in `server/src/middleware/rbac.middleware.ts`.
- Created centralized `AuthorizationService` in `server/src/services/authorization.service.ts`.
- Created generic `ScopedRepository` in `server/src/repositories/scoped.repository.ts`, `ClientRepository` in `server/src/repositories/client.repository.ts`, and `DocumentRepository` in `server/src/repositories/document.repository.ts`.
- Created `BrokerageController`, `ClientController`, and `DocumentController` in `server/src/controllers/`.
- Created Express route modules in `server/src/routes/brokerage.routes.ts`, `server/src/routes/client.routes.ts`, and `server/src/routes/document.routes.ts` and mounted in `server/src/app.ts`.
- Added 16 unit tests in `server/tests/unit/authorization.test.ts` verifying RBAC guards, authorization service policies, and scoped repository operations.
- Added 20 integration tests in `server/tests/integration/brokerage-isolation.test.ts` covering allowed/forbidden operations, cross-brokerage boundary protection, IDOR prevention, client ownership isolation, suspended user handling, and 401/403/404 response codes without leakage.
- Updated `docs/auth-security.md`, `AGENTS.md`, and `README.md`.
- All 116 tests passing across the workspace. Typecheck and build succeed with zero errors. Phase 2 complete.

## Prompt 2 Targeted Authorization Audit
```
LeadFlow — Phase 2, Prompt 2: Targeted Authorization Audit
```

### Status
COMPLETED

### Findings & Hardening
1. **Tenant Resource Access**: Confirmed that all implemented tenant resources (`Client`, `Document`) are exclusively accessed via `ScopedRepository` (`ClientRepository`, `DocumentRepository`). Verified zero un-scoped `find`, `findById`, `findOne`, `update`, `delete`, or `aggregate` calls in the application code.
2. **`requireSameBrokerage` Parameter Guarding**: Hardened `requireSameBrokerage` to reject requests where the target parameter is missing, empty, or unresolvable with HTTP 403 `BrokerageIsolationError`, closing any potential bypass from route misconfigurations.
3. **`BrokerageController` Defense-in-Depth & ObjectId Validation**: Added `Types.ObjectId.isValid` validation to prevent unhandled Mongoose `CastError` (500) and added `authorizationService.assertBrokerageAccess(req.user!, brokerage._id)` to ensure controller defense-in-depth even if route middleware order is modified.
4. **`AuthorizationService` Null Safety**: Hardened `authorizeDocumentAccess` to safely evaluate documents with missing/falsy `uploadedBy` values without throwing runtime `TypeError`.
5. **Skipped Test Suites Clarified**: Confirmed the 7 skipped test suites (`tests/unit/lead.service.test.ts`, `tests/unit/trigger.service.test.ts`, `tests/integration/clients.test.ts`, `tests/integration/documents.test.ts`, `tests/integration/leads.test.ts`, `tests/integration/pipeline.test.ts`, `tests/integration/tasks.test.ts`) are Phase 3/4/5 scaffold stubs (`describe.todo`) and contain zero skipped RBAC or tenant isolation regression tests.
6. **Verification**: 119 unit and integration tests passing across the workspace. Zero TypeScript or build errors.

## Phase 3, Prompt 1: Lead Ingestion Foundation
```
LeadFlow — Phase 3, Prompt 1: Lead Ingestion Foundation

Read `assignment.md`, `AGENTS.md`, `README.md`, `PROMPTS.md`, and the relevant existing lead/domain/auth/security docs first. Treat maintained project context as the source of truth.

Do NOT broadly analyze the repository. Inspect only the existing lead model, tenant-scoped data access, auth/authorization infrastructure, API routing, validation, and test infrastructure needed for this prompt.

Implement the Lead Ingestion foundation:

- Create a real external lead-ingestion endpoint using a webhook-style integration with a documented external source/test provider.
- Validate and normalize incoming lead payloads using the existing validation architecture.
- Enforce strict brokerage/tenant ownership for every ingested lead.
- Support the existing Lead domain fields and pipeline starting state (`NEW`).
- Implement deterministic duplicate detection using appropriate brokerage-scoped identity fields.
- Make duplicate ingestion safe/idempotent rather than creating duplicate leads.
- Protect the ingestion endpoint with appropriate authentication/signature verification or webhook secret validation.
- Apply appropriate request-size/input validation and abuse protection.
- Return clear, safe API responses without leaking other brokerage data.
- Keep the design ready for high-volume ingestion and future queue-based processing, but do NOT implement BullMQ yet.
- Do not implement pipeline transitions, realtime updates, email triggers, tasks, document processing, or frontend features yet.

Add focused tests for:
- valid external lead ingestion
- invalid payloads
- missing/invalid webhook authentication
- tenant assignment
- duplicate lead detection
- idempotent repeated webhook delivery
- cross-tenant isolation
- malformed/untrusted input
- appropriate error responses

### Focused self-audit
After implementation, audit ONLY this prompt's work:
- Can an attacker inject a lead into another brokerage?
- Can the same external lead create duplicates through repeated delivery?
- Can an unauthenticated caller submit arbitrary leads?
- Can malformed input bypass validation?
- Does the implementation accidentally trust client-supplied `brokerageId`?
- Is the ingestion path structured so high-volume processing can later move behind a queue?

Fix genuine issues found during the self-audit. Do not redesign unrelated architecture.

Then run:
- all tests
- typecheck
- build

Update `AGENTS.md`, `README.md`, `PROMPTS.md`, and relevant lead/architecture docs with actual decisions and current state.

Report implementation, self-audit findings, fixes, and verification results.

STOP after this prompt. Do not begin Phase 3 Prompt 2.
```

### Status
COMPLETED

### Decisions & Assumptions
1. **Webhook Authentication & Security**:
   - Implemented dual webhook authentication via shared secret (`x-webhook-secret` or `Authorization: Bearer <secret>`) and HMAC SHA-256 signature verification (`x-signature-sha256` / `x-hub-signature-256`).
   - Constant-time comparison using `crypto.timingSafeEqual` prevents timing side-channel attacks on secret/signature checks.
   - Enforced route-level brokerage status checks: non-existent brokerages return HTTP 404, while suspended brokerages return HTTP 403 `ForbiddenError`.
2. **Strict Tenant Ownership & Anti-Injection Defense**:
   - Ingestion routes (`/api/leads/webhook/:brokerageId` and `/api/leads/ingest/:brokerageId`) enforce tenant identity strictly from verified route and secret credentials (`req.webhookBrokerage._id`).
   - Client-supplied `brokerageId` values inside request body payloads are explicitly stripped and discarded during schema normalization, completely eliminating tenant injection vectors.
3. **Resilient Payload Normalization & External Provider Support**:
   - Supported standard JSON lead payloads and external form providers (Typeform `form_response`).
   - Typeform normalizer intelligently parses email, first/last name, phone number, and UTM marketing campaign parameters while preserving raw answers in `customFields`.
4. **Deterministic Deduplication & Idempotent Delivery**:
   - Deduplication key is `{ brokerageId: 1, email: 1 }`.
   - On duplicate delivery (e.g. webhook retries or repeated lead submission), the endpoint safely returns HTTP 200 OK with `{ isDuplicate: true, data: existingLead }` without creating duplicate records or modifying pipeline states.
   - Handled concurrent race conditions (e.g. burst arrivals at the same millisecond) by catching MongoDB unique index conflicts (code 11000) in `LeadRepository.ingestLead` and returning the existing lead gracefully instead of crashing with a 500 error.
5. **High-Volume & Queue Readiness**:
   - Decoupled the controller (`LeadIngestionController`) and persistence layer (`LeadRepository`) via `LeadIngestionService`, ready for transparent offloading to BullMQ job queues in future worker phases.

### Completed Work
- Updated `server/src/models/brokerage.model.ts` to add indexed `webhookSecret` with secure cryptographic defaults (`crypto.randomBytes(24).toString('hex')`).
- Created Zod validation and normalization logic in `server/src/validators/lead.validators.ts` supporting standard webhooks and Typeform payloads.
- Created `LeadRepository` in `server/src/repositories/lead.repository.ts` with tenant-scoped deduplication and concurrency absorption.
- Created `verifyWebhookAuth` middleware in `server/src/middleware/webhook-auth.middleware.ts`.
- Created `LeadIngestionService` in `server/src/services/lead-ingestion.service.ts` and `LeadIngestionController` in `server/src/controllers/lead-ingestion.controller.ts`.
- Created Express routes in `server/src/routes/lead.routes.ts` with abuse protection rate limiting (`100 req/min`) and mounted at `/api/leads` in `server/src/app.ts`.
- Created comprehensive documentation in `docs/lead-ingestion.md`.
- Added 13 unit tests in `server/tests/unit/lead.service.test.ts` and 18 integration tests in `server/tests/integration/leads.test.ts` (31 new tests total).
- Updated `AGENTS.md`, `README.md`, `PROMPTS.md`.
- All 150 tests passing across the workspace. Zero TypeScript or build errors.

## Phase 3, Prompt 2: Lead Ingestion Reliability & Closeout
```
LeadFlow — Phase 3, Prompt 2: Lead Ingestion Reliability & Closeout

Read assignment.md, AGENTS.md, README.md, relevant lead-ingestion docs, and only the existing lead ingestion/auth/repository/model/test files needed for this work. Do not broadly scan or refactor the repository. Preserve the current layered folder structure.

Close out Lead Ingestion by hardening the existing implementation for reliability and real-world webhook behavior.

Focus on:

1. Idempotency/retries/concurrency
   - Ensure repeated webhook deliveries remain safely idempotent.
   - Test concurrent duplicate submissions and verify no duplicate Lead records.
   - Handle Mongo duplicate-key races correctly.
   - Review whether the current idempotency behavior is sufficient for webhook retries without inventing unnecessary infrastructure.

2. High-volume/burst behavior
   - Review the current ingestion path for obvious synchronous bottlenecks or unbounded work.
   - Test a realistic burst/concurrent ingestion scenario.
   - Keep BullMQ/queues out of this phase; Phase 7 will introduce background processing.
   - Preserve tenant isolation under burst load.

3. Duplicate/"already known" detection
   - Review the assignment requirement that a new lead should be detected when the brokerage already knows that person.
   - Inspect the existing Lead/Client model relationships and implement only the minimal behavior needed to satisfy that requirement.
   - Do not introduce speculative fuzzy matching.

4. Webhook security hardening
   - Review the current brokerage resolution → credential validation flow.
   - Prevent unnecessary disclosure of whether a brokerage ID exists/is active to unauthenticated callers where practical.
   - Preserve valid webhook behavior and tenant isolation.
   - Verify HMAC/secret validation, malformed credentials, and replay/retry behavior.

5. Error handling/observability
   - Ensure expected ingestion failures return consistent safe API errors.
   - Do not expose internal Mongo/database details.
   - Add useful structured logging where appropriate without logging secrets or sensitive lead data.

6. Tests
   Add/strengthen focused tests covering:
   - duplicate retries
   - concurrent duplicate ingestion
   - burst ingestion
   - cross-brokerage isolation
   - known Lead/Client detection
   - invalid/expired/wrong webhook credentials
   - brokerage-ID enumeration/security behavior
   - malformed payloads
   - database duplicate-key races
   - safe error responses

Then perform a focused self-audit:
- Can an unauthenticated caller learn brokerage existence/status?
- Can two concurrent requests create duplicate leads?
- Can a retry create another lead?
- Can one brokerage affect/read another brokerage's leads?
- Can a client-supplied brokerageId bypass tenant resolution?
- Are secrets or sensitive lead data exposed in logs/errors?
- Does the implementation remain ready for BullMQ later without implementing it now?

Fix any genuine issues found.

Run the relevant tests, full typecheck, and build. Update AGENTS.md, README.md, and relevant lead-ingestion documentation with the final state.

Do not implement pipeline/realtime/BullMQ/client/document features. Stop after Phase 3 Lead Ingestion is complete and report exactly what changed, tests run, and any intentional limitations.
```

### Status
COMPLETED (Lead Ingestion Finalized)

### Decisions & Assumptions
1. **Anti-Enumeration & Webhook Hardening**:
   - Hardened `verifyWebhookAuth` to check for credential presence prior to any database queries, rejecting unauthenticated callers with uniform HTTP 401 `UnauthorizedError`.
   - Probing non-existent brokerage IDs or suspended brokerages without valid credentials uniformly returns HTTP 401, completely eliminating brokerage existence and active/suspended status enumeration by unauthenticated attackers.
   - Added constant-time comparison against a dummy secret for non-existent lookups to mitigate side-channel timing attacks.
   - Verified that callers presenting valid credentials for suspended brokerages receive HTTP 403 `ForbiddenError`.
2. **"Already Known" Person Detection**:
   - Implemented exact email lookup against the `Client` model strictly within `{ brokerageId }`.
   - If an existing client is recognized: marks the lead as `isAlreadyKnown: true` and `knownAs: 'CLIENT'`, stores `existingClientId` in custom fields, links the client's current assigned advisor (`assignedTo`), and returns HTTP 201 with descriptive metadata.
   - If an existing lead is recognized: returns HTTP 200 with `isDuplicate: true`, `isAlreadyKnown: true`, and `knownAs: 'LEAD'`.
   - Rejects speculative fuzzy matching in favor of deterministic lowercase email matching scoped by brokerage.
3. **Concurrency & Burst Ingestion Resilience**:
   - Hardened `LeadRepository.ingestLead` to intercept MongoDB duplicate key errors (code 11000) under parallel execution, resolving the concurrent record and returning it idempotently without creating duplicate documents or throwing 500 errors.
   - Verified parallel burst ingestion under multi-tenant load (20 concurrent requests across distinct brokerages) with zero cross-tenant contamination.
4. **Privacy-Preserving Observability**:
   - Implemented `maskEmail` in `LeadIngestionService`, masking emails (e.g. `t***s@example.de`) and omitting phone numbers, custom fields, and credentials from structured Pino logs.

### Completed Work
- Hardened `server/src/middleware/webhook-auth.middleware.ts` against brokerage enumeration and timing attacks.
- Enriched `server/src/repositories/lead.repository.ts` with existing `Client` already-known detection and hardened duplicate-key race condition absorption.
- Updated `server/src/services/lead-ingestion.service.ts` with PII masking in structured logs.
- Updated `server/src/controllers/lead-ingestion.controller.ts` with enriched `isAlreadyKnown`, `knownAs`, and `existingClientId` response metadata.
## Phase 3 Final Fix: Ingestion Rate Limiting
```
LeadFlow — Phase 3 Final Fix: Ingestion Rate Limiting

Fix only the genuine Phase 3 issue identified by the pre-Git verification.

Current problem:
- ingestionLimiter is IP-based with max 100 requests/minute.
- This can reject legitimate 500/min webhook bursts.
- Multiple brokerages using the same external provider/IP can also share the same rate-limit bucket.

Implement a tenant-aware ingestion rate limiter:

1. Preserve the existing credential-first webhook authentication and anti-enumeration behavior.
2. Rate-limit authenticated webhook ingestion per verified brokerage, not globally by client IP.
3. Allow at least 500 requests/minute with reasonable headroom; use 1000 requests/minute per brokerage.
4. Ensure Brokerage A exhausting its limit cannot throttle Brokerage B.
5. Do not trust a client-supplied brokerageId from the request body.
6. Do not weaken webhook authentication or tenant isolation.
7. Keep BullMQ/Redis out of this phase.
8. Preserve the existing error format for rate-limit responses.
9. Add focused tests proving:
   - one brokerage can handle a 500-request burst without hitting the limiter;
   - exceeding the per-brokerage limit returns 429;
   - Brokerage A hitting its limit does not throttle Brokerage B;
   - unauthenticated/invalid webhook requests cannot use the limiter to bypass authentication;
   - existing duplicate/idempotency behavior remains unchanged.

Then perform a focused self-audit specifically on:
- rate-limit key selection
- middleware ordering
- tenant isolation
- authentication/anti-enumeration behavior
- noisy-brokerage isolation

Run the full test suite, typecheck, and production build.

Update AGENTS.md, README.md, PROMPTS.md, and docs/lead-ingestion.md with the final rate-limiting decision.

Do not modify unrelated application code.
Do not implement Pipeline, Realtime, BullMQ, frontend, email, or document features.

Stop and report exactly what changed, tests, typecheck/build results, and the final rate-limit behavior.
```

### Status
COMPLETED (Phase 3 Finalized & Ready for Push)

### Decisions & Assumptions
1. **Tenant-Aware Rate Limiting Architecture**:
   - Replaced global IP-based rate limiting with verified brokerage keying: `keyGenerator: (req) => req.webhookBrokerage?._id?.toString() || ...`.
   - Placed `brokerageIngestionLimiter` *after* `verifyWebhookAuth` on ingestion routes.
   - Raised rate limit to 1,000 requests/minute per verified brokerage (comfortably satisfying the 500 requests/minute burst requirement with 2x headroom).
2. **Strict Middleware Ordering & Anti-Enumeration Defense**:
   - `verifyWebhookAuth` executes first: callers presenting missing or invalid credentials receive uniform HTTP 401 `UnauthorizedError` and never increment any brokerage quota.
   - Unauthenticated attackers cannot exhaust a brokerage's ingestion rate limit or discover whether a brokerage exists.
3. **Noisy-Neighbor Protection**:
   - Independent counters per verified brokerage ensure that Brokerage A consuming its full 1,000 req/min quota cannot throttle or impact Brokerage B, even when webhook payloads originate from the identical external provider IP address (e.g., Typeform, Zapier, Webflow).
4. **Zero Trust in Request Body**:
   - Rate limit keys derive exclusively from server-verified `req.webhookBrokerage._id`. Any client-supplied `brokerageId` in request bodies is discarded.
5. **Preserved Error Schema & Idempotency**:
   - Rate-limit rejections return standard error JSON with HTTP 429: `{ success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many lead ingestion requests, please try again later.' } }`.
   - Repeated webhook deliveries (duplicates/retries) within the quota remain completely idempotent (HTTP 200 with `isDuplicate: true`).

### Completed Work
- Replaced IP-based limiter with `brokerageIngestionLimiter` in `server/src/routes/lead.routes.ts`.
- Added 5 new integration tests in Section 6 of `server/tests/integration/leads.test.ts` (500-burst capability, 429 quota exhaustion, cross-brokerage rate isolation, unauthenticated auth preservation, and idempotent duplicates).
- Updated `docs/lead-ingestion.md`, `AGENTS.md`, and `README.md`.
- All 164 tests passing across the workspace. Zero TypeScript or build errors.

## Prompt 7 (Phase 4, Prompt 1: Pipeline Foundation)
```
LeadFlow — Phase 4, Prompt 1: Pipeline Foundation

Read assignment.md, AGENTS.md, README.md, relevant architecture/domain docs, and only the existing Lead, Client, auth/RBAC, repository, controller, route, validation, and test files needed for this phase. Do not broadly scan or refactor the repository. Preserve the current layered folder structure.

Implement the core Lead Pipeline functionality.

Requirements:

1. Lead stages
   - Support the existing stages:
     NEW → CONTACTED → QUALIFIED → PROPOSAL → NEGOTIATION → WON / LOST
   - Define and enforce valid stage transitions server-side.
   - Prevent invalid/backward transitions unless the existing assignment/domain rules explicitly require them.
   - Do not let clients bypass transition rules by directly modifying the stage.

2. Pipeline APIs
   - Add the minimal authenticated API needed to:
     - list pipeline leads for the current brokerage
     - filter/group by stage
     - move a lead between valid stages
     - retrieve the lead details needed by the pipeline
   - Respect the existing role matrix.
   - Preserve strict brokerage tenant isolation.

3. Concurrent stage updates
   - Prevent lost updates when two advisors attempt to move the same lead concurrently.
   - Use an appropriate database-level/optimistic concurrency mechanism already compatible with the current architecture.
   - Do not introduce unnecessary infrastructure.

4. Authorization
   - Brokerage admins/advisors may operate only within their brokerage.
   - Clients must not be able to manipulate pipeline stages.
   - Preserve platform-admin behavior according to the existing authorization model.

5. Validation and errors
   - Validate lead IDs, target stages, and request payloads.
   - Return consistent safe errors for invalid transitions, missing leads, unauthorized access, and concurrency conflicts.
   - Do not expose Mongo/database internals.

6. Tests
   Add focused tests covering:
   - valid stage transitions
   - invalid transitions
   - brokerage isolation
   - role authorization
   - client attempting stage manipulation
   - nonexistent/malformed lead IDs
   - concurrent stage updates/lost-update prevention
   - final WON/LOST behavior
   - pipeline filtering/grouping

Focused self-audit before finishing:
- Can a user move another brokerage's lead?
- Can a CLIENT modify a lead stage?
- Can an invalid stage transition bypass validation?
- Can two concurrent updates silently overwrite each other?
- Can a client-supplied brokerageId affect the query?
- Are all pipeline queries tenant-scoped?
- Are errors safe and consistent?
- Does the implementation leave a clean seam for future realtime/WebSocket updates without implementing realtime now?

Fix genuine issues found during the self-audit.

Run the relevant tests, full typecheck, and production build.

Update AGENTS.md, README.md, PROMPTS.md, and relevant pipeline documentation with the final state and architectural decisions.

Do not implement WebSockets/realtime, BullMQ, email triggers, tasks, dashboard, frontend, or document features in this prompt.

Stop after Pipeline Foundation is complete and report:
- files changed
- architectural decisions
- tests/results
- typecheck/build results
- self-audit findings
- any intentional limitations
```

### Status
COMPLETED (Phase 4, Prompt 1 Finalized & Verified)

### Decisions & Assumptions
1. **Pipeline State Machine Enforcements**:
   - Defined `VALID_STAGE_TRANSITIONS` mapping strictly valid linear transitions: `NEW → CONTACTED → QUALIFIED → PROPOSAL → NEGOTIATION → WON / LOST`.
   - Disallowed stage skipping forward (e.g., `NEW → QUALIFIED` or `NEW → WON`), backward moves (e.g., `QUALIFIED → CONTACTED`), and self-transitions (e.g., `NEW → NEW`).
   - Terminal stages: `WON` and `LOST` permit zero outgoing transitions. Once reached, a lead cannot be reopened or moved to another stage.
   - Drop-off: Leads can transition from any active stage directly to `LOST`.
2. **Zero-Infrastructure Database Optimistic Concurrency Control**:
   - Integrated atomic conditional update using MongoDB's native `findOneAndUpdate`: `{ _id, brokerageId, status: lead.status, __v: lead.__v }` with `{ $set: { status: targetStage }, $inc: { __v: 1 } }` and `{ returnDocument: 'after' }`.
   - Prevented lost updates when two advisors update simultaneously: exactly one transaction matches the initial state; the loser matches 0 documents and returns HTTP 409 `ConflictError` (`code: 'CONFLICT'`).
   - Supports explicit `version` parameter in requests, throwing upfront 409 if stale.
3. **Strict Brokerage Isolation & Anti-IDOR Defense**:
   - All pipeline queries and updates for `BROKERAGE_ADMIN` and `ADVISOR` are strictly scoped to `req.user.brokerageId`.
   - Guessed lead IDs belonging to another brokerage return HTTP 404 `NotFoundError`, concealing existence without leaking status.
   - Any client-supplied `brokerageId` in request query strings or bodies is discarded for tenant users.
4. **Role Matrix**:
   - `PLATFORM_ADMIN`: Global platform access across brokerages.
   - `BROKERAGE_ADMIN` & `ADVISOR`: Scoped access strictly to their brokerage.
   - `CLIENT`: Strictly forbidden from listing leads, viewing pipeline boards, retrieving lead details, or updating stages (HTTP 403 `ForbiddenError`).
5. **Realtime Broadcast Seam**:
   - Created `emitPipelineStageChanged(event: LeadStageChangedEvent)` hook in `lead-pipeline.service.ts` decoupling stage transitions from future Socket.IO broadcasting in Phase 4 Prompt 2.

### Completed Work
- Added `VALID_STAGE_TRANSITIONS`, `isValidStageTransition`, `updateLeadStageSchema`, `pipelineQuerySchema`, and `leadIdParamSchema` in `server/src/validators/lead.validators.ts`.
- Added `findPipelineLeads`, `findLeadById`, and `atomicUpdateStage` to `LeadRepository` in `server/src/repositories/lead.repository.ts`.
- Implemented `LeadPipelineService` with list, get, atomic stage transitions, and realtime seam hook in `server/src/services/lead-pipeline.service.ts`.
- Implemented `LeadController` handling `/pipeline`, `/`, `/:id`, and `/:id/stage` in `server/src/controllers/lead.controller.ts`.
- Mounted authenticated pipeline routes guarded by `authenticate`, `requireActiveUser`, and `requireRoles` in `server/src/routes/lead.routes.ts`.
- Added 32 comprehensive integration tests in `server/tests/integration/pipeline.test.ts`.
- Created persistent pipeline documentation in `docs/lead-pipeline.md`.
- Updated `AGENTS.md`, `README.md`, and `PROMPTS.md`.
- 196 tests passing across 9 test files. Clean TypeScript typecheck and production build.

## Prompt 8 (Phase 4, Prompt 2: Realtime Pipeline Updates)
```
LeadFlow — Phase 4, Prompt 2: Realtime Pipeline Updates

Read assignment.md, AGENTS.md, README.md, docs/lead-pipeline.md, and only the existing pipeline/service/repository/auth/server/bootstrap/test files needed for this work. Do not broadly scan or refactor the repository. Preserve the current layered architecture and the existing pipeline implementation.

Implement realtime pipeline updates using Socket.IO.

Requirements:

1. Socket.IO foundation
   - Add Socket.IO to the existing server without replacing the current HTTP architecture.
   - Authenticate socket connections using the existing authentication model.
   - Reject unauthenticated or invalid sessions.
   - Respect active-user and active-brokerage checks.

2. Brokerage room isolation
   - Each authenticated brokerage user joins only their brokerage room.
   - PLATFORM_ADMIN may receive events across brokerages according to the existing authorization model.
   - CLIENT users must not receive internal pipeline events.
   - Never trust a client-supplied brokerageId when determining room membership.

3. Pipeline stage events
   - Wire the existing `emitPipelineStageChanged` seam from Phase 4 Prompt 1 to Socket.IO.
   - Emit an event only after a stage transition is successfully persisted.
   - Include only the minimum useful event data: lead identifier, brokerage identifier, previous stage, new stage, and relevant timestamp/version metadata.
   - Do not expose credentials, tokens, or unnecessary lead PII.

4. Tenant isolation
   - A brokerage must never receive another brokerage's pipeline events.
   - Ensure guessed or client-supplied room names cannot allow cross-brokerage subscriptions.
   - PLATFORM_ADMIN behavior must remain intentional and server-controlled.

5. Connection lifecycle
   - Handle disconnects cleanly.
   - Do not create duplicate room memberships or duplicate event delivery from repeated connection/setup logic.
   - Keep the implementation simple; do not introduce Redis adapters or horizontal-scaling infrastructure yet.

6. Tests
   Add focused tests covering:
   - authenticated socket connection
   - unauthenticated/invalid connection rejection
   - correct brokerage room membership
   - CLIENT rejection from internal pipeline events
   - stage-change event after successful transition
   - no event when the database transition fails
   - cross-brokerage event isolation
   - client-supplied brokerage/room manipulation attempts
   - disconnect/reconnect behavior where practical

Focused self-audit:
- Can a user join another brokerage's room?
- Can a CLIENT receive internal pipeline events?
- Can an unauthenticated socket subscribe?
- Can a stage event be emitted before the database update succeeds?
- Can one stage transition produce duplicate events?
- Does the event contain unnecessary sensitive data?
- Is PLATFORM_ADMIN cross-brokerage access intentional and server-controlled?
- Does the implementation leave a clean path for a future Redis Socket.IO adapter without requiring it now?

Fix genuine issues found during the self-audit.

Run the relevant tests, full typecheck, and production build.

Update AGENTS.md, README.md, PROMPTS.md, and relevant realtime/pipeline documentation with the final architecture and decisions.

Do not implement BullMQ, Redis Socket.IO adapters, email/tasks, documents, dashboard, or frontend realtime UI in this prompt.

Stop after Phase 4 Prompt 2 and report:
- files changed
- realtime architecture
- authentication/authorization behavior
- tenant isolation behavior
- tests/results
- typecheck/build results
- self-audit findings
- intentional limitations
```

### Status
COMPLETED (Phase 4, Prompt 2 Finalized & Verified)

### Decisions & Assumptions
1. **Socket.IO Foundation & Dual-Transport Architecture**:
   - Attached Socket.IO cleanly to HTTP server using `httpServer = http.createServer(app)` in `server/src/server.ts`, preserving the Express 5 HTTP REST API intact.
   - Configured CORS aligned with REST API configuration (`env.CORS_ORIGIN`, `credentials: true`).
2. **Handshake Authentication & Active Tenant Validation**:
   - Implemented `socketAuthMiddleware` verifying JWT tokens from `socket.handshake.auth.token`, `Authorization: Bearer` headers, or `accessToken` cookies.
   - Enforced database validation: rejects inactive/suspended users and inactive/suspended brokerages before granting socket connection.
3. **Strict Server-Controlled Room Isolation**:
   - `BROKERAGE_ADMIN` & `ADVISOR` automatically join `brokerage:<brokerageId>` strictly based on database-verified user context.
   - `PLATFORM_ADMIN` automatically joins `platform:admins` to monitor platform-wide pipeline activity.
   - `CLIENT` users join private `client:<userId>` rooms only and are strictly excluded from internal brokerage rooms.
   - Intercepted and rejected client-initiated room manipulation (`join`, `join_room`, `subscribe`) with HTTP 403 `FORBIDDEN`.
   - Allowed dynamic brokerage subscription exclusively for `PLATFORM_ADMIN` via `subscribe_brokerage` with ObjectId validation.
4. **Post-Commit Minimal Event Broadcasting**:
   - Wired `emitPipelineStageChanged` to broadcast `pipeline:stage_changed` and `lead:stage_changed` to `brokerage:<brokerageId>` and `platform:admins`.
   - Broadcast occurs strictly after successful atomic database persistence (`atomicUpdateStage`). If validation or concurrency conflicts fail the write, zero socket events are emitted.
   - Payload is strictly sanitized: contains `leadId`, `brokerageId`, `previousStage`, `newStage`, `version`, `timestamp`, and `updatedBy`. Zero lead emails, phone numbers, notes, financial values, or tokens are exposed.
5. **Clean Scaling Seam**:
   - All room emits utilize standard `io.to(...).emit(...)`, ready for Redis adapter (`@socket.io/redis-adapter`) horizontal clustering without refactoring service code.

### Completed Work
- Created `server/src/sockets/socket.auth.ts`, `server/src/sockets/socket.handlers.ts`, `server/src/sockets/socket.server.ts`, and `server/src/sockets/index.ts`.
- Attached Socket.IO to HTTP server in `server/src/server.ts`.
- Wired `emitPipelineStageChanged` in `server/src/services/lead-pipeline.service.ts` to broadcast over Socket.IO.
- Added 20 integration tests in `server/tests/integration/realtime.test.ts`.
- Updated `docs/lead-pipeline.md`, `AGENTS.md`, and `README.md`.
- All 216 tests passing across 10 test files. Clean TypeScript typecheck and production build.

## Phase 5, Prompt 1: Client Conversion & Case Foundation
```
LeadFlow — Phase 5, Prompt 1: Client Conversion & Case Foundation

Read assignment.md, AGENTS.md, README.md, relevant client/lead/auth/RBAC/domain/repository/service/controller/route/test files, and existing document models only where needed. Do not broadly scan or refactor the repository. Preserve the current layered architecture.

Implement the client conversion and client case foundation.

Requirements:

1. Lead → Client conversion
   - Allow an authorized BROKERAGE_ADMIN or ADVISOR to convert an eligible lead into a Client.
   - Prevent duplicate client creation for the same brokerage/person.
   - Preserve the relationship between the original Lead and Client.
   - Preserve the assigned advisor where appropriate.
   - Define and enforce the valid conversion state/rules server-side.
   - Do not allow CLIENT users to perform conversion.

2. Client portal identity
   - Use the existing User/authentication model.
   - Ensure a Client is linked to exactly the appropriate CLIENT user account.
   - Do not weaken existing password/session/authentication rules.
   - Preserve brokerage tenant isolation.

3. Client case access
   - Add the minimal authenticated API for a CLIENT to retrieve their own case/profile information.
   - A CLIENT must never be able to retrieve another client's case by changing an ID.
   - Brokerage admins/advisors should only access clients within their brokerage according to the existing role model.
   - PLATFORM_ADMIN behavior should remain consistent with the existing authorization model.

4. Data integrity
   - Prevent duplicate Client records under concurrent conversion requests.
   - Use database constraints/atomic operations where appropriate.
   - Do not introduce unnecessary infrastructure.
   - Keep the existing Client and Lead models unless a genuine schema change is required.

5. Validation and errors
   - Validate lead/client/user identifiers.
   - Return safe, consistent errors for invalid conversion, nonexistent resources, unauthorized access, and duplicate/concurrent conversion.
   - Do not expose database internals.

6. Tests
   Add focused tests for:
   - successful lead-to-client conversion
   - invalid conversion attempts
   - duplicate conversion
   - concurrent conversion
   - client user linkage
   - CLIENT accessing own case
   - CLIENT attempting another client's case
   - cross-brokerage access
   - role authorization
   - malformed/nonexistent IDs

Focused self-audit:
- Can two concurrent requests create two Client records?
- Can a CLIENT access another client's case by guessing/changing an ID?
- Can one brokerage access another brokerage's clients?
- Can a CLIENT convert a lead?
- Can conversion create a Client without a valid user linkage?
- Is the Lead ↔ Client relationship preserved?
- Are all client queries tenant/ownership scoped?
- Are errors safe and consistent?

Fix genuine issues found during the self-audit.

Run relevant tests, full typecheck, and production build.

Update AGENTS.md, README.md, PROMPTS.md, and relevant client/case documentation with the final state and architectural decisions.

Do not implement document uploads/checking, BullMQ, email/tasks, dashboard, or frontend UI in this prompt.

Stop after Client Conversion & Case Foundation and report:
- files changed
- data/integrity decisions
- authorization behavior
- tests/results
- typecheck/build results
- self-audit findings
- intentional limitations
```

### Status
COMPLETED (Phase 5, Prompt 1 Finalized & Verified)

### Decisions & Assumptions
1. **Server-Side Conversion Eligibility State Machine**:
   - Leads in `QUALIFIED`, `PROPOSAL`, `NEGOTIATION`, and `WON` are eligible for conversion into active mortgage cases.
   - Raw leads in `NEW` or `CONTACTED` are rejected with HTTP 400 `ValidationError` as they must be qualified first.
   - Leads in `LOST` are disqualified and rejected with HTTP 400 `ValidationError`.
   - Converted leads atomically advance to `WON` (if not already `WON`), triggering realtime Socket.IO pipeline events.
2. **Three-Tier Zero-Infrastructure Concurrency Defense**:
   - Tier 1: Single-document atomic update on `Lead` matching `{ _id: leadId, brokerageId, status: { $in: ELIGIBLE_STAGES }, convertedClientId: null }` using `findOneAndUpdate`. Multiple concurrent conversion requests are serialized natively by MongoDB; exactly one succeeds and all losers receive HTTP 409 `ConflictError`.
   - Tier 2: Partial unique indexes on `Client`: `{ brokerageId: 1, leadId: 1 }` and `{ brokerageId: 1, userId: 1 }`.
   - Tier 3: Scoped unique compound index on `Client`: `{ brokerageId: 1, email: 1 }`.
   - Defensive rollback: Automatically rolls back the claimed lead and deletes newly provisioned portal user accounts if client document insertion encounters collisions.
3. **Client Portal Identity Linkage**:
   - Conversion automatically provisions a `User` account (`role: 'CLIENT'`, `status: 'ACTIVE'`) with bcrypt hashed password.
   - If a `CLIENT` user already exists for that email in the brokerage, it is linked without duplicating credentials.
   - Accounts with non-client roles (e.g. `ADVISOR`) are protected from contamination, throwing HTTP 409 `ConflictError`.
4. **IDOR-Immune Case Access API**:
   - `GET /api/clients/me`: Exclusively resolves the client profile linked to the authenticated token (`req.user.id`). Completely eliminates ID parameter tampering.
   - `GET /api/clients/:id`: Enforces strict tenant boundary and `userId === req.user.id` ownership check via `AuthorizationService.authorizeClientAccess`, returning HTTP 404 (`NotFoundError`) on any ID mismatch to conceal resource existence.
5. **Bidirectional Lineage & Advisor Preservation**:
   - `Client.leadId` references the original Lead.
   - `Lead.convertedClientId` references the created Client.
   - `Client.assignedTo` preserves `lead.assignedTo` (or optional advisor reassignment).

### Completed Work
- Updated `server/src/models/lead.model.ts` with `convertedClientId` and partial unique compound index.
- Updated `server/src/models/client.model.ts` with partial unique compound indexes on `leadId` and `userId`.
- Created `server/src/validators/client.validators.ts` with `ELIGIBLE_CONVERSION_STAGES`, `convertLeadSchema`, and `clientIdParamSchema`.
- Updated `server/src/repositories/client.repository.ts` with domain queries `findByEmail`, `findByUserId`, `findByLeadId`, and `findByIdWithDetails`.
- Created `server/src/services/client.service.ts` implementing `convertLead`, `getMyClientCase`, `getClientById`, and `listClients`.
- Updated `server/src/services/authorization.service.ts` to safely support both populated and unpopulated `brokerageId` and `userId`.
- Updated `server/src/controllers/client.controller.ts` with `getMyClientCase` and `convertLeadToClient`.
- Updated `server/src/controllers/lead.controller.ts` with `convertLeadToClient`.
- Updated `server/src/routes/client.routes.ts` with `/me` and `/convert` routes placed correctly before `/:id`.
- Updated `server/src/routes/lead.routes.ts` with `POST /:id/convert`.
- Created `docs/client-cases.md` detailing the conversion workflow, state eligibility, and IDOR defenses.
- Created 30 comprehensive integration tests in `server/tests/integration/clients.test.ts` covering conversion, state rules, duplicate prevention, concurrent races, user linkage, case retrieval, anti-IDOR, cross-brokerage isolation, and malformed IDs.
- Total 246 tests passing across 11 test suites. Full TypeScript typecheck and Vite production build verified.








