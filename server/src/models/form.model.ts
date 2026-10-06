import { Schema, model, type Document, Types } from 'mongoose';

export const FORM_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export type FormStatus = (typeof FORM_STATUSES)[number];

export const FORM_FIELD_TYPES = [
  'text',
  'email',
  'phone',
  'number',
  'textarea',
  'select',
] as const;
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

export interface IFormField {
  fieldKey: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  order: number;
  placeholder?: string | undefined;
  helpText?: string | undefined;
  options?: string[] | undefined;
}

export interface IForm {
  brokerageId: Types.ObjectId;
  title: string;
  slug: string;
  description?: string | undefined;
  status: FormStatus;
  fields: IFormField[];
  submitButtonText: string;
  successMessage: string;
  submissionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IFormDocument extends IForm, Document {
  __v: number;
}

const formFieldSchema = new Schema<IFormField>(
  {
    fieldKey: {
      type: String,
      required: [true, 'fieldKey is required'],
      trim: true,
      maxlength: [50, 'fieldKey cannot exceed 50 characters'],
    },
    label: {
      type: String,
      required: [true, 'label is required'],
      trim: true,
      maxlength: [100, 'label cannot exceed 100 characters'],
    },
    type: {
      type: String,
      enum: {
        values: FORM_FIELD_TYPES,
        message: '{VALUE} is not a valid form field type',
      },
      required: true,
      default: 'text',
    },
    required: {
      type: Boolean,
      default: false,
    },
    order: {
      type: Number,
      default: 0,
    },
    placeholder: {
      type: String,
      trim: true,
      maxlength: [100, 'placeholder cannot exceed 100 characters'],
    },
    helpText: {
      type: String,
      trim: true,
      maxlength: [200, 'helpText cannot exceed 200 characters'],
    },
    options: {
      type: [String],
      default: undefined,
    },
  },
  { _id: false }
);

const formSchema = new Schema<IFormDocument>(
  {
    brokerageId: {
      type: Schema.Types.ObjectId,
      ref: 'Brokerage',
      required: [true, 'brokerageId is required for form tenant isolation'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Form title is required'],
      trim: true,
      maxlength: [100, 'Form title cannot exceed 100 characters'],
    },
    slug: {
      type: String,
      required: [true, 'Form slug is required'],
      trim: true,
      lowercase: true,
      maxlength: [100, 'Form slug cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Form description cannot exceed 500 characters'],
    },
    status: {
      type: String,
      enum: {
        values: FORM_STATUSES,
        message: '{VALUE} is not a valid form status',
      },
      default: 'DRAFT',
      index: true,
    },
    fields: {
      type: [formFieldSchema],
      default: () => [],
    },
    submitButtonText: {
      type: String,
      trim: true,
      default: 'Submit',
      maxlength: [50, 'Submit button text cannot exceed 50 characters'],
    },
    successMessage: {
      type: String,
      trim: true,
      default: 'Thank you for your submission.',
      maxlength: [200, 'Success message cannot exceed 200 characters'],
    },
    submissionCount: {
      type: Number,
      default: 0,
      min: [0, 'Submission count cannot be negative'],
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index for form slug within a brokerage (allows duplicate slugs across different brokerages)
formSchema.index({ brokerageId: 1, slug: 1 }, { unique: true });

// Compound indexes for administrative listing and lifecycle queries
formSchema.index({ brokerageId: 1, status: 1, createdAt: -1 });
formSchema.index({ brokerageId: 1, createdAt: -1 });

// Index for fast public lookup
formSchema.index({ brokerageId: 1, slug: 1, status: 1 });

export const Form = model<IFormDocument>('Form', formSchema);
