import { AppointmentStatus, Prisma } from '@prisma/client';
import { prisma } from '../adapters/driven/persistence/prisma.client.js';

type Db = Prisma.TransactionClient;

export const OCCUPYING_STATUSES: AppointmentStatus[] = [
  'PROGRAMADA', 'CONFIRMADA', 'EN_SALA_DE_ESPERA', 'EN_CONSULTA',
];

const NEXT_STATUSES: Record<AppointmentStatus, AppointmentStatus[]> = {
  PROGRAMADA: ['CONFIRMADA', 'EN_SALA_DE_ESPERA', 'EN_CONSULTA', 'COMPLETADA', 'CANCELADA', 'NO_ASISTIO'],
  CONFIRMADA: ['EN_SALA_DE_ESPERA', 'EN_CONSULTA', 'COMPLETADA', 'CANCELADA', 'NO_ASISTIO'],
  EN_SALA_DE_ESPERA: ['EN_CONSULTA', 'COMPLETADA', 'CANCELADA', 'NO_ASISTIO'],
  EN_CONSULTA: ['COMPLETADA'],
  COMPLETADA: [],
  CANCELADA: [],
  NO_ASISTIO: [],
};

export const allowedAppointmentStatuses = (status: AppointmentStatus): AppointmentStatus[] => NEXT_STATUSES[status];

export type AppointmentSlot = {
  patientId: string;
  doctorId: string;
  scheduledAt: Date;
  durationMinutes: number;
  excludeId?: string;
};

export type AppointmentConflict = { patient: boolean; doctor: boolean };

export class AppointmentUnavailableError extends Error {
  constructor(public readonly conflict: AppointmentConflict) {
    super(conflictMessage(conflict));
  }
}

export async function findAppointmentConflict(db: Db | typeof prisma, slot: AppointmentSlot): Promise<AppointmentConflict> {
  const end = new Date(slot.scheduledAt.getTime() + slot.durationMinutes * 60_000);
  const exclude = slot.excludeId ? Prisma.sql`AND id <> ${slot.excludeId}::uuid` : Prisma.empty;
  const rows = await db.$queryRaw<Array<{ patient: boolean; doctor: boolean }>>(Prisma.sql`
    SELECT
      COALESCE(bool_or(patient_id = ${slot.patientId}::uuid), false) AS patient,
      COALESCE(bool_or(doctor_id = ${slot.doctorId}::uuid), false) AS doctor
    FROM appointments
    WHERE (patient_id = ${slot.patientId}::uuid OR doctor_id = ${slot.doctorId}::uuid)
      AND status::text IN (${Prisma.join(OCCUPYING_STATUSES)})
      AND scheduled_at < ${end}
      AND scheduled_at + duration_minutes * INTERVAL '1 minute' > ${slot.scheduledAt}
      ${exclude}
  `);
  return rows[0] ?? { patient: false, doctor: false };
}

export function conflictMessage(conflict: AppointmentConflict): string {
  const source = conflict.patient && conflict.doctor ? 'El paciente y el médico ya tienen citas'
    : conflict.patient ? 'El paciente ya tiene una cita' : 'El médico ya tiene una cita';
  return `Este horario no está disponible. ${source} durante ese intervalo.`;
}

// PostgreSQL Serializable detecta reservas simultáneas que leyeron el mismo hueco libre.
// La solicitud que pierda la carrera vuelve a consultar y recibe un 409 claro.
export async function appointmentTransaction<T>(run: (db: Db) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(run, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 10_000,
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') || attempt === 2) throw error;
    }
  }
  throw new Error('No fue posible confirmar la disponibilidad.');
}
