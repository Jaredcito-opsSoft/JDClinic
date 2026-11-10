import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../../driven/persistence/prisma.client.js';
import { auditRepo } from '../../../../config/dependency-container.js';
import { cleanStudyName, createStudyUpload, isSupportedStudy, STUDY_MIME_TYPES, studyReadUrl, verifyStudyObject } from '../../../../storage/clinical-storage.service.js';

const initiateSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.enum(STUDY_MIME_TYPES),
  sizeBytes: z.number().int().positive(),
  consultationId: z.string().uuid().optional(),
});

const audit = (req: Request, action: string, attachmentId: string) => ({
  userId: req.user!.id, action, resource: 'ClinicalAttachment', resourceId: attachmentId,
  ipAddress: req.ip || 'unknown', userAgent: req.header('user-agent') || 'unknown',
});

export const attachmentsController = {
  list: async (req: Request, res: Response) => {
    const patient = await prisma.patient.findFirst({ where: { id: req.params.patientId, deleted_at: null }, select: { id: true } });
    if (!patient) return res.status(404).json({ success: false, message: 'Paciente no encontrado.' });
    const rows = await prisma.clinicalAttachment.findMany({
      where: { patient_id: patient.id, status: 'READY' }, orderBy: { created_at: 'desc' },
      select: { id: true, file_name: true, mime_type: true, file_size_bytes: true, created_at: true, uploaded_by: { select: { first_name: true, last_name: true } } },
    });
    res.json({ success: true, data: rows.map(row => ({ id: row.id, fileName: row.file_name, mimeType: row.mime_type, sizeBytes: Number(row.file_size_bytes), createdAt: row.created_at, uploadedBy: `${row.uploaded_by.first_name} ${row.uploaded_by.last_name}` })) });
  },

  initiate: async (req: Request, res: Response) => {
    const parsed = initiateSchema.safeParse(req.body);
    if (!parsed.success || !isSupportedStudy(parsed.data.mimeType, parsed.data.sizeBytes)) return res.status(400).json({ success: false, message: 'Selecciona un PDF, JPG o PNG de hasta 10 MB.' });
    const patient = await prisma.patient.findFirst({ where: { id: req.params.patientId, is_active: true, deleted_at: null }, select: { id: true } });
    if (!patient) return res.status(404).json({ success: false, message: 'Paciente no encontrado.' });
    if (parsed.data.consultationId) {
      const consultation = await prisma.consultationSoap.findFirst({ where: { id: parsed.data.consultationId, patient_id: patient.id }, select: { id: true } });
      if (!consultation) return res.status(400).json({ success: false, message: 'La consulta no pertenece al paciente.' });
    }
    try {
      const upload = await createStudyUpload(patient.id, parsed.data.mimeType);
      const row = await prisma.clinicalAttachment.create({ data: {
        patient_id: patient.id, consultation_id: parsed.data.consultationId || null, uploaded_by_id: req.user!.id,
        file_name: cleanStudyName(parsed.data.fileName), mime_type: parsed.data.mimeType,
        file_size_bytes: BigInt(parsed.data.sizeBytes), s3_bucket: upload.bucket, s3_key: upload.key,
        status: 'PENDING', upload_expires_at: upload.expiresAt,
      } });
      res.status(201).json({ success: true, data: { id: row.id, url: upload.url, fields: upload.fields, expiresAt: upload.expiresAt } });
    } catch {
      res.status(503).json({ success: false, message: 'El archivo de estudios no está disponible. Revisa la configuración de almacenamiento.' });
    }
  },

  finalize: async (req: Request, res: Response) => {
    const row = await prisma.clinicalAttachment.findFirst({ where: { id: req.params.id, patient_id: req.params.patientId } });
    if (!row) return res.status(404).json({ success: false, message: 'Archivo no encontrado.' });
    if (row.status === 'READY') return res.json({ success: true, data: { id: row.id, ready: true } });
    if (row.status !== 'PENDING') return res.status(409).json({ success: false, message: 'La carga fue rechazada.' });
    if (row.uploaded_by_id !== req.user!.id && req.user!.role !== 'ADMINISTRADOR') return res.status(403).json({ success: false, message: 'Sólo quien inició la carga puede completarla.' });
    if (row.upload_expires_at && row.upload_expires_at.getTime() + 5 * 60 * 1000 < Date.now()) return res.status(410).json({ success: false, message: 'La carga venció. Selecciona el archivo de nuevo.' });
    try {
      await verifyStudyObject({ bucket: row.s3_bucket, key: row.s3_key, mimeType: row.mime_type as typeof STUDY_MIME_TYPES[number], sizeBytes: Number(row.file_size_bytes) });
      await prisma.clinicalAttachment.update({ where: { id: row.id }, data: { status: 'READY' } });
      await auditRepo.appendLog(audit(req, 'ATTACHMENT_UPLOAD', row.id));
      res.json({ success: true, data: { id: row.id, ready: true } });
    } catch {
      res.status(422).json({ success: false, message: 'No se pudo verificar el estudio. Intenta subirlo de nuevo.' });
    }
  },

  readUrl: async (req: Request, res: Response) => {
    const row = await prisma.clinicalAttachment.findFirst({ where: { id: req.params.id, patient_id: req.params.patientId, status: 'READY', patient: { deleted_at: null } } });
    if (!row) return res.status(404).json({ success: false, message: 'Estudio no encontrado.' });
    try {
      const url = await studyReadUrl(row.s3_bucket, row.s3_key);
      await auditRepo.appendLog(audit(req, 'ATTACHMENT_DOWNLOAD', row.id));
      res.setHeader('Cache-Control', 'private, no-store');
      res.json({ success: true, data: { url, expiresAt: new Date(Date.now() + 15 * 60 * 1000) } });
    } catch {
      res.status(503).json({ success: false, message: 'No se pudo abrir el estudio en este momento.' });
    }
  },
};
