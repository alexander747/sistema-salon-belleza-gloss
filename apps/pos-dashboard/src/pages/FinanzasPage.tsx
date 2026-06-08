import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Button, Skeleton } from '@pos-final/ui';
import { Rol, type IUser } from '@pos-final/types';
import api from '../services/api.js';
import SalonSwitcher from '../components/SalonSwitcher.js';
import WalkInModal from '../components/WalkInModal.js';
import styles from './FinanzasPage.module.css';

/* ================================================================ */
/*  TYPES                                                            */
/* ================================================================ */

interface FinanzasResumen {
  totalServicios: number;
  totalProductos: number;
  totalPropinas: number;
  totalComisiones: number;
  cantidadAtenciones: number;
  cantidadProductosVendidos: number;
  totalIngresos: number;
  totalGastos?: number;
  balanceNeto?: number;
}

interface Pago {
  id: number;
  monto: number;
  metodoPago: string;
  referencia: string | null;
  creadoEn: string;
}

interface Division {
  id: number;
  usuarioId: number;
  porcentajeParticipacion: number;
  comisionCorrespondiente: number;
}

interface ProductoVendido {
  id: number;
  productoId: number;
  nombre: string;
  cantidad: number;
  precioVentaUnitario: number;
  subtotal: number;
}

interface Registro {
  id: number;
  salonId: number;
  clienteId: number;
  usuarioId: number;
  totalServicios: number;
  totalProductos: number;
  montoTotal: number;
  montoPendiente: number;
  propina: number;
  comisionCalculada: number;
  esRetoque: boolean;
  descripcionServicio: string | null;
  estaPagadaEmpleada: boolean;
  notas?: string;
  precioAjustado?: boolean;
  porcentajeDescuento?: number;
  valorOriginal?: number;
  valorFinal?: number;
  creadoEn: string;
  actualizadoEn: string;
  pagos: Pago[];
  divisiones: Division[];
  productosVendidos?: ProductoVendido[];
  /** Computed after data fetch — client name resolved from clientesMap */
  _clienteNombre?: string;
  /** Computed after data fetch — empleada name resolved from empleadasMap */
  _empleadaNombre?: string;
}

interface Gasto {
  id: number;
  descripcion: string;
  monto: number;
  categoria: string;
  fecha: string;
  metodoPago: string;
  esGastoFijo: boolean;
}

interface Devolucion {
  id: number;
  registroServicioId: number;
  productoId?: number;
  producto?: { id: number; nombre: string };
  cantidad: number;
  motivo: string;
  montoDevolucion: number;
  creadoEn: string;
  fecha: string;
}

interface NominaEmpleado {
  empleadaId: number;
  nombre: string;
  totalComisionesPendientes: number;
  totalPropinas: number;
  bonoHorario: number;
  sueldoFijo: number;
  totalAPagar: number;
  cantidadRegistros: number;
}

interface HistorialLiquidacion {
  id: number;
  usuarioId: number;
  totalComisiones: number;
  totalPropinas: number;
  sueldoFijo: number;
  bonoHorario: number;
  totalPagado: number;
  fechaDesde: string;
  fechaHasta: string;
  creadoEn: string;
}

interface ROIData {
  ingresos: number;
  gastosFijos: number;
  gastosOperativos: number;
  nomina: number;
  gananciaNeta: number;
  mes: string;
}

type TabKey = 'registros' | 'gastos' | 'devoluciones' | 'nomina' | 'reportes';

/* ================================================================ */
/*  CONSTANTS                                                        */
/* ================================================================ */



const TABS: { key: TabKey; label: string }[] = [
  { key: 'registros', label: '📋 Registros' },
  { key: 'gastos', label: '💸 Gastos' },
  { key: 'devoluciones', label: '↩️ Devoluciones' },
  { key: 'nomina', label: '👩‍💼 Nómina' },
  { key: 'reportes', label: '📊 Reportes' },
];

const GASTO_CATEGORIAS = [
  { value: 'SERVICIOS', label: 'Servicios' },
  { value: 'PRODUCTOS', label: 'Productos' },
  { value: 'NOMINA', label: 'Nómina' },
  { value: 'ARRIENDO', label: 'Arriendo' },
  { value: 'SERVICIOS_PUBLICOS', label: 'Servicios Públicos' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'OTROS', label: 'Otros' },
];

const METODO_PAGO_LABELS: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TARJETA_CREDITO: 'Tarjeta crédito',
  TARJETA_DEBITO: 'Tarjeta débito',
  TRANSFERENCIA: 'Transferencia',
  OTRO: 'Otro',
};

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function formatCurrency(n: number | null | undefined): string {
  if (n == null) return '$0';
  return currencyFormatter.format(n);
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

function formatShortDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return dateStr;
  }
}

function formatTimeAMPM(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 becomes 12
    return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  } catch {
    return dateStr;
  }
}

