# LeadFlow Authentication & Security Architecture

## 1. Overview
LeadFlow implements a defense-in-depth authentication system designed for multi-tenant real estate brokerages and platform administration.

The architecture combines stateless, short-lived JWT access tokens with stateful, cryptographically hashed refresh tokens supporting automatic rotation, reuse detection, and session revocation.

---

## 2. Token Strategy

| Token Type | Lifespan | Storage / Transmission | Security Purpose |
|---|---|---|---|
| **Access Token** | 15 minutes | HTTP Authorization Header (`Bearer <token>`) / Response body | Stateless API authorization carrying identity and tenant context (`userId`, `email`, `role`, `brokerageId`). |
| **Refresh Token** | 7 days | HTTP-Only, SameSite Cookie (`refreshToken`) or Request Body | Secure session continuity; rotated on every single use. Raw token is never stored in DB. |

---

## 3. Threat Model & Countermeasures

### 3.1 Token Theft & Replay (Reuse Detection)
- **Token Families**: Every session initiation creates a cryptographically distinct `family` UUID.
- **Rotation**: Calling `POST /api/auth/refresh` invalidates the presented token and creates a new token in the same family.
- **Reuse Detection**: If an attacker attempts to replay an already-consumed token, the server immediately revokes **all** active sessions in that family, alerting to a compromise and blocking further unauthorized access.
- **Unique Salt per Token (RFC 7519 `jti`)**: Refresh tokens carry an internal UUID mapped to standard RFC 7519 `jti` (`jwtid`) and `tokenId`, guaranteeing distinct cryptographic signatures even under sub-millisecond rotations.

### 3.2 Credential Protection & Storage
- **Password Hashing**: Plain passwords are never stored. Hashed using `bcryptjs` with standard 10 salt rounds.
- **Token Hashing at Rest**: Refresh tokens are stored in MongoDB as SHA-256 hashes (`tokenHash`). Database read compromises cannot be weaponized to forge refresh requests.
- **Automatic Session Expiry**: Sessions enforce a MongoDB TTL index on `expiresAt` (`expireAfterSeconds: 0`), ensuring automatic pruning of expired tokens.

### 3.3 Multi-Tenant Authentication & Identity
- **Platform Admin Scoping**: `PLATFORM_ADMIN` users authenticate across the platform; their token claims enforce `brokerageId: null`.
- **Tenant User Scoping**: `BROKERAGE_ADMIN`, `ADVISOR`, and `CLIENT` users are strictly scoped to their `brokerageId`. Login validates both user status and brokerage status (`ACTIVE`).
- **Cross-Brokerage Email Disambiguation & Anti-Enumeration**: In multi-tenancy where distinct brokerages can independently register the same client email, the login flow resolves candidate accounts via password verification without disclosing multi-tenant account existence on failed attempts (generic 401 `Invalid credentials`). Tenant disambiguation via `brokerageSlug` or `brokerageId` is fully supported.

### 3.4 Transport & Endpoint Hardening
- **HTTP-Only Cookies & Dual Acceptance**: Refresh tokens are accepted from HTTP-only cookies (`req.cookies.refreshToken`) with fallback to JSON body (`req.body.refreshToken`) for non-browser API clients. For browser clients, the token is delivered strictly as an `httpOnly: true` cookie and omitted from response payloads, preventing XSS exfiltration to `localStorage`.
- **SameSite Protection**: Configured with `sameSite: 'lax'` for CSRF mitigation.
- **Brute Force Defense**: `express-rate-limit` throttles authentication endpoints (`/api/auth/*`) to 20 attempts per IP per 15-minute window in production and development (bypassed strictly in test environment via `env.isTest`).

---

## 4. API Endpoints

- `POST /api/auth/login`: Authenticates all 4 roles, issues access token, sets HTTP-only refresh cookie.
- `POST /api/auth/refresh`: Rotates refresh token, detects reuse, issues new token pair.
- `POST /api/auth/logout`: Revokes refresh token session, clears HTTP-only cookie.
- `GET /api/auth/me`: Protected by `authenticate` middleware; returns authenticated user context.

