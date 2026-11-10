import React, { useEffect, useState } from 'react';
import { Award, Mail, Search, ShieldCheck, User, UserPlus, X } from 'lucide-react';
import { api, Role } from '../../../lib/api';

type StaffUser = Awaited<ReturnType<typeof api.users>>[number];

const ROLES: Role[] = ['ADMINISTRADOR', 'MEDICO_GENERAL', 'MEDICO_ESPECIALISTA', 'ENFERMERIA', 'RECEPCION'];
const ROLE_LABELS: Record<Role, { label: string; badge: string }> = {
  ADMINISTRADOR: { label: 'Administrador', badge: 'bg-purple-50 text-purple-800 border-purple-200' },
  MEDICO_GENERAL: { label: 'Médico general', badge: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  MEDICO_ESPECIALISTA: { label: 'Médico especialista', badge: 'bg-teal-50 text-teal-800 border-teal-200' },
  ENFERMERIA: { label: 'Enfermería', badge: 'bg-sky-50 text-sky-800 border-sky-200' },
  RECEPCION: { label: 'Recepción', badge: 'bg-amber-50 text-amber-800 border-amber-200' },
};

const emptyForm = {
  email: '', password: '', firstName: '', lastName: '', role: 'RECEPCION' as Role,
  cedulaProfesional: '', especialidad: '', phone: '',
};

export const UsersAdminView: React.FC<{ currentUserId: string }> = ({ currentUserId }) => {
  const [rows, setRows] = useState<StaffUser[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('TODOS');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [telegramUser, setTelegramUser] = useState<StaffUser | null>(null);
  const [telegramChat, setTelegramChat] = useState('');

  const load = () => {
    setLoading(true);
    api.users().then(setRows).catch((reason) => setError(reason instanceof Error ? reason.message : 'Error al cargar personal')).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.createUser(form);
      setOpen(false);
      setForm(emptyForm);
      load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible registrar al usuario.');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (user: StaffUser) => {
    try {
      await api.setUserStatus(user.id, !user.is_active);
      load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo actualizar la cuenta.');
    }
  };

  const saveTelegram = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!telegramUser) return;
    setSaving(true); setError('');
    try { await api.setDoctorTelegram(telegramUser.id, telegramChat.trim() || null); setTelegramUser(null); load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo guardar el chat.'); }
    finally { setSaving(false); }
  };

  const filteredUsers = rows.filter((user) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = !term || `${user.first_name} ${user.last_name} ${user.email} ${user.cedula_profesional || ''}`.toLowerCase().includes(term);
    const matchesRole = roleFilter === 'TODOS' || (roleFilter === 'MEDICOS' && user.role.startsWith('MEDICO')) || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="workspace-view max-w-6xl mx-auto p-4 lg:p-8 view-enter">
      <header className="page-heading">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-clinic-ink font-serif [text-wrap:pretty]">
            Personal y permisos
          </h1>
          <p className="mt-1.5 text-sm text-clinic-muted [text-wrap:pretty]">
            Gestión de roles institucionales, cédulas profesionales y acreditación de acceso.
          </p>
        </div>
        <button
          className={open ? 'secondary-action' : 'primary-action'}
          onClick={() => setOpen((visible) => !visible)}
          aria-expanded={open}
        >
          {open ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
          <span>{open ? 'Cancelar' : 'Registrar colaborador'}</span>
        </button>
      </header>

      {error && (
        <div role="alert" className="mb-5 p-4 rounded-xl bg-red-50 text-red-700 border border-red-200 text-sm flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {telegramUser && (
        <form onSubmit={saveTelegram} className="clinical-surface p-5 mb-6 rounded-2xl border border-clinic-line shadow-sm panel-enter flex flex-col sm:flex-row sm:items-end gap-3.5">
          <label className="flex-1">
            <span className="text-xs font-semibold text-clinic-ink mb-1.5 block">
              Notificaciones Telegram · Dr(a). {telegramUser.first_name} {telegramUser.last_name}
            </span>
            <input
              className="clinical-input"
              inputMode="numeric"
              placeholder="Chat ID del médico (obtenido del bot institucional)"
              value={telegramChat}
              onChange={(event) => setTelegramChat(event.target.value)}
            />
          </label>
          <div className="flex gap-2">
            <button type="button" className="secondary-action h-11" onClick={() => setTelegramUser(null)}>
              Cancelar
            </button>
            <button type="submit" className="primary-action h-11" disabled={saving}>
              {saving ? 'Guardando…' : 'Vincular Telegram'}
            </button>
          </div>
        </form>
      )}

      {open && (
        <form onSubmit={submit} className="clinical-surface p-6 md:p-8 mb-7 rounded-2xl border border-clinic-line shadow-sm panel-enter">
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-clinic-line">
            <div>
              <h2 className="text-xl font-semibold text-clinic-ink font-serif">Alta de nuevo colaborador</h2>
              <p className="text-xs text-clinic-muted mt-0.5">Asigna el rol normativo para definir los permisos del sistema.</p>
            </div>
            <span className="text-xs font-medium text-clinic-muted">* Campos obligatorios</span>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            <Field label="Nombre(s) *">
              <input
                required
                className="clinical-input"
                placeholder="Ej. Laura Elena"
                value={form.firstName}
                onChange={(event) => setForm({ ...form, firstName: event.target.value })}
              />
            </Field>

            <Field label="Apellidos *">
              <input
                required
                className="clinical-input"
                placeholder="Ej. Morales Vega"
                value={form.lastName}
                onChange={(event) => setForm({ ...form, lastName: event.target.value })}
              />
            </Field>

            <Field label="Correo institucional *">
              <input
                required
                type="email"
                className="clinical-input"
                placeholder="usuario@clinica.local"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </Field>

            <Field label="Contraseña temporal *">
              <input
                required
                minLength={8}
                type="password"
                className="clinical-input"
                placeholder="Mínimo 8 caracteres"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
              />
            </Field>

            <Field label="Rol normativo *">
              <select
                className="clinical-input"
                value={form.role}
                onChange={(event) => setForm({ ...form, role: event.target.value as Role })}
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>{ROLE_LABELS[role].label}</option>
                ))}
              </select>
            </Field>

            <Field label="Teléfono de contacto">
              <input
                className="clinical-input"
                placeholder="10 dígitos"
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
              />
            </Field>

            {form.role.startsWith('MEDICO') && (
              <>
                <Field label="Cédula profesional *">
                  <input
                    required
                    className="clinical-input font-mono"
                    placeholder="Número de cédula DGP"
                    value={form.cedulaProfesional}
                    onChange={(event) => setForm({ ...form, cedulaProfesional: event.target.value })}
                  />
                </Field>
                <Field label="Especialidad médica">
                  <input
                    className="clinical-input"
                    placeholder="Ej. Medicina Interna"
                    value={form.especialidad}
                    onChange={(event) => setForm({ ...form, especialidad: event.target.value })}
                  />
                </Field>
              </>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-7 pt-5 border-t border-clinic-line">
            <button type="button" className="secondary-action h-11" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="primary-action h-11">
              <ShieldCheck className="w-4 h-4" />
              <span>{saving ? 'Registrando…' : 'Crear cuenta institucional'}</span>
            </button>
          </div>
        </form>
      )}

      <div className="filter-bar flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-clinic-muted absolute left-3.5 top-3.5" />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar por nombre, correo o cédula profesional…"
            className="clinical-input pl-10"
          />
        </div>
        <div className="segmented-control" aria-label="Filtrar por área de personal">
          {[
            ['TODOS', 'Todos'],
            ['MEDICOS', 'Médicos'],
            ['ENFERMERIA', 'Enfermería'],
            ['RECEPCION', 'Recepción'],
            ['ADMINISTRADOR', 'Administración'],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setRoleFilter(id)}
              className={roleFilter === id ? 'active text-xs font-semibold' : 'text-xs'}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <section className="clinical-surface rounded-2xl overflow-hidden">
        <div className="surface-heading px-5 py-3.5 bg-clinic-canvas/60 border-b border-clinic-line flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-clinic-ink">
            <User className="w-4 h-4 text-clinic-brand" />
            <span>Directorio de personal</span>
          </div>
          <span className="font-mono text-xs text-clinic-muted">
            {filteredUsers.length} {filteredUsers.length === 1 ? 'cuenta' : 'cuentas'}
          </span>
        </div>

        {loading ? (
          <div className="empty-state p-12 text-center text-sm text-clinic-muted">
            Consultando personal activo…
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="empty-state p-12 text-center text-sm text-clinic-muted">
            No se encontraron usuarios con ese criterio.
          </div>
        ) : (
          <div className="divide-y divide-clinic-line">
            {filteredUsers.map((user) => {
              const isSelf = user.id === currentUserId;
              const role = ROLE_LABELS[user.role];
              return (
                <article
                  key={user.id}
                  className="p-4 sm:px-6 hover:bg-clinic-canvas/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="glass-avatar">
                      {user.first_name[0]}{user.last_name[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <strong className="text-sm font-semibold text-clinic-ink truncate">
                          {user.first_name} {user.last_name}
                        </strong>
                        {isSelf && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-clinic-soft text-clinic-brand font-medium border border-clinic-line">
                            Tu sesión
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-clinic-muted flex-wrap">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5 text-clinic-muted" />
                          <span>{user.email}</span>
                        </span>
                        {user.cedula_profesional && (
                          <span className="flex items-center gap-1 font-mono text-clinic-ink/90">
                            <Award className="w-3.5 h-3.5 text-clinic-brand" />
                            <span>Céd. {user.cedula_profesional}</span>
                          </span>
                        )}
                        {user.especialidad && <span>· {user.especialidad}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-clinic-line/60">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${role.badge}`}>
                        {role.label}
                      </span>
                      <span className={user.is_active ? 'badge-ok text-xs' : 'badge-alert text-xs'}>
                        {user.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {user.role.startsWith('MEDICO') && (
                        <button
                          type="button"
                          className="secondary-action text-xs px-2.5 py-1.5 h-8"
                          onClick={() => {
                            setTelegramUser(user);
                            setTelegramChat(user.telegram_chat_id || '');
                          }}
                        >
                          {user.telegram_chat_id ? 'Telegram ✓' : 'Telegram +'}
                        </button>
                      )}
                      <button
                        disabled={isSelf}
                        onClick={() => toggle(user)}
                        className={
                          user.is_active
                            ? 'text-xs font-semibold text-red-700 hover:text-red-900 px-2 py-1 disabled:opacity-30'
                            : 'text-xs font-semibold text-clinic-brand hover:text-clinic-deep px-2 py-1 disabled:opacity-30'
                        }
                      >
                        {user.is_active ? 'Desactivar' : 'Reactivar'}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <span className="text-xs font-semibold text-clinic-ink mb-1.5 block">{label}</span>
    {children}
  </label>
);
