# LeadFlow — Disaster Recovery & Business Continuity Runbook

## 1. Executive Summary & Continuity Targets

LeadFlow is an institutional mortgage SaaS platform supporting multi-tenant brokerage operations, borrower document verification, and pipeline automations. This document outlines disaster recovery (DR) protocols, recovery objectives, automated backup procedures, and failover runbooks.

### Recovery Objectives

| Metric | Target | Description |
| :--- | :--- | :--- |
| **RPO (Recovery Point Objective)** | **< 1 hour** (Scheduled Backups)<br>**< 1 minute** (Managed Cloud Replica Sets) | Maximum acceptable data loss window in the event of catastrophic storage failure. |
| **RTO (Recovery Time Objective)** | **< 30 minutes** | Maximum allowable downtime to restore services from backup archives to an operational state. |
| **MTTR (Mean Time to Recover)** | **< 15 minutes** | Target time to detect, fail over, and resume service upon component-level outage. |

---

## 2. Infrastructure Topology & Failure Modes

```
                              ┌────────────────────────┐
                              │  Internet / Customers  │
                              └───────────┬────────────┘
                                          │ HTTPS
                                          ▼
                               ┌───────────────────────┐
                               │ Reverse Proxy / CDN   │
                               └───────────┬───────────┘
                                           │
                    ┌──────────────────────┴──────────────────────┐
                    │                                             │
                    ▼                                             ▼
       ┌────────────────────────┐                    ┌────────────────────────┐
       │   API Replica (App 1)   │                    │   API Replica (App 2)   │
       │ ENABLE_IN_PROCESS_WORKERS=false             │ ENABLE_IN_PROCESS_WORKERS=false
       └───────┬────────────┬───┘                    └───────┬────────────┬───┘
               │            │                                │            │
               │            └───────────────┬────────────────┘            │
               ▼                            ▼                             ▼
       ┌───────────────┐            ┌───────────────┐            ┌────────────────┐
       │ MongoDB 8.0+  │            │  Redis 7+     │            │ Standalone     │
       │ (Primary/Sec) │            │  (BullMQ)     │            │ Worker Pod(s)  │
       └───────────────┘            └───────────────┘            └────────────────┘
```

### Failure Scenarios & Self-Healing Behaviors

1. **MongoDB Connection Disconnect / Outage**:
   - **API Behavior**: The readiness probe (`/health/ready`) immediately returns HTTP 503 (`status: 'degraded'`). Incoming requests fail fast with operational errors.
   - **Worker Behavior**: Registered `onDatabaseDisconnected` lifecycle hooks immediately pause all BullMQ worker instances (`pauseDocumentWorker()`, `pauseEmailWorker()`).
   - **Recovery**: When MongoDB reconnects, `onDatabaseConnected` triggers automatic unpausing of BullMQ workers and fires a non-blocking `documentRecoveryService.reconcileAll()` sweep to catch up on stalled jobs.
2. **Redis Outage**:
   - **API Behavior**: HTTP endpoints continue serving read operations. Webhook lead ingestion persists leads durably to MongoDB. Document uploads save documents as `status: 'PENDING'`. Email triggers isolate enqueue errors so database stage changes are never aborted.
   - **Recovery**: Once Redis recovers, `DocumentRecoveryService` sweeps MongoDB for `PENDING` documents older than threshold and automatically re-enqueues them.
3. **Catastrophic Worker Crash / Pod Termination**:
   - **Stall Detection**: BullMQ worker locks expire (`lockDuration: 30s`). BullMQ stall detection re-assigns orphaned jobs up to 2 times (`maxStalledCount: 2`).
   - **Reconciliation Sweeper**: Any document remaining in `PROCESSING` longer than 5 minutes (`STALLED_DOCUMENT_RECOVERY_THRESHOLD_MS`) is automatically reset to `PENDING` with audit notes and re-queued.

---

## 3. Automated Backup Procedures

### 3.1 Scheduled MongoDB Backups

LeadFlow provides an automated backup script utilizing `mongodump` with gzip compression and SHA256 integrity verification:

```bash
# Execute backup to local / mounted storage volume
./scripts/backup-mongodb.sh "mongodb://localhost:27017/leadflow" "./backups"
```

The script outputs a compressed archive:
`./backups/leadflow_backup_YYYYMMDD_HHMMSS.archive.gz` along with its cryptographic hash `./backups/*.archive.gz.sha256`.

### 3.2 Recommended Production Cron Schedule

For production hosts without managed Atlas continuous backups, configure the following cron schedule:

```cron
# Hourly incremental dump (kept 48 hours)
0 * * * * /opt/leadflow/scripts/backup-mongodb.sh "$MONGODB_URI" "/var/backups/leadflow/hourly"

# Daily archive dump (kept 30 days, uploaded to off-site S3/GCS bucket)
0 2 * * * /opt/leadflow/scripts/backup-mongodb.sh "$MONGODB_URI" "/var/backups/leadflow/daily" && aws s3 sync /var/backups/leadflow/daily/ s3://leadflow-disaster-recovery-backups/mongodb/
```

---

## 4. Restore & Verification Procedures

### 4.1 Automated Restoration Drill

To restore a backup into a verification or recovery target:

```bash
# 1. Restore archive into target database (with checksum verification)
./scripts/restore-mongodb.sh ./backups/leadflow_backup_20261005_010000.archive.gz "mongodb://localhost:27017/leadflow" --drop

# 2. Synchronize all compound indexes across 13 domain models
npm --prefix server run db:index:sync

# 3. Audit collection document counts
npm --prefix server run db:verify
```

### 4.2 Manual Point-in-Time Restoration (`mongorestore`)

```bash
# Restore specific collection
mongorestore --uri="$MONGODB_URI" --archive="./backups/leadflow_backup_latest.archive.gz" --gzip --nsInclude="leadflow.leads" --drop
```

---

## 5. Deployment & Index Synchronization Runbook

Because LeadFlow enforces `autoIndex: false` in production mode to avoid runtime blocking connection delays, index creation is decoupled from application startup:

1. **Pre-Deploy / Migration Phase**:
   ```bash
   # Connect to target cluster and ensure all compound indexes are built
   npm run db:index:sync
   ```
2. **Rollout Phase**:
   Deploy API containers and Worker containers using the multi-stage Docker images (`Dockerfile.server` and `Dockerfile.worker`).
3. **Post-Deploy Health Verification**:
   ```bash
   # Verify API Readiness
   curl -f http://localhost:5000/health/ready

   # Verify Worker Readiness
   curl -f http://localhost:5001/health
   ```

---

## 6. Disaster Recovery Checklist

- [ ] Daily off-site backup archive verified in secondary region storage.
- [ ] SHA-256 checksums verified for backup archives.
- [ ] Database restoration drill executed and verified with `npm run db:verify` on a quarterly schedule.
- [ ] `npm run db:index:sync` integrated into CI/CD deployment hooks.
- [ ] API readiness probe (`/health/ready`) configured on load balancer / container orchestrator.
- [ ] Worker health check (`/health` on port 5001) configured on container orchestrator.
- [ ] Non-root execution confirmed (`USER node` in all container runtimes).
