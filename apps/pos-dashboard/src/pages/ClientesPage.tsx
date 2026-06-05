import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Button, Skeleton } from '@pos-final/ui';
import { Rol, type IUser } from '@pos-final/types';
import api from '../services/api.js';
import SalonSwitcher from '../components/SalonSwitcher.js';
import styles from './ClientesPage.module.css';

/* ── Types ── */

interface Cliente {
  id: number;
  nombre: string;
  telefono: string;
  email?: string;
  fechaNacimiento?: string;
  genero?: string;
  notas?: string;
  preferencias?: string;
  visitas: number;
  puntajeConfianza?: number;
  deudaTotal?: number;
  puntosFidelidad?: number;
  activo: boolean;
  creadoEn?: string;
  actualizadoEn?: string;
}

type ModalMode = 'create' | 'edit' | 'detail' | 'delete' | null;

interface ClienteForm {
  nombre: string;
  telefono: string;
  email: string;
  fechaNacimiento: string;
  genero: string;
  notas: string;
  preferencias: string;
}

/* ── Constants ── */



const EMPTY_FORM: ClienteForm = {
  nombre: '',
  telefono: '',
  email: '',
  fechaNacimiento: '',
  genero: '',
  notas: '',
  preferencias: '',
};

const GENERO_OPTIONS = [
  { value: '', label: 'Seleccionar...' },
  { value: 'Femenino', label: 'Femenino' },
  { value: 'Masculino', label: 'Masculino' },
  { value: 'Otro', label: 'Otro' },
  { value: 'Prefiere no decirlo', label: 'Prefiere no decirlo' },
];

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

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
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

/* ================================================================ */
/*  MAIN COMPONENT                                                    */
/* ================================================================ */

