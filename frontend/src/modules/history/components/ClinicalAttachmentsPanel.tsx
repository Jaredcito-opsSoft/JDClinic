import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowUpFromLine, ExternalLink, FileImage, FileText, FolderOpen, LockKeyhole, RefreshCw } from 'lucide-react';
import { api, StudyAttachment } from '../../../lib/api';

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png'];

export const ClinicalAttachmentsPanel: React.FC<{ patientId: string }> = ({ patientId }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<StudyAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [readyLink, setReadyLink] = useState('');
  const [configured, setConfigured] = useState(true);

  const load = async () => {
    setLoading(true);
    try { const [rows, status] = await Promise.all([api.attachments(patientId), api.storageStatus()]); setFiles(rows); setConfigured(status.configured); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudieron cargar los estudios.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [patientId]);

  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(''); setReadyLink('');
    if (!ALLOWED.includes(file.type) || file.size > MAX_BYTES || file.size === 0) {
      setError('Usa un archivo PDF, JPG o PNG de hasta 10 MB.'); return;
    }
    setUploading(true);
    try { await api.uploadAttachment(patientId, file); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo guardar el estudio.'); }
    finally { setUploading(false); }
  };

  const open = async (file: StudyAttachment) => {
    setError(''); setReadyLink('');
    const target = window.open('about:blank', '_blank');
    try {
      const result = await api.attachmentUrl(patientId, file.id);
      if (target) target.location.replace(result.url);
      else setReadyLink(result.url);
    } catch (reason) {
      target?.close();
      setError(reason instanceof Error ? reason.message : 'No se pudo abrir el estudio.');
    }
  };

  return <section className="clinical-surface overflow-hidden mb-6">
    <div className="surface-heading flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2"><FolderOpen className="w-4 h-4 text-clinic-brand" /><span>Estudios y documentos</span><span className="font-mono normal-case tracking-normal text-clinic-muted">{files.length}</span></div>
      <div className="flex items-center gap-2">
        {configured && <span className="hidden sm:inline-flex items-center gap-1 text-[11px] normal-case tracking-normal text-clinic-muted font-medium"><LockKeyhole className="w-3 h-3" /> Acceso temporal</span>}
        <button type="button" className="secondary-action text-xs" disabled={uploading || !configured} onClick={() => inputRef.current?.click()}><ArrowUpFromLine className="w-3.5 h-3.5" />{uploading ? 'Subiendo…' : 'Subir estudio'}</button>
      </div>
      <input ref={inputRef} type="file" className="sr-only" disabled={!configured} accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={upload} aria-label="Seleccionar estudio clínico" />
    </div>
    {error && <div className="status-error m-4 flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
    {readyLink && <a className="text-link mx-5 my-3" href={readyLink} target="_blank" rel="noreferrer" onClick={() => setReadyLink('')}>Abrir estudio <ExternalLink className="w-3.5 h-3.5" /></a>}
    {!loading && !configured && files.length > 0 && <div className="status-error m-4 flex items-center gap-2"><LockKeyhole className="w-4 h-4 shrink-0" />Los estudios estarán disponibles cuando se reactive el almacenamiento.</div>}
    {loading ? <div className="px-5 py-7 text-sm text-clinic-muted flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" />Cargando estudios…</div> : !configured && files.length === 0 ? <div className="px-5 py-8 flex items-center gap-3 text-sm text-clinic-muted"><LockKeyhole className="w-5 h-5 text-clinic-brand/65" /><span>Archivo de estudios pendiente de activar por administración.</span></div> : files.length === 0 ? <div className="px-5 py-8 flex items-center gap-3 text-sm text-clinic-muted"><FileText className="w-5 h-5 text-clinic-brand/65" /><span>Este expediente aún no tiene estudios. PDF, JPG o PNG · máximo 10 MB.</span></div> : <div className="divide-y divide-clinic-line/70">
      {files.map(file => <article key={file.id} className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-clinic-soft/35 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 rounded-xl bg-clinic-soft/80 flex items-center justify-center text-clinic-brand shrink-0">{file.mimeType === 'application/pdf' ? <FileText className="w-5 h-5" /> : <FileImage className="w-5 h-5" />}</span>
          <div className="min-w-0"><strong className="text-sm text-clinic-ink block truncate">{file.fileName}</strong><p className="text-[11px] text-clinic-muted mt-0.5">{(file.sizeBytes / 1024 / 1024).toFixed(1)} MB · {new Date(file.createdAt).toLocaleDateString('es-MX')} · {file.uploadedBy}</p></div>
        </div>
        <button type="button" className="glass-chip shrink-0 min-h-10" disabled={!configured} onClick={() => void open(file)}>Abrir <ExternalLink className="w-3.5 h-3.5" /></button>
      </article>)}
    </div>}
  </section>;
};
