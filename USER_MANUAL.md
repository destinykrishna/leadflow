# 📘 LeadFlow — Complete Product User Manual
> **The Operating Platform for Mortgage Brokerages & Expat Home Loans**  
> *Version 1.0 • Comprehensive User & Administrator Guide*

---

## 📑 Table of Contents

1. [Introduction & System Overview](#1-introduction--system-overview)
2. [Quick-Start: Demo Accounts & Sign-In](#2-quick-start-demo-accounts--sign-in)
3. [User Role Matrix & Permissions](#3-user-role-matrix--permissions)
4. [Role Guide: Brokerage Admin](#4-role-guide-brokerage-admin)
   - [4.1 Connecting External Google Forms (Lead Ingestion)](#41-connecting-external-google-forms-lead-ingestion)
   - [4.2 Managing Advisors & Team Capacity](#42-managing-advisors--team-capacity)
   - [4.3 Configuring Email Templates & Placeholders](#43-configuring-email-templates--placeholders)
   - [4.4 Setting Up Automated Pipeline Triggers](#44-setting-up-automated-pipeline-triggers)
5. [Role Guide: Loan Advisor](#5-role-guide-loan-advisor)
   - [5.1 Working with the Live Kanban Pipeline](#51-working-with-the-live-kanban-pipeline)
   - [5.2 Lead Inspection & Mortgage Financial Metrics](#52-lead-inspection--mortgage-financial-metrics)
   - [5.3 Converting a Lead into a Client Case](#53-converting-a-lead-into-a-client-case)
   - [5.4 Managing Advisor Tasks & Overdue Schedules](#54-managing-advisor-tasks--overdue-schedules)
6. [Role Guide: Borrower / Expat Client Portal](#6-role-guide-borrower--expat-client-portal)
   - [6.1 Accessing the Borrower Portal](#61-accessing-the-borrower-portal)
   - [6.2 Mortgage Case Tracking](#62-mortgage-case-tracking)
   - [6.3 Document Checklist & Secure Uploads](#63-document-checklist--secure-uploads)
   - [6.4 Understanding Document Verification Statuses](#64-understanding-document-verification-statuses)
7. [Role Guide: Platform Superadmin](#7-role-guide-platform-superadmin)
   - [7.1 Brokerage Onboarding & Management](#71-brokerage-onboarding--management)
   - [7.2 Rotating Webhook Secrets](#72-rotating-webhook-secrets)
   - [7.3 System Health & Infrastructure Monitoring](#73-system-health--infrastructure-monitoring)
8. [Frequently Asked Questions & Troubleshooting](#8-frequently-asked-questions--troubleshooting)

---

## 1. Introduction & System Overview

**LeadFlow** is an institutional-grade, multi-tenant mortgage operating system built specifically for mortgage brokerages handling international and expat home loans.

### What LeadFlow Solves:
* **Eliminates Lost Inquiries:** Automatically captures external inquiries from Google Forms and webhooks, routing them into a structured 7-stage Kanban pipeline with automated qualification scoring.
* **Instant Collaboration Without Overwrites:** Real-time WebSocket synchronization keeps every advisor’s screen updated live, while database-level Optimistic Concurrency Control prevents conflicting updates.
* **Automated Document Workflows:** Borrowers receive their own secure portal to upload payslips, bank statements, and IDs. Files are processed asynchronously in the background so no one is left waiting on upload spinners.
* **Automated Follow-ups:** Automatically triggers personalized welcome emails and time-sensitive advisor call tasks the moment a lead moves between pipeline stages.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           LEADFLOW PLATFORM TOPOLOGY                            │
├──────────────────────┬──────────────────────┬───────────────────────────────────┤
│    LEAD INGESTION    │   ADVISOR PIPELINE   │          BORROWER PORTAL          │
│                      │                      │                                   │
│  Google Forms / Web  │  7-Stage Live Kanban │  Self-service Client Case         │
│  HMAC SHA-256 Auth   │  Real-Time Sockets   │  Document Checklist (10MB Max)    │
│  Known Lead Matching │  Auto Task Triggers  │  Live Verification Status Tracking│
│  Lead Quality Score  │  Auto Email Delivery │  Assigned Advisor Direct Contact  │
└──────────────────────┴──────────────────────┴───────────────────────────────────┘
```

---

## 2. Quick-Start: Demo Accounts & Sign-In

LeadFlow features **1-Click Demo Login Buttons** located directly on the Sign-In screen at `https://leadflow-lemon-two.vercel.app/login`.

| Role Button | Pre-Filled Account | Password | Primary Purpose |
| :--- | :--- | :--- | :--- |
| **Brokerage Admin** | `klaus.mueller@berlin-mortgages.de` | `Password123!` | Configure integrations, manage team, set automations |
| **Loan Advisor** | `elena.schmidt@berlin-mortgages.de` | `Password123!` | Manage leads, advance pipeline, complete tasks |
| **Borrower Portal** | `alex.expat@gmail.com` | `Password123!` | Client case dashboard, upload mortgage documents |
| **Platform Admin** | `admin@leadflow-platform.com` | `Password123!` | Manage all brokerages, inspect platform health |

### How to Sign In:
1. Open the application link in any browser.
2. Click any of the **Quick sign-in with demo accounts** buttons at the bottom of the card.
3. Click **Sign In**. You will immediately be redirected to your role-specific dashboard.

---

## 3. User Role Matrix & Permissions

LeadFlow strictly enforces tenant isolation and Role-Based Access Control (RBAC):

| Capability / Section | Platform Admin | Brokerage Admin | Loan Advisor | Borrower / Client |
| :--- | :---: | :---: | :---: | :---: |
| **Cross-Brokerage Management** | ✅ | ❌ | ❌ | ❌ |
| **Brokerage Pipeline & Kanban** | ✅ | ✅ | ✅ | ❌ |
| **Convert Leads to Client Accounts** | ✅ | ✅ | ✅ | ❌ |
| **Google Forms Webhook Config** | ✅ | ✅ | ❌ | ❌ |
| **Team & Advisor Provisioning** | ✅ | ✅ | ❌ | ❌ |
| **Email Templates & Triggers** | ✅ | ✅ | ❌ | ❌ |
| **Advisor Task Scheduling** | ✅ | ✅ | ✅ | ❌ |
| **Document Verification Review** | ✅ | ✅ | ✅ | ❌ |
| **Borrower Portal & Uploads** | ❌ | ❌ | ❌ | ✅ |

---

## 4. Role Guide: Brokerage Admin

As a **Brokerage Admin**, you have full control over your brokerage’s team members, lead intake channels, automated triggers, and email communication templates.

### 4.1 Connecting External Google Forms (Lead Ingestion)
LeadFlow integrates seamlessly with Google Forms to ingest applicant inquiries in real time.

1. Navigate to **Advisors & Team** in the sidebar, and click the **Lead Source Setup** tab.
2. Review your pre-configured credentials:
   - **Brokerage Identifier (Tenant ID):** Your unique brokerage ID.
   - **Webhook Ingestion URL:** Your dedicated backend ingestion endpoint (`https://leadflow-api-k1i2.onrender.com/api/leads/webhook/<YOUR_ID>`).
   - **Webhook Authentication Secret:** Secret key verifying form submissions.
3. **Copy the Pre-Configured Apps Script:**
   - Scroll to the **Google Apps Script Code (`Code.gs`)** card.
   - Click the **Copy Apps Script** button.
4. **Paste into Google Forms:**
   - In your Google Form editor, click the three dots (`⋮`) in the top-right corner and select **Apps Script**.
   - Paste the copied code into `Code.gs` and click **Save** (disk icon).
   - Click **Triggers** (alarm clock icon on left) ➔ **Add Trigger** (bottom right).
   - Set Choose which function to run to: `onFormSubmit`.
   - Set Select event type to: `On form submit`. Click **Save**.
5. **Test Ingestion:** Submit a test response via your Google Form. Within 1 second, it will automatically appear in the **NEW** column on your advisor Kanban board!

---

### 4.2 Managing Advisors & Team Capacity
1. Navigate to **Advisors & Team** in the sidebar.
2. The team list shows all registered mortgage advisors, their active case loads, and contact info.
3. Click **Add Advisor** in the top right:
   - Provide their Full Name, Email Address, and Phone Number.
   - Assign their initial account password.
4. Newly created advisors can immediately log in and will have leads assigned to them.

---

### 4.3 Configuring Email Templates & Placeholders
1. Navigate to **Email Templates** under the *Automations* section.
2. Click **Create Template** (or click *Edit* on an existing template like *Initial Mortgage Inquiry Welcome*).
3. Fill in the template details:
   - **Name:** e.g., *Application Received Confirmation*
   - **Subject Line:** e.g., *`Your Mortgage Application with {{brokerage.name}}`*
   - **Body:** Use dynamic placeholders to automatically personalize every email:
     - `{{lead.firstName}}` — Applicant's first name
     - `{{lead.lastName}}` — Applicant's surname
     - `{{advisor.name}}` — Assigned mortgage advisor name
     - `{{advisor.email}}` — Assigned advisor contact email
     - `{{brokerage.name}}` — Your brokerage organization name
     - `{{customFields.loanAmount}}` — Requested loan amount in INR / EUR
4. Click **Save Template**.

---

### 4.4 Setting Up Automated Pipeline Triggers
Eliminate manual repetitive follow-ups by setting automated stage rules:

1. Navigate to **Stage Automations** under *Automations*.
2. Click **Create Trigger**:
   - **Stage Selection:** Pick the pipeline stage that triggers the action (e.g., `NEW`, `QUALIFIED`, or `WON`).
   - **Action Type:** Choose between:
     - `SEND_EMAIL`: Dispatches an automated personalized email template via BullMQ.
     - `CREATE_TASK`: Schedules a time-sensitive task for the assigned advisor (e.g. *"Call applicant within 2 hours"*).
   - **Due Date Offset:** Set deadline hours for created tasks (e.g., `2 hours` or `24 hours`).
3. Click **Save Trigger**. Now, whenever any advisor moves a lead into that column, your rule executes automatically in the background!

---

## 5. Role Guide: Loan Advisor

As a **Loan Advisor**, you spend your day on the interactive Kanban pipeline, qualifying borrower finances, and converting promising leads into active mortgage cases.

### 5.1 Working with the Live Kanban Pipeline
Navigate to **Pipeline** in the sidebar. You will see 7 stage columns:

```
[ NEW ] ➔ [ CONTACTED ] ➔ [ QUALIFIED ] ➔ [ PROPOSAL ] ➔ [ NEGOTIATION ] ➔ [ WON ]
                                                                             └─► [ LOST ]
```

* **Drag-and-Drop:** Drag any lead card from one stage to another. The database updates atomically, and the change reflects instantly across all team members' screens.
* **Filter by Loan Size or Source:** Use the filter strip at the top to focus on Jumbo Loans (`>= ₹50,00,000`), Website leads, or your own assigned accounts.
* **Stage Advance Button:** Open any lead card to see a dedicated **Advance Stage** button and a secondary **Mark as Lost** option with confirmation defense.

---

### 5.2 Lead Inspection & Mortgage Financial Metrics
Click any lead card to open the **Lead Detail Workspace**:
* **Loan-to-Value (LTV) Calculation:** The system automatically calculates LTV percentage:
  $$\text{LTV} = \left(\frac{\text{Target Loan Amount}}{\text{Property Value}}\right) \times 100$$
  - Displays green if LTV $\le 80\%$ (Standard bank lending criteria).
  - Displays amber/warning if LTV $> 80\%$ (High LTV requires private mortgage insurance).
* **Already Known Borrower Badge:** If an applicant with the same email already exists as a client in your brokerage, LeadFlow displays a prominent **Already Known Client** banner with a direct link to their existing case file.

---

### 5.3 Converting a Lead into a Client Case
When a lead is sufficiently qualified:
1. Open the lead detail view.
2. In the top action bar, click **Convert to Client**.
3. Select the Client Profile Classification (e.g., *Buyer / Borrower*, *Self-Employed Expat*, or *Refinancing Investor*).
4. The system automatically:
   - Provisions a secure **Client Portal account** with role `CLIENT`.
   - Links all existing lead notes and financial metrics to the new case.
   - Generates an initial temporary password with a 1-click **Copy Password** button to share with the borrower.
   - Moves the lead card into the **WON** column.

---

### 5.4 Managing Advisor Tasks & Overdue Schedules
Navigate to **Tasks** in the sidebar:
* **Metric Strip:** View immediate counts for *Total Tasks*, *Completed*, *Pending*, and *Overdue*.
* **Overdue Highlighting:** Any task whose due date has passed without completion displays with a vibrant **OVERDUE** badge.
* **Filter to "My Tasks":** Click the *Assigned to Me* filter tab to only see tasks assigned to your advisor account.
* **Completing a Task:** Click the checkbox next to any task to mark it completed instantly.

---

## 6. Role Guide: Borrower / Expat Client Portal

When a borrower is converted to a client, they receive access to their self-service portal at `/portal`.

### 6.1 Accessing the Borrower Portal
* **URL:** `https://leadflow-lemon-two.vercel.app/portal`
* Borrowers log in with their email address and the secure password provided by their advisor.
* Clients are isolated to their own case and **never** see internal pipeline boards, other borrowers, or advisor settings.

---

### 6.2 Mortgage Case Tracking
* **Case Status:** Displays the current stage of the mortgage application.
* **Key Loan Summary:** Shows approved target loan amount, property valuation, estimated monthly EMI, and assigned advisor contact card.

---

### 6.3 Document Checklist & Secure Uploads
The borrower portal features a clear document checklist required by German mortgage banks:
1. Click **Upload Document**.
2. Select Document Type:
   - `PAYSLIP` (Last 3 months of salary slips)
   - `BANK_STATEMENT` (Proof of equity and down payment)
   - `IDENTIFICATION` (Passport or German Residence Permit / Aufenthalts-titel)
   - `TAX_RETURN` (Einkommensteuerbescheid)
   - `CONTRACT` (Draft purchase agreement / Kaufvertrag)
3. Drag & drop or browse for the file (Max size: 10MB; Supported: PDF, JPEG, PNG, WEBP).
4. Click **Upload File**.

---

### 6.4 Understanding Document Verification Statuses
Once uploaded, documents are checked in the background by BullMQ worker queues:

| Status Badge | Meaning | What Happens Next |
| :--- | :--- | :--- |
| **`PENDING`** | File uploaded safely to ImageKit object storage. | Queued for asynchronous background verification. |
| **`PROCESSING`** | Under review by background verification worker. | Simulated multi-point criteria checking. |
| **`VERIFIED`** | All format, size, and validity checks passed. | Advisor notified that document is bank-ready. |
| **`REJECTED`** | Automated check failed (e.g. illegible or incomplete). | An explanatory note is shown; borrower can upload a replacement. |

---

## 7. Role Guide: Platform Superadmin

The **Platform Admin** role is designed for the platform operator overseeing multiple independent mortgage brokerages.

### 7.1 Brokerage Onboarding & Management
1. Navigate to **Brokerages** in the sidebar.
2. View platform-wide statistics: *Total Brokerages*, *Active Subscriptions*, and *Total Ingested Leads*.
3. Click **New Brokerage**:
   - Enter Brokerage Legal Name (e.g. *Frankfurt Mortgage Partners GmbH*).
   - Enter Organization Slug (e.g. `frankfurt-mortgages`).
   - Select Subscription Tier (`TRIAL`, `STARTER`, `PROFESSIONAL`, or `ENTERPRISE`).
   - Enter the primary Brokerage Admin details.
4. Click **Create Brokerage**. Both the tenant container and primary admin account are provisioned instantly.

---

### 7.2 Rotating Webhook Secrets
If a brokerage admin suspects an external webhook secret was exposed:
1. Open the Brokerage drawer.
2. Scroll to **Webhook Secret** and click **Rotate Secret**.
3. Confirm the rotation. A new cryptographically secure 48-character token is generated immediately.
4. The admin updates their Google Apps Script, and the old secret is invalidated instantly.

---

### 7.3 System Health & Infrastructure Monitoring
Navigate to **System Health** to inspect real-time operational telemetry:
* **MongoDB Status:** Verifies active database connection and latency.
* **Upstash Redis Queue:** Monitors active queue length, worker heartbeat, and delayed jobs.
* **API Latency:** Real-time round-trip response metrics.

---

## 8. Frequently Asked Questions & Troubleshooting

### Q1: What happens if two advisors move the same lead card simultaneously?
**A:** LeadFlow uses database-level **Optimistic Concurrency Control (`__v`)**. If Advisor A moves a card, their update succeeds. If Advisor B attempts to move the same card a millisecond later with stale data, the backend rejects the update with an **HTTP 409 Conflict**. Advisor B’s screen displays a notice: *"This lead was modified by another advisor. Reloading latest state..."* and re-aligns the card automatically without data loss.

### Q2: What happens if a borrower submits the same Google Form twice?
**A:** LeadFlow features atomic duplicate detection. Inquiries are uniquely indexed on `{ brokerageId: 1, email: 1 }`. If a duplicate arrives, the system idempotently logs the submission and updates existing notes without crashing or creating cluttering duplicate cards.

### Q3: Why does clicking "View File" not open in my browser?
**A:** Modern browsers (Chrome, Edge, Safari) strictly block popups if an asynchronous network call precedes the tab opening. LeadFlow uses a **synchronous tab reservation** pattern that opens the tab during your physical click and loads the secure ImageKit link the moment it is signed. If your browser still blocks it, click the **Copy Link** button and paste the link into any tab.

### Q4: Are borrower documents public?
**A:** **No.** All document URLs are signed, short-lived tokens generated on demand by the backend. Raw storage paths and secret API keys are kept 100% server-side.

---

*LeadFlow User Manual • Authored for Recruitment Assessment & Operational Reference • 2026*
