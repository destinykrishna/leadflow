import { Schema, model, type Document, Types } from 'mongoose';

export const TASK_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface ITask {
  brokerageId: Types.ObjectId;
  title: string;
  description?: string | null | undefined;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: Date | null | undefined;
  assignedTo: Types.ObjectId;
  leadId?: Types.ObjectId | null | undefined;
  clientId?: Types.ObjectId | null | undefined;
  triggerId?: Types.ObjectId | null | undefined;
  idempotencyKey?: string | null | undefined;
  completedAt?: Date | null | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITaskDocument extends ITask, Document {
  isOverdue: boolean;
}

const taskSchema = new Schema<ITaskDocument>(
  {
    brokerageId: {
      type: Schema.Types.ObjectId,
      ref: 'Brokerage',
      required: [true, 'brokerageId is required for task tenant isolation'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      maxlength: [200, 'Task title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [5000, 'Task description cannot exceed 5000 characters'],
    },
    status: {
      type: String,
      enum: {
        values: TASK_STATUSES,
        message: '{VALUE} is not a valid task status',
      },
      default: 'PENDING',
    },
    priority: {
      type: String,
      enum: {
        values: TASK_PRIORITIES,
        message: '{VALUE} is not a valid task priority',
      },
      default: 'MEDIUM',
    },
    dueDate: {
      type: Date,
      default: null,
      index: true,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'assignedTo user reference is required'],
      index: true,
    },
    leadId: {
      type: Schema.Types.ObjectId,
      ref: 'Lead',
      default: null,
      index: true,
    },
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      default: null,
      index: true,
    },
    triggerId: {
      type: Schema.Types.ObjectId,
      ref: 'PipelineTrigger',
      default: null,
      index: true,
    },
    idempotencyKey: {
      type: String,
      trim: true,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual property calculating overdue status safely
taskSchema.virtual('isOverdue').get(function (this: ITaskDocument) {
  if (this.status === 'COMPLETED' || this.status === 'CANCELLED') {
    return false;
  }
  return this.dueDate ? this.dueDate < new Date() : false;
});

// Compound indexes for assigned user tasks, upcoming due dates, and entity associations
taskSchema.index({ brokerageId: 1, assignedTo: 1, status: 1 });
taskSchema.index({ brokerageId: 1, dueDate: 1, createdAt: -1 });
taskSchema.index({ brokerageId: 1, dueDate: 1, status: 1 });
taskSchema.index({ brokerageId: 1, status: 1, dueDate: 1 });
taskSchema.index({ brokerageId: 1, createdAt: -1 });
taskSchema.index({ brokerageId: 1, leadId: 1 });
taskSchema.index({ brokerageId: 1, clientId: 1 });
taskSchema.index(
  { brokerageId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: 'string' } },
  }
);

export const Task = model<ITaskDocument>('Task', taskSchema);

