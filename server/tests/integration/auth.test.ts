import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { Brokerage, User, Session } from '../../src/models/index.js';
import { hashPassword, hashToken } from '../../src/utils/password.js';

describe('Authentication API Integration Tests', () => {
  const DEFAULT_PASSWORD = 'TestPassword123!';
  let passwordHash: string;
  let testBrokerage: InstanceType<typeof Brokerage>;

  let platformAdmin: InstanceType<typeof User>;
  let brokerageAdmin: InstanceType<typeof User>;
  let advisor: InstanceType<typeof User>;
  let clientUser: InstanceType<typeof User>;

  beforeEach(async () => {
    passwordHash = await hashPassword(DEFAULT_PASSWORD);

    // Create test brokerage
    testBrokerage = await Brokerage.create({
      name: 'Berlin Expat Mortgages GmbH',
      slug: 'berlin-expat-mortgages',
      plan: 'GROWTH',
      status: 'ACTIVE',
    });

    // 1. Platform Admin (Platform level, no brokerageId)
    platformAdmin = await User.create({
      name: 'System Superadmin',
      email: 'admin@leadflow-platform.com',
      passwordHash,
      role: 'PLATFORM_ADMIN',
      status: 'ACTIVE',
    });

    // 2. Brokerage Admin
    brokerageAdmin = await User.create({
      brokerageId: testBrokerage._id,
      name: 'Klaus Mueller',
      email: 'klaus@berlin-expat.de',
      passwordHash,
      role: 'BROKERAGE_ADMIN',
      status: 'ACTIVE',
    });

    // 3. Advisor
    advisor = await User.create({
      brokerageId: testBrokerage._id,
      name: 'Elena Schmidt',
      email: 'elena@berlin-expat.de',
      passwordHash,
      role: 'ADVISOR',
      status: 'ACTIVE',
    });

    // 4. Client
    clientUser = await User.create({
      brokerageId: testBrokerage._id,
      name: 'Alex Expat',
      email: 'alex@expatmail.de',
      passwordHash,
      role: 'CLIENT',
      status: 'ACTIVE',
    });
  });

  describe('POST /api/auth/login', () => {
    it('should successfully log in PLATFORM_ADMIN with null brokerageId', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: platformAdmin.email,
          password: DEFAULT_PASSWORD,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.role).toBe('PLATFORM_ADMIN');
      expect(res.body.data.user.brokerageId).toBeNull();
      expect(res.body.data.user.email).toBe(platformAdmin.email);
      expect(res.body.data.accessToken).toBeDefined();

      // Check HTTP-only cookie
      const cookies = res.headers['set-cookie'] as unknown as string[];
      expect(cookies).toBeDefined();
      expect(cookies.some((c) => c.includes('refreshToken=') && c.includes('HttpOnly'))).toBe(true);
    });

    it('should successfully log in BROKERAGE_ADMIN with brokerageId scoping', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: brokerageAdmin.email,
          password: DEFAULT_PASSWORD,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.role).toBe('BROKERAGE_ADMIN');
      expect(res.body.data.user.brokerageId).toBe(testBrokerage._id.toString());
      expect(res.body.data.accessToken).toBeDefined();
    });

    it('should successfully log in ADVISOR with brokerageId scoping', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: advisor.email,
          password: DEFAULT_PASSWORD,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.role).toBe('ADVISOR');
      expect(res.body.data.user.brokerageId).toBe(testBrokerage._id.toString());
      expect(res.body.data.accessToken).toBeDefined();
    });

    it('should successfully log in CLIENT with brokerageId scoping', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: clientUser.email,
          password: DEFAULT_PASSWORD,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.role).toBe('CLIENT');
      expect(res.body.data.user.brokerageId).toBe(testBrokerage._id.toString());
      expect(res.body.data.accessToken).toBeDefined();
    });

    it('should reject login with invalid password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: advisor.email,
          password: 'CompletelyWrongPassword!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toMatch(/invalid credentials/i);
    });

    it('should reject login with non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@nowhere.com',
          password: DEFAULT_PASSWORD,
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject malformed email or missing password with 400 validation error', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'not-an-email',
          password: '',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should allow login specifying brokerageSlug when email is disambiguated', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: advisor.email,
          password: DEFAULT_PASSWORD,
          brokerageSlug: 'berlin-expat-mortgages',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe('ADVISOR');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should rotate refresh token via HTTP-only cookie and return new access token', async () => {
      // 1. Initial login
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: advisor.email,
          password: DEFAULT_PASSWORD,
        });

      const initialCookie = loginRes.headers['set-cookie'] as unknown as string[];
      expect(initialCookie).toBeDefined();

      // 2. Call refresh using the cookie
      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', initialCookie);

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.success).toBe(true);
      expect(refreshRes.body.data.accessToken).toBeDefined();

      const newCookie = refreshRes.headers['set-cookie'];
      expect(newCookie).toBeDefined();
      expect(newCookie).not.toEqual(initialCookie);
    });

    it('should rotate refresh token supplied in request body', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: advisor.email,
          password: DEFAULT_PASSWORD,
        });

      // Extract raw refresh token from cookie
      const cookieHeader = (loginRes.headers['set-cookie'] as string[] | undefined)?.[0] ?? '';
      const match = cookieHeader.match(/refreshToken=([^;]+)/);
      const rawRefreshToken = match ? decodeURIComponent(match[1] ?? '') : '';

      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: rawRefreshToken });

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.data.accessToken).toBeDefined();
    });

    it('should reject refresh without token with 401', async () => {
      const res = await request(app).post('/api/auth/refresh').send({});
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should detect refresh token reuse attack and revoke session family', async () => {
      // 1. Login
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: advisor.email,
          password: DEFAULT_PASSWORD,
        });

      const cookieHeader = (loginRes.headers['set-cookie'] as string[] | undefined)?.[0] ?? '';
      const match = cookieHeader.match(/refreshToken=([^;]+)/);
      const initialRefreshToken = match ? decodeURIComponent(match[1] ?? '') : '';

      // 2. Legitimate refresh
      const firstRefresh = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: initialRefreshToken });
      expect(firstRefresh.status).toBe(200);

      // 3. Attacker replays initialRefreshToken
      const reuseAttempt = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: initialRefreshToken });

      expect(reuseAttempt.status).toBe(401);
      expect(reuseAttempt.body.error.message).toMatch(/token reuse detected/i);

      // 4. Subsequent refresh by legitimate client with newest token must also fail
      const cookieHeader2 = (firstRefresh.headers['set-cookie'] as string[] | undefined)?.[0] ?? '';
      const match2 = cookieHeader2.match(/refreshToken=([^;]+)/);
      const secondRefreshToken = match2 ? decodeURIComponent(match2[1] ?? '') : '';

      const subsequentAttempt = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: secondRefreshToken });

      expect(subsequentAttempt.status).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should revoke session and clear refresh token cookie', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: advisor.email,
          password: DEFAULT_PASSWORD,
        });

      const initialCookie = loginRes.headers['set-cookie'] as unknown as string[];

      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', initialCookie);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);

      // Verify cookie is cleared (max-age=0 or expires in past)
      const logoutCookies = logoutRes.headers['set-cookie'] as unknown as string[];
      expect(logoutCookies.some((c) => c.includes('refreshToken=;') || c.includes('Max-Age=0'))).toBe(true);

      // Attempting to refresh with the logged-out token fails
      const refreshAttempt = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', initialCookie);

      expect(refreshAttempt.status).toBe(401);
    });
  });

  describe('GET /api/auth/me (Protected Route & Context)', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toMatch(/authentication required/i);
    });

    it('should reject invalid or malformed bearer token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer this-is-not-a-valid-jwt');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should establish correct user context for PLATFORM_ADMIN (brokerageId: null)', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: platformAdmin.email,
          password: DEFAULT_PASSWORD,
        });

      const token = loginRes.body.data.accessToken;

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.id).toBe(platformAdmin._id.toString());
      expect(res.body.data.user.email).toBe(platformAdmin.email);
      expect(res.body.data.user.role).toBe('PLATFORM_ADMIN');
      expect(res.body.data.user.brokerageId).toBeNull();
    });

    it('should establish correct user context for tenant user (ADVISOR with brokerageId)', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: advisor.email,
          password: DEFAULT_PASSWORD,
        });

      const token = loginRes.body.data.accessToken;

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.id).toBe(advisor._id.toString());
      expect(res.body.data.user.role).toBe('ADVISOR');
      expect(res.body.data.user.brokerageId).toBe(testBrokerage._id.toString());
    });

    it('should reject access if user account has been suspended after token was issued', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: advisor.email,
          password: DEFAULT_PASSWORD,
        });

      const token = loginRes.body.data.accessToken;

      // Suspend user in database
      await User.findByIdAndUpdate(advisor._id, { status: 'SUSPENDED' });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toMatch(/inactive or not found/i);
    });
  });
});
