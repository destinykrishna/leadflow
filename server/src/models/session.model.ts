import { Schema, model, type Document, Types } from 'mongoose';

export interface ISession {
  userId: Types.ObjectId;
  brokerageId?: Types.ObjectId | null;
  tokenHash: string;
  family: string;
  isRevoked: boolean;
  revokedAt?: Date | null;
  replacedByTokenHash?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISessionDocument extends ISession, Document {}

const sessionSchema = new Schema<ISessionDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Session requires a userId'],
      index: true,
    },
    brokerageId: {
      type: Schema.Types.ObjectId,
      ref: 'Brokerage',
      default: null,
      index: true,
    },
    tokenHash: {
      type: String,
      required: [true, 'Session requires a token hash'],
      unique: true,
      index: true,
    },
    family: {
      type: String,
      required: [true, 'Session requires a family identifier for rotation tracking'],
      index: true,
    },
    isRevoked: {
      type: Boolean,
      default: false,
      index: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    replacedByTokenHash: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      trim: true,
    },
    ipAddress: {
      type: String,
      trim: true,
    },
    expiresAt: {
      type: Date,
      required: [true, 'Session requires an expiration date'],
    },
  },
  {
    timestamps: true,
  }
);

// MongoDB TTL index: automatically remove documents after expiresAt has passed
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Composite indexes for fast session lookup and family invalidation
sessionSchema.index({ userId: 1, isRevoked: 1 });
sessionSchema.index({ family: 1, isRevoked: 1 });

export const Session = model<ISessionDocument>('Session', sessionSchema);
