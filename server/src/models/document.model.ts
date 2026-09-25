import { Schema, model, type Document as MongoDoc, Types } from 'mongoose';

export const DOCUMENT_TYPES = [
  'IDENTIFICATION',
  'PAYSLIP',
  'BANK_STATEMENT',
  'INCOME_PROOF',
  'CONTRACT',
  'TAX_RETURN',
  'OTHER',
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_STATUSES = [
  'PENDING',
  'PROCESSING',
  'VERIFIED',
  'REJECTED',
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export interface IDocument {
  brokerageId: Types.ObjectId;
  title: string;
  fileUrl: string;
  fileKey?: string;
  fileSize?: number;
  mimeType?: string;
  type: DocumentType;
  status: DocumentStatus;
  uploadedBy: Types.ObjectId;
  clientId?: Types.ObjectId;
  leadId?: Types.ObjectId;
  verificationNotes?: string;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDocumentDocument extends IDocument, MongoDoc {}

const documentSchema = new Schema<IDocumentDocument>(
  {
    brokerageId: {
      type: Schema.Types.ObjectId,
      ref: 'Brokerage',
      required: [true, 'brokerageId is required for document tenant isolation'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Document title is required'],
      trim: true,
      maxlength: [200, 'Document title cannot exceed 200 characters'],
    },
    fileUrl: {
      type: String,
      required: [true, 'File URL is required'],
      trim: true,
    },
    fileKey: {
      type: String,
      trim: true,
    },
    fileSize: {
      type: Number,
      min: [0, 'File size cannot be negative'],
    },
    mimeType: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: {
        values: DOCUMENT_TYPES,
        message: '{VALUE} is not a valid document type',
      },
      default: 'OTHER',
    },
    status: {
      type: String,
      enum: {
        values: DOCUMENT_STATUSES,
        message: '{VALUE} is not a valid document verification status',
      },
      default: 'PENDING',
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'uploadedBy user reference is required'],
      index: true,
    },
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      default: null,
      index: true,
    },
    leadId: {
      type: Schema.Types.ObjectId,
      ref: 'Lead',
      default: null,
      index: true,
    },
    verificationNotes: {
      type: String,
      trim: true,
      maxlength: [2000, 'Verification notes cannot exceed 2000 characters'],
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for client documents, lead documents, and verification queue filters
documentSchema.index({ brokerageId: 1, clientId: 1, createdAt: -1 });
documentSchema.index({ brokerageId: 1, leadId: 1, createdAt: -1 });
documentSchema.index({ brokerageId: 1, status: 1 });
documentSchema.index({ brokerageId: 1, uploadedBy: 1 });

export const Document = model<IDocumentDocument>('Document', documentSchema);
