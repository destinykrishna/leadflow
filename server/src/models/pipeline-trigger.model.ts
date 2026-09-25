import { Schema, model, type Document, Types } from 'mongoose';

export const TRIGGER_ACTION_TYPES = [
  'CREATE_TASK',
  'SEND_EMAIL',
  'NOTIFICATION',
] as const;
export type TriggerActionType = (typeof TRIGGER_ACTION_TYPES)[number];

export const TRIGGER_RECIPIENT_TYPES = ['LEAD', 'AGENT', 'CUSTOM'] as const;
export type TriggerRecipientType = (typeof TRIGGER_RECIPIENT_TYPES)[number];

export interface ITriggerActionConfig {
  taskTitle?: string;
  taskPriority?: string;
  dueDaysOffset?: number;
  templateId?: Types.ObjectId;
  recipientType?: TriggerRecipientType;
}

export interface IPipelineTrigger {
  brokerageId: Types.ObjectId;
  name: string;
  fromStage?: string | null;
  toStage: string;
  actionType: TriggerActionType;
  actionConfig: ITriggerActionConfig;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPipelineTriggerDocument extends IPipelineTrigger, Document {}

const triggerActionConfigSchema = new Schema<ITriggerActionConfig>(
  {
    taskTitle: { type: String, trim: true },
    taskPriority: { type: String, default: 'MEDIUM' },
    dueDaysOffset: { type: Number, default: 1, min: 0 },
    templateId: { type: Schema.Types.ObjectId, ref: 'EmailTemplate', default: null },
    recipientType: {
      type: String,
      enum: TRIGGER_RECIPIENT_TYPES,
      default: 'LEAD',
    },
  },
  { _id: false }
);

const pipelineTriggerSchema = new Schema<IPipelineTriggerDocument>(
  {
    brokerageId: {
      type: Schema.Types.ObjectId,
      ref: 'Brokerage',
      required: [true, 'brokerageId is required for pipeline trigger tenant isolation'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Trigger name is required'],
      trim: true,
      maxlength: [100, 'Trigger name cannot exceed 100 characters'],
    },
    fromStage: {
      type: String,
      trim: true,
      default: null,
    },
    toStage: {
      type: String,
      required: [true, 'toStage is required to define transition trigger point'],
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
    actionConfig: {
      type: triggerActionConfigSchema,
      required: [true, 'actionConfig is required'],
      default: () => ({}),
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for transition matching and action execution
pipelineTriggerSchema.index({ brokerageId: 1, toStage: 1, isActive: 1 });
pipelineTriggerSchema.index({ brokerageId: 1, actionType: 1 });

export const PipelineTrigger = model<IPipelineTriggerDocument>(
  'PipelineTrigger',
  pipelineTriggerSchema
);
