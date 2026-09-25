import { Schema, model, type Document, Types } from 'mongoose';
import { TRIGGER_ACTION_TYPES, type TriggerActionType } from './pipeline-trigger.model.js';

export const TRIGGER_EXECUTION_STATUSES = ['PENDING', 'EXECUTED', 'FAILED'] as const;
export type TriggerExecutionStatus = (typeof TRIGGER_EXECUTION_STATUSES)[number];

export interface ITriggerExecution {
  brokerageId: Types.ObjectId;
  triggerId: Types.ObjectId;
  leadId: Types.ObjectId;
  stage: string;
  actionType: TriggerActionType;
  idempotencyKey: string;
  status: TriggerExecutionStatus;
  taskId?: Types.ObjectId | null;
  emailJobId?: string | null;
  recipientEmail?: string | null;
  error?: string | null;
  executedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITriggerExecutionDocument extends ITriggerExecution, Document {}

const triggerExecutionSchema = new Schema<ITriggerExecutionDocument>(
  {
    brokerageId: {
      type: Schema.Types.ObjectId,
      ref: 'Brokerage',
      required: [true, 'brokerageId is required for trigger execution tenant isolation'],
      index: true,
    },
    triggerId: {
      type: Schema.Types.ObjectId,
      ref: 'PipelineTrigger',
      required: [true, 'triggerId is required'],
      index: true,
    },
    leadId: {
      type: Schema.Types.ObjectId,
      ref: 'Lead',
      required: [true, 'leadId is required'],
      index: true,
    },
    stage: {
      type: String,
      required: [true, 'stage is required'],
      trim: true,
    },
    actionType: {
      type: String,
      enum: {
        values: TRIGGER_ACTION_TYPES,
        message: '{VALUE} is not a valid trigger action type',
      },
      required: [true, 'actionType is required'],
    },
    idempotencyKey: {
      type: String,
      required: [true, 'idempotencyKey is required for deduplication'],
      trim: true,
    },
    status: {
      type: String,
      enum: {
        values: TRIGGER_EXECUTION_STATUSES,
        message: '{VALUE} is not a valid trigger execution status',
      },
      default: 'PENDING',
      index: true,
    },
    taskId: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
    },
    emailJobId: {
      type: String,
      default: null,
      trim: true,
    },
    recipientEmail: {
      type: String,
      default: null,
      trim: true,
    },
    error: {
      type: String,
      default: null,
    },
    executedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index ensuring at most one execution per idempotency key per brokerage
triggerExecutionSchema.index({ brokerageId: 1, idempotencyKey: 1 }, { unique: true });
triggerExecutionSchema.index({ brokerageId: 1, leadId: 1, stage: 1 });

export const TriggerExecution = model<ITriggerExecutionDocument>(
  'TriggerExecution',
  triggerExecutionSchema
);
