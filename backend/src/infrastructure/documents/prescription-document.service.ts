import { createHmac, timingSafeEqual } from 'node:crypto';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { env } from '../config/env.config.js';

export type PrescriptionLine = {
  medicationName: string;
  genericName?: string | null;
  presentation: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  routeAdministration: string;
};

export type PrescriptionSnapshot = {
  id: string;
  consultationId: string;
  patientId: string;
  doctorId: string;
  createdAt: Date;
  expirationDate: Date;
  instructions: string;
  items: PrescriptionLine[];
};

export type PrescriptionDocument = PrescriptionSnapshot & {
  patientName: string;
  patientFolio: string;
  doctorName: string;
  doctorLicense: string | null;
  diagnosisCode: string;
  verificationCode: string;
  signatureHash: string | null;
};

function signingKey(): string {
  if (env.PRESCRIPTION_SIGNING_KEY) return env.PRESCRIPTION_SIGNING_KEY;
  if (env.NODE_ENV !== 'production') return env.JWT_ACCESS_SECRET;
  throw new Error('Configura PRESCRIPTION_SIGNING_KEY antes de emitir recetas.');
}

function canonical(snapshot: PrescriptionSnapshot): string {
  const items = snapshot.items.map(item => ({
    medicationName: item.medicationName, genericName: item.genericName || '',
    presentation: item.presentation, dosage: item.dosage, frequency: item.frequency,
    durationDays: item.durationDays, routeAdministration: item.routeAdministration,
  })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return JSON.stringify({
    id: snapshot.id, consultationId: snapshot.consultationId,
    patientId: snapshot.patientId, doctorId: snapshot.doctorId,
    createdAt: snapshot.createdAt.toISOString(),
    expirationDate: snapshot.expirationDate.toISOString().slice(0, 10),
    instructions: snapshot.instructions, items,
  });
}

export function signPrescription(snapshot: PrescriptionSnapshot): string {
  return createHmac('sha256', signingKey()).update(canonical(snapshot)).digest('hex');
}

export function isPrescriptionSignatureValid(snapshot: PrescriptionSnapshot, signature: string | null): boolean {
  if (!signature || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const expected = Buffer.from(signPrescription(snapshot), 'hex');
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}

const formatDate = (value: Date) => new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeZone: 'America/Mexico_City' }).format(value);
const formatDateOnly = (value: Date) => new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeZone: 'UTC' }).format(value);

