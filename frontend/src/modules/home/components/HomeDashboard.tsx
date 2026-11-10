import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileSignature,
  UsersRound,
  UserPlus,
  Stethoscope,
  Activity,
  AlertCircle,
  Plus
} from 'lucide-react';
import { api, Appointment, Dashboard } from '../../../lib/api';
import { CLINIC_TIME_ZONE, formatClinicTime, toClinicInput } from '../../../lib/clinic-time';

export const HomeDashboard: React.FC<{
  name: string;
  onAgenda: () => void;
  onPatients: () => void;
  onOpenPatient: (id: string) => void;
}> = ({ name, onAgenda, onPatients, onOpenPatient }) => {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.dashboard()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Error al cargar panel'))
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const clinicHour = Number(toClinicInput(now.toISOString()).slice(11, 13));
  const greeting =
    clinicHour < 12
      ? 'Buenos días'
      : clinicHour < 19
      ? 'Buenas tardes'
      : 'Buenas noches';

  const formattedDate = now.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: CLINIC_TIME_ZONE,
  });

  return (
    <div className="home-stage">
      <div className="home-atmosphere" aria-hidden="true">
        <span className="home-atmosphere__light home-atmosphere__light--violet" />
        <span className="home-atmosphere__light home-atmosphere__light--blue" />
        <span className="home-atmosphere__light home-atmosphere__light--coral" />
      </div>

      <div className="home-stage__content max-w-6xl mx-auto p-5 lg:p-10 animate-fade-in">
      {/* Saludo y acciones rápidas */}
      <header className="home-hero flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-8">
        <div>
          <span className="home-hero__date flex items-center gap-1.5 capitalize">
            <Activity className="w-3.5 h-3.5" /> {formattedDate}
          </span>
          <h1 className="home-hero__title mt-3">
            {greeting}, <span>{name.split(' ')[0]}</span>
          </h1>
          <p className="home-hero__subtitle">Todo lo que necesitas para atender hoy.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button onClick={onPatients} className="home-hero__quiet">
            <UsersRound className="w-4 h-4" /> Buscar paciente
          </button>
          <button onClick={onAgenda} className="home-hero__primary">
            <CalendarDays className="w-4 h-4" /> Programar cita
          </button>
        </div>
      </header>

      {error && (
        <div className="status-error mb-6 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tarjetas métricas superiores */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {/* Sala de espera */}
        <button
          onClick={onAgenda}
          className="clinical-surface home-metric home-metric--waiting p-5 text-left group relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <div className="home-metric__icon home-metric__icon--waiting">
              <Clock3 className="w-5 h-5" />
            </div>
            {data && data.waiting > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 animate-pulse">
                Atención requerida
              </span>
            )}
          </div>
          <p className="text-3xl font-extrabold mt-4 font-mono text-clinic-ink">
            {loading ? '…' : data?.waiting ?? 0}
          </p>
          <p className="text-xs font-semibold text-clinic-muted mt-1">En sala de espera</p>
          <div className="mt-3 text-[11px] font-semibold text-clinic-brand inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
            Ver cola en agenda <ArrowRight className="w-3 h-3" />
          </div>
        </button>

        {/* Notas firmadas hoy */}
        <div className="clinical-surface home-metric home-metric--notes p-5 relative overflow-hidden">
          <div className="home-metric__icon home-metric__icon--notes">
            <FileSignature className="w-5 h-5" />
          </div>
          <p className="text-3xl font-extrabold mt-4 font-mono text-clinic-ink">
            {loading ? '…' : data?.signedToday ?? 0}
          </p>
          <p className="text-xs font-semibold text-clinic-muted mt-1">Notas firmadas hoy</p>
          <p className="mt-3 text-[11px] text-clinic-muted flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-clinic-brand" /> Firma registrada
          </p>
        </div>

        {/* Expedientes activos */}
        <button
          onClick={onPatients}
          className="clinical-surface home-metric home-metric--patients p-5 text-left group relative overflow-hidden"
        >
          <div className="home-metric__icon home-metric__icon--patients">
            <UsersRound className="w-5 h-5" />
          </div>
          <p className="text-3xl font-extrabold mt-4 font-mono text-clinic-ink">
            {loading ? '…' : data?.patientCount ?? 0}
          </p>
          <p className="text-xs font-semibold text-clinic-muted mt-1">Pacientes registrados</p>
          <div className="mt-3 text-[11px] font-semibold text-clinic-brand inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
            Directorio completo <ArrowRight className="w-3 h-3" />
          </div>
        </button>
      </div>

      {/* Próximos pacientes de hoy */}
      <section className="clinical-surface home-schedule overflow-hidden">
        <div className="home-schedule__header p-5 flex items-center justify-between gap-4">
          <h2 className="section-title">Próximos pacientes de hoy</h2>
          <button onClick={onAgenda} className="text-link">
            Ver agenda completa <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="empty-state">
            <Clock3 className="w-8 h-8 text-clinic-brand animate-spin mb-3" />
            <p>Consultando jornada clínica…</p>
          </div>
        ) : !data || data.appointments.length === 0 ? (
          <div className="empty-state">
            <CalendarDays className="w-9 h-9 text-clinic-muted mb-3" />
            <p className="font-semibold text-clinic-ink">No hay citas programadas para el resto del día.</p>
            <p className="text-xs text-clinic-muted mt-1">Agrega una nueva cita desde la agenda ambulatoria.</p>
            <button onClick={onAgenda} className="primary-action mt-4">
              <Plus className="w-4 h-4" /> Programar cita
            </button>
          </div>
        ) : (
          <div className="divide-y divide-clinic-line">
            {data.appointments.slice(0, 6).map((a) => (
              <AppointmentRow key={a.id} appointment={a} onOpenPatient={onOpenPatient} />
            ))}
          </div>
        )}
      </section>
      </div>
    </div>
  );
};

