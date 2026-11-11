import React, { useEffect, useRef, useState } from 'react';
import {
  CalendarPlus,
  ChevronRight,
  Clock3,
  User,
  Stethoscope,
  Filter,
  CheckCircle2,
  AlertCircle,
  X,
  Plus
} from 'lucide-react';
import { api, Appointment, AppointmentAvailability, PatientSummary, Role } from '../../../lib/api';
import { CLINIC_TIME_ZONE, clinicDateKey, formatClinicTime, fromClinicInput, toClinicInput } from '../../../lib/clinic-time';


const STATUS_CONFIG: Record<string, { label: string; badgeClass: string; iconClass: string }> = {
  PROGRAMADA: { label: 'Programada', badgeClass: 'bg-slate-100 text-slate-700 border-slate-200', iconClass: 'text-slate-500' },
  CONFIRMADA: { label: 'Confirmada', badgeClass: 'bg-sky-50 text-sky-800 border-sky-200', iconClass: 'text-sky-600' },
  EN_SALA_DE_ESPERA: { label: 'En sala de espera', badgeClass: 'bg-amber-50 text-amber-800 border-amber-200', iconClass: 'text-amber-600' },
  EN_CONSULTA: { label: 'En consulta activa', badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200', iconClass: 'text-emerald-600' },
  COMPLETADA: { label: 'Completada', badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300', iconClass: 'text-emerald-700' },
  CANCELADA: { label: 'Cancelada', badgeClass: 'bg-red-50 text-red-800 border-red-200', iconClass: 'text-red-600' },
  NO_ASISTIO: { label: 'No asistió', badgeClass: 'bg-rose-50 text-rose-800 border-rose-200', iconClass: 'text-rose-600' },
};

const notificationLabel = (notification: NonNullable<Appointment['notifications']>[number]) => {
  if (notification.type === 'WAITING_ROOM_DOCTOR') return 'Aviso al médico';
  if (notification.type === 'APPOINTMENT_REMINDER_PATIENT') return 'Recordatorio';
  const channel = notification.type.endsWith('EMAIL') ? 'correo' : 'Telegram';
  if (notification.intent === 'CANCELLED') return `Cancelación ${channel}`;
  if (notification.intent === 'UPDATED') return `Cambio ${channel}`;
  return `Confirmación ${channel}`;
};

const occupying = new Set(['PROGRAMADA', 'CONFIRMADA', 'EN_SALA_DE_ESPERA', 'EN_CONSULTA']);
const overlaps = (a: Appointment, b: Appointment) => {
  const aStart = new Date(a.scheduledAt).getTime();
  const bStart = new Date(b.scheduledAt).getTime();
  return aStart < bStart + b.durationMinutes * 60_000 && aStart + a.durationMinutes * 60_000 > bStart;
};

export const AppointmentsView: React.FC<{ role: Role; userId: string; onOpenPatient: (id: string) => void }> = ({
  role,
  userId,
  onOpenPatient,
}) => {
  const [date, setDate] = useState(clinicDateKey);
  const [rows, setRows] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [doctors, setDoctors] = useState<Array<{ id: string; name: string }>>([]);
  const [statusFilter, setStatusFilter] = useState<string>('TODAS');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [availability, setAvailability] = useState<AppointmentAvailability | null>(null);
  const [checking, setChecking] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<{ id: string; status: string; patientName: string } | null>(null);
  const [closingStatus, setClosingStatus] = useState(false);
  const statusDialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (pendingStatus && statusDialogRef.current && !statusDialogRef.current.open) statusDialogRef.current.showModal();
  }, [pendingStatus]);

  const [form, setForm] = useState(() => ({
    patientId: '',
    doctorId: '',
    scheduledAt: `${clinicDateKey()}T09:00`,
    durationMinutes: 30,
    reason: '',
  }));

  const load = (silent = false) => {
    if (!silent) setLoading(true);
    api.appointments(date)
      .then(next => { setRows(next); setError(''); })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error al cargar citas'))
      .finally(() => { if (!silent) setLoading(false); });
  };

  useEffect(() => {
    load(false);
  }, [date]);

  const hasNotificationsInProgress = rows.some(appointment =>
    appointment.notifications?.some(notification =>
      ['PENDING', 'PROCESSING', 'RETRY'].includes(notification.status)
    )
  );

  useEffect(() => {
    if (!hasNotificationsInProgress) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') load(true);
    }, 15_000);
    return () => window.clearInterval(interval);
  }, [date, hasNotificationsInProgress]);

  useEffect(() => {
    Promise.all([api.patients(), api.doctors()])
      .then(([p, d]) => {
        setPatients(p);
        setDoctors(d);
        if (d.length > 0 && !form.doctorId) {
          setForm((prev) => ({ ...prev, doctorId: d[0].id }));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open || !form.patientId || !form.scheduledAt || (!role.startsWith('MEDICO') && !form.doctorId)) {
      setAvailability(null);
      setChecking(false);
      return;
    }
    let scheduledAt: Date;
    try { scheduledAt = new Date(fromClinicInput(form.scheduledAt)); }
    catch { setChecking(false); return; }
    let cancelled = false;
    setChecking(true);
    setAvailability(null);
    const timer = window.setTimeout(() => {
      api.appointmentAvailability({
        patientId: form.patientId,
        doctorId: role.startsWith('MEDICO') ? userId : form.doctorId,
        scheduledAt: scheduledAt.toISOString(), durationMinutes: form.durationMinutes,
        ...(editingId ? { excludeId: editingId } : {}),
      }).then(result => { if (!cancelled) setAvailability(result); })
        .catch(() => { if (!cancelled) setAvailability(null); })
        .finally(() => { if (!cancelled) setChecking(false); });
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [open, editingId, form.patientId, form.doctorId, form.scheduledAt, form.durationMinutes, role, userId]);

  const closeForm = () => { setOpen(false); setEditingId(null); setAvailability(null); };
  const openNew = () => {
    setEditingId(null);
    setForm({ patientId: '', doctorId: doctors[0]?.id || '', scheduledAt: `${date}T09:00`, durationMinutes: 30, reason: '' });
    setError('');
    setOpen(true);
  };
  const editAppointment = (appointment: Appointment) => {
    setEditingId(appointment.id);
    setForm({ patientId: appointment.patient.id, doctorId: appointment.doctor.id,
      scheduledAt: toClinicInput(appointment.scheduledAt), durationMinutes: appointment.durationMinutes,
      reason: appointment.reason || '' });
    setError('');
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (availability && !availability.available) {
        setError('Este horario no está disponible. Elige una alternativa.');
        return;
      }
      const payload = {
        ...form,
        scheduledAt: fromClinicInput(form.scheduledAt),
      };
      if (editingId) await api.updateAppointment(editingId, payload);
      else await api.createAppointment(payload);
      closeForm();
      setForm({
        patientId: '',
        doctorId: doctors[0]?.id || '',
        scheduledAt: `${date}T09:00`,
        durationMinutes: 30,
        reason: '',
      });
      if (editingId) setDate(form.scheduledAt.slice(0, 10));
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo programar la cita.');
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (id: string, status: string): Promise<boolean> => {
    try {
      await api.updateAppointmentStatus(id, status);
      load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar el estado.');
      return false;
    }
  };

  const retry = async (id: string, notificationId: string) => {
    try { await api.retryNotification(id, notificationId); load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo reintentar el aviso.'); }
  };

  const filteredRows = rows.filter((a) => {
    if (statusFilter === 'TODAS') return true;
    return a.status === statusFilter;
  });
  const existingConflicts = new Set<string>();
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      const a = rows[i]; const b = rows[j];
      if (occupying.has(a.status) && occupying.has(b.status) && overlaps(a, b)
        && (a.patient.id === b.patient.id || a.doctor.id === b.doctor.id)) {
        existingConflicts.add(a.id); existingConflicts.add(b.id);
      }
    }
  }

  return (
    <div className="workspace-view max-w-6xl mx-auto p-5 lg:p-10 animate-fade-in">
      <header className="page-heading">
        <div>
          <h1 className="page-title">Agenda clínica</h1>
          <p className="page-subtitle">Gestiona turnos, estados en sala de espera y tiempos de consulta.</p>
        </div>
        <button
        onClick={openNew}
          className="primary-action self-start sm:self-auto"
        >
          <CalendarPlus className="w-4 h-4" /> Nueva cita
        </button>
      </header>

      {error && (
        <div className="status-error mb-5 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {existingConflicts.size > 0 && (
        <div className="status-error mb-5 flex items-center gap-2" role="alert">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Hay citas anteriores con horarios superpuestos. Reprograma las señaladas para liberar la agenda.</span>
        </div>
      )}

      {/* Date selector & Status filter bar */}
      <div className="clinical-surface p-4 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-clinic-muted uppercase tracking-wider shrink-0">
            Fecha:
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="clinical-input h-9 text-xs w-auto font-mono"
          />
          <button
            type="button"
          onClick={() => setDate(clinicDateKey())}
            className="glass-chip min-h-9"
          >
            Hoy
          </button>
        </div>

        {/* Filter chips */}
        <div className="segmented-control">
          {[
            { id: 'TODAS', label: 'Todas' },
            { id: 'EN_SALA_DE_ESPERA', label: 'En espera' },
            { id: 'EN_CONSULTA', label: 'En consulta' },
            { id: 'PROGRAMADA', label: 'Programadas' },
            { id: 'COMPLETADA', label: 'Completadas' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={statusFilter === tab.id ? 'active' : ''}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Appointments list */}
      <section className="clinical-surface overflow-hidden">
        <div className="px-5 py-3.5 border-b border-clinic-line flex items-center justify-between bg-clinic-canvas/40">
          <span className="text-xs font-bold text-clinic-ink uppercase tracking-wider">
            Citas programadas ({filteredRows.length})
          </span>
          <span className="text-xs text-clinic-muted font-mono">
            {new Date(date + 'T12:00:00').toLocaleDateString('es-MX', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </span>
        </div>

        {loading ? (
          <div className="empty-state">
            <Clock3 className="w-8 h-8 text-clinic-brand animate-spin mb-3" />
            <p>Cargando citas del día…</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="empty-state">
            <Clock3 className="w-8 h-8 text-clinic-muted mb-3" />
            <p className="font-semibold text-clinic-ink">No hay citas registradas para este criterio.</p>
            <button
              onClick={openNew}
              className="secondary-action mt-4"
            >
              <Plus className="w-3.5 h-3.5" /> Programar una cita
            </button>
          </div>
        ) : (
          <div className="divide-y divide-clinic-line">
            {filteredRows.map((a) => {
              const cfg = STATUS_CONFIG[a.status] || {
                label: a.status,
                badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
                iconClass: 'text-slate-500',
              };
              const timeString = formatClinicTime(a.scheduledAt);
              const endTimeString = formatClinicTime(a.endsAt);

              return (
                <div
                  key={a.id}
                  className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-clinic-soft/40 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="text-center px-3 py-2 bg-clinic-soft rounded-xl shrink-0 border border-clinic-line">
                      <p className="font-mono text-sm font-bold text-clinic-deep">{timeString}–{endTimeString}</p>
                      <p className="text-xs text-clinic-muted uppercase">{a.durationMinutes} min</p>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => onOpenPatient(a.patient.id)}
                          className="text-sm font-bold text-clinic-ink hover:text-clinic-brand transition-colors text-left truncate"
                        >
                          {a.patient.name}
                        </button>
                        <span className="font-mono text-[11px] text-clinic-muted">
                          ({a.patient.folio})
                        </span>
                      </div>
                      <p className="text-xs text-clinic-muted mt-1 flex items-center gap-2 flex-wrap">
                        <span>{a.reason || 'Consulta general de valoración'}</span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1 text-clinic-ink font-medium">
                          <Stethoscope className="w-3 h-3 text-clinic-brand" /> {a.doctor.name}
                        </span>
                      </p>
                      {existingConflicts.has(a.id) && <p className="mt-1 text-xs font-semibold text-red-700">Horario superpuesto</p>}
                      {a.notifications?.map((n) => (
                        <div key={n.id} className="mt-2 flex items-center gap-2 flex-wrap text-[11px] text-clinic-muted">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 border border-white/60 bg-white/55 shadow-sm backdrop-blur-md ${n.status === 'SENT' ? 'text-emerald-800' : n.status === 'FAILED' ? 'text-red-700' : 'text-clinic-muted'}`} title={n.reason || undefined}>
                            {notificationLabel(n)} · {{ PENDING: 'pendiente', PROCESSING: 'enviando', RETRY: 'reintentando', SENT: 'enviado', FAILED: 'falló', SKIPPED: 'omitido' }[n.status]}
                          </span>
                          {['FAILED', 'SKIPPED'].includes(n.status) && n.reason && <span className="max-w-[18rem] truncate" title={n.reason}>{n.reason}</span>}
                          {new Date(a.scheduledAt) > new Date() && (!['CANCELADA', 'NO_ASISTIO', 'COMPLETADA'].includes(a.status) || (a.status === 'CANCELADA' && n.intent === 'CANCELLED')) && (n.status === 'FAILED' || n.status === 'SKIPPED') && <button type="button" className="glass-chip text-[11px]" onClick={() => void retry(a.id, n.id)}>{n.status === 'SKIPPED' ? 'Enviar ahora' : 'Reintentar'}</button>}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                    {role !== 'ENFERMERIA' && a.allowedStatuses.length > 0 && (
                      <button type="button" className="glass-chip text-[11px]" onClick={() => editAppointment(a)}>
                        Reprogramar
                      </button>
                    )}
                    <select
                      aria-label="Estado de cita"
                      className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-clinic-brand/20 transition-all ${cfg.badgeClass}`}
                      value={a.status}
                      disabled={a.allowedStatuses.length === 0}
                      onChange={(e) => {
                        const nextStatus = e.target.value;
                        if (['COMPLETADA', 'CANCELADA', 'NO_ASISTIO'].includes(nextStatus)) {
                          setPendingStatus({ id: a.id, status: nextStatus, patientName: a.patient.name });
                        } else {
                          void setStatus(a.id, nextStatus);
                        }
                      }}
                    >
                      {[a.status, ...a.allowedStatuses].map((key) => (
                        <option key={key} value={key}>
                          {STATUS_CONFIG[key].label}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => onOpenPatient(a.patient.id)}
                      className="secondary-action text-xs py-1.5 px-3"
                      title="Abrir expediente del paciente"
                    >
                      <span>Expediente</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {pendingStatus && (
        <dialog ref={statusDialogRef} onClose={() => setPendingStatus(null)} onCancel={(event) => { if (closingStatus) event.preventDefault(); }} aria-labelledby="close-appointment-title" className="status-dialog modal-card max-w-md">
          <p className="field-label mb-2">Agenda clínica</p>
          <h2 id="close-appointment-title" className="section-title">Cerrar cita</h2>
          <p className="mt-3 text-sm text-clinic-muted leading-relaxed">
            {pendingStatus.patientName} quedará como <strong className="text-clinic-ink">{STATUS_CONFIG[pendingStatus.status].label.toLowerCase()}</strong>. Después no se podrá reprogramar.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className="secondary-action" disabled={closingStatus} onClick={() => statusDialogRef.current?.close()}>Volver</button>
            <button type="button" className={`primary-action ${pendingStatus.status === 'CANCELADA' ? 'bg-red-700 hover:bg-red-800' : ''}`} disabled={closingStatus} onClick={async () => {
              setClosingStatus(true);
              const changed = await setStatus(pendingStatus.id, pendingStatus.status);
              setClosingStatus(false);
              if (changed) statusDialogRef.current?.close();
            }}>{closingStatus ? 'Guardando…' : 'Confirmar cierre'}</button>
          </div>
        </dialog>
      )}

      {/* Modal Nueva Cita */}
      {open && (
        <div className="modal-backdrop">
          <form onSubmit={submit} className="modal-card max-w-xl animate-fade-in">
            <div className="flex items-center justify-between pb-4 border-b border-clinic-line mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-clinic-soft text-clinic-deep flex items-center justify-center">
                  <CalendarPlus className="w-5 h-5 text-clinic-brand" />
                </div>
                <div>
                  <h2 className="section-title">{editingId ? 'Reprogramar cita' : 'Programar cita médica'}</h2>
                  <p className="text-xs text-clinic-muted">{editingId ? 'Ajusta el horario o los datos de atención' : 'Ingresa los datos para agendar la atención'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="icon-action"
                aria-label="Cerrar modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {error && <div className="status-error text-xs" role="alert">{error}</div>}
              <div>
                <label className="field-label">Paciente *</label>
                <select
                  className="clinical-input mt-1.5"
                  required
                  value={form.patientId}
                  disabled={!!editingId}
                  onChange={(e) => setForm({ ...form, patientId: e.target.value })}
                >
                  <option value="">Seleccionar paciente registrado…</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName} · {p.expedienteFolio}
                    </option>
                  ))}
                </select>
              </div>

              {!role.startsWith('MEDICO') && (
                <div>
                  <label className="field-label">Médico tratante *</label>
                  <select
                    className="clinical-input mt-1.5"
                    required
                    value={form.doctorId}
                    onChange={(e) => setForm({ ...form, doctorId: e.target.value })}
                  >
                    <option value="">Seleccionar médico…</option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="field-label">Fecha y hora · {CLINIC_TIME_ZONE === 'America/Mexico_City' ? 'Ciudad de México' : CLINIC_TIME_ZONE} *</label>
                  <input
                    className="clinical-input mt-1.5"
                    type="datetime-local"
                    required
                    value={form.scheduledAt}
                    onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label">Duración estimada</label>
                  <select
                    className="clinical-input mt-1.5"
                    value={form.durationMinutes}
                    onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
                  >
                    <option value={20}>20 minutos (Rápida)</option>
                    <option value={30}>30 minutos (Estándar)</option>
                    <option value={45}>45 minutos (Especialidad)</option>
                    <option value={60}>60 minutos (Primera vez / Integral)</option>
                  </select>
                </div>
              </div>

              {checking && <p className="text-xs text-clinic-muted">Consultando disponibilidad…</p>}
              {availability?.available && <p className="text-xs font-semibold text-emerald-700"><CheckCircle2 className="inline w-3.5 h-3.5 mr-1" />Horario disponible</p>}
              {availability && !availability.available && (
                <div className="status-error text-xs" role="alert">
                  <p className="font-semibold">Este horario no está disponible: {availability.conflict.patient && availability.conflict.doctor ? 'paciente y médico ocupados' : availability.conflict.patient ? 'paciente ocupado' : 'médico ocupado'}.</p>
                  {availability.alternatives.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span>Alternativas:</span>
                      {availability.alternatives.map(value => (
                        <button type="button" key={value} className="glass-chip text-[11px]" onClick={() => setForm(prev => ({ ...prev, scheduledAt: toClinicInput(value) }))}>
                          {formatClinicTime(value)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="field-label">Motivo de consulta</label>
                <input
                  className="clinical-input mt-1.5"
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="Ej. Control de hipertensión, valoración posquirúrgica..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 mt-7 pt-4 border-t border-clinic-line">
              <button
                type="button"
                onClick={closeForm}
                className="secondary-action"
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || checking || !form.patientId || availability?.available === false}
                className="primary-action"
              >
                {saving ? 'Guardando cita…' : editingId ? 'Guardar cambios' : 'Agendar cita'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
