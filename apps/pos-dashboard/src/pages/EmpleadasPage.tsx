import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Button, Skeleton } from '@pos-final/ui';
import { Rol, type IUser } from '@pos-final/types';
import api from '../services/api.js';
import SalonSwitcher from '../components/SalonSwitcher.js';
import styles from './EmpleadasPage.module.css';

/* ── Types ── */

interface Empleada {
  id: number;
  nombre: string;
  email: string;
  numeroWhatsApp: string;
  rol: Rol;
  porcentajeComisionServicio: number;
  sueldoFijo: number;
  bonoHorario: number;
  avatar?: string;
  fechaNacimiento?: string;
  activo: boolean;
  creadoEn?: string;
  actualizadoEn?: string;
}

type ModalMode = 'create' | 'edit' | null;

interface EmpleadaForm {
  nombre: string;
  email: string;
  numeroWhatsApp: string;
  password: string;
  rol: string;
  tipoPago: 'COMISION' | 'FIJO';
  porcentajeComisionServicio: string;
  sueldoFijo: string;
  bonoHorario: string;
  fechaNacimiento: string;
}

/* ── Constants ── */



const ROL_OPTIONS = [
  { value: '', label: 'Seleccionar rol...' },
  { value: String(Rol.DUEÑA), label: 'Dueña' },
  { value: String(Rol.ADMINISTRADOR), label: 'Administrador' },
  { value: String(Rol.MANICURISTA), label: 'Manicurista' },
  { value: String(Rol.RECEPCIONISTA), label: 'Recepcionista' },
  { value: String(Rol.CONTADOR), label: 'Contador' },
];

const ROL_LABELS: Record<number, string> = {
  [Rol.DUEÑA]: 'Dueña',
  [Rol.ADMINISTRADOR]: 'Administrador',
  [Rol.MANICURISTA]: 'Manicurista',
  [Rol.RECEPCIONISTA]: 'Recepcionista',
  [Rol.CONTADOR]: 'Contador',
};

const ROL_STYLES: Record<number, string> = {
  [Rol.DUEÑA]: styles.rolGold,
  [Rol.ADMINISTRADOR]: styles.rolBlue,
  [Rol.MANICURISTA]: styles.rolGreen,
  [Rol.RECEPCIONISTA]: styles.rolPurple,
  [Rol.CONTADOR]: styles.rolOrange,
};

const EMPTY_FORM: EmpleadaForm = {
  nombre: '',
  email: '',
  numeroWhatsApp: '',
  password: '',
  rol: '',
  tipoPago: 'COMISION',
  porcentajeComisionServicio: '50',
  sueldoFijo: '0',
  bonoHorario: '0',
  fechaNacimiento: '',
};

/* ── Helpers ── */

function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }
  if (cleaned.length === 7) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
  }
  return phone;
}

/* ── Inline styles ── */

const primaryBtnStyle: React.CSSProperties = {
  background: 'var(--accent)',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--bg-root)',
  padding: '0.5rem 1.25rem',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.8125rem',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'background 0.2s, box-shadow 0.2s',
  boxShadow: '0 2px 12px rgba(212,168,83,0.25)',
  whiteSpace: 'nowrap' as const,
};

const toggleGroupStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
};

const toggleBtnStyle = (active: boolean): React.CSSProperties => ({
  flex: 1,
  padding: '0.5rem 1rem',
  borderRadius: 'var(--radius-sm)',
  border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
  background: active ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
  color: active ? 'var(--accent)' : 'var(--text-secondary)',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.8125rem',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 200ms var(--ease-out)',
});



/* ================================================================ */
/*  MAIN COMPONENT                                                    */
/* ================================================================ */

