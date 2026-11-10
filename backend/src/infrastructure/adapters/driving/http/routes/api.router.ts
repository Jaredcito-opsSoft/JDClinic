import { Router } from 'express';
import { consultationsController } from '../../../../config/dependency-container.js';
import { requireRole } from '../middlewares/rbac.middleware.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authController } from '../controllers/auth.controller.js';
import { patientsController } from '../controllers/patients.controller.js';
import { operationsController } from '../controllers/operations.controller.js';
import { attachmentsController } from '../controllers/attachments.controller.js';
import { isStorageConfigured } from '../../../../storage/clinical-storage.service.js';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { RoleType } from '@prisma/client';

import { DatabaseConnection } from '../../../driven/persistence/prisma.client.js';

export const apiRouter = Router();

const createUserSchema = z.object({
  email: z.string().email().transform(v => v.trim().toLowerCase()), password: z.string().min(8).max(128),
  firstName: z.string().trim().min(2).max(100), lastName: z.string().trim().min(2).max(100),
  role: z.nativeEnum(RoleType), cedulaProfesional: z.string().trim().max(50).optional(),
  especialidad: z.string().trim().max(100).optional(), phone: z.string().trim().max(20).optional(),
}).superRefine((value, ctx) => { if (value.role.startsWith('MEDICO') && !value.cedulaProfesional) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['cedulaProfesional'], message: 'La cédula es obligatoria para médicos.' }); });

apiRouter.post('/auth/login', authController.login);
apiRouter.post('/auth/logout', authenticate, async (req, res) => {
  const { auditRepo } = await import('../../../../config/dependency-container.js');
  await auditRepo.appendLog({ userId: req.user!.id, action: 'LOGOUT', resource: 'Session', resourceId: req.user!.id, ipAddress: req.ip || 'unknown', userAgent: req.header('user-agent') || 'unknown' });
  res.json({ success: true, data: { closed: true } });
});
apiRouter.get('/prescriptions/verify/:code', operationsController.verifyPrescription);

apiRouter.get('/dashboard', authenticate, requireRole(['ADMINISTRADOR', 'MEDICO_GENERAL', 'MEDICO_ESPECIALISTA', 'ENFERMERIA', 'RECEPCION']), operationsController.dashboard);
apiRouter.get('/doctors', authenticate, requireRole(['ADMINISTRADOR', 'MEDICO_GENERAL', 'MEDICO_ESPECIALISTA', 'ENFERMERIA', 'RECEPCION']), operationsController.listDoctors);
apiRouter.get('/appointments', authenticate, requireRole(['ADMINISTRADOR', 'MEDICO_GENERAL', 'MEDICO_ESPECIALISTA', 'ENFERMERIA', 'RECEPCION']), operationsController.listAppointments);
apiRouter.get('/appointments/availability', authenticate, requireRole(['ADMINISTRADOR', 'MEDICO_GENERAL', 'MEDICO_ESPECIALISTA', 'RECEPCION']), operationsController.appointmentAvailability);
apiRouter.post('/appointments', authenticate, requireRole(['ADMINISTRADOR', 'MEDICO_GENERAL', 'MEDICO_ESPECIALISTA', 'RECEPCION']), operationsController.createAppointment);
apiRouter.patch('/appointments/:id', authenticate, requireRole(['ADMINISTRADOR', 'MEDICO_GENERAL', 'MEDICO_ESPECIALISTA', 'RECEPCION']), operationsController.updateAppointment);
apiRouter.patch('/appointments/:id/status', authenticate, requireRole(['ADMINISTRADOR', 'MEDICO_GENERAL', 'MEDICO_ESPECIALISTA', 'ENFERMERIA', 'RECEPCION']), operationsController.updateAppointmentStatus);
apiRouter.post('/appointments/:id/notifications/:notificationId/retry', authenticate, requireRole(['ADMINISTRADOR', 'MEDICO_GENERAL', 'MEDICO_ESPECIALISTA', 'RECEPCION']), operationsController.retryNotification);
apiRouter.get('/patients/:patientId/prescriptions', authenticate, requireRole(['ADMINISTRADOR', 'MEDICO_GENERAL', 'MEDICO_ESPECIALISTA', 'ENFERMERIA']), operationsController.listPrescriptions);
apiRouter.get('/patients/:patientId/attachments', authenticate, requireRole(['ADMINISTRADOR', 'MEDICO_GENERAL', 'MEDICO_ESPECIALISTA', 'ENFERMERIA']), attachmentsController.list);
apiRouter.get('/storage/status', authenticate, requireRole(['ADMINISTRADOR', 'MEDICO_GENERAL', 'MEDICO_ESPECIALISTA', 'ENFERMERIA']), (_req, res) => res.json({ success: true, data: { configured: isStorageConfigured() } }));
apiRouter.post('/patients/:patientId/attachments/upload', authenticate, requireRole(['ADMINISTRADOR', 'MEDICO_GENERAL', 'MEDICO_ESPECIALISTA', 'ENFERMERIA']), attachmentsController.initiate);
apiRouter.post('/patients/:patientId/attachments/:id/complete', authenticate, requireRole(['ADMINISTRADOR', 'MEDICO_GENERAL', 'MEDICO_ESPECIALISTA', 'ENFERMERIA']), attachmentsController.finalize);
apiRouter.get('/patients/:patientId/attachments/:id/url', authenticate, requireRole(['ADMINISTRADOR', 'MEDICO_GENERAL', 'MEDICO_ESPECIALISTA', 'ENFERMERIA']), attachmentsController.readUrl);
apiRouter.get('/prescriptions/:id/pdf', authenticate, requireRole(['ADMINISTRADOR', 'MEDICO_GENERAL', 'MEDICO_ESPECIALISTA', 'ENFERMERIA']), operationsController.prescriptionPdf);
apiRouter.post('/prescriptions', authenticate, requireRole(['MEDICO_GENERAL', 'MEDICO_ESPECIALISTA']), operationsController.createPrescription);
apiRouter.post('/consultations/:id/addendas', authenticate, requireRole(['MEDICO_GENERAL', 'MEDICO_ESPECIALISTA']), operationsController.addAddenda);
apiRouter.get('/audit', authenticate, requireRole(['ADMINISTRADOR']), operationsController.audit);

