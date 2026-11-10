import React, { useEffect, useState } from 'react';
import { CheckCircle2, ShieldCheck, XCircle } from 'lucide-react';
import { api } from '../../../lib/api';
import { formatClinicCalendarDate } from '../../../lib/clinic-time';

export const PrescriptionVerificationScreen: React.FC<{ code: string }> = ({ code }) => {
  const [data, setData] = useState<{ valid: boolean; issuedAt: string; expirationDate: string; doctor: string; cedula?: string | null } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api.verifyPrescription(code).then(setData).catch(reason => setError(reason.message)); }, [code]);
  const valid = !!data?.valid;
  return <main className="verification-stage text-clinic-ink grid place-items-center p-5">
    <section className="w-full max-w-md clinical-surface overflow-hidden">
      <header className="p-5 border-b border-clinic-line flex items-center gap-3"><div className="brand-mark"><img src="/jdclinic-mark.svg" alt="" className="w-full h-full" /></div><div><p className="font-semibold">JDClinic</p><p className="text-[11px] text-clinic-muted">Verificación de receta</p></div></header>
      <div className="p-6 md:p-8 text-center">
        {!data && !error && <><ShieldCheck className="w-12 h-12 mx-auto text-clinic-brand"/><h1 className="section-title mt-5">Validando documento…</h1><p className="page-subtitle">Comprobando firma y vigencia.</p></>}
        {error && <><XCircle className="w-12 h-12 mx-auto text-red-600"/><h1 className="text-2xl font-semibold mt-5">Receta no reconocida</h1><p className="page-subtitle">El código no corresponde a una receta emitida por JDClinic.</p></>}
        {data && <><div className={`w-14 h-14 rounded-full mx-auto grid place-items-center ${valid?'bg-emerald-50 text-emerald-700':'bg-red-50 text-red-700'}`}>{valid?<CheckCircle2 className="w-8 h-8"/>:<XCircle className="w-8 h-8"/>}</div><h1 className="text-2xl font-semibold mt-5">Receta {valid?'vigente':'vencida'}</h1><dl className="mt-6 text-left divide-y divide-clinic-line border-y border-clinic-line"><div className="py-3 flex justify-between gap-4"><dt className="text-xs text-clinic-muted">Profesional</dt><dd className="text-sm font-semibold text-right">{data.doctor}</dd></div><div className="py-3 flex justify-between gap-4"><dt className="text-xs text-clinic-muted">Cédula</dt><dd className="text-sm font-mono">{data.cedula||'No disponible'}</dd></div><div className="py-3 flex justify-between gap-4"><dt className="text-xs text-clinic-muted">Vigencia</dt><dd className="text-sm font-mono">{formatClinicCalendarDate(data.expirationDate)}</dd></div></dl><p className="text-[11px] text-clinic-muted mt-5">Esta consulta confirma autoría y vigencia. No muestra información clínica del paciente.</p></>}
        <p className="font-mono text-xs text-clinic-muted mt-6 break-all">{code}</p>
      </div>
    </section>
  </main>;
};
