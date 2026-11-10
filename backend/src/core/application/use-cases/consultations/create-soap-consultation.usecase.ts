import crypto from 'node:crypto';
import { IEncryptionService } from '../../../domain/ports/services/encryption.service.port.js';
import { IConsultationRepository } from '../../../domain/ports/repositories/consultation.repository.port.js';
import { IAuditLogRepository } from '../../../domain/ports/repositories/audit-log.repository.port.js';
import { ConsultationSoap } from '../../../domain/entities/consultation-soap.entity.js';
import { EncryptedClinicalData } from '../../../domain/value-objects/encrypted-clinical-data.vo.js';

export interface CreateSoapConsultationInput {
  patientId: string;
  doctorId: string;
  vitalSignsId?: string;
  subjective: string;
  objective: string;
  analysis: string;
  primaryIcd10Code: string;
  secondaryIcd10Codes?: string[];
  plan: string;
  auditContext: {
    ipAddress: string;
    userAgent: string;
  };
}

export class CreateSoapConsultationUseCase {
  constructor(
    private readonly consultationRepo: IConsultationRepository,
    private readonly encryptionService: IEncryptionService,
    private readonly auditRepo: IAuditLogRepository
  ) {}

  public async execute(input: CreateSoapConsultationInput): Promise<{ consultationId: string }> {
    // 1. Cifrado a nivel de campo (FLE AES-256-GCM) de los 4 ejes SOAP
    const encSubjective = this.encryptionService.encrypt(input.subjective);
    const encObjective = this.encryptionService.encrypt(input.objective);
    const encAnalysis = this.encryptionService.encrypt(input.analysis);
    const encPlan = this.encryptionService.encrypt(input.plan);

    const consultationId = crypto.randomUUID();

    // 2. Creación de la entidad de dominio
    const consultation = new ConsultationSoap({
      id: consultationId,
      patientId: input.patientId,
      doctorId: input.doctorId,
      vitalSignsId: input.vitalSignsId || null,
      status: 'BORRADOR',
      subjective: new EncryptedClinicalData(encSubjective.ciphertext, encSubjective.iv, encSubjective.tag),
      objective: new EncryptedClinicalData(encObjective.ciphertext, encObjective.iv, encObjective.tag),
      analysis: new EncryptedClinicalData(encAnalysis.ciphertext, encAnalysis.iv, encAnalysis.tag),
      primaryIcd10Code: input.primaryIcd10Code,
      secondaryIcd10Codes: input.secondaryIcd10Codes || [],
      plan: new EncryptedClinicalData(encPlan.ciphertext, encPlan.iv, encPlan.tag),
      createdAt: new Date(),
    });

    // 3. Persistencia mediante el puerto
    await this.consultationRepo.save(consultation);

    // 4. Registro inmutable en pista de auditoría (NOM-024)
    await this.auditRepo.appendLog({
      userId: input.doctorId,
      action: 'RECORD_CREATE',
      resource: 'ConsultationSoap',
      resourceId: consultationId,
      ipAddress: input.auditContext.ipAddress,
      userAgent: input.auditContext.userAgent,
      details: {
        patientId: input.patientId,
        primaryIcd10: input.primaryIcd10Code,
      },
    });

    return { consultationId };
  }
}
