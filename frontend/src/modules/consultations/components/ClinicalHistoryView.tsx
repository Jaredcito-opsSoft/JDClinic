import React, { useEffect, useState } from 'react';
import {
  FileClock,
  Search,
  FilePlus2,
  ChevronDown,
  ChevronUp,
  Fingerprint,
  Stethoscope,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { api, PatientDetail } from '../../../lib/api';
import { AddendaModal } from './AddendaModal';
import { ClinicalAttachmentsPanel } from '../../history/components/ClinicalAttachmentsPanel';

export const ClinicalHistoryView: React.FC<{ patient: PatientDetail }> = ({ patient }) => {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterTerm, setFilterTerm] = useState('');
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [selectedConsultationForAddenda, setSelectedConsultationForAddenda] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError('');
    api.consultations(patient.id)
      .then((data) => {
        setRecords(data);
        // Expand the most recent note by default
        if (data.length > 0) {
          setExpandedNotes((prev) => ({ ...prev, [data[0].id]: true }));
        }
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Error al cargar notas'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [patient.id]);

  const toggleExpand = (id: string) => {
    setExpandedNotes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSaveAddenda = async (text: string) => {
    if (!selectedConsultationForAddenda) return;
    await api.addAddenda(selectedConsultationForAddenda, text);
    setSelectedConsultationForAddenda(null);
    load();
  };

  const filteredRecords = records.filter((r) => {
    if (!filterTerm.trim()) return true;
    const term = filterTerm.toLowerCase();
    return (
      (r.primaryIcd10Code && r.primaryIcd10Code.toLowerCase().includes(term)) ||
      (r.analysis && r.analysis.toLowerCase().includes(term)) ||
      (r.subjective && r.subjective.toLowerCase().includes(term)) ||
      (r.plan && r.plan.toLowerCase().includes(term))
    );
  });

  return (
    <div className="workspace-view max-w-5xl mx-auto p-5 lg:p-8 animate-fade-in">
      {/* Header */}
      <header className="page-heading">
        <div>
          <h1 className="page-title">Historial de notas clínicas</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="secondary-action text-xs"
            title="Recargar historial"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </header>

      {/* Search and filters */}
      <div className="clinical-surface p-2.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-clinic-muted absolute left-3.5 top-3" />
          <input
            type="search"
            value={filterTerm}
            onChange={(e) => setFilterTerm(e.target.value)}
            placeholder="Filtrar por código CIE-10, diagnóstico o síntoma..."
            className="clinical-input border-0 pl-10 bg-transparent text-sm w-full"
          />
        </div>
        <span className="text-xs text-clinic-muted shrink-0 pr-3 tabular-nums font-medium self-end sm:self-auto">
          {filteredRecords.length} {filteredRecords.length === 1 ? 'nota' : 'notas'}
        </span>
      </div>

      {error && (
        <div className="status-error mb-5 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <ClinicalAttachmentsPanel patientId={patient.id} />

      {/* Main timeline listing */}
      <section className="space-y-4">
        {loading ? (
          <div className="clinical-surface empty-state">
            <RefreshCw className="w-7 h-7 text-clinic-brand animate-spin mb-3" />
            <p className="font-semibold text-clinic-ink">Descifrando historial clínico…</p>
            <p className="text-xs text-clinic-muted mt-1">Validando cadenas de integridad y firmas criptográficas</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="clinical-surface empty-state">
            <FileClock className="w-10 h-10 text-clinic-muted mb-3" />
            <h3 className="font-semibold text-base text-clinic-ink">
              {filterTerm ? 'No se encontraron notas con ese criterio' : 'Sin notas registradas en este expediente'}
            </h3>
            <p className="text-xs text-clinic-muted max-w-md mt-1.5">
              {filterTerm
                ? 'Intenta buscar con otro término clínico o código CIE-10.'
                : 'Las notas de evolución generadas en la consulta SOAP se consolidarán aquí en orden cronológico e inmutable.'}
            </p>
          </div>
        ) : (
          filteredRecords.map((record, index) => {
            const isExpanded = expandedNotes[record.id] ?? false;
            const isFirmada = record.status === 'FIRMADA';
            const formattedDate = new Date(record.createdAt).toLocaleDateString('es-MX', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <article
                key={record.id}
                className="clinical-surface overflow-hidden border border-clinic-line transition-shadow hover:shadow-card"
              >
                {/* Note Header / Summary Row */}
                <div
                  onClick={() => toggleExpand(record.id)}
                  className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer bg-white hover:bg-clinic-canvas/40 transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-clinic-soft text-clinic-deep flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 sm:mt-0">
                      <Stethoscope className="w-4 h-4 text-clinic-brand" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-sky-50 text-clinic-deep border border-sky-200">
                          {record.primaryIcd10Code || 'CIE-10'}
                        </span>
                        <h2 className="text-sm font-bold text-clinic-ink">
                          {record.analysis ? record.analysis.split('\n')[0].slice(0, 80) : 'Consulta médica'}
                        </h2>
                        {index === 0 && (
                          <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Más reciente
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-clinic-muted mt-1">
                        Registrada el <span className="font-medium text-clinic-ink">{formattedDate}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-clinic-line/60">
                    <span
                      className={`status-chip ${
                        isFirmada
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {isFirmada ? 'Sellada e inmutable' : record.status}
                    </span>
                    <button
                      type="button"
                      className="icon-action text-clinic-muted"
                      aria-label={isExpanded ? 'Contraer nota' : 'Expandir nota'}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded SOAP Body */}
                {isExpanded && (
                  <div className="border-t border-clinic-line/70 bg-clinic-canvas/30 p-5 sm:p-6 space-y-4 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* S - Subjetivo */}
                      <div className="glass-inset p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-5 h-5 rounded-md bg-clinic-brand text-white text-xs font-black flex items-center justify-center">
                            S
                          </span>
                          <span className="text-xs font-bold text-clinic-ink uppercase tracking-wide">
                            Interrogatorio Subjetivo
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-clinic-ink leading-relaxed whitespace-pre-wrap">
                          {record.subjective || 'Sin registro subjetivo.'}
                        </p>
                      </div>

                      {/* O - Objetivo */}
                      <div className="glass-inset p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-5 h-5 rounded-md bg-clinic-deep text-white text-xs font-black flex items-center justify-center">
                            O
                          </span>
                          <span className="text-xs font-bold text-clinic-ink uppercase tracking-wide">
                            Exploración Objetiva
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-clinic-ink leading-relaxed whitespace-pre-wrap">
                          {record.objective || 'Sin registro objetivo.'}
                        </p>
                      </div>

                      {/* A - Análisis */}
                      <div className="glass-inset p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-5 h-5 rounded-md bg-clinic-brand text-white text-xs font-black flex items-center justify-center">
                            A
                          </span>
                          <span className="text-xs font-bold text-clinic-ink uppercase tracking-wide">
                            Análisis Clínico y Diagnóstico
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-clinic-ink leading-relaxed whitespace-pre-wrap">
                          {record.analysis || 'Sin análisis clínico.'}
                        </p>
                      </div>

                      {/* P - Plan */}
                      <div className="glass-inset p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-5 h-5 rounded-md bg-clinic-deep text-white text-xs font-black flex items-center justify-center">
                            P
                          </span>
                          <span className="text-xs font-bold text-clinic-ink uppercase tracking-wide">
                            Plan Terapéutico y Conducta
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-clinic-ink leading-relaxed whitespace-pre-wrap">
                          {record.plan || 'Sin plan terapéutico.'}
                        </p>
                      </div>
                    </div>

                    {/* Digital Seal & Actions Bar */}
                    <div className="pt-3 border-t border-clinic-line/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2 text-clinic-muted font-mono text-[11px] truncate">
                        <Fingerprint className="w-3.5 h-3.5 text-clinic-brand shrink-0" />
                        <span className="truncate">Sello SHA-256 inmutable</span>
                      </div>

                      {isFirmada && !record.parentConsultationId && (
                        <button
                          type="button"
                          onClick={() => setSelectedConsultationForAddenda(record.id)}
                          className="secondary-action text-xs self-start sm:self-auto"
                        >
                          <FilePlus2 className="w-3.5 h-3.5 text-amber-600" />
                          <span>Agregar adenda aclaratoria</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          })
        )}
      </section>

      {/* Addenda Modal */}
      {selectedConsultationForAddenda && (
        <AddendaModal
          isOpen={true}
          onClose={() => setSelectedConsultationForAddenda(null)}
          consultationId={selectedConsultationForAddenda}
          onSaveAddenda={handleSaveAddenda}
        />
      )}
    </div>
  );
};
