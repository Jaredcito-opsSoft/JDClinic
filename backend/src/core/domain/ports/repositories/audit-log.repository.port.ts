export interface AuditLogEntry {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress: string;
  userAgent: string;
  details?: Record<string, unknown>;
}

export interface IAuditLogRepository {
  appendLog(entry: AuditLogEntry): Promise<void>;
  getLatestHash(): Promise<string>;
}
