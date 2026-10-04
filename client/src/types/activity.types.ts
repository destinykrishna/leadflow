export type ActivityAction =
  | 'LEAD_CREATED'
  | 'STAGE_CHANGED'
  | 'ADVISOR_ASSIGNED'
  | 'LEAD_REOPENED'
  | 'LEAD_CONVERTED'
  | 'DOCUMENT_UPLOADED'
  | 'DOCUMENT_VERIFIED'
  | 'DOCUMENT_REJECTED'
  | 'TASK_COMPLETED'
  | 'EMAIL_SENT'
  | 'NOTE_ADDED'
  | 'TASK_CREATED';

export type ActivityEntityType =
  | 'LEAD'
  | 'CLIENT'
  | 'DOCUMENT'
  | 'TASK'
  | 'EMAIL';

export interface ActivityActor {
  id?: string | null;
  name?: string | null;
  role?: string | null;
  email?: string | null;
}

export interface ActivityLogItem {
  _id: string;
  brokerageId: string;
  entityType: ActivityEntityType;
  entityId: string;
  action: ActivityAction;
  actor?: ActivityActor | null;
  leadId?: string | null;
  clientId?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface PaginatedActivitiesResponse {
  success: boolean;
  data: ActivityLogItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
