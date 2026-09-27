import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { createApp } from '../../src/app.js';
import { Brokerage } from '../../src/models/brokerage.model.js';
import { Lead } from '../../src/models/lead.model.js';

describe('Typeform Webhook Integration', () => {
  const app = createApp();
  let brokerageId: string;
  const webhookSecret = 'whsec_typeform_test_secret_123';

  beforeEach(async () => {
    const brokerage = await Brokerage.create({
      name: 'Apex Home Finance',
      slug: 'apex-home-finance-test-' + Date.now(),
      status: 'ACTIVE',
      webhookSecret,
    });
    brokerageId = brokerage._id.toString();
  });

  it('should accept Typeform webhook with Typeform-Signature and extract lead data correctly', async () => {
    const typeformPayload = {
      event_id: '01M3HZTCX29N6F2KWST0QSZR0B',
      event_type: 'form_response',
      form_response: {
        form_id: 'iXF6fzZi',
        token: 'g9k8mm3sq5odn0t8g9kskhmg8g0ak6wc',
        submitted_at: '2026-09-27T17:50:16Z',
        definition: {
          id: 'iXF6fzZi',
          title: 'leadflow',
          fields: [
            { id: '22oadXbLUgyn', ref: '7d97d1bc-ed8f-4e07-8b1e-6e108282616a', type: 'email', title: 'What is your email address?\n' },
            { id: 'o6D4UudEdRDl', ref: '8686038f-829c-47e7-98bb-c824a3513ac1', type: 'short_text', title: 'What is your full name?\t' },
            { id: 'zev7cUT9Kqku', ref: 'b5dfc55f-c39c-4643-8af9-d91dbca6feb3', type: 'phone_number', title: 'What is your phone number?' },
            { id: 'L5MwbFQuToW2', ref: '2ee0b86f-3795-4574-8a86-5ab949e33bcf', type: 'number', title: 'Target Home Loan Amount (in ₹)?' },
            { id: 'nO6yjwzZgAqW', ref: '757c3647-c37b-4f06-8ff4-75f20ddd2ab7', type: 'number', title: '\tEstimated Property Value (in ₹)?' },
            { id: 'pBbEuO3g4uan', ref: 'c8f32031-fec1-46fb-9e5d-b29238cebd85', type: 'number', title: '\tGross Monthly Income (in ₹)?' },
            { id: 'HlafIZ7c06Sp', ref: '2a6d9370-6f7d-46bb-9456-43a8dfe23eea', type: 'short_text', title: 'Which city are you purchasing in?' }
          ]
        },
        answers: [
          { type: 'email', email: 'kv88790@gmail.com', field: { id: '22oadXbLUgyn', type: 'email', ref: '7d97d1bc-ed8f-4e07-8b1e-6e108282616a' } },
          { type: 'text', text: 'Krishna Vishwakarma', field: { id: 'o6D4UudEdRDl', type: 'short_text', ref: '8686038f-829c-47e7-98bb-c824a3513ac1' } },
          { type: 'phone_number', phone_number: '+919326849614', field: { id: 'zev7cUT9Kqku', type: 'phone_number', ref: 'b5dfc55f-c39c-4643-8af9-d91dbca6feb3' } },
          { type: 'number', number: 2500000, field: { id: 'L5MwbFQuToW2', type: 'number', ref: '2ee0b86f-3795-4574-8a86-5ab949e33bcf' } },
          { type: 'number', number: 3000000, field: { id: 'nO6yjwzZgAqW', type: 'number', ref: '757c3647-c37b-4f06-8ff4-75f20ddd2ab7' } },
          { type: 'number', number: 80000, field: { id: 'pBbEuO3g4uan', type: 'number', ref: 'c8f32031-fec1-46fb-9e5d-b29238cebd85' } },
          { type: 'text', text: 'Navi Mumbai', field: { id: 'HlafIZ7c06Sp', type: 'short_text', ref: '2a6d9370-6f7d-46bb-9456-43a8dfe23eea' } }
        ]
      }
    };

    const rawBody = JSON.stringify(typeformPayload);
    const signature = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('base64');

    const res = await request(app)
      .post(`/api/leads/webhook/${brokerageId}`)
      .set('Content-Type', 'application/json')
      .set('Typeform-Signature', `sha256=${signature}`)
      .send(rawBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('kv88790@gmail.com');
    expect(res.body.data.firstName).toBe('Krishna');
    expect(res.body.data.lastName).toBe('Vishwakarma');
    expect(res.body.data.phone).toBe('+919326849614');

    // Verify stored lead in DB
    const storedLead = await Lead.findOne({ email: 'kv88790@gmail.com', brokerageId });
    expect(storedLead).not.toBeNull();
    const customFieldsObj = Object.fromEntries((storedLead?.customFields as any).entries());
    expect(customFieldsObj).toMatchObject({
      loanAmount: 2500000,
      propertyValue: 3000000,
      monthlyGrossIncome: 80000,
      propertyCity: 'Navi Mumbai',
    });
  });
});