const EmpleadasPage: React.FC = () => {
  const navigate = useNavigate();

  /* ── Auth state ── */
  const [user, setUser] = useState<IUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  /* ── Data state ── */
  const [empleadas, setEmpleadas] = useState<Empleada[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  /* ── Modal state ── */
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedEmpleada, setSelectedEmpleada] = useState<Empleada | null>(null);
  const [form, setForm] = useState<EmpleadaForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  /* ── Toggle loading state ── */
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const salonId = useMemo(() => {
    if (!user) return null;
    const stored = localStorage.getItem('xSalonId');
    return stored ? Number(stored) : user.salonId;
  }, [user]);

  /* ── Auth effect ── */
  useEffect(() => {
    api
      .get('/auth/me')
      .then(({ data }) => setUser(data))
      .catch(() => navigate('/login'))
      .finally(() => setAuthLoading(false));
  }, [navigate]);

  /* ── Fetch empleadas ── */
  const fetchEmpleadas = useCallback(async () => {
    if (salonId == null) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/salones/${salonId}/empleadas`);
      setEmpleadas(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Error al cargar empleadas';
      setError(msg);
      setEmpleadas([]);
    } finally {
      setLoading(false);
    }
  }, [salonId]);

  useEffect(() => {
    if (!authLoading && salonId != null) {
      fetchEmpleadas();
    }
  }, [authLoading, salonId, fetchEmpleadas]);

  /* ── Search filter ── */
  const filteredEmpleadas = useMemo(() => {
    if (!search.trim()) return empleadas;
    const q = search.toLowerCase();
    return empleadas.filter(
      (e) =>
        e.nombre.toLowerCase().includes(q) ||
        (e.email && e.email.toLowerCase().includes(q)),
    );
  }, [empleadas, search]);

  /* ── Modal openers ── */
  const openCreate = () => {
    setForm(EMPTY_FORM);
    setSelectedEmpleada(null);
    setModalMode('create');
  };

  const openEdit = (empleada: Empleada) => {
    setSelectedEmpleada(empleada);
    setForm({
      nombre: empleada.nombre,
      email: empleada.email || '',
      numeroWhatsApp: empleada.numeroWhatsApp || '',
      password: '',
      rol: String(empleada.rol),
      tipoPago: empleada.sueldoFijo > 0 ? 'FIJO' : 'COMISION',
      porcentajeComisionServicio: empleada.porcentajeComisionServicio != null ? String(empleada.porcentajeComisionServicio) : '50',
      sueldoFijo: empleada.sueldoFijo != null ? String(empleada.sueldoFijo) : '0',
      bonoHorario: empleada.bonoHorario != null ? String(empleada.bonoHorario) : '0',
      fechaNacimiento: empleada.fechaNacimiento ? new Date(empleada.fechaNacimiento).toISOString().split('T')[0] : '',
    });
    setModalMode('edit');
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedEmpleada(null);
    setForm(EMPTY_FORM);
  };

  /* ── CRUD handlers ── */
  const buildPayload = (): Record<string, unknown> => {
    return {
      nombre: form.nombre.trim(),
      numeroWhatsApp: form.numeroWhatsApp.trim(),
      email: form.email.trim(),
      password: form.password,
      rol: Number(form.rol),
      porcentajeComisionServicio: form.tipoPago === 'COMISION' ? Number(form.porcentajeComisionServicio) : 0,
      sueldoFijo: form.tipoPago === 'FIJO' ? Number(form.sueldoFijo) : 0,
      bonoHorario: Number(form.bonoHorario) || 0,
      ...(form.fechaNacimiento ? { fechaNacimiento: form.fechaNacimiento } : {}),
    };
  };

  const handleCreate = async () => {
    if (!salonId) return;
    setSubmitting(true);
    try {
      await api.post(`/salones/${salonId}/empleadas`, buildPayload());
      closeModal();
      fetchEmpleadas();
    } catch {
      // silent — could show toast
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!salonId || !selectedEmpleada) return;
    setSubmitting(true);
    try {
      await api.put(
        `/salones/${salonId}/empleadas/${selectedEmpleada.id}`,
        buildPayload(),
      );
      closeModal();
      fetchEmpleadas();
    } catch {
      // silent
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Toggle activo ── */
  const handleToggleActivo = async (empleada: Empleada) => {
    if (!salonId || togglingId !== null) return;
    setTogglingId(empleada.id);
    try {
      const endpoint = empleada.activo ? 'desactivar' : 'activar';
      await api.patch(`/salones/${salonId}/empleadas/${empleada.id}/${endpoint}`);
      setEmpleadas((prev) =>
        prev.map((e) =>
          e.id === empleada.id ? { ...e, activo: !e.activo } : e,
        ),
      );
    } catch {
      // silent
    } finally {
      setTogglingId(null);
    }
  };

  /* ── Animation variants ── */
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05, delayChildren: 0.08 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.3, ease: [0.22, 0.61, 0.36, 1] as const },
    },
  };

  /* ── Derived validations ── */
  const isCreateValid =
    form.nombre.trim().length > 0 &&
    form.numeroWhatsApp.trim().length > 0 &&
    form.email.trim().length > 0 &&
    form.password.length >= 6 &&
    form.rol !== '';
  const isEditValid =
    form.nombre.trim().length > 0 &&
    form.numeroWhatsApp.trim().length > 0 &&
    form.email.trim().length > 0 &&
    form.rol !== '';

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */

  if (authLoading) {
    return (
      <>
        <Skeleton
          height="36px"
          width="220px"
          variant="rect"
          style={{ marginBottom: '1.5rem' }}
        />
        <Skeleton height="300px" variant="rect" />
      </>
    );
  }

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div
          key="empleadas-content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          {/* SalonSwitcher for superadmin */}
          {user?.rol === Rol.SUPERADMIN && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 }}
              style={{ marginBottom: '1rem' }}
            >
              <SalonSwitcher userSalonId={user!.salonId} />
            </motion.div>
          )}

          {/* ── Toolbar ── */}
          <motion.div
            className={styles.toolbar}
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            <motion.div variants={itemVariants} className={styles.searchWrapper}>
              <span className={styles.searchIcon}>🔍</span>
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Buscar por nombre o email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </motion.div>

            <motion.div
              variants={itemVariants}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <button onClick={openCreate} style={primaryBtnStyle}>
                + Nueva empleada
              </button>
            </motion.div>
          </motion.div>

          {/* ── Content ── */}
          {loading ? (
            <RenderSkeleton />
          ) : error ? (
            <RenderError error={error} onRetry={fetchEmpleadas} />
          ) : filteredEmpleadas.length === 0 ? (
            <RenderEmpty search={search} onCreate={openCreate} />
          ) : (
            <RenderTable
              empleadas={filteredEmpleadas}
              containerVariants={containerVariants}
              itemVariants={itemVariants}
              onEdit={openEdit}
              onToggleActivo={handleToggleActivo}
              togglingId={togglingId}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── Create Modal ── */}
      <AnimatePresence>
        {modalMode === 'create' && (
          <RenderFormModal
            title="Nueva empleada"
            form={form}
            onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
            onCancel={closeModal}
            onSubmit={handleCreate}
            submitting={submitting}
            valid={isCreateValid}
            submitLabel="Crear empleada"
            isEdit={false}
          />
        )}
      </AnimatePresence>

      {/* ── Edit Modal ── */}
      <AnimatePresence>
        {modalMode === 'edit' && selectedEmpleada && (
          <RenderFormModal
            title="Editar empleada"
            form={form}
            onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
            onCancel={closeModal}
            onSubmit={handleUpdate}
            submitting={submitting}
            valid={isEditValid}
            submitLabel="Guardar cambios"
            isEdit={true}
          />
        )}
      </AnimatePresence>
    </>
  );
};

/* ================================================================ */
/*  SUB-COMPONENT: Loading Skeleton                                   */
/* ================================================================ */

const RenderSkeleton: React.FC = () => (
  <div className={styles.tableWrapper}>
    <table className={styles.table}>
      <thead className={styles.tableHead}>
        <tr>
          <th>Nombre</th>
          <th>Email</th>
          <th>Rol</th>
          <th>WhatsApp</th>
          <th>Pago</th>
          <th>Activo</th>
          <th>Creado</th>
          <th>Modificado</th>
          <th>Nacimiento</th>
          <th>Acciones</th>
        </tr>
      </thead>
    </table>
    <div style={{ padding: '0.25rem 1rem' }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            gap: '1rem',
            padding: '0.7rem 0',
            alignItems: 'center',
            borderBottom: i < 5 ? '1px solid var(--border)' : 'none',
          }}
        >
          <div className={styles.skeletonBlock} style={{ height: 14, flex: 1.5 }} />
          <div className={styles.skeletonBlock} style={{ height: 14, flex: 2 }} />
          <div className={styles.skeletonBlock} style={{ height: 14, width: 80 }} />
          <div className={styles.skeletonBlock} style={{ height: 14, flex: 1.5 }} />
          <div className={styles.skeletonBlock} style={{ height: 14, width: 50 }} />
          <div className={styles.skeletonBlock} style={{ height: 14, width: 36 }} />
          <div className={styles.skeletonBlock} style={{ height: 14, width: 85 }} />
          <div className={styles.skeletonBlock} style={{ height: 14, width: 85 }} />
          <div className={styles.skeletonBlock} style={{ height: 14, width: 85 }} />
          <div className={styles.skeletonBlock} style={{ height: 14, width: 60 }} />
        </div>
      ))}
    </div>
  </div>
);

/* ================================================================ */
/*  SUB-COMPONENT: Error State                                        */
/* ================================================================ */

interface RenderErrorProps {
  error: string;
  onRetry: () => void;
}

const RenderError: React.FC<RenderErrorProps> = ({ error, onRetry }) => (
  <div className={styles.tableWrapper}>
    <div className={styles.emptyState}>
      <span className={styles.emptyIcon}>⚠️</span>
      <p
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '0.875rem',
          color: 'var(--danger)',
          marginBottom: '1rem',
        }}
      >
        {error}
      </p>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        Reintentar
      </Button>
    </div>
  </div>
);

/* ================================================================ */
/*  SUB-COMPONENT: Empty State                                        */
/* ================================================================ */

interface RenderEmptyProps {
  search: string;
  onCreate: () => void;
}

const RenderEmpty: React.FC<RenderEmptyProps> = ({ search, onCreate }) => (
  <div className={styles.tableWrapper}>
    {search.trim() ? (
      <div className={styles.emptyState}>
        <span className={styles.emptyIcon}>🔍</span>
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
          }}
        >
          No se encontraron empleadas para «{search}»
        </p>
      </div>
    ) : (
      <div className={styles.emptyState}>
        <span className={styles.emptyIcon}>👩‍💼</span>
        <h3 className={styles.emptyTitle}>No hay empleadas registradas</h3>
        <p className={styles.emptySubtitle}>
          Agregá tu primera empleada para gestionar turnos, comisiones y roles
          dentro del salón.
        </p>
        <motion.button
          style={primaryBtnStyle}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onCreate}
        >
          Crear primera empleada
        </motion.button>
      </div>
    )}
  </div>
);

/* ================================================================ */
/*  SUB-COMPONENT: Empleada Table                                     */
/* ================================================================ */

interface RenderTableProps {
  empleadas: Empleada[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  containerVariants: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  itemVariants: any;
  onEdit: (e: Empleada) => void;
  onToggleActivo: (e: Empleada) => void;
  togglingId: number | null;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

const RenderTable: React.FC<RenderTableProps> = ({
  empleadas,
  containerVariants,
  itemVariants,
  onEdit,
  onToggleActivo,
  togglingId,
}) => (
  <motion.div
    className={styles.tableWrapper}
    variants={containerVariants}
    initial="hidden"
    animate="show"
    style={{ overflowX: 'auto' }}
  >
    <table className={styles.table}>
      <thead className={styles.tableHead}>
        <tr>
          <th>Nombre</th>
          <th>Email</th>
          <th>Rol</th>
          <th>WhatsApp</th>
          <th>Pago</th>
          <th>Activo</th>
          <th>Creado</th>
          <th>Modificado</th>
          <th>Nacimiento</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        {empleadas.map((empleada) => (
          <motion.tr
            key={empleada.id}
            className={styles.tableRow}
            variants={itemVariants}
          >
            <td style={{ fontWeight: 500 }}>
              {empleada.avatar && (
                <span style={{ marginRight: '0.35rem' }}>{empleada.avatar}</span>
              )}
              {empleada.nombre}
            </td>
            <td style={{ color: 'var(--text-secondary)' }}>
              {empleada.email || '—'}
            </td>
            <td>
              <span
                className={`${styles.rolBadge} ${ROL_STYLES[empleada.rol] || styles.rolBlue}`}
              >
                {ROL_LABELS[empleada.rol] || 'Desconocido'}
              </span>
            </td>
            <td style={{ color: 'var(--text-secondary)' }}>
              {empleada.numeroWhatsApp ? formatPhone(empleada.numeroWhatsApp) : '—'}
            </td>
            <td>
              {empleada.sueldoFijo > 0
                ? formatCurrency(empleada.sueldoFijo)
                : empleada.porcentajeComisionServicio != null
                  ? `${empleada.porcentajeComisionServicio}%`
                  : '—'}
            </td>
            <td>
              <div className={styles.toggleWrapper}>
                <button
                  className={`${styles.toggle} ${empleada.activo ? styles.toggleActive : ''}`}
                  onClick={() => onToggleActivo(empleada)}
                  disabled={togglingId === empleada.id}
                  aria-label={empleada.activo ? 'Desactivar empleada' : 'Activar empleada'}
                  title={empleada.activo ? 'Desactivar' : 'Activar'}
                >
                  <span className={styles.toggleKnob} />
                </button>
              </div>
            </td>
            <td style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
              {empleada.creadoEn ? new Date(empleada.creadoEn).toLocaleDateString('es-CL') : '—'}
            </td>
            <td style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
              {empleada.actualizadoEn ? new Date(empleada.actualizadoEn).toLocaleDateString('es-CL') : '—'}
            </td>
            <td style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
              {empleada.fechaNacimiento ? new Date(empleada.fechaNacimiento).toLocaleDateString('es-CL') : '—'}
            </td>
            <td>
              <div style={{ display: 'flex', gap: '0.15rem' }}>
                <button
                  className={styles.actionBtn}
                  onClick={() => onEdit(empleada)}
                  title="Editar"
                  aria-label="Editar"
                >
                  ✏️
                </button>
                <button
                  className={`${styles.actionBtn} ${styles.actionBtnDisabled}`}
                  disabled
                  title="Eliminar no disponible"
                  aria-label="Eliminar no disponible"
                >
                  🗑️
                </button>
              </div>
            </td>
          </motion.tr>
        ))}
      </tbody>
    </table>
  </motion.div>
);

/* ================================================================ */
/*  SUB-COMPONENT: Form Modal (Create / Edit)                         */
/* ================================================================ */

interface FormModalProps {
  title: string;
  form: EmpleadaForm;
  onChange: (patch: Partial<EmpleadaForm>) => void;
  onCancel: () => void;
  onSubmit: () => void;
  submitting: boolean;
  valid: boolean;
  submitLabel: string;
  isEdit: boolean;
}

const RenderFormModal: React.FC<FormModalProps> = ({
  title,
  form,
  onChange,
  onCancel,
  onSubmit,
  submitting,
  valid,
  submitLabel,
  isEdit,
}) => (
  <motion.div
    className={styles.modalOverlay}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.2 }}
    onClick={(e) => {
      if (e.target === e.currentTarget) onCancel();
    }}
  >
    <motion.div
      className={styles.modalContent}
      initial={{ opacity: 0, scale: 0.92, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      transition={{ duration: 0.25, ease: [0.22, 0.61, 0.36, 1] }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className={styles.modalHeader}>
        <span className={styles.modalTitle}>{title}</span>
        <button
          className={styles.modalCloseBtn}
          onClick={onCancel}
          aria-label="Cerrar"
        >
          ✕
        </button>
      </div>

      <div className={styles.modalBody}>
        {/* Nombre */}
        <div className={styles.formGroup}>
          <label className={`${styles.formLabel} ${styles.formRequired}`}>
            Nombre
          </label>
          <input
            type="text"
            className={styles.formInput}
            value={form.nombre}
            onChange={(e) => onChange({ nombre: e.target.value })}
            placeholder="Nombre completo"
          />
        </div>

        {/* Email + WhatsApp row */}
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={`${styles.formLabel} ${styles.formRequired}`}>
              Email
            </label>
            <input
              type="email"
              className={styles.formInput}
              value={form.email}
              onChange={(e) => onChange({ email: e.target.value })}
              placeholder="email@ejemplo.com"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={`${styles.formLabel} ${styles.formRequired}`}>
              WhatsApp
            </label>
            <input
              type="tel"
              className={styles.formInput}
              value={form.numeroWhatsApp}
              onChange={(e) => onChange({ numeroWhatsApp: e.target.value })}
              placeholder="Ej: 3128553060"
            />
          </div>
        </div>

        {/* Password */}
        <div className={styles.formGroup}>
          <label className={`${styles.formLabel} ${!isEdit ? styles.formRequired : ''}`}>
            Contraseña
          </label>
          <input
            type="password"
            className={styles.formInput}
            value={form.password}
            onChange={(e) => onChange({ password: e.target.value })}
            placeholder={isEdit ? 'Dejar vacío para mantener actual' : 'Contraseña (mín. 6 caracteres)'}
          />
          {isEdit && (
            <span
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '0.6875rem',
                color: 'var(--text-dim)',
                marginTop: '0.2rem',
                display: 'block',
              }}
            >
              Solo si querés cambiar la contraseña
            </span>
          )}
        </div>

        {/* Rol */}
        <div className={styles.formGroup}>
          <label className={`${styles.formLabel} ${styles.formRequired}`}>
            Rol
          </label>
          <select
            className={styles.formSelect}
            value={form.rol}
            onChange={(e) => onChange({ rol: e.target.value })}
          >
            {ROL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* ── Sección: Esquema de Pago ── */}
        <div style={{ marginTop: '1rem' }}>
          <label className={styles.formLabel}>
            Esquema de Pago
          </label>
          <div style={toggleGroupStyle}>
            <button
              style={toggleBtnStyle(form.tipoPago === 'COMISION')}
              onClick={() => onChange({ tipoPago: 'COMISION' })}
            >
              Porcentaje %
            </button>
            <button
              style={toggleBtnStyle(form.tipoPago === 'FIJO')}
              onClick={() => onChange({ tipoPago: 'FIJO' })}
            >
              Sueldo Fijo $
            </button>
          </div>
        </div>

        {form.tipoPago === 'COMISION' ? (
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              % Comisión por Servicio
            </label>
            <input
              type="number"
              className={styles.formInput}
              value={form.porcentajeComisionServicio}
              onChange={(e) => onChange({ porcentajeComisionServicio: e.target.value })}
              placeholder="Ej: 50"
              min={0}
              max={100}
            />
          </div>
        ) : (
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              Sueldo Fijo Mensual
            </label>
            <input
              type="number"
              className={styles.formInput}
              value={form.sueldoFijo}
              onChange={(e) => onChange({ sueldoFijo: e.target.value })}
              placeholder="Ej: 1200000"
              min={0}
            />
          </div>
        )}

        {/* Bono Horario */}
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>
            Incentivo / Bono
          </label>
          <input
            type="number"
            className={styles.formInput}
            value={form.bonoHorario}
            onChange={(e) => onChange({ bonoHorario: e.target.value })}
            placeholder="Ej: 50000"
            min={0}
          />
        </div>

        {/* Fecha de Nacimiento */}
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>
            Fecha Nacimiento
          </label>
          <input
            type="date"
            className={styles.formInput}
            value={form.fechaNacimiento}
            onChange={(e) => onChange({ fechaNacimiento: e.target.value })}
          />
        </div>
      </div>

      <div className={styles.modalFooter}>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={!valid}
          loading={submitting}
          onClick={onSubmit}
        >
          {submitLabel}
        </Button>
      </div>
    </motion.div>
  </motion.div>
);

export default EmpleadasPage;
