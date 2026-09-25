import { Schema, model, type Document, Types } from 'mongoose';

export const LEAD_STATUSES = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'PROPOSAL',
  'NEGOTIATION',
  'WON',
  'LOST',
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_SOURCES = [
  'WEBSITE',
  'REFERRAL',
  'ZILLOW',
  'REALTOR',
  'CAMPAIGN',
  'MANUAL',
  'OTHER',
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export interface ILead {
  brokerageId: Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  status: LeadStatus;
  source: LeadSource;
  score: number;
  assignedTo?: Types.ObjectId;
  notes?: string;
  customFields?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILeadDocument extends ILead, Document {
  __v: number;
}

const leadSchema = new Schema<ILeadDocument>(
  {
    brokerageId: {
      type: Schema.Types.ObjectId,
      ref: 'Brokerage',
      required: [true, 'brokerageId is required for lead tenant isolation'],
      index: true,
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [60, 'First name cannot exceed 60 characters'],
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: [60, 'Last name cannot exceed 60 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required for lead tracking'],
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email address format'],
    },
    phone: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: {
        values: LEAD_STATUSES,
        message: '{VALUE} is not a valid lead status',
      },
      default: 'NEW',
    },
    source: {
      type: String,
      enum: {
        values: LEAD_SOURCES,
        message: '{VALUE} is not a valid lead source',
      },
      default: 'MANUAL',
    },
    score: {
      type: Number,
      default: 0,
      min: [0, 'Lead score cannot be negative'],
      max: [100, 'Lead score cannot exceed 100'],
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [5000, 'Notes cannot exceed 5000 characters'],
    },
    customFields: {
      type: Map,
      of: Schema.Types.Mixed,
      default: () => new Map(),
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index for duplicate lead detection within a brokerage
// (allows cross-brokerage duplicate email existence)
leadSchema.index({ brokerageId: 1, email: 1 }, { unique: true });

// Compound indexes for pipeline querying, agent filtering, and chronological sorting
leadSchema.index({ brokerageId: 1, status: 1, createdAt: -1 });
leadSchema.index({ brokerageId: 1, assignedTo: 1, status: 1 });
leadSchema.index({ brokerageId: 1, score: -1 });

export const Lead = model<ILeadDocument>('Lead', leadSchema);
