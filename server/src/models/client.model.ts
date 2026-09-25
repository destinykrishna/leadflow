import { Schema, model, type Document, Types } from 'mongoose';

export const CLIENT_STATUSES = ['ACTIVE', 'INACTIVE', 'ARCHIVED'] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const CLIENT_TYPES = ['BUYER', 'SELLER', 'BOTH', 'OTHER'] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];

export interface IClientAddress {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}

export interface IClient {
  brokerageId: Types.ObjectId;
  userId?: Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  status: ClientStatus;
  type: ClientType;
  assignedTo?: Types.ObjectId;
  leadId?: Types.ObjectId;
  address?: IClientAddress;
  createdAt: Date;
  updatedAt: Date;
}

export interface IClientDocument extends IClient, Document {}

const clientAddressSchema = new Schema<IClientAddress>(
  {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    postalCode: { type: String, trim: true },
  },
  { _id: false }
);

const clientSchema = new Schema<IClientDocument>(
  {
    brokerageId: {
      type: Schema.Types.ObjectId,
      ref: 'Brokerage',
      required: [true, 'brokerageId is required for client tenant isolation'],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
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
      required: [true, 'Email is required'],
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
        values: CLIENT_STATUSES,
        message: '{VALUE} is not a valid client status',
      },
      default: 'ACTIVE',
    },
    type: {
      type: String,
      enum: {
        values: CLIENT_TYPES,
        message: '{VALUE} is not a valid client type',
      },
      default: 'BUYER',
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    leadId: {
      type: Schema.Types.ObjectId,
      ref: 'Lead',
      default: null,
      index: true,
    },
    address: {
      type: clientAddressSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index for client uniqueness within a brokerage
clientSchema.index({ brokerageId: 1, email: 1 }, { unique: true });
clientSchema.index({ brokerageId: 1, createdAt: -1 });
clientSchema.index({ brokerageId: 1, status: 1 });
clientSchema.index({ brokerageId: 1, assignedTo: 1 });
clientSchema.index(
  { brokerageId: 1, leadId: 1 },
  {
    unique: true,
    partialFilterExpression: { leadId: { $type: 'objectId' } },
  }
);
clientSchema.index(
  { brokerageId: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: { userId: { $type: 'objectId' } },
  }
);

export const Client = model<IClientDocument>('Client', clientSchema);
