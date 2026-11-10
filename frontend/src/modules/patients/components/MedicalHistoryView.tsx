import React, { useState } from 'react';
import {
  LockKeyhole,
  Save,
  AlertTriangle,
  HeartPulse,
  Activity,
  Home,
  Baby,
  CheckCircle2,
  AlertCircle,
  Plus
} from 'lucide-react';
import { api, PatientDetail } from '../../../lib/api';

const QUICK_SUGGESTIONS = {
  allergies: ['Penicilina', 'Sulfas', 'AINEs', 'Cefalosporinas', 'Polen / Ácaros', 'Látex'],
  heredofamiliares: ['Diabetes Mellitus tipo 2', 'Hipertensión Arterial', 'Cardiopatía isquémica', 'Neoplasias', 'Carga hereditaria negada'],
  patologicos: ['Quirúrgicos negados', 'Transfusionales negados', 'Hipertensión diagnosticada', 'Asma bronquial', 'Alergias medicamentosas'],
  noPatologicos: ['Tabaquismo y alcoholismo negados', 'Esquema de vacunación completo', 'Actividad física regular', 'Vivienda con todos los servicios'],
  ginecoObstetricos: ['Menarca a los ', 'Ritmo menstrual regular', 'Gestas: 0, Partos: 0', 'FUM: ', 'Planificación familiar: '],
};

