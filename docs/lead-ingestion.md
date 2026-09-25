# LeadFlow Lead Ingestion Documentation

## 1. Overview
LeadFlow provides a multi-tenant external lead ingestion engine designed to ingest mortgage leads from external web forms, ad platforms (e.g. Meta Lead Ads, Google Ads), booking tools, and partner links.

The ingestion layer implements:
- Webhook signature verification and secret-based authentication.
- Strict tenant isolation enforced at the route and service levels.
- Resilient normalization supporting both standard JSON webhooks and external providers (Typeform).
- Deterministic duplicate detection scoped by brokerage `{ brokerageId: 1, email: 1 }`.
- Idempotent repeated delivery handling with zero duplicate record creation.
- Architecture ready for high-volume queueing (BullMQ in future phases).

---

## 2. Ingestion Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/leads/webhook/:brokerageId` | Primary external webhook ingestion endpoint. |
| `POST` | `/api/leads/ingest/:brokerageId` | Endpoint alias for partner integrations and CRM webhooks. |

### Path Parameters
- `brokerageId` *(string, required)*: The 24-character hexadecimal MongoDB ObjectId of the target brokerage.

---

## 3. Webhook Authentication

All incoming ingestion requests must authenticate against the target brokerage's credentials. Two authentication schemes are supported:

### 3.1 Webhook Secret Header (Standard)
The caller provides the secret key in the `x-webhook-secret` header or as a Bearer token:
```http
POST /api/leads/webhook/650c1f1e8a9d2c001f3e4a5b HTTP/1.1
Host: api.leadflow.com
Content-Type: application/json
x-webhook-secret: your_brokerage_webhook_secret_here
```
Or via Bearer authorization:
```http
Authorization: Bearer your_brokerage_webhook_secret_here
```

### 3.2 HMAC SHA-256 Signature Verification (Typeform / Webhook Providers)
For providers that sign payloads using HMAC SHA-256:
- Header: `x-signature-sha256` or `x-hub-signature-256`
- Format: `sha256=<hex_digest>`
- The digest is computed as:
  ```typescript
  crypto.createHmac('sha256', brokerage.webhookSecret).update(rawPayload).digest('hex')
  ```
- Checked using constant-time comparison (`crypto.timingSafeEqual`) to prevent timing side-channel attacks.

---

## 4. Supported Ingestion Payload Formats

### 4.1 Standard LeadFlow Webhook Format
```json
{
  "firstName": "Hans",
  "lastName": "Schmidt",
  "email": "hans.schmidt@example.de",
  "phone": "+49 170 1234567",
  "source": "WEBSITE",
  "score": 75,
  "notes": "Looking for financing on Munich residential apartment (approx. 450,000 EUR)",
  "customFields": {
    "propertyPrice": 450000,
    "downPayment": 90000,
    "residencyStatus": "EU_BLUE_CARD"
  }
}
```

### 4.2 Documented External Provider: Typeform Webhook Format
Typeform webhook payloads (`event_type: "form_response"`) are automatically recognized and normalized:
```json
{
  "event_id": "01HG4Z7K99M0X",
  "event_type": "form_response",
  "form_response": {
    "form_id": "german_mortgage_inquiry",
    "submitted_at": "2026-09-25T12:00:00Z",
    "answers": [
      {
        "field": { "id": "first_name", "type": "text" },
        "type": "text",
        "text": "Erika"
      },
      {
        "field": { "id": "last_name", "type": "text" },
        "type": "text",
        "text": "Mustermann"
      },
      {
        "field": { "id": "email_input", "type": "email" },
        "type": "email",
        "email": "erika.mustermann@example.de"
      },
      {
        "field": { "id": "phone_input", "type": "phone_number" },
        "type": "phone_number",
        "phone_number": "+4989123456"
      },
      {
        "field": { "id": "loan_amount", "type": "number" },
        "type": "number",
        "number": 500000
      }
    ],
    "hidden": {
      "utm_source": "google_ads"
    }
  }
}
```
**Normalization behavior for Typeform**:
- Email is extracted from answers of type `email` or with field IDs matching `email`.
- First and last names are extracted from dedicated name fields or split from a full name field.
- Hidden UTM tags (`utm_source`) map automatically to domain `LeadSource` (`CAMPAIGN`, `WEBSITE`, etc.).
- All original answers and metadata are preserved in `customFields` for full fidelity.

