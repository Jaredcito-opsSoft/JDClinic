import React from 'react';
import { User, AlertTriangle, ShieldCheck, HeartPulse, Droplets, Calendar, FileText } from 'lucide-react';

export interface PatientHeaderProps {
  expedienteFolio: string;
  fullName: string;
  birthDate: string;
  age: number;
  sex: 'MASCULINO' | 'FEMENINO' | 'INDETERMINADO';
  bloodType: string;
  curp: string;
  allergies: string[];
  latestBp?: string;
  latestBmi?: number;
}

export const PatientHeaderBanner: React.FC<PatientHeaderProps> = ({
  expedienteFolio,
  fullName,
  birthDate,
  age,
  sex,
  bloodType,
  curp,
  allergies,
  latestBp,
  latestBmi,
}) => {
  const hasAllergies = allergies.length > 0;
  const formattedBlood = bloodType.replace('_POSITIVO', '+').replace('_NEGATIVO', '-').replace('_', ' ');

  return (
    <div className="patient-ribbon-wrap">
      <section className="patient-ribbon" aria-label={`Expediente activo de ${fullName}`}>
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="patient-ribbon__avatar"><User className="w-5 h-5" /></div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-clinic-ink tracking-tight truncate">{fullName}</h2>
              <span className="glass-chip font-mono"><FileText className="w-3 h-3 text-clinic-brand" /> {expedienteFolio}</span>
              <span className="text-xs font-semibold uppercase tracking-wide text-clinic-muted">
                {sex.charAt(0) + sex.slice(1).toLowerCase()}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-clinic-muted flex-wrap">
              <span className="flex items-center gap-1 font-medium text-clinic-ink/80">
                <Calendar className="w-3 h-3" /> {age} años <span className="text-clinic-muted">({birthDate})</span>
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 font-semibold text-red-700"><Droplets className="w-3 h-3" /> {formattedBlood}</span>
              {curp && <span className="hidden xl:inline font-mono text-xs tracking-wide">· {curp}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
          {latestBp && (
            <div className="patient-ribbon__metric">
              <HeartPulse className="w-4 h-4 text-clinic-brand" />
              <span className="text-clinic-muted">PA</span>
              <strong className="font-mono text-clinic-ink">{latestBp}</strong>
              {latestBmi ? <span className="text-clinic-muted">· IMC <strong className="font-mono text-clinic-ink">{latestBmi}</strong></span> : null}
            </div>
          )}
          <div className={hasAllergies ? 'patient-ribbon__alert patient-ribbon__alert--critical' : 'patient-ribbon__alert patient-ribbon__alert--safe'}>
            {hasAllergies ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> : <ShieldCheck className="w-3.5 h-3.5 shrink-0" />}
            <span className="truncate max-w-[250px]">{hasAllergies ? `Alergias: ${allergies.join(', ')}` : 'Sin alergias conocidas'}</span>
          </div>
        </div>
      </section>
    </div>
  );
};
