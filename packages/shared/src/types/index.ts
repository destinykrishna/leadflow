/**
 * Shared domain types accessible by client, server, and worker.
 */
export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface TenantScoped {
  brokerageId: string;
}
