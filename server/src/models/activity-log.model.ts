import { Schema, model, type Document, Types } from 'mongoose';

export const ACTIVITY_ACTIONS = [
  'LEAD_CREATED',
  'STAGE_CHANGED',
  'ADVISOR_ASSIGNED',
  'LEAD_REOPENED',
  'LEAD_CONVERTED',
  'DOCUMENT_UPLOADED',
  'DOCUMENT_VERIFIED',
  'DOCUMENT_REJECTED',
  'TASK_COMPLETED',
  'EMAIL_SENT',
  'NOTE_ADDED',
  'TASK_CREATED',
] as const;

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export const ACTIVITY_ENTITY_TYPES = [
  'LEAD',
  'CLIENT',
  'DOCUMENT',
  'TASK',
  'EMAIL',
] as const;

export type ActivityEntityType = (typeof ACTIVITY_ENTITY_TYPES)[number];

export interface IActivityActor {
  id?: Types.ObjectId | string | null;
  name?: string | null;
  role?: string | null;
  email?: string | null;
}

export interface IActivityLog {
  brokerageId: Types.ObjectId;
  entityType: ActivityEntityType;
  entityId: Types.ObjectId;
  action: ActivityAction;
  actor?: IActivityActor | null;
  leadId?: Types.ObjectId | null;
  clientId?: Types.ObjectId | null;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface IActivityLogDocument extends IActivityLog, Document {}

const activityActorSchema = new Schema<IActivityActor>(
  {
    id: { type: Schema.Types.Mixed, default: null },
    name: { type: String, default: null, trim: true },
    role: { type: String, default: null, trim: true },
    email: { type: String, default: null, trim: true, lowercase: true },
  },
  { _id: false }
);

const activityLogSchema = new Schema<IActivityLogDocument>(
  {
    brokerageId: {
      type: Schema.Types.ObjectId,
      ref: 'Brokerage',
      required: [true, 'brokerageId is required for tenant isolation'],
      index: true,
    },
    entityType: {
      type: String,
      enum: {
        values: ACTIVITY_ENTITY_TYPES,
        message: '{VALUE} is not a valid activity entity type',
      },
      required: [true, 'entityType is required'],
      index: true,
    },
    entityId: {
      type: Schema.Types.ObjectId,
      required: [true, 'entityId is required'],
      index: true,
    },
    action: {
      type: String,
      enum: {
        values: ACTIVITY_ACTIONS,
        message: '{VALUE} is not a valid activity action',
      },
      required: [true, 'action is required'],
      index: true,
    },
    actor: {
      type: activityActorSchema,
      default: () => ({
        id: null,
        name: 'System',
        role: 'SYSTEM',
        email: null,
      }),
    },
    leadId: {
      type: Schema.Types.ObjectId,
      ref: 'Lead',
      default: null,
      index: true,
    },
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      default: null,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
      immutable: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// Compound indexes for timeline queries and brokerage-wide audit queries
activityLogSchema.index({ brokerageId: 1, createdAt: -1 });
activityLogSchema.index({ brokerageId: 1, entityId: 1, createdAt: -1 });
activityLogSchema.index({ brokerageId: 1, leadId: 1, createdAt: -1 });
activityLogSchema.index({ brokerageId: 1, clientId: 1, createdAt: -1 });
activityLogSchema.index({ brokerageId: 1, action: 1, createdAt: -1 });

export const ActivityLog = model<IActivityLogDocument>('ActivityLog', activityLogSchema);
