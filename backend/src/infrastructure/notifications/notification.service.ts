import { NotificationIntent, NotificationStatus, NotificationType, Prisma } from '@prisma/client';
import { prisma } from '../adapters/driven/persistence/prisma.client.js';
import { env } from '../config/env.config.js';

const HOUR = 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const LEASE_MS = 2 * 60 * 1000;
const RETRY_MS = [30_000, 2 * 60_000, 10 * 60_000, 30 * 60_000, HOUR];
type Db = Prisma.TransactionClient | typeof prisma;

export function reminderDueAt(scheduledAt: Date): Date {
  return new Date(scheduledAt.getTime() - 24 * HOUR);
}

export function notificationText(type: NotificationType, scheduledAt: Date, intent: NotificationIntent = 'CREATED'): string {
  const when = new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: env.CLINIC_TIME_ZONE,
  }).format(scheduledAt);
  if (type === 'WAITING_ROOM_DOCTOR') return 'JDClinic · Un paciente llegó a sala de espera. Revisa tu agenda clínica.';
  if (type === 'APPOINTMENT_REMINDER_PATIENT') return `JDClinic · Recordatorio de tu cita mañana, ${when}. Si necesitas cambiarla, comunícate con la clínica.`;
  if (intent === 'UPDATED') return `JDClinic · Tu cita fue actualizada. Fecha y hora: ${when}. Si necesitas cambiarla, comunícate con la clínica.`;
  if (intent === 'CANCELLED') return `JDClinic · Tu cita del ${when} fue cancelada. Si necesitas otra fecha, comunícate con la clínica.`;
  return `JDClinic · Tu cita quedó registrada para el ${when}. Si necesitas cambiarla, comunícate con la clínica.`;
}

export async function queueAppointmentConfirmation(db: Db, appointmentId: string): Promise<void> {
  const now = new Date();
  await db.notificationDelivery.createMany({ data: [
    { appointment_id: appointmentId, type: 'APPOINTMENT_CONFIRMATION_PATIENT_TELEGRAM', due_at: now, next_attempt_at: now },
    { appointment_id: appointmentId, type: 'APPOINTMENT_CONFIRMATION_PATIENT_EMAIL', due_at: now, next_attempt_at: now },
  ] });
}

export async function queueAppointmentChange(db: Db, appointmentId: string, intent: 'UPDATED' | 'CANCELLED'): Promise<void> {
  const now = new Date();
  const types: NotificationType[] = ['APPOINTMENT_CONFIRMATION_PATIENT_TELEGRAM', 'APPOINTMENT_CONFIRMATION_PATIENT_EMAIL'];
  for (const type of types) {
    await db.notificationDelivery.upsert({
      where: { appointment_id_type: { appointment_id: appointmentId, type } },
      create: { appointment_id: appointmentId, type, intent, due_at: now, next_attempt_at: now },
      update: { intent, status: 'PENDING', attempts: 0, due_at: now, next_attempt_at: now, sent_at: null, locked_at: null, last_error: null },
    });
  }
}

export async function queueReminder(db: Db, appointmentId: string, scheduledAt: Date): Promise<void> {
  const dueAt = reminderDueAt(scheduledAt);
  const now = new Date();
  await db.notificationDelivery.create({ data: {
    appointment_id: appointmentId, type: 'APPOINTMENT_REMINDER_PATIENT',
    due_at: dueAt, next_attempt_at: dueAt,
    status: dueAt <= now ? 'SKIPPED' : 'PENDING',
    last_error: dueAt <= now ? 'Cita creada con menos de 24 horas de anticipación.' : null,
  } });
}

export async function queueWaitingRoom(db: Db, appointmentId: string): Promise<void> {
  const now = new Date();
  await db.notificationDelivery.upsert({
    where: { appointment_id_type: { appointment_id: appointmentId, type: 'WAITING_ROOM_DOCTOR' } },
    create: { appointment_id: appointmentId, type: 'WAITING_ROOM_DOCTOR', due_at: now, next_attempt_at: now },
    update: {},
  });
}

export async function sendToN8n(input: { id: string; type: NotificationType; intent?: NotificationIntent; chatId?: string; email?: string; text: string }): Promise<void> {
  if (!env.N8N_WEBHOOK_URL || !env.N8N_WEBHOOK_SECRET || env.N8N_WEBHOOK_SECRET.length < 32 || /tudominio|example|replace/i.test(env.N8N_WEBHOOK_URL + env.N8N_WEBHOOK_SECRET)) throw new Error('Configura el webhook autenticado de n8n.');
  const event = input.intent && input.intent !== 'CREATED' && input.type.startsWith('APPOINTMENT_CONFIRMATION_PATIENT_')
    ? `APPOINTMENT_${input.intent}_PATIENT_${input.type.endsWith('_EMAIL') ? 'EMAIL' : 'TELEGRAM'}`
    : input.type;
  const response = await fetch(env.N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-ECE-Secret': env.N8N_WEBHOOK_SECRET },
    body: JSON.stringify({ deliveryId: input.id, event, chatId: input.chatId, email: input.email, text: input.text }),
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 404) throw new Error('El flujo de n8n no está publicado o la ruta del webhook es incorrecta.');
  if (!response.ok) throw new Error(`n8n respondió HTTP ${response.status}.`);
  const body: unknown = await response.json().catch(() => null);
  const acknowledgement = body && typeof body === 'object'
    ? body as { ok?: unknown; deliveryId?: unknown }
    : null;
  if (acknowledgement?.ok !== true || acknowledgement.deliveryId !== input.id) {
    throw new Error('n8n no confirmó el envío del aviso.');
  }
}

