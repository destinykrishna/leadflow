import { Schema, model, type Document, Types } from 'mongoose';

export const SUPPRESSION_REASONS = ['BOUNCE', 'COMPLAINT', 'MANUAL'] as const;
export type SuppressionReason = (typeof SUPPRESSION_REASONS)[number];

export interface IEmailSuppression {
  brokerageId: Types.ObjectId;
  email: string;
  reason: SuppressionReason;
  details?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IEmailSuppressionDocument extends IEmailSuppression, Document {}

const emailSuppressionSchema = new Schema<IEmailSuppressionDocument>(
  {
    brokerageId: {
      type: Schema.Types.ObjectId,
      ref: 'Brokerage',
      required: [true, 'brokerageId is required for tenant isolation'],
      index: true,
    },
    email: {
      type: String,
      required: [true, 'email is required'],
      trim: true,
      lowercase: true,
      index: true,
    },
    reason: {
      type: String,
      enum: {
        values: SUPPRESSION_REASONS,
        message: '{VALUE} is not a valid suppression reason',
      },
      default: 'BOUNCE',
    },
    details: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index ensuring at most one suppression record per email per brokerage
emailSuppressionSchema.index({ brokerageId: 1, email: 1 }, { unique: true });

export const EmailSuppression = model<IEmailSuppressionDocument>(
  'EmailSuppression',
  emailSuppressionSchema
);