---

## 5. Authorization, RBAC & Tenant Isolation (Phase 2, Prompt 2)

### 5.1 Role-Based Access Control (RBAC) Matrix

| Operation / Resource | PLATFORM_ADMIN | BROKERAGE_ADMIN | ADVISOR | CLIENT |
|---|:---:|:---:|:---:|:---:|
| **Platform Management** (`GET /api/brokerages`) | Allowed | Forbidden (403) | Forbidden (403) | Forbidden (403) |
| **Brokerage Scope** (`GET /api/brokerages/:id`) | All Brokerages | Own Brokerage | Own Brokerage | Forbidden (403) |
| **Client Directory** (`GET /api/clients`) | All Brokerages | Own Brokerage | Own Brokerage | Forbidden (403) |
| **Client Profile** (`GET /api/clients/:id`) | All Brokerages | Own Brokerage | Own Brokerage | Own Profile Only (404 on others) |
| **Document Access** (`GET /api/documents/:id`) | All Brokerages | Own Brokerage | Own Brokerage | Own Uploads Only (404 on others) |

### 5.2 Reusable Authorization Primitives
- **`requireRoles(...allowedRoles)`**: Express guard validating user role. Unauthenticated requests receive 401; unauthorized roles receive 403 `ForbiddenError`.
- **`requireSameBrokerage(paramKey)`**: Validates URL parameter tenant boundary. Tenant users requesting another brokerage ID receive 403 `BrokerageIsolationError`. `PLATFORM_ADMIN` is permitted cross-brokerage access.
- **`requireActiveUser`**: Validates `req.user.status === 'ACTIVE'`. Rejects deactivated or suspended accounts with 401 `UnauthorizedError`.

### 5.3 Anti-IDOR & Zero Cross-Tenant Information Leakage
- **Centralized Scoped Data Access**: `ScopedRepository<T, TDoc>` automatically binds queries to `{ brokerageId: user.brokerageId }` for all tenant users, removing the need for controllers to remember tenant filters manually.
- **Guessed ID Protection**: When a tenant user attempts to access an ID belonging to another brokerage, the scoped query yields `null` and returns `404 Not Found` (`NotFoundError`). The server never returns 403 for guessed resource IDs, ensuring that attackers cannot determine whether an ID exists in another brokerage.
- **Client Ownership Scoping**: `AuthorizationService` restricts `CLIENT` users to their own profile (`client.userId === req.user.id`) and uploaded documents (`doc.uploadedBy === req.user.id`). Attempts to access other clients or documents within the same brokerage also return `404 Not Found`.

### 5.4 Targeted Authorization Audit & Hardening Decisions
- **`requireSameBrokerage` Parameter Enforcement**: Hardened the route guard to reject requests where the target parameter is missing, empty, or unresolvable with `BrokerageIsolationError` (403), preventing parameter-bypass vulnerabilities.
- **Controller-Level Defense-in-Depth**: Added `authorizationService.assertBrokerageAccess` call inside `BrokerageController.getBrokerageById` and pre-validated `Types.ObjectId.isValid` to guarantee uniform 404 responses without unhandled Mongoose `CastError` (500) exceptions.
- **Defensive Resource Ownership Resolution**: Hardened `authorizeDocumentAccess` to safely evaluate falsy `uploadedBy` values without runtime `TypeError`.
- **Test Suite Status Verification**: Verified that the 7 skipped test suites (`tests/unit/lead.service.test.ts`, `tests/unit/trigger.service.test.ts`, `tests/integration/clients.test.ts`, `tests/integration/documents.test.ts`, `tests/integration/leads.test.ts`, `tests/integration/pipeline.test.ts`, `tests/integration/tasks.test.ts`) are architectural placeholder stubs (`describe.todo`) for Phases 3, 4, and 5 and contain no skipped RBAC or tenant regression tests.


