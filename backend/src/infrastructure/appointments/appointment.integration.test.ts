import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { test } from 'node:test';
import bcrypt from 'bcrypt';
import { app } from '../../app.js';
import { prisma } from '../adapters/driven/persistence/prisma.client.js';

test('la API impide solapamientos por paciente y médico, incluso con solicitudes simultáneas', async () => {
  const suffix = randomUUID().slice(0, 8);
  const password = `Prueba-${suffix}!`;
  const admin = await prisma.user.create({ data: {
    email: `agenda-${suffix}@example.test`, password_hash: await bcrypt.hash(password, 8),
    first_name: 'Prueba', last_name: 'Agenda', role: 'ADMINISTRADOR',
  } });
  const doctors = await Promise.all([1, 2].map(number => prisma.user.create({ data: {
    email: `doctor-${number}-${suffix}@example.test`, password_hash: 'test-only',
    first_name: 'Doctor', last_name: String(number), role: 'MEDICO_GENERAL', cedula_profesional: `TEST-${suffix}-${number}`,
  } })));
  const patients = await Promise.all([1, 2].map(number => prisma.patient.create({ data: {
    expediente_folio: `EXP-AGENDA-${suffix}-${number}`, first_name: 'Paciente', last_name: String(number),
    birth_date: new Date('2000-01-01T00:00:00.000Z'), sex: 'INDETERMINADO', phone: '0000000000',
  } })));
  const server = app.listen(0);
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No se abrió el servidor de prueba.');
  const base = `http://127.0.0.1:${address.port}/api/v1`;
  let token = '';
  const request = async (path: string, method = 'GET', body?: unknown): Promise<{ status: number; body: any }> => {
    const response = await fetch(`${base}${path}`, { method, headers: {
      'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() };
  };
  const testYear = new Date().getUTCFullYear() + 5;
  const at = (hour: number, minute: number) => new Date(Date.UTC(testYear, 0, 2, hour, minute)).toISOString();
  const create = (patientId: string, doctorId: string, hour: number, minute: number) =>
    request('/appointments', 'POST', { patientId, doctorId, scheduledAt: at(hour, minute), durationMinutes: 30 });
  try {
    const login = await request('/auth/login', 'POST', { email: admin.email, password });
    assert.equal(login.status, 200);
    token = login.body.data.token;
    assert.equal((await request(`/patients/${patients[0].id}/contact`, 'PATCH', { phone: '1234567890', email: 'correo-invalido' })).status, 400);
    const contact = await request(`/patients/${patients[0].id}/contact`, 'PATCH', { phone: '1234567890', email: '' });
    assert.equal(contact.status, 200);
    assert.equal(contact.body.data.phone, '1234567890');

    const first = await create(patients[0].id, doctors[0].id, 15, 0);
    assert.equal(first.status, 201);
    assert.ok(first.body.data.allowedStatuses.includes('EN_SALA_DE_ESPERA'));
    const firstId = first.body.data.id as string;
    const minuteOne = await create(patients[0].id, doctors[1].id, 15, 1);
    assert.equal(minuteOne.status, 409);
    assert.equal(minuteOne.body.conflict.patient, true);
    const minuteTen = await create(patients[0].id, doctors[0].id, 15, 10);
    assert.equal(minuteTen.status, 409);
    assert.equal(minuteTen.body.conflict.patient, true);
    assert.equal(minuteTen.body.conflict.doctor, true);

    const adjacent = await create(patients[0].id, doctors[0].id, 15, 30);
    assert.equal(adjacent.status, 201);
    const sameDoctor = await create(patients[1].id, doctors[0].id, 15, 0);
    assert.equal(sameDoctor.status, 409);
    assert.equal(sameDoctor.body.conflict.doctor, true);
    const independent = await create(patients[1].id, doctors[1].id, 15, 0);
    assert.equal(independent.status, 201);
    assert.equal((await request(`/appointments/${independent.body.data.id}`, 'PATCH', { doctorId: doctors[0].id })).status, 409);
    assert.equal((await request(`/appointments/${independent.body.data.id}`, 'PATCH', { patientId: patients[0].id })).status, 409);

    const available = await request(`/appointments/availability?patientId=${patients[0].id}&doctorId=${doctors[0].id}&scheduledAt=${encodeURIComponent(at(15, 10))}&durationMinutes=30`);
    assert.equal(available.status, 200);
    assert.equal(available.body.data.available, false);
    assert.ok(available.body.data.alternatives.length > 0);

    const cancelled = await request(`/appointments/${firstId}/status`, 'PATCH', { status: 'CANCELADA' });
    assert.equal(cancelled.status, 200);
    assert.ok(cancelled.body.data.notifications.filter((item: { intent: string }) => item.intent === 'CANCELLED')
      .every((item: { status: string }) => item.status === 'PENDING'));
    assert.equal(cancelled.body.data.notifications.find((item: { type: string }) => item.type === 'APPOINTMENT_REMINDER_PATIENT')?.status, 'SKIPPED');
    assert.equal((await request(`/appointments/${firstId}`, 'PATCH', { scheduledAt: at(16, 0) })).status, 409);
    assert.equal((await create(patients[0].id, doctors[0].id, 15, 0)).status, 201);
    assert.equal((await request(`/appointments/${firstId}/status`, 'PATCH', { status: 'PROGRAMADA' })).status, 409);
    assert.equal((await request(`/appointments/${adjacent.body.data.id}`, 'PATCH', { reason: 'Sin cambiar horario' })).status, 200);
    assert.equal((await request(`/appointments/${adjacent.body.data.id}`, 'PATCH', { scheduledAt: at(15, 10) })).status, 409);
    assert.equal((await request(`/appointments/${adjacent.body.data.id}`, 'PATCH', { scheduledAt: at(16, 0) })).status, 200);
    assert.equal((await create(patients[0].id, doctors[0].id, 15, 30)).status, 201);

    const completed = await create(patients[0].id, doctors[0].id, 18, 0);
    assert.equal(completed.status, 201);
    assert.equal((await request(`/appointments/${completed.body.data.id}/status`, 'PATCH', { status: 'COMPLETADA' })).status, 200);
    assert.equal((await request(`/appointments/${completed.body.data.id}/status`, 'PATCH', { status: 'PROGRAMADA' })).status, 409);
    assert.equal((await request(`/appointments/${completed.body.data.id}`, 'PATCH', { reason: 'Cambio tardío' })).status, 409);
    assert.equal((await create(patients[0].id, doctors[0].id, 18, 0)).status, 201);
    const missed = await create(patients[0].id, doctors[0].id, 19, 0);
    assert.equal(missed.status, 201);
    assert.equal((await request(`/appointments/${missed.body.data.id}/status`, 'PATCH', { status: 'NO_ASISTIO' })).status, 200);
    assert.equal((await request(`/appointments/${missed.body.data.id}/status`, 'PATCH', { status: 'EN_CONSULTA' })).status, 409);
    assert.equal((await request(`/appointments/${missed.body.data.id}`, 'PATCH', { scheduledAt: at(20, 0) })).status, 409);
    assert.equal((await create(patients[0].id, doctors[0].id, 19, 0)).status, 201);

    const flow = await create(patients[1].id, doctors[1].id, 20, 0);
    assert.equal(flow.status, 201);
    const flowId = flow.body.data.id as string;
    assert.equal((await request(`/appointments/${flowId}/status`, 'PATCH', { status: 'EN_SALA_DE_ESPERA' })).status, 200);
    assert.equal((await request(`/appointments/${flowId}/status`, 'PATCH', { status: 'PROGRAMADA' })).status, 409);
    assert.equal((await request(`/appointments/${flowId}/status`, 'PATCH', { status: 'EN_CONSULTA' })).status, 200);
    const finishedFlow = await request(`/appointments/${flowId}/status`, 'PATCH', { status: 'COMPLETADA' });
    assert.equal(finishedFlow.status, 200);
    assert.deepEqual(finishedFlow.body.data.allowedStatuses, []);

    const simultaneous = await Promise.all([
      create(patients[0].id, doctors[0].id, 17, 0),
      create(patients[0].id, doctors[0].id, 17, 0),
    ]);
    assert.deepEqual(simultaneous.map(result => result.status).sort(), [201, 409]);

    const soon = await request('/appointments', 'POST', { patientId: patients[0].id, doctorId: doctors[0].id,
      scheduledAt: new Date(Date.now() + 2 * 60 * 60_000).toISOString(), durationMinutes: 30 });
    assert.equal(soon.status, 201);
    const movedSoon = await request(`/appointments/${soon.body.data.id}`, 'PATCH', {
      scheduledAt: new Date(Date.now() + 3 * 60 * 60_000).toISOString(),
    });
    assert.equal(movedSoon.status, 200);
    assert.ok(movedSoon.body.data.notifications.filter((item: { type: string }) => item.type.startsWith('APPOINTMENT_CONFIRMATION_'))
      .every((item: { intent: string }) => item.intent === 'UPDATED'));
    const reminder = movedSoon.body.data.notifications.find((item: { type: string }) => item.type === 'APPOINTMENT_REMINDER_PATIENT');
    assert.equal(reminder.status, 'SKIPPED');
    assert.equal((await request(`/appointments/${soon.body.data.id}/notifications/${reminder.id}/retry`, 'POST', {})).status, 409);
  } finally {
    await prisma.appointment.deleteMany({ where: { doctor_id: { in: doctors.map(doctor => doctor.id) } } });
    await prisma.patient.deleteMany({ where: { id: { in: patients.map(patient => patient.id) } } });
    await prisma.user.deleteMany({ where: { id: { in: [admin.id, ...doctors.map(doctor => doctor.id)] } } });
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