export const MedicalHistoryView: React.FC<{
  patient: PatientDetail;
  onUpdated: (patient: PatientDetail) => void;
}> = ({ patient, onUpdated }) => {
  const [form, setForm] = useState({
    allergies: patient.allergies.join(', '),
    ...patient.medicalHistory,
  });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      await api.updateMedicalHistory(patient.id, {
        ...form,
        allergies: form.allergies.split(',').map((x) => x.trim()).filter(Boolean),
      });
      const updated = await api.patient(patient.id);
      onUpdated(updated);
      setNotice({ type: 'success', message: 'Antecedentes cifrados y actualizados correctamente con AES-256-GCM.' });
    } catch (e) {
      setNotice({
        type: 'error',
        message: e instanceof Error ? e.message : 'No fue posible guardar los antecedentes.',
      });
    } finally {
      setSaving(false);
    }
  };

  const appendSuggestion = (field: keyof typeof form, text: string) => {
    const current = form[field] || '';
    if (!current) {
      setForm({ ...form, [field]: text });
    } else if (current.includes(text)) {
      return;
    } else {
      setForm({ ...form, [field]: `${current.trim().replace(/[.,;]$/, '')}, ${text}` });
    }
  };

  return (
    <div className="workspace-view max-w-5xl mx-auto p-5 lg:p-10 animate-fade-in">
      <header className="page-heading">
        <div>
          <h1 className="page-title">Antecedentes clínicos</h1>
          <p className="page-subtitle">
            Memoria médica de <strong className="text-clinic-ink font-semibold">{patient.fullName}</strong> · {patient.expedienteFolio}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 border border-sky-200 text-xs text-sky-800 font-mono">
            <LockKeyhole className="w-3.5 h-3.5 text-clinic-brand" /> AES-256-GCM (FLE)
          </span>
        </div>
      </header>

      {notice && (
        <div
          className={`mb-6 p-4 rounded-xl border flex items-center gap-3 text-sm animate-fade-in ${
            notice.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-red-50 text-red-900 border-red-200'
          }`}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          )}
          <span>{notice.message}</span>
        </div>
      )}

      <form onSubmit={save} className="space-y-6">
        {/* Alergias críticas */}
        <section className="clinical-surface p-5 sm:p-6 border-l-4 border-l-red-500">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <h2 className="text-sm font-bold text-clinic-ink uppercase tracking-wider">
              Alergias y Reacciones Adversas Críticas
            </h2>
          </div>
          <p className="text-xs text-clinic-muted mb-3">
            Separa cada alergia con comas. Esta información genera insignias de alerta permanente en toda la interfaz.
          </p>
          <input
            className="clinical-input border-red-200 bg-red-50/20 focus:bg-white"
            value={form.allergies}
            onChange={(e) => setForm({ ...form, allergies: e.target.value })}
            placeholder="Ej. Penicilina, Ketorolaco, Látex (dejar vacío si no presenta)"
          />
          <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
            <span className="text-[11px] font-semibold text-clinic-muted mr-1">Comunes:</span>
            {QUICK_SUGGESTIONS.allergies.map((sug) => (
              <button
                key={sug}
                type="button"
                onClick={() => appendSuggestion('allergies', sug)}
                className="text-[11px] px-2 py-0.5 rounded-md bg-clinic-canvas text-clinic-ink hover:bg-clinic-soft border border-clinic-line transition-colors flex items-center gap-0.5"
              >
                <Plus className="w-2.5 h-2.5 text-clinic-brand" /> {sug}
              </button>
            ))}
          </div>
        </section>

        {/* Antecedentes clínicos en cuadrícula */}
        <div className="grid md:grid-cols-2 gap-5">
          {/* Heredofamiliares */}
          <section className="clinical-surface p-5">
            <div className="flex items-center gap-2 mb-2">
              <HeartPulse className="w-4 h-4 text-clinic-brand shrink-0" />
              <h3 className="text-sm font-bold text-clinic-ink">Antecedentes Heredofamiliares</h3>
            </div>
            <p className="text-xs text-clinic-muted mb-2">Patologías en línea directa (padres, abuelos, hermanos).</p>
            <textarea
              className="field-control min-h-24 resize-y"
              value={form.heredofamiliares}
              onChange={(e) => setForm({ ...form, heredofamiliares: e.target.value })}
              placeholder="Diabetes, hipertensión, cardiopatías, cáncer..."
            />
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {QUICK_SUGGESTIONS.heredofamiliares.map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => appendSuggestion('heredofamiliares', sug)}
                  className="text-xs px-2 py-0.5 rounded-md bg-clinic-canvas text-clinic-muted hover:text-clinic-ink hover:bg-clinic-soft border border-clinic-line transition-colors"
                >
                  + {sug}
                </button>
              ))}
            </div>
          </section>

          {/* Patológicos */}
          <section className="clinical-surface p-5">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-clinic-brand shrink-0" />
              <h3 className="text-sm font-bold text-clinic-ink">Personales Patológicos</h3>
            </div>
            <p className="text-xs text-clinic-muted mb-2">Enfermedades crónicas, cirugías, hospitalizaciones previas.</p>
            <textarea
              className="field-control min-h-24 resize-y"
              value={form.patologicos}
              onChange={(e) => setForm({ ...form, patologicos: e.target.value })}
              placeholder="Enfermedades crónicas, intervenciones quirúrgicas, traumatismos..."
            />
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {QUICK_SUGGESTIONS.patologicos.map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => appendSuggestion('patologicos', sug)}
                  className="text-xs px-2 py-0.5 rounded-md bg-clinic-canvas text-clinic-muted hover:text-clinic-ink hover:bg-clinic-soft border border-clinic-line transition-colors"
                >
                  + {sug}
                </button>
              ))}
            </div>
          </section>

          {/* No Patológicos */}
          <section className="clinical-surface p-5">
            <div className="flex items-center gap-2 mb-2">
              <Home className="w-4 h-4 text-clinic-brand shrink-0" />
              <h3 className="text-sm font-bold text-clinic-ink">Personales No Patológicos</h3>
            </div>
            <p className="text-xs text-clinic-muted mb-2">Toxicomanías, vacunación, vivienda, hábitos y actividad física.</p>
            <textarea
              className="field-control min-h-24 resize-y"
              value={form.noPatologicos}
              onChange={(e) => setForm({ ...form, noPatologicos: e.target.value })}
              placeholder="Hábitos higiénico-dietéticos, tabaquismo, inmunizaciones..."
            />
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {QUICK_SUGGESTIONS.noPatologicos.map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => appendSuggestion('noPatologicos', sug)}
                  className="text-xs px-2 py-0.5 rounded-md bg-clinic-canvas text-clinic-muted hover:text-clinic-ink hover:bg-clinic-soft border border-clinic-line transition-colors"
                >
                  + {sug}
                </button>
              ))}
            </div>
          </section>

          {/* Gineco-Obstétricos si FEMENINO */}
          {patient.sex === 'FEMENINO' && (
            <section className="clinical-surface p-5">
              <div className="flex items-center gap-2 mb-2">
                <Baby className="w-4 h-4 text-clinic-brand shrink-0" />
                <h3 className="text-sm font-bold text-clinic-ink">Gineco-Obstétricos</h3>
              </div>
              <p className="text-xs text-clinic-muted mb-2">Menarca, ciclo menstrual, gestas, partos, cesáreas, FUM.</p>
              <textarea
                className="field-control min-h-24 resize-y"
                value={form.ginecoObstetricos}
                onChange={(e) => setForm({ ...form, ginecoObstetricos: e.target.value })}
                placeholder="Menarca, FUM, ritmo menstrual, G: P: C: A:, citología..."
              />
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {QUICK_SUGGESTIONS.ginecoObstetricos.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => appendSuggestion('ginecoObstetricos', sug)}
                    className="text-xs px-2 py-0.5 rounded-md bg-clinic-canvas text-clinic-muted hover:text-clinic-ink hover:bg-clinic-soft border border-clinic-line transition-colors"
                  >
                    + {sug}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Botón de guardado */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <button disabled={saving} className="primary-action">
            <Save className="w-4 h-4" />
            {saving ? 'Cifrando y guardando…' : 'Guardar antecedentes protegidos'}
          </button>
        </div>
      </form>
    </div>
  );
};
