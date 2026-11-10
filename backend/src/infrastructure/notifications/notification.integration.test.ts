import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prisma } from '../adapters/driven/persistence/prisma.client.js';
import { queueAppointmentChange, queueAppointmentConfirmation, queueReminder, queueWaitingRoom } from './notification.service.js';

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
