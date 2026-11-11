import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  FilePlus2,
  Search,
  UserRound,
  UsersRound,
  X,
  Plus,
  AlertCircle,
  FolderOpen
} from 'lucide-react';
import { api, ApiRequestError, PatientDetail, PatientSummary } from '../../../lib/api';
import { clinicDateKey } from '../../../lib/clinic-time';

const EMPTY_FORM = {
  curp: '',
  firstName: '',
  lastName: '',
  birthDate: '',
  sex: 'FEMENINO',
  phone: '',
  email: '',
};

export const PatientDirectory: React.FC<{ onSelect: (patient: PatientDetail) => void; canOpenClinicalRecord: boolean; canRegisterPatient: boolean }> = ({
  onSelect,
  canOpenClinicalRecord,
  canRegisterPatient,
}) => {
  const [search, setSearch] = useState('');
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [formIssues, setFormIssues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [reminderPatient, setReminderPatient] = useState<PatientSummary | null>(null);
  const [reminderChat, setReminderChat] = useState('');
  const [reminderConsent, setReminderConsent] = useState(false);
  const [reminderSaving, setReminderSaving] = useState(false);
  const [contactPatient, setContactPatient] = useState<PatientSummary | null>(null);
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactSaving, setContactSaving] = useState(false);

  const updateForm = (field: keyof typeof EMPTY_FORM, value: string) => {
    setForm(current => ({ ...current, [field]: value }));
    setFormIssues(current => { const next = { ...current }; delete next[field]; return next; });
    setFormError('');
  };

  const openReminders = async (patient: PatientSummary) => {
    setError('');
    try { const config = await api.patientReminders(patient.id); setReminderPatient(patient); setReminderChat(config.chatId || ''); setReminderConsent(config.consent); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo consultar Telegram.'); }
  };

  const saveReminders = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reminderPatient) return;
    setReminderSaving(true); setError('');
    try { await api.setPatientReminders(reminderPatient.id, reminderChat.trim() || null, reminderConsent); setReminderPatient(null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo guardar el consentimiento.'); }
    finally { setReminderSaving(false); }
  };

  const saveContact = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!contactPatient) return;
    setContactSaving(true); setError('');
    try {
      await api.updatePatientContact(contactPatient.id, { phone: contactPhone.trim(), email: contactEmail.trim() });
      setContactPatient(null);
      await load(search);
      setSuccess('Contacto actualizado. Los avisos omitidos pueden enviarse desde la agenda.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo actualizar el contacto.'); }
    finally { setContactSaving(false); }
  };

  const load = async (term = search) => {
    setLoading(true);
    setError('');
    try {
      setPatients(await api.patients(term));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible consultar pacientes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load('');
  }, []);

  // Debounced search
  useEffect(() => {
    const handler = setTimeout(() => {
      void load(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const openPatient = async (id: string) => {
    setError('');
    try {
      onSelect(await api.patient(id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible abrir el expediente.');
    }
  };

  const create = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setFormError(''); setFormIssues({}); setSuccess('');
    const cleaned = {
      firstName: form.firstName.trim(), lastName: form.lastName.trim(),
      birthDate: (event.currentTarget.elements.namedItem('birthDate') as HTMLInputElement | null)?.value || form.birthDate, sex: form.sex,
      phone: form.phone.trim(), curp: form.curp.trim().toUpperCase(), email: form.email.trim(),
    };
    if (cleaned.birthDate !== form.birthDate) setForm(current => ({ ...current, birthDate: cleaned.birthDate }));
    const issues: Record<string, string> = {};
    if (cleaned.firstName.length < 2) issues.firstName = 'Escribe al menos 2 letras.';
    if (cleaned.lastName.length < 2) issues.lastName = 'Escribe al menos 2 letras.';
    if (!cleaned.birthDate || cleaned.birthDate > clinicDateKey()) issues.birthDate = 'Selecciona una fecha válida.';
    if (cleaned.phone.length < 7 || cleaned.phone.length > 20) issues.phone = 'Escribe un teléfono de 7 a 20 caracteres.';
    if (cleaned.curp && cleaned.curp.length !== 18) issues.curp = 'La CURP debe tener 18 caracteres.';
    if (Object.keys(issues).length) { setFormIssues(issues); setFormError('Revisa los campos marcados.'); return; }
    setSubmitting(true);
    try {
      const created = await api.createPatient(cleaned);
      setCreating(false);
      setForm(EMPTY_FORM);
      setSearch('');
      await load('');
      setSuccess(`${created.fullName} registrado con folio ${created.expedienteFolio}.`);
      if (canOpenClinicalRecord) await openPatient(created.id);
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'No fue posible registrar al paciente.');
      if (reason instanceof ApiRequestError && reason.issues) {
        setFormIssues(Object.fromEntries(Object.entries(reason.issues).map(([key, messages]) => [key, messages[0] || 'Revisa este dato.'])));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="workspace-view max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 view-enter">
      <header className="page-heading">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-clinic-ink font-serif [text-wrap:pretty]">
            Directorio de pacientes
          </h1>
          <p className="mt-1.5 text-sm text-clinic-muted [text-wrap:pretty]">
            Consulta rápida de expedientes clínicos y registro normativo de nuevos ingresos.
          </p>
        </div>
        {canRegisterPatient && (
          <button
            onClick={() => {
              if (creating) setForm(EMPTY_FORM);
              setCreating(!creating);
              setFormError('');
              setFormIssues({});
              setSuccess('');
            }}
            className={creating ? 'secondary-action h-11' : 'primary-action h-11'}
            aria-expanded={creating}
          >
            {creating ? (
              <>
                <X className="w-4 h-4" />
                <span>Cerrar registro</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Nuevo paciente</span>
              </>
            )}
          </button>
        )}
      </header>

      {/* Formulario de Alta de Paciente */}
      {creating && (
        <form
          onSubmit={create}
          className="clinical-surface p-6 sm:p-8 mb-7 rounded-2xl panel-enter"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-6 border-b border-clinic-line">
            <div>
              <h2 className="text-xl font-semibold text-clinic-ink font-serif">Alta y apertura de expediente</h2>
              <p className="text-xs text-clinic-muted mt-0.5">Captura la filiación completa requerida por la NOM-004-SSA3-2012.</p>
            </div>
            <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-clinic-soft text-clinic-brand border border-clinic-line self-start sm:self-auto">
              Folio automático al guardar
            </span>
          </div>

          {formError && (
            <div role="alert" className="mb-5 p-4 rounded-xl bg-red-50 text-red-700 border border-red-200 text-sm flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
            <label className="block">
              <span className="text-xs font-semibold text-clinic-ink mb-1.5 block">Nombre(s) *</span>
              <input
                type="text"
                required
                minLength={2}
                autoComplete="given-name"
                value={form.firstName}
                onChange={(e) => updateForm('firstName', e.target.value)}
                aria-invalid={!!formIssues.firstName}
                className="clinical-input"
                placeholder="Ej. Carmen"
              />
              {formIssues.firstName && <span className="field-error mt-1 text-xs text-red-600 block">{formIssues.firstName}</span>}
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-clinic-ink mb-1.5 block">Apellidos completos *</span>
              <input
                type="text"
                required
                minLength={2}
                autoComplete="family-name"
                value={form.lastName}
                onChange={(e) => updateForm('lastName', e.target.value)}
                aria-invalid={!!formIssues.lastName}
                className="clinical-input"
                placeholder="Ej. Morales Galván"
              />
              {formIssues.lastName && <span className="field-error mt-1 text-xs text-red-600 block">{formIssues.lastName}</span>}
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-clinic-ink mb-1.5 block">Fecha de nacimiento *</span>
              <input
                type="date"
                name="birthDate"
                required
                value={form.birthDate}
                onChange={(e) => updateForm('birthDate', e.target.value)}
                aria-invalid={!!formIssues.birthDate}
                className="clinical-input font-mono"
              />
              {formIssues.birthDate && <span className="field-error mt-1 text-xs text-red-600 block">{formIssues.birthDate}</span>}
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-clinic-ink mb-1.5 block">Sexo biológico *</span>
              <select
                value={form.sex}
                onChange={(e) => updateForm('sex', e.target.value)}
                className="clinical-input"
              >
                <option value="FEMENINO">Femenino</option>
                <option value="MASCULINO">Masculino</option>
                <option value="INDETERMINADO">Indeterminado</option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-clinic-ink mb-1.5 block">Teléfono de contacto *</span>
              <input
                type="tel"
                required
                autoComplete="tel"
                value={form.phone}
                onChange={(e) => updateForm('phone', e.target.value)}
                aria-invalid={!!formIssues.phone}
                className="clinical-input"
                placeholder="10 dígitos de contacto"
              />
              {formIssues.phone && <span className="field-error mt-1 text-xs text-red-600 block">{formIssues.phone}</span>}
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-clinic-ink mb-1.5 block">
                CURP <span className="text-clinic-muted font-normal text-[11px]">(Opcional)</span>
              </span>
              <input
                type="text"
                value={form.curp}
                onChange={(e) => updateForm('curp', e.target.value.toUpperCase())}
                aria-invalid={!!formIssues.curp}
                className="clinical-input font-mono uppercase"
                placeholder="18 caracteres alfanuméricos"
                maxLength={18}
              />
              {formIssues.curp && <span className="field-error mt-1 text-xs text-red-600 block">{formIssues.curp}</span>}
            </label>

            <label className="sm:col-span-2 block">
              <span className="text-xs font-semibold text-clinic-ink mb-1.5 block">
                Correo electrónico <span className="text-clinic-muted font-normal text-[11px]">(Opcional)</span>
              </span>
              <input
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => updateForm('email', e.target.value)}
                aria-invalid={!!formIssues.email}
                className="clinical-input"
                placeholder="nombre@paciente.com"
              />
              {formIssues.email && <span className="field-error mt-1 text-xs text-red-600 block">{formIssues.email}</span>}
            </label>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-7 pt-5 border-t border-clinic-line">
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setForm(EMPTY_FORM);
                setFormError('');
                setFormIssues({});
              }}
              className="secondary-action h-11"
            >
              Cancelar
            </button>
            <button type="submit" className="primary-action h-11" disabled={submitting}>
              <span>{submitting ? 'Registrando…' : 'Registrar paciente y generar folio'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}

      {success && (
        <div role="status" className="mb-6 p-4 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-sm font-medium flex items-center gap-2">
          <span>{success}</span>
        </div>
      )}

      {/* Buscador interactivo */}
      <div className="mb-6">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-clinic-muted absolute left-3.5" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="clinical-input pl-10 pr-10 shadow-xs"
            placeholder="Buscar por nombre, CURP o número de folio (ej. EXP-2026)..."
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 p-1 rounded-md text-clinic-muted hover:text-clinic-ink"
              title="Limpiar búsqueda"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-6 p-4 rounded-xl bg-red-50 text-red-700 border border-red-200 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {contactPatient && (
        <form onSubmit={saveContact} className="clinical-surface p-5 md:p-6 mb-6 rounded-2xl panel-enter">
          <div className="flex justify-between items-center pb-3 mb-4 border-b border-clinic-line">
            <div>
              <h2 className="text-lg font-semibold text-clinic-ink font-serif">Contacto · {contactPatient.fullName}</h2>
              <p className="text-xs text-clinic-muted mt-0.5">El correo recibe confirmaciones de cita.</p>
            </div>
            <button type="button" className="icon-action" onClick={() => setContactPatient(null)} aria-label="Cerrar">
              <X className="w-4 h-4 text-clinic-muted" />
            </button>
          </div>
          <div className="grid sm:grid-cols-[1fr_1.5fr_auto] gap-3 sm:items-end">
            <label className="block"><span className="field-label">Teléfono</span>
              <input className="clinical-input mt-1.5" type="tel" required minLength={7} maxLength={20} value={contactPhone} onChange={event => setContactPhone(event.target.value)} />
            </label>
            <label className="block"><span className="field-label">Correo del paciente</span>
              <input className="clinical-input mt-1.5" type="email" value={contactEmail} onChange={event => setContactEmail(event.target.value)} placeholder="paciente@correo.com" />
            </label>
            <button type="submit" className="primary-action h-11" disabled={contactSaving}>{contactSaving ? 'Guardando…' : 'Guardar contacto'}</button>
          </div>
        </form>
      )}

      {reminderPatient && (
        <form onSubmit={saveReminders} className="clinical-surface p-5 md:p-6 mb-6 rounded-2xl panel-enter">
          <div className="flex justify-between items-center pb-3 mb-4 border-b border-clinic-line">
            <div>
              <h2 className="text-lg font-semibold text-clinic-ink font-serif">Recordatorios de cita · {reminderPatient.fullName}</h2>
              <p className="text-xs text-clinic-muted mt-0.5">Envío seguro de fecha y horario sin divulgar diagnósticos.</p>
            </div>
            <button type="button" className="icon-action" onClick={() => setReminderPatient(null)} aria-label="Cerrar">
              <X className="w-4 h-4 text-clinic-muted" />
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
            <label className="flex-1 block">
              <span className="text-xs font-semibold text-clinic-ink mb-1.5 block">Chat ID de Telegram del paciente</span>
              <input
                className="clinical-input"
                inputMode="numeric"
                placeholder="Chat ID proporcionado por el paciente"
                value={reminderChat}
                onChange={(event) => setReminderChat(event.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-clinic-ink pb-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={reminderConsent}
                onChange={(event) => setReminderConsent(event.target.checked)}
                className="rounded border-clinic-line text-clinic-brand focus:ring-clinic-brand"
              />
              <span>Autorizó avisos</span>
            </label>
            <button type="submit" className="primary-action h-11" disabled={reminderSaving}>
              {reminderSaving ? 'Guardando…' : 'Guardar configuración'}
            </button>
          </div>
          <p className="mt-3 text-xs text-clinic-muted">
            El paciente debe abrir <a className="font-semibold text-clinic-brand underline underline-offset-2" href="https://t.me/JDClinicAvisosBot" target="_blank" rel="noreferrer">@JDClinicAvisosBot</a> y enviar /start antes de recibir avisos.
          </p>
        </form>
      )}

      {/* Lista de registros */}
      <section className="clinical-surface rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-clinic-line flex items-center justify-between bg-clinic-canvas/50">
          <div className="flex items-center gap-2 text-xs font-semibold text-clinic-ink">
            <UsersRound className="w-4 h-4 text-clinic-brand" />
            <span>Expedientes en catálogo</span>
          </div>
          <span className="font-mono text-xs text-clinic-muted tabular-nums">
            {patients.length} {patients.length === 1 ? 'paciente' : 'pacientes'}
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-clinic-muted flex flex-col items-center">
            <UserRound className="w-7 h-7 text-clinic-brand animate-spin mb-3" />
            <p>Buscando en catálogo clínico…</p>
          </div>
        ) : patients.length === 0 ? (
          <div className="p-12 text-center text-sm text-clinic-muted flex flex-col items-center">
            <UserRound className="w-8 h-8 text-clinic-muted/70 mb-3" />
            <p className="font-semibold text-clinic-ink">
              {search ? 'Sin coincidencias para la búsqueda' : 'No hay pacientes registrados'}
            </p>
            <p className="text-xs text-clinic-muted mt-1 max-w-sm [text-wrap:pretty]">
              {search
                ? 'Verifica el nombre o número de expediente, o registra a la persona si es su primera visita.'
                : 'Comienza dando de alta al primer paciente de la clínica.'}
            </p>
            {!creating && canRegisterPatient && (
              <button
                onClick={() => setCreating(true)}
                className="secondary-action text-xs mt-4 inline-flex items-center gap-1.5 h-9"
              >
                <Plus className="w-3.5 h-3.5" /> Registrar nuevo paciente
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-clinic-line">
            {patients.map((patient) => (
              <div
                key={patient.id}
                className="p-4 sm:px-6 hover:bg-clinic-canvas/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="glass-avatar">
                    {patient.firstName[0]}
                    {patient.lastName[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-clinic-ink truncate group-hover:text-clinic-brand transition-colors">
                      {patient.fullName}
                    </p>
                    <div className="text-xs text-clinic-muted mt-1 font-mono flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-clinic-brand px-2 py-0.5 rounded bg-clinic-soft border border-clinic-line text-[11px]">
                        {patient.expedienteFolio}
                      </span>
                      {patient.curp && <span className="text-clinic-ink/80">CURP: {patient.curp}</span>}
                      <span className="text-clinic-muted">· {patient.age} años · {patient.sex === 'FEMENINO' ? 'Fem' : patient.sex === 'MASCULINO' ? 'Masc' : 'Indet'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
                  {canRegisterPatient && (
                    <button type="button" className="secondary-action text-xs px-2.5 py-1.5 h-8"
                      onClick={() => { setContactPatient(patient); setContactPhone(patient.phone); setContactEmail(patient.email || ''); setReminderPatient(null); setError(''); }}>
                      Contacto
                    </button>
                  )}
                  {canRegisterPatient && (
                    <button
                      type="button"
                      className="secondary-action text-xs px-2.5 py-1.5 h-8"
                      onClick={() => void openReminders(patient)}
                      title="Configurar recordatorios de Telegram"
                    >
                      Telegram
                    </button>
                  )}
                  {canOpenClinicalRecord && (
                    <button
                      type="button"
                      onClick={() => void openPatient(patient.id)}
                      className="primary-action text-xs py-1.5 px-3 h-8 shadow-xs"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>Expediente</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
