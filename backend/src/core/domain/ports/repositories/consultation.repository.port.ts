import { ConsultationSoap } from '../../entities/consultation-soap.entity.js';

export interface IConsultationRepository {
  findById(id: string): Promise<ConsultationSoap | null>;
  findByPatientId(patientId: string): Promise<ConsultationSoap[]>;
  save(consultation: ConsultationSoap): Promise<void>;
  updateSignature(consultation: ConsultationSoap): Promise<void>;
}
