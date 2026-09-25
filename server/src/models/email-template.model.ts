import { Schema, model, type Document, Types } from 'mongoose';

export interface IEmailTemplate {
  brokerageId: Types.ObjectId;
  name: string;
  slug: string;
  subject: string;
  body: string;
  variables: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IEmailTemplateDocument extends IEmailTemplate, Document {}

const emailTemplateSchema = new Schema<IEmailTemplateDocument>(
  {
    brokerageId: {
      type: Schema.Types.ObjectId,
      ref: 'Brokerage',
      required: [true, 'brokerageId is required for email template tenant isolation'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Template name is required'],
      trim: true,
      maxlength: [100, 'Template name cannot exceed 100 characters'],
    },
    slug: {
      type: String,
      required: [true, 'Template slug is required'],
      trim: true,
      lowercase: true,
      maxlength: [100, 'Template slug cannot exceed 100 characters'],
    },
    subject: {
      type: String,
      required: [true, 'Email subject is required'],
      trim: true,
      maxlength: [200, 'Email subject cannot exceed 200 characters'],
    },
    body: {
      type: String,
      required: [true, 'Email body is required'],
    },
    variables: {
      type: [String],
      default: () => [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index for template slug within a brokerage
emailTemplateSchema.index({ brokerageId: 1, slug: 1 }, { unique: true });
emailTemplateSchema.index({ brokerageId: 1, isActive: 1 });
emailTemplateSchema.index({ brokerageId: 1, name: 1 });

export const EmailTemplate = model<IEmailTemplateDocument>(
  'EmailTemplate',
  emailTemplateSchema
);
