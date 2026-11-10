import { IAuditLogRepository, AuditLogEntry } from '../../../../core/domain/ports/repositories/audit-log.repository.port.js';
import { prisma } from './prisma.client.js';

export type AuditActionType =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'LOGOUT'
  | 'RECORD_READ'
  | 'RECORD_CREATE'
  | 'RECORD_SIGN'
  | 'RECORD_ADDENDA'
  | 'PRESCRIPTION_ISSUE'
  | 'ATTACHMENT_UPLOAD'
  | 'ATTACHMENT_DOWNLOAD'
  | 'UNAUTHORIZED_ACCESS_ATTEMPT';

export class PrismaAuditRepository implements IAuditLogRepository {
  public async appendLog(entry: AuditLogEntry): Promise<void> {
    const crypto = await import('node:crypto');
    const validActions: AuditActionType[] = [
      'LOGIN_SUCCESS',
      'LOGIN_FAILURE',
      'LOGOUT',
      'RECORD_READ',
      'RECORD_CREATE',
      'RECORD_SIGN',
      'RECORD_ADDENDA',
      'PRESCRIPTION_ISSUE',
      'ATTACHMENT_UPLOAD',
      'ATTACHMENT_DOWNLOAD',
      'UNAUTHORIZED_ACCESS_ATTEMPT',
    ];

    const action = validActions.includes(entry.action as AuditActionType)
      ? (entry.action as any)
      : ('RECORD_CREATE' as any);

    await prisma.$transaction(async (tx) => {
      // Un único escritor por transacción evita bifurcaciones de la cadena bajo concurrencia.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('savia_ece_audit_chain'))`;
      const latest = await tx.auditLog.findFirst({ orderBy: [{ created_at: 'desc' }, { id: 'desc' }], select: { chain_hash: true } });
      const eventTime = new Date();
      const details = { ...((entry.details as Record<string, unknown>) ?? {}), chainTimestamp: eventTime.toISOString() };
      const chainHash = crypto.createHash('sha256').update((latest?.chain_hash || 'GENESIS_HEALTH_HASH') + JSON.stringify({ ...entry, details }) + eventTime.toISOString()).digest('hex');
      await tx.auditLog.create({ data: {
          user_id: entry.userId ?? null, action, resource: entry.resource, resource_id: entry.resourceId ?? null,
          ip_address: entry.ipAddress || '127.0.0.1', user_agent: entry.userAgent || 'system',
          details_json: details as any, chain_hash: chainHash, created_at: eventTime,
      } });
    });
  }

  public async getLatestHash(): Promise<string> {
    const lastLog = await prisma.auditLog.findFirst({
      orderBy: { created_at: 'desc' },
      select: { chain_hash: true },
    });

    return lastLog?.chain_hash || 'GENESIS_HEALTH_HASH';
  }
}
