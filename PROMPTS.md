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

---

## Phase 5, Prompt 2: Document Upload & Storage Foundation

### Summary
Built the document upload and storage foundation for LeadFlow, integrating ImageKit for media storage while strictly preserving multi-tenant isolation, anti-IDOR protections, and robust error recovery.

### Architectural Decisions
1. **Decoupled Object Storage Layer**:
   - Encapsulated storage operations behind `IStorageService` and implemented `ImageKitStorageService` using the official `@imagekit/nodejs` (v7) SDK.
   - Controllers never touch the ImageKit SDK; all interactions flow through `documentService`.
   - Files are stored under server-controlled namespaces: `/leadflow/brokerage_${brokerageId}/clients/${clientId}/` with sanitized file names to eliminate directory traversal risks.
   - Integrated offline mock mode for testing environments, returning deterministic URLs and identifiers without external network dependencies.
2. **Multipart Upload Pipeline & Validation**:
   - Leveraged Multer with memory storage buffer (`handleFileUpload` middleware) with strict size limits (10MB ceiling) and MIME type whitelisting (`application/pdf`, `image/jpeg`, `image/png`, `image/webp`, `image/tiff`).
   - Mapped Multer limits to standard `ValidationError` (HTTP 400).
   - Validated document metadata via Zod `uploadDocumentMetadataSchema`.
3. **Strict Case Ownership & Tenant Isolation**:
   - `CLIENT` users can upload and list documents exclusively within their own case profile (resolved via `Client.findOne({ brokerageId, userId })`). Providing an ID of another client's case immediately returns HTTP 403 `ForbiddenError`.
   - Querying documents (`GET /api/documents` and `GET /api/documents/:id`) enforces strict tenant and client case filtering. Requests for cross-brokerage or non-owned documents return HTTP 404 `NotFoundError` (zero resource existence leakage).
   - Advisors and Brokerage Admins are restricted to documents within their own brokerage.
4. **Defensive Compensation Rollback**:
   - Solved the dual-write consistency problem: ImageKit upload is executed first. If MongoDB `DocumentModel.create` fails, the service catches the error, triggers an immediate compensation deletion via `storageService.deleteFile(uploadResult.fileId)`, and re-throws the error. This guarantees zero orphaned storage files in ImageKit.
5. **Zero Credential Exposure**:
   - `IMAGEKIT_PRIVATE_KEY` and other sensitive configuration remain strictly server-side. Uploads are proxied through the server; clients never receive private credentials or direct upload signatures.

### Completed Work
- Added ImageKit configuration to `server/src/config/env.ts` and `server/.env.example`.
- Created `server/src/services/storage.service.ts` with `IStorageService` and `ImageKitStorageService`.
- Created `server/src/validators/document.validators.ts` with Zod schemas for upload metadata, query filters, and route parameters.
- Created `server/src/middleware/upload.middleware.ts` for secure Multer multipart memory buffer handling.
- Enhanced `server/src/repositories/document.repository.ts` with `findByClientId`, `findByLeadId`, and `findByIdWithDetails`.
- Created `server/src/services/document.service.ts` orchestrating secure upload, validation, case ownership, ImageKit storage, and compensation rollback.
- Updated `server/src/services/authorization.service.ts` to defend against populated subdocument ID mismatches.
- Updated `server/src/controllers/document.controller.ts` with `uploadDocument`, `listDocuments`, and `getDocumentById`.
- Updated `server/src/routes/document.routes.ts` mounting `POST /upload`, `GET /`, and `GET /:id`.
- Created `docs/document-storage.md` covering architecture, security, and compensation boundaries.
- Replaced test stub in `server/tests/integration/documents.test.ts` with 25 comprehensive integration tests covering successful uploads, client ownership, anti-IDOR checks, cross-brokerage access, role guards, invalid MIME types, oversized files, storage provider failure, database compensation rollback, and zero credential leakage.
- Verified all 271 server tests pass, full TypeScript typecheck passes across all workspaces (`server`, `worker`, `client`), and Vite production build succeeds.

---

## Phase 6, Prompt 1: BullMQ Document Processing Foundation

### Prompt
```
LeadFlow — Phase 6, Prompt 1: BullMQ Document Processing Foundation

Read assignment.md, AGENTS.md, README.md, relevant Document/BullMQ/Redis/config/service/repository/test files, and the existing Phase 5 document-storage implementation. Inspect only relevant code. Preserve the current layered architecture and existing ImageKit storage boundary.

Implement the BullMQ background document-processing foundation.

Requirements:

1. Queue infrastructure
   - Add the minimal BullMQ + Redis infrastructure required for document processing.
   - Create a clear queue/worker abstraction following the existing architecture.
   - Keep Redis/BullMQ configuration in the existing environment/config system.
   - Do not introduce unnecessary queues or infrastructure.

2. Document processing lifecycle
   - When an uploaded Document is ready for processing, enqueue a background job rather than processing synchronously in the HTTP request.
   - Preserve the existing lifecycle:
     PENDING → PROCESSING → VERIFIED / REJECTED
   - The worker should simulate a realistic slow document check.
   - The implementation must support processing failures.
   - Do not implement real OCR/AI document verification.

3. Job payload & tenant safety
   - Job payloads must contain enough information to safely identify the Document, Client, and brokerage context.
   - Never trust tenant information from an arbitrary job payload without validating it against the persisted document.
   - A worker must never process a document belonging to another brokerage because of a malformed/tampered job payload.
   - Reuse existing repository/scoping patterns where appropriate.

4. Idempotency & concurrency
   - Prevent duplicate processing from corrupting document state.
   - Handle duplicate jobs safely.
   - Ensure concurrent workers cannot incorrectly process the same document simultaneously.
   - Use atomic database state transitions/version checks where appropriate.
   - A job that has already been completed should not perform the processing again unnecessarily.

5. Retry & failure behavior
   - Configure bounded retries with appropriate backoff for transient failures.
   - Distinguish retryable processing failures from terminal rejection where appropriate.
   - Ensure exhausted jobs leave the Document in a consistent state.
   - Do not create infinite retry loops.
   - Do not expose internal Redis/BullMQ errors to API clients.

6. Worker lifecycle
   - Implement graceful worker startup/shutdown.
   - Handle worker errors without crashing the entire application unnecessarily.
   - Make the worker safe to run independently from the API process.
   - Keep the design compatible with multiple worker instances.

7. Realtime status
   - When document processing changes persisted status, emit the appropriate realtime event using the existing Socket.IO infrastructure.
   - Events must be emitted only after the database state change succeeds.
   - Respect existing tenant/client room isolation.
   - Do not expose sensitive document contents or storage credentials.

8. Tests
   Add focused tests for:
   - job enqueueing
   - successful processing
   - slow processing
   - processing failure
   - retry/backoff behavior
   - exhausted retries
   - duplicate job submission
   - concurrent processing attempts
   - nonexistent document
   - cross-brokerage/tampered job context
   - correct status transitions
   - realtime event emitted after committed status change
   - worker startup/shutdown behavior where practical

Focused self-audit:
- What happens if the worker crashes halfway through processing?
- What happens if the same job is delivered twice?
- Can two workers process the same document concurrently?
- Can a malformed job process another brokerage's document?
- What happens when all retries are exhausted?
- Can a failed job leave a document permanently stuck in PROCESSING?
- Are realtime events emitted only after committed state?
- Is tenant context validated from persisted data?
- Can multiple worker instances safely run?
- Are Redis/BullMQ failures isolated from the API?
```

### Architectural Decisions
1. **Queue Abstraction & Resilience**:
   - Implemented `document-processing` BullMQ queue with Redis configuration managed in `server/src/config/env.ts` (`REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB`, `REDIS_URL`, `DOCUMENT_PROCESSING_CONCURRENCY`, `DOCUMENT_PROCESSING_DELAY_MS`).
   - Isolated queue errors from API clients: if Redis is temporarily unreachable during `uploadDocument`, the document is stored in MongoDB as `PENDING`, a 201 response is returned, and no internal Redis exceptions are leaked.
