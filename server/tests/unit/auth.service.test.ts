import { describe, it, expect, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import jwt from 'jsonwebtoken';
import { hashPassword, verifyPassword, hashToken } from '../../src/utils/password.js';
import { tokenService } from '../../src/services/token.service.js';
import { authService } from '../../src/services/auth.service.js';
import { User, Brokerage, Session } from '../../src/models/index.js';
import { UnauthorizedError } from '../../src/utils/errors.js';
import { env } from '../../src/config/env.js';

describe('Auth Utilities & Token Service Unit Tests', () => {
  describe('Password Hashing & Verification', () => {
    it('should hash a password into a bcrypt format', async () => {
      const plaintext = 'SecureMortgagePass2026!';
      const hash = await hashPassword(plaintext);

      expect(hash).toBeDefined();
      expect(hash).toMatch(/^\$2[aby]\$\d+\$/);
      expect(hash).not.toBe(plaintext);
    });

    it('should successfully verify a correct password against its hash', async () => {
      const plaintext = 'SecureMortgagePass2026!';
      const hash = await hashPassword(plaintext);

      const isValid = await verifyPassword(plaintext, hash);
      expect(isValid).toBe(true);
    });

    it('should reject an incorrect password against a hash', async () => {
      const plaintext = 'SecureMortgagePass2026!';
      const hash = await hashPassword(plaintext);

      const isValid = await verifyPassword('WrongPassword123!', hash);
      expect(isValid).toBe(false);
    });

    it('should generate different salts for identical passwords', async () => {
      const plaintext = 'IdenticalPassword123!';
      const hash1 = await hashPassword(plaintext);
      const hash2 = await hashPassword(plaintext);

      expect(hash1).not.toBe(hash2);
      expect(await verifyPassword(plaintext, hash1)).toBe(true);
      expect(await verifyPassword(plaintext, hash2)).toBe(true);
    });

    it('should generate deterministic sha256 hash for token storage', () => {
      const token = 'sample-refresh-token-xyz';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);

      expect(hash1).toHaveLength(64);
      expect(hash1).toBe(hash2);
      expect(hashToken('different-token')).not.toBe(hash1);
    });
  });

  describe('JWT Token Service', () => {
    it('should generate a valid access token with user claims and tenant context', () => {
      const claims = {
        userId: new Types.ObjectId().toString(),
        email: 'advisor@berlin-mortgages.de',
        role: 'ADVISOR' as const,
        brokerageId: new Types.ObjectId().toString(),
      };

      const token = tokenService.generateAccessToken(claims);
      expect(token).toBeDefined();

      const decoded = tokenService.verifyAccessToken(token);
      expect(decoded.userId).toBe(claims.userId);
      expect(decoded.email).toBe(claims.email);
      expect(decoded.role).toBe(claims.role);
      expect(decoded.brokerageId).toBe(claims.brokerageId);
      expect(decoded.type).toBe('access');
    });

    it('should generate an access token with null brokerageId for platform admins', () => {
      const claims = {
        userId: new Types.ObjectId().toString(),
        email: 'admin@leadflow-platform.com',
        role: 'PLATFORM_ADMIN' as const,
        brokerageId: null,
      };

      const token = tokenService.generateAccessToken(claims);
      const decoded = tokenService.verifyAccessToken(token);

      expect(decoded.userId).toBe(claims.userId);
      expect(decoded.role).toBe('PLATFORM_ADMIN');
      expect(decoded.brokerageId).toBeNull();
    });

    it('should throw UnauthorizedError when verifying an expired access token', () => {
      const expiredToken = jwt.sign(
        {
          userId: 'some-user',
          email: 'test@leadflow.internal',
          role: 'ADVISOR',
          brokerageId: 'some-brokerage',
          type: 'access',
        },
        env.JWT_SECRET,
        { expiresIn: '-1s' }
      );

      expect(() => tokenService.verifyAccessToken(expiredToken)).toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError when verifying an access token with wrong secret', () => {
      const invalidToken = jwt.sign(
        {
          userId: 'some-user',
          email: 'test@leadflow.internal',
          role: 'ADVISOR',
          brokerageId: 'some-brokerage',
          type: 'access',
        },
        'wrong-secret-key-1234567890123456'
      );

      expect(() => tokenService.verifyAccessToken(invalidToken)).toThrow(UnauthorizedError);
    });

    it('should generate and verify refresh tokens with rotation family', () => {
      const userId = new Types.ObjectId().toString();
      const family = tokenService.generateFamilyId();

      const refreshToken = tokenService.generateRefreshToken(userId, family);
      expect(refreshToken).toBeDefined();

      const decoded = tokenService.verifyRefreshToken(refreshToken);
      expect(decoded.userId).toBe(userId);
      expect(decoded.family).toBe(family);
      expect(decoded.type).toBe('refresh');
    });

    it('should embed standard RFC 7519 jti matching tokenId in refresh token', () => {
      const userId = new Types.ObjectId().toString();
      const family = tokenService.generateFamilyId();
      const refreshToken = tokenService.generateRefreshToken(userId, family);

      const decoded = jwt.decode(refreshToken) as { jti?: string; tokenId?: string };
      expect(decoded.jti).toBeDefined();
      expect(decoded.tokenId).toBeDefined();
      expect(decoded.jti).toBe(decoded.tokenId);
    });

    it('should reject refresh token used as access token', () => {
      const userId = new Types.ObjectId().toString();
      const family = tokenService.generateFamilyId();
      const refreshToken = tokenService.generateRefreshToken(userId, family);

      expect(() => tokenService.verifyAccessToken(refreshToken)).toThrow(UnauthorizedError);
    });
  });

  describe('AuthService Logic', () => {
    let testBrokerage: InstanceType<typeof Brokerage>;
    let testPassword: string;
    let passwordHash: string;

    beforeEach(async () => {
      testPassword = 'ValidPassword123!';
      passwordHash = await hashPassword(testPassword);

      testBrokerage = await Brokerage.create({
        name: 'Berlin Expat Mortgages',
        slug: 'berlin-expat',
        plan: 'GROWTH',
        status: 'ACTIVE',
      });
    });

    it('should log in an advisor and return session with correct tenant context', async () => {
      const user = await User.create({
        brokerageId: testBrokerage._id,
        name: 'Elena Schmidt',
        email: 'elena@berlin-expat.de',
        passwordHash,
        role: 'ADVISOR',
        status: 'ACTIVE',
      });

      const result = await authService.login({
        email: 'elena@berlin-expat.de',
        password: testPassword,
      });

      expect(result.user.id).toBe(user._id.toString());
      expect(result.user.role).toBe('ADVISOR');
      expect(result.user.brokerageId).toBe(testBrokerage._id.toString());
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();

      // Session saved in database
      const storedSession = await Session.findOne({ tokenHash: hashToken(result.refreshToken) });
      expect(storedSession).not.toBeNull();
      expect(storedSession?.userId.toString()).toBe(user._id.toString());
      expect(storedSession?.brokerageId?.toString()).toBe(testBrokerage._id.toString());
      expect(storedSession?.isRevoked).toBe(false);
    });

    it('should reject login for inactive or suspended users', async () => {
      await User.create({
        brokerageId: testBrokerage._id,
        name: 'Suspended Advisor',
        email: 'suspended@berlin-expat.de',
        passwordHash,
        role: 'ADVISOR',
        status: 'SUSPENDED',
      });

      await expect(
        authService.login({
          email: 'suspended@berlin-expat.de',
          password: testPassword,
        })
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should reject login if brokerage account is inactive', async () => {
      const inactiveBrokerage = await Brokerage.create({
        name: 'Inactive Loans UG',
        slug: 'inactive-loans',
        plan: 'STARTER',
        status: 'SUSPENDED',
      });

      await User.create({
        brokerageId: inactiveBrokerage._id,
        name: 'Klaus Advisor',
        email: 'klaus@inactive-loans.de',
        passwordHash,
        role: 'ADVISOR',
        status: 'ACTIVE',
      });

      await expect(
        authService.login({
          email: 'klaus@inactive-loans.de',
          password: testPassword,
        })
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should rotate refresh token and issue new token pair', async () => {
      await User.create({
        brokerageId: testBrokerage._id,
        name: 'Elena Schmidt',
        email: 'elena@berlin-expat.de',
        passwordHash,
        role: 'ADVISOR',
        status: 'ACTIVE',
      });

      const initialLogin = await authService.login({
        email: 'elena@berlin-expat.de',
        password: testPassword,
      });

      const initialTokenHash = hashToken(initialLogin.refreshToken);

      // Refresh
      const refreshResult = await authService.refreshTokens(initialLogin.refreshToken);
      expect(refreshResult.accessToken).toBeDefined();
      expect(refreshResult.refreshToken).not.toBe(initialLogin.refreshToken);

      // Verify old session is marked revoked
      const oldSession = await Session.findOne({ tokenHash: initialTokenHash });
      expect(oldSession?.isRevoked).toBe(true);
      expect(oldSession?.replacedByTokenHash).toBe(hashToken(refreshResult.refreshToken));

      // Verify new session is active with same family
      const newSession = await Session.findOne({
        tokenHash: hashToken(refreshResult.refreshToken),
      });
      expect(newSession?.isRevoked).toBe(false);
      expect(newSession?.family).toBe(oldSession?.family);
    });

    it('should detect token reuse and revoke all sessions in the token family', async () => {
      await User.create({
        brokerageId: testBrokerage._id,
        name: 'Elena Schmidt',
        email: 'elena@berlin-expat.de',
        passwordHash,
        role: 'ADVISOR',
        status: 'ACTIVE',
      });

      const initialLogin = await authService.login({
        email: 'elena@berlin-expat.de',
        password: testPassword,
      });

      // Legitimate client refreshes token
      const firstRefresh = await authService.refreshTokens(initialLogin.refreshToken);

      // Attacker tries to use the already-consumed initialRefreshToken
      await expect(authService.refreshTokens(initialLogin.refreshToken)).rejects.toThrow(
        /token reuse detected/i
      );

      // Both the original and the new session should now be revoked
      const originalSession = await Session.findOne({ tokenHash: hashToken(initialLogin.refreshToken) });
      expect(originalSession).not.toBeNull();
      const activeSessions = await Session.find({
        family: originalSession!.family,
        isRevoked: false,
      });
      expect(activeSessions).toHaveLength(0);

      // The legitimate client's subsequent refresh attempt will also fail
      await expect(authService.refreshTokens(firstRefresh.refreshToken)).rejects.toThrow(
        UnauthorizedError
      );
    });

    it('should properly revoke session on logout', async () => {
      await User.create({
        brokerageId: testBrokerage._id,
        name: 'Elena Schmidt',
        email: 'elena@berlin-expat.de',
        passwordHash,
        role: 'ADVISOR',
        status: 'ACTIVE',
      });

      const loginResult = await authService.login({
        email: 'elena@berlin-expat.de',
        password: testPassword,
      });

      await authService.logout(loginResult.refreshToken);

      const session = await Session.findOne({ tokenHash: hashToken(loginResult.refreshToken) });
      expect(session?.isRevoked).toBe(true);

      // Subsequent refresh must fail
      await expect(authService.refreshTokens(loginResult.refreshToken)).rejects.toThrow(
        UnauthorizedError
      );
    });

    it('should revoke all user sessions on demand', async () => {
      const user = await User.create({
        brokerageId: testBrokerage._id,
        name: 'Elena Schmidt',
        email: 'elena@berlin-expat.de',
        passwordHash,
        role: 'ADVISOR',
        status: 'ACTIVE',
      });

      // Multiple logins (e.g. mobile app, laptop, desktop)
      const session1 = await authService.login({ email: 'elena@berlin-expat.de', password: testPassword });
      const session2 = await authService.login({ email: 'elena@berlin-expat.de', password: testPassword });

      await authService.revokeAllUserSessions(user._id);

      const remainingActive = await Session.find({ userId: user._id, isRevoked: false });
      expect(remainingActive).toHaveLength(0);

      await expect(authService.refreshTokens(session1.refreshToken)).rejects.toThrow(UnauthorizedError);
      await expect(authService.refreshTokens(session2.refreshToken)).rejects.toThrow(UnauthorizedError);
    });

    it('should disambiguate duplicate emails across different brokerages without leaking existence', async () => {
      const brokerageB = await Brokerage.create({
        name: 'Munich Expat Finance',
        slug: 'munich-expat',
        plan: 'STARTER',
        status: 'ACTIVE',
      });

      const passA = 'BerlinSecurePass1!';
      const passB = 'MunichSecurePass2!';

      // Account in Brokerage A
      await User.create({
        brokerageId: testBrokerage._id,
        name: 'Shared Expat User',
        email: 'shared@expat.de',
        passwordHash: await hashPassword(passA),
        role: 'CLIENT',
        status: 'ACTIVE',
      });

      // Account in Brokerage B (same email)
      await User.create({
        brokerageId: brokerageB._id,
        name: 'Shared Expat User',
        email: 'shared@expat.de',
        passwordHash: await hashPassword(passB),
        role: 'CLIENT',
        status: 'ACTIVE',
      });

      // Login targeting Brokerage A via password
      const resultA = await authService.login({ email: 'shared@expat.de', password: passA });
      expect(resultA.user.brokerageId).toBe(testBrokerage._id.toString());

      // Login targeting Brokerage B via password
      const resultB = await authService.login({ email: 'shared@expat.de', password: passB });
      expect(resultB.user.brokerageId).toBe(brokerageB._id.toString());

      // Login with wrong password throws generic Invalid credentials
      await expect(
        authService.login({ email: 'shared@expat.de', password: 'CompletelyWrongPassword!' })
      ).rejects.toThrow(/invalid credentials/i);
    });
  });

  describe('Rate Limiter Environment Safety', () => {
    it('should verify env.isTest is strictly determined by NODE_ENV', () => {
      expect(env.isTest).toBe(process.env.NODE_ENV === 'test');
      expect(env.isProduction).toBe(process.env.NODE_ENV === 'production');
    });
  });
});

