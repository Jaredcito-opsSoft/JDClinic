import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, test } from 'node:test';
import { env } from '../config/env.config.js';
import { notificationText, reminderDueAt, sendToN8n } from './notification.service.js';

test('recordatorio se programa exactamente 24 horas antes y el mensaje omite datos clínicos', () => {
  const scheduled = new Date('2026-11-10T16:30:00.000Z');
  assert.equal(reminderDueAt(scheduled).toISOString(), '2026-11-09T16:30:00.000Z');
  const reminder = notificationText('APPOINTMENT_REMINDER_PATIENT', scheduled);
  const waiting = notificationText('WAITING_ROOM_DOCTOR', scheduled);
  const confirmation = notificationText('APPOINTMENT_CONFIRMATION_PATIENT_EMAIL', scheduled);
  const updated = notificationText('APPOINTMENT_CONFIRMATION_PATIENT_EMAIL', scheduled, 'UPDATED');
  const cancelled = notificationText('APPOINTMENT_CONFIRMATION_PATIENT_EMAIL', scheduled, 'CANCELLED');
  assert.match(reminder, /Recordatorio/);
  assert.match(waiting, /sala de espera/);
  assert.match(confirmation, /quedó registrada/);
  assert.match(updated, /fue actualizada/);
  assert.match(cancelled, /fue cancelada/);
  assert.doesNotMatch(reminder + waiting + confirmation + updated + cancelled, /diagnóstico|receta|expediente|paciente:|curp/i);
});

test('sólo confirma entrega cuando n8n responde ok y envía el secreto en cabecera', async () => {
  let authorized = false;
  let received: Record<string, unknown> = {};
  const server = createServer((req, res) => {
    authorized = req.headers['x-ece-secret'] === '0123456789abcdef0123456789abcdef';
    let body = '';
    req.on('data', chunk => { body += String(chunk); });
    req.on('end', () => {
      received = JSON.parse(body) as Record<string, unknown>;
      res.setHeader('Content-Type', 'application/json');
      res.end(req.url === '/success'
        ? JSON.stringify({ ok: true, deliveryId: received.deliveryId })
        : req.url === '/wrong-id'
          ? JSON.stringify({ ok: true, deliveryId: 'another-delivery' })
          : '{"ok":false}');
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  after(() => server.close());
  const address = server.address();
  assert(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  env.N8N_WEBHOOK_SECRET = '0123456789abcdef0123456789abcdef';
  env.N8N_WEBHOOK_URL = `${base}/success`;
  const payload = { id: 'delivery-id', type: 'WAITING_ROOM_DOCTOR' as const, chatId: '12345678', text: 'Llegó un paciente.' };
  await sendToN8n(payload);
  assert.equal(authorized, true);
  assert.equal(received.deliveryId, payload.id);
  assert.equal(received.chatId, '12345678');
  await sendToN8n({ id: 'mail-id', type: 'APPOINTMENT_CONFIRMATION_PATIENT_EMAIL', email: 'prueba@example.com', text: 'JDClinic · Tu cita quedó registrada.' });
  assert.equal(received.email, 'prueba@example.com');
  assert.equal(received.chatId, undefined);
  await sendToN8n({ id: 'change-id', type: 'APPOINTMENT_CONFIRMATION_PATIENT_EMAIL', intent: 'UPDATED', email: 'prueba@example.com', text: 'JDClinic · Tu cita fue actualizada.' });
  assert.equal(received.event, 'APPOINTMENT_UPDATED_PATIENT_EMAIL');
  await sendToN8n({ id: 'cancel-id', type: 'APPOINTMENT_CONFIRMATION_PATIENT_TELEGRAM', intent: 'CANCELLED', chatId: '12345678', text: 'JDClinic · Tu cita fue cancelada.' });
  assert.equal(received.event, 'APPOINTMENT_CANCELLED_PATIENT_TELEGRAM');
  env.N8N_WEBHOOK_URL = `${base}/failure`;
  await assert.rejects(sendToN8n(payload), /no confirmó/);
  env.N8N_WEBHOOK_URL = `${base}/wrong-id`;
  await assert.rejects(sendToN8n(payload), /no confirmó/);
});