let timer: NodeJS.Timeout | undefined;
let busy = false;

export async function processNotifications(): Promise<void> {
  if (busy) return;
  busy = true;
  try {
    const now = new Date();
    const candidates = await prisma.notificationDelivery.findMany({
      where: { OR: [
        { status: { in: ['PENDING', 'RETRY'] }, next_attempt_at: { lte: now } },
        { status: 'PROCESSING', locked_at: { lt: new Date(now.getTime() - LEASE_MS) } },
      ] }, orderBy: { next_attempt_at: 'asc' }, take: 20,
    });
    for (const candidate of candidates) {
      const claimed = await prisma.notificationDelivery.updateMany({
        where: { id: candidate.id, status: candidate.status, attempts: candidate.attempts },
        data: { status: 'PROCESSING', locked_at: new Date(), attempts: { increment: 1 } },
      });
      if (!claimed.count) continue;
      await processOne(candidate.id);
    }
  } finally { busy = false; }
}

export async function reconcileExistingAppointments(): Promise<void> {
  const now = new Date();
  const rows = await prisma.appointment.findMany({ where: {
    scheduled_at: { gt: new Date(now.getTime() + 24 * HOUR) },
    status: { in: ['PROGRAMADA', 'CONFIRMADA'] },
    notifications: { none: { type: 'APPOINTMENT_REMINDER_PATIENT' } },
  }, select: { id: true, scheduled_at: true } });
  for (const row of rows) {
    try { await queueReminder(prisma, row.id, row.scheduled_at); }
    catch (error) { if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error; }
  }
}

async function processOne(id: string): Promise<void> {
  const delivery = await prisma.notificationDelivery.findUnique({ where: { id }, include: {
    appointment: { include: {
      patient: { select: { is_active: true, deleted_at: true, email: true, telegram_chat_id: true, telegram_consent_at: true } },
      doctor: { select: { is_active: true, telegram_chat_id: true } },
    } },
  } });
  if (!delivery) return;
  const appointment = delivery.appointment;
  const isReminder = delivery.type === 'APPOINTMENT_REMINDER_PATIENT';
  const isPatient = delivery.type !== 'WAITING_ROOM_DOCTOR';
  const isEmail = delivery.type === 'APPOINTMENT_CONFIRMATION_PATIENT_EMAIL';
  const isCancellation = isPatient && delivery.intent === 'CANCELLED';
  const invalid = (isCancellation ? appointment.status !== 'CANCELADA' : ['CANCELADA', 'NO_ASISTIO', 'COMPLETADA'].includes(appointment.status))
    || (isReminder && appointment.scheduled_at <= new Date())
    || (isPatient && (!appointment.patient.is_active || appointment.patient.deleted_at))
    || (isPatient && !isEmail && !appointment.patient.telegram_consent_at)
    || (!isPatient && !appointment.doctor.is_active);
  if (invalid) {
    const reason = isPatient && !isEmail && !appointment.patient.telegram_consent_at
      ? 'El paciente no autorizó avisos por Telegram.'
      : 'La cita o el destinatario ya no cumplen las condiciones de envío.';
    await prisma.notificationDelivery.update({ where: { id }, data: { status: 'SKIPPED', locked_at: null, last_error: reason } });
    return;
  }
  const chatId = isPatient ? appointment.patient.telegram_chat_id : appointment.doctor.telegram_chat_id;
  const email = appointment.patient.email?.trim();
  if ((isEmail && !email) || (!isEmail && !chatId)) {
    await prisma.notificationDelivery.update({ where: { id }, data: { status: 'SKIPPED', locked_at: null, last_error: isEmail ? 'El paciente no tiene correo registrado.' : 'Falta vincular el chat de Telegram del destinatario.' } });
    return;
  }
  try {
    await sendToN8n({ id, type: delivery.type, intent: delivery.intent, chatId: isEmail ? undefined : chatId ?? undefined, email: isEmail ? email : undefined, text: notificationText(delivery.type, appointment.scheduled_at, delivery.intent) });
    const saved = await prisma.notificationDelivery.updateMany({
      where: { id, status: 'PROCESSING', intent: delivery.intent, attempts: delivery.attempts + 1 },
      data: { status: 'SENT', sent_at: new Date(), locked_at: null, last_error: null },
    });
    if (saved.count && isReminder) await prisma.appointment.update({ where: { id: appointment.id }, data: { telegram_reminder_sent: true } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error de envío desconocido.';
    const attempts = delivery.attempts + 1;
    await prisma.notificationDelivery.updateMany({ where: { id, status: 'PROCESSING', intent: delivery.intent, attempts }, data: {
      status: attempts >= MAX_ATTEMPTS ? 'FAILED' : 'RETRY',
      next_attempt_at: new Date(Date.now() + RETRY_MS[Math.min(attempts - 1, RETRY_MS.length - 1)]),
      locked_at: null, last_error: message.slice(0, 500),
    } });
  }
}

export function startNotificationWorker(): void {
  void reconcileExistingAppointments().then(processNotifications).catch(error => console.error('[Notificaciones] Error del ciclo:', error));
  timer = setInterval(() => void processNotifications().catch(error => console.error('[Notificaciones] Error del ciclo:', error)), 30_000);
}

export function stopNotificationWorker(): void { if (timer) clearInterval(timer); }

export function publicNotificationStatus(notifications: Array<{ type: NotificationType; intent: NotificationIntent; status: NotificationStatus; sent_at: Date | null; last_error: string | null }>) {
  return notifications.map(n => ({ type: n.type, intent: n.intent, status: n.status, sentAt: n.sent_at, reason: n.last_error }));
}
