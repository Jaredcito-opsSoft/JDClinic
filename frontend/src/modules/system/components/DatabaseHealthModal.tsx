import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  Server,
  Terminal,
  Copy,
  Check,
  UserPlus,
  Users,
  Trash2,
  Layers,
  ArrowRight
} from 'lucide-react';

interface UserRecord {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  cedula_profesional: string | null;
  phone: string | null;
  created_at: string;
}

interface HealthData {
  status: string;
  system: string;
  database?: {
    status: string;
    latencyMs: string;
    currentDatabase: string;
    serverTime: string;
    error?: string;
  };
  timestamp: string;
}

interface DatabaseHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DatabaseHealthModal: React.FC<DatabaseHealthModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'crud' | 'status'>('crud');
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);

  // Estados de datos de usuarios
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [insertSuccessMsg, setInsertSuccessMsg] = useState<string | null>(null);

  // Formulario para nuevo usuario
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('MEDICO_GENERAL');
  const [cedula, setCedula] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Portapapeles
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Consultar estado de salud (Health)
  const fetchHealth = async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const res = await fetch('/api/v1/health');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setHealthData(data);
    } catch (err: any) {
      setHealthError(err.message || 'Error al conectar con la base de datos');
    } finally {
      setHealthLoading(false);
    }
  };

  // Consultar usuarios en la base de datos (SELECT)
  const fetchUsers = async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const res = await fetch('/api/v1/users');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setUsers(data.data);
      }
    } catch (err: any) {
      setUsersError(err.message || 'Error al consultar usuarios en PostgreSQL');
    } finally {
      setUsersLoading(false);
    }
  };

  // Insertar un nuevo usuario en la base de datos (INSERT)
  const handleInsertUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      alert('Por favor completa nombre, apellido y correo electrónico.');
      return;
    }

    setIsSubmitting(true);
    setInsertSuccessMsg(null);
    try {
      const res = await fetch('/api/v1/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          role,
          cedula_profesional: cedula.trim() || null,
          phone: phone.trim() || null,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Fallo al insertar usuario');
      }

      setInsertSuccessMsg(`¡Insertado con éxito en PostgreSQL! ID generado: ${json.data.id.substring(0, 8)}...`);
      // Limpiar formulario con valores sugeridos nuevos
      const randomNum = Math.floor(100 + Math.random() * 900);
      setFirstName('Doctor');
      setLastName(`Prueba ${randomNum}`);
      setEmail(`medico${randomNum}@clinica.mx`);
      setCedula(`CED-${randomNum}45`);

      // Refrescar lista de usuarios (SELECT)
      await fetchUsers();
      await fetchHealth();
    } catch (err: any) {
      alert(`Error al insertar: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Eliminar usuario
  const handleDeleteUser = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar al usuario "${name}" de la base de datos?`)) return;
    try {
      const res = await fetch(`/api/v1/users/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        await fetchUsers();
      } else {
        alert(json.error || 'Error al eliminar');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Cargar datos al abrir modal
  useEffect(() => {
    if (isOpen) {
      // Valores por defecto para prueba rápida y fácil
      const randomNum = Math.floor(100 + Math.random() * 900);
      setFirstName('Dra. Laura');
      setLastName(`Sánchez ${randomNum}`);
      setEmail(`laura${randomNum}@clinica.mx`);
      setCedula(`CED-MX-${randomNum}`);
      setPhone(`9611234${randomNum.toString().substring(0, 3)}`);

      fetchUsers();
      fetchHealth();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const isConnected = healthData?.database?.status === 'connected';

  return (
    <div className="modal-backdrop animate-fade-in">
      <div className="modal-card w-full max-w-3xl p-0 overflow-hidden flex flex-col animate-scale-up">
        
        {/* ── Encabezado ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-clinic-line bg-white/35 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'}`}>
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-800">Prueba de Base de Datos PostgreSQL</h3>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Operativa (Prisma)
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Demostración: Inserción de datos (INSERT) y consulta en vivo (SELECT)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Selector de Pestañas ── */}
        <div className="flex border-b border-slate-200 bg-slate-100/50 px-6 shrink-0 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('crud')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 transition-colors ${
              activeTab === 'crud'
                ? 'border-sky-600 text-sky-600 bg-white font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            1. Meter y Consultar Usuarios en BD
            <span className="px-1.5 py-0.2 rounded-full text-xs bg-sky-100 text-sky-800 font-bold">
              {users.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('status')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 transition-colors ${
              activeTab === 'status'
                ? 'border-sky-600 text-sky-600 bg-white font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Server className="w-4 h-4" />
            2. Estado de Conexión SQL & Comandos
          </button>
        </div>

        {/* ── Contenido Principal ── */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">

          {/* ═════════════════════════════════════════════════════════
              PESTAÑA 1: METER Y CONSULTAR USUARIOS (INSERT & SELECT)
             ═════════════════════════════════════════════════════════ */}
          {activeTab === 'crud' && (
            <div className="space-y-6">

              {/* Formulario de Inserción */}
              <div className="p-4 bg-sky-50/60 border border-sky-100 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-sky-900 flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-sky-600" />
                    Insertar Nuevo Usuario en PostgreSQL (INSERT INTO users)
                  </h4>
                  <span className="text-[11px] text-sky-700 bg-sky-100/80 px-2 py-0.5 rounded-md font-medium">
                    Campos automáticos listos
                  </span>
                </div>

                <form onSubmit={handleInsertUser} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                    <div>
                      <label className="block text-slate-600 font-medium mb-1">Nombre:</label>
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Ej. Carlos"
                        required
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-medium mb-1">Apellido:</label>
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Ej. Morales"
                        required
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-medium mb-1">Correo Electrónico:</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="ejemplo@clinica.mx"
                        required
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-medium mb-1">Rol en Sistema:</label>
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white text-slate-800"
                      >
                        <option value="MEDICO_GENERAL">MEDICO_GENERAL</option>
                        <option value="MEDICO_ESPECIALISTA">MEDICO_ESPECIALISTA</option>
                        <option value="ENFERMERIA">ENFERMERIA</option>
                        <option value="RECEPCION">RECEPCION</option>
                        <option value="ADMINISTRADOR">ADMINISTRADOR</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-600 font-medium mb-1">Cédula Profesional:</label>
                      <input
                        type="text"
                        value={cedula}
                        onChange={(e) => setCedula(e.target.value)}
                        placeholder="Ej. CED-123456"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white text-slate-800"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg shadow-sm hover:shadow transition-all disabled:opacity-50 text-xs"
                      >
                        {isSubmitting ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <UserPlus className="w-4 h-4" />
                        )}
                        {isSubmitting ? 'Guardando en BD...' : 'Guardar en Base de Datos'}
                      </button>
                    </div>
                  </div>
                </form>

                {insertSuccessMsg && (
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-medium">{insertSuccessMsg}</span>
                  </div>
                )}
              </div>

              {/* Tabla de Registros en la Base de Datos */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-slate-700" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Usuarios Almacenados en PostgreSQL ({users.length} registros)
                    </h4>
                  </div>
                  <button
                    onClick={fetchUsers}
                    disabled={usersLoading}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${usersLoading ? 'animate-spin' : ''}`} />
                    {usersLoading ? 'Consultando...' : 'Actualizar Consulta (SELECT)'}
                  </button>
                </div>

                {usersError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{usersError}</span>
                  </div>
                )}

                {users.length === 0 ? (
                  <div className="text-center p-8 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 text-slate-500">
                    <Database className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                    <p className="text-xs font-medium">No hay usuarios registrados aún en la tabla.</p>
                    <p className="text-[11px] text-slate-400">
                      Usa el formulario de arriba o ejecuta un comando para meter el primer usuario.
                    </p>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                          <tr>
                            <th className="py-2.5 px-3">Nombre</th>
                            <th className="py-2.5 px-3">Email</th>
                            <th className="py-2.5 px-3">Rol</th>
                            <th className="py-2.5 px-3">Cédula</th>
                            <th className="py-2.5 px-3">ID en PostgreSQL (UUID)</th>
                            <th className="py-2.5 px-3 text-right">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {users.map((u) => (
                            <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-2.5 px-3 font-semibold text-slate-800">
                                {u.first_name} {u.last_name}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-600">
                                {u.email}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                                  {u.role}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                                {u.cedula_profesional || '—'}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-xs text-slate-400 max-w-[130px] truncate" title={u.id}>
                                {u.id}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  onClick={() => handleDeleteUser(u.id, `${u.first_name} ${u.last_name}`)}
                                  className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                  title="Eliminar de PostgreSQL"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════
              PESTAÑA 2: ESTADO Y COMANDOS FÁCILES
             ═════════════════════════════════════════════════════════ */}
          {activeTab === 'status' && (
            <div className="space-y-5">
              {/* Banner de Estado */}
              {isConnected ? (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-emerald-900">Base de Datos Conectada</h4>
                      <p className="text-xs text-emerald-700">
                        PostgreSQL responde en <span className="font-mono font-bold">{healthData?.database?.latencyMs}</span> mediante Prisma
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300">
                    {healthData?.database?.currentDatabase}
                  </span>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  <div className="text-xs">
                    <p className="font-bold">Verificando conexión...</p>
                    <p>{healthError || 'Espere unos segundos'}</p>
                  </div>
                </div>
              )}

              {/* Tarjetas informativas de PostgreSQL */}
              {healthData?.database && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-slate-400 block text-[11px] mb-0.5">Motor</span>
                    <span className="font-bold text-slate-800">PostgreSQL 5432</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-slate-400 block text-[11px] mb-0.5">Base de datos</span>
                    <span className="font-mono font-bold text-slate-800 truncate block">
                      {healthData.database.currentDatabase}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-slate-400 block text-[11px] mb-0.5">Latencia SQL</span>
                    <span className="font-mono font-bold text-emerald-600">
                      {healthData.database.latencyMs}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-slate-400 block text-[11px] mb-0.5">Total Usuarios</span>
                    <span className="font-bold text-sky-700 font-mono">
                      {users.length} usuarios
                    </span>
                  </div>
                </div>
              )}

              {/* Comandos rápidos para copiar */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <Terminal className="w-4 h-4 text-sky-600" />
                  <span>Comandos fáciles para demostrar en tu terminal o navegador:</span>
                </div>

                {/* Comando 1: Navegador Consola (Consulta) */}
                <div className="bg-slate-900 text-slate-200 rounded-xl p-3 text-xs font-mono relative">
                  <div className="text-[11px] text-slate-400 mb-1 flex items-center justify-between">
                    <span className="font-sans font-semibold text-sky-400">A) Consultar usuarios desde la consola del navegador (F12):</span>
                    <button
                      onClick={() => copyToClipboard("fetch('/api/v1/users').then(r => r.json()).then(console.log);", 'browser_get')}
                      className="text-slate-400 hover:text-white flex items-center gap-1 text-xs"
                    >
                      {copiedKey === 'browser_get' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      {copiedKey === 'browser_get' ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                  <code className="text-emerald-300 select-all block break-all">
                    fetch('/api/v1/users').then(r =&gt; r.json()).then(console.log);
                  </code>
                </div>

                {/* Comando 2: Navegador Consola (Inserción) */}
                <div className="bg-slate-900 text-slate-200 rounded-xl p-3 text-xs font-mono relative">
                  <div className="text-[11px] text-slate-400 mb-1 flex items-center justify-between">
                    <span className="font-sans font-semibold text-emerald-400">B) Meter un nuevo usuario desde la consola del navegador (F12):</span>
                    <button
                      onClick={() => copyToClipboard("fetch('/api/v1/users', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ email: 'nuevo.medico@clinica.mx', first_name: 'Dra. Gabriela', last_name: 'Vázquez', role: 'MEDICO_GENERAL' }) }).then(r => r.json()).then(console.log);", 'browser_post')}
                      className="text-slate-400 hover:text-white flex items-center gap-1 text-xs"
                    >
                      {copiedKey === 'browser_post' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      {copiedKey === 'browser_post' ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                  <code className="text-emerald-300 select-all block break-all">
                    fetch('/api/v1/users', &#123; method: 'POST', headers: &#123;'Content-Type': 'application/json'&#125;, body: JSON.stringify(&#123; email: 'nuevo.medico@clinica.mx', first_name: 'Dra. Gabriela', last_name: 'Vázquez', role: 'MEDICO_GENERAL' &#125;) &#125;).then(r =&gt; r.json()).then(console.log);
                  </code>
                </div>

                {/* Comando 3: Terminal Node Fetch (Consulta) */}
                <div className="bg-slate-900 text-slate-200 rounded-xl p-3 text-xs font-mono relative">
                  <div className="text-[11px] text-slate-400 mb-1 flex items-center justify-between">
                    <span className="font-sans font-semibold text-amber-400">C) Consultar desde PowerShell o Terminal:</span>
                    <button
                      onClick={() => copyToClipboard("node -e \"fetch('http://localhost:5175/api/v1/users').then(r => r.json()).then(console.log)\"", 'terminal_get')}
                      className="text-slate-400 hover:text-white flex items-center gap-1 text-xs"
                    >
                      {copiedKey === 'terminal_get' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      {copiedKey === 'terminal_get' ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                  <code className="text-amber-300 select-all block break-all">
                    node -e "fetch('http://localhost:5175/api/v1/users').then(r =&gt; r.json()).then(console.log)"
                  </code>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ── Pie del Modal ── */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>PostgreSQL: <strong>expediente_clinico_db</strong> · Conectado en puerto 5432</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
