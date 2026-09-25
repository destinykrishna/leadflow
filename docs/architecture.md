# LeadFlow System Architecture

## 1. Overview
LeadFlow is a high-performance multi-tenant lead management and broker operations platform built for modern real estate brokerages.

The repository is structured as a TypeScript monorepo:
- `client/`: Single-page application built with React, Vite, and TanStack Query.
- `server/`: REST API and real-time backend powered by Express 5, Mongoose, and Socket.IO.
- `worker/`: Asynchronous background processing worker powered by BullMQ and Redis.
- `packages/shared/`: Shared domain contracts, constants, and validation schemas across services.
- `docs/`: Persistent architectural and database design specifications.

---

## 2. Multi-Tenant Architecture (Brokerage Isolation)

### 2.1 The Brokerage Model
- The domain term **Brokerage** is used exclusively (not "Tenant").
- Tenant isolation is implemented using the shared-database, shared-schema pattern with tenant discrimination:
  - Every tenant-scoped document stores an indexed `brokerageId: Types.ObjectId`.
  - Every database query targeting tenant data must enforce `{ brokerageId }` scoping via repository helpers (`withBrokerageScope`).
  - Cross-brokerage reads, writes, and updates are strictly prevented.

### 2.2 Isolation Invariants
1. **Tenant Identification**: Authenticated requests must resolve and verify the `brokerageId` from the session/token.
2. **Query Scoping**: Direct unstructured Mongoose queries without `brokerageId` are prohibited on tenant-scoped collections.
3. **Data Boundary Errors**: Any cross-brokerage access attempt immediately triggers a `BrokerageIsolationError` (HTTP 403 / `BROKERAGE_ISOLATION_VIOLATION`).
4. **Realtime Isolation**: Socket.IO channels are strictly partitioned by brokerage room (`brokerage:<brokerageId>`). Tenant events are never broadcast globally.
5. **Worker Isolation**: All queue payloads processed by the worker must contain `brokerageId` to verify tenant ownership during asynchronous execution.

---

## 3. Server Architecture Layers

```
server/
├── src/
│   ├── config/          # Environment parsing (Zod), Mongoose connection lifecycle
│   ├── models/          # Mongoose domain models & schemas (with brokerageId & indexes)
│   ├── repositories/    # Lean data access enforcing brokerage scoping (withBrokerageScope)
│   ├── services/        # Domain business logic & orchestrations
│   ├── validators/      # Zod validation schemas & common input parsers
│   ├── utils/           # Centralized errors (AppError, BrokerageIsolationError), Pino logger
│   ├── types/           # Shared domain types & interfaces
│   ├── controllers/     # HTTP route handlers (future phase)
│   ├── middleware/      # Auth, RBAC, tenant isolation, rate limiting (future phase)
│   ├── routes/          # Express route definitions (future phase)
│   ├── sockets/         # Realtime brokerage-scoped socket events (future phase)
│   └── queues/          # BullMQ queue producers (future phase)
└── tests/
    ├── helpers/         # Test DB setup via MongoMemoryServer
    ├── integration/     # Integration test suites
    ├── unit/            # Unit test suites
    └── setup.ts         # Vitest global hooks (beforeAll, afterEach, afterAll)
```

### 3.1 Layer Responsibilities
- **Config**: Strict environment parsing via Zod (`env.ts`) and resilient Mongoose connection management (`database.ts`) with lifecycle listeners and graceful shutdown hooks.
- **Repositories**: Focused data access layer designed to avoid over-engineering. Concrete repositories exist only where tenant scoping or complex queries provide clear value.
- **Validators**: Input contracts validated with Zod, throwing structured `ValidationError` instances on schema mismatches.
- **Errors & Logging**: Centralized operational error taxonomy (`AppError`, `NotFoundError`, `ValidationError`, `BrokerageIsolationError`) and structured JSON logging with Pino.

---

## 4. Testing Strategy
- **Framework**: Vitest with TypeScript.
- **In-Memory Database**: Tests run against `MongoMemoryServer` with zero external database dependencies.
- **Lifecycle Guarantees**:
  - `beforeAll`: Spins up memory MongoDB and establishes Mongoose connection.
  - `afterEach`: Purges all collections to guarantee total test isolation.
  - `afterAll`: Disconnects and destroys the memory server.

---

## 5. Authentication & Security (Phase 2)
See [docs/auth-security.md](file:///c:/Users/Krishna/Desktop/3d-website/leadflow/docs/auth-security.md) for full architectural specifications.
- **Access Tokens**: Short-lived JWTs (15 min) with tenant context (`brokerageId`).
- **Refresh Strategy**: Rotated refresh tokens (7 days) with reuse detection, SHA-256 token hashing at rest, and MongoDB TTL session eviction.
- **Identity Scoping**: Multi-role login supporting `PLATFORM_ADMIN` (global/system) and `BROKERAGE_ADMIN`, `ADVISOR`, and `CLIENT` (tenant-scoped).
- **Transport Security**: HTTP-only SameSite cookies and IP-based rate limiting on auth endpoints.

