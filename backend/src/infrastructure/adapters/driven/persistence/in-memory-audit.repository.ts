import { IAuditLogRepository, AuditLogEntry } from '../../../../core/domain/ports/repositories/audit-log.repository.port.js';
import crypto from 'node:crypto';

export class InMemoryAuditRepository implements IAuditLogRepository {
  private logs: Array<AuditLogEntry & { id: string; chainHash: string; timestamp: Date }> = [];
  private currentHash = 'GENESIS_HASH_MEXICO_SSA_NOM024';

  public async appendLog(entry: AuditLogEntry): Promise<void> {
    const nextHash = crypto
      .createHash('sha256')
      .update(this.currentHash + JSON.stringify(entry))
      .digest('hex');

    this.currentHash = nextHash;
    this.logs.push({
      ...entry,
      id: crypto.randomUUID(),
      chainHash: nextHash,
      timestamp: new Date(),
    });
  }

  public async getLatestHash(): Promise<string> {
    return this.currentHash;
  }

  public getLogs() {
    return this.logs;
  }
}