// Endpoint de verificación de salud y estado de la base de datos
apiRouter.get('/health', async (_req, res) => {
  try {
    const prisma = DatabaseConnection.getInstance();
    const startTime = Date.now();
    const dbResult = await prisma.$queryRaw<Array<{ now: Date; db_name: string }>>`SELECT NOW() as now, current_database() as db_name`;
    const latencyMs = Date.now() - startTime;

    res.json({
      status: 'ok',
      system: 'JDClinic · Expediente Clínico Electrónico',
      database: {
        status: 'connected',
        latencyMs: `${latencyMs} ms`,
        currentDatabase: dbResult[0]?.db_name ?? 'expediente_clinico_db',
        serverTime: dbResult[0]?.now ?? new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(503).json({
      status: 'degraded',
      system: 'JDClinic · Expediente Clínico Electrónico',
      database: {
        status: 'disconnected',
        error: error?.message || 'Error de conexión a la base de datos',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// ══════════════════════════════════════════════════════════════
// DEMOSTRACIÓN DE BASE DE DATOS: INSERTAR Y CONSULTAR USUARIOS
// ══════════════════════════════════════════════════════════════

// GET /api/v1/users — Consulta todos los usuarios en PostgreSQL
apiRouter.get('/users', authenticate, requireRole(['ADMINISTRADOR']), async (_req, res) => {
  try {
    const prisma = DatabaseConnection.getInstance();
    const users = await prisma.user.findMany({
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        cedula_profesional: true,
        phone: true,
        especialidad: true,
        telegram_chat_id: true,
        is_active: true,
        created_at: true,
      },
    });
    res.json({ success: true, count: users.length, data: users });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Error al consultar la base de datos' });
  }
});

// POST /api/v1/users — Inserta un nuevo usuario en PostgreSQL
apiRouter.post('/users', authenticate, requireRole(['ADMINISTRADOR']), async (req, res) => {
  try {
    const prisma = DatabaseConnection.getInstance();
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: 'Revisa los datos, rol y cédula del usuario.', issues: parsed.error.flatten().fieldErrors });
    const value = parsed.data;

    const newUser = await prisma.user.create({
      data: {
        email: value.email, password_hash: await bcrypt.hash(value.password, 12), first_name: value.firstName,
        last_name: value.lastName, role: value.role, cedula_profesional: value.cedulaProfesional || null,
        especialidad: value.especialidad || null, phone: value.phone || null,
      },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        cedula_profesional: true,
        phone: true,
        especialidad: true,
        is_active: true,
        created_at: true,
      },
    });

    res.status(201).json({
      success: true,
      message: '¡Usuario insertado con éxito en PostgreSQL!',
      data: newUser,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Error al insertar en la base de datos' });
  }
});

// PATCH /api/v1/users/:id/status — Baja o reactivación lógica, conserva trazabilidad.
apiRouter.patch('/users/:id/status', authenticate, requireRole(['ADMINISTRADOR']), async (req, res) => {
  try {
    const prisma = DatabaseConnection.getInstance();
    const { id } = req.params;
    if (id === req.user!.id && req.body.isActive === false) return res.status(400).json({ success: false, message: 'No puedes desactivar tu propia cuenta.' });
    if (typeof req.body.isActive !== 'boolean') return res.status(400).json({ success: false, message: 'isActive debe ser booleano.' });
    await prisma.user.update({ where: { id }, data: { is_active: req.body.isActive } });
    res.json({
      success: true,
      message: req.body.isActive ? 'Usuario reactivado.' : 'Usuario desactivado sin eliminar su historial.',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Error al eliminar usuario' });
  }
});

apiRouter.patch('/users/:id/telegram', authenticate, requireRole(['ADMINISTRADOR']), async (req, res) => {
  const parsed = z.object({ chatId: z.string().trim().regex(/^\d{5,20}$/).nullable() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Ingresa un chat ID numérico de Telegram.' });
  const user = await DatabaseConnection.getInstance().user.findUnique({ where: { id: req.params.id }, select: { role: true } });
  if (!user || !user.role.startsWith('MEDICO')) return res.status(404).json({ success: false, message: 'Médico no encontrado.' });
  const updated = await DatabaseConnection.getInstance().user.update({ where: { id: req.params.id }, data: { telegram_chat_id: parsed.data.chatId }, select: { id: true, telegram_chat_id: true } });
  const { auditRepo } = await import('../../../../config/dependency-container.js');
  await auditRepo.appendLog({ userId: req.user!.id, action: 'RECORD_CREATE', resource: 'DoctorTelegram', resourceId: updated.id, ipAddress: req.ip || 'unknown', userAgent: req.header('user-agent') || 'unknown' });
  res.json({ success: true, data: { id: updated.id, chatId: updated.telegram_chat_id } });
});

// Rutas de Consultas SOAP protegidas con RBAC para Médicos
apiRouter.get(
  '/patients',
  authenticate,
  requireRole(['ADMINISTRADOR', 'MEDICO_GENERAL', 'MEDICO_ESPECIALISTA', 'ENFERMERIA', 'RECEPCION']),
  patientsController.list
);

apiRouter.get(
  '/patients/:id',
  authenticate,
  requireRole(['ADMINISTRADOR', 'MEDICO_GENERAL', 'MEDICO_ESPECIALISTA', 'ENFERMERIA']),
  patientsController.getById
);

apiRouter.post(
  '/patients',
  authenticate,
  requireRole(['ADMINISTRADOR', 'MEDICO_GENERAL', 'MEDICO_ESPECIALISTA', 'RECEPCION']),
  patientsController.create
);

apiRouter.get('/patients/:id/reminders', authenticate, requireRole(['ADMINISTRADOR', 'MEDICO_GENERAL', 'MEDICO_ESPECIALISTA', 'RECEPCION']), patientsController.getReminders);
apiRouter.patch('/patients/:id/reminders', authenticate, requireRole(['ADMINISTRADOR', 'MEDICO_GENERAL', 'MEDICO_ESPECIALISTA', 'RECEPCION']), patientsController.updateReminders);
apiRouter.patch('/patients/:id/contact', authenticate, requireRole(['ADMINISTRADOR', 'MEDICO_GENERAL', 'MEDICO_ESPECIALISTA', 'RECEPCION']), patientsController.updateContact);

apiRouter.post(
  '/patients/:id/vitals', authenticate,
  requireRole(['MEDICO_GENERAL', 'MEDICO_ESPECIALISTA', 'ENFERMERIA']),
  patientsController.captureVitals
);

apiRouter.put('/patients/:id/history', authenticate, requireRole(['MEDICO_GENERAL', 'MEDICO_ESPECIALISTA']), patientsController.updateMedicalHistory);

apiRouter.post(
  '/consultations',
  authenticate,
  requireRole(['MEDICO_GENERAL', 'MEDICO_ESPECIALISTA']),
  consultationsController.create
);

apiRouter.post(
  '/consultations/:id/sign',
  authenticate,
  requireRole(['MEDICO_GENERAL', 'MEDICO_ESPECIALISTA']),
  consultationsController.sign
);

apiRouter.get(
  '/patients/:patientId/consultations',
  authenticate,
  requireRole(['ADMINISTRADOR', 'MEDICO_GENERAL', 'MEDICO_ESPECIALISTA', 'ENFERMERIA']),
  consultationsController.getByPatient
);
