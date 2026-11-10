import React, { useState } from 'react';
import { Activity, X, HeartPulse, Scale, Check, AlertTriangle, ShieldCheck, Thermometer, Wind } from 'lucide-react';

export interface VitalsData {
  weightKg: number;
  heightCm: number;
  bmi: number;
  bmiCategory: string;
  systolicBp: number;
  diastolicBp: number;
  bpCategory: string;
  heartRate: number;
  respRate: number;
  temperature: number;
  spo2: number;
  glucose?: number;
}

interface VitalsCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveVitals: (vitals: VitalsData) => void | Promise<void>;
  initialVitals?: VitalsData;
}

export const VitalsCaptureModal: React.FC<VitalsCaptureModalProps> = ({
  isOpen,
  onClose,
  onSaveVitals,
  initialVitals,
}) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [weightKg, setWeightKg] = useState<number>(initialVitals?.weightKg || 70);
  const [heightCm, setHeightCm] = useState<number>(initialVitals?.heightCm || 168);
  const [systolic, setSystolic] = useState<number>(initialVitals?.systolicBp || 120);
  const [diastolic, setDiastolic] = useState<number>(initialVitals?.diastolicBp || 80);
  const [heartRate, setHeartRate] = useState<number>(initialVitals?.heartRate || 75);
  const [respRate, setRespRate] = useState<number>(initialVitals?.respRate || 18);
  const [temperature, setTemperature] = useState<number>(initialVitals?.temperature || 36.5);
  const [spo2, setSpo2] = useState<number>(initialVitals?.spo2 || 98);
  const [glucose, setGlucose] = useState<number | undefined>(initialVitals?.glucose || 90);

  if (!isOpen) return null;

  // Cálculo en vivo de IMC
  const heightMeters = heightCm / 100;
  const bmi = heightMeters > 0 ? parseFloat((weightKg / (heightMeters * heightMeters)).toFixed(1)) : 0;

  let bmiCategory = 'Normal';
  let bmiBadgeClass = 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (bmi < 18.5) {
    bmiCategory = 'Bajo peso';
    bmiBadgeClass = 'text-amber-700 bg-amber-50 border-amber-200';
  } else if (bmi >= 25 && bmi < 30) {
    bmiCategory = 'Sobrepeso';
    bmiBadgeClass = 'text-amber-700 bg-amber-50 border-amber-200';
  } else if (bmi >= 30) {
    bmiCategory = 'Obesidad';
    bmiBadgeClass = 'text-red-700 bg-red-50 border-red-200';
  }

  // Clasificación de Presión Arterial
  let bpCategory = 'Normal';
  let bpBadgeClass = 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (systolic >= 140 || diastolic >= 90) {
    bpCategory = 'Hipertensión';
    bpBadgeClass = 'text-red-700 bg-red-50 border-red-200';
  } else if (systolic >= 120 || diastolic >= 80) {
    bpCategory = 'Elevada';
    bpBadgeClass = 'text-amber-700 bg-amber-50 border-amber-200';
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSaveVitals({
        weightKg,
        heightCm,
        bmi,
        bmiCategory,
        systolicBp: systolic,
        diastolicBp: diastolic,
        bpCategory,
        heartRate,
        respRate,
        temperature,
        spo2,
        glucose: glucose ? Number(glucose) : undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar signos vitales');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card max-w-xl animate-fade-in">
        {/* Cabecera del modal */}
        <div className="flex items-center justify-between pb-3.5 border-b border-clinic-line">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-clinic-soft text-clinic-brand flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-clinic-ink">Toma de Signos Vitales y Somatometría</h2>
              <p className="text-xs text-clinic-muted">Captura clínica estandarizada (NOM-004-SSA3-2012)</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="icon-action"
            aria-label="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="status-error mt-4">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-5">
          {/* SECCIÓN 1: Somatometría y Cálculo de IMC */}
          <div className="p-4 rounded-xl bg-clinic-canvas border border-clinic-line">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-clinic-ink flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-clinic-brand" /> Somatometría
              </span>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${bmiBadgeClass}`}>
                IMC: {bmi} ({bmiCategory})
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label mb-1 block">Peso Corporal</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="350"
                    required
                    value={weightKg}
                    onChange={(e) => setWeightKg(parseFloat(e.target.value) || 0)}
                    className="clinical-input pr-10 font-mono"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-clinic-muted">kg</span>
                </div>
              </div>

              <div>
                <label className="field-label mb-1 block">Talla / Estatura</label>
                <div className="relative">
                  <input
                    type="number"
                    step="1"
                    min="30"
                    max="250"
                    required
                    value={heightCm}
                    onChange={(e) => setHeightCm(parseFloat(e.target.value) || 0)}
                    className="clinical-input pr-10 font-mono"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-clinic-muted">cm</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: Presión Arterial */}
          <div className="p-4 rounded-xl bg-clinic-canvas border border-clinic-line">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-clinic-ink flex items-center gap-1.5">
                <HeartPulse className="w-3.5 h-3.5 text-clinic-brand" /> Presión Arterial
              </span>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${bpBadgeClass}`}>
                {bpCategory}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label mb-1 block">Sistólica (máxima)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="1"
                    min="50"
                    max="280"
                    required
                    value={systolic}
                    onChange={(e) => setSystolic(parseInt(e.target.value, 10) || 0)}
                    className="clinical-input pr-14 font-mono"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-clinic-muted">mmHg</span>
                </div>
              </div>

              <div>
                <label className="field-label mb-1 block">Diastólica (mínima)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="1"
                    min="30"
                    max="180"
                    required
                    value={diastolic}
                    onChange={(e) => setDiastolic(parseInt(e.target.value, 10) || 0)}
                    className="clinical-input pr-14 font-mono"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-clinic-muted">mmHg</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECCIÓN 3: Signos Vitales Cardiorrespiratorios y Metabólicos */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="field-label mb-1 block">Frec. Cardíaca</label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  min="30"
                  max="250"
                  required
                  value={heartRate}
                  onChange={(e) => setHeartRate(parseInt(e.target.value, 10) || 0)}
                  className="clinical-input pr-9 font-mono"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-clinic-muted">lpm</span>
              </div>
            </div>

            <div>
              <label className="field-label mb-1 block">Frec. Resp.</label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  min="5"
                  max="60"
                  required
                  value={respRate}
                  onChange={(e) => setRespRate(parseInt(e.target.value, 10) || 0)}
                  className="clinical-input pr-9 font-mono"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-clinic-muted">rpm</span>
              </div>
            </div>

            <div>
              <label className="field-label mb-1 block">Temperatura</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="32"
                  max="44"
                  required
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value) || 0)}
                  className="clinical-input pr-8 font-mono"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-clinic-muted">°C</span>
              </div>
            </div>

            <div>
              <label className="field-label mb-1 block">SpO2 Oximetría</label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  min="50"
                  max="100"
                  required
                  value={spo2}
                  onChange={(e) => setSpo2(parseInt(e.target.value, 10) || 0)}
                  className="clinical-input pr-7 font-mono"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-clinic-muted">%</span>
              </div>
            </div>
          </div>

          <div>
            <label className="field-label mb-1 block">Glucosa Capilar (Opcional)</label>
            <div className="relative max-w-xs">
              <input
                type="number"
                step="1"
                min="20"
                max="800"
                value={glucose ?? ''}
                onChange={(e) => setGlucose(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                placeholder="Ej. 95 (en ayuno)"
                className="clinical-input pr-14 font-mono"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-clinic-muted">mg/dL</span>
            </div>
          </div>

          {/* Acciones del pie */}
          <div className="pt-3 border-t border-clinic-line flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="secondary-action"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="primary-action"
            >
              <Check className="w-4 h-4" />
              {saving ? 'Guardando...' : 'Registrar Signos en Expediente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
