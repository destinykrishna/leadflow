# Typeform Lead Source Setup & Verification Runbook

> **Audience**: LeadFlow Operators, DevOps Engineers, and System Integrators.  
> **Objective**: Provide a step-by-step procedure to connect a real Typeform questionnaire to a deployed LeadFlow instance and verify end-to-end automated lead ingestion.

---

## Table of Contents
1. [Architecture & Ingestion Flow](#1-architecture--ingestion-flow)
2. [Prerequisites](#2-prerequisites)
3. [Typeform Questionnaire Design & Field Mapping](#3-typeform-questionnaire-design--field-mapping)
4. [Typeform Webhook Payload Structure](#4-typeform-webhook-payload-structure)
5. [LeadFlow Webhook Endpoints & Authentication](#5-leadflow-webhook-endpoints--authentication)
6. [Configuring the Webhook in Typeform](#6-configuring-the-webhook-in-typeform)
7. [Network, HTTPS & Tunneling Requirements](#7-network-https--tunneling-requirements)
8. [Environment & Brokerage Configuration](#8-environment--brokerage-configuration)
9. [Submitting a Test Home Loan Enquiry](#9-submitting-a-test-home-loan-enquiry)
10. [Verifying Lead Appearance in Advisor Pipeline](#10-verifying-lead-appearance-in-advisor-pipeline)
11. [Verifying Duplicate & Known-Client Behavior](#11-verifying-duplicate--known-client-behavior)
12. [Troubleshooting Common Issues](#12-troubleshooting-common-issues)
13. [End-to-End Verification Checklist](#13-end-to-end-verification-checklist)

---

## 1. Architecture & Ingestion Flow

LeadFlow features a high-throughput, multi-tenant lead ingestion engine. Incoming webhooks are authenticated, normalized, deduplicated, and displayed in real time on the advisor's Kanban pipeline without manual intervention.

```
┌────────────────────────┐      HTTPS POST (JSON)       ┌────────────────────────────────┐
│   Typeform Form        │ ───────────────────────────> │  LeadFlow Ingestion Endpoint   │
│   (Home Loan Enquiry)  │   Header: x-signature-sha256 │  /api/leads/webhook/:brokerageId│
└────────────────────────┘   or x-webhook-secret        └───────────────┬────────────────┘
                                                                        │
                                                                        ▼
                                                        ┌────────────────────────────────┐
                                                        │  1. verifyWebhookAuth Guard   │
                                                        │     - Constant-time HMAC check │
                                                        │     - Anti-enumeration defense │
                                                        └───────────────┬────────────────┘
                                                                        │
                                                                        ▼
                                                        ┌────────────────────────────────┐
                                                        │  2. Tenant Rate Limiter       │
                                                        │     - 1,000 req/min / brokerage│
                                                        └───────────────┬────────────────┘
                                                                        │
                                                                        ▼
                                                        ┌────────────────────────────────┐
                                                        │  3. Normalization Engine       │
                                                        │     - Maps answers & UTM tags  │
                                                        │     - Strips untrusted bodies  │
                                                        └───────────────┬────────────────┘
                                                                        │
                                                                        ▼
                                                        ┌────────────────────────────────┐
                                                        │  4. Scoped Ingestion (MongoDB) │
                                                        │     - Unique { brokerage, email│
                                                        │     - Detects existing clients │
                                                        └───────────────┬────────────────┘
                                                                        │
                                                                        ▼
                                                        ┌────────────────────────────────┐
                                                        │  5. Realtime Socket.IO & Triggers│
                                                        │     - Live card on Kanban board│
                                                        │     - Dispatches welcome email │
                                                        │     - Schedules advisor task   │
                                                        └────────────────────────────────┘
```

---

## 2. Prerequisites

Before connecting Typeform to LeadFlow, ensure you have:
1. **Typeform Account**: An active account on [Typeform.com](https://www.typeform.com) (Free or Paid tier).
2. **Deployed LeadFlow Application**:
   - Backend API running on Node.js / Express 5.
   - MongoDB database connected and seeded.
   - Redis and BullMQ worker running for background tasks.
3. **Publicly Accessible HTTPS URL**:
   - In production: `https://api.yourdomain.com` (with valid SSL/TLS certificate).
   - In local development: An active HTTPS tunnel (e.g., Cloudflare Tunnel, ngrok, or LocalXpose) routing to local port `5000`.
4. **Target Brokerage Identifiers**:
   - `brokerageId`: The 24-character hexadecimal MongoDB ObjectId of your brokerage (e.g., `650c1f1e8a9d2c001f3e4a5b`).
   - `webhookSecret`: The secret string configured on the target brokerage record (e.g., `whsec_apex_demo_secret_2026`).

---

## 3. Typeform Questionnaire Design & Field Mapping

When designing your Typeform questionnaire, configure the field references (`ref`) or field labels so LeadFlow's normalization engine can extract identity, contact, and mortgage information accurately.

### Recommended Question Configuration

| # | Question Label in Typeform | Typeform Field Type | Field Reference (`ref`) | Normalized Field in LeadFlow |
| :-: | :--- | :--- | :--- | :--- |
| **1** | *"What is your email address?"* | **Email** | `email` | `lead.email` *(Mandatory)* |
| **2** | *"What is your first name?"* | **Short text** | `first_name` | `lead.firstName` |
| **3** | *"What is your last name?"* | **Short text** | `last_name` | `lead.lastName` |
| **4** | *"What is your contact phone number?"* | **Phone number** | `phone` | `lead.phone` |
| **5** | *"What is your target home loan amount (in ₹)?"* | **Number** | `loanAmount` | `lead.customFields.loanAmount` |
| **6** | *"What is the estimated property valuation (in ₹)?"* | **Number** | `propertyValue` | `lead.customFields.propertyValue` |
| **7** | *"What is your gross monthly income (in ₹)?"* | **Number** | `monthlyGrossIncome` | `lead.customFields.monthlyGrossIncome` |
| **8** | *"How much down payment have you saved (in ₹)?"* | **Number** | `downPayment` | `lead.customFields.downPayment` |
| **9** | *"Which city are you purchasing in?"* | **Short text** | `propertyCity` | `lead.customFields.propertyCity` |
| **10**| *"What is your employment type?"* | **Multiple choice** | `employmentType` | `lead.customFields.employmentType` |

> **Note on Name Extraction**: If your Typeform asks for a single "Full Name" instead of separate first and last names, LeadFlow will split the input on whitespace (e.g., `"Priya Sharma"` becomes `firstName: "Priya"` and `lastName: "Sharma"`).

### Hidden Fields for Campaign Tracking
In Typeform under **Logic → Personalize with data → Hidden fields**, add:
- `utm_source`: Set to `website`, `google_ads`, `magicbricks`, or `referral`.
- LeadFlow extracts `utm_source` and maps it to the standard `LeadSource` enum (`WEBSITE`, `CAMPAIGN`, `REFERRAL`, etc.).

---

## 4. Typeform Webhook Payload Structure

When an applicant submits your Typeform, Typeform sends an HTTP `POST` request with a JSON body structured like this:

```json
{
  "event_id": "01HG4Z7K99M0XEXAMPLE",
  "event_type": "form_response",
  "form_response": {
    "form_id": "indian_mortgage_inquiry",
    "submitted_at": "2026-09-27T10:15:30Z",
    "answers": [
      {
        "field": { "id": "email_input", "type": "email", "ref": "email" },
        "type": "email",
        "email": "priya.sharma@example.com"
      },
      {
        "field": { "id": "first_name_input", "type": "text", "ref": "first_name" },
        "type": "text",
        "text": "Priya"
      },
      {
        "field": { "id": "last_name_input", "type": "text", "ref": "last_name" },
        "type": "text",
        "text": "Sharma"
      },
      {
        "field": { "id": "phone_input", "type": "phone_number", "ref": "phone" },
        "type": "phone_number",
        "phone_number": "+919876543210"
      },
      {
        "field": { "id": "loan_amount_input", "type": "number", "ref": "loanAmount" },
        "type": "number",
        "number": 4800000
      },
      {
        "field": { "id": "property_value_input", "type": "number", "ref": "propertyValue" },
        "type": "number",
        "number": 6000000
      },
      {
        "field": { "id": "income_input", "type": "number", "ref": "monthlyGrossIncome" },
        "type": "number",
        "number": 125000
      },
      {
        "field": { "id": "down_payment_input", "type": "number", "ref": "downPayment" },
        "type": "number",
        "number": 1200000
      },
      {
        "field": { "id": "city_input", "type": "text", "ref": "propertyCity" },
        "type": "text",
        "text": "Bengaluru"
      }
    ],
    "hidden": {
      "utm_source": "google_ads"
    }
  }
}
```

---

## 5. LeadFlow Webhook Endpoints & Authentication

### 1. Ingestion Endpoints
LeadFlow exposes two dedicated webhook routes in `server/src/routes/lead.routes.ts`:

- **Primary Route**: `POST /api/leads/webhook/:brokerageId`
- **Alias Route**: `POST /api/leads/ingest/:brokerageId`

Replace `:brokerageId` with the 24-character hexadecimal ObjectId of the brokerage.

### 2. Supported Authentication Schemes
LeadFlow's `verifyWebhookAuth` middleware enforces authentication using either of two schemes:

#### Scheme A: HMAC SHA-256 Signature (Recommended for Typeform)
- **Header**: `x-signature-sha256` or `x-hub-signature-256`
- **Format**: `sha256=<hex_digest>`
- **Computation**:
  ```javascript
  const crypto = require('crypto');
  const signature = 'sha256=' + crypto
    .createHmac('sha256', brokerageWebhookSecret)
    .update(rawPayloadString, 'utf8')
    .digest('hex');
  ```
- **Security**: LeadFlow uses `crypto.timingSafeEqual` for constant-time comparison to prevent timing side-channel attacks.

#### Scheme B: Shared Webhook Secret Header
- **Header**: `x-webhook-secret: <brokerageWebhookSecret>`  
  *(or `Authorization: Bearer <brokerageWebhookSecret>`)*
- Useful when sending test payloads via cURL, Postman, or webhook relay gateways.

---

## 6. Configuring the Webhook in Typeform

Follow these steps within the Typeform administrative console:

1. **Open Your Form**:
   - Log in to [Typeform.com](https://www.typeform.com) and navigate to your **Home Loan Enquiry** form.
2. **Access Webhook Settings**:
   - Click on the **Connect** tab in the top navigation bar.
   - Select **Webhooks** from the integrations list.
3. **Add Webhook**:
   - Click **Add a webhook**.
   - In the **Destination URL** field, enter your LeadFlow ingestion endpoint:
     ```text
     https://api.yourdomain.com/api/leads/webhook/<YOUR_BROKERAGE_ID>
     ```
     *(Example: `https://api.leadflow.com/api/leads/webhook/650c1f1e8a9d2c001f3e4a5b`)*
4. **Configure Secret**:
   - In the **Secret** field, enter the brokerage's `webhookSecret`.
   - Typeform will use this secret to generate the `x-hub-signature-256` / `x-signature-sha256` HMAC digest on every delivery.
5. **Activate Webhook**:
   - Click **Save webhook**.
   - Toggle the switch to **On**.
6. **Send Test Request**:
   - Click **View deliveries** → **Send test request**.
   - Confirm that Typeform receives a `200 OK` or `201 Created` response code from LeadFlow.

---

## 7. Network, HTTPS & Tunneling Requirements

### Public HTTPS Mandate
Typeform is a cloud SaaS platform. Its webhook delivery servers cannot make HTTP requests to `http://localhost:5000` or non-routable private IP addresses. Webhooks **must** target a valid HTTPS URL with a recognized TLS certificate.

### Local Development / Testing Tunnels
When testing LeadFlow locally on your development workstation:

#### Option 1: Cloudflare Tunnel (Recommended — Free & Stable)
```bash
# Expose local port 5000 via a temporary Cloudflare tunnel
cloudflared tunnel --url http://localhost:5000
```
*Cloudflare outputs a public HTTPS address like `https://random-words.trycloudflare.com`.*  
Your Typeform webhook URL becomes:  
`https://random-words.trycloudflare.com/api/leads/webhook/<YOUR_BROKERAGE_ID>`

#### Option 2: ngrok
```bash
# Expose local port 5000 via ngrok
ngrok http 5000
```
*Copy the forwarding address (e.g. `https://abc1234.ngrok-free.app`).*  
Your Typeform webhook URL becomes:  
`https://abc1234.ngrok-free.app/api/leads/webhook/<YOUR_BROKERAGE_ID>`

---

## 8. Environment & Brokerage Configuration

### 1. LeadFlow Server Environment Variables
Ensure `server/.env` contains the required operational settings:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/leadflow
JWT_SECRET=your_jwt_access_secret_min_32_characters
JWT_REFRESH_SECRET=your_jwt_refresh_secret_min_32_characters
COOKIE_SECRET=your_cookie_signing_secret
CORS_ORIGIN=http://localhost:5173
REDIS_URL=redis://localhost:6379
```

### 2. Identifying Your Brokerage Credentials
To obtain your `brokerageId` and `webhookSecret`:

#### Method A: Inspect the Database (via MongoDB Shell or Compass)
```javascript
use leadflow;
db.brokerages.find({ status: "ACTIVE" }, { name: 1, slug: 1, webhookSecret: 1 });
```
*Example Output:*
```json
{
  "_id": ObjectId("650c1f1e8a9d2c001f3e4a5b"),
  "name": "Apex Home Finance Pvt Ltd",
  "slug": "apex-home-finance",
  "webhookSecret": "whsec_apex_demo_secret_2026"
}
```

#### Method B: Seed Database
When running `npm run seed` in `server/`, the default development brokerage is created with:
- **Brokerage Slug**: `berlin-expat-mortgages`
- **Default Secret**: `whsec_berlin_demo_secret_2026`

---

## 9. Submitting a Test Home Loan Enquiry

To verify the integration without waiting for organic form traffic, submit a live test payload using one of two methods:

### Method 1: Submitting via Typeform Live Preview
1. Open your Typeform questionnaire in your browser.
2. Complete the form with realistic Indian mortgage values:
   - **First Name**: `Priya`
   - **Last Name**: `Sharma`
   - **Email**: `priya.sharma@example.com`
   - **Phone**: `+919876543210`
   - **Target Loan Amount**: `4800000` (₹48 Lakhs)
   - **Property Valuation**: `6000000` (₹60 Lakhs)
   - **Monthly Gross Income**: `125000` (₹1.25 Lakhs)
   - **Down Payment**: `1200000` (₹12 Lakhs)
   - **City**: `Bengaluru`
3. Click **Submit**.

### Method 2: Testing via cURL with Secret Header
You can simulate Typeform's delivery directly to your LeadFlow API using `x-webhook-secret`:

```bash
curl -X POST "https://api.yourdomain.com/api/leads/webhook/<YOUR_BROKERAGE_ID>" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: <YOUR_WEBHOOK_SECRET>" \
  -d '{
    "event_id": "TEST_001",
    "event_type": "form_response",
    "form_response": {
      "form_id": "home_loan_enquiry",
      "submitted_at": "2026-09-27T10:00:00Z",
      "answers": [
        {
          "field": { "id": "email_input", "type": "email", "ref": "email" },
          "type": "email",
          "email": "priya.sharma@example.com"
        },
        {
          "field": { "id": "first_name", "type": "text", "ref": "first_name" },
          "type": "text",
          "text": "Priya"
        },
        {
          "field": { "id": "last_name", "type": "text", "ref": "last_name" },
          "type": "text",
          "text": "Sharma"
        },
        {
          "field": { "id": "phone_input", "type": "phone_number", "ref": "phone" },
          "type": "phone_number",
          "phone_number": "+919876543210"
        },
        {
          "field": { "id": "loan_amount", "type": "number", "ref": "loanAmount" },
          "type": "number",
          "number": 4800000
        },
        {
          "field": { "id": "prop_val", "type": "number", "ref": "propertyValue" },
          "type": "number",
          "number": 6000000
        },
        {
          "field": { "id": "income", "type": "number", "ref": "monthlyGrossIncome" },
          "type": "number",
          "number": 125000
        }
      ],
      "hidden": {
        "utm_source": "website"
      }
    }
  }'
```

### Expected API Response:
```json
{
  "success": true,
  "isDuplicate": false,
  "isAlreadyKnown": false,
  "knownAs": null,
  "message": "Lead ingested successfully.",
  "data": {
    "id": "650c2a7f8a9d2c001f3e4b12",
    "firstName": "Priya",
    "lastName": "Sharma",
    "email": "priya.sharma@example.com",
    "phone": "+919876543210",
    "status": "NEW",
    "source": "WEBSITE",
    "score": 0,
    "createdAt": "2026-09-27T10:00:00.123Z"
  }
}
```
*HTTP Status: `201 Created`*

---

## 10. Verifying Lead Appearance in Advisor Pipeline

Once the test payload is sent:

1. **Sign in as Mortgage Advisor**:
   - Open your browser at `http://localhost:5173/login` (or production URL).
   - Sign in with an Advisor account belonging to that brokerage.
2. **Open the Pipeline Board**:
   - Navigate to `/app/pipeline`.
3. **Verify the New Lead Card**:
   - Look at the **NEW** column.
   - You will see a new card for **Priya Sharma**.
   - Notice the source tag indicates `WEBSITE` or `CAMPAIGN`.
4. **Open the Lead Detail Drawer**:
   - Click on Priya Sharma's card.
   - Inspect the **Financial Overview**:
     - Target Loan Amount: `₹48,00,000`
     - Estimated Property Value: `₹60,00,000`
     - Dynamically calculated Loan-to-Value: `80.0% LTV`
     - Monthly Gross Income: `₹1,25,000`
5. **Verify Automated Task Creation**:
   - Navigate to `/app/tasks`.
   - Confirm that an automated outreach task (e.g., *"Initial Discovery Call with Priya Sharma"*) was generated with priority and due date.

---

## 11. Verifying Duplicate & Known-Client Behavior

LeadFlow implements strict deduplication to prevent duplicate cards and preserve context.

### Test A: Repeated Submission (Idempotent Duplicate)
Submit the exact same payload a second time with the email `priya.sharma@example.com`.

**Expected API Response**:
```json
{
  "success": true,
  "isDuplicate": true,
  "isAlreadyKnown": true,
  "knownAs": "LEAD",
  "message": "Lead already exists for this brokerage. Ingestion processed idempotently.",
  "data": {
    "id": "650c2a7f8a9d2c001f3e4b12",
    "firstName": "Priya",
    "lastName": "Sharma",
    "email": "priya.sharma@example.com",
    "status": "NEW"
  }
}
```
*HTTP Status: `200 OK`*  
**Pipeline Check**: Zero duplicate cards are created on the board; the existing record is preserved.

### Test B: Existing Client Submits Form ("Already Known")
Submit a test payload using the email address of an already-converted client in that brokerage (e.g., `alex.expat@gmail.com`).

**Expected API Response**:
```json
{
  "success": true,
  "isDuplicate": false,
  "isAlreadyKnown": true,
  "knownAs": "CLIENT",
  "existingClientId": "650c3d9a8a9d2c001f3e4c44",
  "message": "Lead ingested successfully. Existing brokerage client recognized.",
  "data": {
    "firstName": "Alex",
    "email": "alex.expat@gmail.com",
    "status": "NEW"
  }
}
```
*HTTP Status: `201 Created`*  
**Pipeline Check**: The card appears with an **"Already Known Client"** badge, linking directly to Alex's existing client file and preserving his assigned advisor.

---

## 12. Troubleshooting Common Issues

### Issue 1: HTTP 401 Unauthorized (`Missing or invalid webhook authentication`)
- **Cause 1**: The secret entered in Typeform does not match the `webhookSecret` of the brokerage.
- **Cause 2**: The `:brokerageId` in the URL path is incorrect or belongs to another brokerage.
- **Cause 3**: Neither `x-webhook-secret` nor an HMAC signature header (`x-signature-sha256`) was sent.
- **Fix**: Check `db.brokerages.findById("<ID>")` in MongoDB to confirm the exact `webhookSecret`. Update Typeform's webhook secret field to match.

### Issue 2: HTTP 400 Bad Request (`Typeform payload missing required email answer`)
- **Cause**: None of the answers in Typeform had an answer of type `email` or a field ref containing `email`.
- **Fix**: Open Typeform. Ensure the email question uses the native **Email** question type or set its field reference (`ref`) to `email`.

### Issue 3: HTTP 403 Forbidden (`Brokerage account is suspended or inactive`)
- **Cause**: The target brokerage has `status: 'SUSPENDED'` or `status: 'TRIAL'` (expired).
- **Fix**: In MongoDB, set `status: 'ACTIVE'` on the brokerage document or reactivate via `/admin/brokerages`.

### Issue 4: HTTP 429 Too Many Requests (`RATE_LIMIT_EXCEEDED`)
- **Cause**: More than 1,000 requests per minute were submitted for this specific brokerage.
- **Fix**: The rate limiter window resets every 60 seconds. In production, 1,000 req/min provides generous headroom for 500-request marketing bursts.

### Issue 5: Typeform Shows "Webhook Failed: Connection Refused / SSL Error"
- **Cause**: The destination URL is using `http://` instead of `https://`, or your local tunnel has expired.
- **Fix**: Typeform requires HTTPS. If testing locally, ensure `cloudflared` or `ngrok` is running and copy the active HTTPS forwarding URL.

### Issue 6: Webhook Returns HTTP 201, but Lead Does Not Appear on Board
- **Cause 1**: The advisor board is currently filtered (e.g., minimum loan threshold filter or search filter active). Click **Reset Filters**.
- **Cause 2**: The advisor is signed in to a different brokerage than the one targeted by `:brokerageId`.
- **Cause 3**: Socket.IO connection is disconnected. Refresh the browser page (`F5`) to fetch the latest state from the database.

---

## 13. End-to-End Verification Checklist

Use this checklist to sign off on the Typeform lead ingestion setup:

- [ ] Target `brokerageId` and `webhookSecret` confirmed in MongoDB.
- [ ] Typeform questionnaire includes an **Email** question (`ref: email`).
- [ ] Typeform questionnaire includes First Name, Last Name, and Phone number.
- [ ] Financial questions configured for `loanAmount`, `propertyValue`, and `monthlyGrossIncome`.
- [ ] Hidden field `utm_source` added under Typeform Logic settings.
- [ ] Webhook URL configured in Typeform: `https://<domain>/api/leads/webhook/<brokerageId>`.
- [ ] Secret entered in Typeform Webhook configuration.
- [ ] Webhook toggled to **On** in Typeform.
- [ ] Test submission sent from Typeform; Typeform reports `200 OK` or `201 Created`.
- [ ] Lead appears live in the **NEW** column on the advisor Kanban board (`/app/pipeline`).
- [ ] Lead drawer displays correct financial KPIs and dynamic Loan-to-Value (`LTV %`).
- [ ] Re-submitting the same form returns `isDuplicate: true` with zero duplicate cards.
- [ ] Submitting with an existing client email flags `knownAs: 'CLIENT'`.
- [ ] Automated welcome email queued and initial outreach task created in `/app/tasks`.

---
*LeadFlow Ingestion Runbook • Version 2.0 • Production Ready*