function formatDateTimeAMPM(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${day}/${month}/${year} ${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
}

function toISODate(d: Date): string {
  // Usar UTC para coincidir con el backend que opera en UTC
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getMonthISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function getCategoryBadge(categoria: string): string {
  const cat = categoria?.toUpperCase() ?? '';
  if (cat === 'SERVICIOS' || cat === 'PRODUCTOS') return styles.badgeServicios;
  if (cat === 'NOMINA') return styles.badgeNomina;
  if (cat === 'ARRIENDO' || cat === 'SERVICIOS_PUBLICOS' || cat === 'MARKETING') return styles.badgeProductos;
  return styles.badgeDefault;
}

/* ── Inline Styles ── */

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

const dangerBtnStyle: React.CSSProperties = {
  ...primaryBtnStyle,
  background: 'var(--danger)',
  boxShadow: '0 2px 12px rgba(224,85,106,0.25)',
};

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

/* ================================================================ */
/*  MAIN COMPONENT                                                   */
/* ================================================================ */

const FinanzasPage: React.FC = () => {
  const navigate = useNavigate();

  /* ── Auth state ── */
  const [user, setUser] = useState<IUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  /* ── Tab state ── */
  const [activeTab, setActiveTab] = useState<TabKey>('registros');

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

  if (authLoading) {
    return (
      <>
        <Skeleton height="36px" width="220px" variant="rect" style={{ marginBottom: '1.5rem' }} />
        <Skeleton height="300px" variant="rect" />
      </>
    );
  }

  return (
    <>
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

      {/* ── Tab Navigation ── */}
      <div className={styles.tabsRow}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`${styles.tabBtn} ${activeTab === tab.key ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ── Tab Content ── */}
        {activeTab === 'registros' && (
          <RegistrosTab key="registros" salonId={salonId} />
        )}
        {activeTab === 'gastos' && (
          <GastosTab key="gastos" salonId={salonId} />
        )}
        {activeTab === 'devoluciones' && (
          <DevolucionesTab key="devoluciones" salonId={salonId} />
        )}
        {activeTab === 'nomina' && (
          <NominaTab key="nomina" salonId={salonId} />
        )}
        {activeTab === 'reportes' && (
          <ReportesTab key="reportes" salonId={salonId} />
        )}
      </AnimatePresence>
    </>
  );
};

/* ================================================================ */
/*  REGISTROS TAB                                                    */
/* ================================================================ */

const RegistrosTab: React.FC<{ salonId: number | null }> = ({ salonId }) => {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [resumen, setResumen] = useState<FinanzasResumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedRegistro, setSelectedRegistro] = useState<Registro | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [anularOpen, setAnularOpen] = useState(false);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const todayStr = useMemo(() => toISODate(new Date()), []);
  const [registroDesde, setRegistroDesde] = useState('');
  const [registroHasta, setRegistroHasta] = useState('');
  const [registroFilter, setRegistroFilter] = useState<'TODOS' | 'SERVICIOS' | 'PRODUCTOS'>('TODOS');
  const [registroPage, setRegistroPage] = useState(1);
  const [registroMeta, setRegistroMeta] = useState({ page: 1, limit: 12, total: 0, totalPages: 0 });

  const filteredRegistros = useMemo(() => {
    if (registroFilter === 'TODOS') return registros;
    if (registroFilter === 'SERVICIOS') return registros.filter((r) => r.totalServicios > 0);
    return registros.filter((r) => r.totalProductos > 0);
  }, [registros, registroFilter]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const regParams: Record<string, string> = { page: String(registroPage), limit: '12' };
      if (registroDesde) regParams.desde = registroDesde;
      if (registroHasta) regParams.hasta = registroHasta;

      // Build resumen params: use date range if filtered, otherwise use today
      const resumenParams: Record<string, string> = {};
      if (registroDesde && registroHasta) {
        resumenParams.desde = registroDesde;
        resumenParams.hasta = registroHasta;
      } else {
        resumenParams.fecha = todayStr;
      }

      const promises: Promise<any>[] = [
        salonId ? api.get(`/salones/${salonId}/registros`, { params: regParams }) : Promise.reject('No salon'),
        api.get(`/salones/${salonId}/finanzas/resumen`, { params: resumenParams }),
      ];
      if (salonId) {
        promises.push(api.get(`/salones/${salonId}/clientes`));
        promises.push(api.get(`/salones/${salonId}/empleadas`));
      }
      const results = await Promise.allSettled(promises);

      // Build clientes map from API response (handle both paginated and legacy formats)
      let clientesMap = new Map<number, string>();
      if (results.length > 2 && results[2].status === 'fulfilled') {
        const raw = results[2].value.data;
        const paginatedData = raw?.data ?? raw;
        const list = Array.isArray(paginatedData) ? paginatedData : [];
        clientesMap = new Map<number, string>();
        for (const c of list) {
          if (c.id != null && c.nombre) clientesMap.set(c.id, c.nombre);
        }
      }

      // Build empleadas map from API response (handle both paginated and legacy formats)
      let empleadasMap = new Map<number, string>();
      if (results.length > 3 && results[3].status === 'fulfilled') {
        const raw = results[3].value.data;
        const paginatedData = raw?.data ?? raw;
        const list = Array.isArray(paginatedData) ? paginatedData : [];
        empleadasMap = new Map<number, string>();
        for (const e of list) {
          if (e.id != null && e.nombre) empleadasMap.set(e.id, e.nombre);
        }
      }

      // Enrich registros with resolved client and empleada names
      if (results[0].status === 'fulfilled') {
        const raw = results[0].value.data;
        const list: Registro[] = Array.isArray(raw.data) ? raw.data : [];
        const enriched = list.map((r) => ({
          ...r,
          _clienteNombre: r._clienteNombre ?? clientesMap.get(r.clienteId) ?? undefined,
          _empleadaNombre: r._empleadaNombre ?? empleadasMap.get(r.usuarioId) ?? undefined,
        }));
        setRegistros(enriched);
        setRegistroMeta(raw.meta ?? { page: 1, limit: 12, total: 0, totalPages: 0 });
      } else {
        setRegistros([]);
        setRegistroMeta({ page: 1, limit: 12, total: 0, totalPages: 0 });
      }
      if (results[1].status === 'fulfilled') {
        setResumen(results[1].value.data);
      } else {
        setResumen(null);
      }
      const allFailed = results.every((r) => r.status === 'rejected');
      if (allFailed) setError('Error al cargar datos');
    } catch {
      setError('Error al cargar registros');
    } finally {
      setLoading(false);
    }
  }, [salonId, todayStr, registroDesde, registroHasta, registroPage]);

  useEffect(() => {
    if (salonId) fetchData();
  }, [salonId, fetchData]);

  const handleAnular = async () => {
    if (!salonId || !selectedRegistro) return;
    setSubmitting(true);
    try {
      await api.delete(`/salones/${salonId}/registros/${selectedRegistro.id}`);
      setAnularOpen(false);
      setSelectedRegistro(null);
      fetchData();
    } catch {
      // silent
    } finally {
      setSubmitting(false);
    }
  };

  const openDetail = (r: Registro) => {
    setSelectedRegistro(r);
    setDetailOpen(true);
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setSelectedRegistro(null);
  };

  const openAnular = (r: Registro) => {
    setSelectedRegistro(r);
    setAnularOpen(true);
  };

  const closeAnular = () => {
    setAnularOpen(false);
    setSelectedRegistro(null);
  };

  const calcTotal = (r: Registro): number => {
    if (r.precioAjustado && r.valorFinal != null) {
      return r.valorFinal;
    }
    return r.montoTotal || (r.totalServicios + r.totalProductos);
  };

  /* ── Skeleton ── */
  if (loading) {
    return (
      <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className={styles.summaryGrid}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <Skeleton key={i} height="80px" variant="rect" />
          ))}
        </div>
        <Skeleton height="240px" variant="rect" />
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        key="error"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={styles.emptyState}
      >
        <span className={styles.emptyIcon}>⚠️</span>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', color: 'var(--danger)', marginBottom: '1rem' }}>
          {error}
        </p>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          Reintentar
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      key="registros"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      {/* ── Resumen del día ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
        <h3 className={styles.sectionTitle} style={{ margin: 0 }}>
          📋 {registroDesde && registroHasta ? 'Resumen del período' : 'Resumen del día'}
        </h3>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
          {registroDesde && registroHasta
            ? `${formatDate(registroDesde)} — ${formatDate(registroHasta)}`
            : formatDate(todayStr)}
        </span>
      </div>
      <motion.div
        className={styles.summaryGrid}
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={itemVariants} className={styles.summaryCard}>
          <span className={styles.summaryLabel}>💰 Ingresos</span>
          <span className={styles.summaryValueAccent}>
            {resumen ? formatCurrency(resumen.totalIngresos) : '$0'}
          </span>
        </motion.div>
        <motion.div variants={itemVariants} className={styles.summaryCard}>
          <span className={styles.summaryLabel}>✂️ Atenciones</span>
          <span className={styles.summaryValue}>
            {resumen?.cantidadAtenciones ?? 0}
          </span>
        </motion.div>
        <motion.div variants={itemVariants} className={styles.summaryCard} style={{ borderColor: 'rgba(251,191,36,0.3)' }}>
          <span className={styles.summaryLabel}>📦 Productos vendidos</span>
          <span className={styles.summaryValue} style={{ color: '#fbbf24' }}>
            {resumen?.cantidadProductosVendidos ?? 0}
          </span>
        </motion.div>
        <motion.div variants={itemVariants} className={styles.summaryCard} style={{ borderColor: 'rgba(99,102,241,0.3)' }}>
          <span className={styles.summaryLabel}>💇 Servicios</span>
          <span className={styles.summaryValue} style={{ color: '#818cf8' }}>
            {resumen ? formatCurrency(resumen.totalServicios) : '$0'}
          </span>
        </motion.div>
        <motion.div variants={itemVariants} className={styles.summaryCard} style={{ borderColor: 'rgba(52,211,153,0.3)' }}>
          <span className={styles.summaryLabel}>🧴 Productos</span>
          <span className={styles.summaryValue} style={{ color: '#34d399' }}>
            {resumen ? formatCurrency(resumen.totalProductos) : '$0'}
          </span>
        </motion.div>
        <motion.div variants={itemVariants} className={styles.summaryCard}>
          <span className={styles.summaryLabel}>💸 Comisiones</span>
          <span className={styles.summaryValue}>
            {resumen ? formatCurrency(resumen.totalComisiones) : '$0'}
          </span>
        </motion.div>
        <motion.div variants={itemVariants} className={styles.summaryCard}>
          <span className={styles.summaryLabel}>🎁 Propinas</span>
          <span className={styles.summaryValueSuccess}>
            {resumen ? formatCurrency(resumen.totalPropinas) : '$0'}
          </span>
        </motion.div>
        <motion.div variants={itemVariants} className={styles.summaryCard} style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
          <span className={styles.summaryLabel}>💸 Total gastos</span>
          <span className={styles.summaryValue} style={{ color: '#ef4444' }}>
            {resumen?.totalGastos != null ? formatCurrency(resumen.totalGastos) : '$0'}
          </span>
        </motion.div>
        <motion.div
          variants={itemVariants}
          className={styles.summaryCard}
          style={{ borderColor: (resumen?.balanceNeto ?? 0) >= 0 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)' }}
        >
          <span className={styles.summaryLabel}>📊 Balance neto</span>
          <span
            className={styles.summaryValue}
            style={{ color: (resumen?.balanceNeto ?? 0) >= 0 ? '#22c55e' : '#ef4444' }}
          >
            {resumen?.balanceNeto != null ? formatCurrency(resumen.balanceNeto) : '$0'}
          </span>
        </motion.div>
      </motion.div>

      {/* ── Toolbar ── */}
      <div className={styles.toolbar}>
        <span className={styles.toolbarTitle}>Historial de registros</span>
        <motion.button
          style={primaryBtnStyle}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setWalkInOpen(true)}
        >
          + Registrar servicio
        </motion.button>
      </div>

      {/* ── Date Filters + Type Chips ── */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <label style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
          Desde:
          <input
            type="date"
            className={styles.filterInput}
            style={{ marginLeft: '0.35rem' }}
            value={registroDesde}
            onChange={(e) => setRegistroDesde(e.target.value)}
          />
        </label>
        <label style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
          Hasta:
          <input
            type="date"
            className={styles.filterInput}
            style={{ marginLeft: '0.35rem' }}
            value={registroHasta}
            onChange={(e) => setRegistroHasta(e.target.value)}
          />
        </label>
        {(registroDesde || registroHasta) && (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => { setRegistroDesde(''); setRegistroHasta(''); }}
            style={{
              background: 'var(--bg-surface)',
              color: 'var(--text-dim)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.35rem 0.7rem',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '0.7rem',
              cursor: 'pointer',
            }}
            title="Limpiar filtros de fecha"
          >
            ✕ Limpiar
          </motion.button>
        )}
        <div style={{ display: 'flex', gap: '0.35rem', marginLeft: 'auto' }}>
          {(['TODOS', 'SERVICIOS', 'PRODUCTOS'] as const).map((t) => {
            const isActive = registroFilter === t;
            return (
              <motion.button
                key={t}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setRegistroFilter(t)}
                style={{
                  background: isActive ? 'var(--accent)' : 'var(--bg-surface)',
                  color: isActive ? 'var(--bg-root)' : 'var(--text-secondary)',
                  border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.35rem 0.85rem',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '0.75rem',
                  fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'background 0.2s, color 0.2s, border-color 0.2s',
                }}
              >
                {t === 'TODOS' ? 'Todos' : t === 'SERVICIOS' ? 'Servicios' : 'Productos'}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ── Registros Table ── */}
      {filteredRegistros.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>📋</span>
          <h3 className={styles.emptyTitle}>No hay registros para este período</h3>
          <p className={styles.emptySubtitle}>
            Los registros de ventas aparecerán aquí cuando completes citas desde la agenda.
          </p>
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead className={styles.tableHead}>
              <tr>
                <th>#</th>
                <th>Fecha</th>
                <th>Hora</th>
                <th>Cliente</th>
                <th>Empleada</th>
                <th>Servicios</th>
                <th>Productos</th>
                <th>Total Original</th>
                <th>Dto.%</th>
                <th>Ajustado</th>
                <th>Total</th>
                <th>Método de pago</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredRegistros.map((reg, idx) => (
                <motion.tr
                  key={reg.id}
                  className={styles.tableRow}
                  variants={itemVariants}
                  initial="hidden"
                  animate="show"
                  transition={{ delay: idx * 0.03 }}
                >
                  <td style={{ color: 'var(--text-dim)', fontWeight: 600 }}>
                    {reg.id}
                  </td>
                  {/* Fecha */}
                  <td style={{ color: 'var(--text-dim)', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                    {formatShortDate(reg.creadoEn)}
                  </td>
                  {/* Hora */}
                  <td style={{ color: 'var(--text-dim)', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                    {formatTimeAMPM(reg.creadoEn)}
                  </td>
                  <td style={{ fontWeight: 500 }}>
                    {reg._clienteNombre ?? `Cliente #${reg.clienteId}`}
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 500 }}>
                    {reg._empleadaNombre ?? `Usuaria #${reg.usuarioId}`}
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 500 }}>
                    {reg.totalServicios > 0 ? formatCurrency(reg.totalServicios) : '---'}
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 500 }}>
                    {reg.totalProductos > 0 ? formatCurrency(reg.totalProductos) : '---'}
                  </td>
                  {/* Total Original */}
                  <td style={{ color: 'var(--text-dim)', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                    {reg.precioAjustado && reg.valorOriginal != null
                      ? formatCurrency(reg.valorOriginal)
                      : '—'}
                  </td>
                  {/* Descuento */}
                  <td style={{ textAlign: 'center' }}>
                    {reg.porcentajeDescuento != null && reg.porcentajeDescuento > 0 ? (
                      <span style={{ color: 'var(--danger)', fontWeight: 500 }}>{reg.porcentajeDescuento}%</span>
                    ) : (
                      <span style={{ color: 'var(--text-dim)' }}>—</span>
                    )}
                  </td>
                  {/* Ajustado */}
                  <td style={{ textAlign: 'center' }}>
                    {reg.precioAjustado ? (
                      <span style={{ background: 'rgba(212,168,83,0.15)', color: 'var(--accent)', padding: '0.1rem 0.4rem', borderRadius: 'var(--radius-sm)', fontSize: '0.65rem', fontWeight: 600 }}>Sí</span>
                    ) : (
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.65rem' }}>No</span>
                    )}
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--accent)' }}>
                    {formatCurrency(calcTotal(reg))}
                  </td>
                  <td>
                    <span style={{ fontSize: '0.75rem' }}>
                      {METODO_PAGO_LABELS[reg.pagos?.[0]?.metodoPago ?? '---'] ?? '---'}
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.badge} ${styles.badgeServicios}`}>Activo</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.15rem' }}>
                      <button
                        className={styles.actionBtn}
                        onClick={() => openDetail(reg)}
                        title="Ver detalle"
                        aria-label="Ver detalle"
                      >
                        👁️
                      </button>
                      <button
                        className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                        onClick={() => openAnular(reg)}
                        title="Anular"
                        aria-label="Anular"
                      >
                        🚫
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination controls ── */}
      {registroMeta.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem', alignItems: 'center' }}>
          <button
            disabled={registroPage <= 1}
            onClick={() => setRegistroPage((p) => p - 1)}
            style={{ fontSize: '0.8125rem', padding: '0.35rem 0.85rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', color: 'var(--text-primary)', cursor: registroPage <= 1 ? 'not-allowed' : 'pointer', opacity: registroPage <= 1 ? 0.5 : 1 }}
          >
            ← Anterior
          </button>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            Página {registroMeta.page} de {registroMeta.totalPages} ({registroMeta.total} registros)
          </span>
          <button
            disabled={registroPage >= registroMeta.totalPages}
            onClick={() => setRegistroPage((p) => p + 1)}
            style={{ fontSize: '0.8125rem', padding: '0.35rem 0.85rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', color: 'var(--text-primary)', cursor: registroPage >= registroMeta.totalPages ? 'not-allowed' : 'pointer', opacity: registroPage >= registroMeta.totalPages ? 0.5 : 1 }}
          >
            Siguiente →
          </button>
        </div>
      )}

      {/* ── Detail Modal ── */}
      <AnimatePresence>
        {detailOpen && selectedRegistro && (
          <RenderRegistroDetail
            registro={selectedRegistro}
            calcTotal={calcTotal}
            onClose={closeDetail}
          />
        )}
      </AnimatePresence>

      {/* ── Anular Confirmation ── */}
      <AnimatePresence>
        {anularOpen && selectedRegistro && (
          <RenderConfirmAnular
            registro={selectedRegistro}
            submitting={submitting}
            onCancel={closeAnular}
            onConfirm={handleAnular}
          />
        )}
      </AnimatePresence>

      {/* ── Walk-In Registration Modal ── */}
      <AnimatePresence>
        {walkInOpen && (
          <WalkInModal
            salonId={salonId}
            isOpen={walkInOpen}
            onClose={() => setWalkInOpen(false)}
            onSuccess={() => {
              setWalkInOpen(false);
              fetchData();
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

/* ── Sub-component: Registro Detail Modal ── */

interface RegistroDetailProps {
  registro: Registro;
  calcTotal: (r: Registro) => number;
  onClose: () => void;
}

const RenderRegistroDetail: React.FC<RegistroDetailProps> = ({ registro, calcTotal, onClose }) => {
  const totalFinal = calcTotal(registro);
  const originalTotal = registro.valorOriginal ?? (registro.montoTotal || (registro.totalServicios + registro.totalProductos));
  const subtotal = registro.totalServicios + registro.totalProductos;
  const totalPagos = registro.pagos?.reduce((s, p) => s + p.monto, 0) ?? 0;
  const cambio = totalPagos > totalFinal ? totalPagos - totalFinal : 0;

  return (
    <motion.div
      className={styles.modalOverlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        className={`${styles.modalContent} ${styles.modalContentXl}`}
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.25, ease: [0.22, 0.61, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Registro #{registro.id}</span>
          <button className={styles.modalCloseBtn} onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

          <div className={styles.modalBody}>
            {/* ── Header: Registro # + badges + date ── */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem', gap: '0.35rem' }}>
              <div>
                <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  Registro #{registro.id}
                </h2>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.7rem', color: 'var(--text-dim)', margin: '0.25rem 0 0', lineHeight: 1.5 }}>
                  {formatDateTimeAMPM(registro.creadoEn)}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'flex-start' }}>
                {registro.esRetoque && (
                  <span style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8', padding: '0.15rem 0.45rem', borderRadius: 'var(--radius-sm)', fontSize: '0.6rem', fontWeight: 600, fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap' }}>🔁 Retoque</span>
                )}
                {registro.precioAjustado && (
                  <span style={{ background: 'rgba(212,168,83,0.15)', color: 'var(--accent)', padding: '0.15rem 0.45rem', borderRadius: 'var(--radius-sm)', fontSize: '0.6rem', fontWeight: 600, fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap' }}>💰 Precio ajustado</span>
                )}
                {registro.montoPendiente > 0 && (
                  <span style={{ background: 'rgba(224,85,106,0.12)', color: 'var(--danger)', padding: '0.15rem 0.45rem', borderRadius: 'var(--radius-sm)', fontSize: '0.6rem', fontWeight: 600, fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap' }}>⚠️ {formatCurrency(registro.montoPendiente)} pend.</span>
                )}
                {!registro.estaPagadaEmpleada && (
                  <span style={{ background: 'rgba(224,85,106,0.1)', color: 'var(--danger)', padding: '0.15rem 0.45rem', borderRadius: 'var(--radius-sm)', fontSize: '0.6rem', fontWeight: 600, fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap' }}>⏳ Pago emp. pend.</span>
                )}
              </div>
            </div>

            <hr className={styles.sectionDivider} />

            {/* ── Customer & Employee ── */}
            <div style={{ marginBottom: '0.75rem' }}>
              <h4 className={styles.sectionSubtitle}>Cliente y empleada</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>👤</span>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {registro._clienteNombre ?? `Cliente #${registro.clienteId}`}
                  </span>
                  {registro.pagos?.[0] && (
                    <span style={{
                      marginLeft: '0.5rem',
                      background: 'rgba(92,186,123,0.12)',
                      color: 'var(--success)',
                      padding: '0.1rem 0.5rem',
                      borderRadius: '999px',
                      fontSize: '0.6rem',
                      fontWeight: 600,
                      fontFamily: "'DM Sans', sans-serif",
                      whiteSpace: 'nowrap',
                    }}>
                      {METODO_PAGO_LABELS[registro.pagos[0].metodoPago] ?? registro.pagos[0].metodoPago}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>💇</span>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {registro._empleadaNombre ?? `Usuaria #${registro.usuarioId}`}
                  </span>
                </div>
              </div>
            </div>

            <hr className={styles.sectionDivider} />

            {/* ── Service detail card ── */}
            {registro.descripcionServicio && (
              <div style={{ marginBottom: '0.75rem' }}>
                <h4 className={styles.sectionSubtitle}>Servicio</h4>
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  style={{
                    background: 'linear-gradient(135deg, rgba(92,186,123,0.07), rgba(92,186,123,0.02))',
                    border: '1px solid rgba(92,186,123,0.18)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.6rem 0.9rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {registro.descripcionServicio}
                  </span>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '1rem', fontWeight: 700, color: 'var(--success)' }}>
                    {formatCurrency(registro.totalServicios)}
                  </span>
                </motion.div>
              </div>
            )}

            {/* ── Products section (mini-cards with accent border) ── */}
            {registro.productosVendidos && registro.productosVendidos.length > 0 && (
              <div style={{ marginBottom: '0.75rem' }}>
                <h4 className={styles.sectionSubtitle}>Productos vendidos</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {registro.productosVendidos.map((pv, idx) => (
                    <motion.div
                      key={pv.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: idx * 0.04 }}
                      className={styles.miniCard}
                      style={{
                        borderLeft: `3px solid ${idx % 2 === 0 ? 'var(--accent)' : 'var(--success)'}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '0.75rem',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {pv.nombre}
                        </div>
                        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '0.1rem' }}>
                          {pv.cantidad} × {formatCurrency(pv.precioVentaUnitario)}
                        </div>
                      </div>
                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                        {formatCurrency(pv.subtotal)}
                      </span>
                    </motion.div>
                  ))}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.4rem 0.6rem 0.2rem',
                    borderTop: '1px solid var(--border)',
                    marginTop: '0.1rem',
                  }}>
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Total productos
                    </span>
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', fontWeight: 700, color: 'var(--accent)' }}>
                      {formatCurrency(registro.totalProductos)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Resumen (combined cobro + comisiones) ── */}
            <div style={{ marginBottom: '0.75rem' }}>
              <h4 className={styles.sectionSubtitle}>Resumen</h4>
              <div style={{
                background: 'var(--bg-elevated)',
                border: '1px dashed var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '0.6rem 0.9rem',
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem 1.5rem' }}>
                  {/* Left column: Servicios, Productos, Subtotal */}
                  <div>
                    <div className={styles.infoRow} style={{ padding: '0.2rem 0', border: 'none' }}>
                      <span className={styles.infoLabel} style={{ minWidth: 'auto', fontSize: '0.75rem' }}>Servicios</span>
                      <span className={styles.infoValue} style={{ fontSize: '0.75rem', marginLeft: 'auto' }}>{formatCurrency(registro.totalServicios)}</span>
                    </div>
                    <div className={styles.infoRow} style={{ padding: '0.2rem 0', border: 'none' }}>
                      <span className={styles.infoLabel} style={{ minWidth: 'auto', fontSize: '0.75rem' }}>Productos</span>
                      <span className={styles.infoValue} style={{ fontSize: '0.75rem', marginLeft: 'auto' }}>{formatCurrency(registro.totalProductos)}</span>
                    </div>
                    <div className={styles.infoRow} style={{ padding: '0.2rem 0', borderTop: '1px dashed var(--border)', marginTop: '0.1rem' }}>
                      <span className={styles.infoLabel} style={{ minWidth: 'auto', fontSize: '0.75rem', fontWeight: 600 }}>Subtotal</span>
                      <span className={styles.infoValue} style={{ fontSize: '0.75rem', fontWeight: 600, marginLeft: 'auto' }}>{formatCurrency(subtotal)}</span>
                    </div>
                  </div>
                  {/* Right column: Comisión, Propina, Total Empleada */}
                  {(registro.comisionCalculada > 0 || registro.propina > 0) && (
                    <div>
                      {registro.comisionCalculada > 0 && (
                        <div className={styles.infoRow} style={{ padding: '0.2rem 0', border: 'none' }}>
                          <span className={styles.infoLabel} style={{ minWidth: 'auto', fontSize: '0.75rem' }}>Comisión</span>
                          <span className={styles.infoValue} style={{ fontSize: '0.75rem', marginLeft: 'auto' }}>{formatCurrency(registro.comisionCalculada)}</span>
                        </div>
                      )}
                      {registro.propina > 0 && (
                        <div className={styles.infoRow} style={{ padding: '0.2rem 0', border: 'none' }}>
                          <span className={styles.infoLabel} style={{ minWidth: 'auto', fontSize: '0.75rem' }}>Propina</span>
                          <span className={styles.infoValue} style={{ fontSize: '0.75rem', color: 'var(--success)', marginLeft: 'auto' }}>+{formatCurrency(registro.propina)}</span>
                        </div>
                      )}
                      {(registro.comisionCalculada > 0 || registro.propina > 0) && (
                        <div className={styles.infoRow} style={{ padding: '0.2rem 0', borderTop: '1px dashed var(--border)', marginTop: '0.1rem' }}>
                          <span className={styles.infoLabel} style={{ minWidth: 'auto', fontSize: '0.75rem', fontWeight: 600 }}>Total empleada</span>
                          <span className={styles.infoValue} style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', marginLeft: 'auto' }}>
                            {formatCurrency((registro.comisionCalculada ?? 0) + (registro.propina ?? 0))}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {(registro.porcentajeDescuento != null && registro.porcentajeDescuento > 0) && (
                  <div className={styles.infoRow} style={{ padding: '0.2rem 0', border: 'none' }}>
                    <span className={styles.infoLabel} style={{ minWidth: 'auto', fontSize: '0.75rem' }}>Dto. {registro.porcentajeDescuento}%</span>
                    <span className={styles.infoValue} style={{ fontSize: '0.75rem', color: 'var(--danger)', marginLeft: 'auto' }}>-{formatCurrency(Math.round(subtotal * registro.porcentajeDescuento / 100))}</span>
                  </div>
                )}
                {registro.precioAjustado && (
                  <div className={styles.infoRow} style={{ padding: '0.2rem 0', border: 'none' }}>
                    <span className={styles.infoLabel} style={{ minWidth: 'auto', fontSize: '0.75rem' }}>Total original</span>
                    <span className={styles.infoValue} style={{ fontSize: '0.75rem', textDecoration: 'line-through', color: 'var(--text-dim)', marginLeft: 'auto' }}>{formatCurrency(originalTotal)}</span>
                  </div>
                )}
                <div className={styles.infoRow} style={{ borderTop: '2px solid var(--border)', marginTop: '0.2rem', padding: '0.3rem 0 0' }}>
                  <span className={styles.infoLabel} style={{ minWidth: 'auto', fontWeight: 700, fontSize: '0.8125rem' }}>Total final</span>
                  <span className={styles.infoValue} style={{ fontWeight: 800, color: 'var(--accent)', fontSize: '1rem', marginLeft: 'auto' }}>{formatCurrency(totalFinal)}</span>
                </div>
                {registro.precioAjustado && registro.notas && (
                  <div className={styles.infoRow} style={{ border: 'none', padding: '0.2rem 0 0' }}>
                    <span className={styles.infoLabel} style={{ minWidth: 'auto', fontSize: '0.7rem' }}>Nota de ajuste</span>
                    <span className={styles.infoValue} style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', fontStyle: 'italic', marginLeft: 'auto' }}>"{registro.notas}"</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Payments section (compact list) ── */}
            {registro.pagos && registro.pagos.length > 0 && (
              <div style={{ marginBottom: '0.75rem' }}>
                <h4 className={styles.sectionSubtitle}>Pagos</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  {registro.pagos.map((p) => (
                    <div key={p.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.25rem 0.5rem',
                      background: 'var(--bg-elevated)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.78rem',
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span style={{ fontSize: '0.7rem' }}>💳</span>
                        <span style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, color: 'var(--text-primary)' }}>
                          {METODO_PAGO_LABELS[p.metodoPago] ?? p.metodoPago}
                        </span>
                        {p.referencia && (
                          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.65rem', color: 'var(--text-dim)' }}>
                            · Ref: {p.referencia}
                          </span>
                        )}
                      </span>
                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, color: 'var(--success)', fontSize: '0.8125rem' }}>
                        +{formatCurrency(p.monto)}
                      </span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', padding: '0.2rem 0.5rem', borderTop: '1px solid var(--border)', marginTop: '0.15rem' }}>
                    <div>
                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.65rem', color: 'var(--text-dim)' }}>Recibido: </span>
                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(totalPagos)}</span>
                    </div>
                    {cambio > 0 && (
                      <div>
                        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.65rem', color: 'var(--text-dim)' }}>Cambio: </span>
                        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.8125rem', fontWeight: 600, color: 'var(--success)' }}>{formatCurrency(cambio)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Divisions (inline text) ── */}
            {registro.divisiones && registro.divisiones.length > 0 && (
              <div style={{ marginBottom: '0.75rem' }}>
                <h4 className={styles.sectionSubtitle}>Divisiones</h4>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', padding: '0.3rem 0.6rem', lineHeight: 1.6 }}>
                  {registro.divisiones.map((d, i) => (
                    <span key={d.id}>
                      {i > 0 && <span style={{ margin: '0 0.4rem', color: 'var(--text-dim)' }}>|</span>}
                      Empleada #{d.usuarioId}: {d.porcentajeParticipacion}%
                      {d.comisionCorrespondiente > 0 && <> · {formatCurrency(d.comisionCorrespondiente)}</>}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── General Notes ── */}
            {registro.notas && !registro.precioAjustado && (
              <div style={{ marginBottom: '0.5rem' }}>
                <h4 className={styles.sectionSubtitle}>Notas</h4>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.8125rem', color: 'var(--text-secondary)', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', lineHeight: 1.6, fontStyle: 'italic' }}>
                  {registro.notas}
                </div>
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
};

/* ── Sub-component: Anular Confirmation ── */

interface AnularConfirmProps {
  registro: Registro;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const RenderConfirmAnular: React.FC<AnularConfirmProps> = ({ registro, submitting, onCancel, onConfirm }) => (
  <motion.div
    className={styles.modalOverlay}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.2 }}
    onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
          >
            <motion.div
              className={`${styles.modalContent} ${styles.modalContentXl}`}
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
      transition={{ duration: 0.25, ease: [0.22, 0.61, 0.36, 1] }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className={styles.modalHeader}>
        <span className={styles.modalTitle}>Anular registro</span>
        <button className={styles.modalCloseBtn} onClick={onCancel} aria-label="Cerrar">✕</button>
      </div>

      <div className={styles.modalBody}>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
          ¿Estás segura de anular el registro <strong>#{registro.id}</strong>?
        </p>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          Esta acción no se puede deshacer. El registro se marcará como anulado pero se conservará para auditoría.
        </p>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.8125rem', color: 'var(--success)', marginTop: '0.5rem', fontWeight: 500 }}>
          Los productos de esta venta se devolverán al inventario.
        </p>

        {registro._clienteNombre && (
          <div className={styles.deleteWarning}>
            ⚠️ Cliente: {registro._clienteNombre}. Monto: {formatCurrency(registro.montoTotal)}
          </div>
        )}
      </div>

      <div className={styles.modalFooter}>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <button
          style={dangerBtnStyle}
          disabled={submitting}
          onClick={onConfirm}
        >
          {submitting ? 'Anulando...' : 'Sí, anular'}
        </button>
      </div>
    </motion.div>
  </motion.div>
);

/* ================================================================ */
/*  GASTOS TAB                                                       */
/* ================================================================ */

const GastosTab: React.FC<{ salonId: number | null }> = ({ salonId }) => {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedGasto, setSelectedGasto] = useState<Gasto | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({ descripcion: '', monto: '', categoria: 'OTROS', metodoPago: 'EFECTIVO', esGastoFijo: false });

  const [gastoPage, setGastoPage] = useState(1);
  const [gastoMeta, setGastoMeta] = useState({ page: 1, limit: 12, total: 0, totalPages: 0 });

  const fetchGastos = useCallback(async () => {
    if (salonId == null) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/salones/${salonId}/gastos`, { params: { page: String(gastoPage), limit: '12' } });
      setGastos(Array.isArray(data.data) ? data.data : []);
      setGastoMeta(data.meta ?? { page: 1, limit: 12, total: 0, totalPages: 0 });
    } catch {
      setError('Error al cargar gastos');
      setGastos([]);
    } finally {
      setLoading(false);
    }
  }, [salonId, gastoPage]);

  useEffect(() => {
    if (salonId) fetchGastos();
  }, [salonId, fetchGastos]);

  const totalMes = useMemo(() => {
    const now = getMonthISO(new Date());
    return gastos
      .filter((g) => g.fecha && g.fecha.startsWith(now))
      .reduce((sum, g) => sum + Number(g.monto ?? 0), 0);
  }, [gastos]);

  const openForm = () => {
    setForm({ descripcion: '', monto: '', categoria: 'OTROS', metodoPago: 'EFECTIVO', esGastoFijo: false });
    setFormOpen(true);
  };

  const openDelete = (g: Gasto) => {
    setSelectedGasto(g);
    setDeleteOpen(true);
  };

  const handleCreate = async () => {
    if (!salonId) return;
    setSubmitting(true);
    try {
      await api.post(`/salones/${salonId}/gastos`, {
        descripcion: form.descripcion.trim(),
        monto: Number(form.monto),
        categoria: form.categoria,
        metodoPago: form.metodoPago,
        esGastoFijo: form.esGastoFijo,
      });
      setFormOpen(false);
      fetchGastos();
    } catch {
      console.error('Error al crear gasto:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!salonId || !selectedGasto) return;
    setSubmitting(true);
    try {
      await api.delete(`/salones/${salonId}/gastos/${selectedGasto.id}`);
      setDeleteOpen(false);
      setSelectedGasto(null);
      fetchGastos();
    } catch {
      // silent
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = form.descripcion.trim().length > 0 && Number(form.monto) > 0;

  if (loading) {
    return (
      <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Skeleton height="60px" width="200px" variant="rect" style={{ marginBottom: '1rem' }} />
        <Skeleton height="240px" variant="rect" />
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div key="error" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={styles.emptyState}>
        <span className={styles.emptyIcon}>⚠️</span>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', color: 'var(--danger)', marginBottom: '1rem' }}>{error}</p>
        <Button variant="secondary" size="sm" onClick={fetchGastos}>Reintentar</Button>
      </motion.div>
    );
  }

  return (
    <motion.div key="gastos" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
      {/* ── Total del mes ── */}
      <motion.div className={styles.summaryGrid} variants={containerVariants} initial="hidden" animate="show">
        <motion.div variants={itemVariants} className={styles.summaryCard}>
          <span className={styles.summaryLabel}>💸 Gastos del mes</span>
          <span className={styles.summaryValue} style={{ color: 'var(--danger)' }}>
            {formatCurrency(totalMes)}
          </span>
        </motion.div>
        <motion.div variants={itemVariants} className={styles.summaryCard}>
          <span className={styles.summaryLabel}>📦 Total registros</span>
          <span className={styles.summaryValue}>{gastos.length}</span>
        </motion.div>
      </motion.div>

      {/* ── Toolbar ── */}
      <div className={styles.toolbar}>
        <span className={styles.toolbarTitle}>Historial de gastos</span>
        <motion.button
          style={primaryBtnStyle}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={openForm}
        >
          + Nuevo gasto
        </motion.button>
      </div>

      {/* ── Table ── */}
      {gastos.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>💸</span>
          <h3 className={styles.emptyTitle}>No hay gastos registrados</h3>
          <p className={styles.emptySubtitle}>Agregá tu primer gasto para llevar el control financiero de tu salón.</p>
          <motion.button style={primaryBtnStyle} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={openForm}>
            Registrar gasto
          </motion.button>
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead className={styles.tableHead}>
              <tr>
                <th>Descripción</th>
                <th>Categoría</th>
                <th>Monto</th>
                <th>Fecha</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {gastos.map((g, idx) => (
                <motion.tr
                  key={g.id}
                  className={styles.tableRow}
                  variants={itemVariants}
                  initial="hidden"
                  animate="show"
                  transition={{ delay: idx * 0.03 }}
                >
                  <td style={{ fontWeight: 500 }}>{g.descripcion}</td>
                  <td>
                    <span className={`${styles.badge} ${getCategoryBadge(g.categoria)}`}>
                      {GASTO_CATEGORIAS.find((c) => c.value === g.categoria)?.label ?? g.categoria}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--danger)' }}>{formatCurrency(Number(g.monto ?? 0))}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{formatDate(g.fecha)}</td>
                  <td>
                    <button
                      className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                      onClick={() => openDelete(g)}
                      title="Eliminar"
                      aria-label="Eliminar"
                    >
                      🗑️
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination controls ── */}
      {gastoMeta.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem', alignItems: 'center' }}>
          <button
            disabled={gastoPage <= 1}
            onClick={() => setGastoPage((p) => p - 1)}
            style={{ fontSize: '0.8125rem', padding: '0.35rem 0.85rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', color: 'var(--text-primary)', cursor: gastoPage <= 1 ? 'not-allowed' : 'pointer', opacity: gastoPage <= 1 ? 0.5 : 1 }}
          >
            ← Anterior
          </button>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            Página {gastoMeta.page} de {gastoMeta.totalPages} ({gastoMeta.total} registros)
          </span>
          <button
            disabled={gastoPage >= gastoMeta.totalPages}
            onClick={() => setGastoPage((p) => p + 1)}
            style={{ fontSize: '0.8125rem', padding: '0.35rem 0.85rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', color: 'var(--text-primary)', cursor: gastoPage >= gastoMeta.totalPages ? 'not-allowed' : 'pointer', opacity: gastoPage >= gastoMeta.totalPages ? 0.5 : 1 }}
          >
            Siguiente →
          </button>
        </div>
      )}

      {/* ── Create Gasto Modal ── */}
      <AnimatePresence>
        {formOpen && (
          <motion.div
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => { if (e.target === e.currentTarget) setFormOpen(false); }}
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
                <span className={styles.modalTitle}>Nuevo gasto</span>
                <button className={styles.modalCloseBtn} onClick={() => setFormOpen(false)} aria-label="Cerrar">✕</button>
              </div>

              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label className={`${styles.formLabel} ${styles.formRequired}`}>Descripción</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={form.descripcion}
                    onChange={(e) => setForm((prev) => ({ ...prev, descripcion: e.target.value }))}
                    placeholder="Ej: Compra de tintes"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={`${styles.formLabel} ${styles.formRequired}`}>Monto</label>
                  <input
                    type="number"
                    className={styles.formInput}
                    value={form.monto}
                    onChange={(e) => setForm((prev) => ({ ...prev, monto: e.target.value }))}
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={`${styles.formLabel} ${styles.formRequired}`}>Categoría</label>
                  <select
                    className={styles.formSelect}
                    value={form.categoria}
                    onChange={(e) => setForm((prev) => ({ ...prev, categoria: e.target.value }))}
                  >
                    {GASTO_CATEGORIAS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={`${styles.formLabel} ${styles.formRequired}`}>Método de pago</label>
                  <select
                    className={styles.formSelect}
                    value={form.metodoPago}
                    onChange={(e) => setForm((prev) => ({ ...prev, metodoPago: e.target.value }))}
                  >
                    <option value="EFECTIVO">Efectivo</option>
                    <option value="TARJETA_CREDITO">Tarjeta crédito</option>
                    <option value="TARJETA_DEBITO">Tarjeta débito</option>
                    <option value="TRANSFERENCIA">Transferencia</option>
                    <option value="OTRO">Otro</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.esGastoFijo}
                      onChange={(e) => setForm((prev) => ({ ...prev, esGastoFijo: e.target.checked }))}
                    />
                    ¿Es gasto fijo?
                  </label>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <Button variant="ghost" size="sm" onClick={() => setFormOpen(false)}>Cancelar</Button>
                <Button variant="primary" size="sm" disabled={!isValid} loading={submitting} onClick={handleCreate}>
                  Registrar gasto
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Delete Confirmation ── */}
      <AnimatePresence>
        {deleteOpen && selectedGasto && (
          <motion.div
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => { if (e.target === e.currentTarget) { setDeleteOpen(false); setSelectedGasto(null); } }}
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
                <span className={styles.modalTitle}>Eliminar gasto</span>
                <button className={styles.modalCloseBtn} onClick={() => { setDeleteOpen(false); setSelectedGasto(null); }} aria-label="Cerrar">✕</button>
              </div>

              <div className={styles.modalBody}>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  ¿Estás segura de eliminar <strong>{selectedGasto.concepto}</strong>?
                </p>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  Esta acción no se puede deshacer.
                </p>
                <div className={styles.deleteWarning}>
                  ⚠️ Monto: {formatCurrency(Number(selectedGasto.monto ?? 0))} — {GASTO_CATEGORIAS.find((c) => c.value === (selectedGasto.categoria ?? '').toUpperCase())?.label ?? selectedGasto.categoria ?? '—'}
                </div>
              </div>

              <div className={styles.modalFooter}>
                <Button variant="ghost" size="sm" onClick={() => { setDeleteOpen(false); setSelectedGasto(null); }}>Cancelar</Button>
                <button style={dangerBtnStyle} disabled={submitting} onClick={handleDelete}>
                  {submitting ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

/* ================================================================ */
/*  DEVOLUCIONES TAB                                                 */
/* ================================================================ */

const DevolucionesTab: React.FC<{ salonId: number | null }> = ({ salonId }) => {
  const [devoluciones, setDevoluciones] = useState<Devolucion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ cantidad: '1', motivo: '', montoDevolucion: '', registroServicioId: 0, productoId: 0, regresaAlStock: true });
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [productos, setProductos] = useState<{ id: number; nombre: string }[]>([]);
  const [devolucionFilter, setDevolucionFilter] = useState<'TODAS' | 'PRODUCTOS' | 'SERVICIOS'>('TODAS');
  const [devolucionPage, setDevolucionPage] = useState(1);
  const [devolucionMeta, setDevolucionMeta] = useState({ page: 1, limit: 12, total: 0, totalPages: 0 });

  const filteredDevoluciones = useMemo(() => {
    if (devolucionFilter === 'TODAS') return devoluciones;
    if (devolucionFilter === 'PRODUCTOS') return devoluciones.filter((d) => d.productoId != null);
    return devoluciones.filter((d) => d.productoId == null);
  }, [devoluciones, devolucionFilter]);

  const fetchDevoluciones = useCallback(async () => {
    if (salonId == null) return;
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.allSettled([
        api.get(`/salones/${salonId}/devoluciones`, { params: { page: String(devolucionPage), limit: '12' } }),
        api.get(`/salones/${salonId}/registros`),
        api.get(`/salones/${salonId}/productos?tipo=RETAIL`),
      ]);
      if (results[0].status === 'fulfilled') {
        const raw = results[0].value.data;
        setDevoluciones(Array.isArray(raw.data) ? raw.data : []);
        setDevolucionMeta(raw.meta ?? { page: 1, limit: 12, total: 0, totalPages: 0 });
      } else {
        setDevoluciones([]);
      }
      if (results[1].status === 'fulfilled') {
        const raw = results[1].value.data;
        setRegistros(Array.isArray(raw.data) ? raw.data : []);
      } else {
        setRegistros([]);
      }
      if (results[2].status === 'fulfilled') {
        const raw = results[2].value.data;
        setProductos(Array.isArray(raw) ? raw : []);
      } else {
        setProductos([]);
      }
    } catch {
      setError('Error al cargar datos');
      setDevoluciones([]);
    } finally {
      setLoading(false);
    }
  }, [salonId, devolucionPage]);

  useEffect(() => {
    if (salonId) fetchDevoluciones();
  }, [salonId, fetchDevoluciones]);

  const handleCreate = async () => {
    if (!salonId) return;
    setSubmitting(true);
    try {
      await api.post(`/salones/${salonId}/devoluciones`, {
        registroServicioId: form.registroServicioId,
        cantidad: Number(form.cantidad),
        motivo: form.motivo.trim(),
        montoDevolucion: Number(form.montoDevolucion),
        regresaAlStock: form.regresaAlStock,
        productoId: form.productoId || undefined,
      });
      setFormOpen(false);
      setForm({ cantidad: '1', motivo: '', montoDevolucion: '', registroServicioId: 0, productoId: 0, regresaAlStock: true });
      fetchDevoluciones();
    } catch {
      console.error('Error al crear devolución:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = form.motivo.trim().length > 0 && Number(form.montoDevolucion) > 0 && form.registroServicioId > 0;

  if (loading) {
    return (
      <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Skeleton height="240px" variant="rect" />
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div key="error" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={styles.emptyState}>
        <span className={styles.emptyIcon}>⚠️</span>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', color: 'var(--danger)', marginBottom: '1rem' }}>{error}</p>
        <Button variant="secondary" size="sm" onClick={fetchDevoluciones}>Reintentar</Button>
      </motion.div>
    );
  }

  return (
    <motion.div key="devoluciones" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
      <div className={styles.toolbar}>
        <span className={styles.toolbarTitle}>Devoluciones</span>
        <motion.button
          style={primaryBtnStyle}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setFormOpen(true)}
        >
          + Nueva devolución
        </motion.button>
      </div>

      {/* ── Filter chips ── */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {(['TODAS', 'PRODUCTOS', 'SERVICIOS'] as const).map((t) => {
          const isActive = devolucionFilter === t;
          return (
            <motion.button
              key={t}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setDevolucionFilter(t)}
              style={{
                background: isActive ? 'var(--accent)' : 'var(--bg-surface)',
                color: isActive ? 'var(--bg-root)' : 'var(--text-secondary)',
                border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.35rem 0.85rem',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '0.75rem',
                fontWeight: isActive ? 600 : 400,
                cursor: 'pointer',
                transition: 'background 0.2s, color 0.2s, border-color 0.2s',
              }}
            >
              {t === 'TODAS' ? 'Todas' : t === 'PRODUCTOS' ? 'Productos' : 'Servicios'}
            </motion.button>
          );
        })}
      </div>

      {filteredDevoluciones.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>↩️</span>
          <h3 className={styles.emptyTitle}>No hay devoluciones</h3>
          <p className={styles.emptySubtitle}>Las devoluciones se registrarán aquí cuando sean necesarias.</p>
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead className={styles.tableHead}>
              <tr>
                <th>Tipo</th>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Motivo</th>
                <th>Monto dev.</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {filteredDevoluciones.map((d, idx) => (
                <motion.tr
                  key={d.id}
                  className={styles.tableRow}
                  variants={itemVariants}
                  initial="hidden"
                  animate="show"
                  transition={{ delay: idx * 0.03 }}
                >
                  <td>
                    <span className={`${styles.badge} ${d.productoId != null ? styles.badgeProductos : styles.badgeServicios}`}>
                      {d.productoId != null ? 'Producto' : 'Servicio'}
                    </span>
                  </td>
                  <td style={{ fontWeight: 500 }}>{d.producto?.nombre ?? '—'}</td>
                  <td>{d.cantidad}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.motivo}</td>
                  <td style={{ fontWeight: 600, color: 'var(--danger)' }}>{formatCurrency(d.montoDevolucion)}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{formatDate(d.creadoEn || d.fecha)}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination controls ── */}
      {devolucionMeta.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem', alignItems: 'center' }}>
          <button
            disabled={devolucionPage <= 1}
            onClick={() => setDevolucionPage((p) => p - 1)}
            style={{ fontSize: '0.8125rem', padding: '0.35rem 0.85rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', color: 'var(--text-primary)', cursor: devolucionPage <= 1 ? 'not-allowed' : 'pointer', opacity: devolucionPage <= 1 ? 0.5 : 1 }}
          >
            ← Anterior
          </button>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            Página {devolucionMeta.page} de {devolucionMeta.totalPages} ({devolucionMeta.total} registros)
          </span>
          <button
            disabled={devolucionPage >= devolucionMeta.totalPages}
            onClick={() => setDevolucionPage((p) => p + 1)}
            style={{ fontSize: '0.8125rem', padding: '0.35rem 0.85rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', color: 'var(--text-primary)', cursor: devolucionPage >= devolucionMeta.totalPages ? 'not-allowed' : 'pointer', opacity: devolucionPage >= devolucionMeta.totalPages ? 0.5 : 1 }}
          >
            Siguiente →
          </button>
        </div>
      )}

      {/* ── Create Devolución Modal ── */}
      <AnimatePresence>
        {formOpen && (
          <motion.div
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => { if (e.target === e.currentTarget) setFormOpen(false); }}
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
                <span className={styles.modalTitle}>Nueva devolución</span>
                <button className={styles.modalCloseBtn} onClick={() => setFormOpen(false)} aria-label="Cerrar">✕</button>
              </div>

              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label className={`${styles.formLabel} ${styles.formRequired}`}>Venta</label>
                  <select
                    className={styles.formSelect}
                    value={form.registroServicioId}
                    onChange={(e) => setForm((prev) => ({ ...prev, registroServicioId: Number(e.target.value) }))}
                  >
                    <option value={0}>Seleccionar venta</option>
                    {registros.map((reg) => (
                      <option key={reg.id} value={reg.id}>
                        Venta #{reg.id} — {formatCurrency(reg.montoTotal)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Producto (opcional)</label>
                  <select
                    className={styles.formSelect}
                    value={form.productoId}
                    onChange={(e) => setForm((prev) => ({ ...prev, productoId: Number(e.target.value) }))}
                  >
                    <option value={0}>Seleccionar producto (opcional)</option>
                    {productos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={`${styles.formLabel} ${styles.formRequired}`}>Cantidad</label>
                    <input
                      type="number"
                      className={styles.formInput}
                      value={form.cantidad}
                      onChange={(e) => setForm((prev) => ({ ...prev, cantidad: e.target.value }))}
                      min="1"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={`${styles.formLabel} ${styles.formRequired}`}>Monto devolución</label>
                    <input
                      type="number"
                      className={styles.formInput}
                      value={form.montoDevolucion}
                      onChange={(e) => setForm((prev) => ({ ...prev, montoDevolucion: e.target.value }))}
                      placeholder="0"
                      min="0"
                    />
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label className={`${styles.formLabel} ${styles.formRequired}`}>Motivo</label>
                  <textarea
                    className={styles.formTextarea}
                    value={form.motivo}
                    onChange={(e) => setForm((prev) => ({ ...prev, motivo: e.target.value }))}
                    placeholder="Ej: Producto defectuoso, cambio de opinión..."
                    rows={3}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.regresaAlStock}
                      onChange={(e) => setForm((prev) => ({ ...prev, regresaAlStock: e.target.checked }))}
                      disabled={form.productoId === 0}
                    />
                    Devolver al stock
                  </label>
                  {form.productoId === 0 && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginLeft: '1.75rem' }}>
                      Seleccioná un producto para habilitar esta opción
                    </span>
                  )}
                </div>
              </div>

              <div className={styles.modalFooter}>
                <Button variant="ghost" size="sm" onClick={() => setFormOpen(false)}>Cancelar</Button>
                <Button variant="primary" size="sm" disabled={!isValid} loading={submitting} onClick={handleCreate}>
                  Registrar devolución
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

/* ================================================================ */
/*  NÓMINA TAB                                                       */
/* ================================================================ */

const NominaTab: React.FC<{ salonId: number | null }> = ({ salonId }) => {
  const [pendientes, setPendientes] = useState<NominaEmpleado[]>([]);
  const [historial, setHistorial] = useState<HistorialLiquidacion[]>([]);
  const [empleadasMap, setEmpleadasMap] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<number | null>(null);

  // ── Sub-tab state ──
  const [nominaSubtab, setNominaSubtab] = useState<'pendientes' | 'historial'>('pendientes');

  // ── Historial filters (client-side) ──
  const [historialDesde, setHistorialDesde] = useState('');
  const [historialHasta, setHistorialHasta] = useState('');
  const [historialEmpleadaId, setHistorialEmpleadaId] = useState('');
  const [historialSearch, setHistorialSearch] = useState('');
  const [historialPage, setHistorialPage] = useState(1);
  const HISTORIAL_PAGE_SIZE = 10;

  // ── Pre-liquidation audit modal ──
  const [auditarOpen, setAuditarOpen] = useState(false);
  const [selectedEmpleada, setSelectedEmpleada] = useState<NominaEmpleado | null>(null);
  const [auditarRegistros, setAuditarRegistros] = useState<Registro[]>([]);
  const [auditarLoading, setAuditarLoading] = useState(false);
  const [auditarError, setAuditarError] = useState<string | null>(null);

  // ── Payment adjustment state ──
  const [ajustarPago, setAjustarPago] = useState(false);
  const [pagoAjustado, setPagoAjustado] = useState(0);
  const [motivoAjuste, setMotivoAjuste] = useState('');

  // ── Loan deduction state ──
  const [prestamosActivos, setPrestamosActivos] = useState<Array<{id: number; saldoPendiente: number; motivo: string | null; monto: number}>>([]);
  const [descuentosPrestamos, setDescuentosPrestamos] = useState<Record<number, {checked: boolean; monto: number}>>({});
  const [loadingPrestamos, setLoadingPrestamos] = useState(false);

  // ── Derived values ──
  const totalComisiones = useMemo(
    () => pendientes.reduce((sum, e) => sum + Number(e.totalComisionesPendientes ?? 0), 0),
    [pendientes],
  );
  const totalProximoPago = useMemo(
    () => pendientes.reduce((sum, e) => sum + Number(e.totalAPagar ?? 0), 0),
    [pendientes],
  );

  const pendientesFiltrados = useMemo(
    () => pendientes.filter((p) => p.totalAPagar > 0),
    [pendientes],
  );

  // ── Helper: current month period ──
  const getCurrentPeriod = () => {
    const now = new Date();
    // Usar UTC para coincidir con el backend
    const firstDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    return { firstDay, today };
  };

  // ── Filtered historial (client-side) ──
  const filteredHistorial = useMemo(() => {
    let result = [...historial];
    if (historialEmpleadaId) {
      result = result.filter((h) => h.usuarioId === Number(historialEmpleadaId));
    }
    if (historialDesde) {
      result = result.filter((h) => h.creadoEn >= historialDesde);
    }
    if (historialHasta) {
      result = result.filter((h) => h.creadoEn <= historialHasta + 'T23:59:59');
    }
    if (historialSearch.trim()) {
      const q = historialSearch.trim().toLowerCase();
      result = result.filter((h) => {
        const name = empleadasMap.get(h.usuarioId) ?? '';
        return name.toLowerCase().includes(q) || String(h.id).includes(q);
      });
    }
    return result;
  }, [historial, historialEmpleadaId, historialDesde, historialHasta, historialSearch, empleadasMap]);

  const historialTotalPages = Math.max(1, Math.ceil(filteredHistorial.length / HISTORIAL_PAGE_SIZE));
  const paginatedHistorial = useMemo(
    () => filteredHistorial.slice(
      (historialPage - 1) * HISTORIAL_PAGE_SIZE,
      historialPage * HISTORIAL_PAGE_SIZE,
    ),
    [filteredHistorial, historialPage],
  );

  const totalFiltrado = useMemo(
    () => filteredHistorial.reduce((sum, r) => sum + (r.montoTotal || (r.totalServicios + r.totalProductos)), 0),
    [filteredHistorial],
  );

  // Reset historial page to 1 when any filter changes
  useEffect(() => {
    setHistorialPage(1);
  }, [historialDesde, historialHasta, historialEmpleadaId, historialSearch]);

  const fetchData = useCallback(async () => {
    if (salonId == null) return;
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.allSettled([
        api.get(`/salones/${salonId}/finanzas/nomina`),
        api.get(`/salones/${salonId}/finanzas/nomina/historial`),
        api.get(`/salones/${salonId}/empleadas`),
      ]);
      if (results[0].status === 'fulfilled') {
        const raw = results[0].value.data;
        setPendientes(Array.isArray(raw) ? raw : []);
      } else {
        setPendientes([]);
      }
      if (results[1].status === 'fulfilled') {
        const raw = results[1].value.data;
        setHistorial(Array.isArray(raw) ? raw : []);
      } else {
        setHistorial([]);
      }
      if (results[2]?.status === 'fulfilled') {
        const emps = Array.isArray(results[2].value.data) ? results[2].value.data : [];
        const map = new Map<number, string>();
        for (const e of emps) {
          map.set(e.id, e.nombre);
        }
        setEmpleadasMap(map);
      }
    } catch {
      setError('Error al cargar datos de nómina');
    } finally {
      setLoading(false);
    }
  }, [salonId]);

  useEffect(() => {
    if (salonId) fetchData();
  }, [salonId, fetchData]);

  const handleLiquidar = async (
    empleadaId: number,
    totalPagadoOverride?: number,
    descuentos?: Array<{prestamoId: number; monto: number}>,
  ) => {
    if (!salonId) return;
    setSubmittingId(empleadaId);
    setError(null);
    try {
      const now = new Date();
      const firstDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const body: Record<string, any> = {
        usuarioId: empleadaId,
        periodoInicio: toISODate(firstDay),
        periodoFin: toISODate(today),
      };
      if (totalPagadoOverride != null) {
        body.totalPagado = totalPagadoOverride;
      }
      if (descuentos && descuentos.length > 0) {
        body.descuentosPrestamos = descuentos;
      }
      await api.post(`/salones/${salonId}/finanzas/nomina/liquidar`, body);
      await fetchData();
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? 'Error al liquidar nómina';
      setError(msg);
      // Re-lanzar para que handleConfirmLiquidar sepa que falló
      throw new Error(msg);
    } finally {
      setSubmittingId(null);
    }
  };

  const handleAuditar = async (emp: NominaEmpleado) => {
    setSelectedEmpleada(emp);
    setPagoAjustado(emp.totalAPagar);
    setAjustarPago(false);
    setMotivoAjuste('');
    setDescuentosPrestamos({});
    setAuditarOpen(true);

    // Fetch active loans for this employee
    if (salonId) {
      setLoadingPrestamos(true);
      try {
        const { data } = await api.get(`/salones/${salonId}/prestamos`, {
          params: { usuarioId: emp.empleadaId, estado: 'ACTIVO', limit: 50 },
        });
        const prestamos = Array.isArray(data?.data) ? data.data : [];
        setPrestamosActivos(prestamos);
        const descMap: Record<number, {checked: boolean; monto: number}> = {};
        for (const p of prestamos) {
          if (Number(p.saldoPendiente) > 0) {
            descMap[p.id] = { checked: true, monto: Number(p.saldoPendiente) };
          }
        }
        setDescuentosPrestamos(descMap);
      } catch {
        setPrestamosActivos([]);
        setDescuentosPrestamos({});
      } finally {
        setLoadingPrestamos(false);
      }

      // Fetch detailed registros for audit
      setAuditarLoading(true);
      try {
        const { data: regData } = await api.get(`/salones/${salonId}/registros`, {
          params: { usuarioId: emp.empleadaId, limit: 50 },
        });
        const allRegs = Array.isArray(regData?.data) ? regData.data : Array.isArray(regData) ? regData : [];
        const { firstDay, today } = getCurrentPeriod();
        setAuditarRegistros(allRegs.filter((r: any) => {
          if (r.estaPagadaEmpleada !== false) return false;
          if (!r.creadoEn) return true;
          const creado = new Date(r.creadoEn);
          return creado >= firstDay && creado <= today;
        }));
      } catch {
        setAuditarRegistros([]);
      } finally {
        setAuditarLoading(false);
      }
    }
  };

  const handleConfirmLiquidar = async () => {
    if (!selectedEmpleada) return;
    setAuditarError(null);
    const totalPagadoOverride = ajustarPago && motivoAjuste.length >= 10 ? pagoAjustado : undefined;
    const descuentos = Object.entries(descuentosPrestamos)
      .filter(([, v]) => v.checked && v.monto > 0)
      .map(([prestamoId, v]) => ({ prestamoId: Number(prestamoId), monto: v.monto }));
    try {
      await handleLiquidar(
        selectedEmpleada.empleadaId,
        totalPagadoOverride,
        descuentos.length > 0 ? descuentos : undefined,
      );
      // Solo cerrar modal si la liquidación fue exitosa
      setAuditarOpen(false);
      setSelectedEmpleada(null);
      setAjustarPago(false);
      setMotivoAjuste('');
      setDescuentosPrestamos({});
      setPrestamosActivos([]);
    } catch (err: any) {
      const msg = err?.message ?? err?.response?.data?.error?.message ?? 'Error al liquidar nómina';
      setAuditarError(msg);
    }
  };

  if (loading) {
    return (
      <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} height="72px" variant="rect" style={{ marginBottom: '0.75rem' }} />
        ))}
        <Skeleton height="160px" variant="rect" style={{ marginTop: '1.5rem' }} />
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div key="error" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={styles.emptyState}>
        <span className={styles.emptyIcon}>⚠️</span>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', color: 'var(--danger)', marginBottom: '1rem' }}>{error}</p>
        <Button variant="secondary" size="sm" onClick={fetchData}>Reintentar</Button>
      </motion.div>
    );
  }

  return (
    <motion.div key="nomina" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
      {/* ── Sub-tab Navigation ── */}
      <div style={{
        display: 'flex',
        gap: '0.25rem',
        marginBottom: '1rem',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '0.25rem',
        width: 'fit-content',
      }}>
        <button
          className={`${styles.tabBtn} ${nominaSubtab === 'pendientes' ? styles.tabActive : ''}`}
          onClick={() => setNominaSubtab('pendientes')}
        >
          Pendientes{' '}
          {pendientesFiltrados.length > 0 && (
            <span style={{
              marginLeft: '0.25rem',
              background: 'var(--accent)',
              color: 'var(--bg-root)',
              borderRadius: '999px',
              padding: '0.075rem 0.45rem',
              fontSize: '0.6875rem',
              fontWeight: 700,
            }}>
              {pendientesFiltrados.length}
            </span>
          )}
        </button>
        <button
          className={`${styles.tabBtn} ${nominaSubtab === 'historial' ? styles.tabActive : ''}`}
          onClick={() => setNominaSubtab('historial')}
        >
          Historial
        </button>
      </div>

      {nominaSubtab === 'pendientes' ? (
        /* ════════════════════════════════════════════════ */
        /*  PENDIENTES VIEW                                 */
        /* ════════════════════════════════════════════════ */
        <>
          {/* ── Summary cards ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.75rem',
            marginBottom: '1.25rem',
          }}>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>👩‍💼 Pendientes</span>
              <span className={styles.summaryValue}>
                {pendientesFiltrados.length} {pendientesFiltrados.length === 1 ? 'empleada' : 'empleadas'}
              </span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>💰 Total comisiones</span>
              <span className={styles.summaryValueAccent}>{formatCurrency(totalComisiones)}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>📅 Próximo pago estimado</span>
              <span className={styles.summaryValueAccent}>{formatCurrency(totalProximoPago)}</span>
            </div>
          </div>

          {/* ── Employee cards grid ── */}
          {pendientesFiltrados.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>✅</span>
              <h3 className={styles.emptyTitle}>Todo al día</h3>
              <p className={styles.emptySubtitle}>No hay comisiones pendientes por liquidar.</p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '1rem',
            }}>
              {pendientesFiltrados.map((emp) => (
                <motion.div
                  key={emp.empleadaId}
                  variants={itemVariants}
                  initial="hidden"
                  animate="show"
                  whileHover={{ borderColor: 'var(--border-glow)', boxShadow: 'var(--shadow-glow)' }}
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                  }}
                >
                  {/* Avatar + Name row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: 'var(--accent-subtle)',
                      color: 'var(--accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '1rem',
                      fontFamily: "'DM Sans', sans-serif",
                      flexShrink: 0,
                    }}>
                      {emp.nombre.charAt(0)}
                    </div>
                    <div>
                      <div style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                      }}>
                        {emp.nombre}
                      </div>
                      <div style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                      }}>
                        {emp.cantidadRegistros} servicios realizados
                      </div>
                    </div>
                  </div>

                  {/* Desglose */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      fontSize: '0.75rem', fontFamily: "'DM Sans', sans-serif",
                      color: 'var(--text-secondary)',
                    }}>
                      <span>Comisiones</span>
                      <span style={{ fontWeight: 600 }}>{formatCurrency(emp.totalComisionesPendientes)}</span>
                    </div>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      fontSize: '0.75rem', fontFamily: "'DM Sans', sans-serif",
                      color: 'var(--text-secondary)',
                    }}>
                      <span>Propinas</span>
                      <span style={{ fontWeight: 600, color: 'var(--success)' }}>{formatCurrency(emp.totalPropinas)}</span>
                    </div>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      fontSize: '0.75rem', fontFamily: "'DM Sans', sans-serif",
                      color: 'var(--text-secondary)',
                    }}>
                      <span>Bono horario</span>
                      <span style={{ fontWeight: 600 }}>{formatCurrency(emp.bonoHorario)}</span>
                    </div>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      fontSize: '0.75rem', fontFamily: "'DM Sans', sans-serif",
                      color: 'var(--text-secondary)',
                    }}>
                      <span>Sueldo fijo</span>
                      <span style={{ fontWeight: 600 }}>{formatCurrency(emp.sueldoFijo)}</span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div style={{ borderTop: '1px solid var(--border)', margin: '0.15rem 0' }} />

                  {/* Total + Action */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{
                        fontFamily: "'DM Sans', sans-serif", fontSize: '0.6875rem',
                        color: 'var(--text-dim)', textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}>
                        Total a pagar
                      </div>
                      <div style={{
                        fontFamily: "'DM Sans', sans-serif", fontSize: '1.125rem',
                        fontWeight: 700, color: 'var(--accent)',
                      }}>
                        {formatCurrency(emp.totalAPagar)}
                      </div>
                    </div>
                    <motion.button
                      style={{ ...primaryBtnStyle, padding: '0.4rem 0.85rem', fontSize: '0.75rem' }}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleAuditar(emp)}
                    >
                      Auditar y Liquidar
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </>
      ) : (
        /* ════════════════════════════════════════════════ */
        /*  HISTORIAL VIEW                                  */
        /* ════════════════════════════════════════════════ */
        <>
          {/* ── Filters ── */}
          <div style={{
            display: 'flex', gap: '0.75rem', alignItems: 'flex-end',
            flexWrap: 'wrap', marginBottom: '1rem',
          }}>
            <label style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem',
              color: 'var(--text-secondary)', fontWeight: 500,
            }}>
              Desde:
              <input
                type="date"
                className={styles.filterInput}
                style={{ display: 'block', marginTop: '0.2rem' }}
                value={historialDesde}
                onChange={(e) => setHistorialDesde(e.target.value)}
              />
            </label>
            <label style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem',
              color: 'var(--text-secondary)', fontWeight: 500,
            }}>
              Hasta:
              <input
                type="date"
                className={styles.filterInput}
                style={{ display: 'block', marginTop: '0.2rem' }}
                value={historialHasta}
                onChange={(e) => setHistorialHasta(e.target.value)}
              />
            </label>
            <label style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem',
              color: 'var(--text-secondary)', fontWeight: 500,
            }}>
              Empleada:
              <select
                className={styles.filterInput}
                style={{ display: 'block', marginTop: '0.2rem', minWidth: '140px' }}
                value={historialEmpleadaId}
                onChange={(e) => setHistorialEmpleadaId(e.target.value)}
              >
                <option value="">Todas</option>
                {Array.from(empleadasMap.entries())
                  .filter(([id]) => historial.some((h) => h.usuarioId === id))
                  .map(([id, name]) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
              </select>
            </label>
            <label style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem',
              color: 'var(--text-secondary)', fontWeight: 500,
            }}>
              Buscar:
              <input
                type="text"
                className={styles.filterInput}
                style={{ display: 'block', marginTop: '0.2rem', minWidth: '160px' }}
                value={historialSearch}
                onChange={(e) => setHistorialSearch(e.target.value)}
                placeholder="Nombre o ID..."
              />
            </label>
            {(historialDesde || historialHasta) && (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => { setHistorialDesde(''); setHistorialHasta(''); }}
                style={{
                  background: 'var(--bg-surface)',
                  color: 'var(--text-dim)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.35rem 0.7rem',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                }}
                title="Limpiar filtros de fecha"
              >
                ✕ Limpiar
              </motion.button>
            )}
          </div>

          {/* ── Total filtrado ── */}
          {filteredHistorial.length > 0 && (
            <div style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: '0.8125rem',
              color: 'var(--text-dim)', marginBottom: '0.75rem',
              display: 'flex', gap: '0.5rem', alignItems: 'center',
            }}>
              <span style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.6875rem' }}>
                Total filtrado:
              </span>
              <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '0.9375rem' }}>
                {formatCurrency(totalFiltrado)}
              </span>
            </div>
          )}

          {/* ── Table with scroll ── */}
          {filteredHistorial.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>📜</span>
              <h3 className={styles.emptyTitle}>Sin resultados</h3>
              <p className={styles.emptySubtitle}>
                {historial.length === 0
                  ? 'No hay liquidaciones registradas aún.'
                  : 'No se encontraron liquidaciones con esos filtros.'}
              </p>
            </div>
          ) : (
            <div style={{
              maxHeight: '400px',
              overflowY: 'auto',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
            }}>
              <div className={styles.tableWrapper} style={{ border: 'none' }}>
                <table className={styles.historialTable}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                    <tr>
                      <th>Empleada</th>
                      <th>Período</th>
                      <th>Comisiones</th>
                      <th>Propinas</th>
                      <th>Bono horario</th>
                      <th>Sueldo fijo</th>
                      <th>Total Pagado</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedHistorial.map((h, idx) => (
                      <motion.tr
                        key={h.id}
                        variants={itemVariants}
                        initial="hidden"
                        animate="show"
                        transition={{ delay: idx * 0.03 }}
                      >
                        <td style={{ fontWeight: 500 }}>
                          {empleadasMap.get(h.usuarioId) ?? `Empleada #${h.usuarioId}`}
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                          {formatDate(h.fechaDesde)} — {formatDate(h.fechaHasta)}
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{formatCurrency(h.totalComisiones)}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{formatCurrency(h.totalPropinas)}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{formatCurrency(h.bonoHorario)}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{formatCurrency(h.sueldoFijo)}</td>
                        <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{formatCurrency(h.totalPagado)}</td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{formatDate(h.creadoEn)}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Pagination controls ── */}
          {historialTotalPages > 1 && (
            <div style={{
              display: 'flex', justifyContent: 'center', gap: '0.5rem',
              marginTop: '1rem', alignItems: 'center',
            }}>
              <button
                disabled={historialPage <= 1}
                onClick={() => setHistorialPage((p) => p - 1)}
                style={{
                  fontSize: '0.8125rem', padding: '0.35rem 0.85rem',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-surface)', color: 'var(--text-primary)',
                  cursor: historialPage <= 1 ? 'not-allowed' : 'pointer',
                  opacity: historialPage <= 1 ? 0.5 : 1,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                ← Anterior
              </button>
              <span style={{
                fontSize: '0.8125rem', color: 'var(--text-secondary)',
                fontFamily: "'DM Sans', sans-serif",
              }}>
                Página {historialPage} de {historialTotalPages} ({filteredHistorial.length} registros)
              </span>
              <button
                disabled={historialPage >= historialTotalPages}
                onClick={() => setHistorialPage((p) => p + 1)}
                style={{
                  fontSize: '0.8125rem', padding: '0.35rem 0.85rem',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-surface)', color: 'var(--text-primary)',
                  cursor: historialPage >= historialTotalPages ? 'not-allowed' : 'pointer',
                  opacity: historialPage >= historialTotalPages ? 0.5 : 1,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Pre-liquidation Audit Modal ── */}
      <AnimatePresence>
        {auditarOpen && selectedEmpleada && (
          <motion.div
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setAuditarOpen(false);
                setSelectedEmpleada(null);
              }
            }}
          >
            <motion.div
              className={`${styles.modalContent} ${styles.modalContentXl}`}
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.25, ease: [0.22, 0.61, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <span className={styles.modalTitle}>Auditoría pre-liquidación</span>
                <button
                  className={styles.modalCloseBtn}
                  onClick={() => {
                    setAuditarOpen(false);
                    setSelectedEmpleada(null);
                  }}
                  aria-label="Cerrar"
                >
                  ✕
                </button>
              </div>

              <div className={styles.modalBody}>
                {/* ════════════════════════════════════════ */}
                {/*  SECTION 1 — Employee header + period   */}
                {/* ════════════════════════════════════════ */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '50%',
                    background: 'var(--accent-subtle)', color: 'var(--accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '1.125rem',
                    fontFamily: "'DM Sans', sans-serif", flexShrink: 0,
                  }}>
                    {selectedEmpleada.nombre.charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontFamily: "'DM Sans', sans-serif", fontSize: '1rem',
                      fontWeight: 600, color: 'var(--text-primary)',
                    }}>
                      {selectedEmpleada.nombre}
                    </div>
                    <div style={{
                      fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                    }}>
                      {(() => {
                        const d = new Date();
                        const fd = new Date(d.getFullYear(), d.getMonth(), 1);
                        return `${toISODate(fd)} — ${toISODate(d)}`;
                      })()}
                    </div>
                  </div>
                  <div style={{
                    background: 'var(--accent-subtle)', color: 'var(--accent)',
                    borderRadius: '999px', padding: '0.2rem 0.65rem',
                    fontSize: '0.6875rem', fontWeight: 700,
                    fontFamily: "'DM Sans', sans-serif",
                    whiteSpace: 'nowrap',
                  }}>
                    {auditarRegistros.length} registros
                  </div>
                </div>

                {/* ════════════════════════════════════════ */}
                {/*  SECTION 2 — Summary cards (4 cols)     */}
                {/* ════════════════════════════════════════ */}
                <motion.div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '0.625rem',
                    marginBottom: '1.25rem',
                  }}
                  variants={{
                    hidden: { opacity: 0 },
                    show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
                  }}
                  initial="hidden"
                  animate="show"
                >
                  {([
                    {
                      label: 'Comisiones', value: selectedEmpleada.totalComisionesPendientes,
                      emoji: '💰', color: 'var(--accent)', borderColor: 'var(--accent)',
                    },
                    {
                      label: 'Propinas', value: selectedEmpleada.totalPropinas,
                      emoji: '🎁', color: 'var(--success)', borderColor: 'var(--success)',
                    },
                    {
                      label: 'Bono + Sueldo', value: selectedEmpleada.bonoHorario + selectedEmpleada.sueldoFijo,
                      emoji: '⏰', color: '#818cf8', borderColor: '#818cf8',
                    },
                    {
                      label: 'Total bruto',
                      value: selectedEmpleada.totalComisionesPendientes + selectedEmpleada.totalPropinas + selectedEmpleada.bonoHorario + selectedEmpleada.sueldoFijo,
                      emoji: '🧾', color: 'var(--accent)', borderColor: 'var(--accent)', isTotal: true,
                    },
                  ]).map((card) => (
                    <motion.div
                      key={card.label}
                      variants={{
                        hidden: { opacity: 0, y: 12 },
                        show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 0.61, 0.36, 1] } },
                      }}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.2rem',
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        border: `1px solid ${card.isTotal ? 'var(--accent)' : 'var(--border)'}`,
                        borderLeft: `3px solid ${card.borderColor}`,
                        background: card.isTotal
                          ? 'linear-gradient(135deg, var(--accent-subtle), var(--bg-elevated))'
                          : 'var(--bg-elevated)',
                        transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.2s',
                      }}
                      whileHover={{
                        y: -2,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        transition: { duration: 0.2 },
                      }}
                    >
                      <div style={{ fontSize: '1.25rem', lineHeight: 1, marginBottom: '0.15rem' }}>
                        {card.emoji}
                      </div>
                      <div style={{
                        fontFamily: "'DM Sans', sans-serif", fontSize: '0.625rem',
                        fontWeight: 600, color: 'var(--text-dim)',
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                      }}>
                        {card.label}
                      </div>
                      <div style={{
                        fontFamily: "'DM Sans', sans-serif", fontSize: '0.9375rem',
                        fontWeight: 700, color: card.color, lineHeight: 1.2,
                      }}>
                        {formatCurrency(card.value)}
                      </div>
                    </motion.div>
                  ))}
                </motion.div>

                <hr className={styles.auditDivider} />

                {/* ════════════════════════════════════════ */}
                {/*  SECTION 3 — Detailed service records   */}
                {/* ════════════════════════════════════════ */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{
                    fontFamily: "'DM Sans', sans-serif", fontSize: '0.8125rem',
                    fontWeight: 700, color: 'var(--text-primary)',
                    marginBottom: '0.5rem',
                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                  }}>
                    📋 Detalle de servicios
                    {auditarLoading && (
                      <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', fontWeight: 400 }}>
                        Cargando detalle...
                      </span>
                    )}
                  </div>
                  {auditarLoading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {[1, 2, 3].map((i) => (
                        <div key={i} style={{
                          height: '72px',
                          background: 'var(--bg-elevated)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border)',
                          padding: '0.75rem',
                        }}>
                          <div style={{
                            width: '60%', height: '10px',
                            background: 'var(--bg-hover)',
                            borderRadius: '4px', marginBottom: '0.5rem',
                          }} />
                          <div style={{
                            width: '40%', height: '8px',
                            background: 'var(--bg-hover)',
                            borderRadius: '4px',
                          }} />
                        </div>
                      ))}
                    </div>
                  ) : auditarRegistros.length === 0 ? (
                    <div style={{
                      fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem',
                      color: 'var(--text-dim)', padding: '0.75rem 0',
                      textAlign: 'center',
                    }}>
                      No se encontraron registros detallados para este período.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                      {auditarRegistros.map((reg, idx) => {
                        const totalBrutoReg = (reg.montoTotal ?? reg.totalServicios ?? 0) + (reg.totalProductos ?? 0);
                        const hasProducts = reg.productosVendidos && reg.productosVendidos.length > 0;
                        return (
                          <motion.div
                            key={reg.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.03, duration: 0.2 }}
                            style={{
                              background: 'var(--bg-surface)',
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-md)',
                              padding: '0.75rem 1rem',
                              borderLeft: '4px solid var(--accent)',
                              position: 'relative',
                              transition: 'box-shadow 0.2s, transform 0.2s',
                            }}
                            whileHover={{
                              boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                              y: -1,
                              transition: { duration: 0.2 },
                            }}
                          >
                            {/* Header: index badge + service name + total */}
                            <div style={{
                              display: 'flex', justifyContent: 'space-between',
                              alignItems: 'flex-start', marginBottom: '0.4rem',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                  width: '22px', height: '22px', borderRadius: '50%',
                                  background: 'var(--accent-subtle)', color: 'var(--accent)',
                                  fontSize: '0.65rem', fontWeight: 700, flexShrink: 0,
                                  fontFamily: "'DM Sans', sans-serif",
                                }}>
                                  {idx + 1}
                                </span>
                                <span style={{
                                  fontFamily: "'DM Sans', sans-serif", fontSize: '0.8125rem',
                                  fontWeight: 600, color: 'var(--text-primary)',
                                }}>
                                  {reg.descripcionServicio ?? `Servicio #${reg.id}`}
                                </span>
                                {hasProducts && (
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
                                    background: 'rgba(212, 168, 83, 0.12)', color: 'var(--accent)',
                                    fontSize: '0.6rem', fontWeight: 700,
                                    padding: '0.1rem 0.45rem', borderRadius: '999px',
                                    fontFamily: "'DM Sans', sans-serif",
                                  }}>
                                    🏷️ Con productos
                                  </span>
                                )}
                              </div>
                              <div style={{
                                fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem',
                                fontWeight: 700, color: 'var(--accent)',
                              }}>
                                {formatCurrency(totalBrutoReg)}
                              </div>
                            </div>

                            {/* Metadata row: comisión, propina, badges */}
                            <div style={{
                              display: 'flex', gap: '1rem', flexWrap: 'wrap',
                              fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem',
                            }}>
                              <span style={{ color: 'var(--text-secondary)' }}>
                                Comisión:{' '}
                                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                  {formatCurrency(reg.comisionCalculada ?? 0)}
                                </span>
                              </span>
                              {reg.propina > 0 && (
                                <span style={{ color: 'var(--text-secondary)' }}>
                                  Propina:{' '}
                                  <span style={{ fontWeight: 700, color: 'var(--success)' }}>
                                    +{formatCurrency(reg.propina)}
                                  </span>
                                </span>
                              )}
                              {reg.esRetoque && (
                                <span style={{
                                  background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24',
                                  padding: '0.05rem 0.4rem', borderRadius: '999px',
                                  fontWeight: 600, fontSize: '0.625rem',
                                }}>
                                  Retoque
                                </span>
                              )}
                              {reg.porcentajeDescuento != null && reg.porcentajeDescuento > 0 && (
                                <span style={{
                                  background: 'rgba(239, 68, 68, 0.12)', color: 'var(--danger)',
                                  padding: '0.05rem 0.4rem', borderRadius: '999px',
                                  fontWeight: 600, fontSize: '0.625rem',
                                }}>
                                  -{reg.porcentajeDescuento}% desc.
                                </span>
                              )}
                            </div>

                            {/* Products sub-list with distinct background */}
                            {hasProducts && (
                              <div style={{
                                marginTop: '0.5rem',
                                padding: '0.5rem 0.6rem',
                                background: 'var(--bg-elevated)',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--border)',
                              }}>
                                <div style={{
                                  fontFamily: "'DM Sans', sans-serif", fontSize: '0.625rem',
                                  fontWeight: 600, color: 'var(--text-secondary)',
                                  textTransform: 'uppercase', letterSpacing: '0.04em',
                                  marginBottom: '0.25rem',
                                }}>
                                  🛍️ Productos
                                </div>
                                {reg.productosVendidos?.map((pv) => (
                                  <div key={pv.id} style={{
                                    display: 'flex', justifyContent: 'space-between',
                                    fontSize: '0.6875rem', fontFamily: "'DM Sans', sans-serif",
                                    color: 'var(--text-secondary)',
                                    padding: '0.1rem 0',
                                  }}>
                                    <span>
                                      {pv.nombre}{' '}
                                      <span style={{ color: 'var(--text-dim)' }}>×{pv.cantidad}</span>
                                    </span>
                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                      {formatCurrency(pv.subtotal)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <hr className={styles.auditDivider} />

                {/* ════════════════════════════════════════ */}
                {/*  SECTION 4 — Loan deductions (existing) */}
                {/* ════════════════════════════════════════ */}
                {loadingPrestamos ? (
                  <div style={{ padding: '0.5rem 0', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    Cargando préstamos activos...
                  </div>
                ) : prestamosActivos.length > 0 ? (
                  <div style={{
                    borderTop: '1px solid var(--border)',
                    marginTop: '0.75rem',
                    paddingTop: '0.75rem',
                    marginBottom: '0.75rem',
                  }}>
                    <div style={{
                      fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem',
                      fontWeight: 600, color: 'var(--text-primary)',
                      marginBottom: '0.5rem',
                    }}>
                      💳 Descuentos por préstamo
                    </div>
                    {prestamosActivos.map((p) => {
                      const desc = descuentosPrestamos[p.id] ?? { checked: true, monto: Number(p.saldoPendiente) };
                      return (
                        <div
                          key={p.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            padding: '0.35rem 0', borderBottom: '1px solid var(--border)',
                            fontSize: '0.75rem', fontFamily: "'DM Sans', sans-serif",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={desc.checked}
                            onChange={(e) => setDescuentosPrestamos((prev) => ({
                              ...prev,
                              [p.id]: { ...prev[p.id] ?? { monto: Number(p.saldoPendiente) }, checked: e.target.checked },
                            }))}
                          />
                          <span style={{ flex: 1, color: 'var(--text-secondary)' }}>
                            {p.motivo ?? `Préstamo #${p.id}`}
                          </span>
                          <span style={{ color: 'var(--text-dim)', marginRight: '0.5rem' }}>
                            Saldo: ${Number(p.saldoPendiente).toLocaleString()}
                          </span>
                          <input
                            type="number"
                            className={styles.noSpinner}
                            value={desc.monto}
                            onChange={(e) => setDescuentosPrestamos((prev) => ({
                              ...prev,
                              [p.id]: { ...prev[p.id] ?? { checked: true }, monto: Math.max(0, Number(e.target.value)) },
                            }))}
                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                            style={{
                              width: '90px',
                              padding: '0.2rem 0.4rem',
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-sm)',
                              background: 'var(--bg-root)',
                              color: 'var(--text-primary)',
                              fontSize: '0.75rem',
                              textAlign: 'right',
                            }}
                            min="0"
                            step="0.01"
                          />
                        </div>
                      );
                    })}
                    {Object.values(descuentosPrestamos).some((d) => d.checked && d.monto > 0) && (
                      <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        padding: '0.4rem 0', fontSize: '0.8125rem',
                        fontFamily: "'DM Sans', sans-serif",
                        color: 'var(--danger)',
                      }}>
                        <span style={{ fontWeight: 600 }}>Total a descontar</span>
                        <span style={{ fontWeight: 700 }}>
                          -{formatCurrency(
                            Object.entries(descuentosPrestamos)
                              .filter(([, v]) => v.checked)
                              .reduce((s, [, v]) => s + v.monto, 0)
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                ) : null}

                {/* ════════════════════════════════════════ */}
                {/*  SECTION 5 — Total (Bruto - Desc = Neto)*/}
                {/* ════════════════════════════════════════ */}
                <div style={{
                  borderTop: '1px solid var(--border)', paddingTop: '0.85rem',
                  marginTop: '1.25rem',
                }}>
                  {/* Comisiones */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    fontFamily: "'DM Sans', sans-serif", fontSize: '0.8125rem',
                    color: 'var(--text-secondary)', padding: '0.2rem 0',
                  }}>
                    <span>Comisiones</span>
                    <span>{formatCurrency(selectedEmpleada.totalComisionesPendientes)}</span>
                  </div>
                  {/* Propinas */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    fontFamily: "'DM Sans', sans-serif", fontSize: '0.8125rem',
                    color: 'var(--text-secondary)', padding: '0.2rem 0',
                  }}>
                    <span>Propinas</span>
                    <span>{formatCurrency(selectedEmpleada.totalPropinas)}</span>
                  </div>
                  {/* Bono + Sueldo */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    fontFamily: "'DM Sans', sans-serif", fontSize: '0.8125rem',
                    color: 'var(--text-secondary)', padding: '0.2rem 0',
                  }}>
                    <span>Bono + Sueldo</span>
                    <span>{formatCurrency(selectedEmpleada.bonoHorario + selectedEmpleada.sueldoFijo)}</span>
                  </div>
                  {/* ─── Divider ─── */}
                  <hr style={{
                    border: 'none', borderTop: '1px solid var(--border)',
                    margin: '0.35rem 0',
                  }} />
                  {/* SUBTOTAL */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    fontFamily: "'DM Sans', sans-serif", fontSize: '0.8125rem',
                    color: 'var(--text-primary)', padding: '0.2rem 0',
                    fontWeight: 500,
                  }}>
                    <span>SUBTOTAL</span>
                    <span>{formatCurrency(selectedEmpleada.totalAPagar)}</span>
                  </div>
                  {/* Descuentos line (conditional) */}
                  {Object.values(descuentosPrestamos).some((d) => d.checked && d.monto > 0) && (
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      fontFamily: "'DM Sans', sans-serif", fontSize: '0.8125rem',
                      color: 'var(--danger)', padding: '0.2rem 0',
                    }}>
                      <span>Descuentos</span>
                      <span>
                        -{formatCurrency(
                          Object.entries(descuentosPrestamos)
                            .filter(([, v]) => v.checked)
                            .reduce((s, [, v]) => s + v.monto, 0)
                        )}
                      </span>
                    </div>
                  )}
                  {/* ─── Divider ─── */}
                  <hr style={{
                    border: 'none', borderTop: '1px solid var(--border)',
                    margin: '0.35rem 0',
                  }} />
                  {/* Neto a pagar */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', padding: '0.4rem 0 0',
                  }}>
                    <span style={{
                      fontFamily: "'DM Sans', sans-serif", fontSize: '0.9375rem',
                      fontWeight: 700, color: 'var(--text-primary)',
                    }}>
                      NETO A PAGAR
                    </span>
                    <span style={{
                      fontFamily: "'DM Sans', sans-serif", fontSize: '1.5rem',
                      fontWeight: 700, color: 'var(--accent)',
                    }}>
                      {((): string => {
                        const base = ajustarPago ? pagoAjustado : selectedEmpleada.totalAPagar;
                        const descuento = Object.entries(descuentosPrestamos)
                          .filter(([, v]) => v.checked)
                          .reduce((s, [, v]) => s + v.monto, 0);
                        return formatCurrency(Math.max(0, base - descuento));
                      })()}
                    </span>
                  </div>
                </div>

                {/* ════════════════════════════════════════ */}
                {/*  SECTION 6 — Payment adj. (existing)    */}
                {/* ════════════════════════════════════════ */}
                <div style={{
                  borderTop: '1px solid var(--border)',
                  marginTop: '0.75rem',
                  paddingTop: '0.75rem',
                }}>
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    fontFamily: "'DM Sans', sans-serif", fontSize: '0.8125rem',
                    color: 'var(--text-secondary)', cursor: 'pointer',
                    marginBottom: '0.5rem',
                  }}>
                    <input
                      type="checkbox"
                      checked={ajustarPago}
                      onChange={(e) => {
                        setAjustarPago(e.target.checked);
                        if (e.target.checked) {
                          setPagoAjustado(selectedEmpleada.totalAPagar);
                        }
                      }}
                    />
                    Ajustar monto a pagar
                  </label>
                  {ajustarPago && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      transition={{ duration: 0.2 }}
                      style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
                    >
                      <div>
                        <label style={{
                          fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem',
                          color: 'var(--text-secondary)', fontWeight: 500,
                          display: 'block', marginBottom: '0.2rem',
                        }}>
                          Nuevo monto a pagar
                        </label>
                        <input
                          type="number"
                          className={styles.formInput}
                          value={pagoAjustado}
                          onChange={(e) => setPagoAjustado(Math.max(0, Number(e.target.value)))}
                          onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          min="0"
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div>
                        <label style={{
                          fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem',
                          color: 'var(--text-secondary)', fontWeight: 500,
                          display: 'block', marginBottom: '0.2rem',
                        }}>
                          Motivo del ajuste <span style={{ color: 'var(--danger)' }}>*</span>
                        </label>
                        <textarea
                          className={styles.formTextarea}
                          value={motivoAjuste}
                          onChange={(e) => setMotivoAjuste(e.target.value)}
                          placeholder="Explicá el motivo del ajuste (mín. 10 caracteres)"
                          rows={2}
                          style={{ width: '100%' }}
                        />
                        {motivoAjuste.length > 0 && motivoAjuste.length < 10 && (
                          <span style={{
                            fontFamily: "'DM Sans', sans-serif", fontSize: '0.6875rem',
                            color: 'var(--danger)',
                          }}>
                            Mínimo 10 caracteres ({motivoAjuste.length}/10)
                          </span>
                        )}
                      </div>
                      <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        fontFamily: "'DM Sans', sans-serif", fontSize: '0.8125rem',
                        padding: '0.5rem', background: 'var(--accent-subtle)',
                        borderRadius: 'var(--radius-sm)',
                      }}>
                        <span style={{ fontWeight: 600 }}>Total ajustado</span>
                        <span style={{ fontWeight: 700, color: 'var(--accent)' }}>
                          {formatCurrency(pagoAjustado)}
                        </span>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>

              {auditarError && (
                <div style={{
                  margin: '0 1.5rem 0.75rem',
                  padding: '0.65rem 1rem',
                  background: 'rgba(239,68,68,0.08)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--danger, #ef4444)',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '0.8125rem',
                  color: 'var(--danger, #ef4444)',
                }}>
                  {auditarError}
                </div>
              )}

              <div className={styles.auditModalFooter}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAuditarOpen(false);
                    setSelectedEmpleada(null);
                    setAjustarPago(false);
                    setMotivoAjuste('');
                  }}
                >
                  Cancelar
                </Button>
                <motion.button
                  style={{
                    ...primaryBtnStyle,
                    padding: '0.6rem 1.5rem',
                    fontSize: '0.875rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    boxShadow: submittingId === selectedEmpleada.empleadaId
                      ? 'none'
                      : '0 2px 16px rgba(212,168,83,0.35)',
                  }}
                  whileHover={submittingId === selectedEmpleada.empleadaId ? {} : {
                    scale: 1.03,
                    boxShadow: '0 4px 24px rgba(212,168,83,0.5)',
                  }}
                  whileTap={{ scale: 0.97 }}
                  disabled={submittingId === selectedEmpleada.empleadaId || (ajustarPago && motivoAjuste.length < 10)}
                  onClick={handleConfirmLiquidar}
                >
                  {submittingId === selectedEmpleada.empleadaId
                    ? '⏳ Liquidando...'
                    : '✅ Confirmar liquidación'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

/* ================================================================ */
/*  REPORTES TAB                                                     */
/* ================================================================ */

const ReportesTab: React.FC<{ salonId: number | null }> = ({ salonId }) => {
  const today = useMemo(() => new Date(), []);
  const [reporteDesde, setReporteDesde] = useState(toISODate(today));
  const [reporteHasta, setReporteHasta] = useState(toISODate(today));
  const [mes, setMes] = useState(getMonthISO(today));

  const [resumen, setResumen] = useState<FinanzasResumen | null>(null);
  const [roi, setRoi] = useState<ROIData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchResumen = useCallback(async () => {
    if (!salonId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/salones/${salonId}/finanzas/resumen`, { params: { fecha: reporteDesde } });
      setResumen(data);
    } catch {
      setResumen(null);
    } finally {
      setLoading(false);
    }
  }, [salonId, reporteDesde]);

  const fetchROI = useCallback(async () => {
    if (!salonId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/salones/${salonId}/finanzas/roi`, { params: { mes } });
      setRoi(data);
    } catch {
      setRoi(null);
    } finally {
      setLoading(false);
    }
  }, [salonId, mes]);

  useEffect(() => {
    fetchResumen();
  }, [fetchResumen]);

  useEffect(() => {
    fetchROI();
  }, [fetchROI]);

  const gastosTotales = useMemo(() => {
    if (!roi) return 0;
    return (roi.gastosFijos ?? 0) + (roi.gastosOperativos ?? 0) + (roi.nomina ?? 0);
  }, [roi]);

  const roiPorcentaje = useMemo(() => {
    if (!roi) return 0;
    if (roi.gananciaNeta > 0 && gastosTotales > 0) {
      return Number(((roi.gananciaNeta / gastosTotales) * 100).toFixed(1));
    }
    return 0;
  }, [roi, gastosTotales]);

  if (loading && !resumen && !roi) {
    return (
      <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Skeleton height="60px" variant="rect" style={{ marginBottom: '1rem' }} />
        <Skeleton height="200px" variant="rect" />
      </motion.div>
    );
  }

  if (error && !resumen && !roi) {
    return (
      <motion.div key="error" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={styles.emptyState}>
        <span className={styles.emptyIcon}>⚠️</span>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', color: 'var(--danger)', marginBottom: '1rem' }}>{error}</p>
        <Button variant="secondary" size="sm" onClick={() => { fetchResumen(); fetchROI(); }}>Reintentar</Button>
      </motion.div>
    );
  }

  return (
    <motion.div key="reportes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
      {/* ── Filters ── */}
      <div className={styles.reporteCard}>
        <h4 className={styles.reporteCardTitle}>📊 Resumen del período</h4>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            Desde:
            <input
              type="date"
              className={styles.filterInput}
              style={{ display: 'block', marginTop: '0.2rem' }}
              value={reporteDesde}
              onChange={(e) => setReporteDesde(e.target.value)}
            />
          </label>
          <label style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            Hasta:
            <input
              type="date"
              className={styles.filterInput}
              style={{ display: 'block', marginTop: '0.2rem' }}
              value={reporteHasta}
              onChange={(e) => setReporteHasta(e.target.value)}
            />
          </label>
          <motion.button
            style={primaryBtnStyle}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={fetchResumen}
          >
            Generar reporte
          </motion.button>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginLeft: 'auto' }}>
            <span className={styles.filterLabel}>ROI mensual:</span>
            <input
              type="month"
              className={styles.filterInput}
              value={mes}
              onChange={(e) => setMes(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ── Resumen del período ── */}
      {resumen && (
        <div className={styles.reporteCard}>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard} style={{ borderColor: 'rgba(99,102,241,0.3)' }}>
              <span className={styles.summaryLabel}>💇 Servicios</span>
              <span className={styles.summaryValue} style={{ color: '#818cf8' }}>{formatCurrency(resumen.totalServicios)}</span>
            </div>
            <div className={styles.summaryCard} style={{ borderColor: 'rgba(52,211,153,0.3)' }}>
              <span className={styles.summaryLabel}>🛒 Productos</span>
              <span className={styles.summaryValue} style={{ color: '#34d399' }}>{formatCurrency(resumen.totalProductos)}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>💰 Ingresos totales</span>
              <span className={styles.summaryValueAccent}>{formatCurrency(resumen.totalIngresos)}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>💸 Gastos</span>
              <span className={styles.summaryValue} style={{ color: 'var(--danger)' }}>
                {resumen.totalGastos != null ? formatCurrency(resumen.totalGastos) : '$0'}
              </span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>👥 Nómina</span>
              <span className={styles.summaryValue}>{formatCurrency(resumen.totalComisiones)}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>🎁 Propinas</span>
              <span className={styles.summaryValueSuccess}>{formatCurrency(resumen.totalPropinas)}</span>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0.75rem 0' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className={styles.summaryCard} style={{ gridColumn: '1 / -1' }}>
              <span className={styles.summaryLabel}>📊 Ganancia neta</span>
              <span className={styles.summaryValue} style={{ color: 'var(--success)' }}>
                {formatCurrency(resumen.totalIngresos - (resumen.totalGastos ?? 0))}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── ROI Mensual ── */}
      {roi && (
        <div className={styles.reporteCard}>
          <h4 className={styles.reporteCardTitle}>📈 ROI Mensual — {mes}</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>💰 Ingresos</span>
              <span className={styles.summaryValueAccent}>{formatCurrency(roi.ingresos ?? 0)}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>💸 Gastos fijos</span>
              <span className={styles.summaryValue} style={{ color: 'var(--danger)' }}>{formatCurrency(roi.gastosFijos ?? 0)}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>📦 Gastos operativos</span>
              <span className={styles.summaryValue} style={{ color: 'var(--danger)' }}>{formatCurrency(roi.gastosOperativos ?? 0)}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>👥 Nómina</span>
              <span className={styles.summaryValue} style={{ color: 'var(--danger)' }}>{formatCurrency(roi.nomina ?? 0)}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>💸 Gastos totales</span>
              <span className={styles.summaryValue} style={{ color: 'var(--danger)' }}>{formatCurrency(gastosTotales)}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>📊 Ganancia neta</span>
              <span className={styles.summaryValue} style={{ color: (roi.gananciaNeta ?? 0) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {formatCurrency(roi.gananciaNeta ?? 0)}
              </span>
            </div>
            <div className={styles.summaryCard} style={{ gridColumn: '1 / -1' }}>
              <span className={styles.summaryLabel}>📈 ROI</span>
              <span className={styles.summaryValue} style={{ color: roiPorcentaje >= 0 ? 'var(--success)' : 'var(--danger)', fontSize: '1.5rem' }}>
                {roiPorcentaje >= 0 ? '+' : ''}{roiPorcentaje}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── No data state ── */}
      {!resumen && !roi && (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>📊</span>
          <h3 className={styles.emptyTitle}>Sin datos disponibles</h3>
          <p className={styles.emptySubtitle}>
            No hay información financiera para los filtros seleccionados. Cambiá la fecha o mes para ver otros períodos.
          </p>
        </div>
      )}
    </motion.div>
  );
};

export default FinanzasPage;
