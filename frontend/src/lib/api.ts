export type Role = 'ADMINISTRADOR' | 'MEDICO_GENERAL' | 'MEDICO_ESPECIALISTA' | 'ENFERMERIA' | 'RECEPCION';

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  cedulaProfesional?: string | null;
}

export interface Session { token: string; user: SessionUser }

export interface PatientSummary {
  id: string;
  expedienteFolio: string;
  curp?: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  birthDate: string;
  age: number;
  sex: 'MASCULINO' | 'FEMENINO' | 'INDETERMINADO';
  bloodType: string;
  phone: string;
  email?: string | null;
}

export interface PatientDetail extends PatientSummary {
  address?: string | null;
  emergencyContact?: string | null;
  emergencyPhone?: string | null;
  allergies: string[];
  medicalHistory: { heredofamiliares: string; patologicos: string; noPatologicos: string; ginecoObstetricos: string };
  latestVitals?: {
    id: string;
    weightKg: number;
    heightCm: number;
    bmi: number;
    systolicBp: number;
    diastolicBp: number;
    heartRate: number;
    respRate: number;
    temperature: number;
    spo2: number;
    glucose?: number | null;
    capturedAt: string;
  } | null;
}

export interface Appointment {
  id: string; scheduledAt: string; endsAt: string; durationMinutes: number; status: string; allowedStatuses: string[]; reason?: string | null;
  patient: { id: string; folio: string; name: string }; doctor: { id: string; name: string };
  notifications?: Array<{ id: string; type: 'WAITING_ROOM_DOCTOR' | 'APPOINTMENT_REMINDER_PATIENT' | 'APPOINTMENT_CONFIRMATION_PATIENT_TELEGRAM' | 'APPOINTMENT_CONFIRMATION_PATIENT_EMAIL'; intent: 'CREATED' | 'UPDATED' | 'CANCELLED'; status: 'PENDING' | 'PROCESSING' | 'RETRY' | 'SENT' | 'FAILED' | 'SKIPPED'; sentAt?: string | null; reason?: string | null }>;
}
export interface AppointmentAvailability {
  available: boolean;
  conflict: { patient: boolean; doctor: boolean };
  alternatives: string[];
}
export interface Dashboard { patientCount: number; signedToday: number; waiting: number; appointments: Appointment[] }
export interface Prescription {
  id: string; folio: string; consultationId: string; verificationCode: string; signatureHash?: string | null; expirationDate: string; createdAt: string;
  instructions: string; doctor: string; cedula?: string | null; diagnosisCode: string;
  items: Array<{ id: string; medicationName: string; genericName?: string | null; presentation: string; dosage: string; frequency: string; durationDays: number; routeAdministration: string }>;
}

export interface StudyAttachment { id: string; fileName: string; mimeType: string; sizeBytes: number; createdAt: string; uploadedBy: string }

