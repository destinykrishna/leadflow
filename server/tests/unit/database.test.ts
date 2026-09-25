import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import {
  isDatabaseConnected,
  getDatabaseConnectionState,
  connectDatabase,
} from '../../src/config/database.js';
import { withBrokerageScope } from '../../src/repositories/base.repository.js';
import {
  AppError,
  BrokerageIsolationError,
  ValidationError,
  NotFoundError,
} from '../../src/utils/errors.js';
import {
  objectIdSchema,
  paginationQuerySchema,
  validateData,
} from '../../src/validators/common.validators.js';

describe('Database & Domain Infrastructure (Phase 1, Prompt 1)', () => {
  describe('Database Connection Lifecycle', () => {
    it('should be connected to in-memory database via test setup', () => {
      expect(isDatabaseConnected()).toBe(true);
      expect(getDatabaseConnectionState()).toBe('connected');
    });

    it('should return mongoose connection idempotently when already connected', async () => {
      const conn = await connectDatabase();
      expect(conn).toBeDefined();
      expect(isDatabaseConnected()).toBe(true);
    });
  });

  describe('Tenant Isolation Infrastructure', () => {
    it('should attach brokerageId as ObjectId to query filter', () => {
      const brokerageIdStr = new Types.ObjectId().toHexString();
      const filter = withBrokerageScope(brokerageIdStr, { status: 'NEW' });

      expect(filter.brokerageId).toBeInstanceOf(Types.ObjectId);
      expect(filter.brokerageId.toHexString()).toBe(brokerageIdStr);
      expect((filter as Record<string, unknown>)['status']).toBe('NEW');
    });

    it('should work when brokerageId is already an ObjectId', () => {
      const brokerageId = new Types.ObjectId();
      const filter = withBrokerageScope(brokerageId);

      expect(filter.brokerageId).toEqual(brokerageId);
    });

    it('should throw BrokerageIsolationError if brokerageId is missing', () => {
      expect(() => withBrokerageScope('')).toThrow(BrokerageIsolationError);
      expect(() => withBrokerageScope(null as unknown as string)).toThrow(BrokerageIsolationError);
    });

    it('should throw BrokerageIsolationError if brokerageId is invalid format', () => {
      expect(() => withBrokerageScope('invalid-id')).toThrow(BrokerageIsolationError);
    });
  });

  describe('Domain & Application Errors', () => {
    it('should construct AppError with operational defaults', () => {
      const error = new AppError('Something went wrong', 500, 'INTERNAL_ERROR');
      expect(error.message).toBe('Something went wrong');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.isOperational).toBe(true);
    });

    it('should construct BrokerageIsolationError with 403 Forbidden code', () => {
      const error = new BrokerageIsolationError();
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('BROKERAGE_ISOLATION_VIOLATION');
    });

    it('should construct NotFoundError with 404', () => {
      const error = new NotFoundError('Lead not found');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
    });

    it('should construct ValidationError with 400 and details', () => {
      const details = { field: ['Required'] };
      const error = new ValidationError('Invalid payload', details);
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details).toEqual(details);
    });
  });

  describe('Validation Infrastructure', () => {
    it('should validate valid MongoDB ObjectId', () => {
      const validId = new Types.ObjectId().toHexString();
      expect(objectIdSchema.safeParse(validId).success).toBe(true);
    });

    it('should reject invalid MongoDB ObjectId string', () => {
      expect(objectIdSchema.safeParse('not-an-id').success).toBe(false);
      expect(objectIdSchema.safeParse('12345').success).toBe(false);
    });

    it('should apply pagination defaults', () => {
      const result = paginationQuerySchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.order).toBe('desc');
    });

    it('should throw ValidationError when validateData fails', () => {
      expect(() => validateData(objectIdSchema, 'invalid')).toThrow(ValidationError);
    });
  });
});
