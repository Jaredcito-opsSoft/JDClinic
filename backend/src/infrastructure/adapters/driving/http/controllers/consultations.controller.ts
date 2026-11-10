import { Request, Response } from 'express';
import { CreateSoapConsultationUseCase } from '../../../../../core/application/use-cases/consultations/create-soap-consultation.usecase.js';
import { SignSoapConsultationUseCase } from '../../../../../core/application/use-cases/consultations/sign-soap-consultation.usecase.js';
import { IConsultationRepository } from '../../../../../core/domain/ports/repositories/consultation.repository.port.js';
import { IEncryptionService } from '../../../../../core/domain/ports/services/encryption.service.port.js';
import { ConsultationSoap } from '../../../../../core/domain/entities/consultation-soap.entity.js';
import { z } from 'zod';
import { prisma } from '../../../driven/persistence/prisma.client.js';

const createConsultationSchema = z.object({
  patientId: z.string().uuid(),
  vitalSignsId: z.string().uuid().optional(),
  subjective: z.string().trim().min(10).max(10000),
  objective: z.string().trim().min(10).max(10000),
  analysis: z.string().trim().min(10).max(10000),
  primaryIcd10Code: z.string().trim().min(3).max(10),
  secondaryIcd10Codes: z.array(z.string().trim().min(3).max(10)).max(10).optional(),
  plan: z.string().trim().min(10).max(10000),
});

export class ConsultationsController {
  constructor(
    private readonly createSoapUseCase: CreateSoapConsultationUseCase,
    private readonly signSoapUseCase: SignSoapConsultationUseCase,
    private readonly consultationRepo: IConsultationRepository,
    private readonly encryptionService: IEncryptionService
  ) {}

  public create = async (req: Request, res: Response): Promise<void> => {
    try {
      const doctorId = req.user!.id;
      const parsed = createConsultationSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, message: 'La nota SOAP está incompleta o contiene datos inválidos.', issues: parsed.error.flatten().fieldErrors });
        return;
      }
      const { patientId, vitalSignsId, subjective, objective, analysis, primaryIcd10Code, secondaryIcd10Codes, plan } = parsed.data;

      const [patient, doctor, vitals] = await Promise.all([
        prisma.patient.findFirst({ where: { id: patientId, deleted_at: null, is_active: true }, select: { id: true } }),
        prisma.user.findFirst({ where: { id: doctorId, is_active: true, role: { in: ['MEDICO_GENERAL', 'MEDICO_ESPECIALISTA'] } }, select: { id: true } }),
        vitalSignsId ? prisma.vitalSigns.findUnique({ where: { id: vitalSignsId }, select: { patient_id: true } }) : Promise.resolve(null),
      ]);
      if (!patient) { res.status(404).json({ success: false, message: 'El paciente no existe o está inactivo.' }); return; }
      if (!doctor) { res.status(403).json({ success: false, message: 'El profesional no está habilitado para crear notas.' }); return; }
      if (vitalSignsId && (!vitals || vitals.patient_id !== patientId)) { res.status(400).json({ success: false, message: 'Los signos vitales no pertenecen al paciente seleccionado.' }); return; }

      const result = await this.createSoapUseCase.execute({
        patientId,
        doctorId,
        vitalSignsId,
        subjective,
        objective,
        analysis,
        primaryIcd10Code,
        secondaryIcd10Codes,
        plan,
        auditContext: {
          ipAddress: req.ip || '127.0.0.1',
          userAgent: req.headers['user-agent'] || 'unknown',
        },
      });

      res.status(201).json({
        success: true,
        message: 'Nota SOAP registrada en borrador con cifrado FLE (AES-256-GCM).',
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  };

  public sign = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const doctorId = req.user!.id;
      const cedulaProfesional = req.user!.cedulaProfesional;
      if (!cedulaProfesional) {
        res.status(400).json({ success: false, message: 'La cédula profesional es obligatoria para firmar una nota clínica.' });
        return;
      }

      const result = await this.signSoapUseCase.execute({
        consultationId: id,
        doctorId,
        cedulaProfesional,
        auditContext: {
          ipAddress: req.ip || '127.0.0.1',
          userAgent: req.headers['user-agent'] || 'unknown',
        },
      });

      res.status(200).json({
        success: true,
        message: 'Nota médica firmada exitosamente. El registro es ahora INMUTABLE (NOM-004-SSA3-2012).',
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  };

  public getByPatient = async (req: Request, res: Response): Promise<void> => {
    try {
      const { patientId } = req.params;
      const consultations = await this.consultationRepo.findByPatientId(patientId);

      // Desciframos para el médico autenticado
      const decryptedConsultations = consultations.map((c: ConsultationSoap) => ({
        id: c.id,
        patientId: c.patientId,
        doctorId: c.doctorId,
        parentConsultationId: c.parentConsultationId,
        status: c.status,
        subjective: this.encryptionService.decrypt(c.subjective),
        objective: this.encryptionService.decrypt(c.objective),
        analysis: this.encryptionService.decrypt(c.analysis),
        primaryIcd10Code: c.primaryIcd10Code,
        plan: this.encryptionService.decrypt(c.plan),
        digitalSignatureHash: c.digitalSignatureHash,
        signedAt: c.signedAt,
        createdAt: c.createdAt,
      }));

      res.status(200).json({
        success: true,
        data: decryptedConsultations,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };
}
