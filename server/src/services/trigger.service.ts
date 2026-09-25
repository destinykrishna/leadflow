import { Types } from 'mongoose';
import {
  PipelineTrigger,
  type IPipelineTriggerDocument,
} from '../models/pipeline-trigger.model.js';
import { Task, type TaskPriority, type ITaskDocument } from '../models/task.model.js';
import { EmailTemplate } from '../models/email-template.model.js';
import { TriggerExecution } from '../models/trigger-execution.model.js';
import { Brokerage } from '../models/brokerage.model.js';
import { User, type IUserDocument } from '../models/user.model.js';
import type { ILeadDocument, LeadStatus } from '../models/lead.model.js';
import { withBrokerageScope } from '../repositories/base.repository.js';
import { renderTemplate, buildTemplateContext } from '../utils/template.js';
import { enqueueEmailJob } from '../queues/email.queue.js';
import { logger } from '../utils/logger.js';
import { maskEmail } from '../utils/mask.js';

export interface StageTransitionTriggerParams {
  brokerageId: Types.ObjectId | string;
  lead: ILeadDocument;
  previousStage: LeadStatus | string | null | undefined;
  newStage: LeadStatus | string;
  updatedBy?: {
    id: string;
    name: string;
    role: string;
  } | undefined;
  // Optional test simulation overrides
  simulateEmailFailure?: boolean | undefined;
  simulateEmailTerminalFailure?: boolean | undefined;
}

export interface TriggerExecutionSummary {
  triggersEvaluated: number;
  tasksCreated: number;
  emailsEnqueued: number;
  skippedDuplicates: number;
  errors: number;
}

export class TriggerService {
  /**
   * Evaluates and executes configured stage triggers when a lead enters a pipeline stage.
   * Guaranteed to be tenant-safe, non-blocking to HTTP requests, and strictly idempotent.
   */
  async handleStageTransition(
    params: StageTransitionTriggerParams
  ): Promise<TriggerExecutionSummary> {
    const summary: TriggerExecutionSummary = {
      triggersEvaluated: 0,
      tasksCreated: 0,
      emailsEnqueued: 0,
      skippedDuplicates: 0,
      errors: 0,
    };

    try {
      const brokerageIdStr = params.brokerageId.toString();
      const brokerageObjectId = new Types.ObjectId(brokerageIdStr);

      logger.info(
        {
          brokerageId: brokerageIdStr,
          leadId: params.lead._id.toString(),
          previousStage: params.previousStage || 'NONE',
          newStage: params.newStage,
        },
        'TriggerService: Evaluating pipeline stage triggers for transition'
      );

      // 1. Query active triggers for the brokerage matching target stage
      const triggers: IPipelineTriggerDocument[] = await PipelineTrigger.find({
        brokerageId: brokerageObjectId,
        toStage: params.newStage,
        isActive: true,
      });

      summary.triggersEvaluated = triggers.length;

      if (triggers.length === 0) {
        logger.debug(
          { brokerageId: brokerageIdStr, newStage: params.newStage },
          'No active triggers configured for stage transition'
        );
        return summary;
      }

      // 2. Filter matching triggers by fromStage criteria
      const matchingTriggers = triggers.filter((trigger) => {
        if (!trigger.fromStage || trigger.fromStage === '*') {
          return true;
        }
        return trigger.fromStage === params.previousStage;
      });

      if (matchingTriggers.length === 0) {
        return summary;
      }

      // 3. Resolve context data (Brokerage and Advisor details) for placeholder rendering
      const brokerage = await Brokerage.findById(brokerageObjectId);

      let advisor: IUserDocument | null = null;
      if (params.lead.assignedTo) {
        advisor = await User.findOne(
          withBrokerageScope(brokerageIdStr, {
            _id: params.lead.assignedTo,
          })
        );
      }

      const templateContext = buildTemplateContext({
        lead: params.lead,
        advisor,
        brokerage,
        previousStage: params.previousStage,
        newStage: params.newStage,
      });

      // 4. Process each matching trigger with atomic idempotency
      for (const trigger of matchingTriggers) {
        const triggerIdStr = trigger._id.toString();
        const idempotencyKey = `trigger:${params.lead._id.toString()}:${triggerIdStr}:${params.newStage}`;

        // Atomic claim via MongoDB unique constraint on (brokerageId, idempotencyKey)
        let execution;
        try {
          execution = await TriggerExecution.create({
            brokerageId: brokerageObjectId,
            triggerId: trigger._id,
            leadId: params.lead._id,
            stage: params.newStage,
            actionType: trigger.actionType,
            idempotencyKey,
            status: 'PENDING',
          });
        } catch (err: unknown) {
          const mongoError = err as { code?: number };
          if (mongoError.code === 11000) {
            logger.info(
              {
                brokerageId: brokerageIdStr,
                leadId: params.lead._id.toString(),
                triggerId: triggerIdStr,
                idempotencyKey,
              },
              'TriggerService: Duplicate stage trigger event detected; skipping duplicate execution'
            );
            summary.skippedDuplicates++;
            continue;
          }
          summary.errors++;
          logger.error({ err, triggerId: triggerIdStr }, 'Failed to initialize trigger execution claim');
          continue;
        }

        // Execute specific action type
        if (trigger.actionType === 'CREATE_TASK') {
          try {
            await this.executeCreateTaskAction({
              brokerageObjectId,
              brokerageIdStr,
              lead: params.lead,
              trigger,
              advisor,
              updatedBy: params.updatedBy,
              templateContext,
              idempotencyKey,
              executionId: execution._id as Types.ObjectId,
            });
            summary.tasksCreated++;
          } catch (taskErr) {
            summary.errors++;
            logger.error({ err: taskErr, triggerId: triggerIdStr }, 'Task creation trigger action failed');
            await TriggerExecution.findByIdAndUpdate(execution._id, {
              $set: { status: 'FAILED', error: (taskErr as Error).message },
            }).catch(() => {});
          }
        } else if (trigger.actionType === 'SEND_EMAIL') {
          try {
            await this.executeSendEmailAction({
              brokerageObjectId,
              brokerageIdStr,
              lead: params.lead,
              trigger,
              advisor,
              templateContext,
              idempotencyKey,
              executionId: execution._id as Types.ObjectId,
              simulateEmailFailure: params.simulateEmailFailure,
              simulateEmailTerminalFailure: params.simulateEmailTerminalFailure,
            });
            summary.emailsEnqueued++;
          } catch (emailErr) {
            summary.errors++;
            logger.error({ err: emailErr, triggerId: triggerIdStr }, 'Email dispatch trigger action failed');
            await TriggerExecution.findByIdAndUpdate(execution._id, {
              $set: { status: 'FAILED', error: (emailErr as Error).message },
            }).catch(() => {});
          }
        }
      }

      return summary;
    } catch (unexpectedError) {
      logger.error({ err: unexpectedError }, 'Unexpected error in handleStageTransition');
      return summary;
    }
  }

