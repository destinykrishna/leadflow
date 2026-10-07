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
  'PENDING_REVIEW',
  'VERIFIED',
  'REJECTED',
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const CLASSIFICATION_STATUSES = [
  'RECOGNIZED',
  'UNKNOWN',
  'INSUFFICIENT_DATA',
] as const;
export type ClassificationStatus = (typeof CLASSIFICATION_STATUSES)[number];

export interface IExtractedField<T = string | number> {
  value: T;
  confidence: number;
}

export interface IDocumentClassification {
  status: ClassificationStatus;
  detectedType: DocumentType | null;
  confidence: number;
  matchedKeywords: string[];
}

export interface IDocumentExtractedFields {
  borrowerName?: IExtractedField<string> | null;
  pan?: IExtractedField<string> | null;
  employerName?: IExtractedField<string> | null;
  grossIncome?: IExtractedField<number> | null;
  netIncome?: IExtractedField<number> | null;
  currency?: IExtractedField<string> | null;
  documentPeriod?: IExtractedField<string> | null;
  dateOfBirth?: IExtractedField<string> | null;
  accountNumberMasked?: IExtractedField<string> | null;
  bankName?: IExtractedField<string> | null;
  ifscCode?: IExtractedField<string> | null;
  assessmentYear?: IExtractedField<string> | null;
  employeeId?: IExtractedField<string> | null;
}

export interface IDocumentExtractedData {
  classification: IDocumentClassification;
  fields: IDocumentExtractedFields;
  extractedAt: Date;
  modelVersion: string;
}

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
  verifiedBy?: Types.ObjectId | null;
  rejectionReason?: string | null;
  ocrText?: string | null;
  extractedData?: IDocumentExtractedData | null;
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
    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: [1000, 'Rejection reason cannot exceed 1000 characters'],
      default: null,
    },
    ocrText: {
      type: String,
      trim: true,
      default: null,
      select: false,
    },
    extractedData: {
      type: new Schema(
        {
          classification: {
            status: {
              type: String,
              enum: CLASSIFICATION_STATUSES,
              required: true,
            },
            detectedType: {
              type: String,
              enum: [...DOCUMENT_TYPES, null],
              default: null,
            },
            confidence: { type: Number, required: true, min: 0, max: 1 },
            matchedKeywords: { type: [String], default: [] },
          },
          fields: {
            borrowerName: {
              type: new Schema({ value: Schema.Types.Mixed, confidence: Number }, { _id: false }),
              default: null,
            },
            pan: {
              type: new Schema({ value: Schema.Types.Mixed, confidence: Number }, { _id: false }),
              default: null,
            },
            employerName: {
              type: new Schema({ value: Schema.Types.Mixed, confidence: Number }, { _id: false }),
              default: null,
            },
            grossIncome: {
              type: new Schema({ value: Schema.Types.Mixed, confidence: Number }, { _id: false }),
              default: null,
            },
            netIncome: {
              type: new Schema({ value: Schema.Types.Mixed, confidence: Number }, { _id: false }),
              default: null,
            },
            currency: {
              type: new Schema({ value: Schema.Types.Mixed, confidence: Number }, { _id: false }),
              default: null,
            },
            documentPeriod: {
              type: new Schema({ value: Schema.Types.Mixed, confidence: Number }, { _id: false }),
              default: null,
            },
            dateOfBirth: {
              type: new Schema({ value: Schema.Types.Mixed, confidence: Number }, { _id: false }),
              default: null,
            },
            accountNumberMasked: {
              type: new Schema({ value: Schema.Types.Mixed, confidence: Number }, { _id: false }),
              default: null,
            },
            bankName: {
              type: new Schema({ value: Schema.Types.Mixed, confidence: Number }, { _id: false }),
              default: null,
            },
            ifscCode: {
              type: new Schema({ value: Schema.Types.Mixed, confidence: Number }, { _id: false }),
              default: null,
            },
            assessmentYear: {
              type: new Schema({ value: Schema.Types.Mixed, confidence: Number }, { _id: false }),
              default: null,
            },
            employeeId: {
              type: new Schema({ value: Schema.Types.Mixed, confidence: Number }, { _id: false }),
              default: null,
            },
          },
          extractedAt: { type: Date, default: Date.now },
          modelVersion: { type: String, default: 'rule-engine-1.0' },
        },
        { _id: false }
      ),
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.fileUrl;
        delete ret.ocrText;
        return ret;
      },
    },
  }
);

// Compound indexes for client documents, lead documents, and verification queue filters
documentSchema.index({ brokerageId: 1, createdAt: -1 });
documentSchema.index({ brokerageId: 1, status: 1, createdAt: -1 });
documentSchema.index({ brokerageId: 1, clientId: 1, createdAt: -1 });
documentSchema.index({ brokerageId: 1, leadId: 1, createdAt: -1 });
documentSchema.index({ brokerageId: 1, status: 1 });
documentSchema.index({ brokerageId: 1, uploadedBy: 1 });
documentSchema.index({ status: 1, createdAt: 1 });
documentSchema.index({ status: 1, updatedAt: 1 });

export const Document = model<IDocumentDocument>('Document', documentSchema);
