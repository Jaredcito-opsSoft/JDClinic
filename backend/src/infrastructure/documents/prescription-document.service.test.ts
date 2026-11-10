import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isPrescriptionSignatureValid, renderPrescriptionPdf, signPrescription } from './prescription-document.service.js';

const snapshot = {
  id: 'd00d8a2f-811d-4df9-92ac-5662767cc000', consultationId: '110d8a2f-811d-4df9-92ac-5662767cc000',
  patientId: '220d8a2f-811d-4df9-92ac-5662767cc000', doctorId: '330d8a2f-811d-4df9-92ac-5662767cc000',
  createdAt: new Date('2026-10-24T16:30:00.000Z'), expirationDate: new Date('2026-11-01T00:00:00.000Z'),
  instructions: 'Una tableta con alimentos.',
  items: [{ medicationName: 'Paracetamol', genericName: null, presentation: 'Tableta 500 mg', dosage: '1 tableta', frequency: 'Cada 8 horas', durationDays: 5, routeAdministration: 'Oral' }],
};

test('la firma detecta alteraciones en dosis o indicaciones', () => {
  const signature = signPrescription(snapshot);
  assert.equal(isPrescriptionSignatureValid(snapshot, signature), true);
  assert.equal(isPrescriptionSignatureValid({ ...snapshot, instructions: 'Dos tabletas con alimentos.' }, signature), false);
  assert.equal(isPrescriptionSignatureValid({ ...snapshot, items: [{ ...snapshot.items[0], dosage: '2 tabletas' }] }, signature), false);
});

test('la receta exporta un PDF con folio, médico y QR', async () => {
  const pdf = await renderPrescriptionPdf({ ...snapshot, patientName: 'Paciente de prueba', patientFolio: 'EXP-001', doctorName: 'Dra. Prueba', doctorLicense: '12345678', diagnosisCode: 'J06.9', verificationCode: '0000000000000000000000000000000000000000', signatureHash: signPrescription(snapshot) });
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert(pdf.byteLength > 5_000);
});
