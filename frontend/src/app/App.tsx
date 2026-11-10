import React, { useEffect, useState } from 'react';
import {
  BookHeart,
  CalendarDays,
  ChevronLeft,
  ClipboardPlus,
  FileClock,
  Home,
  LogOut,
  Pill,
  Search,
  ShieldCheck,
  UsersRound,
  X,
  User,
  AlertCircle,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { api, PatientDetail, Session, sessionStore } from '../lib/api';
import { LoginScreen } from '../modules/auth/components/LoginScreen';
import { PatientDirectory } from '../modules/patients/components/PatientDirectory';
import { PatientHeaderBanner } from '../modules/patients/components/PatientHeaderBanner';
import { SoapConsultationEditor, SoapFormData } from '../modules/consultations/components/SoapConsultationEditor';
import { ClinicalHistoryView } from '../modules/consultations/components/ClinicalHistoryView';
import { VitalsData } from '../modules/vitals/components/VitalsCaptureModal';
import { HomeDashboard } from '../modules/home/components/HomeDashboard';
import { AppointmentsView } from '../modules/appointments/components/AppointmentsView';
import { PrescriptionsView } from '../modules/prescriptions/components/PrescriptionsView';
import { AuditView } from '../modules/audit/components/AuditView';
import { PrescriptionVerificationScreen } from '../modules/prescriptions/components/PrescriptionVerificationScreen';
import { MedicalHistoryView } from '../modules/patients/components/MedicalHistoryView';
import { UsersAdminView } from '../modules/admin/components/UsersAdminView';

type View =
  | 'home'
  | 'consultation'
  | 'history'
  | 'background'
  | 'patients'
  | 'appointments'
  | 'prescriptions'
  | 'audit'
  | 'users';

const bloodLabel = (value: string) =>
  value.replace('_POSITIVO', '+').replace('_NEGATIVO', '-').replace('_', ' ');

export const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(() => sessionStore.get());
  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [view, setView] = useState<View>('home');
  const [signedHash, setSignedHash] = useState('');
  const [notice, setNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const authenticate = (next: Session) => {
    sessionStore.set(next);
    setSession(next);
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // Una sesión expirada ya está cerrada del lado del servidor; limpiamos el cliente igualmente.
    } finally {
      sessionStore.clear();
      setSession(null);
      setPatient(null);
      setView('home');
    }
  };

  const selectPatient = (next: PatientDetail) => {
    setPatient(next);
    setSignedHash('');
    setNotice(null);
    setView(session?.user.role.startsWith('MEDICO') ? 'consultation' : 'history');
  };

  const closePatient = () => {
    setPatient(null);
    setSignedHash('');
    setNotice(null);
    setView('patients');
  };

  const openPatient = async (id: string) => {
    if (session?.user.role === 'RECEPCION') {
      setView('patients');
      return;
    }
    try {
      const p = await api.patient(id);
      selectPatient(p);
    } catch (reason) {
      setNotice({
        message: reason instanceof Error ? reason.message : 'No fue posible abrir el expediente.',
        type: 'error',
      });
    }
  };

  const signConsultation = async (data: SoapFormData) => {
    if (!patient) return;
    try {
      setNotice(null);
      const draft = await api.createConsultation({
        patientId: patient.id,
        ...data,
        secondaryIcd10Codes: [],
      });
      const signed = await api.signConsultation(draft.consultationId);
      setSignedHash(signed.signatureHash);
      setNotice({
        message: 'Nota médica firmada y sellada como inmutable (NOM-004-SSA3-2012).',
        type: 'success',
      });
    } catch (reason) {
      setNotice({
        message: reason instanceof Error ? reason.message : 'No fue posible firmar la nota.',
        type: 'error',
      });
      throw reason;
    }
  };

  const saveVitals = async (values: VitalsData) => {
    if (!patient) return;
    await api.captureVitals(patient.id, values);
    setPatient(await api.patient(patient.id));
  };

  // Auto-dismiss notices after 5 seconds
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  const verificationCode = window.location.pathname.match(/^\/verify\/([a-f0-9]{40})$/i)?.[1];
  if (verificationCode) return <PrescriptionVerificationScreen code={verificationCode} />;
  if (!session) return <LoginScreen onAuthenticated={authenticate} />;

  const name = `${session.user.firstName} ${session.user.lastName}`;
  const isDoctor = session.user.role.startsWith('MEDICO');
  const isAdmin = session.user.role === 'ADMINISTRADOR';

  const patientBanner = patient
    ? {
        expedienteFolio: patient.expedienteFolio,
        fullName: patient.fullName,
        birthDate: new Date(patient.birthDate).toLocaleDateString('es-MX', { timeZone: 'UTC' }),
        age: patient.age,
        sex: patient.sex,
        bloodType: bloodLabel(patient.bloodType),
        curp: patient.curp || 'CURP no registrada',
        allergies: patient.allergies,
        latestBp: patient.latestVitals
          ? `${patient.latestVitals.systolicBp}/${patient.latestVitals.diastolicBp}`
          : undefined,
        latestBmi: patient.latestVitals?.bmi,
      }
    : null;

  const viewTitles: Record<View, string> = {
    home: 'Inicio',
    patients: 'Pacientes',
    appointments: 'Agenda ambulatoria',
    consultation: 'Consulta activa SOAP',
    history: 'Historial de notas',
    background: 'Antecedentes clínicos',
    prescriptions: 'Recetas digitales',
    users: 'Gestión de personal',
    audit: 'Pista de auditoría',
  };

  return (
    <div className="app-shell text-clinic-ink lg:grid lg:grid-cols-[260px_1fr]">
      <div className="app-aurora app-aurora--one" aria-hidden="true" />
      <div className="app-aurora app-aurora--two" aria-hidden="true" />
      {/* ── BARRA LATERAL (DESKTOP) ── */}
      <aside className="clinic-sidebar">
        {/* Brand header */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-clinic-line">
          <div className="brand-mark">
            <img src="/jdclinic-mark.svg" alt="" className="w-full h-full" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="font-bold tracking-tight text-clinic-ink">JDClinic</p>
              <span className="secure-dot" title="Sistema en línea" />
            </div>
            <p className="text-[10px] text-clinic-muted font-medium">Expediente Clínico Digital</p>
          </div>
        </div>

        {/* Navigation list */}
        <div className="px-3 py-4 space-y-5 overflow-y-auto flex-1">
          {/* General navigation */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-clinic-muted px-3 mb-1.5">
              Tu clínica
            </p>
            <div className="space-y-0.5">
              <button
                onClick={() => setView('home')}
                className={`clinic-nav w-full ${view === 'home' ? 'clinic-nav--active' : ''}`}
              >
                <Home className="w-4 h-4 shrink-0" />
                <span>Inicio</span>
              </button>
              <button
                onClick={() => setView('patients')}
                className={`clinic-nav w-full ${view === 'patients' ? 'clinic-nav--active' : ''}`}
              >
                <Search className="w-4 h-4 shrink-0" />
                <span>Pacientes</span>
              </button>
              <button
                onClick={() => setView('appointments')}
                className={`clinic-nav w-full ${view === 'appointments' ? 'clinic-nav--active' : ''}`}
              >
                <CalendarDays className="w-4 h-4 shrink-0" />
                <span>Agenda de Citas</span>
              </button>
            </div>
          </div>

          {/* Active patient section */}
          <div>
            <div className="flex items-center justify-between px-3 mb-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-clinic-muted">
                Expediente Activo
              </p>
              {patient && (
                <button
                  type="button"
                  onClick={closePatient}
                  className="text-[10px] text-clinic-muted hover:text-red-600 transition-colors"
                  title="Cerrar expediente actual"
                >
                  Cerrar
                </button>
              )}
            </div>

            {patient ? (
              <div className="space-y-1">
                {/* Active patient mini card */}
                <div className="sidebar-patient-card">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-clinic-soft text-clinic-deep flex items-center justify-center font-bold text-xs shrink-0">
                      {patient.firstName[0]}
                      {patient.lastName[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-clinic-ink truncate leading-tight">
                        {patient.fullName}
                      </p>
                      <p className="text-[10px] font-mono text-clinic-muted truncate mt-0.5">
                        {patient.expedienteFolio}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={closePatient}
                      className="p-1 rounded text-clinic-muted hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Cerrar expediente"
                      aria-label="Cerrar expediente"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Patient actions */}
                {isDoctor && (
                  <button
                    onClick={() => setView('consultation')}
                    className={`clinic-nav w-full ${view === 'consultation' ? 'clinic-nav--active' : ''}`}
                  >
                    <ClipboardPlus className="w-4 h-4 shrink-0" />
                    <span>Consulta SOAP</span>
                  </button>
                )}
                <button
                  onClick={() => setView('history')}
                  className={`clinic-nav w-full ${view === 'history' ? 'clinic-nav--active' : ''}`}
                >
                  <FileClock className="w-4 h-4 shrink-0" />
                  <span>Historial de Notas</span>
                </button>
                {isDoctor && (
                  <>
                    <button
                      onClick={() => setView('background')}
                      className={`clinic-nav w-full ${view === 'background' ? 'clinic-nav--active' : ''}`}
                    >
                      <BookHeart className="w-4 h-4 shrink-0" />
                      <span>Antecedentes</span>
                    </button>
                    <button
                      onClick={() => setView('prescriptions')}
                      className={`clinic-nav w-full ${view === 'prescriptions' ? 'clinic-nav--active' : ''}`}
                    >
                      <Pill className="w-4 h-4 shrink-0" />
                      <span>Recetas Digitales</span>
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="p-3 rounded-xl border border-dashed border-clinic-line bg-clinic-canvas/50 text-[11px] text-clinic-muted leading-relaxed">
                <p>Ningún expediente seleccionado.</p>
                <button
                  type="button"
                  onClick={() => setView('patients')}
                  className="text-clinic-brand font-semibold mt-1 hover:underline inline-block"
                >
                  Abrir directorio →
                </button>
              </div>
            )}
          </div>

          {/* Administration section */}
          {isAdmin && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-clinic-muted px-3 mb-1.5">
                Administración
              </p>
              <div className="space-y-0.5">
                <button
                  onClick={() => setView('users')}
                  className={`clinic-nav w-full ${view === 'users' ? 'clinic-nav--active' : ''}`}
                >
                  <UsersRound className="w-4 h-4 shrink-0" />
                  <span>Personal y Roles</span>
                </button>
                <button
                  onClick={() => setView('audit')}
                  className={`clinic-nav w-full ${view === 'audit' ? 'clinic-nav--active' : ''}`}
                >
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Auditoría</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer with logged-in user and logout */}
        <div className="p-3 border-t border-clinic-line bg-clinic-canvas/50">
          <div className="sidebar-user-card">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-clinic-soft text-clinic-deep flex items-center justify-center text-xs font-bold shrink-0">
                {session.user.firstName[0]}
                {session.user.lastName[0]}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-clinic-ink truncate leading-tight">{name}</p>
                <p className="text-[10px] text-clinic-muted truncate mt-0.5">
                  {session.user.role.replace(/_/g, ' ')}
                </p>
              </div>
            </div>
            {session.user.cedulaProfesional && (
              <p className="text-[10px] font-mono text-clinic-muted mt-1.5 pt-1.5 border-t border-clinic-line/60">
                Céd. {session.user.cedulaProfesional}
              </p>
            )}
          </div>
          <button
            onClick={logout}
            className="clinic-nav w-full text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* ── CONTENIDO PRINCIPAL ── */}
      <div className="min-w-0 flex flex-col min-h-screen">
        {/* Topbar */}
        <header className="clinic-topbar">
          <div className="flex items-center gap-3 min-w-0">
            {patient && ['consultation', 'history', 'background', 'prescriptions'].includes(view) && (
              <button
                onClick={() => setView('patients')}
                className="icon-action shrink-0"
                aria-label="Volver a pacientes"
                title="Volver al directorio"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-clinic-muted truncate">
                <span>JDClinic</span>
                <span>/</span>
                {patient && ['consultation', 'history', 'background', 'prescriptions'].includes(view) && (
                  <>
                    <span className="font-medium text-clinic-ink truncate">{patient.fullName}</span>
                    <span>/</span>
                  </>
                )}
                <span className="font-semibold text-clinic-brand">{viewTitles[view]}</span>
              </div>
              <p className="text-sm font-bold text-clinic-ink truncate mt-0.5">{viewTitles[view]}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {patient && (
              <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-clinic-canvas border border-clinic-line text-xs font-mono">
                <span className="text-clinic-muted">Folio:</span>
                <span className="font-bold text-clinic-ink">{patient.expedienteFolio}</span>
              </div>
            )}
            <div className="secure-chip hidden sm:flex">
              <Lock className="w-3 h-3 text-emerald-600" />
              <span>Datos cifrados</span>
            </div>
            <button
              onClick={logout}
              className="icon-action lg:hidden"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Patient banner if inside patient context */}
        {patientBanner && ['consultation', 'history', 'background', 'prescriptions'].includes(view) && (
          <PatientHeaderBanner {...patientBanner} />
        )}

        {/* Mobile secondary navigation when inside patient context */}
        {patient && ['consultation', 'history', 'background', 'prescriptions'].includes(view) && (
          <nav
            className="patient-subnav lg:hidden"
            aria-label="Secciones del expediente"
          >
            {isDoctor && (
              <button
                onClick={() => setView('consultation')}
                className={`clinic-nav shrink-0 text-xs py-1.5 ${
                  view === 'consultation' ? 'clinic-nav--active' : ''
                }`}
              >
                <ClipboardPlus className="w-3.5 h-3.5" />
                <span>Consulta SOAP</span>
              </button>
            )}
            <button
              onClick={() => setView('history')}
              className={`clinic-nav shrink-0 text-xs py-1.5 ${
                view === 'history' ? 'clinic-nav--active' : ''
              }`}
            >
              <FileClock className="w-3.5 h-3.5" />
              <span>Historial</span>
            </button>
            {isDoctor && (
              <>
                <button
                  onClick={() => setView('background')}
                  className={`clinic-nav shrink-0 text-xs py-1.5 ${
                    view === 'background' ? 'clinic-nav--active' : ''
                  }`}
                >
                  <BookHeart className="w-3.5 h-3.5" />
                  <span>Antecedentes</span>
                </button>
                <button
                  onClick={() => setView('prescriptions')}
                  className={`clinic-nav shrink-0 text-xs py-1.5 ${
                    view === 'prescriptions' ? 'clinic-nav--active' : ''
                  }`}
                >
                  <Pill className="w-3.5 h-3.5" />
                  <span>Recetas</span>
                </button>
              </>
            )}
          </nav>
        )}

        {/* Floating Notification Toast */}
        {notice && (
          <div className="fixed top-20 right-6 z-50 max-w-md glass-toast">
            <div
              className={`p-4 rounded-xl shadow-xl border flex items-start gap-3 ${
                notice.type === 'success'
                  ? 'bg-emerald-50 text-emerald-950 border-emerald-300'
                  : 'bg-red-50 text-red-950 border-red-300'
              }`}
            >
              {notice.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 text-xs leading-relaxed font-medium">
                {notice.message}
              </div>
              <button
                onClick={() => setNotice(null)}
                className="text-clinic-muted hover:text-clinic-ink p-0.5"
                aria-label="Cerrar notificación"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="app-content flex-1 overflow-y-auto pb-24 lg:pb-8">
          <div key={view} className="view-enter min-h-full">
          {view === 'home' && (
            <HomeDashboard
              name={name}
              onAgenda={() => setView('appointments')}
              onPatients={() => setView('patients')}
              onOpenPatient={openPatient}
            />
          )}
          {view === 'patients' && <PatientDirectory onSelect={selectPatient} canOpenClinicalRecord={session.user.role !== 'RECEPCION'} canRegisterPatient={session.user.role !== 'ENFERMERIA'} />}
          {view === 'appointments' && (
            <AppointmentsView role={session.user.role} userId={session.user.id} onOpenPatient={openPatient} />
          )}
          {view === 'consultation' && patient && (
            <SoapConsultationEditor
              patientId={patient.id}
              patientName={patient.fullName}
              patientAge={patient.age}
              folio={patient.expedienteFolio}
              allergies={patient.allergies}
              latestVitals={patient.latestVitals}
              onSaveVitals={saveVitals}
              onSignConsultation={signConsultation}
              isSigned={!!signedHash}
            />
          )}
          {view === 'history' && patient && <ClinicalHistoryView patient={patient} />}
          {view === 'background' && patient && (
            <MedicalHistoryView patient={patient} onUpdated={setPatient} />
          )}
          {view === 'prescriptions' && patient && <PrescriptionsView patient={patient} />}
          {view === 'users' && isAdmin && (
            <UsersAdminView currentUserId={session.user.id} />
          )}
          {view === 'audit' && isAdmin && <AuditView />}
          </div>
        </main>

        {/* Mobile Navigation Bar */}
        <nav className="mobile-nav" aria-label="Navegación móvil">
          <button
            onClick={() => setView('home')}
            className={view === 'home' ? 'active' : ''}
          >
            <Home className="w-4 h-4" />
            <span>Inicio</span>
          </button>
          <button
            onClick={() => setView('patients')}
            className={view === 'patients' ? 'active' : ''}
          >
            <Search className="w-4 h-4" />
            <span>Pacientes</span>
          </button>
          <button
            onClick={() => setView('appointments')}
            className={view === 'appointments' ? 'active' : ''}
          >
            <CalendarDays className="w-4 h-4" />
            <span>Agenda</span>
          </button>
          <button
            disabled={!patient || !isDoctor}
            onClick={() => setView('consultation')}
            className={view === 'consultation' ? 'active' : ''}
          >
            <ClipboardPlus className="w-4 h-4" />
            <span>Consulta</span>
          </button>
        </nav>
      </div>
    </div>
  );
};
