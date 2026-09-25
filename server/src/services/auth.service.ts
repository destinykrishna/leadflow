import { Types } from 'mongoose';
import { User, type IUserDocument } from '../models/user.model.js';
import { Brokerage } from '../models/brokerage.model.js';
import { Session } from '../models/session.model.js';
import { hashToken, verifyPassword } from '../utils/password.js';
import { UnauthorizedError } from '../utils/errors.js';
import { tokenService } from './token.service.js';
import type { IDomainService } from './base.service.js';
import type { LoginInput } from '../validators/auth.validators.js';

export interface SanitizedUser {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  brokerageId: string | null;
}

export interface AuthSessionResult {
  user: SanitizedUser;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface RequestMetadata {
  userAgent?: string | null | undefined;
  ipAddress?: string | null | undefined;
}

export class AuthService implements IDomainService {
  readonly serviceName = 'AuthService';

  /**
   * Sanitizes user document to safe public context.
   */
  sanitizeUser(user: IUserDocument): SanitizedUser {
    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      brokerageId: user.brokerageId ? user.brokerageId.toString() : null,
    };
  }

  /**
   * Authenticates a user across any of the 4 roles (PLATFORM_ADMIN, BROKERAGE_ADMIN, ADVISOR, CLIENT),
   * handling tenant scoping and password verification, and issues an access/refresh token pair.
   */
  async login(input: LoginInput, meta?: RequestMetadata): Promise<AuthSessionResult> {
    const normalizedEmail = input.email.toLowerCase().trim();
    let targetUser: IUserDocument | null = null;

    if (input.brokerageSlug) {
      const brokerage = await Brokerage.findOne({ slug: input.brokerageSlug.toLowerCase().trim() });
      if (!brokerage) {
        throw new UnauthorizedError('Invalid credentials');
      }
      targetUser = await User.findOne({ email: normalizedEmail, brokerageId: brokerage._id });
    } else if (input.brokerageId) {
      if (!Types.ObjectId.isValid(input.brokerageId)) {
        throw new UnauthorizedError('Invalid credentials');
      }
      targetUser = await User.findOne({
        email: normalizedEmail,
        brokerageId: new Types.ObjectId(input.brokerageId),
      });
    } else {
      // Find candidate users by email
      const candidates = await User.find({ email: normalizedEmail });

      if (candidates.length === 0) {
        throw new UnauthorizedError('Invalid credentials');
      }

      if (candidates.length === 1) {
        targetUser = candidates[0] ?? null;
      } else {
        // Disambiguate multi-tenant accounts against password without leaking account existence
        const matchingUsers: IUserDocument[] = [];
        for (const candidate of candidates) {
          if (await verifyPassword(input.password, candidate.passwordHash)) {
            matchingUsers.push(candidate);
          }
        }

        if (matchingUsers.length === 1) {
          targetUser = matchingUsers[0] ?? null;
        } else if (matchingUsers.length > 1) {
          throw new UnauthorizedError('Brokerage context required to sign in');
        } else {
          throw new UnauthorizedError('Invalid credentials');
        }
      }
    }

    if (!targetUser) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Verify password hash
    const isPasswordValid = await verifyPassword(input.password, targetUser.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Verify account status
    if (targetUser.status !== 'ACTIVE') {
      throw new UnauthorizedError('User account is inactive or suspended');
    }

    // For brokerage-scoped users, verify the brokerage exists and is active
    if (targetUser.role !== 'PLATFORM_ADMIN') {
      if (!targetUser.brokerageId) {
        throw new UnauthorizedError('Brokerage context missing for tenant user');
      }
      const brokerage = await Brokerage.findById(targetUser.brokerageId);
      if (!brokerage || brokerage.status !== 'ACTIVE') {
        throw new UnauthorizedError('Brokerage account is inactive');
      }
    }

    // Generate token family & tokens
    const family = tokenService.generateFamilyId();
    const accessToken = tokenService.generateAccessToken({
      userId: targetUser._id.toString(),
      email: targetUser.email,
      role: targetUser.role,
      brokerageId: targetUser.brokerageId ? targetUser.brokerageId.toString() : null,
    });
    const refreshToken = tokenService.generateRefreshToken(targetUser._id.toString(), family);
    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Persist refresh token session
    await Session.create({
      userId: targetUser._id,
      brokerageId: targetUser.brokerageId ?? null,
      tokenHash,
      family,
      isRevoked: false,
      userAgent: meta?.userAgent ?? null,
      ipAddress: meta?.ipAddress ?? null,
      expiresAt,
    });

    return {
      user: this.sanitizeUser(targetUser),
      accessToken,
      refreshToken,
      expiresAt,
    };
  }

  /**
   * Refreshes access and refresh tokens using rotation.
   * Detects reuse of invalidated tokens and revokes the whole family if a breach is detected.
   */
  async refreshTokens(
    rawRefreshToken: string,
    meta?: RequestMetadata
  ): Promise<AuthSessionResult> {
    const payload = tokenService.verifyRefreshToken(rawRefreshToken);
    const tokenHash = hashToken(rawRefreshToken);

    const session = await Session.findOne({ tokenHash });

    if (!session) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    // Reuse detection: If session is already revoked, an attacker or compromised client
    // is attempting to use a rotated token. Revoke all sessions in this family.
    if (session.isRevoked) {
      await Session.updateMany(
        { family: session.family, isRevoked: false },
        { isRevoked: true, revokedAt: new Date() }
      );
      throw new UnauthorizedError('Invalid refresh token: token reuse detected');
    }

    if (session.expiresAt < new Date()) {
      throw new UnauthorizedError('Refresh token has expired');
    }

    // Verify user exists and is active
    const user = await User.findById(session.userId);
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedError('User account is inactive or not found');
    }

    // For brokerage users, verify brokerage status
    if (user.role !== 'PLATFORM_ADMIN' && user.brokerageId) {
      const brokerage = await Brokerage.findById(user.brokerageId);
      if (!brokerage || brokerage.status !== 'ACTIVE') {
        throw new UnauthorizedError('Brokerage account is inactive');
      }
    }

    // Token rotation: generate new refresh token within same family
    const newRefreshToken = tokenService.generateRefreshToken(user._id.toString(), session.family);
    const newTokenHash = hashToken(newRefreshToken);
    const newAccessToken = tokenService.generateAccessToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      brokerageId: user.brokerageId ? user.brokerageId.toString() : null,
    });
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Invalidate old session
    session.isRevoked = true;
    session.revokedAt = new Date();
    session.replacedByTokenHash = newTokenHash;
    await session.save();

    // Create rotated session
    await Session.create({
      userId: user._id,
      brokerageId: user.brokerageId ?? null,
      tokenHash: newTokenHash,
      family: session.family,
      isRevoked: false,
      userAgent: meta?.userAgent ?? session.userAgent ?? null,
      ipAddress: meta?.ipAddress ?? session.ipAddress ?? null,
      expiresAt,
    });

    return {
      user: this.sanitizeUser(user),
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresAt,
    };
  }

  /**
   * Revokes a session upon user logout.
   */
  async logout(rawRefreshToken?: string): Promise<void> {
    if (!rawRefreshToken) return;

    try {
      const tokenHash = hashToken(rawRefreshToken);
      await Session.updateOne(
        { tokenHash, isRevoked: false },
        { isRevoked: true, revokedAt: new Date() }
      );
    } catch {
      // Graceful logout: do not fail request if token is malformed
    }
  }

  /**
   * Revokes all active sessions for a user (e.g. password reset or security audit).
   */
  async revokeAllUserSessions(userId: string | Types.ObjectId): Promise<void> {
    const validUserId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    await Session.updateMany(
      { userId: validUserId, isRevoked: false },
      { isRevoked: true, revokedAt: new Date() }
    );
  }
}

export const authService = new AuthService();
