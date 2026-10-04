import type { Request, Response, NextFunction } from 'express';
import { activityService } from '../services/activity.service.js';
import { UnauthorizedError } from '../utils/errors.js';
import type { ActivityAction, ActivityEntityType } from '../models/activity-log.model.js';

export class AuditController {
  /**
   * GET /api/audit-logs
   * Retrieves paginated brokerage-wide audit logs.
   * Restricted to PLATFORM_ADMIN and BROKERAGE_ADMIN.
   */
  async getAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const { page, limit, action, entityType, brokerageId } = req.query as {
        page?: string;
        limit?: string;
        action?: ActivityAction;
        entityType?: ActivityEntityType;
        brokerageId?: string;
      };

      const result = await activityService.getBrokerageAuditLogs(req.user, {
        page,
        limit,
        action,
        entityType,
        brokerageId,
      });

      res.status(200).json({
        success: true,
        data: result.activities,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const auditController = new AuditController();
