# Document Upload & Storage Foundation Architecture

## Overview
LeadFlow's document management layer provides multi-tenant, IDOR-defended file ingestion and retrieval for mortgage applications and expat identity verification. It integrates ImageKit for object storage while maintaining strict tenant isolation in MongoDB.

## Storage Architecture & Provider Abstraction
To prevent tight coupling between HTTP controllers and external storage SDKs, storage operations are encapsulated behind `IStorageService` and implemented by `ImageKitStorageService`:

```
Client / Portal
     │
     ▼ (Multipart Form-Data)
[Express 5 Route: POST /api/documents/upload]
     │
     ▼
[handleFileUpload Middleware (Multer Memory Storage)]
  - Enforces 10MB file size ceiling
  - Enforces allowed MIME types (PDF, JPEG, PNG, WEBP, TIFF)
     │
     ▼
[DocumentController]
  - Zod validation (uploadDocumentMetadataSchema)
     │
     ▼
[DocumentService]
  - Resolves brokerage tenant boundary
  - Enforces Client case ownership (anti-IDOR)
  - Determines server-controlled folder hierarchy
     │
     ├── 1. Upload Buffer ──► [ImageKitStorageService] ──► ImageKit Media Library
     │                                                     (/leadflow/brokerage_<id>/clients/<id>)
     │
     └── 2. Persist Record ─► [Document Model] ──► MongoDB
               │
          (On DB Error) ───► [Compensating Transaction] ──► ImageKitStorageService.deleteFile()
```

## Security & Multi-Tenant Authorization

### 1. Document Ownership Model
- **Brokerage Boundary**: Every document strictly belongs to a single brokerage (`brokerageId`). All database queries enforce `withBrokerageScope(brokerageId)`.
- **Client Ownership**:
  - `CLIENT` users can only upload documents to their own case. Any attempt by a client to submit another client's `clientId` is rejected with `HTTP 403 ForbiddenError`.
  - When listing documents (`GET /api/documents`), `CLIENT` users only see documents associated with their personal `clientId`.
  - Fetching a document by ID (`GET /api/documents/:id`) performs strict verification via `authorizationService.authorizeDocumentAccess`. Non-owned or cross-tenant document requests return `HTTP 404 NotFoundError` to prevent resource existence disclosure.
- **Advisor & Admin Roles**:
  - `ADVISOR` and `BROKERAGE_ADMIN` can upload and view documents within their own brokerage.
  - `PLATFORM_ADMIN` can operate across brokerages with explicit target specification.

### 2. Zero Credential Exposure
- ImageKit credentials (`IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_URL_ENDPOINT`) are held exclusively on the backend server in `src/config/env.ts`.
- File uploads are proxied through the server; clients never receive private keys, authentication signatures, or direct upload tokens.

### 3. Server-Controlled Storage Hierarchy
Files are uploaded into deterministic, server-generated folder hierarchies:
`/leadflow/brokerage_${brokerageId}/clients/${clientId}/`
File names are sanitized to prevent directory traversal or remote code execution risks (`[^a-zA-Z0-9._-]` replaced with `_`).

## Consistency & Failure Compensation Boundary
1. **Storage Failure**: If ImageKit upload fails (e.g. network timeout or API error), execution aborts immediately. No document record is created in MongoDB (`HTTP 502/500`).
2. **Database Persistence Failure**: If ImageKit upload succeeds but MongoDB persistence fails (e.g. database disconnection or constraint violation), `DocumentService` executes a compensating rollback:
   ```ts
   try {
     const document = await DocumentModel.create(docPayload);
     return document;
   } catch (dbError) {
     await storageService.deleteFile(uploadResult.fileId);
     throw dbError;
   }
   ```
   This guarantees zero orphan files remain stranded in ImageKit.

## Supported Document Types & MIME Formats
- **Document Types**: `IDENTIFICATION`, `PAYSLIP`, `BANK_STATEMENT`, `INCOME_PROOF`, `CONTRACT`, `TAX_RETURN`, `OTHER`.
- **Allowed MIME Types**: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`, `image/tiff`.
- **Size Limit**: 10 MB per file.
- **Lifecycle Statuses**: `PENDING` (initial) → `PROCESSING` → `VERIFIED` / `REJECTED`.