2. **Tenant Safety & Anti-Tampering Defenses**:
   - Workers never trust incoming payload `brokerageId`; they validate it against the persisted document using `withBrokerageScope(payload.brokerageId, { _id: payload.documentId })`.
   - If a cross-brokerage document ID is supplied, the worker logs a critical security alert and throws an `UnrecoverableError`, ensuring foreign documents are never modified.
3. **Atomic Concurrency & Idempotent State Machine**:
   - Transitions from `PENDING` to `PROCESSING` are claimed atomically via MongoDB `findOneAndUpdate({ _id, brokerageId, status: 'PENDING' }, { $set: { status: 'PROCESSING' }, $inc: { __v: 1 } })`.
   - Competing concurrent workers or duplicate jobs see that the document was already claimed or reached terminal states (`VERIFIED` / `REJECTED`) and safely exit without duplicate work.
4. **Retry Strategy & Permanent Rejection Guarantee**:
   - Transient failures trigger bounded BullMQ retries with exponential backoff (3 attempts).
   - Domain-level rejection (compliance failures or unreadable scans) marks the document `REJECTED` and completes cleanly without queue retry.
   - Exhausted retries trigger `handleExhaustedJobFailure`, transitioning the document from `PROCESSING` to `REJECTED` with diagnostic notes. Documents are **never** left permanently stuck in `PROCESSING`.
5. **Realtime Status Synchronization Across Multi-Process Topologies**:
   - Document status transitions emit `document:status_changed` strictly after database persistence succeeds.
   - Events are delivered to tenant brokerage rooms (`brokerage:<brokerageId>`), platform admin rooms (`platform:admins`), and private client user rooms (`client:<userId>`).
   - Cross-process event relay is supported via Redis pub/sub (`leadflow:events:document_status`), enabling standalone worker processes (`npm run dev:worker`) to broadcast live updates to clients connected to the API server.

### Completed Work
- Added Redis and BullMQ configuration to `server/src/config/env.ts`, `server/.env.example`, and `.env.example`.
- Created `server/src/queues/redis.connection.ts` managing BullMQ and ioredis connection options with clean connection lifecycle hooks.
- Created `server/src/queues/document-events.ts` managing `document:status_changed` realtime event emission and cross-process Redis pub/sub relay.
- Created `server/src/queues/document.queue.ts` defining queue abstraction, deterministic deduplication (`jobId: doc-verify-${documentId}`), and `enqueueDocumentProcessing`.
- Created `server/src/queues/document.worker.ts` implementing `processDocumentJob`, tenant safety validation, atomic concurrency lock, slow check simulation, transient failure retries, and exhausted retry cleanup.
- Created `server/src/queues/index.ts` re-exporting queue, worker, events, and connection helpers.
- Updated `server/src/services/document.service.ts` to enqueue background verification jobs upon document upload with failure isolation.
- Updated `server/src/server.ts` to initialize Redis document event subscription during API server startup.
- Updated `worker/src/processors/document.processor.ts` and `worker/src/worker.ts` with standalone worker process lifecycle and graceful shutdown hooks (`SIGINT`/`SIGTERM`).
- Created `docs/document-processing.md` detailing the background processing architecture, state transitions, tenant isolation, and failure recovery.
- Created 12 comprehensive integration tests in `server/tests/integration/document-processing.test.ts` covering upload enqueueing, linear state progression, slow simulation, domain rejection, retries, exhausted retry cleanup, deduplication, concurrency race conditions, tenant tampering defense, nonexistent documents, realtime room isolation, and worker startup/shutdown.
- Total 283 tests passing across 13 test files. Full TypeScript typecheck and Vite production build verified.

---

## Phase 6 — Prompt 2: Background Processing Reliability & Closeout

### Prompt
```
LeadFlow — Phase 6, Prompt 2: Background Processing Reliability & Closeout

Read assignment.md, AGENTS.md, README.md, the Phase 6 Prompt 1 implementation, relevant queue/worker/document/Redis/realtime/test files, and existing architecture docs.

Continue from the current implementation. Do not refactor unrelated code.

Harden the BullMQ document-processing workflow for the assignment's failure and reliability cases.

Requirements:
1. PENDING recovery / enqueue gap
2. Job reliability
3. Idempotency & duplicate delivery
4. Worker safety
5. Realtime consistency
6. Observability
7. Tests
```

### Architectural Decisions
1. **Eventual Consistency & Enqueue Gap Recovery**:
   - Chose an eventual-consistency sweeper pattern over two-phase commit (2PC) or distributed sagas. MongoDB serves as the durable intent log; document upload persists the document in `PENDING` status first. If Redis fails or times out during `enqueueDocumentProcessing`, the API client receives HTTP 201 without failure.
   - Built `DocumentRecoveryService` (`document-recovery.service.ts`) with dedicated MongoDB compound indexes on `{ status: 1, createdAt: 1 }` and `{ status: 1, updatedAt: 1 }`.
   - `reconcilePendingDocuments`: sweeps unenqueued `PENDING` documents older than `PENDING_DOCUMENT_RECOVERY_THRESHOLD_MS` (default: 5m) and enqueues missing BullMQ jobs with deterministic deduplication (`jobId: doc-verify-${doc._id}`).
   - `reconcileStalledDocuments`: sweeps documents stuck in `PROCESSING` older than `STALLED_DOCUMENT_RECOVERY_THRESHOLD_MS` (default: 10m) from crashed workers, atomically resets their status to `PENDING` with audit notes, and re-enqueues them.
2. **Worker Stall Detection & Lock Guarantees**:
   - Configured BullMQ worker settings: `lockDuration: 30000ms`, `stalledInterval: 15000ms`, `maxStalledCount: 2`.
   - Registered `worker.on('stalled')` logging with correlation context (`jobId`, `documentId`).
   - Wired non-blocking startup reconciliation sweeps into both in-server workers and standalone worker processes (`worker/src/worker.ts`), as well as recurring background intervals (`RECONCILIATION_INTERVAL_MS`).
3. **Idempotency on Terminal States & Atomic Concurrency**:
   - `processDocumentJob` checks if a document is already `VERIFIED` or `REJECTED`. If so, it logs and returns immediately with `{ status: doc.status, message: ... }`, preventing duplicate processing, double side effects, or timestamp overwrites.
   - Preserved atomic state claiming (`findOneAndUpdate({ _id, brokerageId, status: 'PENDING' })`) preventing race conditions between concurrent workers.
4. **Tenant Safety & Security Sanitization**:
   - Cross-brokerage job payloads are verified against the database and rejected immediately with `UnrecoverableError`, preventing retry loops and protecting foreign documents.
   - Realtime event payloads and Pino log records are strictly sanitized: zero storage private keys, JWT secrets, passwords, or sensitive document contents are ever emitted or logged.

### Completed Work
- Added compound indexes `{ status: 1, createdAt: 1 }` and `{ status: 1, updatedAt: 1 }` to `server/src/models/document.model.ts`.
- Added configuration parameters to `server/src/config/env.ts`, `server/.env.example`, and `.env.example`: `PENDING_DOCUMENT_RECOVERY_THRESHOLD_MS`, `STALLED_DOCUMENT_RECOVERY_THRESHOLD_MS`, and `RECONCILIATION_INTERVAL_MS`.
- Created `server/src/queues/document-recovery.service.ts` implementing `reconcilePendingDocuments`, `reconcileStalledDocuments`, `reconcileAll`, `startPeriodicReconciliation`, and `stopPeriodicReconciliation`.
- Updated `server/src/queues/document.worker.ts` with lock duration, stalled job handling, and non-blocking startup reconciliation.
- Updated `worker/src/worker.ts` with startup reconciliation and periodic sweeper lifecycle hooks on `SIGINT`/`SIGTERM`.
- Exported recovery service and helper methods from `server/src/queues/index.ts`.
- Added comprehensive integration tests in `server/tests/integration/document-processing.test.ts` covering:
  - Enqueue failure isolation (Redis outage during upload -> HTTP 201, document PENDING)
  - Stale PENDING document background reconciliation
  - Stalled PROCESSING document background reconciliation (crashed worker simulation)
  - Duplicate job delivery on terminal REJECTED document
  - Realtime event and log payload security sanitization
