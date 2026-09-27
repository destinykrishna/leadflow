# LeadFlow — Manual Feature Testing & QA Verification Plan

> **Document Type**: Manual QA Test Execution Runbook  
> **Target Audience**: QA Engineers, Manual Testers, Product Managers, Solution Architects  
> **Platform Version**: LeadFlow v1.0.0 (Production Release)  
> **Base Currency**: Indian Rupee (`INR ₹`) & German Expat Mortgage Terminology  
> **Document Status**: Ready for PDF Export / Manual Execution  

---

## Table of Contents
1. [Test Environment & Prerequisites](#1-test-environment--prerequisites)
2. [Demo Credentials & Role Matrix](#2-demo-credentials--role-matrix)
3. [Role 1: Brokerage Admin Test Suite](#3-role-1-brokerage-admin-test-suite)
4. [Role 2: Mortgage Advisor Test Suite](#4-role-2-mortgage-advisor-test-suite)
5. [Role 3: Client / Borrower Portal Test Suite](#5-role-3-client--borrower-portal-test-suite)
6. [Role 4: Platform Admin Test Suite](#6-role-4-platform-admin-test-suite)
7. [Security & Cross-Tenant Boundary Tests](#7-security--cross-tenant-boundary-tests)
8. [External Webhook Ingestion Test](#8-external-webhook-ingestion-test)
9. [QA Execution Summary & Sign-Off Sheet](#9-qa-execution-summary--sign-off-sheet)

---

## 1. Test Environment & Prerequisites

Before starting manual verification, ensure the following local or deployed services are running:

| Service | Default URL / Port | Expected Health Check |
| :--- | :--- | :--- |
| **Web Frontend (SPA)** | `http://localhost:5173` | Login page loads with LeadFlow logo & demo presets |
| **Backend REST API** | `http://localhost:5000` | `GET http://localhost:5000/api/health` returns `{"status":"ok"}` |
| **Database** | `mongodb://localhost:27017/leadflow` | MongoDB connected and seeded |
| **Background Redis** | `127.0.0.1:6379` | Redis server responsive to ping |
| **Worker Process** | Background CLI (`worker`) | BullMQ queues initialized (`document-processing`, `email-delivery`) |

### Environment Reset (Optional)
To reset the test database to a clean, known seed state before testing:
```bash
npm run seed
```

---

## 2. Demo Credentials & Role Matrix

Use these seeded test accounts to sign in at `http://localhost:5173/login`:

| Persona | Role | Email | Password | Brokerage Slug | Default Landing URL |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Klaus Müller** | `BROKERAGE_ADMIN` | `klaus.mueller@berlin-mortgages.de` | `Password123!` | `berlin-expat-mortgages` | `/app/pipeline` |
| **Elena Schmidt** | `ADVISOR` | `elena.schmidt@berlin-mortgages.de` | `Password123!` | `berlin-expat-mortgages` | `/app/pipeline` |
| **Alex Expat** | `CLIENT` | `alex.expat@gmail.com` | `Password123!` | `berlin-expat-mortgages` | `/portal/case` |
| **Super Admin** | `PLATFORM_ADMIN` | `admin@leadflow-platform.com` | `Password123!` | *(Leave empty)* | `/admin/brokerages` |

> [!TIP]
> On the `/login` page, click any of the **Quick Demo Preset** buttons above the form to instantly populate credentials without typing.

---

## 3. Role 1: Brokerage Admin Test Suite

**Goal**: Verify management oversight, automation configuration, email template creation, and document verification center.

### Test 1.1: Brokerage Admin Sign-In & Workspace Navigation
- **Role**: `BROKERAGE_ADMIN`
- **Starting URL**: `http://localhost:5173/login`
- **Steps**:
  1. Click the **Brokerage Admin** preset button (`klaus.mueller@berlin-mortgages.de`).
  2. Click **Sign In**.
  3. Verify the browser redirects to `/app/pipeline`.
  4. Inspect the left sidebar: confirm navigation links for **Dashboard**, **Pipeline**, **Leads**, **Clients**, **Documents**, **Tasks**, **Templates**, and **Triggers**.
  5. Check browser tab title: confirm it displays `Pipeline · LeadFlow`.
- **Expected Result**: Admin lands on the active pipeline board with all workspace links available.
- **Status**: `[ ] PASS` &nbsp; | &nbsp; `[ ] FAIL` &nbsp; | &nbsp; **Notes**: ___________________________

---

### Test 1.2: Automation Triggers Management (`/app/triggers`)
- **Role**: `BROKERAGE_ADMIN`
- **Starting URL**: `http://localhost:5173/app/triggers`
- **Steps**:
  1. Navigate to `/app/triggers` via the sidebar.
  2. Review the **5 KPI summary cards** (`Total Rules`, `Active`, `Task Triggers`, `Email Dispatches`, `Email Templates`).
  3. Locate any trigger row and toggle the **Status Switch** (Active $\leftrightarrow$ Inactive).
  4. Click **Create Trigger** button.
  5. Fill in trigger modal:
     - Name: `Auto Followup on Qualified`
     - From Stage: `CONTACTED`
     - To Stage: `QUALIFIED`
     - Action Type: `CREATE_TASK`
     - Task Title: `Review borrower credit dossier`
     - Priority: `HIGH`
  6. Click **Save Trigger**.
- **Expected Result**: Trigger list updates immediately with the new rule; active count increments; no page reload required.
- **Status**: `[ ] PASS` &nbsp; | &nbsp; `[ ] FAIL` &nbsp; | &nbsp; **Notes**: ___________________________

---

### Test 1.3: Email Template Customization & Live Preview (`/app/templates`)
- **Role**: `BROKERAGE_ADMIN`
- **Starting URL**: `http://localhost:5173/app/templates`
- **Steps**:
  1. Navigate to `/app/templates`.
  2. Locate template `welcome-expat-inquiry` and click **Preview** (eye icon).
  3. In the preview modal, toggle between **Rendered View** and **Raw Placeholders**.
  4. Verify Indian loan sample context renders properly: borrower `Rahul Sharma`, loan `₹75,00,000`, advisor `Priya Patel`.
  5. Click **New Template**, enter Title `Sanction Letter Notification`, Slug `sanction-letter-notice`, Subject `Your loan approval is ready!`, and Body with `{{lead.firstName}}`.
  6. Click **Save Template**.
- **Expected Result**: Preview modal displays formatted email preview with zero unresolved raw tags; new template is listed in table.
- **Status**: `[ ] PASS` &nbsp; | &nbsp; `[ ] FAIL` &nbsp; | &nbsp; **Notes**: ___________________________

---

### Test 1.4: Brokerage-Wide Document Verification Center (`/app/documents`)
- **Role**: `BROKERAGE_ADMIN`
- **Starting URL**: `http://localhost:5173/app/documents`
- **Steps**:
  1. Navigate to `/app/documents`.
  2. Verify the 5-metric status strip: `Total Files`, `Verified`, `Processing`, `Pending`, `Rejected`.
  3. Filter by status: click **Rejected** filter chip. Confirm only rejected documents display with inspection rejection banners.
  4. Filter by classification: select `Salary Slip / Form 16` from dropdown.
  5. Click the external link icon on any file to test secure viewing in a new tab (`target="_blank"`).
- **Expected Result**: Documents table filters instantaneously; secure links open file previews without leaking storage credentials.
- **Status**: `[ ] PASS` &nbsp; | &nbsp; `[ ] FAIL` &nbsp; | &nbsp; **Notes**: ___________________________

---

## 4. Role 2: Mortgage Advisor Test Suite

**Goal**: Verify lead qualification, Kanban pipeline card movements, lead-to-client conversion, task management, and document uploads.

### Test 2.1: Kanban Pipeline & Stage Progression (`/app/pipeline`)
- **Role**: `ADVISOR`
- **Starting URL**: `http://localhost:5173/login`
- **Steps**:
  1. Sign in as Advisor Elena Schmidt (`elena.schmidt@berlin-mortgages.de`).
  2. Inspect the 7 Kanban columns: `NEW`, `CONTACTED`, `QUALIFIED`, `PROPOSAL`, `NEGOTIATION`, `WON`, `LOST`.
  3. Use the search bar to search for a borrower by name or email.
  4. Drag a lead card from **NEW** to **CONTACTED**.
  5. Advance the card from **CONTACTED** to **QUALIFIED**.
  6. Open a second browser window/tab as `BROKERAGE_ADMIN` on the same page.
- **Expected Result**: Stage update persists without page reload; card reflects in new column across both browser windows in real time via Socket.IO.
- **Status**: `[ ] PASS` &nbsp; | &nbsp; `[ ] FAIL` &nbsp; | &nbsp; **Notes**: ___________________________

---

### Test 2.2: Lead Details & Financial Metrics (`/app/leads/:id`)
- **Role**: `ADVISOR`
- **Starting URL**: `http://localhost:5173/app/leads`
- **Steps**:
  1. Click any lead row to open the Lead Workspace (`/app/leads/:id`).
  2. Verify the financial overview card:
     - Target Loan Amount formatted in Indian Rupees (e.g., `₹65,00,000`).
     - Property Valuation formatted in Indian Rupees (e.g., `₹85,00,000`).
     - Computed dynamic Loan-to-Value (`LTV %` = Loan / Value $\times$ 100).
     - Monthly Gross Income (e.g., `₹1,80,000`).
  3. Click the copy icon next to borrower email and phone number; confirm clipboard notification.
- **Expected Result**: Financial terms display accurately with INR formatting; LTV percentage calculates correctly.
- **Status**: `[ ] PASS` &nbsp; | &nbsp; `[ ] FAIL` &nbsp; | &nbsp; **Notes**: ___________________________

---

### Test 2.3: 1-Click Client Conversion (`ConvertLeadModal`)
- **Role**: `ADVISOR`
- **Starting URL**: Lead in `QUALIFIED` or `PROPOSAL` stage at `/app/leads/:id`
- **Steps**:
  1. Click **Convert to Client Case** button in the top action bar.
  2. In the conversion modal:
     - Review pre-filled borrower name and email.
     - Set initial Client Portal Password (minimum 8 characters, e.g. `ClientPass123!`).
     - Select Case Status (default `ACTIVE`).
     - Profile Type (e.g. `BUYER`).
  3. Click **Confirm & Convert Case**.
- **Expected Result**: Modal closes; lead status transitions to `WON`; advisor is redirected to the newly created Client Case (`/app/clients/:id`); portal user account is provisioned.
- **Status**: `[ ] PASS` &nbsp; | &nbsp; `[ ] FAIL` &nbsp; | &nbsp; **Notes**: ___________________________

---

### Test 2.4: Advisor Document Upload (`UploadDocumentModal`)
- **Role**: `ADVISOR`
- **Starting URL**: `/app/clients/:id` (Client Case view)
- **Steps**:
  1. In the Documents section of the client case, click **Upload Document**.
  2. Select Document Type: `Identity Proof (PAN / Aadhaar / Passport)`.
  3. Title: `Applicant PAN Card Verification`.
  4. Attach a valid test file (PDF or PNG, under 10MB).
  5. Click **Upload & Verify**.
  6. Observe document status transition: initial state `PENDING` $\rightarrow$ `PROCESSING (BULLMQ)` $\rightarrow$ `VERIFIED`.
- **Expected Result**: File is uploaded; BullMQ processes verification asynchronously; status updates in real time without refreshing.
- **Status**: `[ ] PASS` &nbsp; | &nbsp; `[ ] FAIL` &nbsp; | &nbsp; **Notes**: ___________________________

---

### Test 2.5: Advisor Task Management & Completion (`/app/tasks`)
- **Role**: `ADVISOR`
- **Starting URL**: `http://localhost:5173/app/tasks`
- **Steps**:
  1. Navigate to `/app/tasks`.
  2. Inspect the 5 KPI metric cards (`Total Tasks`, `Overdue`, `Due Today`, `In Progress`, `Completed`).
  3. Filter by **Due Today** or **Overdue**.
  4. Click the checkbox next to any task to mark it as complete.
  5. Click on the task row to open the **Task Detail Modal**.
  6. Click the direct link to the associated Lead or Client Case.
- **Expected Result**: Task marks completed with strikethrough; completed count increments; navigation link opens the linked case dossier.
- **Status**: `[ ] PASS` &nbsp; | &nbsp; `[ ] FAIL` &nbsp; | &nbsp; **Notes**: ___________________________

---

## 5. Role 3: Client / Borrower Portal Test Suite

**Goal**: Verify borrower portal experience, calm institutional banking UI, document checklist, drag-and-drop upload, and rejection re-upload workflows.

### Test 5.1: Client Portal Login & Case Summary (`/portal/case`)
- **Role**: `CLIENT`
- **Starting URL**: `http://localhost:5173/login`
- **Steps**:
  1. Click **Client Portal** demo preset (`alex.expat@gmail.com` / `Password123!`).
  2. Click **Sign In**.
  3. Verify automatic redirection to `/portal/case`.
  4. Verify the visual layout:
     - Clear, calm banking UI (no oversized saturated gradients or decorative cards).
     - Primary Case Status: `ACTIVE` with badge.
     - Loan Specification Card: Target Loan Amount (e.g. `₹75,00,000`), Property Valuation (`₹95,00,000`), LTV ratio (`78.9%`).
     - Application Milestone Stepper: `Application Submitted` $\rightarrow$ `Document Verification` $\rightarrow$ `Credit Appraisal` $\rightarrow$ `Sanction & Disbursement`.
  5. Check browser tab title: confirm it displays `My Case · LeadFlow`.
- **Expected Result**: Client lands in dedicated portal; case terms match records; tab title reads `My Case · LeadFlow`.
- **Status**: `[ ] PASS` &nbsp; | &nbsp; `[ ] FAIL` &nbsp; | &nbsp; **Notes**: ___________________________

---

### Test 5.2: Document Center & Indian KYC Checklist (`/portal/documents`)
- **Role**: `CLIENT`
- **Starting URL**: `http://localhost:5173/portal/documents`
- **Steps**:
  1. Navigate to `/portal/documents` using the sidebar.
  2. Review the **4 Essential Verification Pillars**:
     - `1. Identity & KYC` (PAN & Aadhaar)
     - `2. Income Verification` (3-Month Salary Slips & Form 16)
     - `3. Banking History` (6-Month Bank Account Statement)
     - `4. Property Documents` (Draft Sale Agreement / Allotment Letter)
  3. Click **Upload** shortcut on Pillar 1 (Identity & KYC).
  4. Verify the upload modal opens with type pre-selected as `Identity Proof (PAN / Aadhaar / Passport)`.
- **Expected Result**: Checklist accurately reflects Indian mortgage standards; upload shortcuts pre-populate modal classification.
- **Status**: `[ ] PASS` &nbsp; | &nbsp; `[ ] FAIL` &nbsp; | &nbsp; **Notes**: ___________________________

---

### Test 5.3: Client Document Upload & Live Status Sync
- **Role**: `CLIENT`
- **Starting URL**: `http://localhost:5173/portal/documents`
- **Steps**:
  1. Click **Upload Document** button.
  2. Drag and drop a test PDF file (or click to browse).
  3. Set Title: `Latest Form 16 (FY 2025-26)`.
  4. Select Type: `Salary Slip / Form 16`.
  5. Click **Upload Document**.
  6. Watch the uploaded document row in the table below:
     - Badge initially shows `Queued` (Pending).
     - Transitions to `Under Review` (Processing).
     - Transitions to `Verified & Approved` (Verified).
- **Expected Result**: Upload completes without freezing the page; BullMQ background status changes reflect via real-time WebSocket events.
- **Status**: `[ ] PASS` &nbsp; | &nbsp; `[ ] FAIL` &nbsp; | &nbsp; **Notes**: ___________________________

---

### Test 5.4: Document Rejection Feedback & 1-Click Re-Upload
- **Role**: `CLIENT`
- **Starting URL**: `http://localhost:5173/portal/documents`
- **Steps**:
  1. In the document list, locate any document with `Needs Attention` (Rejected) status.
  2. Confirm the red inspection banner displays the specific reason (e.g., *"Page 2 stamp missing or illegible"*).
  3. Click the **Re-Upload** button on the rejected card.
  4. In the re-upload modal, verify:
     - Document Type is pre-locked to the original classification.
     - Previous rejection feedback is highlighted in an alert box.
     - Title is pre-populated as `Re-upload: ...`.
  5. Attach a corrected file and submit.
- **Expected Result**: Re-upload modal provides clear context; submission enqueues a new verification cycle.
- **Status**: `[ ] PASS` &nbsp; | &nbsp; `[ ] FAIL` &nbsp; | &nbsp; **Notes**: ___________________________

---

### Test 5.5: Advisor Contact & Consultation Guide (`/portal/advisor`)
- **Role**: `CLIENT`
- **Starting URL**: `http://localhost:5173/portal/advisor`
- **Steps**:
  1. Navigate to `/portal/advisor`.
  2. Confirm assigned advisor profile card displays:
     - Advisor name: `Elena Schmidt`.
     - Direct `mailto:` email link.
     - Direct `tel:` phone link.
     - Brokerage office details.
  3. Review the **Indian Home Loan FAQ & Next Steps** accordion.
- **Expected Result**: Contact actions work; borrower has clear next steps without confusion.
- **Status**: `[ ] PASS` &nbsp; | &nbsp; `[ ] FAIL` &nbsp; | &nbsp; **Notes**: ___________________________

---

## 6. Role 4: Platform Admin Test Suite

**Goal**: Verify system administration, global multi-brokerage oversight, system health diagnostics, and audit logs.

### Test 6.1: Platform Admin Sign-In & Brokerage Directory (`/admin/brokerages`)
- **Role**: `PLATFORM_ADMIN`
- **Starting URL**: `http://localhost:5173/login`
- **Steps**:
  1. Click **Platform Admin** demo preset (`admin@leadflow-platform.com` / `Password123!`).
  2. Leave `brokerageSlug` empty. Click **Sign In**.
  3. Verify automatic redirection to `/admin/brokerages`.
  4. Inspect the table of registered brokerages (e.g. `Berlin Expat Mortgages`, `Munich Expat Finance`).
  5. Check active plan tiers, contact emails, active user counts, and brokerage status badges.
- **Expected Result**: Platform Admin can view all brokerages across the platform without tenant restriction.
- **Status**: `[ ] PASS` &nbsp; | &nbsp; `[ ] FAIL` &nbsp; | &nbsp; **Notes**: ___________________________

---

### Test 6.2: System Health Diagnostics (`/admin/health`)
- **Role**: `PLATFORM_ADMIN`
- **Starting URL**: `http://localhost:5173/admin/health`
- **Steps**:
  1. Navigate to `/admin/health`.
  2. Verify all service indicators display green:
     - **Database**: `CONNECTED` (MongoDB)
     - **Queue Engine**: `ACTIVE` (BullMQ Redis)
     - **Real-Time Gateway**: `RUNNING` (Socket.IO)
     - **Storage Gateway**: `OPERATIONAL` (ImageKit)
  3. Review system uptime counter.
- **Expected Result**: All 4 subsystem health checks report operational status.
- **Status**: `[ ] PASS` &nbsp; | &nbsp; `[ ] FAIL` &nbsp; | &nbsp; **Notes**: ___________________________

---

## 7. Security & Cross-Tenant Boundary Tests

**Goal**: Verify RBAC security boundaries, tenant isolation, and anti-IDOR protections.

### Test 7.1: Client Portal Lockdown (RBAC Route Guard)
- **Role**: `CLIENT` (Alex Expat)
- **Steps**:
  1. Sign in as client `alex.expat@gmail.com`.
  2. Manually enter URL `http://localhost:5173/app/pipeline` in the browser address bar.
  3. Press Enter.
- **Expected Result**: Protected route guard intercepts request and immediately redirects client back to `/portal/case`. No advisor data is visible.
- **Status**: `[ ] PASS` &nbsp; | &nbsp; `[ ] FAIL` &nbsp; | &nbsp; **Notes**: ___________________________

---

### Test 7.2: Advisor Administrative Lockdown (RBAC Guard)
- **Role**: `ADVISOR` (Elena Schmidt)
- **Steps**:
  1. Sign in as advisor `elena.schmidt@berlin-mortgages.de`.
  2. Manually enter URL `http://localhost:5173/admin/brokerages` in the browser address bar.
  3. Press Enter.
- **Expected Result**: Route guard rejects the access attempt and redirects advisor to `/app/pipeline`.
- **Status**: `[ ] PASS` &nbsp; | &nbsp; `[ ] FAIL` &nbsp; | &nbsp; **Notes**: ___________________________

---

### Test 7.3: Anti-IDOR Tenant Data Concealment
- **Role**: `ADVISOR` (Elena Schmidt from Brokerage A)
- **Steps**:
  1. Attempt to fetch a client case or document belonging to another brokerage by guessing/entering a foreign ID:
     `GET http://localhost:5000/api/clients/000000000000000000000001`
- **Expected Result**: API returns **HTTP 404 (`NotFoundError`)**, NOT HTTP 403. The system conceals the existence of foreign tenant records.
- **Status**: `[ ] PASS` &nbsp; | &nbsp; `[ ] FAIL` &nbsp; | &nbsp; **Notes**: ___________________________

---

### Test 7.4: Client-to-Client Lateral Document Isolation
- **Role**: `CLIENT` (Alex Expat)
- **Steps**:
  1. As Client A, attempt to access or download a document uploaded by Client B in the same brokerage.
- **Expected Result**: Authorization service rejects request with **HTTP 404** or **HTTP 403 Forbidden**. Clients can only view documents belonging to their own case.
- **Status**: `[ ] PASS` &nbsp; | &nbsp; `[ ] FAIL` &nbsp; | &nbsp; **Notes**: ___________________________

---

## 8. External Webhook Ingestion Test

**Goal**: Verify external lead ingestion from marketing sources (Typeform / Webhook) and idempotent duplicate handling.

### Test 8.1: Ingest New Lead via Webhook
- **Method**: `POST`
- **Endpoint**: `http://localhost:5000/api/leads/webhook/<BROKERAGE_ID>`
- **Headers**:
  ```http
  Content-Type: application/json
  x-webhook-secret: dev_webhook_secret_berlin
  ```
- **Payload**:
  ```json
  {
    "email": "priya.qa.tester@example.in",
    "firstName": "Priya",
    "lastName": "Sharma",
    "phone": "+91 98765 43210",
    "source": "TYPEFORM",
    "loanAmount": 7500000,
    "propertyValue": 9500000,
    "monthlyGrossIncome": 185000,
    "downPayment": 2000000,
    "propertyCity": "Bengaluru"
  }
  ```
- **Expected Result**: Returns `HTTP 201 Created` with `{ "success": true, "data": { "isDuplicate": false, "status": "NEW" } }`. Lead immediately appears in Kanban column **NEW** on `/app/pipeline`.
- **Status**: `[ ] PASS` &nbsp; | &nbsp; `[ ] FAIL` &nbsp; | &nbsp; **Notes**: ___________________________

---

### Test 8.2: Idempotent Duplicate Submission
- **Method**: Repeat the exact request from Test 8.1 with the same email (`priya.qa.tester@example.in`).
- **Expected Result**: Returns **`HTTP 200 OK`** (not 500 error, not duplicate record) with `{ "isDuplicate": true }`. Existing lead is preserved without corrupting the pipeline.
- **Status**: `[ ] PASS` &nbsp; | &nbsp; `[ ] FAIL` &nbsp; | &nbsp; **Notes**: ___________________________

---

## 9. QA Execution Summary & Sign-Off Sheet

### Test Results Scorecard

| Test Section | Total Tests | Passed | Failed | Blockers | Status |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Role 1: Brokerage Admin** | 4 | | | | `[ ] PASS` &nbsp; `[ ] FAIL` |
| **Role 2: Mortgage Advisor** | 5 | | | | `[ ] PASS` &nbsp; `[ ] FAIL` |
| **Role 3: Client Portal** | 5 | | | | `[ ] PASS` &nbsp; `[ ] FAIL` |
| **Role 4: Platform Admin** | 2 | | | | `[ ] PASS` &nbsp; `[ ] FAIL` |
| **Security & Tenant Isolation** | 4 | | | | `[ ] PASS` &nbsp; `[ ] FAIL` |
| **Webhook Lead Ingestion** | 2 | | | | `[ ] PASS` &nbsp; `[ ] FAIL` |
| **TOTAL** | **22** | | | | |

---

### QA Sign-Off Details

- **Lead QA Engineer Name**: ____________________________________________
- **Test Execution Date**: ____________________________________________
- **Target Environment**: `[ ] Local Dev` &nbsp; `[ ] Staging / Docker` &nbsp; `[ ] Production`
- **Browser Tested**: `[ ] Chrome` &nbsp; `[ ] Edge` &nbsp; `[ ] Firefox` &nbsp; `[ ] Safari`
- **Overall Release Recommendation**:
  - `[ ] APPROVED FOR PRODUCTION RELEASE`
  - `[ ] CONDITIONALLY APPROVED (Minor issues noted)`
  - `[ ] REJECTED (Blockers found)`

**QA Engineer Signature**: _________________________________ &nbsp;&nbsp;&nbsp;&nbsp; **Date**: _______________
