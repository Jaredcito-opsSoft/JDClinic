import { IConsultationRepository } from '../../../../core/domain/ports/repositories/consultation.repository.port.js';
import { ConsultationSoap } from '../../../../core/domain/entities/consultation-soap.entity.js';

export class InMemoryConsultationRepository implements IConsultationRepository {
  private consultations: Map<string, ConsultationSoap> = new Map();

  public async findById(id: string): Promise<ConsultationSoap | null> {
    return this.consultations.get(id) || null;
  }

  public async findByPatientId(patientId: string): Promise<ConsultationSoap[]> {
    return Array.from(this.consultations.values()).filter(c => c.patientId === patientId);
  }

  public async save(consultation: ConsultationSoap): Promise<void> {
    this.consultations.set(consultation.id, consultation);
  }

  public async updateSignature(consultation: ConsultationSoap): Promise<void> {
    this.consultations.set(consultation.id, consultation);
  }
}
