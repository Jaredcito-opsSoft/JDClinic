import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  FileSignature,
  ShieldCheck,
  Activity,
  Lock,
  AlertCircle,
  CheckCircle2,
  Info,
  AlertTriangle,
  X,
  Stethoscope
} from 'lucide-react';
import { Icd10Picker, Icd10Item } from './Icd10Picker';
import { VitalsCaptureModal, VitalsData } from '../../vitals/components/VitalsCaptureModal';

const soapFormSchema = z.object({
  subjective: z.string().min(10, 'El interrogatorio subjetivo debe tener al menos 10 caracteres'),
  objective: z.string().min(10, 'La exploración objetiva debe ser detallada (mínimo 10 caracteres)'),
  primaryIcd10Code: z.string().min(3, 'Seleccione un código CIE-10 válido del catálogo'),
  analysis: z.string().min(10, 'El análisis clínico y fundamentación es obligatorio'),
  plan: z.string().min(10, 'El plan terapéutico e indicaciones son obligatorios'),
});

export type SoapFormData = z.infer<typeof soapFormSchema>;

interface SoapConsultationEditorProps {
  patientId: string;
  patientName: string;
  patientAge: number;
  folio: string;
  allergies: string[];
  latestVitals?: {
    weightKg: number; heightCm: number; bmi: number; systolicBp: number; diastolicBp: number;
    heartRate: number; respRate: number; temperature: number; spo2: number; glucose?: number | null;
  } | null;
  onSaveVitals: (vitals: VitalsData) => Promise<void>;
  onSignConsultation: (data: SoapFormData) => Promise<void>;
  isSigned?: boolean;
}