- Completely removed obsolete `packages/shared/` directory and updated monorepo documentation.
- Updated `docs/document-processing.md`, `README.md`, and `AGENTS.md`.
- Total 289 tests passing across 13 test files. 100% typecheck and production build verified.

---

## Phase 7 — Prompt 1: Pipeline Triggers, Tasks & Email Automation

### Prompt
```
LeadFlow — Phase 7 P1: Pipeline Triggers, Tasks & Email

Read assignment.md, AGENTS.md, README.md and the existing pipeline/queue/realtime code. Inspect only relevant files and preserve the current architecture.

Implement the backend automation layer:
- When a lead enters a pipeline stage, support configured stage triggers.
- Create an advisor task with title, assignee, due date and overdue-safe status.
- Send a configured email template for the stage using placeholder substitution.
- Execute email work through the existing BullMQ/Redis infrastructure; do not block the pipeline request.
- Make trigger execution tenant-safe and idempotent: concurrent/duplicate stage events must not create duplicate tasks/emails.
- Handle email-provider failure with bounded retry/backoff and useful Pino logging without PII/secrets.
- Preserve existing stage-transition/realtime behavior; trigger side effects only after the committed stage change.
- Keep platform/brokerage/advisor permissions consistent with existing rules.

Add focused integration tests for stage triggers, task creation, placeholder rendering, duplicate/concurrent events, tenant isolation, email failure/retry and terminal failure.

Self-audit only genuine issues. Run full tests + typecheck + build. Update AGENTS.md, README.md, PROMPTS.md and relevant docs.

Do NOT implement frontend, dashboard work, OCR, or unrelated refactors.
Report files changed, behavior, tests/results, audit findings and limitations.
```

### Architectural Decisions
1. **Atomic Trigger Execution & Idempotency Layer**:
   - Built a dedicated MongoDB model `TriggerExecution` with compound unique index `{ brokerageId: 1, idempotencyKey: 1 }`.
   - Idempotency key pattern: `trig-${triggerId}-lead-${leadId}-stg-${stage}`.
   - Using atomic `findOneAndUpdate` with `upsert: true` and checking whether a new record was inserted or already exists ensures that even under concurrent race conditions, exactly one execution succeeds.
   - For tasks, added a compound index with partial filter expression `{ brokerageId: 1, idempotencyKey: 1 }` (where `idempotencyKey: { $type: 'string' }`), avoiding duplicate key collisions when tasks are manually created without an idempotency key.
2. **Post-Commit Non-Blocking Side Effects**:
   - Preserved all existing HTTP response semantics and optimistic concurrency in `lead-pipeline.service.ts`, `lead-ingestion.service.ts`, and `client.service.ts`.
   - Automations are executed strictly post-commit (`triggerService.executeStageTriggers(...).catch(err => logger.error(...))`), ensuring HTTP requests return immediately with HTTP 200/201 and never fail due to background trigger or Redis queue latency.
3. **Template Engine with Safe Dot-Notation Traversal**:
   - Created `server/src/utils/template.ts` with `renderTemplate` supporting regex-based interpolation `{{key}}` and nested path resolution (e.g. `{{advisor.name}}`, `{{brokerage.name}}`, `{{customFields.propertyCity}}`).
   - Unresolved tokens are cleanly replaced with empty strings or optional defaults.
