import { Schema, model, type Document } from 'mongoose';

import crypto from 'node:crypto';

export const BROKERAGE_PLANS = ['FREE', 'STARTER', 'GROWTH', 'ENTERPRISE'] as const;
export type BrokeragePlan = (typeof BROKERAGE_PLANS)[number];

export const BROKERAGE_STATUSES = ['ACTIVE', 'SUSPENDED', 'TRIAL'] as const;
export type BrokerageStatus = (typeof BROKERAGE_STATUSES)[number];

export interface IBrokerage {
  name: string;
  slug?: string;
  plan: BrokeragePlan;
  status: BrokerageStatus;
  webhookSecret?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBrokerageDocument extends IBrokerage, Document {}

const brokerageSchema = new Schema<IBrokerageDocument>(
  {
    name: {
      type: String,
      required: [true, 'Brokerage name is required'],
      trim: true,
      minlength: [2, 'Brokerage name must be at least 2 characters'],
      maxlength: [100, 'Brokerage name cannot exceed 100 characters'],
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
      maxlength: [100, 'Brokerage slug cannot exceed 100 characters'],
    },
    plan: {
      type: String,
      enum: {
        values: BROKERAGE_PLANS,
        message: '{VALUE} is not a valid brokerage plan',
      },
      default: 'STARTER',
    },
    status: {
      type: String,
      enum: {
        values: BROKERAGE_STATUSES,
        message: '{VALUE} is not a valid brokerage status',
      },
      default: 'ACTIVE',
      index: true,
    },
    webhookSecret: {
      type: String,
      default: () => crypto.randomBytes(24).toString('hex'),
      index: true,
      sparse: true,
    },
  },
  {
    timestamps: true,
  }
);

brokerageSchema.index({ name: 1 });

export const Brokerage = model<IBrokerageDocument>('Brokerage', brokerageSchema);
