import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import type { Appointment, NotificationDelivery } from '@prisma/client';
import { prisma } from '../adapters/driven/persistence/prisma.client.js';
import { env } from '../config/env.config.js';
import { processOne, queueAppointmentChange, queueAppointmentConfirmation, queueReminder, queueWaitingRoom } from './notification.service.js';

test('cita prepara confirmaciones por correo y Telegram, recordatorio y un solo aviso de espera', async t => {
  const doctor = await prisma.user.findFirst({ where: { role: { in: ['MEDICO_GENERAL', 'MEDICO_ESPECIALISTA'] }, is_active: true }, select: { id: true } });
  const patient = await prisma.patient.findFirst({ where: { is_active: true, deleted_at: null }, select: { id: true } });
  if (!doctor || !patient) { t.skip('No hay médico y paciente de desarrollo en PostgreSQL.'); return; }
  const rollback = new Error('rollback expected');
  try {
    await prisma.$transaction(async tx => {
      const scheduledAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const appointment = await tx.appointment.create({ data: { patient_id: patient.id, doctor_id: doctor.id, scheduled_at: scheduledAt } });
      await queueAppointmentConfirmation(tx, appointment.id);
      await queueReminder(tx, appointment.id, scheduledAt);
      await queueWaitingRoom(tx, appointment.id);
      await queueWaitingRoom(tx, appointment.id);
      const deliveries = await tx.notificationDelivery.findMany({ where: { appointment_id: appointment.id } });
      assert.equal(deliveries.length, 4);
      assert.equal(deliveries.find(item => item.type === 'APPOINTMENT_REMINDER_PATIENT')?.status, 'PENDING');
      assert.equal(deliveries.find(item => item.type === 'WAITING_ROOM_DOCTOR')?.status, 'PENDING');
      assert.equal(deliveries.find(item => item.type === 'APPOINTMENT_CONFIRMATION_PATIENT_TELEGRAM')?.status, 'PENDING');
      assert.equal(deliveries.find(item => item.type === 'APPOINTMENT_CONFIRMATION_PATIENT_EMAIL')?.status, 'PENDING');
      await queueAppointmentChange(tx, appointment.id, 'UPDATED');
      const updated = await tx.notificationDelivery.findMany({ where: { appointment_id: appointment.id, type: { in: ['APPOINTMENT_CONFIRMATION_PATIENT_TELEGRAM', 'APPOINTMENT_CONFIRMATION_PATIENT_EMAIL'] } } });
      assert.equal(updated.length, 2);
      assert.ok(updated.every(item => item.intent === 'UPDATED' && item.status === 'PENDING'));
      await queueAppointmentChange(tx, appointment.id, 'CANCELLED');
      const cancelled = await tx.notificationDelivery.findMany({ where: { appointment_id: appointment.id, type: { in: ['APPOINTMENT_CONFIRMATION_PATIENT_TELEGRAM', 'APPOINTMENT_CONFIRMATION_PATIENT_EMAIL'] } } });
      assert.ok(cancelled.every(item => item.intent === 'CANCELLED' && item.status === 'PENDING'));
      throw rollback;
    });
  } catch (error) { if (error !== rollback) throw error; }
});

test('la cola marca enviado o reintento después del primer intento real', async () => {
  const suffix = randomUUID().slice(0, 8);
  const doctor = await prisma.user.create({ data: {
    email: `doctor-avisos-${suffix}@example.test`, password_hash: 'test-only',
    first_name: 'Doctor', last_name: 'Prueba', role: 'MEDICO_GENERAL', cedula_profesional: `TEST-${suffix}`,
  } });
  const originalUrl = env.N8N_WEBHOOK_URL;
  const originalSecret = env.N8N_WEBHOOK_SECRET;
  const secret = '0123456789abcdef0123456789abcdef';
  let fail = false;
  const server = createServer(async (request, response) => {
    let body = '';
    for await (const part of request) body += part;
    const input = JSON.parse(body) as { deliveryId: string };
    if (fail) {
      response.writeHead(500).end('Error de prueba');
    } else {
      response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, deliveryId: input.deliveryId }));
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  env.N8N_WEBHOOK_URL = `http://127.0.0.1:${address.port}`;
  env.N8N_WEBHOOK_SECRET = secret;
  const patient = await prisma.patient.create({ data: {
    expediente_folio: `EXP-N8N-TEST-${randomUUID().slice(0, 8)}`, first_name: 'Prueba', last_name: 'Avisos',
    birth_date: new Date('2000-01-01T00:00:00.000Z'), sex: 'INDETERMINADO', phone: '0000000000',
    telegram_chat_id: '123456789', telegram_consent_at: new Date(),
  } });
  try {
    for (const expected of ['SENT', 'RETRY'] as const) {
      fail = expected === 'RETRY';
      const appointment: Appointment = await prisma.appointment.create({ data: {
        patient_id: patient.id, doctor_id: doctor.id, scheduled_at: new Date(Date.now() + 3 * 60 * 60_000),
      } });
      const delivery: NotificationDelivery = await prisma.notificationDelivery.create({ data: {
        appointment_id: appointment.id, type: 'APPOINTMENT_CONFIRMATION_PATIENT_TELEGRAM',
        status: 'PROCESSING', attempts: 1, locked_at: new Date(), due_at: new Date(), next_attempt_at: new Date(),
      } });
      await processOne(delivery.id);
      const saved: NotificationDelivery = await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: delivery.id } });
      assert.equal(saved.status, expected);
      assert.equal(saved.attempts, 1);
      await prisma.appointment.delete({ where: { id: appointment.id } });
    }
  } finally {
    env.N8N_WEBHOOK_URL = originalUrl;
    env.N8N_WEBHOOK_SECRET = originalSecret;
    await prisma.appointment.deleteMany({ where: { patient_id: patient.id } });
    await prisma.patient.delete({ where: { id: patient.id } });
    await prisma.user.delete({ where: { id: doctor.id } });
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