const AppointmentRow: React.FC<{
  appointment: Appointment;
  onOpenPatient: (id: string) => void;
}> = ({ appointment: a, onOpenPatient }) => {
  const isWaiting = a.status === 'EN_SALA_DE_ESPERA';
  const isInConsultation = a.status === 'EN_CONSULTA';
  const isCompleted = a.status === 'COMPLETADA';

  return (
    <button
      type="button"
      onClick={() => onOpenPatient(a.patient.id)}
      className="w-full p-4 md:px-5 flex items-center justify-between gap-4 text-left hover:bg-clinic-soft/60 transition-colors cursor-pointer group"
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className="px-2.5 py-1.5 bg-clinic-canvas rounded-lg text-center font-mono shrink-0 border border-clinic-line">
          <time className="text-xs font-bold text-clinic-ink block">
            {formatClinicTime(a.scheduledAt)}
          </time>
          <span className="text-xs text-clinic-muted uppercase">{a.durationMinutes}m</span>
        </div>

        <div className="min-w-0">
          <p className="text-sm font-bold text-clinic-ink truncate group-hover:text-clinic-brand transition-colors">
            {a.patient.name}
          </p>
          <p className="text-xs text-clinic-muted truncate mt-0.5">
            {a.reason || 'Consulta general'} · <span className="font-mono">{a.patient.folio}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <span
          className={`status-chip text-[11px] font-semibold ${
            isWaiting
              ? 'bg-amber-50 text-amber-800 border border-amber-200'
              : isInConsultation
              ? 'bg-sky-50 text-sky-800 border border-sky-200'
              : isCompleted
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-slate-100 text-slate-700'
          }`}
        >
          {a.status.replace(/_/g, ' ')}
        </span>
        <ArrowRight className="w-4 h-4 text-clinic-muted group-hover:text-clinic-brand group-hover:translate-x-1 transition-all" />
      </div>
    </button>
  );
};
