import { Types, type QueryFilter } from 'mongoose';
import { Task, type ITask, type ITaskDocument, type TaskStatus, type TaskPriority } from '../models/task.model.js';
import { User } from '../models/user.model.js';
import { Lead, type ILeadDocument } from '../models/lead.model.js';
import { Client, type IClientDocument } from '../models/client.model.js';
import { ScopedRepository } from './scoped.repository.js';
import type { AuthUserContext } from '../middleware/auth.middleware.js';
import { withBrokerageScope } from './base.repository.js';
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
  BrokerageIsolationError,
} from '../utils/errors.js';
import { activityService } from '../services/activity.service.js';

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

  /**
   * Creates a new manual follow-up task with tenant boundary isolation.
   * - Enforces caller RBAC (PLATFORM_ADMIN, BROKERAGE_ADMIN, ADVISOR).
   * - Validates assigned advisor belongs to the target brokerage and is ACTIVE.
   * - Validates linked lead or client belongs to the target brokerage (anti-IDOR 404).
   * - Records TASK_CREATED activity log entry if linked to an entity.
   */
  async createTask(
    userContext: AuthUserContext,
    data: {
      title: string;
      description?: string | null | undefined;
      status?: TaskStatus | undefined;
      priority?: TaskPriority | undefined;
      dueDate?: Date | null | undefined;
      assignedTo: string;
      leadId?: string | null | undefined;
      clientId?: string | null | undefined;
    }
  ): Promise<ITaskDocument> {
    if (userContext.role === 'CLIENT') {
      throw new ForbiddenError('Clients are not authorized to create tasks');
    }

    let targetBrokerageId: Types.ObjectId;

    if (userContext.role === 'PLATFORM_ADMIN') {
      if (data.leadId && Types.ObjectId.isValid(data.leadId)) {
        const lead = await Lead.findById(data.leadId);
        if (!lead) throw new NotFoundError('Lead resource not found');
        targetBrokerageId = lead.brokerageId;
      } else if (data.clientId && Types.ObjectId.isValid(data.clientId)) {
        const client = await Client.findById(data.clientId);
        if (!client) throw new NotFoundError('Client resource not found');
        targetBrokerageId = client.brokerageId;
      } else {
        const advisor = await User.findById(data.assignedTo);
        if (!advisor || !advisor.brokerageId) {
          throw new ValidationError('Assigned advisor must belong to a brokerage');
        }
        targetBrokerageId = advisor.brokerageId;
      }
    } else {
      if (!userContext.brokerageId) {
        throw new BrokerageIsolationError('Brokerage context missing for user');
      }
      targetBrokerageId = new Types.ObjectId(userContext.brokerageId);
    }

    // 1. Validate assigned advisor is an active ADVISOR or BROKERAGE_ADMIN in this brokerage
    if (!Types.ObjectId.isValid(data.assignedTo)) {
      throw new ValidationError('Invalid assignedTo user ID format');
    }
    const assignedUser = await User.findOne({
      _id: new Types.ObjectId(data.assignedTo),
      brokerageId: targetBrokerageId,
      status: 'ACTIVE',
      role: { $in: ['ADVISOR', 'BROKERAGE_ADMIN'] },
    });
    if (!assignedUser) {
      throw new ValidationError('Assigned user must be an active advisor or admin in this brokerage');
    }

    // 2. Validate linked lead belongs to this brokerage (anti-IDOR)
    let linkedLead: ILeadDocument | null = null;
    if (data.leadId) {
      if (!Types.ObjectId.isValid(data.leadId)) {
        throw new NotFoundError('Lead resource not found');
      }
      linkedLead = await Lead.findOne(
        withBrokerageScope(targetBrokerageId, { _id: new Types.ObjectId(data.leadId) })
      );
      if (!linkedLead) {
        throw new NotFoundError('Lead resource not found');
      }
    }

    // 3. Validate linked client belongs to this brokerage (anti-IDOR)
    let linkedClient: IClientDocument | null = null;
    if (data.clientId) {
      if (!Types.ObjectId.isValid(data.clientId)) {
        throw new NotFoundError('Client resource not found');
      }
      linkedClient = await Client.findOne(
        withBrokerageScope(targetBrokerageId, { _id: new Types.ObjectId(data.clientId) })
      );
      if (!linkedClient) {
        throw new NotFoundError('Client resource not found');
      }
    }

    // 4. Create Task
    const task = await Task.create({
      brokerageId: targetBrokerageId,
      title: data.title.trim(),
      description: data.description ? data.description.trim() : null,
      status: data.status || 'PENDING',
      priority: data.priority || 'MEDIUM',
      dueDate: data.dueDate || null,
      assignedTo: assignedUser._id,
      leadId: linkedLead ? linkedLead._id : null,
      clientId: linkedClient ? linkedClient._id : null,
    });

    const populatedTask = await Task.findById(task._id)
      .populate('assignedTo', 'name email role')
      .populate('leadId', 'firstName lastName email status')
      .populate('clientId', 'firstName lastName email status');

    // 5. Activity log
    if (linkedLead || linkedClient) {
      void activityService.logActivity({
        brokerageId: targetBrokerageId,
        entityType: 'TASK',
        entityId: task._id,
        leadId: linkedLead ? linkedLead._id : undefined,
        clientId: linkedClient ? linkedClient._id : undefined,
        action: 'TASK_CREATED',
        actor: {
          id: userContext.id,
          name: userContext.name,
          role: userContext.role,
          email: userContext.email,
        },
        metadata: {
          title: task.title,
          priority: task.priority,
          dueDate: task.dueDate ? task.dueDate.toISOString() : null,
          assignedToName: assignedUser.name,
        },
      });
    }

    return (populatedTask || task) as ITaskDocument;
  }
}

export const taskRepository = new TaskRepository();
