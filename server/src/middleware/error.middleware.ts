import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, path: req.path, method: req.method }, 'Server operational error');
    } else {
      logger.warn(
        { code: err.code, statusCode: err.statusCode, path: req.path, method: req.method },
        err.message
      );
    }

    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  if (err instanceof ZodError) {
    logger.warn({ path: req.path, method: req.method, issues: err.issues }, 'Zod validation error');
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request input',
        details: err.issues,
      },
    });
    return;
  }

  // Unhandled / system errors
  logger.error({ err, path: req.path, method: req.method }, 'Unhandled system error');

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: env.isProduction ? 'An unexpected error occurred' : (err as Error)?.message || 'Internal server error',
    },
  });
}
