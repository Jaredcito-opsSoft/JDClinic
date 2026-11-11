import { randomBytes, createHash } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { Request, Response } from 'express';
import { AppointmentStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../../driven/persistence/prisma.client.js';
import { auditRepo, encryptionAdapter } from '../../../../config/dependency-container.js';
import { processNotifications, publicNotificationStatus, queueAppointmentChange, queueAppointmentConfirmation, queueReminder, queueWaitingRoom } from '../../../../notifications/notification.service.js';
import { isPrescriptionSignatureValid, renderPrescriptionPdf, signPrescription } from '../../../../documents/prescription-document.service.js';
import { AppointmentUnavailableError, OCCUPYING_STATUSES, allowedAppointmentStatuses, appointmentTransaction, findAppointmentConflict } from '../../../../appointments/appointment-availability.service.js';
import { clinicDateKey, clinicDayRange, isValidDateKey } from '../../../../appointments/clinic-time.service.js';

const appointmentSchema = z.object({
  patientId: z.string().uuid(),
  doctorId: z.string().uuid().optional(),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(10).max(240).default(30),
  reason: z.string().trim().max(255).optional(),
});
const appointmentEditSchema = appointmentSchema.partial().refine(value => Object.keys(value).length > 0);
const availabilitySchema = appointmentSchema.pick({ patientId: true, doctorId: true, scheduledAt: true }).extend({
  durationMinutes: z.coerce.number().int().min(10).max(240).default(30),
  excludeId: z.string().uuid().optional(),
});
const availabilityError = (res: Response, error: unknown) => {
  if (error instanceof AppointmentUnavailableError) {
    return res.status(409).json({ success: false, message: error.message, conflict: error.conflict });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
    return res.status(409).json({ success: false, message: 'La disponibilidad cambió durante la reserva. Intenta de nuevo.' });
  }
  throw error;
};

const statusSchema = z.object({ status: z.nativeEnum(AppointmentStatus) });
const prescriptionSchema = z.object({
  consultationId: z.string().uuid(),
  expirationDate: z.string().date(),
  instructions: z.string().trim().min(3).max(4000),
  items: z.array(z.object({
    medicationName: z.string().trim().min(2).max(150),
    genericName: z.string().trim().max(150).optional(),
    presentation: z.string().trim().min(2).max(100),
    dosage: z.string().trim().min(1).max(100),
    frequency: z.string().trim().min(1).max(100),
    durationDays: z.number().int().min(1).max(365),
    routeAdministration: z.string().trim().min(2).max(50),
  })).min(1).max(20),
});

const adendaSchema = z.object({ text: z.string().trim().min(20).max(10000) });
const clinicToday = () => clinicDateKey();

export const operationsController = {
  dashboard: async (req: Request, res: Response) => {
    const { start, end } = clinicDayRange();
    const doctorWhere = req.user!.role.startsWith('MEDICO') ? { doctor_id: req.user!.id } : {};
    const [appointments, patientCount, signedToday] = await Promise.all([
      prisma.appointment.findMany({
        where: { scheduled_at: { gte: start, lt: end }, ...doctorWhere },
        orderBy: { scheduled_at: 'asc' },
        include: { patient: { select: { id: true, expediente_folio: true, first_name: true, last_name: true } }, doctor: { select: { first_name: true, last_name: true } } },
      }),
      prisma.patient.count({ where: { is_active: true, deleted_at: null } }),
      prisma.consultationSoap.count({ where: { signed_at: { gte: start, lt: end }, ...(req.user!.role.startsWith('MEDICO') ? { doctor_id: req.user!.id } : {}) } }),
    ]);
    const now = new Date();
    const upcoming = appointments.filter(a =>
      (a.scheduled_at >= now || ['EN_SALA_DE_ESPERA', 'EN_CONSULTA'].includes(a.status))
      && !['CANCELADA', 'NO_ASISTIO', 'COMPLETADA'].includes(a.status));
    res.json({ success: true, data: { patientCount, signedToday, waiting: appointments.filter(a => a.status === 'EN_SALA_DE_ESPERA').length, appointments: upcoming.map(mapAppointment) } });
  },

  listAppointments: async (req: Request, res: Response) => {
    const requestedDate = String(req.query.date || '');
    if (requestedDate && !isValidDateKey(requestedDate)) return res.status(400).json({ success: false, message: 'Selecciona una fecha válida.' });
    const { start, end } = clinicDayRange(requestedDate || undefined);
    const doctorWhere = req.user!.role.startsWith('MEDICO') ? { doctor_id: req.user!.id } : {};
    const rows = await prisma.appointment.findMany({ where: { scheduled_at: { gte: start, lt: end }, ...doctorWhere }, orderBy: { scheduled_at: 'asc' }, include: appointmentInclude });
    res.json({ success: true, data: rows.map(mapAppointment) });
  },

  appointmentAvailability: async (req: Request, res: Response) => {
    const parsed = availabilitySchema.safeParse({ ...req.query, durationMinutes: req.query.durationMinutes ?? 30 });
    if (!parsed.success) return res.status(400).json({ success: false, message: 'Selecciona paciente, médico, fecha y duración válidos.' });
    const input = parsed.data;
    const doctorId = req.user!.role.startsWith('MEDICO') ? req.user!.id : input.doctorId;
    if (!doctorId) return res.status(400).json({ success: false, message: 'Selecciona un médico.' });
    const scheduledAt = new Date(input.scheduledAt);
    const slot = { patientId: input.patientId, doctorId, scheduledAt, durationMinutes: input.durationMinutes, excludeId: input.excludeId };
    if (input.excludeId) {
      const original = await prisma.appointment.findUnique({ where: { id: input.excludeId } });
      if (original && original.patient_id === slot.patientId && original.doctor_id === slot.doctorId
        && original.scheduled_at.getTime() === slot.scheduledAt.getTime() && original.duration_minutes === slot.durationMinutes) {
        return res.json({ success: true, data: { available: true, conflict: { patient: false, doctor: false }, alternatives: [] } });
      }
    }
    const conflict = await findAppointmentConflict(prisma, slot);
    const unavailable = conflict.patient || conflict.doctor;
    const alternatives: string[] = [];
    if (unavailable) {
      const step = 15 * 60_000;
      const first = Math.ceil((scheduledAt.getTime() + 1) / step) * step;
      for (let time = first; time < first + 6 * 60 * 60_000 && alternatives.length < 3; time += step) {
        const candidate = new Date(time);
        if (clinicDateKey(candidate) !== clinicDateKey(scheduledAt)) break;
        if (time <= Date.now()) continue;
        const busy = await findAppointmentConflict(prisma, { ...slot, scheduledAt: candidate });
        if (!busy.patient && !busy.doctor) alternatives.push(candidate.toISOString());
      }
    }
    res.json({ success: true, data: { available: !unavailable, conflict, alternatives } });
  },

  createAppointment: async (req: Request, res: Response) => {
    const parsed = appointmentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: 'Revisa paciente, médico, fecha y duración de la cita.' });
    const input = parsed.data;
    const doctorId = req.user!.role.startsWith('MEDICO') ? req.user!.id : input.doctorId;
    if (!doctorId) return res.status(400).json({ success: false, message: 'Selecciona al médico responsable.' });
    const scheduledAt = new Date(input.scheduledAt);
    if (scheduledAt < new Date()) return res.status(400).json({ success: false, message: 'La cita debe programarse en una fecha futura.' });
    let row;
    try {
      row = await appointmentTransaction(async tx => {
        const conflict = await findAppointmentConflict(tx, { patientId: input.patientId, doctorId, scheduledAt, durationMinutes: input.durationMinutes });
        if (conflict.patient || conflict.doctor) throw new AppointmentUnavailableError(conflict);
        const created = await tx.appointment.create({ data: { patient_id: input.patientId, doctor_id: doctorId, scheduled_at: scheduledAt, duration_minutes: input.durationMinutes, reason: input.reason } });
        await queueAppointmentConfirmation(tx, created.id);
        await queueReminder(tx, created.id, scheduledAt);
        return tx.appointment.findUniqueOrThrow({ where: { id: created.id }, include: appointmentInclude });
      });
    } catch (error) { return availabilityError(res, error); }
    await auditRepo.appendLog(audit(req, 'RECORD_CREATE', 'appointment', row.id, { scheduledAt: input.scheduledAt }));
    res.status(201).json({ success: true, data: mapAppointment(row) });
  },

  updateAppointment: async (req: Request, res: Response) => {
    const parsed = appointmentEditSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: 'Revisa los datos de la cita.' });
    try {
      const row = await appointmentTransaction(async tx => {
        const current = await tx.appointment.findUnique({ where: { id: req.params.id } });
        if (!current) return null;
        if (req.user!.role.startsWith('MEDICO') && current.doctor_id !== req.user!.id) return 'FORBIDDEN' as const;
        if (allowedAppointmentStatuses(current.status).length === 0) return 'TERMINAL' as const;
        const input = parsed.data;
        const doctorId = req.user!.role.startsWith('MEDICO') ? req.user!.id : input.doctorId ?? current.doctor_id;
        const patientId = input.patientId ?? current.patient_id;
        if (patientId !== current.patient_id) return 'PATIENT_CHANGE' as const;
        const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : current.scheduled_at;
        const durationMinutes = input.durationMinutes ?? current.duration_minutes;
        if (scheduledAt < new Date()) return 'PAST' as const;
        const changed = patientId !== current.patient_id || doctorId !== current.doctor_id
          || scheduledAt.getTime() !== current.scheduled_at.getTime() || durationMinutes !== current.duration_minutes;
        if (changed && OCCUPYING_STATUSES.includes(current.status)) {
          const conflict = await findAppointmentConflict(tx, { patientId, doctorId, scheduledAt, durationMinutes, excludeId: current.id });
          if (conflict.patient || conflict.doctor) throw new AppointmentUnavailableError(conflict);
        }
        const updated = await tx.appointment.update({ where: { id: current.id }, data: {
          patient_id: patientId, doctor_id: doctorId, scheduled_at: scheduledAt, duration_minutes: durationMinutes,
          reason: input.reason ?? current.reason, ...(changed ? { telegram_reminder_sent: false } : {}),
        } });
        if (changed && OCCUPYING_STATUSES.includes(updated.status)) {
          const now = new Date();
          await queueAppointmentChange(tx, updated.id, 'UPDATED');
          const dueAt = new Date(scheduledAt.getTime() - 24 * 60 * 60_000);
          await tx.notificationDelivery.upsert({ where: { appointment_id_type: { appointment_id: updated.id, type: 'APPOINTMENT_REMINDER_PATIENT' } },
            create: { appointment_id: updated.id, type: 'APPOINTMENT_REMINDER_PATIENT', due_at: dueAt, next_attempt_at: dueAt, status: dueAt > now ? 'PENDING' : 'SKIPPED', last_error: dueAt > now ? null : 'Cita reprogramada con menos de 24 horas de anticipación.' },
            update: { due_at: dueAt, next_attempt_at: dueAt, status: dueAt > now ? 'PENDING' : 'SKIPPED', attempts: 0, sent_at: null, locked_at: null, last_error: dueAt > now ? null : 'Cita reprogramada con menos de 24 horas de anticipación.' },
          });
        }
        return tx.appointment.findUniqueOrThrow({ where: { id: updated.id }, include: appointmentInclude });
      });
      if (!row) return res.status(404).json({ success: false, message: 'Cita no encontrada.' });
      if (row === 'FORBIDDEN') return res.status(403).json({ success: false, message: 'No puedes modificar la agenda de otro médico.' });
      if (row === 'TERMINAL') return res.status(409).json({ success: false, message: 'Una cita finalizada conserva su historial y no se reprograma.' });
      if (row === 'PATIENT_CHANGE') return res.status(409).json({ success: false, message: 'No se puede cambiar el paciente de una cita existente. Programa una cita nueva.' });
      if (row === 'PAST') return res.status(400).json({ success: false, message: 'La cita debe programarse en una fecha futura.' });
      await auditRepo.appendLog(audit(req, 'RECORD_CREATE', 'appointment_update', row.id));
      return res.json({ success: true, data: mapAppointment(row) });
    } catch (error) { return availabilityError(res, error); }
  },

  updateAppointmentStatus: async (req: Request, res: Response) => {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: 'El estado de la cita no es válido.' });
    let row;
    try {
      row = await appointmentTransaction(async tx => {
        const current = await tx.appointment.findUnique({ where: { id: req.params.id } });
        if (!current) return null;
        if (req.user!.role.startsWith('MEDICO') && current.doctor_id !== req.user!.id) return 'FORBIDDEN' as const;
        if (current.status !== parsed.data.status && !allowedAppointmentStatuses(current.status).includes(parsed.data.status)) return 'INVALID_TRANSITION' as const;
        if (!OCCUPYING_STATUSES.includes(current.status) && OCCUPYING_STATUSES.includes(parsed.data.status)) {
          if (current.scheduled_at < new Date()) return 'PAST' as const;
          const conflict = await findAppointmentConflict(tx, {
            patientId: current.patient_id, doctorId: current.doctor_id,
            scheduledAt: current.scheduled_at, durationMinutes: current.duration_minutes, excludeId: current.id,
          });
          if (conflict.patient || conflict.doctor) throw new AppointmentUnavailableError(conflict);
        }
        const updated = await tx.appointment.update({ where: { id: current.id }, data: { status: parsed.data.status } });
        if (parsed.data.status === 'EN_SALA_DE_ESPERA' && current.status !== 'EN_SALA_DE_ESPERA') await queueWaitingRoom(tx, current.id);
        if (current.status !== parsed.data.status && allowedAppointmentStatuses(parsed.data.status).length === 0) {
          await tx.notificationDelivery.updateMany({
            where: { appointment_id: current.id, status: { in: ['PENDING', 'RETRY'] } },
            data: { status: 'SKIPPED', locked_at: null, last_error: 'La cita finalizó antes de enviar este aviso.' },
          });
          if (parsed.data.status === 'CANCELADA') await queueAppointmentChange(tx, current.id, 'CANCELLED');
        }
        return tx.appointment.findUniqueOrThrow({ where: { id: updated.id }, include: appointmentInclude });
      });
    } catch (error) { return availabilityError(res, error); }
    if (!row) return res.status(404).json({ success: false, message: 'Cita no encontrada.' });
    if (row === 'FORBIDDEN') return res.status(403).json({ success: false, message: 'No puedes modificar la agenda de otro médico.' });
    if (row === 'INVALID_TRANSITION') return res.status(409).json({ success: false, message: 'Este cambio de estado no está permitido para la cita.' });
    if (row === 'PAST') return res.status(400).json({ success: false, message: 'No se puede reactivar una cita con fecha pasada.' });
    await auditRepo.appendLog(audit(req, 'RECORD_CREATE', 'appointment_status', row.id, { status: parsed.data.status }));
    res.json({ success: true, data: mapAppointment(row) });
  },

  listDoctors: async (_req: Request, res: Response) => {
    const doctors = await prisma.user.findMany({ where: { is_active: true, role: { in: ['MEDICO_GENERAL', 'MEDICO_ESPECIALISTA'] } }, orderBy: [{ first_name: 'asc' }], select: { id: true, first_name: true, last_name: true, especialidad: true } });
    res.json({ success: true, data: doctors.map(d => ({ id: d.id, name: `${d.first_name} ${d.last_name}`, specialty: d.especialidad })) });
  },

  retryNotification: async (req: Request, res: Response) => {
    const row = await prisma.notificationDelivery.findUnique({ where: { id: req.params.notificationId }, include: { appointment: true } });
    if (!row || row.appointment_id !== req.params.id) return res.status(404).json({ success: false, message: 'Aviso no encontrado.' });
    if (req.user!.role.startsWith('MEDICO') && row.appointment.doctor_id !== req.user!.id) return res.status(403).json({ success: false, message: 'No tienes acceso a esta cita.' });
    if (!['FAILED', 'SKIPPED'].includes(row.status)) return res.status(409).json({ success: false, message: 'Este aviso ya está en proceso o fue enviado.' });
    if (['CANCELADA', 'NO_ASISTIO', 'COMPLETADA'].includes(row.appointment.status)
      && !(row.appointment.status === 'CANCELADA' && row.intent === 'CANCELLED')) return res.status(409).json({ success: false, message: 'La cita ya no admite avisos.' });
    if (row.appointment.scheduled_at <= new Date()) return res.status(409).json({ success: false, message: 'No se puede enviar un aviso de una cita que ya pasó.' });
    await prisma.notificationDelivery.update({ where: { id: row.id }, data: { status: 'PENDING', attempts: 0, next_attempt_at: new Date(), locked_at: null, last_error: null } });
    res.json({ success: true, data: { queued: true } });
    void processNotifications().catch(error => console.error('[Notificaciones] Error del envío manual:', error));
  },

  listPrescriptions: async (req: Request, res: Response) => {
    const rows = await prisma.prescription.findMany({ where: { patient_id: req.params.patientId }, orderBy: { created_at: 'desc' }, include: { items: true, doctor: { select: { first_name: true, last_name: true, cedula_profesional: true } }, consultation: { select: { primary_icd10_code: true } } } });
    res.json({ success: true, data: rows.map(p => ({ id: p.id, folio: `RX-${p.id.toUpperCase()}`, consultationId: p.consultation_id, verificationCode: p.qr_verification_code, expirationDate: p.expiration_date, createdAt: p.created_at, signatureHash: p.signature_hash, instructions: encryptionAdapter.decrypt({ ciphertext: p.instructions_ciphertext, iv: p.instructions_iv, tag: p.instructions_tag }), doctor: `${p.doctor.first_name} ${p.doctor.last_name}`, cedula: p.doctor.cedula_profesional, diagnosisCode: p.consultation.primary_icd10_code, items: p.items.map(i => ({ id: i.id, medicationName: i.medication_name, genericName: i.generic_name, presentation: i.presentation, dosage: i.dosage, frequency: i.frequency, durationDays: i.duration_days, routeAdministration: i.route_administration })) })) });
  },

  createPrescription: async (req: Request, res: Response) => {
    const parsed = prescriptionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: 'La receta requiere vigencia, indicaciones y al menos un medicamento completo.' });
    const input = parsed.data;
    const note = await prisma.consultationSoap.findUnique({ where: { id: input.consultationId } });
    if (!note || note.status !== 'FIRMADA') return res.status(400).json({ success: false, message: 'La receta debe asociarse a una nota clínica firmada.' });
    if (note.doctor_id !== req.user!.id) return res.status(403).json({ success: false, message: 'Sólo el médico autor de la nota puede emitir esta receta.' });
    const expiry = new Date(`${input.expirationDate}T00:00:00.000Z`);
    if (input.expirationDate < clinicToday()) return res.status(400).json({ success: false, message: 'La vigencia no puede estar en el pasado.' });
    const encrypted = encryptionAdapter.encrypt(input.instructions);
    const code = randomBytes(20).toString('hex');
    const id = randomUUID();
    const issuedAt = new Date();
    const signatureHash = signPrescription({ id, consultationId: note.id, patientId: note.patient_id, doctorId: req.user!.id, createdAt: issuedAt, expirationDate: expiry, instructions: input.instructions, items: input.items });
    try {
      const row = await prisma.prescription.create({ data: { id, created_at: issuedAt, consultation_id: note.id, patient_id: note.patient_id, doctor_id: req.user!.id, qr_verification_code: code, signature_hash: signatureHash, expiration_date: expiry, instructions_ciphertext: encrypted.ciphertext, instructions_iv: encrypted.iv, instructions_tag: encrypted.tag, items: { create: input.items.map(i => ({ medication_name: i.medicationName, generic_name: i.genericName, presentation: i.presentation, dosage: i.dosage, frequency: i.frequency, duration_days: i.durationDays, route_administration: i.routeAdministration })) } }, include: { items: true } });
      await auditRepo.appendLog(audit(req, 'PRESCRIPTION_ISSUE', 'prescription', row.id, { consultationId: note.id }));
      res.status(201).json({ success: true, data: { id: row.id, folio: `RX-${row.id.toUpperCase()}`, verificationCode: code, expirationDate: row.expiration_date } });
    } catch (error: any) {
      res.status(error?.code === 'P2002' ? 409 : 400).json({ success: false, message: error?.code === 'P2002' ? 'Esta consulta ya tiene una receta emitida.' : 'No fue posible emitir la receta.' });
    }
  },

  prescriptionPdf: async (req: Request, res: Response) => {
    const row = await prisma.prescription.findUnique({ where: { id: req.params.id }, include: {
      patient: { select: { first_name: true, last_name: true, expediente_folio: true } },
      doctor: { select: { first_name: true, last_name: true, cedula_profesional: true } },
      consultation: { select: { primary_icd10_code: true } }, items: true,
    } });
    if (!row) return res.status(404).json({ success: false, message: 'Receta no encontrada.' });
    const instructions = encryptionAdapter.decrypt({ ciphertext: row.instructions_ciphertext, iv: row.instructions_iv, tag: row.instructions_tag });
    const items = row.items.map(i => ({ medicationName: i.medication_name, genericName: i.generic_name, presentation: i.presentation, dosage: i.dosage, frequency: i.frequency, durationDays: i.duration_days, routeAdministration: i.route_administration }));
    const snapshot = { id: row.id, consultationId: row.consultation_id, patientId: row.patient_id, doctorId: row.doctor_id, createdAt: row.created_at, expirationDate: row.expiration_date, instructions, items };
    if (row.signature_hash && !isPrescriptionSignatureValid(snapshot, row.signature_hash)) return res.status(409).json({ success: false, message: 'La receta no superó la verificación de integridad.' });
    const pdf = await renderPrescriptionPdf({ ...snapshot, patientName: `${row.patient.first_name} ${row.patient.last_name}`, patientFolio: row.patient.expediente_folio, doctorName: `${row.doctor.first_name} ${row.doctor.last_name}`, doctorLicense: row.doctor.cedula_profesional, diagnosisCode: row.consultation.primary_icd10_code, verificationCode: row.qr_verification_code, signatureHash: row.signature_hash });
    await auditRepo.appendLog(audit(req, 'RECORD_READ', 'prescription_pdf', row.id));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="receta-${row.id}.pdf"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(pdf);
  },

  verifyPrescription: async (req: Request, res: Response) => {
    const row = await prisma.prescription.findUnique({ where: { qr_verification_code: req.params.code }, include: { doctor: { select: { first_name: true, last_name: true, cedula_profesional: true } } } });
    if (!row) return res.status(404).json({ success: false, message: 'Receta no encontrada.' });
    res.json({ success: true, data: { valid: row.expiration_date.toISOString().slice(0, 10) >= clinicToday(), folio: `RX-${row.id.toUpperCase()}`, issuedAt: row.created_at, expirationDate: row.expiration_date, doctor: `${row.doctor.first_name} ${row.doctor.last_name}`, cedula: row.doctor.cedula_profesional } });
  },

  addAddenda: async (req: Request, res: Response) => {
    const parsed = adendaSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: 'La adenda debe explicar la aclaración con al menos 20 caracteres.' });
    const original = await prisma.consultationSoap.findUnique({ where: { id: req.params.id } });
    if (!original || original.status !== 'FIRMADA') return res.status(400).json({ success: false, message: 'Sólo se puede agregar una adenda a una nota firmada vigente.' });
    if (original.doctor_id !== req.user!.id) return res.status(403).json({ success: false, message: 'Sólo el autor puede agregar una adenda.' });
    const subject = encryptionAdapter.encrypt('Adenda aclaratoria de nota clínica firmada.');
    const objective = encryptionAdapter.encrypt(parsed.data.text);
    const analysis = encryptionAdapter.encrypt('Aclaración posterior; la nota original permanece trazable.');
    const plan = encryptionAdapter.encrypt('Consultar esta adenda junto con la nota clínica original.');
    const signedAt = new Date();
    const signature = createHash('sha512').update([original.id, req.user!.id, parsed.data.text, signedAt.toISOString()].join('|')).digest('hex');
    const row = await prisma.$transaction(async tx => {
      await tx.consultationSoap.update({ where: { id: original.id }, data: { status: 'ANULADA_POR_ADENDA' } });
      return tx.consultationSoap.create({ data: { patient_id: original.patient_id, doctor_id: original.doctor_id, parent_consultation_id: original.id, status: 'FIRMADA', subjective_ciphertext: subject.ciphertext, subjective_iv: subject.iv, subjective_tag: subject.tag, objective_ciphertext: objective.ciphertext, objective_iv: objective.iv, objective_tag: objective.tag, analysis_ciphertext: analysis.ciphertext, analysis_iv: analysis.iv, analysis_tag: analysis.tag, primary_icd10_code: original.primary_icd10_code, secondary_icd10_codes: original.secondary_icd10_codes, plan_ciphertext: plan.ciphertext, plan_iv: plan.iv, plan_tag: plan.tag, digital_signature_hash: signature, signed_at: signedAt } });
    });
    await auditRepo.appendLog(audit(req, 'RECORD_ADDENDA', 'consultation', original.id, { addendaId: row.id }));
    res.status(201).json({ success: true, data: { id: row.id, signatureHash: signature, signedAt } });
  },

  audit: async (req: Request, res: Response) => {
    const rows = await prisma.auditLog.findMany({ take: 100, orderBy: { created_at: 'desc' }, include: { user: { select: { first_name: true, last_name: true, email: true } } } });
    res.json({ success: true, data: rows.map(r => ({ id: r.id, action: r.action, resource: r.resource, resourceId: r.resource_id, createdAt: r.created_at, ipAddress: r.ip_address, chainHash: r.chain_hash, user: r.user ? `${r.user.first_name} ${r.user.last_name}` : 'Sistema', email: r.user?.email })) });
  },
};

const appointmentInclude = { patient: { select: { id: true, expediente_folio: true, first_name: true, last_name: true } }, doctor: { select: { id: true, first_name: true, last_name: true } }, notifications: { select: { id: true, type: true, intent: true, status: true, sent_at: true, last_error: true } } } as const;
function mapAppointment(a: any) { return { id: a.id, scheduledAt: a.scheduled_at, endsAt: new Date(a.scheduled_at.getTime() + a.duration_minutes * 60_000), durationMinutes: a.duration_minutes, status: a.status, allowedStatuses: allowedAppointmentStatuses(a.status), reason: a.reason, patient: { id: a.patient.id, folio: a.patient.expediente_folio, name: `${a.patient.first_name} ${a.patient.last_name}` }, doctor: { id: a.doctor.id, name: `${a.doctor.first_name} ${a.doctor.last_name}` }, notifications: a.notifications ? a.notifications.map((n: any) => ({ id: n.id, ...publicNotificationStatus([n])[0] })) : [] }; }
function audit(req: Request, action: string, resource: string, resourceId: string, details?: Record<string, unknown>) { return { userId: req.user!.id, action, resource, resourceId, ipAddress: req.ip || '127.0.0.1', userAgent: req.headers['user-agent'] || 'unknown', details }; }