---

## 5. Deduplication, Idempotency & "Already Known" Detection

1. **Brokerage-Scoped Identity Key**:
   Leads are deduplicated on `{ brokerageId: 1, email: 1 }`.
2. **Safe Idempotent Delivery**:
   - When a webhook is delivered for a new email, a new lead is created with starting status `NEW` and the endpoint responds with HTTP **201 Created** (`isDuplicate: false`).
   - When the same webhook is redelivered (e.g. network retry or repeated submission by the same person), the existing lead record is resolved and returned with HTTP **200 OK** (`isDuplicate: true`), without creating duplicate records or modifying pipeline states.
3. **"Already Known" Person Detection (Client Linking)**:
   - When an incoming lead's normalized email matches an existing `Client` within the same brokerage:
     - The lead is marked as an already-known person (`isAlreadyKnown: true`, `knownAs: 'CLIENT'`).
     - The client's MongoDB ID is attached (`existingClientId`).
     - The lead automatically inherits the existing client's assigned advisor (`assignedTo`), ensuring continuous advisor case context.
     - Custom fields record `{ alreadyKnown: true, knownAs: 'CLIENT', existingClientId }`.
     - API returns HTTP **201 Created** with `{ isDuplicate: false, isAlreadyKnown: true, knownAs: 'CLIENT', existingClientId }`.
4. **Concurrency & Race Condition Absorption**:
   - Under heavy concurrent load (e.g. 10+ webhooks delivered at the exact same millisecond with identical emails), MongoDB's unique compound index throws code `11000` (duplicate key error).
   - `LeadRepository.ingestLead` catches code `11000`, cleanly retrieves the concurrent lead, and returns `{ lead, isDuplicate: true, isAlreadyKnown: true, knownAs: 'LEAD' }` without throwing a 500 internal server error.
5. **Cross-Tenant Tolerance**:
   - In accordance with LeadFlow multi-tenancy rules, independent brokerages can both have a lead or client with the same email (`expat@example.de`) without conflict or cross-tenant visibility.

---

## 6. Webhook Security & Anti-Enumeration Hardening

- **Anti-Enumeration Defense**:
  - Unauthenticated callers probing `/api/leads/webhook/:brokerageId` without credentials receive a uniform HTTP **401 Unauthorized** without database execution, completely concealing whether the brokerage ID exists or is active/suspended.
  - Probing non-existent brokerage IDs with invalid credentials also returns HTTP **401 Unauthorized** (using constant-time comparison against a dummy secret) to eliminate oracle attacks.
  - Only callers presenting the verified secret of a suspended brokerage receive HTTP **403 Forbidden**.
- **No Client `brokerageId` Trust**: Any `brokerageId` passed inside the request body payload is stripped and discarded during normalization. Tenant ownership is strictly derived from the authenticated route context (`req.webhookBrokerage._id`).
- **Timing Attack Resistance**: Webhook secrets and HMAC signatures are compared using `crypto.timingSafeEqual`.
- **Tenant-Aware Rate Limiting & High-Volume Headroom**:
  - Ingestion routes enforce a tenant-aware rate limiter (`brokerageIngestionLimiter`) of **1,000 requests per minute per verified brokerage**, providing generous headroom for the assignment's explicit 500 req/min burst scenario.
  - Placed *after* `verifyWebhookAuth`, keying strictly on `req.webhookBrokerage._id`.
  - Unauthenticated traffic never consumes a brokerage's rate-limit quota.
  - Noisy Brokerage A exhausting its quota receives HTTP **429 Too Many Requests** (`RATE_LIMIT_EXCEEDED`) and cannot throttle Brokerage B, even when webhook deliveries share the same provider egress IP (e.g. Typeform or Zapier).
- **PII Privacy & Observability**: Structured logs mask email addresses (e.g. `t***s@example.de`) and omit phone numbers, custom fields, and credentials.
- **Queue Readiness**: Designed for seamless delegation to BullMQ worker jobs in Phase 7 without changing endpoint contracts or schemas.
