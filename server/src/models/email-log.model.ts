import { Schema, model, type Document, Types } from 'mongoose';

export const EMAIL_LOG_STATUSES = [
  'QUEUED',
  'SENT',
  'DELIVERED',
  'BOUNCED',
  'COMPLAINED',
  'FAILED',
] as const;
export type EmailLogStatus = (typeof EMAIL_LOG_STATUSES)[number];

export const EMAIL_LOG_PROVIDERS = ['MOCK', 'RESEND'] as const;
export type EmailLogProvider = (typeof EMAIL_LOG_PROVIDERS)[number];

export interface IEmailLog {
  brokerageId: Types.ObjectId;
  leadId?: Types.ObjectId | null;
  clientId?: Types.ObjectId | null;
  triggerId?: Types.ObjectId | null;
  templateId?: Types.ObjectId | null;
  recipientEmail: string;
  recipientName?: string | null;
  subject: string;
  provider: EmailLogProvider;
  providerMessageId?: string | null;
  status: EmailLogStatus;
  bounceType?: 'HARD' | 'SOFT' | null;
  bounceReason?: string | null;
  error?: string | null;
  sentAt?: Date | null;
  deliveredAt?: Date | null;
  bouncedAt?: Date | null;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IEmailLogDocument extends IEmailLog, Document {}

const emailLogSchema = new Schema<IEmailLogDocument>(
  {
    brokerageId: {
      type: Schema.Types.ObjectId,
      ref: 'Brokerage',
      required: [true, 'brokerageId is required for tenant isolation'],
      index: true,
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
    },
    triggerId: {
      type: Schema.Types.ObjectId,
      ref: 'PipelineTrigger',
      default: null,
    },
    templateId: {
      type: Schema.Types.ObjectId,
      ref: 'EmailTemplate',
      default: null,
    },
    recipientEmail: {
      type: String,
      required: [true, 'recipientEmail is required'],
      trim: true,
      lowercase: true,
      index: true,
    },
    recipientName: {
      type: String,
      default: null,
      trim: true,
    },
    subject: {
      type: String,
      required: [true, 'subject is required'],
      trim: true,
    },
    provider: {
      type: String,
      enum: {
        values: EMAIL_LOG_PROVIDERS,
        message: '{VALUE} is not a valid email provider',
      },
      default: 'MOCK',
    },
    providerMessageId: {
      type: String,
      default: null,
      trim: true,
    },
    status: {
      type: String,
      enum: {
        values: EMAIL_LOG_STATUSES,
        message: '{VALUE} is not a valid email status',
      },
      default: 'QUEUED',
      index: true,
    },
    bounceType: {
      type: String,
      enum: ['HARD', 'SOFT', null],
      default: null,
    },
    bounceReason: {
      type: String,
      default: null,
    },
    error: {
      type: String,
      default: null,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    bouncedAt: {
      type: Date,
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for tenant queries and provider webhook resolution
emailLogSchema.index({ brokerageId: 1, providerMessageId: 1 }, { sparse: true });
emailLogSchema.index({ providerMessageId: 1 }, { sparse: true });
emailLogSchema.index({ brokerageId: 1, recipientEmail: 1, status: 1 });
emailLogSchema.index({ brokerageId: 1, leadId: 1, createdAt: -1 });
emailLogSchema.index({ brokerageId: 1, createdAt: -1 });

export const EmailLog = model<IEmailLogDocument>('EmailLog', emailLogSchema);