4. **BullMQ Asynchronous Email Queue & Worker**:
   - Implemented dedicated queue `email-delivery` with sanitized job IDs (`email-${brokerageId}-${leadId}-${triggerId}-${stage}` sanitized with hyphens to satisfy BullMQ's no-colon requirement).
   - Configured exponential backoff (3 attempts, initial delay 1s, factor 2).
   - Worker validates tenant boundaries via `withBrokerageScope` and verifies that the brokerage remains active.
   - Differentiates transient errors (retryable) from terminal configuration or domain rejections (`UnrecoverableError`), halting pointless retries.
   - Integrated lifecycle failure listeners (`worker.on('failed')`) and masked PII in Pino logs (`maskEmail`).
5. **REST API & RBAC Consistency**:
   - Mounted `/api/tasks`, `/api/triggers`, and `/api/email-templates` with scoped repositories and strict RBAC guards (`requireRoles('PLATFORM_ADMIN', 'BROKERAGE_ADMIN', 'ADVISOR')`).
   - Expat clients (`CLIENT` role) are strictly denied access to advisor task management.
   - Overdue calculation supported dynamically via task schema virtual property `isOverdue`.

### Completed Work
- Created `server/src/utils/mask.ts` (`maskEmail`).
- Created `server/src/utils/template.ts` (`renderTemplate`, `hasPlaceholders`).
- Updated `server/src/models/task.model.ts` with `triggerId`, `idempotencyKey`, partial filter index, and `isOverdue` virtual.
- Updated `server/src/models/pipeline-trigger.model.ts` with `dueHoursOffset`, `taskDescription`, and `customRecipientEmail`.
- Created `server/src/models/trigger-execution.model.ts` (`TriggerExecution`).
- Created `server/src/services/email.service.ts` (`IEmailService`, `MockEmailService`).
- Created `server/src/queues/email.queue.ts` and `server/src/queues/email.worker.ts`.
- Created `server/src/services/trigger.service.ts` orchestrating stage automations.
- Wired triggers post-commit into `lead-pipeline.service.ts`, `lead-ingestion.service.ts`, and `client.service.ts`.
- Built REST API layer: `task.repository.ts`, `task.controller.ts`, `task.routes.ts`, `task.validators.ts`, `trigger.controller.ts`, `trigger.routes.ts`, `trigger.validators.ts`, `email-template.controller.ts`, `email-template.routes.ts`, `email-template.validators.ts`.
- Updated `worker/src/worker.ts` with standalone email worker lifecycle.
- Created `docs/pipeline-triggers.md`.
- Added comprehensive unit and integration tests:
  - `server/tests/unit/trigger.service.test.ts` (12 tests)
  - `server/tests/integration/tasks.test.ts` (13 tests)
- Verified all 314 tests passing across 15 test files with 100% typecheck and production build.

---

## Phase 7 — Prompt 2: Automation Closeout & Reliability Review

### Prompt
```
LeadFlow — Phase 7 P2: Automation Closeout

Review the Phase 7 implementation you just completed. Read AGENTS.md, README.md and the relevant trigger/task/email code. Do not add new features or refactor unrelated code.

Verify only these invariants:
- Stage-trigger side effects happen only after a committed transition.
- Duplicate/concurrent stage events cannot create duplicate tasks or emails.
- Task/email operations are strictly brokerage-scoped and RBAC-safe.
- Email failures are isolated from pipeline requests and retries are bounded.
- Template rendering cannot leak secrets or unintended data.
- Worker shutdown/retry/failure behavior is safe.
- Existing Phase 1–6 behavior remains intact.

Run the existing full test suite, typechecks and build. Fix only genuine defects found by this review and add focused regression tests for fixes.

Update AGENTS.md, README.md, PROMPTS.md and relevant docs with the final Phase 7 state.

Do NOT redesign the architecture, add integrations, add frontend work, OCR, dashboard features, or speculative improvements.

Report only: findings, fixes, tests, typecheck/build results, and remaining intentional limitations.
```

### Invariants Verification & Findings
1. **Committed Transitions**:
   - Verified that `triggerService.handleStageTransition` is invoked strictly after successful database writes:
     - `lead-pipeline.service.ts`: only after `leadRepository.updateStageWithOptimisticLock` succeeds.
     - `lead-ingestion.service.ts`: only for newly created leads (`!result.isDuplicate`) after `leadRepository.ingestLead`.
     - `client.service.ts`: only after `Client.create` commits the client document and transitions the lead to `WON`.
2. **Duplicate/Concurrent Event Idempotency**:
   - Unique compound index on `TriggerExecution` (`{ brokerageId: 1, idempotencyKey: 1 }`) blocks duplicate trigger claims at the database level.
   - Partial unique filter index on `Task` (`{ brokerageId: 1, idempotencyKey: 1 }` where `idempotencyKey: { $type: 'string' }`) prevents duplicate task creation.
   - BullMQ deterministic `jobId` deduplication prevents duplicate queue entries.
3. **Brokerage Scoping & RBAC**:
   - `/api/tasks`, `/api/triggers`, and `/api/email-templates` enforce `requireRoles` with `CLIENT` strictly excluded.
   - Scoped queries via `withBrokerageScope` and anti-IDOR return HTTP 404 on cross-tenant probes.
4. **Failure Isolation & Bounded Retries**:
   - `enqueueEmailJob` traps Redis connectivity errors and logs without failing HTTP pipeline requests.
   - BullMQ queue configured with `attempts: 3` and exponential backoff (`delay: 1000`). Terminal errors (`UnrecoverableError`) immediately update `TriggerExecution` to `FAILED` without retrying.
5. **Template Engine Hardening (Defect Found & Fixed)**:
   - *Finding*: `resolvePath` did not check own properties or guard prototype properties, allowing access to functions/prototypes (e.g. `{{toString}}` returning `function toString() { [native code] }` and `{{constructor}}` returning `function Object()`).
   - *Fix Applied*: Added `FORBIDDEN_PROPERTIES` guard (`__proto__`, `constructor`, `prototype`, `toString`, `valueOf`, etc.) and enforced `hasOwnProperty` checks on objects and `has` checks on Maps.
   - *Defense-in-Depth*: Added `SENSITIVE_KEY_REGEX` stripping any sensitive keys (`password`, `token`, `secret`, `hash`, `apiKey`, `auth`, `creditCard`, `ssn`) from `customFields` and `extra` parameters.
6. **Worker Graceful Shutdown**:
   - Multi-signal handlers (`SIGINT`, `SIGTERM`) in `worker/src/worker.ts` cleanly stop reconciliation intervals, close document/email workers and queues, close Redis connections, and disconnect MongoDB.
7. **Phase 1–6 Behavior**:
   - Intact across all pipelines, authentication, webhooks, document processing, and cases.

### Completed Work
- Hardened `server/src/utils/template.ts` with prototype blocking, own-property checks, function filtering, and sensitive field suppression.
- Added regression test suite `4. Template Security & Anti-Leak Defenses` in `server/tests/unit/trigger.service.test.ts`.
- Verified all 316 unit and integration tests passing.
- Updated `AGENTS.md`, `README.md`, `PROMPTS.md`, and `docs/pipeline-triggers.md`.

---

## Phase 8 — Prompt 1: Backend Hardening & Performance

### Prompt
```
LeadFlow — Phase 8 P1: Backend Hardening & Performance

Read assignment.md, AGENTS.md, README.md and relevant backend code. Inspect before changing anything. Do not add features or redesign architecture.

Use the installed `backend-security-coder` skill for the security review and apply only relevant guidance. Use `auth-implementation-patterns` only where auth/session/RBAC behavior is involved.

Perform a focused production-hardening pass:
- Review MongoDB indexes and critical lead/pipeline/document/task queries.
- Benchmark critical APIs with Autocannon/existing load tooling.
- Validate 500/min lead ingestion and noisy-neighbor tenant isolation.
- Exercise concurrent stage updates and duplicate lead ingestion.
- Check tenant isolation, IDOR, auth/RBAC, rate limits and sensitive logging.
- Only fix genuine, evidence-based issues; no speculative optimization.

Add focused regression/load tests where useful. Run full tests, typechecks and production build.

Update AGENTS.md, README.md, PROMPTS.md and relevant docs with measured results and fixes.

Do NOT implement frontend, OCR, new integrations, or unrelated refactors.

Report benchmarks, findings, fixes, tests, typecheck/build and remaining limitations.
```

### Status
COMPLETED

### Findings & Performance Hardening
1. **MongoDB Index Optimization**:
   - *Lead*: Added compound indexes `{ brokerageId: 1, createdAt: -1 }` and `{ brokerageId: 1, assignedTo: 1, createdAt: -1 }`. Prior to this, the full Kanban board query `GET /api/leads/pipeline` (which groups all stages for a brokerage sorted by newest first) required an in-memory sort because `{ brokerageId: 1, status: 1, createdAt: -1 }` could not satisfy the sort when status was omitted.
   - *Task*: Added compound indexes `{ brokerageId: 1, dueDate: 1, createdAt: -1 }`, `{ brokerageId: 1, status: 1, dueDate: 1 }`, and `{ brokerageId: 1, createdAt: -1 }`. Matches the exact multi-key sort order in `TaskRepository.findTasks` (`{ dueDate: 1, createdAt: -1 }`) and accelerates overdue filter queries.
   - *Document*: Added `{ brokerageId: 1, createdAt: -1 }` and `{ brokerageId: 1, status: 1, createdAt: -1 }`, enabling index-backed chronological sorting for brokerage-scoped document lists.
   - *Client*: Added `{ brokerageId: 1, createdAt: -1 }` for chronological client listings.

2. **Defensive Query Pagination & Memory Bounds**:
   - *Task*: Enforced pagination (`skip` and `limit`) in `TaskRepository.findTasks`. While `taskQuerySchema` defined `limit` and `page`, `findTasks` previously omitted them from the Mongoose query. Enforcing `.skip(skip).limit(limit)` prevents memory exhaustion under high task volumes.
   - *Document*: Added `limit` (max 200, default 100) and `page` parameters to `documentQuerySchema` and applied `.skip(skip).limit(limit)` in `DocumentService.listDocuments`.

3. **Autocannon Load Benchmarking Results** (5s tests, concurrent connections):
   - Baseline Routing (`GET /health`): **5,583 req/s** (p50: 1ms, p99: 5ms, 0 errors)
   - Pipeline Kanban Board (`GET /api/leads/pipeline`, 200 leads across 7 stages): **234 req/s** (p50: 40ms, p99: 81ms, 0 errors)
   - Filtered Leads (`GET /api/leads?stage=QUALIFIED`): **442 req/s** (p50: 21ms, p99: 32ms, 0 errors)
   - Task List Query (`GET /api/tasks` with populated relations & virtual overdue calculations): **356 req/s** (p50: 27ms, p99: 44ms, 0 errors)
   - Document Listing (`GET /api/documents`): **360 req/s** (p50: 27ms, p99: 36ms, 0 errors)
   - Lead Webhook Ingestion (Idempotent Duplicate Deliveries): **1,735 to 2,184 req/s** (p50: 4-10ms, p99: 17-19ms)

4. **Rate Limiting & Concurrency Validation**:
   - Re-verified that a single brokerage can ingest a 500-request burst without being throttled (4.1s execution time, 201 Created for all 500).
   - Rate limiting quota (1,000 req/min per verified brokerage) cleanly throttles excessive bursts with HTTP 429 without dropping server responsiveness.
   - Validated noisy-neighbor tenant isolation: Brokerage A exhausting its quota does not throttle Brokerage B.
   - Validated optimistic concurrency under simultaneous conflicting stage updates (exactly 1 winner, 4 rejected with HTTP 409 `ConflictError`, zero lost updates).
   - Validated 15 concurrent identical webhook deliveries (1 created, 14 returned duplicate idempotently, exactly 1 database record).

5. **Security & PII Audits**:
   - Checked structured logs: confirmed emails masked (`maskEmail`), zero passwords, secrets, or ImageKit keys logged or leaked in API responses.
   - Verified anti-IDOR returns uniform HTTP 404 concealing cross-tenant resource existence.

### Completed Work
- Updated `server/src/models/lead.model.ts` with compound indexes.
- Updated `server/src/models/task.model.ts` with compound indexes.
- Updated `server/src/repositories/task.repository.ts` with pagination bounds.
- Updated `server/src/models/document.model.ts` with compound indexes.
- Updated `server/src/validators/document.validators.ts` with pagination validation.
- Updated `server/src/services/document.service.ts` with query pagination bounds.
- Updated `server/src/models/client.model.ts` with compound index.
- Created `server/scripts/benchmark.ts` for automated Autocannon profiling.
- Added 9 integration tests in `server/tests/integration/hardening.test.ts`.
- Verified all 325 tests passing across 16 test files. Typecheck and build clean.

---

## Phase 8 — Prompt 2: Final Backend Closeout

### Prompt
```
LeadFlow — Phase 8 P2: Final Backend Closeout

Review the completed Phase 8 hardening work and perform a final regression/closeout pass. Read AGENTS.md, README.md and relevant Phase 8 docs/code.

Verify:
- 500/min lead-ingestion requirement remains satisfied.
- Phase 8 index/pagination fixes are covered and regression-safe.
- Concurrent stage updates and duplicate ingestion remain correct.
- Tenant isolation, IDOR, auth/RBAC and rate limiting remain safe.
- Phase 1–7 behavior remains intact.
- No sensitive data is exposed in logs or API responses.

Run the full test suite, typechecks and production build. Re-run only critical benchmarks if needed.

Fix only genuine defects. Do not add features, redesign architecture, migrate rate limiting to Redis, or perform speculative optimization.

Update AGENTS.md, README.md, PROMPTS.md and relevant docs with final backend status, benchmark results and intentional limitations.

If everything passes, declare Phase 8 complete and report the final verification results.
```

### Status
COMPLETED

### Verification & Invariant Audit
1. **500/min Lead Ingestion Requirement**:
   - Webhook burst validation confirmed: 500 leads ingested in 4.1s (avg 122 req/s) with 201 Created and zero throttles.
   - Sustained Autocannon duplicate webhook load: 1,735 to 2,184 req/s (p50: 4-10ms, p99: 17-19ms).
   - Ingestion rate limiter configured at 1,000 req/min per verified brokerage (2x burst headroom).
   - Noisy-neighbor protection: throttled tenant hitting 429 does not affect neighboring tenants.

2. **Phase 8 Index & Pagination Fixes**:
   - Compound indexes verified across models:
     - `Lead`: `{ brokerageId: 1, createdAt: -1 }`, `{ brokerageId: 1, assignedTo: 1, createdAt: -1 }` (zero in-memory sorting on full Kanban board).
     - `Task`: `{ brokerageId: 1, dueDate: 1, createdAt: -1 }`, `{ brokerageId: 1, status: 1, dueDate: 1 }`, `{ brokerageId: 1, createdAt: -1 }`.
     - `Document`: `{ brokerageId: 1, createdAt: -1 }`, `{ brokerageId: 1, status: 1, createdAt: -1 }`.
     - `Client`: `{ brokerageId: 1, createdAt: -1 }`.
   - Pagination bounds enforced:
     - `TaskRepository.findTasks`: `.skip(skip).limit(limit)`.
     - `DocumentService.listDocuments`: `.skip(skip).limit(limit)` with max 200, default 100 limit.

3. **Concurrency & Idempotency**:
   - Stage transitions enforce optimistic concurrency via MongoDB conditional updates matching exact status and `__v` versioning. Race conditions return HTTP 409 `ConflictError` cleanly with zero lost updates.
   - Concurrent identical webhook submissions absorbed safely: 1 document created, duplicates returned idempotently (`isDuplicate: true`, HTTP 200), MongoDB code 11000 caught without uncaught exceptions.

4. **Tenant Isolation, IDOR, Auth/RBAC & Rate Limiting**:
   - `withBrokerageScope` enforced across all tenant queries.
   - Anti-IDOR returns HTTP 404 (`NotFoundError`) concealing entity existence.
   - Expat clients strictly restricted to personal case and uploaded documents (`userId === req.user.id`).
   - Handshake auth for Socket.IO restricts advisors to `brokerage:<brokerageId>` and blocks clients from pipeline boards.
   - Tenant-aware rate limiting placed after webhook authentication to prevent unauthenticated quota exhaustion.

5. **Phase 1–7 Compatibility**:
   - All 16 test files pass without regression (325 total tests passing).
   - Vitest test isolation secured via `fileParallelism: false` in `server/vitest.config.ts`.

6. **PII Masking & Secrets Defense**:
   - Structured logs mask PII email addresses (`maskEmail`).
   - ImageKit private keys, JWT secrets, webhook secrets, and user password hashes never exposed in logs or API responses.
   - Template engine strips sensitive keys matching `/password|token|secret|hash|apiKey|auth|creditCard|ssn/i`.

### Benchmark Summary (Autocannon)
- **Baseline Routing (`GET /health`)**: 5,583 req/s (p50: 1ms)
- **Pipeline Kanban (`GET /api/leads/pipeline`, 200 leads)**: 234 req/s (p50: 40ms, p99: 81ms)
- **Filtered Leads (`GET /api/leads?stage=QUALIFIED`)**: 442 req/s (p50: 21ms)
- **Task Queries (`GET /api/tasks` + overdue virtuals)**: 356 req/s (p50: 27ms)
- **Document Listing (`GET /api/documents`)**: 360 req/s (p50: 27ms)
- **Webhook Ingestion (Duplicate absorption)**: 1,735 to 2,184 req/s (p50: 4-10ms)

### Intentional Limitations
1. **In-Memory Rate Limiting**: Rate limiting uses `express-rate-limit` with in-memory tracking per Node process. For multi-instance clustered production deployments, switching the store to `rate-limit-redis` (connecting to the existing Redis instance) is the recommended path for shared cluster quotas.
2. **Document Reconciliation Polling**: Background recovery sweeper polls MongoDB periodically (default: 60s) for stale jobs. Under high multi-worker load, Redis BullMQ stall detection handles active stalled locks directly, while the sweeper serves as secondary safety net.

### Completed Work
- Verified all 325 test cases passing across 16 test files.
- Verified TypeScript compilation across monorepo (`npm run typecheck` exits 0).
- Verified production bundle build (`npm run build` exits 0).
- Documented Phase 8 P2 closeout in `AGENTS.md`, `README.md`, and `PROMPTS.md`.
- Phase 8 is complete and backend is officially closed out.

---

## Phase 0 (Frontend) — Reconnaissance

### Prompt
```
Phase 0 — Frontend Reconnaissance

Read assignment.md, AGENTS.md, README.md, PROMPTS.md, and inspect the existing client/ frontend.

Also inspect the installed frontend skills and available React Bits MCP/connected UI tooling.

Do NOT modify application code yet.

Report concisely:
1. Current frontend structure, framework, routing, state/API architecture.
2. Existing reusable UI/components/design system.
3. Existing backend/API integration and auth handling.
4. What is already implemented vs missing for the assignment.
5. Relevant installed frontend skills/tools and where they should be used.
6. Recommended Phase 1 scope based on the actual codebase.
7. Any architectural/UX risks or technical debt that could affect frontend work.

Do not refactor or install anything.
Update AGENTS.md/README.md only if necessary to record confirmed frontend facts.
Update PROMPTS.md with this prompt and its status.
```

### Status
COMPLETED

### Findings & Confirmed Facts
1. **Frontend Architecture & Dependencies**: React 19.2.8, Vite 8.3.1, TypeScript 6.0.2 (`bundler` module resolution, `es2023`). `package.json` includes `react-router-dom` 7.18.4, `@tanstack/react-query` 5.103.2, `axios` 1.20.0, `socket.io-client` 4.8.3, `lucide-react` 1.48.0, `clsx` 2.1.1, and `tailwind-merge` 3.7.0.
2. **Current Codebase State**: `client/src/` contains only empty directory stubs (`components/`, `features/`, `hooks/`, `lib/`, `routes/`, `types/`) and standard Vite template files (`App.tsx`, `App.css`, `index.css`). No UI components, routes, API clients, or auth stores exist yet.
3. **Styling Gap**: `clsx` and `tailwind-merge` are present, but `tailwindcss` is not yet installed in `client/package.json`.
4. **Backend Readiness**: Backend API (Express 5, Mongoose 9), background workers (BullMQ, Redis), and WebSockets (Socket.IO) are 100% complete and hardened across Phases 1–8 (325 passing tests). All required REST and realtime events for the 10 assignment capabilities exist.
5. **Tooling & Skills**: `.agents/skills/design-taste-frontend` is installed and ready for anti-slop B2B/financial UX design. `reactbits-mcp` is verified and responsive for animations, loaders, and micro-interactions. `shadcn` MCP is available for component primitives.

---

## Phase 1 (Frontend) — Premium Frontend Foundation & Auth Shell

### Prompt
```
Phase 1 — Premium Frontend Foundation & Auth Shell

Read assignment.md, AGENTS.md, README.md, PROMPTS.md and the Phase 0 reconnaissance before implementing.

Use the installed `design-taste-frontend` skill throughout this phase. Use shadcn MCP for accessible primitives and React Bits MCP selectively for tasteful micro-interactions/loading—not decorative UI everywhere.

Build the frontend foundation:
- Configure Tailwind v4 + Vite.
- Establish a cohesive premium B2B SaaS design system in index.css: typography, spacing, surfaces, borders, radii, semantic colors, focus states and density.
- Aim for authoritative, refined financial-software UI: excellent hierarchy and whitespace, restrained color, subtle depth/motion, no generic AI-dashboard clichés, gradients, glow effects or card soup.
- Create reusable primitives: Button, Input, Card, Badge, Dialog, Avatar, Loader, Skeleton, EmptyState and ErrorState.
- Configure Vite proxy for /api and /socket.io.
- Create typed Axios API layer with credentials + 401 refresh handling.
- Configure TanStack Query.
- Implement auth/session restoration with useAuth and /api/auth/me.
- Add React Router with protected role-aware routes for /app, /portal and /admin.
- Build a polished responsive application shell: sidebar, header, user menu and role-aware navigation.
- Build a premium login page supporting the four backend roles.

Do not implement dashboard/pipeline/client/document features yet.

Preserve existing architecture; don't introduce unnecessary libraries or refactors.
Use real backend contracts—no fake API layer.

After implementation:
1. Self-audit visual consistency, accessibility, responsiveness, auth security and unnecessary duplication.
2. Fix genuine issues found.
3. Run frontend typecheck, tests and production build.
4. Update AGENTS.md, README.md and PROMPTS.md with the completed Phase 1 state and decisions.
5. Stop after Phase 1.
```

### Status
COMPLETED

### Architectural & Implementation Decisions
1. **Design Read & Dial Settings (`design-taste-frontend`)**:
   - Design read: B2B SaaS application shell and auth foundation for German mortgage advisors and clients, with an authoritative, refined financial-software language.
   - Core dials: `DESIGN_VARIANCE: 5`, `MOTION_INTENSITY: 3`, `VISUAL_DENSITY: 6`.
   - Palette & Materiality: Slate canvas (`hsl(210 20% 98%)`), deep navy/slate-900 high contrast text (`hsl(222 47% 11%)`), authoritative royal sapphire primary accent (`hsl(221 83% 53%)`), crisp borders, zero AI-purple gradients, zero glow effects, and zero em-dashes across all UI copy.
2. **Tailwind CSS v4 & Vite Integration**:
   - Configured `@tailwindcss/vite` plugin in `client/vite.config.ts` alongside `@vitejs/plugin-react`.
   - Defined semantic design tokens (`--background`, `--foreground`, `--primary`, `--card`, `--border`, `--ring`, `--radius`) in `client/src/index.css` with `@theme` mappings.
   - Configured local development proxies for `/api` (`http://localhost:5000`) and `/socket.io` (`http://localhost:5000`, `ws: true`).
3. **Reusable Primitives (`client/src/components/ui/`)**:
   - Built 10 accessible primitives: `Button` (loading spinner, active push feedback), `Input` (label above, error below, aria attributes, prefix/suffix icons), `Card` family (`Card`, `Header`, `Title`, `Description`, `Content`, `Footer`), `Badge` (semantic financial status variants), `Dialog` (Radix Dialog with portal, backdrop, focus trap, and dismiss), `Avatar` (Radix Avatar with deterministic initials fallback), `Loader` (tasteful spinner and fullscreen overlay), `Skeleton` (subtle pulse placeholder), `EmptyState`, and `ErrorState` with retry callback.
4. **Typed Axios Client & Concurrent 401 Refresh Handling (`client/src/lib/api.ts`)**:
   - Built Axios instance with `baseURL: '/api'` and `withCredentials: true`.
   - In-memory `accessToken` storage with getter/setter (safe from local storage XSS).
   - Request interceptor attaches `Authorization: Bearer <token>`.
   - Response interceptor traps 401 responses, queues concurrent in-flight requests, calls `POST /api/auth/refresh` to rotate credentials via HTTP-only cookie, and retries the original request seamlessly upon renewal.
5. **Auth Context & Session Restoration (`client/src/features/auth/`)**:
   - Implemented `AuthContext`, `AuthProvider`, and `useAuth` hook.
   - Automatically probes `/api/auth/refresh` on application initialization to restore active sessions from HTTP-only refresh cookies with zero login screen flash.
   - Exposes `login()`, `logout()`, `refreshUser()`, `isAuthenticated`, and `isLoading`.
6. **Role-Aware Routing & App Shell (`client/src/routes/`, `client/src/components/layout/`)**:
   - Configured React Router with `ProtectedRoute` enforcing role guards across `/app` (`BROKERAGE_ADMIN`, `ADVISOR`), `/portal` (`CLIENT`), and `/admin` (`PLATFORM_ADMIN`).
   - Root `/` route intelligently redirects to the user's role-specific home page.
   - Built responsive application shell: `Sidebar` with role-aware navigation sections and active route states, mobile drawer toggle, `Header` with role badge and WebSocket indicator, and Radix `DropdownMenu` for user profile and sign out.
   - Built high-fidelity feature shells (`FeatureShell`) for all placeholder routes.
7. **Premium Split-Screen Login Page (`client/src/features/auth/LoginPage.tsx`)**:
   - Authoritative financial split-screen layout with value messaging and RFC 6819 token rotation guarantees.
   - 4-role quick-switch demo presets (Platform Admin, Brokerage Admin, Mortgage Advisor, Expat Client) pre-populating test credentials for frictionless evaluation.
   - Real backend error presentation and validation.
8. **Testing & Verification**:
   - Configured Vitest + `@testing-library/react` + `@testing-library/jest-dom` in client workspace.
   - Added 14 unit tests in `client/src/tests/components.test.tsx` and `client/src/tests/auth-routing.test.tsx` (all passing).
   - Monorepo tests: all 325 server tests passing; 14 client tests passing (339 total passing tests).
   - Monorepo typecheck: 0 errors across `server`, `worker`, `client`.
   - Production build: `vite build` completed in 429ms.

---

## Phase 1, Prompt 2: User-Facing UI Refinement

### Prompt
```
Phase 1 — Prompt 2: User-Facing UI Refinement

Read AGENTS.md, README.md and inspect the current Phase 1 UI.

The current visual design is good. Do NOT redesign it. Refine it so users see only information useful to completing their work.

Remove developer/implementation-facing UI:
- Login technical/marketing panel and copy.
- "Strict Tenant Isolation", "Real-Time Event Architecture", "Background Job Resilience", RFC 6819, ISO/security claims and similar technical explanations.
- Visible WebSocket connection status.
- Sidebar "Live" indicator.
- "Architecture Ready", "Phase 2 Ready" and development/status messaging.
- Excessive tenant/role/status badges where they do not help the user's workflow.

Login should become a clean, premium, focused sign-in experience with LeadFlow branding, concise copy, credentials, tenant identifier and subtle demo-role switching.

Keep the existing visual language, functionality, routing, auth behavior and responsive layout. Make the sidebar cleaner and less visually heavy.

Core principle:
SHOW USERS WHAT THEY NEED.
HIDE IMPLEMENTATION DETAILS THEY DON'T NEED.

Use the existing design-taste-frontend guidance and shadcn primitives. Avoid unnecessary React Bits effects.

Run tests, typecheck and build. Update AGENTS.md, README.md and PROMPTS.md. Stop after this refinement.
```

### Status
COMPLETED

### Refinement Decisions & Changes
1. **Focused, Premium Login Page**:
   - Removed the marketing/architecture panel containing technical explanations (RFC 6819, ISO 27001, tenant isolation claims, background worker resilience).
   - Replaced it with a clean, centered sign-in card with concise LeadFlow branding, work email, password, and brokerage identifier.
   - Replaced the dominant 4-tile demo box with subtle, compact demo account quick-switch pill buttons.
   - Replaced bulky error boxes with sleek, compact inline error banners that fit within standard viewport heights without layout shifts.
   - Added automatic slug whitespace normalization.
2. **Simplified, Clean Sidebar**:
   - Removed the developer "Scope / Tenant Banner" box (`Platform Scope`, `Tenant Scope`, `Tenant: 7a7257`, `Cross-Brokerage Control`).
   - Removed the footer "Live" status dot.
   - Retained the clean LeadFlow emblem and wordmark with streamlined navigation groups.
3. **Calm, Distraction-Free Header**:
   - Removed the visible "WebSocket Connected" status badge.
   - Removed technical subtitles ("Global Multi-Tenant Hub", "Berlin & Munich Expats Workflow").
   - Preserved clean user identity dropdown with avatar, name, email, role badge, and sign-out action.
4. **User-Centric Workspace Empty States**:
   - Refactored `FeatureShell` to remove developer badges ("Phase 2 Ready", "Phase 3 Ready") and "Architecture Ready" database implementation descriptions.
   - Replaced all placeholder screens with business-oriented, user-friendly empty states and explanatory subtitles describing mortgage advisory operations.
5. **Universal Single Root Environment & Database Seeding**:
   - Configured both `server` and `worker` to resolve from a single root `.env` file, removing the redundant `server/.env`.
   - Created and executed `server/scripts/seed.ts` (`npm run seed`) creating real demo records with valid bcrypt hashes for all 4 roles.
6. **Verification**:
   - Client tests (`npm --prefix client test`): 14 passed.
   - Server tests (`npm test`): 325 passed.
   - Monorepo typecheck (`npm run typecheck`): 0 errors across `server`, `worker`, `client`.
   - Monorepo production build (`npm run build`): clean bundle built in 531ms.

## Phase 1, Prompt 2 (Follow-up): Production UX Refinement
```
Phase 1 — Prompt 2: Production UX Refinement

Read AGENTS.md and inspect the current frontend.

Keep the current visual design. Do not redesign it.

Make the shell feel like a polished production SaaS:

- Remove developer/implementation-facing copy and indicators from P1.
- Simplify the login to only user-relevant content.
- Add a polished Cmd/Ctrl+K command palette for navigation and useful global actions.
- Show keyboard shortcuts naturally where useful.
- Improve sidebar/header hierarchy, spacing, hover/active states and responsive behavior.
- Add subtle, purposeful transitions and micro-interactions using shadcn + React Bits where they improve UX.
- Improve loading, focus, dropdown and dialog interactions.
- Keep the UI restrained: no decorative effects, excessive badges, gradients or "AI dashboard" styling.
- Use production SaaS patterns as inspiration (Linear/Intercom/Stripe), but do not copy their UI.

Do not implement dashboard analytics, pipeline, clients or other Phase 2+ features yet.
Do not change backend/auth/API architecture.

Run tests, typecheck and build. Update AGENTS.md, README.md and PROMPTS.md. Stop.
```

### Status
COMPLETED

### Refinement Decisions & Changes
1. **Cmd/Ctrl+K Command Palette**:
   - Built `CommandPalette` in `components/common/CommandPalette.tsx` using Radix UI accessible dialog primitives with zero heavy dependencies.
   - Global keyboard listener (`⌘K` on Mac, `Ctrl+K` on Windows/Linux) and `ESC` to dismiss.
   - Role-aware navigation commands (`Pipeline`, `Leads`, `Clients`, `Documents`, `Tasks`, `Brokerages`, `Case`, etc.) and quick actions (toggle sidebar, copy URL, keyboard shortcuts cheat sheet, sign out).
   - Real-time search filtering, arrow key navigation (`↑`/`↓`), enter key execution, and physical `<kbd>` keycaps.
2. **Natural Keyboard Shortcuts & Chords**:
   - Implemented `useKeyboardShortcuts` hook in `hooks/useKeyboardShortcuts.ts` supporting `⌘K`/`Ctrl+K`, `⌘B`/`Ctrl+B`, `?` (shortcuts cheat sheet), and two-key navigation chords (`G then P` for Pipeline, `G then L` for Leads, `G then C` for Clients, `G then D` for Documents, `G then T` for Tasks) with safe input focus suppression.
   - Built `KeyboardShortcutsModal` in `components/common/KeyboardShortcutsModal.tsx` showing global key bindings and navigation chords in an accessible dialog.
   - Displayed keyboard shortcut badges on header search button, profile dropdown menu items, and sidebar navigation items.
3. **Sidebar & Header Hierarchy & Responsive Behavior**:
   - Built collapsible desktop rail mode (`⌘B` / `Ctrl+B`) with smooth width transitions (`w-64` to `w-16`).
   - In collapsed mode: centered icons with accessible tooltip hints, collapsed logo mark, clean active state pill, and bottom expand trigger.
   - In expanded mode: clean section hierarchy, keyboard shortcuts shown on hover, crisp hover and active background highlights (`bg-slate-900 text-white`).
   - In Header: added search/command bar trigger (`Search or jump to... ⌘K`), current section breadcrumb, keyboard shortcut button (`?`), and polished Radix dropdown menu.
4. **Purposeful Micro-Interactions & Transitions**:
   - Refined button press feedback (`active:scale-[0.98]`), dialog backdrop blur (`backdrop-blur-xs`), smooth dropdown animations, and focus ring transitions.
   - Retained restrained, authoritative aesthetic: zero decorative AI glow, zero gradients, zero card soup.
5. **Verification**:
   - Client tests (`vitest`): 17 passing across 3 test suites (`components.test.tsx`, `auth-routing.test.tsx`, `ux-refinements.test.tsx`).
   - Server tests: 325 passing across 16 test suites (342 monorepo tests total).
   - Monorepo typecheck: 0 errors across `server`, `worker`, `client`.
   - Production build: clean build in 545ms.

## Phase 2, Prompt 1: Dashboard + Pipeline Foundation
```
Phase 2 — Prompt 1: Dashboard + Pipeline Foundation

Read AGENTS.md, README.md, PROMPTS.md and inspect the existing frontend/backend contracts.

Build the real brokerage dashboard using existing design primitives and real APIs.

Dashboard:
- Create a polished operations dashboard for BROKERAGE_ADMIN/ADVISOR.
- Show useful KPIs: total leads, active pipeline, qualified leads, won cases and active clients.
- Add meaningful pipeline/stage distribution visualization and recent activity.
- Use real backend data; no fake/demo metrics.
- Include useful loading, empty and error states.
- Keep the visual style premium, restrained and information-dense.
- Do not expose technical implementation details.

Pipeline:
- Establish the page structure and data-fetching layer for the real pipeline.
- Use `/api/leads/pipeline`.
- Prepare clean stage/lead models for the Kanban implementation in the next prompt.
- Preserve existing architecture and reusable components.

Use shadcn and existing design system. Use React Bits only when it improves a real interaction.

Do not implement drag/drop or Socket.IO interactions yet.

Run tests, typecheck and build. Self-audit for UX, responsive behavior and unnecessary UI. Update AGENTS.md, README.md and PROMPTS.md. Stop.
```

### Status
COMPLETED

### Implementation Decisions & Changes
1. **Real Operations Dashboard** (`/app/dashboard`):
   - Created `DashboardPage` in `features/dashboard/DashboardPage.tsx` using `useDashboardData` hook.
   - Built 5 core KPI cards (`KpiCard.tsx`): Total Leads, Active Pipeline, Pre-Qualified, Won Cases (with conversion rate percentage), and Active Clients.
   - Built `PipelineDistributionCard.tsx` featuring a segmented pipeline progress bar and complete volume/count breakdown across all 7 stages (`NEW`, `CONTACTED`, `QUALIFIED`, `PROPOSAL`, `NEGOTIATION`, `WON`, `LOST`).
   - Built `RecentActivityCard.tsx` displaying recent incoming borrower leads with loan amounts, stage badges, and relative timestamps.
   - Built `PendingTasksCard.tsx` displaying action items triggered by stage transitions with priority and overdue flags.
   - Integrated clean loading skeletons, an empty state, and an error state with retry functionality.
2. **Real Pipeline Page & Data-Fetching Layer** (`/api/leads/pipeline`):
   - Created `pipeline.api.ts` with TanStack Query hook `usePipeline(params)`.
   - Built `PipelineHeader.tsx` showing active lead counts, total pipeline volume in EUR, and real-time borrower/email search filtering.
   - Built `PipelineColumn.tsx` and `LeadCard.tsx` rendering the 7 linear qualification columns with count pills, stage total volume, borrower name, contact information, loan amounts, and lead scores.
   - Cleanly modularized components in preparation for Kanban drag-and-drop interactions in Phase 2 Prompt 2 without premature drag-and-drop or WebSocket hooks.
3. **Domain Contracts & Navigation**:
   - Added typed domain definitions in `pipeline.types.ts`, `client.types.ts`, and `task.types.ts`.
   - Added `/app/dashboard` route in `AppRoutes.tsx`, added `Dashboard` to `Sidebar.tsx`, `CommandPalette.tsx`, `KeyboardShortcutsModal.tsx`, and `useKeyboardShortcuts.ts` (`G then O`).
4. **Verification**:
   - Monorepo typecheck: 0 errors across `server`, `worker`, `client`.
   - Client tests (`vitest`): 21 passed across 4 test suites (`dashboard-pipeline.test.tsx`, `auth-routing.test.tsx`, `components.test.tsx`, `ux-refinements.test.tsx`).
   - Backend tests: 325 passed across 16 test suites (346 monorepo tests total).
   - Production bundle: clean Vite build in 468ms.

---

## Phase 2 — Prompt 2: Interactive Kanban + Realtime
```
Phase 2 — Prompt 2: Interactive Kanban + Realtime

Read AGENTS.md and inspect the existing Pipeline components/API.

Turn the existing pipeline into a fully functional Kanban.

- Add reliable drag-and-drop using a React 19-compatible approach such as dnd-kit.
- Allow only backend-valid stage transitions; reject invalid drops.
- On drop, call the existing stage mutation API.
- Use optimistic movement with rollback on failure.
- Handle backend 409 concurrency conflicts gracefully and refresh the affected lead.
- Connect Socket.IO to receive `pipeline:stage_changed` and reconcile remote updates without duplicate/stale cards.
- Preserve search/filter state.
- Ensure all 7 stages are usable, including horizontal scrolling on smaller screens.
- Make drag/drop feel polished but restrained: clear drop target, subtle motion, no excessive animation.
- Preserve the current visual design. Do not redesign the page or add unrelated features.

Run tests, typecheck and build. Add focused tests for valid/invalid moves, rollback, 409 conflict and realtime update. Update AGENTS.md, README.md and PROMPTS.md. Stop.
```

### Status
COMPLETED

### Implementation Decisions & Changes
1. **Interactive Drag-and-Drop with `@dnd-kit`**:
   - Installed `@dnd-kit/core` and `@dnd-kit/utilities` with clean React 19 compatibility.
   - Configured `PointerSensor` with `activationConstraint: { distance: 5 }` to avoid interfering with click navigation, alongside accessible `KeyboardSensor`.
   - Created `DraggableLeadCard` wrapping each borrower card with subtle dragging styles (`cursor-grab`, active `cursor-grabbing`, and disabled cursor on terminal `WON` / `LOST` cards).
   - Created `DroppableColumn` wrapping each stage column with dynamic drop feedback (subtle green check / blue highlight on valid targets; red ban ring on invalid targets).
   - Added restrained `DragOverlay` showing a gentle 1-degree rotation and elevation shadow without distracting physics animations.
2. **State Machine Validation & Error Handling**:
   - Enforced client-side qualification state machine matching backend rules: forward linear progression (`NEW → CONTACTED → QUALIFIED → PROPOSAL → NEGOTIATION → WON / LOST`), exit to `LOST` allowed from any intermediate stage, and zero outgoing transitions from terminal `WON` and `LOST`.
   - Invalid drops are immediately rejected on the client with clear, dismissible warning banners (e.g. `Cannot move lead from New Inquiry to Won. Allowed next stages: Contacted or Lost.`).
3. **Optimistic Updates, Concurrency Conflicts (HTTP 409) & Rollback**:
   - On valid drop, snapshots current TanStack Query cache `['pipeline']` and optimistically moves the lead, updates source and destination counts, and increments `__v`.
   - Calls `updateLeadStageMutation.mutateAsync({ id, stage, version: lead.__v })`.
   - On network or server error, rolls back immediately to the previous cache snapshot and alerts the user.
   - Detects HTTP 409 concurrency conflicts (`CONCURRENCY_CONFLICT`), informs the advisor that the lead was modified concurrently, and auto-refreshes the board (`queryClient.invalidateQueries`).
4. **Realtime Socket.IO Pipeline Synchronization**:
   - Built singleton socket client in `lib/socket.ts` with credentials and access token handshake.
   - Created `usePipelineSocket` hook listening to `pipeline:stage_changed` and `lead:stage_changed`.
   - Immutably relocates cards across stages and adjusts counts upon receiving remote updates. Prevents duplicate cards via ID deduplication and version checks, falling back to cache invalidation if an untracked lead arrives.
5. **Search & Responsive Layout**:
   - Preserved real-time search filtering on borrower name, email, phone, and source without disrupting drag targets.
   - Preserved all 7 stage columns with fluid horizontal scroll on smaller viewports.
6. **Verification**:
   - Added 10 focused unit/integration tests in `kanban-realtime.test.tsx` verifying:
     - Linear progression validation.
     - Early exit to `LOST` validation.
     - Stage skipping rejection.
     - Terminal stage immutability for `WON` and `LOST`.
     - Socket.IO `pipeline:stage_changed` reconciliation across stages and count updates.
     - Socket.IO duplicate prevention on repeated broadcasts.
     - Unknown lead cache invalidation.
     - 7-stage column rendering.
     - Optimistic update rollback on mutation failure.
     - 409 concurrency conflict detection and cache invalidation.
   - Client test suite: 31 tests passed across 5 files (`vitest`).
   - Monorepo typecheck: 0 errors across `server`, `worker`, `client`.
   - Monorepo production build: clean Vite build in 592ms.





