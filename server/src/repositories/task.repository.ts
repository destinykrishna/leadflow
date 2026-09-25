import { Types, type QueryFilter } from 'mongoose';
import { Task, type ITask, type ITaskDocument, type TaskStatus } from '../models/task.model.js';
import { ScopedRepository } from './scoped.repository.js';
import type { AuthUserContext } from '../middleware/auth.middleware.js';
import { withBrokerageScope } from './base.repository.js';

export interface TaskFilterQuery {
  status?: TaskStatus | undefined;
  assignedTo?: string | undefined;
  leadId?: string | undefined;
  clientId?: string | undefined;
  isOverdue?: boolean | string | undefined;
  limit?: number | undefined;
  page?: number | undefined;
}

export class TaskRepository extends ScopedRepository<ITask, ITaskDocument> {
  constructor() {
    super(Task);
  }

  /**
   * Finds tasks for the authenticated brokerage with optional status, assignment, and overdue filters.
   */
  async findTasks(
    userContext: AuthUserContext,
    filterQuery: TaskFilterQuery = {}
  ): Promise<ITaskDocument[]> {
    const mongoFilter: Record<string, unknown> = {};

    if (filterQuery.status) {
      mongoFilter.status = filterQuery.status;
    }

    if (filterQuery.assignedTo && Types.ObjectId.isValid(filterQuery.assignedTo)) {
      mongoFilter.assignedTo = new Types.ObjectId(filterQuery.assignedTo);
    }

    if (filterQuery.leadId && Types.ObjectId.isValid(filterQuery.leadId)) {
      mongoFilter.leadId = new Types.ObjectId(filterQuery.leadId);
    }

    if (filterQuery.clientId && Types.ObjectId.isValid(filterQuery.clientId)) {
      mongoFilter.clientId = new Types.ObjectId(filterQuery.clientId);
    }

    if (filterQuery.isOverdue === true || filterQuery.isOverdue === 'true') {
      mongoFilter.status = { $in: ['PENDING', 'IN_PROGRESS'] };
      mongoFilter.dueDate = { $ne: null, $lt: new Date() };
    }

    const filter =
      userContext.role === 'PLATFORM_ADMIN'
        ? mongoFilter
        : withBrokerageScope(userContext.brokerageId!, mongoFilter);

    const limit = Math.min(filterQuery.limit ?? 50, 100);
    const page = Math.max(filterQuery.page ?? 1, 1);
    const skip = (page - 1) * limit;

    return Task.find(filter)
      .populate('assignedTo', 'name email role')
      .populate('leadId', 'firstName lastName email status')
      .sort({ dueDate: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit);
  }

  /**
   * Finds a task by ID with populated relations.
   */
  async findTaskById(
    userContext: AuthUserContext,
    taskId: string
  ): Promise<ITaskDocument | null> {
    if (!Types.ObjectId.isValid(taskId)) {
      return null;
    }

    const filter =
      userContext.role === 'PLATFORM_ADMIN'
        ? { _id: new Types.ObjectId(taskId) }
        : withBrokerageScope(userContext.brokerageId!, {
            _id: new Types.ObjectId(taskId),
          });

    return Task.findOne(filter)
      .populate('assignedTo', 'name email role')
      .populate('leadId', 'firstName lastName email status');
  }

  /**
   * Updates task status and records completedAt timestamp.
   */
  async updateStatus(
    userContext: AuthUserContext,
    taskId: string,
    status: TaskStatus
  ): Promise<ITaskDocument | null> {
    if (!Types.ObjectId.isValid(taskId)) {
      return null;
    }

    const update: Record<string, unknown> = { status };
    if (status === 'COMPLETED') {
      update.completedAt = new Date();
    } else if (status === 'PENDING' || status === 'IN_PROGRESS') {
      update.completedAt = null;
    }

    const filter =
      userContext.role === 'PLATFORM_ADMIN'
        ? { _id: new Types.ObjectId(taskId) }
        : withBrokerageScope(userContext.brokerageId!, {
            _id: new Types.ObjectId(taskId),
          });

    return Task.findOneAndUpdate(filter, { $set: update }, { returnDocument: 'after' })
      .populate('assignedTo', 'name email role')
      .populate('leadId', 'firstName lastName email status');
  }
}

export const taskRepository = new TaskRepository();
