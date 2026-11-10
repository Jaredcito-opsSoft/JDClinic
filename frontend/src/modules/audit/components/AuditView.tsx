import React, { useEffect, useState } from 'react';
import { Check, Copy, Fingerprint, RefreshCw, Search, Server, ShieldAlert, ShieldCheck } from 'lucide-react';
import { api } from '../../../lib/api';

type AuditRow = Awaited<ReturnType<typeof api.audit>>[number];

export const AuditView: React.FC = () => {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('TODAS');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError('');
    api.audit()
      .then(setRows)
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Error al cargar bitácora'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const copyHash = async (hash: string) => {
    await navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    window.setTimeout(() => setCopiedHash(null), 1800);
  };

  const actionStyle = (action: string) => {
    const value = action.toUpperCase();
    if (value.includes('SIGN') || value.includes('FIRMA')) return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    if (value.includes('LOGIN') || value.includes('LOGOUT') || value.includes('AUTH')) return 'bg-sky-50 text-sky-800 border-sky-200';
    if (value.includes('PRESCRIPTION') || value.includes('RECETA')) return 'bg-violet-50 text-violet-800 border-violet-200';
    if (value.includes('UPDATE') || value.includes('MODIF')) return 'bg-amber-50 text-amber-800 border-amber-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const filteredRows = rows.filter((row) => {
    const term = searchTerm.toLowerCase();
    const searchable = [row.user, row.email, row.action, row.resource, row.ipAddress, row.chainHash]
      .filter(Boolean).join(' ').toLowerCase();
    const matchesSearch = !term || searchable.includes(term);
    const matchesAction = filterAction === 'TODAS'
      || (filterAction === 'CONSULTAS' && /CONSULT|SIGN/.test(row.action))
      || (filterAction === 'RECETAS' && /PRESCRIPTION/.test(row.action))
      || (filterAction === 'ACCESOS' && /LOGIN|LOGOUT/.test(row.action));
    return matchesSearch && matchesAction;
  });

  return (
    <div className="workspace-view max-w-6xl mx-auto p-4 lg:p-8 view-enter">
      <header className="page-heading">
        <div>
          <h1 className="page-title">Trazabilidad y seguridad</h1>
          <p className="page-subtitle">Accesos, firmas y operaciones con cadena criptográfica verificable.</p>
        </div>
        <button onClick={load} disabled={loading} className="secondary-action">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
        </button>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <Metric icon={<Fingerprint className="w-5 h-5" />} value={String(rows.length)} label="Eventos sellados" />
        <Metric icon={<ShieldCheck className="w-5 h-5" />} value="SHA-256" label="Cadena activa" tone="success" />
        <Metric icon={<Server className="w-5 h-5" />} value="En vivo" label="Registro por IP" tone="info" />
      </div>

      {error && <div className="status-error mb-4">{error}</div>}

      <div className="filter-bar">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-clinic-muted absolute left-3 top-3.5" />
          <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar usuario, evento o IP" className="clinical-input pl-9" />
        </div>
        <div className="segmented-control" aria-label="Filtrar eventos">
          {['TODAS', 'CONSULTAS', 'RECETAS', 'ACCESOS'].map((tab) => (
            <button key={tab} onClick={() => setFilterAction(tab)} className={filterAction === tab ? 'active' : ''}>
              {tab.charAt(0) + tab.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      <section className="clinical-surface overflow-hidden">
        <div className="surface-heading">
          <div className="flex items-center gap-2"><Fingerprint className="w-4 h-4 text-clinic-brand" /><span>Registro criptográfico</span></div>
          <span className="font-mono text-clinic-muted normal-case tracking-normal">{filteredRows.length} de {rows.length}</span>
        </div>

        {loading ? (
          <div className="empty-state">Verificando cadena de auditoría…</div>
        ) : filteredRows.length === 0 ? (
          <div className="empty-state"><ShieldAlert className="w-8 h-8 mb-2" />Sin eventos para estos filtros.</div>
        ) : (
          <div className="divide-y divide-clinic-line/70">
            {filteredRows.map((row) => (
              <article key={row.id} className="data-row grid md:grid-cols-[180px_150px_1fr] gap-3">
                <div>
                  <time className="text-xs font-mono font-semibold text-clinic-ink block">
                    {new Date(row.createdAt).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'medium' })}
                  </time>
                  <span className="text-[11px] font-mono text-clinic-muted">IP {row.ipAddress}</span>
                </div>
                <div><span className={`inline-block text-xs font-semibold px-2 py-1 rounded-md border ${actionStyle(row.action)}`}>{row.action.replace(/_/g, ' ')}</span></div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <strong className="text-clinic-ink">{row.user || 'Sistema'}</strong>
                    {row.email && <span className="text-clinic-muted">{row.email}</span>}
                    <span className="text-clinic-muted">· {row.resource}{row.resourceId ? ` (${row.resourceId.slice(0, 8)})` : ''}</span>
                  </div>
                  {row.chainHash && (
                    <div className="hash-strip">
                      <Fingerprint className="w-3.5 h-3.5 text-clinic-brand shrink-0" />
                      <span className="truncate flex-1" title={row.chainHash}>{row.chainHash}</span>
                      <button type="button" onClick={() => copyHash(row.chainHash)} className="text-clinic-brand flex items-center gap-1 font-sans font-semibold">
                        {copiedHash === row.chainHash ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copiedHash === row.chainHash ? 'Copiado' : 'Copiar'}
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

const Metric: React.FC<{ icon: React.ReactNode; value: string; label: string; tone?: 'success' | 'info' }> = ({ icon, value, label, tone }) => (
  <div className="metric-glass">
    <div className={`metric-glass__icon ${tone ? `metric-glass__icon--${tone}` : ''}`}>{icon}</div>
    <div><p className="text-lg font-mono font-bold text-clinic-ink">{value}</p><p className="text-xs text-clinic-muted">{label}</p></div>
  </div>
);