  /**
   * Executes task creation action enforcing overdue-safe status, assignee resolution, and due date calculation.
   */
  private async executeCreateTaskAction(params: {
    brokerageObjectId: Types.ObjectId;
    brokerageIdStr: string;
    lead: ILeadDocument;
    trigger: IPipelineTriggerDocument;
    advisor: IUserDocument | null;
    updatedBy?: { id: string; name: string; role: string } | undefined;
    templateContext: Record<string, unknown>;
    idempotencyKey: string;
    executionId: Types.ObjectId;
  }): Promise<ITaskDocument> {
    const {
      brokerageObjectId,
      brokerageIdStr,
      lead,
      trigger,
      advisor,
      updatedBy,
      templateContext,
      idempotencyKey,
      executionId,
    } = params;

    // 1. Resolve task assignee
    let assigneeId: Types.ObjectId | null = null;

    if (lead.assignedTo) {
      assigneeId = lead.assignedTo;
    } else if (updatedBy?.id && Types.ObjectId.isValid(updatedBy.id)) {
      // Check if updatedBy is an active advisor/admin in this brokerage
      const updater = await User.findOne(
        withBrokerageScope(brokerageIdStr, {
          _id: new Types.ObjectId(updatedBy.id),
          status: 'ACTIVE',
        })
      );
      if (updater && (updater.role === 'ADVISOR' || updater.role === 'BROKERAGE_ADMIN')) {
        assigneeId = updater._id;
      }
    }

    if (!assigneeId) {
      // Fallback: Query first active advisor or brokerage admin
      const fallbackUser = await User.findOne(
        withBrokerageScope(brokerageIdStr, {
          role: { $in: ['ADVISOR', 'BROKERAGE_ADMIN'] },
          status: 'ACTIVE',
        })
      );
      if (fallbackUser) {
        assigneeId = fallbackUser._id;
      } else {
        throw new Error('Unable to resolve task assignee: No active advisor or admin found in brokerage');
      }
    }

    // 2. Calculate due date
    const config = trigger.actionConfig;
    let dueDate: Date;
    if (config.dueHoursOffset !== null && config.dueHoursOffset !== undefined) {
      dueDate = new Date(Date.now() + config.dueHoursOffset * 3600 * 1000);
    } else {
      const days = config.dueDaysOffset !== undefined ? config.dueDaysOffset : 1;
      dueDate = new Date(Date.now() + days * 24 * 3600 * 1000);
    }

    // 3. Render title & description with placeholders
    const rawTitle = config.taskTitle || trigger.name || 'Automated Pipeline Task';
    const renderedTitle = renderTemplate(rawTitle, templateContext);

    const rawDescription =
      config.taskDescription ||
      `Automated task created by pipeline trigger "${trigger.name}" upon entering stage ${trigger.toStage}`;
    const renderedDescription = renderTemplate(rawDescription, templateContext);

    const priority = (config.taskPriority as TaskPriority) || 'MEDIUM';
    const taskIdempotencyKey = `task:${idempotencyKey}`;

    // 4. Create Task record idempotently
    let taskDoc: ITaskDocument;
    try {
      taskDoc = await Task.create({
        brokerageId: brokerageObjectId,
        title: renderedTitle,
        description: renderedDescription,
        status: 'PENDING', // Overdue-safe initial status
        priority,
        dueDate,
        assignedTo: assigneeId,
        leadId: lead._id,
        clientId: lead.convertedClientId || undefined,
        triggerId: trigger._id,
        idempotencyKey: taskIdempotencyKey,
      });
    } catch (err: unknown) {
      const mongoError = err as { code?: number };
      if (mongoError.code === 11000) {
        // Task was created by concurrent race; find and link
        const existing = await Task.findOne(
          withBrokerageScope(brokerageIdStr, {
            idempotencyKey: taskIdempotencyKey,
          })
        );
        if (!existing) {
          throw err;
        }
        taskDoc = existing;
      } else {
        throw err;
      }
    }

    // 5. Update execution record to EXECUTED
    await TriggerExecution.findByIdAndUpdate(executionId, {
      $set: {
        status: 'EXECUTED',
        taskId: taskDoc._id,
        executedAt: new Date(),
        error: null,
      },
    });

    logger.info(
      {
        taskId: taskDoc._id.toString(),
        brokerageId: brokerageIdStr,
        leadId: lead._id.toString(),
        assignedTo: assigneeId.toString(),
        dueDate: dueDate.toISOString(),
      },
      'TriggerService: Advisor task successfully created from stage trigger'
    );

    return taskDoc;
  }

