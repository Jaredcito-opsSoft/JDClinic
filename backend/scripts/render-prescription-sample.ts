import { writeFile } from 'node:fs/promises';
import { renderPrescriptionPdf, signPrescription } from '../src/infrastructure/documents/prescription-document.service.js';

const snapshot = {
  id: 'd00d8a2f-811d-4df9-92ac-5662767cc000',
  consultationId: '110d8a2f-811d-4df9-92ac-5662767cc000',
  patientId: '220d8a2f-811d-4df9-92ac-5662767cc000',
  doctorId: '330d8a2f-811d-4df9-92ac-5662767cc000',
  createdAt: new Date('2026-10-24T16:30:00.000Z'),
  expirationDate: new Date('2026-11-01T00:00:00.000Z'),
  instructions: 'Tomar los medicamentos según el horario indicado. Mantener hidratación y acudir a revisión si los síntomas aumentan. No modificar dosis sin valoración médica.',
  items: [
    { medicationName: 'Paracetamol', genericName: 'Acetaminofén', presentation: 'Tableta 500 mg', dosage: '1 tableta', frequency: 'Cada 8 horas', durationDays: 5, routeAdministration: 'Oral' },
    { medicationName: 'Loratadina', genericName: null, presentation: 'Tableta 10 mg', dosage: '1 tableta', frequency: 'Cada 24 horas', durationDays: 7, routeAdministration: 'Oral' },
    { medicationName: 'Solución salina nasal', genericName: null, presentation: 'Frasco 100 ml', dosage: '2 aplicaciones', frequency: 'Cada 12 horas', durationDays: 7, routeAdministration: 'Nasal' },
  ],
};

const pdf = await renderPrescriptionPdf({
  ...snapshot,
  patientName: 'Paciente de ejemplo', patientFolio: 'EXP-MUESTRA-001',
  doctorName: 'Dra. Mariana Salazar', doctorLicense: '12345678',
  diagnosisCode: 'J06.9', verificationCode: '0000000000000000000000000000000000000000',
  signatureHash: signPrescription(snapshot),
});
await writeFile('../tmp/pdfs/receta-muestra.pdf', pdf);
