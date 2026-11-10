import React, { useState } from 'react';
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  AlertCircle,
  HeartPulse,
} from 'lucide-react';
import { api, Session } from '../../../lib/api';

export const LoginScreen: React.FC<{ onAuthenticated: (session: Session) => void }> = ({
  onAuthenticated,
}) => {
  const demoDoctorEmail = import.meta.env.VITE_DEMO_DOCTOR_EMAIL || 'medico@clinica.local';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const session = await api.login(email, password);
      onAuthenticated(session);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Credenciales no válidas o acceso denegado.');
    } finally {
      setLoading(false);
    }
  };

  const fillQuick = (userEmail: string) => {
    setEmail(userEmail);
    setPassword('Clinica2026!');
  };

  return (
    <main className="login-stage">
      <div className="login-atmosphere" aria-hidden="true">
        <span className="login-atmosphere__light login-atmosphere__light--violet" />
        <span className="login-atmosphere__light login-atmosphere__light--blue" />
        <span className="login-atmosphere__light login-atmosphere__light--coral" />
      </div>
      <div className="login-shell view-enter">
        <section className="login-identity" aria-label="Presentación de JDClinic">
          <div>
            <div className="flex items-center gap-3">
              <div className="brand-mark brand-mark--large shadow-sm shrink-0">
                <img src="/jdclinic-mark.svg" alt="JDClinic" className="w-full h-full" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold tracking-tight text-clinic-ink font-serif">JDClinic</p>
                <p className="text-xs text-clinic-muted truncate">Expediente Clínico Electrónico</p>
              </div>
            </div>

            <div className="mt-4 md:mt-12 max-w-sm">
              <h1 className="text-xl sm:text-2xl md:text-[2.5rem] leading-[1.12] md:leading-[1.1] font-semibold tracking-[-0.03em] text-clinic-ink font-serif [text-wrap:pretty]">
                Todo el contexto clínico, justo donde lo necesitas.
              </h1>
              <p className="mt-2 md:mt-4 text-xs sm:text-sm leading-relaxed text-clinic-muted [text-wrap:pretty]">
                Consulta, documenta y prescribe con trazabilidad normativa y rigor en cada consulta.
              </p>
            </div>
          </div>

          <div className="pt-4 md:pt-8 mt-4 md:mt-0 border-t border-clinic-brand/10 flex items-center justify-between text-xs text-clinic-muted flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0" />
              <span className="font-mono text-[11px] tracking-wide">NOM-004 · NOM-024 · AES-256</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-clinic-muted">
              <LockKeyhole className="w-3.5 h-3.5" />
              <span>Cifrado clínico</span>
            </div>
          </div>
        </section>

        <section className="login-form-panel">
          <div className="mb-6">
            <h2 className="text-2xl lg:text-3xl font-semibold tracking-[-0.025em] text-clinic-ink font-serif">
              Inicia tu turno
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-clinic-muted [text-wrap:pretty]">
              Credenciales institucionales para acceso protegido al expediente.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="field-label mb-1.5 block text-xs font-semibold text-clinic-ink" htmlFor="email">
                Correo institucional
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="clinical-input"
                placeholder="nombre@clinica.local"
              />
            </div>

            <div>
              <label className="field-label mb-1.5 block text-xs font-semibold text-clinic-ink" htmlFor="password">
                Contraseña
              </label>
              <div className="relative flex items-center">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="clinical-input pr-12"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-1.5 w-10 h-10 flex items-center justify-center text-clinic-muted hover:text-clinic-ink rounded-lg transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4 text-clinic-muted" /> : <Eye className="w-4 h-4 text-clinic-muted" />}
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" className="status-error flex items-center gap-2 p-3 text-xs rounded-xl bg-red-50 text-red-700 border border-red-200">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            <button type="submit" className="primary-action w-full justify-center h-12 md:h-11 text-sm font-semibold shadow-sm cursor-pointer" disabled={loading}>
              <span>{loading ? 'Verificando acceso…' : 'Entrar a JDClinic'}</span>
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          {import.meta.env.DEV && <div className="mt-6 pt-5 border-t border-clinic-line">
            <p className="text-xs font-semibold uppercase tracking-wider text-clinic-muted mb-2.5">
              Accesos rápidos de demostración
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fillQuick(demoDoctorEmail)}
                className="secondary-action text-xs px-3.5 py-2 rounded-lg border border-clinic-line hover:border-clinic-brand cursor-pointer"
              >
                Médico General
              </button>
              <button
                type="button"
                onClick={() => fillQuick('admin@clinica.local')}
                className="secondary-action text-xs px-3.5 py-2 rounded-lg border border-clinic-line hover:border-clinic-brand cursor-pointer"
              >
                Administrador
              </button>
            </div>
          </div>}
        </section>
      </div>
    </main>
  );
};