export class ApiRequestError extends Error {
  constructor(message: string, public status: number, public issues?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

const SESSION_KEY = 'savia-ece-session';

export const sessionStore = {
  get(): Session | null {
    try {
      const session: Session | null = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      if (session?.user.email === 'admin@clinica.local' && session.user.firstName === 'Administración' && session.user.lastName === 'Savia') {
        session.user.lastName = 'JDClinic';
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      }
      return session;
    } catch { return null; }
  },
  set(session: Session) { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); },
  clear() { localStorage.removeItem(SESSION_KEY); },
};

async function request<T>(path: string, options: RequestInit = {}, authenticated = true): Promise<T> {
  const session = sessionStore.get();
  const response = await fetch(`/api/v1${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authenticated && session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiRequestError(body.message || body.error || 'No fue posible completar la operación.', response.status, body.issues);
  return body.data as T;
}

async function requestPdf(path: string): Promise<Blob> {
  const token = sessionStore.get()?.token;
  const response = await fetch(`/api/v1${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || 'No se pudo abrir el PDF.');
  }
  return response.blob();
}

export const api = {
  login: (email: string, password: string) => request<Session>('/auth/login', {
    method: 'POST', body: JSON.stringify({ email, password }),
  }, false),
  logout: () => request<{ closed: boolean }>('/auth/logout', { method: 'POST', body: JSON.stringify({}) }),
  patients: (search = '') => request<PatientSummary[]>(`/patients?search=${encodeURIComponent(search)}`),
  patient: (id: string) => request<PatientDetail>(`/patients/${id}`),
  createPatient: (input: Record<string, unknown>) => request<PatientSummary>('/patients', {
    method: 'POST', body: JSON.stringify(input),
  }),
  captureVitals: (patientId: string, input: unknown) => request<{ id: string; bmi: number; capturedAt: string }>(`/patients/${patientId}/vitals`, {
    method: 'POST', body: JSON.stringify(input),
  }),
  updateMedicalHistory: (patientId: string, input: unknown) => request<{ allergies: string[]; medicalHistory: PatientDetail['medicalHistory'] }>(`/patients/${patientId}/history`, { method: 'PUT', body: JSON.stringify(input) }),
  createConsultation: (input: Record<string, unknown>) => request<{ consultationId: string }>('/consultations', {
    method: 'POST', body: JSON.stringify(input),
  }),
  signConsultation: (id: string) => request<{ signatureHash: string; signedAt: string }>(`/consultations/${id}/sign`, {
    method: 'POST', body: JSON.stringify({}),
  }),
  consultations: (patientId: string) => request<any[]>(`/patients/${patientId}/consultations`),
  dashboard: () => request<Dashboard>('/dashboard'),
  appointments: (date: string) => request<Appointment[]>(`/appointments?date=${encodeURIComponent(date)}`),
  appointmentAvailability: (input: { patientId: string; doctorId?: string; scheduledAt: string; durationMinutes: number; excludeId?: string }) =>
    request<AppointmentAvailability>(`/appointments/availability?${new URLSearchParams({
      patientId: input.patientId, ...(input.doctorId ? { doctorId: input.doctorId } : {}),
      scheduledAt: input.scheduledAt, durationMinutes: String(input.durationMinutes),
      ...(input.excludeId ? { excludeId: input.excludeId } : {}),
    })}`),
  createAppointment: (input: unknown) => request<Appointment>('/appointments', { method: 'POST', body: JSON.stringify(input) }),
  updateAppointment: (id: string, input: unknown) => request<Appointment>(`/appointments/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  updateAppointmentStatus: (id: string, status: string) => request<Appointment>(`/appointments/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  retryNotification: (id: string, notificationId: string) => request<{ queued: boolean }>(`/appointments/${id}/notifications/${notificationId}/retry`, { method: 'POST', body: '{}' }),
  patientReminders: (id: string) => request<{ chatId: string | null; consent: boolean }>(`/patients/${id}/reminders`),
  setPatientReminders: (id: string, chatId: string | null, consent: boolean) => request<{ chatId: string | null; consent: boolean }>(`/patients/${id}/reminders`, { method: 'PATCH', body: JSON.stringify({ chatId, consent }) }),
  updatePatientContact: (id: string, input: { phone: string; email: string }) => request<PatientSummary>(`/patients/${id}/contact`, { method: 'PATCH', body: JSON.stringify(input) }),
  doctors: () => request<Array<{ id: string; name: string; specialty?: string | null }>>('/doctors'),
  prescriptions: (patientId: string) => request<Prescription[]>(`/patients/${patientId}/prescriptions`),
  createPrescription: (input: unknown) => request<{ id: string; folio: string; verificationCode: string; expirationDate: string }>('/prescriptions', { method: 'POST', body: JSON.stringify(input) }),
  prescriptionPdf: (id: string) => requestPdf(`/prescriptions/${id}/pdf`),
  attachments: (patientId: string) => request<StudyAttachment[]>(`/patients/${patientId}/attachments`),
  storageStatus: () => request<{ configured: boolean }>('/storage/status'),
  uploadAttachment: async (patientId: string, file: File) => {
    const prepared = await request<{ id: string; url: string; fields: Record<string, string> }>(`/patients/${patientId}/attachments/upload`, { method: 'POST', body: JSON.stringify({ fileName: file.name, mimeType: file.type, sizeBytes: file.size }) });
    const form = new FormData();
    Object.entries(prepared.fields).forEach(([key, value]) => form.append(key, value));
    form.append('file', file);
    const uploaded = await fetch(prepared.url, { method: 'POST', body: form });
    if (!uploaded.ok) throw new Error('S3 no aceptó la carga. Revisa la conexión y configuración del almacenamiento.');
    return request<{ id: string; ready: boolean }>(`/patients/${patientId}/attachments/${prepared.id}/complete`, { method: 'POST', body: '{}' });
  },
  attachmentUrl: (patientId: string, id: string) => request<{ url: string; expiresAt: string }>(`/patients/${patientId}/attachments/${id}/url`),
  addAddenda: (consultationId: string, text: string) => request<{ id: string; signatureHash: string; signedAt: string }>(`/consultations/${consultationId}/addendas`, { method: 'POST', body: JSON.stringify({ text }) }),
  audit: () => request<Array<{ id: string; action: string; resource: string; resourceId?: string; createdAt: string; ipAddress: string; chainHash: string; user: string; email?: string }>>('/audit'),
  verifyPrescription: (code: string) => request<{ valid: boolean; issuedAt: string; expirationDate: string; doctor: string; cedula?: string | null }>(`/prescriptions/verify/${encodeURIComponent(code)}`, {}, false),
  users: () => request<Array<{ id:string; email:string; first_name:string; last_name:string; role:Role; cedula_profesional?:string|null; especialidad?:string|null; phone?:string|null; telegram_chat_id?:string|null; is_active:boolean; created_at:string }>>('/users'),
  createUser: (input: unknown) => request<any>('/users', { method: 'POST', body: JSON.stringify(input) }),
  setUserStatus: (id: string, isActive: boolean) => request<unknown>(`/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
  setDoctorTelegram: (id: string, chatId: string | null) => request<{ id: string; chatId: string | null }>(`/users/${id}/telegram`, { method: 'PATCH', body: JSON.stringify({ chatId }) }),
};
