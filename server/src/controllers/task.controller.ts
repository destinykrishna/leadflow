import type { Request, Response, NextFunction } from 'express';
import { taskRepository } from '../repositories/task.repository.js';
import { taskQuerySchema, updateTaskStatusSchema } from '../validators/task.validators.js';
import { validateData } from '../validators/common.validators.js';
import { NotFoundError } from '../utils/errors.js';
import { activityService } from '../services/activity.service.js';

export class TaskController {
  /**
   * GET /api/tasks
   * Lists tasks for the authenticated brokerage with optional status and overdue filtering.
   */
  async listTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const query = validateData(taskQuerySchema, req.query);

      const tasks = await taskRepository.findTasks(user, query);

      res.status(200).json({
        success: true,
        data: tasks,
        count: tasks.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/tasks/:id
   * Resolves a single task with tenant boundary isolation and anti-IDOR 404.
   */
  async getTaskById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const taskId = req.params.id as string;

      const task = await taskRepository.findTaskById(user, taskId);
      if (!task) {
        throw new NotFoundError('Task resource not found');
      }

      res.status(200).json({
        success: true,
        data: task,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/tasks/:id
   * Updates task status (e.g. to COMPLETED or IN_PROGRESS).
   */
  async updateTaskStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const taskId = req.params.id as string;
      const { status } = validateData(updateTaskStatusSchema, req.body);

      const updatedTask = await taskRepository.updateStatus(user, taskId, status);
      if (!updatedTask) {
        throw new NotFoundError('Task resource not found');
      }

      if (status === 'COMPLETED') {
        void activityService.logActivity({
          brokerageId: updatedTask.brokerageId,
          entityType: 'TASK',
          entityId: updatedTask._id,
          leadId: (updatedTask.leadId as any)?._id || updatedTask.leadId || undefined,
          clientId: (updatedTask.clientId as any)?._id || updatedTask.clientId || undefined,
          action: 'TASK_COMPLETED',
          actor: {
            id: user.id,
            name: user.name,
            role: user.role,
            email: user.email,
          },
          metadata: {
            title: updatedTask.title,
            priority: updatedTask.priority,
            completedAt: updatedTask.completedAt,
          },
        });
      }

      res.status(200).json({
        success: true,
        data: updatedTask,
        message: `Task status updated to ${status}`,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const taskController = new TaskController();
