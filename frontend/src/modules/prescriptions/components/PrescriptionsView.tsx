import React, { useEffect, useState } from 'react';
import {
  FileCheck2,
  Plus,
  QrCode,
  Trash2,
  X,
  ExternalLink,
  Download,
  Calendar,
  AlertCircle,
  Copy,
  Check
} from 'lucide-react';
import QRCode from 'qrcode';
import { api, PatientDetail, Prescription } from '../../../lib/api';
import { clinicDateAfterDays, clinicDateKey, formatClinicCalendarDate } from '../../../lib/clinic-time';

const emptyItem = {
  medicationName: '',
  genericName: '',
  presentation: '',
  dosage: '',
  frequency: '',
  durationDays: 7,
  routeAdministration: 'Oral',
};

export const PrescriptionsView: React.FC<{ patient: PatientDetail }> = ({ patient }) => {
  const [rows, setRows] = useState<Prescription[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [qr, setQr] = useState<{ src: string; code: string; prescriptionId: string } | null>(null);
  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    consultationId: '',
    expirationDate: clinicDateAfterDays(7),
    instructions: '',
    items: [{ ...emptyItem }],
  });

  const load = () => {
    Promise.all([api.prescriptions(patient.id), api.consultations(patient.id)])
      .then(([p, n]) => {
        setRows(p);
        const signed = n.filter((x: any) => x.status === 'FIRMADA');
        setNotes(signed);
        if (signed.length > 0 && !form.consultationId) {
          setForm((prev) => ({ ...prev, consultationId: signed[0].id }));
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error al cargar recetas'));
  };

  useEffect(() => {
    load();
  }, [patient.id]);

  const updateItem = (index: number, key: string, value: string | number) => {
    setForm({
      ...form,
      items: form.items.map((x, i) => (i === index ? { ...x, [key]: value } : x)),
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const result = await api.createPrescription(form);
      const verifyUrl = `${location.origin}/verify/${result.verificationCode}`;
      const src = await QRCode.toDataURL(verifyUrl, {
        width: 280,
        margin: 2,
        color: { dark: '#0F6D68', light: '#ffffff' },
      });
      setQr({ src, code: result.verificationCode, prescriptionId: result.id });
      setOpen(false);
      setForm({
        consultationId: notes[0]?.id || '',
        expirationDate: clinicDateAfterDays(7),
        instructions: '',
        items: [{ ...emptyItem }],
      });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo emitir la receta digital.');
    } finally {
      setSaving(false);
    }
  };

  const showQr = async (p: Prescription) => {
    const src = await QRCode.toDataURL(`${location.origin}/verify/${p.verificationCode}`, {
      width: 280,
      margin: 2,
      color: { dark: '#0F6D68', light: '#ffffff' },
    });
    setQr({ src, code: p.verificationCode, prescriptionId: p.id });
  };

  const showPdf = async (id: string) => {
    setPdfLoading(true); setError('');
    try { const blob = await api.prescriptionPdf(id); setPdfUrl(URL.createObjectURL(blob)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo abrir la receta en PDF.'); }
    finally { setPdfLoading(false); }
  };

  const closePdf = () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); setPdfUrl(''); };

  const copyVerificationLink = () => {
    if (!qr) return;
    const url = `${location.origin}/verify/${qr.code}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="workspace-view max-w-5xl mx-auto p-5 lg:p-10 animate-fade-in">
      <header className="page-heading">
        <div>
          <h1 className="page-title">Recetas digitales</h1>
          <p className="page-subtitle">
            Expediente de <strong className="text-clinic-ink font-semibold">{patient.fullName}</strong> · {patient.expedienteFolio}
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          disabled={notes.length === 0}
          className="primary-action self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Emitir receta
        </button>
      </header>

      {notes.length === 0 && (
        <div className="status-info mb-5 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Para emitir una receta primero debes firmar una nota médica SOAP vinculada a este paciente.</span>
        </div>
      )}

      {error && (
        <div className="status-error mb-5 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <section className="space-y-4">
        {rows.length === 0 ? (
          <div className="clinical-surface empty-state">
            <FileCheck2 className="w-10 h-10 text-clinic-muted mb-3" />
            <h3 className="font-semibold text-base text-clinic-ink">Aún no hay recetas emitidas</h3>
            <p className="text-xs text-clinic-muted mt-1 max-w-sm">
              Las recetas emitidas se sellan digitalmente con código QR verificable por farmacias o pacientes sin exponer datos confidenciales.
            </p>
          </div>
        ) : (
          rows.map((p) => {
            const isExpired = p.expirationDate.slice(0, 10) < clinicDateKey();
            return (
              <article
                key={p.id}
                className="clinical-surface p-5 sm:p-6 transition-all hover:shadow-card border border-clinic-line"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-clinic-line">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`status-chip font-medium ${
                          isExpired
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {isExpired ? 'Vencida' : `Vigente hasta ${formatClinicCalendarDate(p.expirationDate)}`}
                      </span>
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-sky-50 text-clinic-deep border border-sky-200">
                        CIE-10 {p.diagnosisCode}
                      </span>
                    </div>
                    <p className="text-xs text-clinic-muted mt-2">
                      Médico: <strong className="text-clinic-ink">{p.doctor}</strong>
                      {p.cedula && <span className="font-mono ml-1.5">(Céd. {p.cedula})</span>}
                    </p>
                    <p className="text-[11px] font-mono text-clinic-muted mt-1" title={p.folio}>Folio RX-{p.id.slice(0, 8).toUpperCase()}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button" onClick={() => void showPdf(p.id)} disabled={pdfLoading} className="secondary-action text-xs"><FileCheck2 className="w-3.5 h-3.5 text-clinic-brand" />{pdfLoading ? 'Preparando…' : 'Ver PDF'}</button>
                    <button
                      onClick={() => showQr(p)}
                      className="secondary-action text-xs"
                      title="Verificar autenticidad digital con QR"
                    >
                      <QrCode className="w-3.5 h-3.5 text-clinic-brand" />
                      <span>Verificar QR</span>
                    </button>
                  </div>
                </div>

                {/* Lista de medicamentos de la receta */}
                <div className="mt-4 space-y-2.5">
                  <p className="text-xs font-bold uppercase tracking-wider text-clinic-muted">
                    Medicamentos prescritos ({p.items.length})
                  </p>
                  <div className="grid gap-2">
                    {p.items.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className="p-3 bg-clinic-canvas/60 rounded-xl border border-clinic-line/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div>
                          <p className="text-sm font-bold text-clinic-ink">
                            {item.medicationName}{' '}
                            <span className="text-xs font-normal text-clinic-muted">
                              ({item.presentation})
                            </span>
                          </p>
                          <p className="text-xs text-clinic-muted mt-0.5">
                            Dosis: <span className="text-clinic-ink font-medium">{item.dosage}</span> · Frecuencia: <span className="text-clinic-ink font-medium">{item.frequency}</span>
                          </p>
                        </div>
                        <div className="text-left sm:text-right text-xs shrink-0 font-mono text-clinic-muted">
                          <span>{item.durationDays} días</span> · <span>Vía {item.routeAdministration}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Indicaciones generales */}
                {p.instructions && (
                  <div className="mt-4 pt-3 border-t border-clinic-line/60 text-xs">
                    <span className="font-bold text-clinic-ink">Indicaciones generales: </span>
                    <span className="text-clinic-muted">{p.instructions}</span>
                  </div>
                )}
              </article>
            );
          })
        )}
      </section>

      {/* Modal Nueva Receta */}
      {open && (
        <div className="modal-backdrop">
          <form onSubmit={submit} className="modal-card max-w-3xl animate-fade-in">
            <div className="flex items-start justify-between pb-4 border-b border-clinic-line mb-5">
              <div>
                <h2 className="section-title">Emitir receta digital</h2>
                <p className="text-xs text-clinic-muted">
                  Vinculada a nota firmada para {patient.fullName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="icon-action"
                aria-label="Cerrar modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mb-5">
              <div>
                <label className="field-label">Nota clínica firmada *</label>
                <select
                  required
                  className="clinical-input mt-1.5"
                  value={form.consultationId}
                  onChange={(e) => setForm({ ...form, consultationId: e.target.value })}
                >
                  <option value="">Seleccionar nota de referencia…</option>
                  {notes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {new Date(n.createdAt).toLocaleDateString('es-MX')} · {n.primaryIcd10Code} · {n.analysis?.slice(0, 30)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Fecha de vigencia *</label>
                <input
                  required
                  type="date"
                  className="clinical-input mt-1.5 font-mono"
                  value={form.expirationDate}
                  onChange={(e) => setForm({ ...form, expirationDate: e.target.value })}
                />
              </div>
            </div>

            {/* Medicamentos */}
            <div className="space-y-4 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-clinic-ink">
                  Medicamentos ({form.items.length})
                </span>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, items: [...form.items, { ...emptyItem }] })}
                  className="text-link"
                >
                  <Plus className="w-3.5 h-3.5" /> Agregar medicamento
                </button>
              </div>

              {form.items.map((it, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-clinic-line p-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3 relative bg-clinic-canvas/30"
                >
                  <div>
                    <label className="field-label">Medicamento / Principio activo *</label>
                    <input
                      required
                      className="clinical-input mt-1"
                      value={it.medicationName}
                      onChange={(e) => updateItem(i, 'medicationName', e.target.value)}
                      placeholder="Ej. Paracetamol, Amoxicilina"
                    />
                  </div>
                  <div>
                    <label className="field-label">Presentación *</label>
                    <input
                      required
                      className="clinical-input mt-1"
                      value={it.presentation}
                      onChange={(e) => updateItem(i, 'presentation', e.target.value)}
                      placeholder="Tabletas 500 mg, Solución 120ml"
                    />
                  </div>
                  <div>
                    <label className="field-label">Dosis *</label>
                    <input
                      required
                      className="clinical-input mt-1"
                      value={it.dosage}
                      onChange={(e) => updateItem(i, 'dosage', e.target.value)}
                      placeholder="1 tableta, 5 ml"
                    />
                  </div>
                  <div>
                    <label className="field-label">Frecuencia *</label>
                    <input
                      required
                      className="clinical-input mt-1"
                      value={it.frequency}
                      onChange={(e) => updateItem(i, 'frequency', e.target.value)}
                      placeholder="Cada 8 horas con alimentos"
                    />
                  </div>
                  <div>
                    <label className="field-label">Duración (días) *</label>
                    <input
                      required
                      type="number"
                      min="1"
                      className="clinical-input mt-1 font-mono"
                      value={it.durationDays}
                      onChange={(e) => updateItem(i, 'durationDays', Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="field-label">Vía de administración *</label>
                    <input
                      required
                      className="clinical-input mt-1"
                      value={it.routeAdministration}
                      onChange={(e) => updateItem(i, 'routeAdministration', e.target.value)}
                      placeholder="Oral, Intramuscular, Tópica"
                    />
                  </div>

                  {form.items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, items: form.items.filter((_, x) => x !== i) })}
                      className="icon-action text-red-500 hover:text-red-700 hover:bg-red-50 absolute right-2 top-2"
                      title="Quitar medicamento"
                      aria-label="Quitar medicamento"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div>
              <label className="field-label">Indicaciones higiénico-dietéticas y de alarma *</label>
              <textarea
                required
                className="clinical-input min-h-20 mt-1.5"
                value={form.instructions}
                onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                placeholder="Abundantes líquidos, reposo relativo por 48 hrs, acudir a urgencias ante fiebre persistente o dificultad respiratoria..."
              />
            </div>

            <div className="flex justify-end gap-2.5 mt-6 pt-4 border-t border-clinic-line">
              <button
                type="button"
                className="secondary-action"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                Cancelar
              </button>
              <button disabled={saving} className="primary-action">
                {saving ? 'Emitiendo receta…' : 'Emitir con sello de integridad'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal QR de verificación */}
      {qr && (
        <div className="modal-backdrop">
          <div className="modal-card max-w-sm text-center animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-clinic-line mb-4">
              <span className="text-xs font-bold text-clinic-ink uppercase tracking-wider">
                Verificación de vigencia
              </span>
              <button onClick={() => setQr(null)} className="icon-action" aria-label="Cerrar modal">
                <X className="w-4 h-4" />
              </button>
            </div>

            <img
              src={qr.src}
              alt="Código QR de verificación"
              className="w-52 h-52 mx-auto rounded-xl border border-clinic-line p-2 bg-white shadow-xs"
            />
            <h3 className="section-title mt-4">Receta sellada con QR</h3>
            <p className="text-xs text-clinic-muted mt-1.5 leading-relaxed">
              El farmacéutico o paciente puede escanear este código para verificar la autenticidad y vigencia sin exponer datos sensibles.
            </p>

            <div className="mt-4 p-2.5 bg-clinic-canvas rounded-xl border border-clinic-line flex items-center justify-between gap-2">
              <p className="font-mono text-xs text-clinic-muted truncate text-left">
                {qr.code}
              </p>
              <button
                type="button"
                onClick={copyVerificationLink}
                className="text-xs font-semibold text-clinic-brand shrink-0 inline-flex items-center gap-1 hover:underline"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>

            <div className="mt-4 flex gap-2">
              <a
                href={`/verify/${qr.code}`}
                target="_blank"
                rel="noreferrer"
                className="secondary-action w-full justify-center text-xs"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Abrir enlace
              </a>
              <button
                type="button"
                onClick={() => { const id = qr.prescriptionId; setQr(null); void showPdf(id); }}
                className="primary-action w-full justify-center text-xs"
              >
                <FileCheck2 className="w-3.5 h-3.5" /> Ver receta PDF
              </button>
            </div>
          </div>
        </div>
      )}
      {pdfUrl && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Vista previa de receta PDF">
        <div className="pdf-preview-panel">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-clinic-line">
            <h2 className="section-title">Vista previa de receta</h2>
            <div className="flex items-center gap-2"><a href={pdfUrl} download="receta-jdclinic.pdf" className="secondary-action text-xs"><Download className="w-4 h-4" />Descargar</a><button type="button" className="icon-action" onClick={closePdf} aria-label="Cerrar vista previa"><X className="w-4 h-4" /></button></div>
          </div>
          <iframe src={pdfUrl} title="Receta médica en PDF" className="w-full flex-1 bg-white" />
        </div>
      </div>}
    </div>
  );
};
