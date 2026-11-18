import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';

const prisma = new PrismaClient();
const s3 = new S3Client({ region: process.env.AWS_REGION });
const base = 'http://127.0.0.1:4000/api/v1';
const suffix = randomUUID().slice(0, 8);
const password = randomBytes(24).toString('base64url');
const testEmail = process.env.JDCLINIC_TEST_EMAIL;
const testChatId = process.env.JDCLINIC_TEST_CHAT_ID;
assert.equal(Boolean(testEmail), Boolean(testChatId), 'Configura correo y chat juntos para probar avisos.');
let adminId;
let doctorId;
let patientId;
let uploadedObject;

async function request(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
}

function clinicDate(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const part = key => parts.find(value => value.type === key)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

try {
  const admin = await prisma.user.create({ data: {
    email: `smoke-admin-${suffix}@example.com`, password_hash: await bcrypt.hash(password, 12),
    first_name: 'Prueba', last_name: 'Administrador', role: 'ADMINISTRADOR',
  } });
  adminId = admin.id;

  const login = await request('/auth/login', { method: 'POST', body: { email: admin.email, password } });
  assert.equal(login.status, 200, `Login: ${JSON.stringify(login.body)}`);
  const adminToken = login.body.data.token;

  const doctor = await request('/users', { token: adminToken, method: 'POST', body: {
    email: `smoke-doctor-${suffix}@example.com`, password,
    firstName: 'Prueba', lastName: 'Medico', role: 'MEDICO_GENERAL', cedulaProfesional: 'TEST-123456',
  } });
  assert.equal(doctor.status, 201, `Médico: ${JSON.stringify(doctor.body)}`);
  doctorId = doctor.body.data.id;

  const patient = await request('/patients', { token: adminToken, method: 'POST', body: {
    firstName: 'Paciente', lastName: 'Prueba', birthDate: '1995-02-20', sex: 'MASCULINO', phone: '5555550101',
    ...(testEmail ? { email: testEmail } : {}),
  } });
  assert.equal(patient.status, 201, `Paciente: ${JSON.stringify(patient.body)}`);
  patientId = patient.body.data.id;
  assert.equal((await request(`/patients/${patientId}`, { token: adminToken })).status, 200);
  if (testChatId) {
    const reminders = await request(`/patients/${patientId}/reminders`, {
      token: adminToken, method: 'PATCH', body: { chatId: testChatId, consent: true },
    });
    assert.equal(reminders.status, 200, `Telegram: ${JSON.stringify(reminders.body)}`);
  }

  const scheduledAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const appointmentBody = { patientId, doctorId, scheduledAt, durationMinutes: 30, reason: 'Prueba automatizada' };
  const appointment = await request('/appointments', { token: adminToken, method: 'POST', body: appointmentBody });
  assert.equal(appointment.status, 201, `Cita: ${JSON.stringify(appointment.body)}`);
  const duplicate = await request('/appointments', { token: adminToken, method: 'POST', body: appointmentBody });
  assert.equal(duplicate.status, 409, `Duplicación de cita: ${JSON.stringify(duplicate.body)}`);

  const doctorLogin = await request('/auth/login', { method: 'POST', body: { email: doctor.body.data.email, password } });
  assert.equal(doctorLogin.status, 200);
  const doctorToken = doctorLogin.body.data.token;
  const agenda = await request(`/appointments?date=${clinicDate(new Date(scheduledAt))}`, { token: doctorToken });
  assert.equal(agenda.status, 200);
  assert.ok(agenda.body.data.some(row => row.id === appointment.body.data.id));

  if (testEmail && testChatId) {
    let deliveries = [];
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const current = await request(`/appointments?date=${clinicDate(new Date(scheduledAt))}`, { token: doctorToken });
      assert.equal(current.status, 200);
      deliveries = current.body.data.find(row => row.id === appointment.body.data.id)?.notifications || [];
      const confirmations = deliveries.filter(item => [
        'APPOINTMENT_CONFIRMATION_PATIENT_EMAIL', 'APPOINTMENT_CONFIRMATION_PATIENT_TELEGRAM',
      ].includes(item.type));
      if (confirmations.length === 2 && confirmations.every(item => item.status === 'SENT')) break;
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    const confirmations = deliveries.filter(item => [
      'APPOINTMENT_CONFIRMATION_PATIENT_EMAIL', 'APPOINTMENT_CONFIRMATION_PATIENT_TELEGRAM',
    ].includes(item.type));
    assert.equal(confirmations.length, 2, `Avisos incompletos: ${JSON.stringify(deliveries)}`);
    assert.ok(confirmations.every(item => item.status === 'SENT'), `Avisos no enviados: ${JSON.stringify(confirmations)}`);
    console.log('Cita → cola → n8n → correo y Telegram: ambos avisos enviados.');
  }

  const bytes = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');
  const initiated = await request(`/patients/${patientId}/attachments/upload`, { token: doctorToken, method: 'POST', body: {
    fileName: 'prueba.pdf', mimeType: 'application/pdf', sizeBytes: bytes.length,
  } });
  assert.equal(initiated.status, 201, `Estudio: ${JSON.stringify(initiated.body)}`);
  uploadedObject = { Bucket: process.env.AWS_S3_BUCKET_NAME, Key: initiated.body.data.fields.key };
  const form = new FormData();
  for (const [name, value] of Object.entries(initiated.body.data.fields)) form.append(name, value);
  form.append('file', new Blob([bytes], { type: 'application/pdf' }), 'prueba.pdf');
  const uploaded = await fetch(initiated.body.data.url, { method: 'POST', body: form });
  assert.equal(uploaded.status, 204);
  const completed = await request(`/patients/${patientId}/attachments/${initiated.body.data.id}/complete`, { token: doctorToken, method: 'POST' });
  assert.equal(completed.status, 200, `Verificación S3: ${JSON.stringify(completed.body)}`);
  const attachment = await request(`/patients/${patientId}/attachments/${initiated.body.data.id}/url`, { token: doctorToken });
  assert.equal(attachment.status, 200);
  assert.equal((await fetch(attachment.body.data.url)).status, 200);

  console.log('API: login, médico, paciente, cita, bloqueo de duplicados, agenda médica y estudio S3 correctos.');
} finally {
  if (uploadedObject?.Key) await s3.send(new DeleteObjectCommand(uploadedObject));
  if (patientId) await prisma.patient.delete({ where: { id: patientId } });
  if (doctorId) await prisma.user.delete({ where: { id: doctorId } });
  if (adminId) await prisma.user.delete({ where: { id: adminId } });
  await prisma.$disconnect();
}
