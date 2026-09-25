# LeadFlow — BullMQ Background Document Processing Architecture

## 1. Overview
Document verification in German mortgage expat brokerage workflows is inherently time-intensive, requiring multiple automated and manual sanity checks (e.g., verifying payslip validity, tax return completeness, and ID legibility). To ensure that the client's upload experience is instantaneous and uninterrupted, LeadFlow uses an asynchronous background processing model powered by **BullMQ** and **Redis**.

The document upload endpoint (`POST /api/documents/upload`) immediately stores the uploaded file in ImageKit, creates the `Document` record with status `PENDING`, enqueues a background job to BullMQ, and returns HTTP 201 to the client. The document lifecycle is subsequently managed asynchronously by dedicated workers.

---

## 2. Queue & Worker Architecture

```
[ HTTP Upload Request ]
          │
          ▼
   ImageKit Upload
          │
          ▼
MongoDB Persist (status: 'PENDING')
          │
          ▼
[ Enqueue Job ] ────► Redis: 'document-processing' Queue
                            │
                            ▼
              [ BullMQ Document Worker ]
                            │
               ┌────────────┴────────────┐
               ▼                         ▼
       Tenant Validation        Atomic State Claim
      (withBrokerageScope)     (PENDING → PROCESSING)
               │                         │
               └────────────┬────────────┘
                            │
                            ▼
              Simulated Realistic Check (delay)
                            │
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                 ▼
     [Success]         [Rejection]       [Transient Failure]
    (status: VERIFIED) (status: REJECTED) (retry with backoff)
          │                 │                 │
          └─────────────────┴─────────────────┘
                            │
                            ▼
               MongoDB Committed State Change
                            │
                            ▼
                 Realtime Socket.IO Broadcast
                 (`document:status_changed`)
            (Advisors in brokerage, Client in personal room)
```

### Components
1. **Producer (`document.queue.ts`)**:
   - Queue Name: `document-processing`.
   - Job Name: `verify-document`.
   - Deterministic Job Deduplication: `jobId = doc-verify-${documentId}`.
   - Retry Strategy: 3 attempts with exponential backoff (1s, 2s, 4s).
   - Redis Failure Isolation: If Redis is down during upload, the error is caught and logged; the document remains in MongoDB as `PENDING`, avoiding API request failure.

2. **Consumer (`document.worker.ts`)**:
   - Subscribes to the `document-processing` queue with configurable concurrency (`DOCUMENT_PROCESSING_CONCURRENCY`, default 5).
   - Safe for execution within the primary application server or as a standalone worker process (`npm run dev:worker`).
   - Graceful lifecycle management: `startDocumentWorker()` and `closeDocumentWorker()`.

3. **Standalone Worker Entry (`worker/src/worker.ts`)**:
   - Connects independently to MongoDB and Redis.
   - Handles `SIGINT` and `SIGTERM` signals for zero-downtime, graceful worker termination.

---

## 3. Document Lifecycle State Machine

```
              ┌──────────────────────────┐
              │         PENDING          │
              └─────────────┬────────────┘
                            │
                            │ (Worker claims job atomically)
                            ▼
              ┌──────────────────────────┐
              │        PROCESSING        │
              └───────┬───────────┬──────┘
                      │           │
   (Verification      │           │ (Verification failed or
    passed)           │           │  retries exhausted)
                      ▼           ▼
         ┌────────────────┐   ┌────────────────┐
         │    VERIFIED    │   │    REJECTED    │
         └────────────────┘   └────────────────┘
```

1. **PENDING**: Initial state upon successful multipart upload and MongoDB creation.
2. **PROCESSING**: Atomically claimed by a worker. Guaranteed to be set before any verification work begins.
3. **VERIFIED**: Terminal state. `verifiedAt` timestamp recorded; verification notes added.
4. **REJECTED**: Terminal state. Notes explain why the document was rejected (e.g. illegible scan or exhausted retry attempts).

---

## 4. Tenant Safety & Anti-Tampering Defenses

1. **Persisted Boundary Verification**:
   - The worker never trusts `brokerageId` from the job payload without verifying it against the database.
   - Queries use `withBrokerageScope(payload.brokerageId, { _id: payload.documentId })`.
2. **Tampering Detection**:
   - If a job payload specifies Brokerage B for a document that actually belongs to Brokerage A, the worker detects the discrepancy, logs a security warning, and throws a terminal `UnrecoverableError`.
   - Cross-brokerage documents are never modified or inspected.

---

## 5. Concurrency & Idempotency Controls

1. **Atomic State Claims**:
   - The transition from `PENDING` to `PROCESSING` uses MongoDB's atomic `findOneAndUpdate` with `status: 'PENDING'`.
   - If two workers attempt to process the same document simultaneously, only one succeeds; the second worker's update returns `null`, and it exits safely without performing duplicate work.
2. **Terminal State Idempotency**:
   - If a duplicate job is submitted for a document that is already `VERIFIED` or `REJECTED`, the worker checks the status and returns immediately without re-processing or updating timestamps.
3. **Queue Deduplication**:
   - Enqueueing uses deterministic job IDs (`doc-verify-${documentId}`). Re-submitting the same document while a job is waiting in the queue is deduplicated by BullMQ.

