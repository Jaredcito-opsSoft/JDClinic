import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createStudyUpload, studyReadUrl, verifyStudyObject } from '../dist/infrastructure/storage/clinical-storage.service.js';
import { sendToN8n } from '../dist/infrastructure/notifications/notification.service.js';

const bytes = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');
const upload = await createStudyUpload(randomUUID(), 'application/pdf');
const s3 = new S3Client({ region: process.env.AWS_REGION });

try {
  const form = new FormData();
  for (const [name, value] of Object.entries(upload.fields)) form.append(name, value);
  form.append('file', new Blob([bytes], { type: 'application/pdf' }), 'smoke.pdf');
  const response = await fetch(upload.url, { method: 'POST', body: form });
  assert.equal(response.status, 204, `Carga S3 respondió HTTP ${response.status}`);

  await verifyStudyObject({ bucket: upload.bucket, key: upload.key, mimeType: 'application/pdf', sizeBytes: bytes.length });
  const readUrl = await studyReadUrl(upload.bucket, upload.key);
  const downloaded = await fetch(readUrl);
  assert.equal(downloaded.status, 200);
  assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), bytes);
  console.log('S3: carga, cifrado, lectura y verificación correctos.');
} finally {
  await s3.send(new DeleteObjectCommand({ Bucket: upload.bucket, Key: upload.key }));
}

const recipient = process.env.JDCLINIC_TEST_EMAIL;
assert.match(recipient || '', /^[^\s@]+@[^\s@]+\.[^\s@]+$/);
await sendToN8n({
  id: randomUUID(),
  type: 'APPOINTMENT_CONFIRMATION_PATIENT_EMAIL',
  email: recipient,
  text: 'JDClinic · Prueba de integración AWS. El sistema de avisos está funcionando.',
});
console.log('n8n: correo de prueba aceptado por el flujo SMTP.');
