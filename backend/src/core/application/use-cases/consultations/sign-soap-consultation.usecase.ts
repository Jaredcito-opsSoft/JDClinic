import crypto from 'node:crypto';
import { IConsultationRepository } from '../../../domain/ports/repositories/consultation.repository.port.js';
import { IAuditLogRepository } from '../../../domain/ports/repositories/audit-log.repository.port.js';

export interface SignSoapConsultationInput {
  consultationId: string;
  doctorId: string;
  cedulaProfesional: string;
  auditContext: {
    ipAddress: string;
    userAgent: string;
  };
}

export class SignSoapConsultationUseCase {
  constructor(
    private readonly consultationRepo: IConsultationRepository,
    private readonly auditRepo: IAuditLogRepository
  ) {}

  public async execute(input: SignSoapConsultationInput): Promise<{ signatureHash: string; signedAt: Date }> {
    const consultation = await this.consultationRepo.findById(input.consultationId);
    if (!consultation) {
      throw new Error('Nota médica no encontrada.');
    }

    if (consultation.doctorId !== input.doctorId) {
      throw new Error('No autorizado: Solo el médico autor de la nota puede firmarla digitalmente.');
    }

    // Regla de inmutabilidad: falla si ya está firmada
    consultation.assertIsEditable();

    // Generar hash de firma electrónica (NOM-024)
    const signaturePayload = `${consultation.id}|${consultation.patientId}|${input.doctorId}|${input.cedulaProfesional}|${consultation.createdAt.toISOString()}|${consultation.analysis.ciphertext}`;
    const signatureHash = crypto.createHash('sha512').update(signaturePayload).digest('hex');

    consultation.sign(signatureHash);

    // Persistir el cambio de estado a FIRMADA
    await this.consultationRepo.updateSignature(consultation);

    // Auditoría de firma
    await this.auditRepo.appendLog({
      userId: input.doctorId,
      action: 'RECORD_SIGN',
      resource: 'ConsultationSoap',
      resourceId: consultation.id,
      ipAddress: input.auditContext.ipAddress,
      userAgent: input.auditContext.userAgent,
      details: {
        signatureHash,
        cedulaProfesional: input.cedulaProfesional,
      },
    });

    return {
      signatureHash,
      signedAt: consultation.signedAt!,
    };
  }
}
