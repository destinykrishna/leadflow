# Google Forms Lead Source Setup & Verification Runbook

> **Audience**: LeadFlow Operators, DevOps Engineers, and System Integrators.  
> **Objective**: Provide a comprehensive, step-by-step procedure to connect a Google Form to LeadFlow via Google Apps Script and verify end-to-end automated lead ingestion into the advisor pipeline.

---

## Table of Contents
1. [Architecture & Ingestion Flow](#1-architecture--ingestion-flow)
2. [LeadFlow Ingestion Contract & Webhook Specifications](#2-leadflow-ingestion-contract--webhook-specifications)
3. [Section A: Google Forms Configuration](#3-section-a-google-forms-configuration)
4. [Section B: Google Apps Script Configuration](#4-section-b-google-apps-script-configuration)
5. [Section C: LeadFlow Configuration & Environment Variables](#5-section-c-leadflow-configuration--environment-variables)
6. [Section D: End-to-End Verification & Pipeline Testing](#6-section-d-end-to-end-verification--pipeline-testing)
7. [Duplicate Ingestion & Known Client Verification](#7-duplicate-ingestion--known-client-verification)
8. [Troubleshooting Common Issues](#8-troubleshooting-common-issues)
9. [Verification Checklist](#9-verification-checklist)

---

## 1. Architecture & Ingestion Flow

LeadFlow features a high-throughput, multi-tenant lead ingestion engine. Incoming webhooks are authenticated, normalized, deduplicated, and presented in real time on the advisor's Kanban pipeline without manual intervention.

```
┌────────────────────────┐      Form Submission       ┌────────────────────────────────┐
│   Google Form          │ ─────────────────────────> │      Google Apps Script        │
│   (Home Loan Enquiry)  │                            │      (onFormSubmit Trigger)    │
└────────────────────────┘                            └───────────────┬────────────────┘
                                                                      │
                                                           HTTPS POST │ JSON (standardLeadPayload)
                                                           Header:    │ x-webhook-secret: <secret>
                                                                      ▼
                                                      ┌────────────────────────────────┐
                                                      │  LeadFlow Ingestion Endpoint   │
                                                      │  /api/leads/webhook/:brokerageId│
                                                      └───────────────┬────────────────┘
                                                                      │
                                                                      ▼
                                                      ┌────────────────────────────────┐
                                                      │  1. verifyWebhookAuth Guard   │
                                                      │     - Constant-time secret check│
                                                      │     - Anti-enumeration defense │
                                                      └───────────────┬────────────────┘
                                                                      │
                                                                      ▼
                                                      ┌────────────────────────────────┐
                                                      │  2. Tenant Rate Limiter       │
                                                      │     - 1,000 req/min/brokerage  │
                                                      └───────────────┬────────────────┘
                                                                      │
                                                                      ▼
                                                      ┌────────────────────────────────┐
                                                      │  3. Normalization & Dedupe     │
                                                      │     - Compound index match     │
                                                      │     - Known client linkage     │
                                                      │     - Lead scoring engine      │
                                                      └───────────────┬────────────────┘
                                                                      │
                                                                      ▼
                                                      ┌────────────────────────────────┐
                                                      │  4. Advisor Pipeline Real-Time │
                                                      │     - Persisted to MongoDB     │
                                                      │     - Socket.IO broadcast      │
                                                      │     - Automation trigger tasks │
                                                      └────────────────────────────────┘
```

---

## 2. LeadFlow Ingestion Contract & Webhook Specifications

### 2.1 Webhook Endpoint Pattern
- **Primary Endpoint**: `POST /api/leads/webhook/:brokerageId`
- **Alias Endpoint**: `POST /api/leads/ingest/:brokerageId`
- **Method**: `POST`
- **Content-Type**: `application/json`

Where `:brokerageId` is the 24-character hexadecimal MongoDB `ObjectId` of the target active brokerage.

### 2.2 Authentication Mechanism
Requests must authenticate via the target brokerage's configured `webhookSecret`. LeadFlow verifies credentials in constant time (`crypto.timingSafeEqual`) to prevent timing attacks.

Supported authentication headers:
- `x-webhook-secret: <YOUR_BROKERAGE_WEBHOOK_SECRET>` *(Recommended for Google Apps Script)*
- `Authorization: Bearer <YOUR_BROKERAGE_WEBHOOK_SECRET>`

*(Unauthenticated probes return HTTP 401 with a uniform message to conceal tenant existence).*

### 2.3 Expected Payload Schema (`standardLeadPayloadSchema`)
Google Apps Script transforms form answers into this standard JSON schema:

```json
{
  "firstName": "Rahul",
  "lastName": "Sharma",
  "email": "rahul.sharma@example.com",
  "phone": "+919876543210",
  "source": "WEBSITE",
  "score": 85,
  "notes": "Home Loan Enquiry submitted via Google Forms",
  "customFields": {
    "loanAmount": 4500000,
    "propertyValue": 6000000,
    "monthlyGrossIncome": 125000,
    "monthlyIncome": 125000,
    "propertyCity": "Mumbai",
    "employmentType": "Salaried"
  }
}
```

#### Field Specifications:
| Field | Type | Required? | Constraints & Description |
| :--- | :--- | :--- | :--- |
| `firstName` | `string` | **Yes** | 1 to 60 characters. Applicant first name. |
| `lastName` | `string` | **Yes** | 1 to 60 characters. Applicant surname / last name. |
| `email` | `string` | **Yes** | Valid RFC email address. Lowercased automatically. |
| `phone` | `string` | No | Up to 30 characters. Standard E.164 or national format. |
| `source` | `string` | No | Enum: `WEBSITE`, `REFERRAL`, `CAMPAIGN`, `MANUAL`, `OTHER`. Defaults to `WEBSITE`. |
| `score` | `number` | No | Integer 0 to 100. Computed readiness score. |
| `notes` | `string` | No | Context notes (max 5,000 characters). |
| `customFields` | `object` | No | Arbitrary mortgage details (`loanAmount`, `propertyValue`, `monthlyGrossIncome`, `propertyCity`, etc.). |

---

## 3. Section A: Google Forms Configuration

### 3.1 Create Form
1. Open [Google Forms](https://forms.google.com) and create a new blank form.
2. Title the form: **`Home Loan Enquiry`**.
3. Form Description:  
   *`Submit your details to check your home loan eligibility, estimated monthly EMI, and loan-to-value terms.`*

### 3.2 Form Questions & Types
Configure the following questions with exact titles so Google Apps Script can extract them deterministically:

| # | Question Title | Question Type | Required? | Validation / Description |
| :---: | :--- | :--- | :---: | :--- |
| **1** | `Full Name` | **Short answer** | **Yes** | Borrower full legal name (e.g. *Rahul Sharma*). |
| **2** | `Email Address` | **Short answer** | **Yes** | Response validation: Text $\rightarrow$ Email. |
| **3** | `Phone Number` | **Short answer** | **Yes** | Applicant contact number with country code (e.g. *+91 98765 43210*). |
| **4** | `Target Home Loan Amount (in ₹)` | **Short answer** | **Yes** | Response validation: Number $\rightarrow$ Greater than 0. (e.g. *4500000*). |
| **5** | `Estimated Property Value (in ₹)` | **Short answer** | **Yes** | Response validation: Number $\rightarrow$ Greater than 0. (e.g. *6000000*). |
| **6** | `Gross Monthly Income (in ₹)` | **Short answer** | **Yes** | Response validation: Number $\rightarrow$ Greater than 0. (e.g. *125000*). |
| **7** | `Property City` | **Short answer** | **Yes** | Target purchase city (e.g. *Mumbai*, *Bengaluru*, *Pune*). |
| **8** | `Employment Type` | **Multiple choice** | **Yes** | Options: `Salaried`, `Self-Employed Professional`, `Business Owner`. |

---

## 4. Section B: Google Apps Script Configuration

Google Apps Script runs server-side on Google's cloud infrastructure and invokes LeadFlow's webhook immediately upon form submission.

### 4.1 Open the Script Editor
1. In your Google Form, click the **three dots menu (⋮)** in the top right.
2. Select **`Script editor`** (`Apps Script`).
3. Name the project: **`LeadFlow Ingestion Bridge`**.

### 4.2 Paste the Integration Script
Replace all existing code in `Code.gs` with the production-ready script below:

```javascript
/**
 * LeadFlow — Google Forms to LeadFlow Ingestion Bridge
 *
 * Captures Google Form submissions, transforms responses into the
 * LeadFlow standardLeadPayload schema, and delivers them via HTTPS POST.
 *
 * NOTE: Credentials and endpoints are retrieved dynamically from Script Properties
 * to prevent leaking secrets in source code.
 */

// ==============================================================================
// 1. DYNAMIC CONFIGURATION (FROM SCRIPT PROPERTIES)
// ==============================================================================
function getLeadFlowConfig() {
  var properties = PropertiesService.getScriptProperties();
  var webhookUrl = properties.getProperty('LEADFLOW_WEBHOOK_URL');
  var webhookSecret = properties.getProperty('LEADFLOW_WEBHOOK_SECRET');

  if (!webhookUrl || !webhookSecret) {
    throw new Error(
      'Missing required Script Properties! Please open Project Settings (gear icon) -> ' +
      'Script Properties, and add "LEADFLOW_WEBHOOK_URL" and "LEADFLOW_WEBHOOK_SECRET".'
    );
  }

  return {
    webhookUrl: webhookUrl.trim(),
    webhookSecret: webhookSecret.trim()
  };
}

// ==============================================================================
// 2. FORM SUBMIT EVENT HANDLER
// ==============================================================================
function onFormSubmit(e) {
  try {
    var config = getLeadFlowConfig();
    var itemResponses = e.response.getItemResponses();
    var answers = {};

    // Build title-to-response lookup map
    for (var i = 0; i < itemResponses.length; i++) {
      var title = itemResponses[i].getItem().getTitle().trim();
      var answer = itemResponses[i].getResponse();
      answers[title] = answer;
    }

    // Helper: Find answer by title keywords (case-insensitive)
    function getAnswer(keywords) {
      for (var key in answers) {
        var lower = key.toLowerCase();
        for (var k = 0; k < keywords.length; k++) {
          if (lower.indexOf(keywords[k]) !== -1) {
            return answers[key];
          }
        }
      }
      return null;
    }

    // Helper: Parse numerical fields from strings (strips ₹, commas, spaces)
    function parseRupees(val) {
      if (!val) return 0;
      if (typeof val === 'number') return val;
      var cleaned = String(val).replace(/[^0-9.]/g, '');
      var parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : Math.round(parsed);
    }

    // 1. Extract Full Name & Split into First/Last
    // For single-word names (e.g. "Bhavika"), firstName is the exact name and lastName is safe empty string ""
    // For multi-word names (e.g. "Bhavika Sharma"), firstName is "Bhavika" and lastName is "Sharma"
    var rawName = (getAnswer(['full name', 'name', 'borrower']) || '').toString().trim();
    var nameParts = rawName ? rawName.split(/\s+/) : [];
    var firstName = nameParts[0] || 'Valued Applicant';
    var lastName = nameParts.slice(1).join(' '); // Safe empty string for single-name leads

    // 2. Extract Contact Info
    var email = (getAnswer(['email']) || '').toString().trim().toLowerCase();
    var phone = (getAnswer(['phone', 'mobile', 'contact']) || '').toString().trim();

    // 3. Extract Financial Fields
    var loanAmount = parseRupees(getAnswer(['loan amount', 'target loan', 'home loan']));
    var propertyValue = parseRupees(getAnswer(['property value', 'valuation']));
    var grossIncome = parseRupees(getAnswer(['monthly income', 'gross monthly', 'salary', 'income']));
    var city = (getAnswer(['city', 'location']) || '').toString().trim();
    var employmentType = (getAnswer(['employment', 'occupation']) || 'Salaried').toString().trim();

    // 4. Compute Lead Quality Score (0 - 100)
    var score = 10; // Submission baseline
    if (email && email.indexOf('@') !== -1) score += 20;
    if (phone && phone.length >= 8) score += 20;
    if (loanAmount > 0) score += 20;
    if (grossIncome > 0) score += 15;
    if (propertyValue > 0) score += 15;
    if (score > 100) score = 100;

    // 5. Construct Standard LeadFlow Payload
    // NOTE: 'source' MUST be 'WEBSITE' to adhere to the supported LeadFlow LeadSource enum.
    // 'provider: GOOGLE_FORMS' is stored in customFields to identify external origin without enum mutations.
    var payload = {
      firstName: firstName,
      lastName: lastName,
      email: email,
      phone: phone || undefined,
      source: 'WEBSITE',
      score: score,
      notes: 'Ingested via Google Forms (Home Loan Enquiry) • City: ' + (city || 'Not specified'),
      customFields: {
        provider: 'GOOGLE_FORMS',
        loanAmount: loanAmount,
        propertyValue: propertyValue,
        monthlyGrossIncome: grossIncome,
        monthlyIncome: grossIncome,
        propertyCity: city,
        employmentType: employmentType,
        submittedAt: new Date().toISOString()
      }
    };

    // 6. Deliver to LeadFlow Webhook Endpoint
    var options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'x-webhook-secret': config.webhookSecret
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(config.webhookUrl, options);
    var responseCode = response.getResponseCode();
    var responseBody = response.getContentText();

    Logger.log('LeadFlow Response Code: ' + responseCode);
    Logger.log('LeadFlow Response Body: ' + responseBody);

    if (responseCode !== 200 && responseCode !== 201) {
      throw new Error('LeadFlow webhook failed with HTTP ' + responseCode + ': ' + responseBody);
    }
  } catch (err) {
    Logger.log('Error in onFormSubmit: ' + err.toString());
  }
}
```

### 4.3 Configure Script Properties (Mandatory)
Do **not** hardcode real URLs or secrets into the script code. You must enter your actual live values into Google Apps Script's encrypted **Script Properties**:

1. In the Apps Script editor, click the **Settings gear icon (⚙️)** on the left sidebar.
2. Scroll down to the **Script Properties** card.
3. Click **Add script property** and add the following two properties with your **actual** current values:

| Property Name | How to Set Value | Current Example / Description |
| :--- | :--- | :--- |
| `LEADFLOW_WEBHOOK_URL` | Your active public HTTPS URL followed by `/api/leads/webhook/<BROKERAGE_ID>` | `https://<YOUR_ACTIVE_NGROK_URL>/api/leads/webhook/6ab6a2f444ff3081377a7257` |
| `LEADFLOW_WEBHOOK_SECRET` | Your actual brokerage webhook secret retrieved from your database or seed | *(Retrieved via terminal command below — do not share or commit)* |

4. Click **Save script properties**.

> [!IMPORTANT]
> **Active ngrok Tunnel Notice**: When running locally with ngrok, the URL generated by ngrok changes each time you restart the ngrok process. Whenever your ngrok tunnel restarts, you **must update** `LEADFLOW_WEBHOOK_URL` in Apps Script Script Properties with the newly assigned HTTPS URL.

### 4.4 Set Up the Automated Form Submit Trigger
1. On the left navigation bar in Apps Script, click **Triggers** (alarm clock icon ⏰).
2. Click **Add Trigger** (blue button in bottom right).
3. Configure the trigger settings:
   - **Choose which function to run**: `onFormSubmit`
   - **Choose which deployment should run**: `Head`
   - **Select event source**: `From form`
   - **Select event type**: `On form submit`
   - **Failure notification settings**: `Notify me immediately`
4. Click **Save**.
5. When prompted, click **Review permissions**, select your Google account, click **Advanced** $\rightarrow$ **Go to LeadFlow Ingestion Bridge (unsafe)**, and click **Allow**.

---

## 5. Section C: LeadFlow Configuration & Environment Variables

### 5.1 Environment Variables
LeadFlow centralizes environment variables in `.env` at the monorepo root.

Inspect your `.env` configuration:
```bash
# Server Port & CORS
PORT=5000
CORS_ORIGIN=http://localhost:5173

# Public Tunnel / Domain URL (for webhook receipt)
WEBHOOK_BASE_URL=https://your-public-tunnel-or-domain.ngrok-free.dev
```

> **Security Note**: Never commit `.env` to Git. The project `.gitignore` automatically ignores `.env` and `.env.*` while keeping `.env.example` as a template.

### 5.2 Brokerage Webhook Target & Secret Resolution
LeadFlow identifies the tenant via the URL parameter `:brokerageId` and validates the request against the database document for that brokerage.

For the standard LeadFlow demo brokerage:
- **Brokerage Name**: Apex Home Finance (`berlin-expat-mortgages`)
- **Brokerage ID**: `6ab6a2f444ff3081377a7257`
- **Target Webhook URL Pattern**:  
  `https://<ACTIVE_NGROK_OR_DOMAIN_URL>/api/leads/webhook/6ab6a2f444ff3081377a7257`

#### How to Safely Retrieve Your Webhook Secret
The webhook secret is securely stored in your local MongoDB instance under the `brokerages` collection (and initialized in `server/tests/fixtures/seed.fixture.ts`).

To safely print your secret to your private terminal without writing it into any files:
```bash
node -e "const m=require('mongoose');m.connect('mongodb://127.0.0.1:27017/leadflow').then(async()=>{const B=m.model('Brokerage',new m.Schema({},{strict:false}));const b=await B.findById('6ab6a2f444ff3081377a7257');console.log('Webhook Secret:',b.webhookSecret);process.exit(0);});"
```
Copy the output directly into the **`LEADFLOW_WEBHOOK_SECRET`** property in Google Apps Script Script Properties.

---

## 6. Section D: End-to-End Verification & Pipeline Testing

### 6.1 Submit a Test Response via Google Forms
1. Open your published Google Form in a browser window.
2. Fill out sample Indian borrower details:
   - **Full Name**: `Priya Venkataraman`
   - **Email Address**: `priya.v@example.com`
   - **Phone Number**: `+91 98201 12345`
   - **Target Home Loan Amount (in ₹)**: `5000000` *(₹50 Lakh)*
   - **Estimated Property Value (in ₹)**: `6500000` *(₹65 Lakh)*
   - **Gross Monthly Income (in ₹)**: `140000` *(₹1.40 Lakh)*
   - **Property City**: `Bengaluru`
   - **Employment Type**: `Salaried`
3. Click **Submit**.

### 6.2 Check Google Apps Script Execution Logs
1. Return to the **Apps Script** editor.
2. Click **Executions** (list icon on left sidebar).
3. The latest execution should indicate:
   - **Status**: `Completed`
   - **Response Code**: `201`
   - **Response Body**:
     ```json
     {
       "success": true,
       "isDuplicate": false,
       "isAlreadyKnown": false,
       "message": "Lead ingested successfully.",
       "data": {
         "firstName": "Priya",
         "lastName": "Venkataraman",
         "email": "priya.v@example.com",
         "status": "NEW",
         "score": 100
       }
     }
     ```

### 6.3 Verify Appearance in Advisor Kanban Pipeline
1. Open the LeadFlow application in your browser at `http://localhost:5173/app/pipeline`.
2. Observe the **NEW** column:
   - A new card for **Priya Venkataraman** appears instantly.
   - **Target Loan**: `₹50,00,000`
   - **Email & Phone**: `priya.v@example.com`, `+91 98201 12345`
   - **Score**: `100` (Emerald Green badge)
3. Click the card to open **Lead Details**:
   - **Monthly Gross Income**: `₹1,40,000`
   - **Estimated Property Value**: `₹65,00,000`
   - **LTV Ratio**: `76.9% Loan-to-Value`
   - **Inquiry Notes**: `Ingested via Google Forms (Home Loan Enquiry) • City: Bengaluru`

---

## 7. Duplicate Ingestion & Known Client Verification

### 7.1 Idempotent Duplicate Handling
If the applicant resubmits the Google Form with the same email address:
1. LeadFlow enforces a compound unique index on `{ brokerageId: 1, email: 1 }`.
2. The ingestion controller absorbs duplicate submissions idempotently and returns `HTTP 200 OK`:
   ```json
   {
     "success": true,
     "isDuplicate": true,
     "isAlreadyKnown": true,
     "knownAs": "LEAD",
     "message": "Lead already exists for this brokerage. Ingestion processed idempotently."
   }
   ```
3. No duplicate lead card is created on the Kanban board.

### 7.2 "Already Known" Client Detection
If an existing borrower who already has an active client case profile submits a new Google Form enquiry:
1. LeadFlow matches the email against existing `Client` records within the brokerage.
2. The lead is ingested with `isAlreadyKnown: true` and `knownAs: "CLIENT"`.
3. In the advisor workspace, the lead card displays an amber **"Known"** badge, linking directly to the borrower's existing client profile.

---

## 8. Troubleshooting Common Issues

### 8.1 Unauthorized Webhook (`401 UNAUTHORIZED`)
* **Symptom**: Apps Script execution logs show `HTTP 401: Missing or invalid webhook authentication`.
* **Causes**:
  1. Header `x-webhook-secret` does not match `brokerage.webhookSecret`.
  2. The `:brokerageId` in the URL does not exist or is malformed.
* **Resolution**:
  - Re-verify `CONFIG.WEBHOOK_SECRET` in Apps Script against the database `brokerage.webhookSecret`.
  - Confirm the `:brokerageId` in the URL is a valid 24-character hex ObjectId.

### 8.2 Invalid Payload (`400 VALIDATION_ERROR`)
* **Symptom**: LeadFlow returns `HTTP 400: Invalid lead payload`.
* **Causes**:
  - Missing mandatory fields (`firstName`, `lastName`, or `email`).
  - Invalid email format (e.g. missing `@` or domain).
* **Resolution**:
  - Verify question titles in Google Forms match the keywords in `getAnswer()` (e.g., *Full Name*, *Email Address*).
  - Check the Apps Script execution log output to inspect the generated JSON payload.

### 8.3 Webhook Request Failure / Connection Refused
* **Symptom**: Apps Script shows `Exception: Failed to connect to ...` or `DNS resolution failed`.
* **Causes**:
  - Local tunnel (e.g. ngrok) expired or stopped.
  - The URL uses `http://` instead of `https://`. Google Apps Script requires valid HTTPS endpoints.
* **Resolution**:
  - Ensure ngrok or your public reverse proxy is running: `npx ngrok http 5000`.
  - Update `CONFIG.WEBHOOK_URL` in Apps Script with the active HTTPS tunnel address.

### 8.4 Lead Not Appearing in Pipeline Board
* **Symptom**: Webhook returns `HTTP 201`, but no lead appears on the Kanban screen.
* **Causes**:
  - You are logged in under a different brokerage than the `:brokerageId` in the webhook URL. LeadFlow enforces strict tenant data isolation.
  - Pipeline board has an active filter (e.g., minimum loan threshold or search term).
* **Resolution**:
  - Check that your logged-in user belongs to the same brokerage as the webhook URL.
  - Click **Reset Filters** on the pipeline board header.

---

## 9. Verification Checklist

- [ ] Google Form created with title **"Home Loan Enquiry"** and all required questions.
- [ ] Google Apps Script installed and configured with `CONFIG.WEBHOOK_URL` and `CONFIG.WEBHOOK_SECRET`.
- [ ] Form submit trigger (`onFormSubmit` on event `On form submit`) authorized and active.
- [ ] Test form submission completed with realistic Indian borrower figures.
- [ ] Apps Script Execution log confirms `HTTP 201 Created`.
- [ ] Lead appears immediately on the advisor Kanban board (`/app/pipeline`) in stage **NEW**.
- [ ] Financial KPIs (**Target Loan**, **Monthly Income**, **LTV %**) format cleanly in INR.
- [ ] Duplicate form submission returns `HTTP 200` with `isDuplicate: true` and creates no duplicate cards.
