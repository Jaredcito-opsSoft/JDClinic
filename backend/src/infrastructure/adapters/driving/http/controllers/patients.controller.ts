import { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { BiologicalSex, BloodType, Prisma } from '@prisma/client';
import { prisma } from '../../../driven/persistence/prisma.client.js';
import { encryptionAdapter, auditRepo } from '../../../../config/dependency-container.js';
import { env } from '../../../../config/env.config.js';

const createPatientSchema = z.object({
  expedienteFolio: z.string().trim().min(4).max(50).optional(),
  curp: z.string().trim().toUpperCase().length(18).optional().or(z.literal('')),
  firstName: z.string().trim().min(2).max(100),
  lastName: z.string().trim().min(2).max(100),
  birthDate: z.string().date(),
  sex: z.nativeEnum(BiologicalSex),
  bloodType: z.nativeEnum(BloodType).default(BloodType.DESCONOCIDO),
  phone: z.string().trim().min(7).max(20),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().trim().max(255).optional(),
  emergencyContact: z.string().trim().max(150).optional(),
  emergencyPhone: z.string().trim().max(20).optional(),
});

const vitalsSchema = z.object({
  weightKg: z.number().min(1).max(400), heightCm: z.number().min(30).max(250),
  systolicBp: z.number().int().min(50).max(260), diastolicBp: z.number().int().min(30).max(180),
  heartRate: z.number().int().min(20).max(250), respRate: z.number().int().min(5).max(80),
  temperature: z.number().min(30).max(45), spo2: z.number().int().min(50).max(100),
  glucose: z.number().min(20).max(900).optional().nullable(), notes: z.string().trim().max(500).optional(),
});

const historySchema = z.object({
  allergies: z.array(z.string().trim().min(1).max(120)).max(30),
  heredofamiliares: z.string().trim().max(5000),
  patologicos: z.string().trim().max(5000),
  noPatologicos: z.string().trim().max(5000),
  ginecoObstetricos: z.string().trim().max(5000).optional(),
});

const encryptedText = (value: string) => encryptionAdapter.encrypt(value || 'Sin antecedentes referidos.');
const decryptField = (ciphertext: string, iv: string, tag: string) => encryptionAdapter.decrypt({ ciphertext, iv, tag });

const clinicDateParts = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: env.CLINIC_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find(part => part.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
};

const ageFrom = (birthDate: Date) => {
  const today = clinicDateParts();
  let age = today.year - birthDate.getUTCFullYear();
  const month = today.month - (birthDate.getUTCMonth() + 1);
  if (month < 0 || (month === 0 && today.day < birthDate.getUTCDate())) age--;
  return age;
};

const patientProjection = (patient: any) => ({
  id: patient.id,
  expedienteFolio: patient.expediente_folio,
  curp: patient.curp,
  firstName: patient.first_name,
  lastName: patient.last_name,
  fullName: `${patient.first_name} ${patient.last_name}`,
  birthDate: patient.birth_date,
  age: ageFrom(patient.birth_date),
  sex: patient.sex,
  bloodType: patient.blood_type,
  phone: patient.phone,
  email: patient.email,
});

export class PatientsController {
  public updateContact = async (req: Request, res: Response): Promise<void> => {
    const parsed = z.object({
      phone: z.string().trim().min(7).max(20),
      email: z.union([z.email(), z.literal('')]),
    }).safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ success: false, message: 'Revisa el teléfono y el correo del paciente.' }); return; }
    const existing = await prisma.patient.findFirst({ where: { id: req.params.id, is_active: true, deleted_at: null }, select: { id: true } });
    if (!existing) { res.status(404).json({ success: false, message: 'Paciente no encontrado.' }); return; }
    const patient = await prisma.patient.update({ where: { id: existing.id }, data: {
      phone: parsed.data.phone, email: parsed.data.email || null,
    } });
    await auditRepo.appendLog({ userId: req.user!.id, action: 'RECORD_CREATE', resource: 'PatientContact', resourceId: patient.id,
      ipAddress: req.ip || 'unknown', userAgent: req.header('user-agent') || 'unknown', details: { hasEmail: Boolean(patient.email) } });
    res.json({ success: true, data: patientProjection(patient) });
  };

  public getReminders = async (req: Request, res: Response): Promise<void> => {
    const patient = await prisma.patient.findFirst({ where: { id: req.params.id, deleted_at: null }, select: { telegram_chat_id: true, telegram_consent_at: true } });
    if (!patient) { res.status(404).json({ success: false, message: 'Paciente no encontrado.' }); return; }
    res.json({ success: true, data: { chatId: patient.telegram_chat_id, consent: Boolean(patient.telegram_consent_at) } });
  };

  public updateReminders = async (req: Request, res: Response): Promise<void> => {
    const parsed = z.object({ chatId: z.string().trim().regex(/^\d{5,20}$/).nullable(), consent: z.boolean() }).safeParse(req.body);
    if (!parsed.success || (parsed.success && parsed.data.consent && !parsed.data.chatId)) {
      res.status(400).json({ success: false, message: 'Para activar avisos, registra el chat ID y el consentimiento del paciente.' }); return;
    }
    const existing = await prisma.patient.findFirst({ where: { id: req.params.id, deleted_at: null }, select: { id: true, telegram_consent_at: true } });
    if (!existing) { res.status(404).json({ success: false, message: 'Paciente no encontrado.' }); return; }
    const patient = await prisma.patient.update({ where: { id: existing.id }, data: {
      telegram_chat_id: parsed.data.chatId,
      telegram_consent_at: parsed.data.consent ? (existing.telegram_consent_at || new Date()) : null,
    }, select: { id: true, telegram_chat_id: true, telegram_consent_at: true } });
    await auditRepo.appendLog({ userId: req.user!.id, action: 'RECORD_CREATE', resource: 'PatientTelegramConsent', resourceId: patient.id, ipAddress: req.ip || 'unknown', userAgent: req.header('user-agent') || 'unknown', details: { consent: Boolean(patient.telegram_consent_at) } });
    res.json({ success: true, data: { chatId: patient.telegram_chat_id, consent: Boolean(patient.telegram_consent_at) } });
  };

  public list = async (req: Request, res: Response): Promise<void> => {
    const search = String(req.query.search || '').trim();
    const patients = await prisma.patient.findMany({
      where: {
        deleted_at: null,
        ...(search ? { OR: [
          { expediente_folio: { contains: search, mode: 'insensitive' } },
          { curp: { contains: search, mode: 'insensitive' } },
          { first_name: { contains: search, mode: 'insensitive' } },
          { last_name: { contains: search, mode: 'insensitive' } },
        ] } : {}),
      },
      orderBy: [{ last_name: 'asc' }, { first_name: 'asc' }],
      take: 30,
    });
    res.json({ success: true, data: patients.map(patientProjection) });
  };

  public getById = async (req: Request, res: Response): Promise<void> => {
    const patient = await prisma.patient.findFirst({
      where: { id: req.params.id, deleted_at: null },
      include: {
        medical_history: true,
        vitals_signs: { orderBy: { created_at: 'desc' }, take: 1 },
      },
    });
    if (!patient) {
      res.status(404).json({ success: false, message: 'Paciente no encontrado.' });
      return;
    }

    let allergies: string[] = [];
    let medicalHistory = { heredofamiliares: '', patologicos: '', noPatologicos: '', ginecoObstetricos: '' };
    if (patient.medical_history) {
      const h = patient.medical_history;
      const plain = decryptField(h.allergies_ciphertext, h.allergies_iv, h.allergies_tag);
      try { allergies = JSON.parse(plain); } catch { allergies = plain.split(',').map((item) => item.trim()).filter(Boolean); }
      medicalHistory = {
        heredofamiliares: decryptField(h.heredofamiliares_ciphertext, h.heredofamiliares_iv, h.heredofamiliares_tag),
        patologicos: decryptField(h.patologicos_ciphertext, h.patologicos_iv, h.patologicos_tag),
        noPatologicos: decryptField(h.no_patologicos_ciphertext, h.no_patologicos_iv, h.no_patologicos_tag),
        ginecoObstetricos: h.gineco_obs_ciphertext && h.gineco_obs_iv && h.gineco_obs_tag ? decryptField(h.gineco_obs_ciphertext, h.gineco_obs_iv, h.gineco_obs_tag) : '',
      };
    }

    const latest = patient.vitals_signs[0];
    await auditRepo.appendLog({
      userId: req.user?.id, action: 'RECORD_READ', resource: 'Patient', resourceId: patient.id,
      ipAddress: req.ip || 'unknown', userAgent: req.header('user-agent') || 'unknown',
    });

    res.json({
      success: true,
      data: {
        ...patientProjection(patient),
        address: patient.address,
        emergencyContact: patient.emergency_contact,
        emergencyPhone: patient.emergency_phone,
        allergies,
        medicalHistory,
        latestVitals: latest ? {
          id: latest.id, weightKg: Number(latest.weight_kg), heightCm: Number(latest.height_cm), bmi: Number(latest.bmi),
          systolicBp: latest.systolic_bp, diastolicBp: latest.diastolic_bp, heartRate: latest.heart_rate_bpm,
          respRate: latest.respiratory_rate_rpm, temperature: Number(latest.temperature_celsius),
          spo2: latest.oxygen_saturation_pct, glucose: latest.glucose_mg_dl ? Number(latest.glucose_mg_dl) : null,
          capturedAt: latest.created_at,
        } : null,
      },
    });
  };

  public create = async (req: Request, res: Response): Promise<void> => {
    const parsed = createPatientSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Revisa los datos obligatorios del paciente.', issues: parsed.error.flatten().fieldErrors });
      return;
    }
    const value = parsed.data;
    const today = clinicDateParts();
    const clinicToday = `${today.year}-${String(today.month).padStart(2, '0')}-${String(today.day).padStart(2, '0')}`;
    if (value.birthDate > clinicToday) {
      res.status(400).json({ success: false, message: 'La fecha de nacimiento no puede estar en el futuro.', issues: { birthDate: ['Selecciona una fecha válida.'] } });
      return;
    }
    for (let attempt = 0; attempt < 4; attempt++) {
      const folio = value.expedienteFolio || `JD-${new Date().getUTCFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;
      try {
        const patient = await prisma.patient.create({
          data: {
            expediente_folio: folio, curp: value.curp || null, first_name: value.firstName,
            last_name: value.lastName, birth_date: new Date(`${value.birthDate}T00:00:00Z`), sex: value.sex,
            blood_type: value.bloodType, phone: value.phone, email: value.email || null, address: value.address || null,
            emergency_contact: value.emergencyContact || null, emergency_phone: value.emergencyPhone || null,
          },
        });
        await auditRepo.appendLog({
          userId: req.user?.id, action: 'RECORD_CREATE', resource: 'Patient', resourceId: patient.id,
          ipAddress: req.ip || 'unknown', userAgent: req.header('user-agent') || 'unknown',
        });
        res.status(201).json({ success: true, data: patientProjection(patient) });
        return;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          const target = String(error.meta?.target || '');
          if (target.includes('curp')) {
            res.status(409).json({ success: false, message: 'Ya existe un paciente con esa CURP.', issues: { curp: ['Revisa la CURP o busca el expediente existente.'] } });
            return;
          }
          if (target.includes('expediente_folio')) {
            if (!value.expedienteFolio && attempt < 3) continue;
            res.status(409).json({ success: false, message: 'Ese folio ya está en uso.', issues: { expedienteFolio: ['Usa un folio diferente.'] } });
            return;
          }
        }
        res.status(503).json({ success: false, message: 'No se pudo guardar el paciente. Intenta nuevamente.' });
        return;
      }
    }
  };

  public captureVitals = async (req: Request, res: Response): Promise<void> => {
    const parsed = vitalsSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ success: false, message: 'Los signos vitales contienen valores fuera de rango.', issues: parsed.error.flatten().fieldErrors }); return; }
    const patient = await prisma.patient.findFirst({ where: { id: req.params.id, deleted_at: null }, select: { id: true } });
    if (!patient) { res.status(404).json({ success: false, message: 'Paciente no encontrado.' }); return; }
    const value = parsed.data;
    const bmi = Number((value.weightKg / Math.pow(value.heightCm / 100, 2)).toFixed(2));
    const record = await prisma.vitalSigns.create({ data: {
      patient_id: patient.id, captured_by_id: req.user!.id, weight_kg: value.weightKg, height_cm: value.heightCm,
      bmi, systolic_bp: value.systolicBp, diastolic_bp: value.diastolicBp, heart_rate_bpm: value.heartRate,
      respiratory_rate_rpm: value.respRate, temperature_celsius: value.temperature,
      oxygen_saturation_pct: value.spo2, glucose_mg_dl: value.glucose ?? null, notes: value.notes || null,
    }});
    res.status(201).json({ success: true, data: { id: record.id, bmi, capturedAt: record.created_at } });
  };

  public updateMedicalHistory = async (req: Request, res: Response): Promise<void> => {
    const parsed = historySchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ success: false, message: 'Revisa la longitud y formato de los antecedentes.' }); return; }
    const patient = await prisma.patient.findFirst({ where: { id: req.params.id, deleted_at: null, is_active: true }, select: { id: true } });
    if (!patient) { res.status(404).json({ success: false, message: 'Paciente no encontrado.' }); return; }
    const value = parsed.data;
    const allergies = encryptedText(JSON.stringify(value.allergies));
    const hereditary = encryptedText(value.heredofamiliares);
    const pathological = encryptedText(value.patologicos);
    const nonPathological = encryptedText(value.noPatologicos);
    const gyneco = value.ginecoObstetricos ? encryptedText(value.ginecoObstetricos) : null;
    await prisma.medicalHistory.upsert({
      where: { patient_id: patient.id },
      create: {
        patient_id: patient.id,
        allergies_ciphertext: allergies.ciphertext, allergies_iv: allergies.iv, allergies_tag: allergies.tag,
        heredofamiliares_ciphertext: hereditary.ciphertext, heredofamiliares_iv: hereditary.iv, heredofamiliares_tag: hereditary.tag,
        patologicos_ciphertext: pathological.ciphertext, patologicos_iv: pathological.iv, patologicos_tag: pathological.tag,
        no_patologicos_ciphertext: nonPathological.ciphertext, no_patologicos_iv: nonPathological.iv, no_patologicos_tag: nonPathological.tag,
        gineco_obs_ciphertext: gyneco?.ciphertext, gineco_obs_iv: gyneco?.iv, gineco_obs_tag: gyneco?.tag,
      },
      update: {
        allergies_ciphertext: allergies.ciphertext, allergies_iv: allergies.iv, allergies_tag: allergies.tag,
        heredofamiliares_ciphertext: hereditary.ciphertext, heredofamiliares_iv: hereditary.iv, heredofamiliares_tag: hereditary.tag,
        patologicos_ciphertext: pathological.ciphertext, patologicos_iv: pathological.iv, patologicos_tag: pathological.tag,
        no_patologicos_ciphertext: nonPathological.ciphertext, no_patologicos_iv: nonPathological.iv, no_patologicos_tag: nonPathological.tag,
        gineco_obs_ciphertext: gyneco?.ciphertext, gineco_obs_iv: gyneco?.iv, gineco_obs_tag: gyneco?.tag,
      },
    });
    await auditRepo.appendLog({ userId: req.user!.id, action: 'RECORD_CREATE', resource: 'MedicalHistory', resourceId: patient.id, ipAddress: req.ip || 'unknown', userAgent: req.header('user-agent') || 'unknown', details: { fields: ['allergies','heredofamiliares','patologicos','noPatologicos','ginecoObstetricos'] } });
    res.json({ success: true, data: { allergies: value.allergies, medicalHistory: { heredofamiliares: value.heredofamiliares, patologicos: value.patologicos, noPatologicos: value.noPatologicos, ginecoObstetricos: value.ginecoObstetricos || '' } } });
  };
}

export const patientsController = new PatientsController();