const ClientesPage: React.FC = () => {
  const navigate = useNavigate();

  /* ── Auth state ── */
  const [user, setUser] = useState<IUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  /* ── Data state ── */
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  /* ── Modal state ── */
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [form, setForm] = useState<ClienteForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

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

  /* ── Fetch clientes ── */
  const fetchClientes = useCallback(async () => {
    if (salonId == null) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/salones/${salonId}/clientes`);
      const mapped = (Array.isArray(data) ? data : []).map((c: Record<string, unknown>) => ({
        ...c,
        visitas: (c.totalServicios as number) ?? 0,
      }));
      setClientes(mapped as Cliente[]);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Error al cargar clientes';
      setError(msg);
      setClientes([]);
    } finally {
      setLoading(false);
    }
  }, [salonId]);

  useEffect(() => {
    if (!authLoading && salonId != null) {
      fetchClientes();
    }
  }, [authLoading, salonId, fetchClientes]);

  /* ── Search filter ── */
  const filteredClientes = useMemo(() => {
    if (!search.trim()) return clientes;
    const q = search.toLowerCase();
    return clientes.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        c.telefono.replace(/\D/g, '').includes(q.replace(/\D/g, '')),
    );
  }, [clientes, search]);

  /* ── Modal openers ── */
  const openCreate = () => {
    setForm(EMPTY_FORM);
    setSelectedCliente(null);
    setModalMode('create');
  };

  const openEdit = (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setForm({
      nombre: cliente.nombre,
      telefono: cliente.telefono,
      email: cliente.email || '',
      fechaNacimiento: cliente.fechaNacimiento || '',
      genero: cliente.genero || '',
      notas: cliente.notas || '',
      preferencias: cliente.preferencias || '',
    });
    setModalMode('edit');
  };

  const openDetail = (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setModalMode('detail');
  };

  const openDelete = (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setModalMode('delete');
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedCliente(null);
    setForm(EMPTY_FORM);
  };

  /* ── CRUD handlers ── */
  const buildPayload = (): Record<string, unknown> => {
    const payload: Record<string, unknown> = {
      nombre: form.nombre.trim(),
      telefono: form.telefono.trim(),
    };
    if (form.email.trim()) payload.email = form.email.trim();
    if (form.fechaNacimiento) payload.fechaNacimiento = form.fechaNacimiento;
    if (form.genero) payload.genero = form.genero;
    if (form.notas.trim()) payload.notas = form.notas.trim();
    if (form.preferencias.trim()) payload.preferencias = form.preferencias.trim();
    return payload;
  };

  const handleCreate = async () => {
    if (!salonId) return;
    setSubmitting(true);
    try {
      await api.post(`/salones/${salonId}/clientes`, buildPayload());
      closeModal();
      fetchClientes();
    } catch {
      // silent — could show toast
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!salonId || !selectedCliente) return;
    setSubmitting(true);
    try {
      await api.put(
        `/salones/${salonId}/clientes/${selectedCliente.id}`,
        buildPayload(),
      );
      closeModal();
      fetchClientes();
    } catch {
      // silent
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!salonId || !selectedCliente) return;
    setSubmitting(true);
    try {
      await api.delete(
        `/salones/${salonId}/clientes/${selectedCliente.id}`,
      );
      closeModal();
      fetchClientes();
    } catch {
      // silent
    } finally {
      setSubmitting(false);
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
  const isValidCreate = form.nombre.trim().length > 0 && form.telefono.trim().length > 0;
  const isValidUpdate = isValidCreate;

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
          key="clientes-content"
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
                placeholder="Buscar por nombre o teléfono..."
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
                + Nuevo cliente
              </button>
            </motion.div>
          </motion.div>

          {/* ── Content ── */}
          {loading ? (
            <RenderSkeleton />
          ) : error ? (
            <RenderError error={error} onRetry={fetchClientes} />
          ) : filteredClientes.length === 0 ? (
            <RenderEmpty
              search={search}
              onCreate={openCreate}
            />
          ) : (
            <RenderTable
              clientes={filteredClientes}
              containerVariants={containerVariants}
              itemVariants={itemVariants}
              onDetail={openDetail}
              onEdit={openEdit}
              onDelete={openDelete}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── Create Modal ── */}
      <AnimatePresence>
        {modalMode === 'create' && (
          <RenderFormModal
            title="Nuevo cliente"
            form={form}
            onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
            onCancel={closeModal}
            onSubmit={handleCreate}
            submitting={submitting}
            valid={isValidCreate}
            submitLabel="Crear cliente"
          />
        )}
      </AnimatePresence>

      {/* ── Edit Modal ── */}
      <AnimatePresence>
        {modalMode === 'edit' && selectedCliente && (
          <RenderFormModal
            title="Editar cliente"
            form={form}
            onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
            onCancel={closeModal}
            onSubmit={handleUpdate}
            submitting={submitting}
            valid={isValidUpdate}
            submitLabel="Guardar cambios"
          />
        )}
      </AnimatePresence>

      {/* ── Detail Modal ── */}
      <AnimatePresence>
        {modalMode === 'detail' && selectedCliente && (
          <RenderDetailModal
            cliente={selectedCliente}
            onClose={closeModal}
          />
        )}
      </AnimatePresence>

      {/* ── Delete Confirmation ── */}
      <AnimatePresence>
        {modalMode === 'delete' && selectedCliente && (
          <RenderDeleteModal
            cliente={selectedCliente}
            submitting={submitting}
            onCancel={closeModal}
            onConfirm={handleDelete}
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
          <th>Teléfono</th>
          <th>Email</th>
          <th>Visitas</th>
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
          <div
            className={styles.skeletonBlock}
            style={{ height: 14, flex: 2 }}
          />
          <div
            className={styles.skeletonBlock}
            style={{ height: 14, flex: 1.5 }}
          />
          <div
            className={styles.skeletonBlock}
            style={{ height: 14, flex: 2 }}
          />
          <div
            className={styles.skeletonBlock}
            style={{ height: 14, width: 40 }}
          />
          <div
            className={styles.skeletonBlock}
            style={{ height: 14, width: 85 }}
          />
          <div
            className={styles.skeletonBlock}
            style={{ height: 14, width: 85 }}
          />
          <div
            className={styles.skeletonBlock}
            style={{ height: 14, width: 85 }}
          />
          <div
            className={styles.skeletonBlock}
            style={{ height: 14, width: 80 }}
          />
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
          No se encontraron clientes para «{search}»
        </p>
      </div>
    ) : (
      <div className={styles.emptyState}>
        <span className={styles.emptyIcon}>👤</span>
        <h3 className={styles.emptyTitle}>No hay clientes registrados</h3>
        <p className={styles.emptySubtitle}>
          Agregá tu primer cliente para empezar a gestionar tus citas y
          servicios. Podrás ver su historial y preferencias.
        </p>
        <motion.button
          style={primaryBtnStyle}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onCreate}
        >
          Crear primer cliente
        </motion.button>
      </div>
    )}
  </div>
);

/* ================================================================ */
/*  SUB-COMPONENT: Client Table                                       */
/* ================================================================ */

interface RenderTableProps {
  clientes: Cliente[];
  containerVariants: typeof defaultVariants;
  itemVariants: typeof defaultVariants;
  onDetail: (c: Cliente) => void;
  onEdit: (c: Cliente) => void;
  onDelete: (c: Cliente) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const defaultVariants: any = {};

const RenderTable: React.FC<RenderTableProps> = ({
  clientes,
  containerVariants,
  itemVariants,
  onDetail,
  onEdit,
  onDelete,
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
          <th>Teléfono</th>
          <th>Email</th>
          <th>Visitas</th>
          <th>Creado</th>
          <th>Modificado</th>
          <th>Nacimiento</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        {clientes.map((cliente) => (
          <motion.tr
            key={cliente.id}
            className={styles.tableRow}
            variants={itemVariants}
          >
            <td style={{ fontWeight: 500 }}>{cliente.nombre}</td>
            <td>{formatPhone(cliente.telefono)}</td>
            <td style={{ color: 'var(--text-secondary)' }}>
              {cliente.email || '—'}
            </td>
            <td>
              <span
                className={`${styles.visitsBadge} ${
                  cliente.visitas === 0 ? styles.visitsBadgeZero : ''
                }`}
              >
                {cliente.visitas}
              </span>
            </td>
            <td style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
              {formatDate(cliente.creadoEn)}
            </td>
            <td style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
              {formatDate(cliente.actualizadoEn)}
            </td>
            <td style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
              {formatDate(cliente.fechaNacimiento)}
            </td>
            <td>
              <div style={{ display: 'flex', gap: '0.15rem' }}>
                <button
                  className={styles.actionBtn}
                  onClick={() => onDetail(cliente)}
                  title="Ver detalle"
                  aria-label="Ver detalle"
                >
                  👁️
                </button>
                <button
                  className={styles.actionBtn}
                  onClick={() => onEdit(cliente)}
                  title="Editar"
                  aria-label="Editar"
                >
                  ✏️
                </button>
                <button
                  className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                  onClick={() => onDelete(cliente)}
                  title="Eliminar"
                  aria-label="Eliminar"
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
  form: ClienteForm;
  onChange: (patch: Partial<ClienteForm>) => void;
  onCancel: () => void;
  onSubmit: () => void;
  submitting: boolean;
  valid: boolean;
  submitLabel: string;
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

        {/* Teléfono */}
        <div className={styles.formGroup}>
          <label className={`${styles.formLabel} ${styles.formRequired}`}>
            Teléfono
          </label>
          <input
            type="tel"
            className={styles.formInput}
            value={form.telefono}
            onChange={(e) => onChange({ telefono: e.target.value })}
            placeholder="Ej: 3128553060"
          />
        </div>

        {/* Email */}
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Email</label>
          <input
            type="email"
            className={styles.formInput}
            value={form.email}
            onChange={(e) => onChange({ email: e.target.value })}
            placeholder="cliente@email.com"
          />
        </div>

        {/* Fecha de nacimiento + Género row */}
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Fecha de nacimiento</label>
            <input
              type="date"
              className={styles.formInput}
              value={form.fechaNacimiento}
              onChange={(e) => onChange({ fechaNacimiento: e.target.value })}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Género</label>
            <select
              className={styles.formSelect}
              value={form.genero}
              onChange={(e) => onChange({ genero: e.target.value })}
            >
              {GENERO_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Notas */}
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Notas</label>
          <textarea
            className={styles.formTextarea}
            value={form.notas}
            onChange={(e) => onChange({ notas: e.target.value })}
            placeholder="Información adicional..."
            rows={2}
          />
        </div>

        {/* Preferencias */}
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Preferencias</label>
          <textarea
            className={styles.formTextarea}
            value={form.preferencias}
            onChange={(e) => onChange({ preferencias: e.target.value })}
            placeholder="Servicios preferidos, productos, horarios..."
            rows={2}
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

/* ================================================================ */
/*  SUB-COMPONENT: Detail Modal                                       */
/* ================================================================ */

interface DetailModalProps {
  cliente: Cliente;
  onClose: () => void;
}

const RenderDetailModal: React.FC<DetailModalProps> = ({
  cliente,
  onClose,
}) => (
  <motion.div
    className={styles.modalOverlay}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.2 }}
    onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}
  >
    <motion.div
      className={`${styles.modalContent} ${styles.modalContentWide}`}
      initial={{ opacity: 0, scale: 0.92, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      transition={{ duration: 0.25, ease: [0.22, 0.61, 0.36, 1] }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className={styles.modalHeader}>
        <span className={styles.modalTitle}>{cliente.nombre}</span>
        <button
          className={styles.modalCloseBtn}
          onClick={onClose}
          aria-label="Cerrar"
        >
          ✕
        </button>
      </div>

      <div className={styles.modalBody}>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Teléfono</span>
          <span className={styles.infoValue}>
            {formatPhone(cliente.telefono)}
          </span>
        </div>
        {cliente.email && (
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Email</span>
            <span className={styles.infoValue}>{cliente.email}</span>
          </div>
        )}
        {cliente.fechaNacimiento && (
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Fecha de nacimiento</span>
            <span className={styles.infoValue}>
              {formatDate(cliente.fechaNacimiento)}
            </span>
          </div>
        )}
        {cliente.genero && (
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Género</span>
            <span className={styles.infoValue}>{cliente.genero}</span>
          </div>
        )}
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Visitas</span>
          <span className={styles.infoValue}>{cliente.visitas}</span>
        </div>
        {cliente.puntajeConfianza !== undefined && (
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Confianza</span>
            <span className={styles.infoValue}>{cliente.puntajeConfianza}</span>
          </div>
        )}
        {cliente.deudaTotal !== undefined && (
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Deuda</span>
            <span className={styles.infoValue}>
              ${cliente.deudaTotal.toLocaleString('es-CL')}
            </span>
          </div>
        )}
        {cliente.puntosFidelidad !== undefined && (
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Puntos fidelidad</span>
            <span className={styles.infoValue}>
              {cliente.puntosFidelidad}
            </span>
          </div>
        )}
        {cliente.notas && (
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Notas</span>
            <span className={styles.infoValue}>{cliente.notas}</span>
          </div>
        )}
        {cliente.preferencias && (
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Preferencias</span>
            <span className={styles.infoValue}>{cliente.preferencias}</span>
          </div>
        )}
        {cliente.creadoEn && (
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Registrado</span>
            <span className={styles.infoValue}>
              {formatDate(cliente.creadoEn)}
            </span>
          </div>
        )}
      </div>

      <div className={styles.modalFooter}>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </motion.div>
  </motion.div>
);

/* ================================================================ */
/*  SUB-COMPONENT: Delete Confirmation Modal                           */
/* ================================================================ */

interface DeleteModalProps {
  cliente: Cliente;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const RenderDeleteModal: React.FC<DeleteModalProps> = ({
  cliente,
  submitting,
  onCancel,
  onConfirm,
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
        <span className={styles.modalTitle}>Eliminar cliente</span>
        <button
          className={styles.modalCloseBtn}
          onClick={onCancel}
          aria-label="Cerrar"
        >
          ✕
        </button>
      </div>

      <div className={styles.modalBody}>
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '0.875rem',
            color: 'var(--text-primary)',
            marginBottom: '0.5rem',
          }}
        >
          ¿Estás segura de eliminar a{' '}
          <strong>{cliente.nombre}</strong>?
        </p>
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '0.8125rem',
            color: 'var(--text-secondary)',
          }}
        >
          Esta acción no se puede deshacer.
        </p>

        {cliente.visitas > 0 && (
          <div className={styles.deleteWarning}>
            ⚠️ Este cliente tiene {cliente.visitas}{' '}
            {cliente.visitas === 1 ? 'visita registrada' : 'visitas registradas'}.{' '}
            Se eliminará su registro pero las citas asociadas se conservarán.
          </div>
        )}
      </div>

      <div className={styles.modalFooter}>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          variant="danger"
          size="sm"
          loading={submitting}
          onClick={onConfirm}
        >
          Eliminar
        </Button>
      </div>
    </motion.div>
  </motion.div>
);

export default ClientesPage;