---

## 6. Retry & Failure Recovery

1. **Transient Failures**:
   - Network timeouts or third-party service glitches trigger BullMQ retries with exponential backoff (up to 3 attempts).
2. **Permanent Rejections**:
   - Domain-level rejection (e.g. unreadable scan or corrupt image) transitions the document to `REJECTED` and completes the job successfully without queue retry.
3. **Exhausted Retries Defense**:
   - When all retry attempts are exhausted, the worker's failure handler (`handleExhaustedJobFailure`) transitions the document from `PROCESSING` to `REJECTED` with an explanatory note (`Verification failed after 3 attempts: ...`).
   - Documents are **never** left permanently stuck in `PROCESSING`.

---

## 7. Realtime Event Broadcasting

Realtime events are emitted strictly **after** database updates are committed:

- **Event Name**: `document:status_changed`.
- **Rooms Targeted**:
  - `brokerage:<brokerageId>`: Received by advisors and brokerage admins managing the case.
  - `platform:admins`: Received by platform administrators.
  - `client:<userId>`: Received by the expat client who uploaded the document, updating their portal view.
- **Cross-Process Synchronization**:
  - Emitted directly to Socket.IO when in-process.
  - Published to Redis channel `leadflow:events:document_status` for multi-process environments where workers run separately from the API server.
- **Privacy & Security**:
  - Event payloads contain minimal domain metadata (`documentId`, `brokerageId`, `status`, `title`, `verificationNotes`).
  - Storage credentials, private keys, and internal tokens are never included.

---

## 8. Enqueue Failure Recovery & Periodic Reconciliation

### Consistency Tradeoff
In a distributed microservice/modular monolith environment, writing to MongoDB and enqueueing to Redis BullMQ cannot be wrapped in a single ACID transaction without expensive two-phase commit (2PC) protocols that degrade HTTP latency and introduce distributed deadlocks.

LeadFlow employs an **eventual consistency** pattern:
1. **Durable Intent in MongoDB**: Document metadata and binary upload references are committed first to MongoDB in `PENDING` status.
2. **Enqueue Isolation**: If Redis is unreachable or times out during HTTP upload, the error is isolated: the API client receives HTTP 201 with their document in `PENDING` state rather than experiencing a 500 failure.
3. **Reconciliation Sweeper (`document-recovery.service.ts`)**:
   - **Stale PENDING Recovery (`reconcilePendingDocuments`)**: Scans for documents created in `PENDING` status older than `PENDING_DOCUMENT_RECOVERY_THRESHOLD_MS` (default: 5 minutes) lacking active BullMQ jobs. Enqueues missing jobs into BullMQ.
   - **Stalled PROCESSING Recovery (`reconcileStalledDocuments`)**: Scans for documents in `PROCESSING` status older than `STALLED_DOCUMENT_RECOVERY_THRESHOLD_MS` (default: 10 minutes) whose worker crashed or stalled. Atomically resets them to `PENDING` with audit notes and re-enqueues for processing.
   - **Execution Cadence**: Runs as a non-blocking sweep upon worker startup (`worker.ts` and `document.worker.ts`) and on a recurring interval (`RECONCILIATION_INTERVAL_MS`, default: 1 minute).

---

## 9. Failure & Reliability Matrix

| Scenario | Immediate System Reaction | Eventual State & Recovery |
| :--- | :--- | :--- |
| **Redis Down on Upload** | HTTP 201 returned; document saved in MongoDB as `PENDING`; enqueue error logged with correlation context. | Background reconciliation sweeper discovers unenqueued `PENDING` document once Redis is restored and safely enqueues it. |
| **Worker Process Crash** | In-flight job loses heartbeat; BullMQ lock expires after `lockDuration` (30s); stalled job emitted. | BullMQ stalls handler retries or recovery service atomically resets document from `PROCESSING` to `PENDING` and re-queues. |
| **Transient Service Glitch** | Worker throws retryable error; BullMQ initiates exponential backoff (1s, 2s, 4s). | Job re-runs on next attempt; resumes from `PROCESSING` status without duplicate client events. |
| **Exhausted Retries (3 failures)**| BullMQ marks job as failed; `handleExhaustedJobFailure` triggers. | Document atomically transitions to `REJECTED` with notes (`Verification failed after 3 attempts`); realtime event broadcast. |
| **Domain Rejection (Illegible/Corrupt)**| Worker flags compliance failure; transitions document directly to `REJECTED`. | Job completes successfully without BullMQ retries; client notified in realtime. |
| **Duplicate Job Delivery** | Worker verifies current document state via atomic query. | If already `VERIFIED` or `REJECTED`, job exits idempotently (`SKIPPED_TERMINAL`) with zero side effects. |
| **Cross-Brokerage Payload Tampering**| Worker checks `withBrokerageScope(payload.brokerageId)`; detects mismatch with persisted document. | Worker throws `UnrecoverableError`; job fails immediately without retrying; foreign document remains untouched. |
| **Concurrent Workers** | Atomic `findOneAndUpdate` conditional on `status: 'PENDING'`. | Exactly one worker claims the document; rival worker aborts cleanly without double-processing. |