  /**
   * Executes email trigger action enforcing tenant boundary on email templates,
   * placeholder rendering, and BullMQ background queueing.
   */
  private async executeSendEmailAction(params: {
    brokerageObjectId: Types.ObjectId;
    brokerageIdStr: string;
    lead: ILeadDocument;
    trigger: IPipelineTriggerDocument;
    advisor: IUserDocument | null;
    templateContext: Record<string, unknown>;
    idempotencyKey: string;
    executionId: Types.ObjectId;
    simulateEmailFailure?: boolean | undefined;
    simulateEmailTerminalFailure?: boolean | undefined;
  }): Promise<void> {
    const {
      brokerageIdStr,
      lead,
      trigger,
      advisor,
      templateContext,
      idempotencyKey,
      executionId,
      simulateEmailFailure,
      simulateEmailTerminalFailure,
    } = params;

    const config = trigger.actionConfig;

    if (!config || !config.templateId) {
      throw new Error('Trigger is missing templateId in actionConfig');
    }

    // 1. Tenant boundary enforcement: Template must belong to this brokerage
    const template = await EmailTemplate.findOne(
      withBrokerageScope(brokerageIdStr, {
        _id: config.templateId,
        isActive: true,
      })
    );

    if (!template) {
      // Check for cross-brokerage tampering
      const crossTemplate = await EmailTemplate.findById(config.templateId);
      if (crossTemplate) {
        logger.error(
          {
            jobBrokerageId: brokerageIdStr,
            templateBrokerageId: crossTemplate.brokerageId.toString(),
            templateId: config.templateId.toString(),
          },
          'CRITICAL: Cross-brokerage email template access blocked'
        );
      }
      throw new Error('Referenced email template not found or unauthorized for this brokerage');
    }

    // 2. Render email subject & body
    const renderedSubject = renderTemplate(template.subject, templateContext);
    const renderedBody = renderTemplate(template.body, templateContext);

    // 3. Determine recipient
    let recipientEmail = lead.email;
    let recipientName = `${lead.firstName || ''} ${lead.lastName || ''}`.trim();

    if (config.recipientType === 'AGENT') {
      if (advisor?.email) {
        recipientEmail = advisor.email;
        recipientName = advisor.name;
      } else {
        throw new Error('Recipient configured as AGENT but lead has no assigned advisor email');
      }
    } else if (config.recipientType === 'CUSTOM') {
      if (config.customRecipientEmail) {
        recipientEmail = config.customRecipientEmail;
        recipientName = 'Custom Recipient';
      } else {
        throw new Error('Recipient configured as CUSTOM but no customRecipientEmail provided');
      }
    }

    // 4. Enqueue to BullMQ asynchronously without blocking HTTP response
    const job = await enqueueEmailJob({
      brokerageId: brokerageIdStr,
      leadId: lead._id.toString(),
      triggerId: trigger._id.toString(),
      templateId: template._id.toString(),
      to: recipientEmail,
      recipientName,
      recipientType: config.recipientType || 'LEAD',
      subject: renderedSubject,
      body: renderedBody,
      idempotencyKey,
      simulateFailure: simulateEmailFailure,
      simulateTerminalFailure: simulateEmailTerminalFailure,
    });

    if (job) {
      await TriggerExecution.findByIdAndUpdate(executionId, {
        $set: {
          emailJobId: job.id,
          recipientEmail,
        },
      });
    }

    logger.info(
      {
        brokerageId: brokerageIdStr,
        leadId: lead._id.toString(),
        recipient: maskEmail(recipientEmail),
        templateId: template._id.toString(),
        jobId: job?.id,
      },
      'TriggerService: Email job successfully dispatched to background queue'
    );
  }
}

export const triggerService = new TriggerService();
