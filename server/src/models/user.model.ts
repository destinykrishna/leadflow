import { Schema, model, type Document, Types } from 'mongoose';

export const USER_ROLES = [
  'PLATFORM_ADMIN',
  'BROKERAGE_ADMIN',
  'ADVISOR',
  'CLIENT',
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export interface IUser {
  brokerageId?: Types.ObjectId | null;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserDocument extends IUser, Document {}

const userSchema = new Schema<IUserDocument>(
  {
    brokerageId: {
      type: Schema.Types.ObjectId,
      ref: 'Brokerage',
      required: [
        function (this: IUserDocument) {
          // Platform admins manage the multi-tenant system and are not bound to a single brokerage
          return this.role !== 'PLATFORM_ADMIN';
        },
        'brokerageId is required for brokerage-scoped users',
      ],
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'User name is required'],
      trim: true,
      maxlength: [100, 'User name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'User email is required'],
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email address format'],
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
    },
    role: {
      type: String,
      enum: {
        values: USER_ROLES,
        message: '{VALUE} is not a valid user role',
      },
      default: 'ADVISOR',
    },
    status: {
      type: String,
      enum: {
        values: USER_STATUSES,
        message: '{VALUE} is not a valid user status',
      },
      default: 'ACTIVE',
    },
    phone: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Enforce email uniqueness within a brokerage for tenant-scoped users
userSchema.index(
  { brokerageId: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: { brokerageId: { $type: 'objectId' } },
  }
);

// Enforce global uniqueness for platform admins
userSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: { role: 'PLATFORM_ADMIN' },
  }
);

// Optimize role and status queries within a brokerage
userSchema.index({ brokerageId: 1, role: 1 });
userSchema.index({ brokerageId: 1, status: 1 });

export const User = model<IUserDocument>('User', userSchema);