export async function renderPrescriptionPdf(data: PrescriptionDocument): Promise<Buffer> {
  const qr = await QRCode.toBuffer(`${env.FRONTEND_URL.replace(/\/$/, '')}/verify/${data.verificationCode}`, { type: 'png', width: 220, margin: 1 });
  const doc = new PDFDocument({ size: 'A4', margins: { top: 48, right: 48, bottom: 48, left: 48 }, info: { Title: `Receta ${data.id}`, Author: 'JDClinic', Subject: 'Prescripción médica' } });
  const chunks: Buffer[] = [];
  doc.on('data', chunk => chunks.push(Buffer.from(chunk)));
  const result = new Promise<Buffer>((resolve, reject) => { doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject); });
  const ink = '#282638'; const muted = '#756E7C'; const brand = '#59456D'; const line = '#E7DEE7';
  const pageWidth = 595.28; const contentWidth = pageWidth - 96;
  let pageNumber = 1;

  const footer = () => {
    const y = doc.page.height - 64;
    doc.moveTo(48, y - 8).lineTo(pageWidth - 48, y - 8).strokeColor(line).stroke();
    doc.font('Helvetica').fontSize(8).fillColor(muted).text('Documento clínico confidencial · JDClinic', 48, y, { width: 370 });
    doc.text(`Página ${pageNumber}`, pageWidth - 105, y, { width: 57, align: 'right' });
  };
  const nextPage = () => {
    footer(); doc.addPage(); pageNumber++;
    doc.font('Helvetica-Bold').fontSize(11).fillColor(brand).text('JDCLINIC  /  RECETA MÉDICA', 48, 46);
    doc.moveTo(48, 69).lineTo(pageWidth - 48, 69).strokeColor(line).stroke();
    doc.y = 88;
  };
  const ensure = (height: number) => { if (doc.y + height > doc.page.height - 100) nextPage(); };

  doc.roundedRect(48, 48, 37, 37, 10).fill(brand);
  doc.save().translate(48, 48).scale(37 / 48);
  doc.path('M17 13v17.2c0 4.2-2.1 6.6-6.2 6.6-1.2 0-2.3-.2-3.2-.7').lineWidth(3.3).lineCap('round').lineJoin('round').stroke('#FFFFFF');
  doc.path('M24 13h3.4C34 13 38 17.1 38 24s-4 11-10.6 11H24z').stroke('#FFFFFF');
  doc.path('M28.2 24h5.1m-2.55-2.55v5.1').lineWidth(1.7).stroke('#FFC4A3');
  doc.restore();
  doc.font('Helvetica-Bold').fontSize(20).fillColor(ink).text('Receta médica', 98, 48);
  doc.font('Helvetica').fontSize(9).fillColor(muted).text('JDClinic  ·  Expediente clínico digital', 99, 75);
  doc.moveTo(48, 105).lineTo(pageWidth - 48, 105).strokeColor(line).stroke();

  doc.font('Helvetica-Bold').fontSize(8).fillColor(muted).text('FOLIO ÚNICO', 48, 122);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(ink).text(`RX-${data.id.toUpperCase()}`, 48, 136, { width: contentWidth });
  doc.font('Helvetica').fontSize(9).fillColor(muted).text(`Emitida: ${formatDate(data.createdAt)}     Vigencia: ${formatDateOnly(data.expirationDate)}`, 48, 158);

  doc.roundedRect(48, 187, contentWidth, 78, 11).fill('#F4F7F6');
  doc.font('Helvetica-Bold').fontSize(8).fillColor(brand).text('PACIENTE', 63, 201);
  doc.font('Helvetica-Bold').fontSize(13).fillColor(ink).text(data.patientName, 63, 218, { width: contentWidth - 30 });
  doc.font('Helvetica').fontSize(9).fillColor(muted).text(`Expediente ${data.patientFolio}     ·     CIE-10 ${data.diagnosisCode}`, 63, 241);

  doc.y = 286;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(ink).text('Tratamiento indicado', 48, doc.y);
  doc.moveDown(0.8);
  data.items.forEach((item, index) => {
    doc.font('Helvetica-Bold').fontSize(10);
    const name = `${index + 1}. ${item.medicationName}${item.genericName ? ` (${item.genericName})` : ''}`;
    const detail = `${item.presentation}  ·  ${item.dosage}  ·  ${item.frequency}  ·  ${item.routeAdministration}  ·  ${item.durationDays} días`;
    const nameHeight = doc.heightOfString(name, { width: contentWidth - 30 });
    doc.font('Helvetica').fontSize(9);
    const detailHeight = doc.heightOfString(detail, { width: contentWidth - 30 });
    const height = Math.max(57, nameHeight + detailHeight + 26);
    ensure(height + 8);
    const y = doc.y;
    doc.roundedRect(48, y, contentWidth, height, 9).fill('#FAFBFA');
    doc.roundedRect(48, y, 3, height, 1.5).fill(brand);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(ink).text(name, 63, y + 10, { width: contentWidth - 30 });
    doc.font('Helvetica').fontSize(9).fillColor(muted).text(detail, 63, y + 12 + nameHeight, { width: contentWidth - 30 });
    doc.y = y + height + 8;
  });

  ensure(95);
  doc.moveDown(0.35);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(ink).text('Indicaciones generales', 48, doc.y);
  doc.moveDown(0.45);
  doc.font('Helvetica').fontSize(9.5).fillColor(ink).text(data.instructions, 48, doc.y, { width: contentWidth, lineGap: 3 });
  doc.moveDown(1.4);
  ensure(130);
  const signatureY = doc.y;
  doc.moveTo(48, signatureY).lineTo(pageWidth - 48, signatureY).strokeColor(line).stroke();
  doc.font('Helvetica-Bold').fontSize(10).fillColor(ink).text(data.doctorName, 48, signatureY + 15, { width: 320 });
  doc.font('Helvetica').fontSize(9).fillColor(muted).text(`Cédula profesional: ${data.doctorLicense || 'No registrada'}`, 48, signatureY + 33);
  doc.font('Helvetica').fontSize(8).fillColor(muted).text(data.signatureHash ? 'Firma electrónica simple asociada al usuario médico autenticado' : 'Emisión previa sin sello electrónico almacenado', 48, signatureY + 54, { width: 320 });
  if (data.signatureHash) doc.font('Courier').fontSize(7).fillColor(muted).text(`Sello SHA-256: ${data.signatureHash}`, 48, signatureY + 68, { width: 330 });
  doc.image(qr, pageWidth - 148, signatureY + 13, { width: 86, height: 86 });
  doc.font('Helvetica').fontSize(7).fillColor(muted).text('Verificar vigencia', pageWidth - 151, signatureY + 102, { width: 92, align: 'center' });
  doc.y = signatureY + 124;
  footer();
  doc.end();
  return result;
}