const SoapLabel: React.FC<{
  letter: string;
  badgeBg: string;
  title: string;
  subtitle: string;
}> = ({ letter, badgeBg, title, subtitle }) => (
  <div className="flex items-start gap-2.5 mb-2">
    <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-black text-white shrink-0 shadow-xs ${badgeBg}`}>
      {letter}
    </div>
    <div>
      <p className="text-xs font-bold text-clinic-ink leading-tight">{title}</p>
      <p className="text-[11px] text-clinic-muted leading-tight">{subtitle}</p>
    </div>
  </div>
);

export const SoapConsultationEditor: React.FC<SoapConsultationEditorProps> = ({
  patientName,
  patientAge,
  folio,
  allergies,
  latestVitals,
  onSaveVitals,
  onSignConsultation,
  isSigned = false,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVitalsModalOpen, setIsVitalsModalOpen] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  const [pendingData, setPendingData] = useState<SoapFormData | null>(null);

  const [vitals, setVitals] = useState<VitalsData>({
    weightKg: latestVitals?.weightKg || 0,
    heightCm: latestVitals?.heightCm || 0,
    bmi: latestVitals?.bmi || 0,
    bmiCategory: latestVitals ? (latestVitals.bmi < 18.5 ? 'Bajo peso' : latestVitals.bmi < 25 ? 'Normal' : latestVitals.bmi < 30 ? 'Sobrepeso' : 'Obesidad') : 'Sin captura',
    systolicBp: latestVitals?.systolicBp || 0,
    diastolicBp: latestVitals?.diastolicBp || 0,
    bpCategory: latestVitals ? (latestVitals.systolicBp < 120 ? 'Normal' : latestVitals.systolicBp < 140 ? 'Elevada' : 'Alta') : 'Sin captura',
    heartRate: latestVitals?.heartRate || 0,
    respRate: latestVitals?.respRate || 0,
    temperature: latestVitals?.temperature || 0,
    spo2: latestVitals?.spo2 || 0,
    glucose: latestVitals?.glucose || 0,
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isValid },
  } = useForm<SoapFormData>({
    resolver: zodResolver(soapFormSchema),
    defaultValues: {
      subjective: '',
      objective: '',
      primaryIcd10Code: '',
      analysis: '',
      plan: '',
    },
    mode: 'onChange',
  });

  const primaryIcd10Code = watch('primaryIcd10Code');
  const subjectiveText = watch('subjective') || '';
  const objectiveText = watch('objective') || '';
  const analysisText = watch('analysis') || '';
  const planText = watch('plan') || '';
  const hasVitals = Boolean(latestVitals && (latestVitals.systolicBp > 0 || latestVitals.weightKg > 0));

  const handlePreSubmit = (data: SoapFormData) => {
    setPendingData(data);
    setShowSignModal(true);
  };

  const confirmSign = async () => {
    if (!pendingData) return;
    try {
      setIsSubmitting(true);
      await onSignConsultation(pendingData);
      setShowSignModal(false);
      setPendingData(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const bpColor =
    vitals.bpCategory === 'Normal' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
    vitals.bpCategory === 'Elevada' ? 'text-amber-700 bg-amber-50 border-amber-200' :
    vitals.bpCategory === 'Sin captura' ? 'text-slate-500 bg-slate-50 border-slate-200' :
    'text-red-700 bg-red-50 border-red-200';

  return (
    <div className="workspace-view grid grid-cols-1 lg:grid-cols-12 gap-5 p-4 lg:p-6 max-w-7xl mx-auto">
      {/* COLUMNA IZQUIERDA: Contexto de referencia clínica */}
      <aside className="lg:col-span-4 space-y-4">
        {/* Signos Vitales y Somatometría */}
        <section className="clinical-surface p-4">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-clinic-line">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-clinic-brand" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-clinic-ink">Signos Vitales</h3>
            </div>
            <button
              type="button"
              onClick={() => setIsVitalsModalOpen(true)}
              className="text-xs font-semibold text-clinic-brand hover:text-clinic-deep bg-clinic-soft px-2.5 py-1 rounded-md transition-colors"
            >
              Actualizar
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-lg bg-clinic-canvas border border-clinic-line">
              <span className="text-xs uppercase font-bold text-clinic-muted block mb-1">Presión Arterial</span>
              <p className="text-sm font-mono font-bold text-clinic-ink">
                {hasVitals ? `${vitals.systolicBp}/${vitals.diastolicBp}` : '—'}
                <span className="text-xs font-normal text-clinic-muted ml-1">mmHg</span>
              </p>
              <span className={`inline-block mt-1 text-xs font-semibold px-1.5 py-0.5 rounded border ${bpColor}`}>
                {vitals.bpCategory}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-clinic-canvas border border-clinic-line">
              <span className="text-xs uppercase font-bold text-clinic-muted block mb-1">Frec. Cardíaca</span>
              <p className="text-sm font-mono font-bold text-clinic-ink">
                {hasVitals ? vitals.heartRate : '—'}
                <span className="text-xs font-normal text-clinic-muted ml-1">lpm</span>
              </p>
              <span className="text-xs text-clinic-muted mt-1 block">Rango reposo</span>
            </div>

            <div className="p-2.5 rounded-lg bg-clinic-canvas border border-clinic-line">
              <span className="text-xs uppercase font-bold text-clinic-muted block mb-1">SpO2 / Temp.</span>
              <p className="text-sm font-mono font-bold text-clinic-ink">
                {hasVitals ? `${vitals.spo2}% · ${vitals.temperature}°C` : '—'}
              </p>
              <span className="text-xs text-clinic-muted mt-1 block">Oximetría y axilar</span>
            </div>

            <div className="p-2.5 rounded-lg bg-clinic-canvas border border-clinic-line">
              <span className="text-xs uppercase font-bold text-clinic-muted block mb-1">IMC / Somato</span>
              <p className="text-sm font-mono font-bold text-clinic-ink">
                {hasVitals ? vitals.bmi : '—'}
                <span className="text-xs font-normal text-clinic-muted ml-1">{hasVitals ? vitals.bmiCategory : ''}</span>
              </p>
              <span className="text-xs text-clinic-muted mt-1 block">
                {hasVitals ? `${vitals.weightKg} kg · ${vitals.heightCm} cm` : 'Sin captura'}
              </span>
            </div>
          </div>
        </section>

        {/* Seguridad clínica y Alergias (NOM-004) */}
        <section className="clinical-surface p-4">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-clinic-line">
            <h3 className="text-xs font-bold uppercase tracking-wider text-clinic-ink">Seguridad Clínica</h3>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              <Lock className="w-3 h-3" /> AES-256
            </span>
          </div>

          <div className={`p-3 rounded-lg border ${
            allergies.length ? 'bg-red-50 border-red-200 text-red-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}>
            <p className="text-xs font-semibold flex items-center gap-1.5">
              {allergies.length ? (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <span>Alergias: {allergies.join(', ')}</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Sin alergias activas registradas</span>
                </>
              )}
            </p>
          </div>

          <div className="mt-3 p-2.5 bg-clinic-canvas rounded-lg border border-clinic-line text-[11px] text-clinic-muted space-y-1">
            <p className="font-semibold text-clinic-ink">Normativa Mexicana NOM-004-SSA3-2012</p>
            <p>La nota médica electrónica firmada adquiere valor legal probatorio pleno y carácter inalterable.</p>
          </div>
        </section>
      </aside>

      {/* COLUMNA DERECHA: Editor SOAP */}
      <main className="lg:col-span-8">
        <form onSubmit={handleSubmit(handlePreSubmit)} className="clinical-surface p-5 md:p-6 space-y-5">
          {/* Cabecera del formulario */}
          <div className="flex items-start justify-between pb-4 border-b border-clinic-line gap-4">
            <div>
              <h2 className="text-lg font-bold text-clinic-ink">Estructura Clínica SOAP</h2>
              <p className="text-xs text-clinic-muted mt-0.5">
                Paciente: <strong className="text-clinic-ink">{patientName}</strong> · Expediente <span className="font-mono text-clinic-brand font-semibold">{folio}</span>
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold shrink-0">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Cifrado FLE Activo</span>
            </div>
          </div>

          {/* S — Subjetivo */}
          <div>
            <div className="flex items-center justify-between">
              <SoapLabel
                letter="S"
                badgeBg="bg-sky-600"
                title="Subjetivo (Interrogatorio)"
                subtitle="Motivo de consulta, síntoma principal y evolución referida por el paciente"
              />
              <span className="text-xs text-clinic-muted font-mono">{subjectiveText.length} caracteres</span>
            </div>
            <textarea
              {...register('subjective')}
              disabled={isSigned}
              rows={3}
              placeholder="Describa el motivo de consulta, sintomatología, tiempo de evolución, características del dolor..."
              className="clinical-input h-auto py-2.5 resize-none leading-relaxed"
            />
            {errors.subjective && (
              <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.subjective.message}
              </p>
            )}
          </div>

          {/* O — Objetivo */}
          <div>
            <div className="flex items-center justify-between">
              <SoapLabel
                letter="O"
                badgeBg="bg-indigo-600"
                title="Objetivo (Exploración Física)"
                subtitle="Hallazgos clínicos a la inspección, palpación, auscultación y paraclínicos"
              />
              <span className="text-xs text-clinic-muted font-mono">{objectiveText.length} caracteres</span>
            </div>
            <textarea
              {...register('objective')}
              disabled={isSigned}
              rows={3}
              placeholder="Inspección general, cabeza y cuello, tórax, cardiopulmonar, abdomen, extremidades, estado neurológico..."
              className="clinical-input h-auto py-2.5 resize-none leading-relaxed"
            />
            {errors.objective && (
              <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.objective.message}
              </p>
            )}
          </div>

          {/* A — Análisis + CIE-10 */}
          <div>
            <div className="flex items-center justify-between">
              <SoapLabel
                letter="A"
                badgeBg="bg-violet-600"
                title="Análisis y Diagnóstico Clínico"
                subtitle="Juicio clínico fundamentado y código diagnóstico CIE-10"
              />
              <span className="text-xs text-clinic-muted font-mono">{analysisText.length} caracteres</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="field-label mb-1.5 block">CIE-10 Principal (Catálogo)</label>
                <Icd10Picker
                  selectedCode={primaryIcd10Code}
                  onSelect={(item: Icd10Item) => setValue('primaryIcd10Code', item.code, { shouldValidate: true })}
                  disabled={isSigned}
                />
                {errors.primaryIcd10Code && (
                  <p className="text-[11px] text-red-600 mt-1">{errors.primaryIcd10Code.message}</p>
                )}
              </div>
              <div className="md:col-span-2">
                <label className="field-label mb-1.5 block">Fundamentación Clínica y Diagnóstico Diferencial</label>
                <textarea
                  {...register('analysis')}
                  disabled={isSigned}
                  rows={3}
                  placeholder="Razonamiento diagnóstico, estado funcional, correlación de paraclínicos y pronóstico..."
                  className="clinical-input h-auto py-2.5 resize-none leading-relaxed"
                />
                {errors.analysis && (
                  <p className="text-[11px] text-red-600 mt-1">{errors.analysis.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* P — Plan */}
          <div>
            <div className="flex items-center justify-between">
              <SoapLabel
                letter="P"
                badgeBg="bg-emerald-600"
                title="Plan Terapéutico y Conducta Médica"
                subtitle="Tratamiento farmacológico, recomendaciones, estudios solicitados y signos de alarma"
              />
              <span className="text-xs text-clinic-muted font-mono">{planText.length} caracteres</span>
            </div>
            <textarea
              {...register('plan')}
              disabled={isSigned}
              rows={3}
              placeholder="Medidas generales, plan farmacológico, estudios de laboratorio/gabinete indicados, cita de control y datos de alarma que ameriten urgencias..."
              className="clinical-input h-auto py-2.5 resize-none leading-relaxed"
            />
            {errors.plan && (
              <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.plan.message}
              </p>
            )}
          </div>

          {/* Barra de acción y firma digital */}
          <div className="pt-4 border-t border-clinic-line flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-clinic-muted">
              <Info className="w-4 h-4 text-clinic-brand shrink-0" />
              <span>La firma digital sella la nota haciéndola inmutable (NOM-004-SSA3-2012).</span>
            </div>

            <div>
              {isSigned ? (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Nota firmada digitalmente
                </span>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting || !isValid}
                  className="primary-action"
                >
                  <FileSignature className="w-4 h-4" />
                  {isSubmitting ? 'Cifrando y sellando...' : 'Revisar y Firmar Nota'}
                </button>
              )}
            </div>
          </div>

          {/* Banner de nota firmada */}
          {isSigned && (
            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Esta nota médica ha sido sellada criptográficamente con SHA-256 y es inmutable. Si requiere registrar hallazgos adicionales, hágalo mediante una adenda aclaratoria en el Historial Clínico.
              </span>
            </div>
          )}
        </form>
      </main>

      {/* Modal de confirmación de firma digital */}
      {showSignModal && pendingData && (
        <div className="modal-backdrop">
          <div className="modal-card max-w-lg animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-clinic-line">
              <div className="flex items-center gap-2 text-clinic-brand font-bold text-sm">
                <FileSignature className="w-5 h-5" />
                Firma Electrónica Avanzada de Nota Médica
              </div>
              <button
                type="button"
                onClick={() => setShowSignModal(false)}
                className="icon-action"
                aria-label="Cerrar modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 leading-relaxed">
                <div className="flex items-center gap-2 font-bold mb-1">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Advertencia Legal (NOM-004-SSA3-2012 / NOM-024-SSA3-2012)
                </div>
                Al firmar esta nota, el registro quedará <strong>inmutable y sellado</strong> en la base de datos con un hash criptográfico SHA-256. No podrá ser editado ni eliminado; cualquier rectificación requerirá una <strong>adenda aclaratoria</strong> firmada con sello de tiempo.
              </div>

              <div className="bg-clinic-canvas p-3 rounded-lg border border-clinic-line text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-clinic-muted">Paciente:</span>
                  <span className="font-semibold text-clinic-ink">{patientName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-clinic-muted">Folio Expediente:</span>
                  <span className="font-mono font-semibold text-clinic-ink">{folio}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-clinic-muted">Diagnóstico CIE-10:</span>
                  <span className="font-mono font-semibold text-clinic-brand">{pendingData.primaryIcd10Code}</span>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2.5 pt-3 border-t border-clinic-line">
              <button
                type="button"
                onClick={() => setShowSignModal(false)}
                className="secondary-action"
                disabled={isSubmitting}
              >
                Regresar a editar
              </button>
              <button
                type="button"
                onClick={confirmSign}
                disabled={isSubmitting}
                className="primary-action bg-emerald-700 hover:bg-emerald-800"
              >
                <ShieldCheck className="w-4 h-4" />
                {isSubmitting ? 'Generando sello criptográfico...' : 'Confirmar y Firmar Definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de captura de signos vitales */}
      <VitalsCaptureModal
        isOpen={isVitalsModalOpen}
        onClose={() => setIsVitalsModalOpen(false)}
        onSaveVitals={async (newVitals) => {
          await onSaveVitals(newVitals);
          setVitals(newVitals);
        }}
        initialVitals={vitals}
      />
    </div>
  );
};
