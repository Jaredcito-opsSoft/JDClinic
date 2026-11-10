import { EncryptedClinicalData } from '../value-objects/encrypted-clinical-data.vo.js';

export type ConsultationStatus = 'BORRADOR' | 'FIRMADA' | 'ANULADA_POR_ADENDA';

export interface ConsultationSoapProps {
  id: string;
  patientId: string;
  doctorId: string;
  vitalSignsId?: string | null;
  parentConsultationId?: string | null;
  status: ConsultationStatus;
  subjective: EncryptedClinicalData;
  objective: EncryptedClinicalData;
  analysis: EncryptedClinicalData;
  primaryIcd10Code: string;
  secondaryIcd10Codes: string[];
  plan: EncryptedClinicalData;
  digitalSignatureHash?: string | null;
  signedAt?: Date | null;
  createdAt: Date;
}

export class ConsultationSoap {
  private props: ConsultationSoapProps;

  constructor(props: ConsultationSoapProps) {
    this.props = props;
  }

  public get id(): string { return this.props.id; }
  public get patientId(): string { return this.props.patientId; }
  public get doctorId(): string { return this.props.doctorId; }
  public get vitalSignsId(): string | null | undefined { return this.props.vitalSignsId; }
  public get parentConsultationId(): string | null | undefined { return this.props.parentConsultationId; }
  public get status(): ConsultationStatus { return this.props.status; }
  public get subjective(): EncryptedClinicalData { return this.props.subjective; }
  public get objective(): EncryptedClinicalData { return this.props.objective; }
  public get analysis(): EncryptedClinicalData { return this.props.analysis; }
  public get primaryIcd10Code(): string { return this.props.primaryIcd10Code; }
  public get secondaryIcd10Codes(): string[] { return this.props.secondaryIcd10Codes; }
  public get plan(): EncryptedClinicalData { return this.props.plan; }
  public get digitalSignatureHash(): string | null | undefined { return this.props.digitalSignatureHash; }
  public get signedAt(): Date | null | undefined { return this.props.signedAt; }
  public get createdAt(): Date { return this.props.createdAt; }

  /**
   * REGLA CLÍNICA NOM-004-SSA3-2012:
   * Una nota firmada es inmutable. No se permite UPDATE de sus campos clínicos.
   */
  public assertIsEditable(): void {
    if (this.props.status === 'FIRMADA' || this.props.status === 'ANULADA_POR_ADENDA') {
      throw new Error(
        'REGLA CLÍNICA VIOLADA: La nota médica se encuentra firmada y es inmutable. Registre una adenda aclaratoria.'
      );
    }
  }

  /**
   * Sella y firma la nota médica generando la fecha y el hash digital de no repudio.
   */
  public sign(signatureHash: string): void {
    this.assertIsEditable();
    this.props.status = 'FIRMADA';
    this.props.digitalSignatureHash = signatureHash;
    this.props.signedAt = new Date();
  }

  public toJSON() {
    return {
      ...this.props,
      subjective: this.props.subjective.toJSON(),
      objective: this.props.objective.toJSON(),
      analysis: this.props.analysis.toJSON(),
      plan: this.props.plan.toJSON(),
    };
  }
}
