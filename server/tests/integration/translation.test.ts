import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { Brokerage, User } from '../../src/models/index.js';
import { tokenService } from '../../src/services/token.service.js';
import { hashPassword } from '../../src/utils/password.js';

describe('POST /api/translate Integration', () => {
  let brokerage: InstanceType<typeof Brokerage>;
  let advisor: InstanceType<typeof User>;
  let advisorToken: string;

  beforeEach(async () => {
    const passwordHash = await hashPassword('TestPass123!');

    brokerage = await Brokerage.create({
      name: 'Apex Home Finance',
      slug: 'apex-home-finance',
      plan: 'GROWTH',
      status: 'ACTIVE',
    });

    advisor = await User.create({
      brokerageId: brokerage._id,
      name: 'Elena Schmidt',
      email: 'elena@apexfinance.in',
      passwordHash,
      role: 'ADVISOR',
      status: 'ACTIVE',
    });

    advisorToken = tokenService.generateAccessToken({
      userId: advisor._id.toString(),
      email: advisor.email,
      role: advisor.role,
      brokerageId: advisor.brokerageId!.toString(),
    });
  });

  it('rejects unauthenticated requests with HTTP 401', async () => {
    const res = await request(app)
      .post('/api/translate')
      .send({ text: 'Hello', targetLang: 'de' });

    expect(res.status).toBe(401);
  });

  it('validates request payload and rejects empty text with HTTP 400', async () => {
    const res = await request(app)
      .post('/api/translate')
      .set('Authorization', `Bearer ${advisorToken}`)
      .send({ text: '', targetLang: 'de' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('validates targetLang and rejects invalid language with HTTP 400', async () => {
    const res = await request(app)
      .post('/api/translate')
      .set('Authorization', `Bearer ${advisorToken}`)
      .send({ text: 'Some text', targetLang: 'fr' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('successfully handles valid translation request and falls back when AI is disabled', async () => {
    const res = await request(app)
      .post('/api/translate')
      .set('Authorization', `Bearer ${advisorToken}`)
      .send({
        text: 'Borrower requested follow up call next Tuesday regarding mortgage rates.',
        targetLang: 'de',
        context: 'lead_note',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.targetLang).toBe('de');
    if (res.body.data.fallback) {
      expect(res.body.data.translatedText).toBe(
        'Borrower requested follow up call next Tuesday regarding mortgage rates.'
      );
    } else {
      expect(res.body.data.isAiTranslated).toBe(true);
      expect(typeof res.body.data.translatedText).toBe('string');
      expect(res.body.data.translatedText.length).toBeGreaterThan(0);
    }
  });

  it('safely handles sensitive customer data by skipping AI and returning original text with warning', async () => {
    const res = await request(app)
      .post('/api/translate')
      .set('Authorization', `Bearer ${advisorToken}`)
      .send({
        text: 'Borrower IBAN is DE89370400440532013000 and temporary password: TempSecret99!',
        targetLang: 'de',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isAiTranslated).toBe(false);
    expect(res.body.data.warning).toContain('Sensitive data pattern detected');
  });

  it('rejects unauthorized CLIENT role with HTTP 403 Forbidden', async () => {
    const clientUser = await User.create({
      brokerageId: brokerage._id,
      name: 'Priya Sharma',
      email: 'priya@example.in',
      passwordHash: advisor.passwordHash,
      role: 'CLIENT',
      status: 'ACTIVE',
    });

    const clientToken = tokenService.generateAccessToken({
      userId: clientUser._id.toString(),
      email: clientUser.email,
      role: clientUser.role,
      brokerageId: clientUser.brokerageId!.toString(),
    });

    const res = await request(app)
      .post('/api/translate')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ text: 'Hello mortgage advisor', targetLang: 'de' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
