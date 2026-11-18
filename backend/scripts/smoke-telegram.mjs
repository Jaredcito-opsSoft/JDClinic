import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { sendToN8n } from '../dist/infrastructure/notifications/notification.service.js';

const chatId = process.env.JDCLINIC_TEST_CHAT_ID;
assert.match(chatId || '', /^\d{5,20}$/);
await sendToN8n({
  id: randomUUID(),
  type: 'APPOINTMENT_CONFIRMATION_PATIENT_TELEGRAM',
  chatId,
  text: 'JDClinic · Prueba de integración AWS. Los avisos por Telegram están funcionando.',
});
console.log('n8n: Telegram aceptó y confirmó el mensaje de prueba.');
