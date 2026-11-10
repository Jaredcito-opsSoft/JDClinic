import { IConsultationRepository } from '../../../../core/domain/ports/repositories/consultation.repository.port.js';
import { ConsultationSoap, ConsultationStatus } from '../../../../core/domain/entities/consultation-soap.entity.js';
import { EncryptedClinicalData } from '../../../../core/domain/value-objects/encrypted-clinical-data.vo.js';
import { prisma } from './prisma.client.js';

export class PrismaConsultationRepository implements IConsultationRepository {
  public async findById(id: string): Promise<ConsultationSoap | null> {
    const record = await prisma.consultationSoap.findUnique({
      where: { id },
    });

    if (!record) return null;

    return new ConsultationSoap({
      id: record.id,
      patientId: record.patient_id,
      doctorId: record.doctor_id,
      vitalSignsId: record.vital_signs_id,
      parentConsultationId: record.parent_consultation_id,
      status: record.status as ConsultationStatus,
      subjective: new EncryptedClinicalData(
        record.subjective_ciphertext,
        record.subjective_iv,
        record.subjective_tag
      ),
      objective: new EncryptedClinicalData(
        record.objective_ciphertext,
        record.objective_iv,
        record.objective_tag
      ),
      analysis: new EncryptedClinicalData(
        record.analysis_ciphertext,
        record.analysis_iv,
        record.analysis_tag
      ),
      primaryIcd10Code: record.primary_icd10_code,
      secondaryIcd10Codes: record.secondary_icd10_codes,
      plan: new EncryptedClinicalData(
        record.plan_ciphertext,
        record.plan_iv,
        record.plan_tag
      ),
      digitalSignatureHash: record.digital_signature_hash,
      signedAt: record.signed_at,
      createdAt: record.created_at,
    });
  }

  public async findByPatientId(patientId: string): Promise<ConsultationSoap[]> {
    const records = await prisma.consultationSoap.findMany({
      where: { patient_id: patientId },
      orderBy: { created_at: 'desc' },
    });

    return records.map((record: any) => new ConsultationSoap({
      id: record.id,
      patientId: record.patient_id,
      doctorId: record.doctor_id,
      vitalSignsId: record.vital_signs_id,
      parentConsultationId: record.parent_consultation_id,
      status: record.status as ConsultationStatus,
      subjective: new EncryptedClinicalData(
        record.subjective_ciphertext,
        record.subjective_iv,
        record.subjective_tag
      ),
      objective: new EncryptedClinicalData(
        record.objective_ciphertext,
        record.objective_iv,
        record.objective_tag
      ),
      analysis: new EncryptedClinicalData(
        record.analysis_ciphertext,
        record.analysis_iv,
        record.analysis_tag
      ),
      primaryIcd10Code: record.primary_icd10_code,
      secondaryIcd10Codes: record.secondary_icd10_codes,
      plan: new EncryptedClinicalData(
        record.plan_ciphertext,
        record.plan_iv,
        record.plan_tag
      ),
      digitalSignatureHash: record.digital_signature_hash,
      signedAt: record.signed_at,
      createdAt: record.created_at,
    }));
  }

  public async save(consultation: ConsultationSoap): Promise<void> {
    await prisma.consultationSoap.upsert({
      where: { id: consultation.id },
      update: {
        status: consultation.status,
        subjective_ciphertext: consultation.subjective.ciphertext,
        subjective_iv: consultation.subjective.iv,
        subjective_tag: consultation.subjective.tag,
        objective_ciphertext: consultation.objective.ciphertext,
        objective_iv: consultation.objective.iv,
        objective_tag: consultation.objective.tag,
        analysis_ciphertext: consultation.analysis.ciphertext,
        analysis_iv: consultation.analysis.iv,
        analysis_tag: consultation.analysis.tag,
        primary_icd10_code: consultation.primaryIcd10Code,
        secondary_icd10_codes: consultation.secondaryIcd10Codes,
        plan_ciphertext: consultation.plan.ciphertext,
        plan_iv: consultation.plan.iv,
        plan_tag: consultation.plan.tag,
        digital_signature_hash: consultation.digitalSignatureHash ?? null,
        signed_at: consultation.signedAt ?? null,
      },
      create: {
        id: consultation.id,
        patient_id: consultation.patientId,
        doctor_id: consultation.doctorId,
        vital_signs_id: consultation.vitalSignsId ?? null,
        parent_consultation_id: consultation.parentConsultationId ?? null,
        status: consultation.status,
        subjective_ciphertext: consultation.subjective.ciphertext,
        subjective_iv: consultation.subjective.iv,
        subjective_tag: consultation.subjective.tag,
        objective_ciphertext: consultation.objective.ciphertext,
        objective_iv: consultation.objective.iv,
        objective_tag: consultation.objective.tag,
        analysis_ciphertext: consultation.analysis.ciphertext,
        analysis_iv: consultation.analysis.iv,
        analysis_tag: consultation.analysis.tag,
        primary_icd10_code: consultation.primaryIcd10Code,
        secondary_icd10_codes: consultation.secondaryIcd10Codes,
        plan_ciphertext: consultation.plan.ciphertext,
        plan_iv: consultation.plan.iv,
        plan_tag: consultation.plan.tag,
        digital_signature_hash: consultation.digitalSignatureHash ?? null,
        signed_at: consultation.signedAt ?? null,
        created_at: consultation.createdAt,
      },
    });
  }

  public async updateSignature(consultation: ConsultationSoap): Promise<void> {
    await prisma.consultationSoap.update({
      where: { id: consultation.id },
      data: {
        status: consultation.status,
        digital_signature_hash: consultation.digitalSignatureHash,
        signed_at: consultation.signedAt,
      },
    });
  }
}
