import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Button, Skeleton } from '@pos-final/ui';
import { Rol, type IUser } from '@pos-final/types';
import api from '../services/api.js';
import SalonSwitcher from '../components/SalonSwitcher.js';
import WalkInModal from '../components/WalkInModal.js';
import ClienteSearchableSelect from '../components/ClienteSearchableSelect.js';
import EmpleadaSearchableSelect from '../components/EmpleadaSearchableSelect.js';
import CajaBanner from '../components/caja/CajaBanner.js';
import CajaTab from '../components/caja/CajaTab.js';
import MoneyInput from '../components/MoneyInput.js';
import PaginationBar from '../components/PaginationBar.js';
import TableSkeleton from '../components/TableSkeleton.js';
import { extractApiErrorMessage } from '../utils/apiErrors.js';
import { formatCurrency } from '../utils/format.js';
import styles from './FinanzasPage.module.css';

/* ================================================================ */
/*  TYPES                                                            */
/* ================================================================ */

interface FinanzasResumen {
  totalServicios: number;
  totalProductos: number;
  totalPropinas: number;
  totalComisiones: number;
  totalCostoBaseInsumos: number;
  cantidadAtenciones: number;
  cantidadProductosVendidos: number;
  totalIngresos: number;
  totalGastos?: number;
  balanceNeto?: number;
  /** PR2 — cash: Σ pagos recibidos en el período (fecha de recepción, no ANULADO). */
  totalCobrado?: number;
  /** PR2 — Σ montoPendiente de registros NO ANULADO del período (fiado originado). */
  totalFiadoDia?: number;
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

interface ServicioItemDTO {
  id: number;
  servicioId: number;
  nombreServicio: string;
  precioServicio: number;
  costoBaseInsumos?: number;
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
  estado?: string;
  notas?: string;
  precioAjustado?: boolean;
  porcentajeDescuento?: number;
  valorOriginal?: number;
  valorFinal?: number;
  /** Fecha de negocio (PR1): el DTO la expone con fallback a creadoEn; la UI usa fechaHora ?? creadoEn */
  fechaHora?: string;
  creadoEn: string;
  actualizadoEn: string;
  /** Caja del día del registro: id + si sigue abierta (regla de anulación). */
  cajaId?: number | null;
  cajaAbierta?: boolean | null;
  pagos: Pago[];
  divisiones: Division[];
  productosVendidos?: ProductoVendido[];
  serviciosItems?: ServicioItemDTO[];
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
  sueldoFijoMensual?: number;
  porcentajeComisionServicio: number;
  totalAPagar: number;
  cantidadRegistros: number;
  periodoInicio: string;
  periodoFin: string;
  frecuenciaPago: string;
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

interface PyLData {
  desde: string;
  hasta: string;
  cantidadAtenciones: number;
  ingresosBrutos: number;
  descuentos: number;
  /** Ajustes de valor hacia ARRIBA (cobrar más que el precio del servicio). */
  incrementos?: number;
  ingresosNetos: number;
  totalServicios: number;
  totalProductos: number;
  propinas: number;
  costoBaseInsumos: number;
  margenBruto: number;
  comisiones: number;
  gastosFijos: number;
  gastosOperativos: number;
  gastosPorCategoria: Record<string, number>;
  totalGastos: number;
  devoluciones: number;
  utilidadNeta: number;
  /** PR2 — cash: Σ pagos recibidos en el período (fecha de recepción, no ANULADO). */
  cobrado?: number;
  /** PR2 — Σ montoPendiente de registros NO ANULADO del período (fiado originado). */
  fiadoPeriodo?: number;
  /** PR2 — Σ montoPendiente de registros NO ANULADO con fecha de negocio ≤ hasta. */
  deudasPorCobrar?: number;
}

interface CuentaCobrar {
  id: number;
  tipo: 'CLIENTE' | 'PRESTAMO';
  nombre: string;
  deudaTotal: number;
  cantidadRegistros: number | null;
  antiguedadDias: number;
  antiguedadBucket: string;
  /** Desglose por registro (PR1): ordenado por fecha ASC, null para PRESTAMO. */
  registros?: Array<{
    registroId: number;
    fechaHora: string;
    montoPendiente: number;
  }> | null;
}

interface CuentaPagar {
  empleadaId: number;
  nombre: string;
  sueldoFijo: number;
  porcentajeComisionServicio: number;
  pendienteActual: number;
  liquidadoAcumulado: number;
  alDia?: boolean;
}

type TabKey = 'registros' | 'gastos' | 'devoluciones' | 'nomina' | 'reportes' | 'caja' | 'cuentas';

/* ================================================================ */
/*  CONSTANTS                                                        */
/* ================================================================ */



const TABS: { key: TabKey; label: string }[] = [
  { key: 'registros', label: '📋 Registros' },
  { key: 'gastos', label: '💸 Gastos' },
  { key: 'devoluciones', label: '↩️ Devoluciones' },
  { key: 'nomina', label: '👩‍💼 Nómina' },
  { key: 'reportes', label: '📊 Reportes' },
  { key: 'caja', label: '💰 Caja' },
  { key: 'cuentas', label: '💳 Cuentas' },
];

/* ── Tab Cuentas: roles con acceso (misma lista que requireRole del backend) ── */
const ROLES_CUENTAS: Rol[] = [Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR, Rol.CONTADOR];

function puedeVerCuentas(user: IUser | null | undefined): boolean {
  return !!user && ROLES_CUENTAS.includes(user.rol);
}

/**
 * Acceso por tab según rol:
 * - RECEPCIONISTA: solo Registros y Caja (front desk; sin nómina/cuentas/reportes/gastos).
 * - CONTADOR: todos salvo Caja (la caja es operativa, no contable).
 * - ADMIN/DUEÑA/SUPERADMIN: todos (Cuentas adicionalmente gated por puedeVerCuentas).
 */
function puedeVerTab(user: IUser | null | undefined, tabKey: TabKey): boolean {
  if (!user) return false;
  if (user.rol === Rol.RECEPCIONISTA) {
    return tabKey === 'registros' || tabKey === 'caja';
  }
  if (user.rol === Rol.CONTADOR) {
    return tabKey !== 'caja';
  }
  return tabKey !== 'cuentas' || puedeVerCuentas(user);
}

const CUENTAS_PAGE_SIZE = 12;
const CUENTAS_META_VACIO = { page: 1, limit: CUENTAS_PAGE_SIZE, total: 0, totalPages: 0 };

/* Etiquetas legibles para el bucket de antigüedad devuelto por la API. */
const ANTIGUEDAD_LABELS: Record<string, string> = {
  '0-30': '0-30 días',
  '31-60': '31-60 días',
  '61-90': '61-90 días',
  '90+': 'Más de 90 días',
};

function antiguedadLabel(bucket: string): string {
  return ANTIGUEDAD_LABELS[bucket] ?? bucket;
}

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

/** Formato yyyy-mm-dd (fecha local) para tablas y reportes. */
function formatDateYMD(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${year}-${month}-${day}`;
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
  // Usar UTC para coincidir con el backend que opera en UTC (bordes Colombia ya
  // vienen como instantes UTC; addDaysInput/periodoDayInput los manejan).
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Primer día del mes de una fecha, como 'YYYY-MM-DD'. */
function firstOfMonthISO(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

/**
 * Fecha de HOY en Colombia (UTC-5) como 'YYYY-MM-DD'. A las 23:30 COT del 31/08,
 * UTC ya es 01/09 — la UI debe mostrar el 31/08 (día de negocio Colombia).
 */
function colombiaTodayISO(): string {
  return toISODate(new Date(Date.now() - 5 * 3_600_000));
}

/** Primer día del mes ACTUAL en Colombia (UTC-5). */
function firstOfMonthColombiaISO(): string {
  const hoy = new Date(Date.now() - 5 * 3_600_000);
  const y = hoy.getUTCFullYear();
  const m = String(hoy.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

/** Suma/resta días a una fecha 'YYYY-MM-DD' (maneja cruce de mes/año). */
function addDaysInput(fecha: string, delta: number): string {
  const [year, month, day] = fecha.split('-').map(Number);
  return toISODate(new Date(Date.UTC(year, month - 1, day + delta)));
}

/**
 * Convierte una fecha de período del backend (ISO UTC, borde Colombia) a 'YYYY-MM-DD'
 * en día de Colombia. El fin de período es EXCLUSIVO (colombiaDayEndUTC = 05:00 UTC del
 * día siguiente): `exclusivo` resta un día para mostrarlo como día inclusivo.
 */
function periodoDayInput(iso?: string, exclusivo = false): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const ms = d.getTime() - 5 * 3_600_000 - (exclusivo ? 24 * 3_600_000 : 0);
  return toISODate(new Date(ms));
}

/**
 * Formatea una fecha de período de nómina a dd/mm/yyyy en día de Colombia (UTC-5).
 * El backend envía el fin de período como límite EXCLUSIVO (colombiaDayEndUTC =
 * 05:00 UTC del día siguiente): para mostrarlo como día inclusivo, `esFin` resta un día.
 */
function formatPeriodoFecha(iso?: string, esFin = false): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const ms = d.getTime() - 5 * 3_600_000 - (esFin ? 24 * 3_600_000 : 0);
  const cot = new Date(ms);
  const y = cot.getUTCFullYear();
  const m = String(cot.getUTCMonth() + 1).padStart(2, '0');
  const day = String(cot.getUTCDate()).padStart(2, '0');
  return `${day}/${m}/${y}`;
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
  const [searchParams] = useSearchParams();

  /* ── Auth state ── */
  const [user, setUser] = useState<IUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  /* ── Tab state (soporta ?tab=caja desde CajaBanner de otras páginas) ── */
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<TabKey>(tabParam === 'caja' ? 'caja' : 'registros');

  // Si el rol no puede ver el tab activo (p.ej. ?tab=caja para CONTADOR), cae a Registros
  useEffect(() => {
    if (!authLoading && user && !puedeVerTab(user, activeTab)) {
      setActiveTab('registros');
    }
  }, [authLoading, user, activeTab]);

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

      {/* CajaBanner: estado de caja global — solo visible dentro del tab Caja */}
      {activeTab === 'caja' && (
        <CajaBanner salonId={salonId} user={user} onNavigateToCaja={() => setActiveTab('caja')} />
      )}

      {/* ── Tab Navigation ── */}
      <div className={styles.tabsRow}>
        {TABS.filter((tab) => puedeVerTab(user, tab.key)).map((tab) => (
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
        {activeTab === 'registros' && puedeVerTab(user, 'registros') && (
          <RegistrosTab
            key="registros"
            salonId={salonId}
            user={user}
            onNavigateToCaja={() => setActiveTab('caja')}
          />
        )}
        {activeTab === 'gastos' && puedeVerTab(user, 'gastos') && (
          <GastosTab key="gastos" salonId={salonId} />
        )}
        {activeTab === 'devoluciones' && puedeVerTab(user, 'devoluciones') && (
          <DevolucionesTab key="devoluciones" salonId={salonId} />
        )}
        {activeTab === 'nomina' && puedeVerTab(user, 'nomina') && (
          <NominaTab key="nomina" salonId={salonId} />
        )}
        {activeTab === 'reportes' && puedeVerTab(user, 'reportes') && (
          <ReportesTab key="reportes" salonId={salonId} user={user} />
        )}
        {activeTab === 'caja' && puedeVerTab(user, 'caja') && (
          <CajaTab key="caja" salonId={salonId} user={user} />
        )}
        {activeTab === 'cuentas' && puedeVerTab(user, 'cuentas') && (
          <CuentasTab key="cuentas" salonId={salonId} />
        )}
      </AnimatePresence>
    </>
  );
};

/* ================================================================ */
/*  REGISTROS TAB                                                    */
/* ================================================================ */

interface RegistrosTabProps {
  salonId: number | null;
  user: IUser | null;
  /** CAJA_CERRADA en WalkInModal: cambia al tab Caja de FinanzasPage */
  onNavigateToCaja?: () => void;
}

/** Regla del dueño: no se puede anular un registro si la caja de su día está
 *  CERRADA (cajaAbierta === false explícito). Registros legacy sin caja
 *  (cajaId/cajaAbierta null) y cajas abiertas permiten anular. */
function cajaCerradaAnular(reg: Registro): boolean {
  return reg.cajaAbierta === false;
}

const RegistrosTab: React.FC<RegistrosTabProps> = ({ salonId, user, onNavigateToCaja }) => {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [resumen, setResumen] = useState<FinanzasResumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedRegistro, setSelectedRegistro] = useState<Registro | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [anularOpen, setAnularOpen] = useState(false);
  const [anularError, setAnularError] = useState<string | null>(null);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isPrivileged = !!user && (
    user.rol === Rol.SUPERADMIN ||
    user.rol === Rol.DUEÑA ||
    user.rol === Rol.ADMINISTRADOR ||
    user.rol === Rol.CONTADOR
  );

  const todayStr = useMemo(() => colombiaTodayISO(), []);
  // Default del rango: mes actual (1° del mes → hoy), consistente con Reportes.
  // Con filtros vacíos el resumen devuelve 0 aunque la tabla tenga registros.
  const [registroDesde, setRegistroDesde] = useState(firstOfMonthColombiaISO());
  const [registroHasta, setRegistroHasta] = useState(colombiaTodayISO());
  const [registroFilter, setRegistroFilter] = useState<'TODOS' | 'SERVICIOS' | 'PRODUCTOS'>('TODOS');
  // Filtro por estado: default Activos al ingresar a la página (los anulados se ocultan)
  const [registroEstadoFilter, setRegistroEstadoFilter] = useState<'ACTIVOS' | 'ANULADOS' | 'TODOS'>('ACTIVOS');
  const [registroPage, setRegistroPage] = useState(1);
  const [registroMeta, setRegistroMeta] = useState({ page: 1, limit: 12, total: 0, totalPages: 0 });
  // Role-scoped filters: only privileged roles (dueña/admin/contador/superadmin) can filter by empleada/cliente
  const [registroUsuarioId, setRegistroUsuarioId] = useState('');
  const [registroClienteId, setRegistroClienteId] = useState('');
  // Resolved names for the summary title (kept in sync with the comboboxes)
  const [registroEmpleadaNombre, setRegistroEmpleadaNombre] = useState('');
  const [registroClienteNombre, setRegistroClienteNombre] = useState('');

  const filteredRegistros = useMemo(() => {
    const estadoOk = (r: Registro) =>
      registroEstadoFilter === 'TODOS' ? true : registroEstadoFilter === 'ACTIVOS' ? r.estado !== 'ANULADO' : r.estado === 'ANULADO';
    const tipoOk = (r: Registro) =>
      registroFilter === 'TODOS' ? true : registroFilter === 'SERVICIOS' ? r.totalServicios > 0 : r.totalProductos > 0;
    return registros.filter((r) => estadoOk(r) && tipoOk(r));
  }, [registros, registroFilter, registroEstadoFilter]);

  const fetchData = useCallback(async () => {
    // Rango incompleto: no buscar ni mostrar loading hasta tener desde Y hasta
    if ((registroDesde && !registroHasta) || (!registroDesde && registroHasta)) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const regParams: Record<string, string> = { page: String(registroPage), limit: '12' };
      // Rango de fechas solo aplica cuando AMBAS fechas están completas
      if (registroDesde && registroHasta) {
        regParams.desde = registroDesde;
        regParams.hasta = registroHasta;
      }
      if (!isPrivileged && user) {
        regParams.usuarioId = String(user.id);
      } else {
        if (registroUsuarioId) regParams.usuarioId = registroUsuarioId;
        if (registroClienteId) regParams.clienteId = registroClienteId;
      }

      // Build resumen params: mirror regParams — date range + role-scoped
      // empleada/cliente filters + tipo, so the summary reflects active filters
      const resumenParams: Record<string, string> = {};
      if (registroDesde && registroHasta) {
        resumenParams.desde = registroDesde;
        resumenParams.hasta = registroHasta;
      }
      if (!isPrivileged && user) {
        resumenParams.usuarioId = String(user.id);
      } else {
        if (registroUsuarioId) resumenParams.usuarioId = registroUsuarioId;
        if (registroClienteId) resumenParams.clienteId = registroClienteId;
      }
      resumenParams.tipo = registroFilter;

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
  }, [salonId, todayStr, registroDesde, registroHasta, registroPage, isPrivileged, user, registroUsuarioId, registroClienteId, registroFilter]);

  useEffect(() => {
    if (salonId) fetchData();
  }, [salonId, fetchData]);

  const handleAnular = async () => {
    if (!salonId || !selectedRegistro) return;
    setSubmitting(true);
    setAnularError(null);
    try {
      await api.delete(`/salones/${salonId}/registros/${selectedRegistro.id}`);
      setAnularOpen(false);
      setSelectedRegistro(null);
      fetchData();
    } catch (err) {
      setAnularError(extractApiErrorMessage(err, 'Error al anular el registro. Intentá de nuevo.'));
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
    setAnularError(null);
    setAnularOpen(true);
  };

  const closeAnular = () => {
    setAnularOpen(false);
    setSelectedRegistro(null);
    setAnularError(null);
  };

  const calcTotal = (r: Registro): number => {
    // Anulado: todo en cero
    if (r.estado === 'ANULADO') return 0;
    if (r.precioAjustado && r.valorFinal != null) {
      return r.valorFinal;
    }
    return r.montoTotal || (r.totalServicios + r.totalProductos);
  };

  // Dynamic summary title reflecting the active filters
  const resumenTitulo = [
    'Resumen del período',
    registroDesde && registroHasta
      ? `desde ${registroDesde} hasta ${registroHasta}`
      : todayStr,
    registroFilter === 'SERVICIOS' ? 'de servicios' : registroFilter === 'PRODUCTOS' ? 'de productos' : '',
    registroEmpleadaNombre ? `del empleado ${registroEmpleadaNombre}` : '',
    registroClienteNombre ? `del cliente ${registroClienteNombre}` : '',
  ].filter(Boolean).join(' ');

  /* ── Skeleton ── */
  if (loading) {
    return (
      <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className={styles.summaryGrid}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <Skeleton key={i} height="80px" variant="rect" />
          ))}
        </div>
        <TableSkeleton
          rows={5}
          columns={['#', 'Fecha', 'Hora', 'Cliente', 'Empleada', 'Servicios', 'Productos', 'Dto.%', 'Ajustado', 'Total', 'Método de pago', 'Estado']}
        />
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
      {/* ── Resumen del período (dynamic) ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
        <h3 className={styles.sectionTitle} style={{ margin: 0 }}>
          📋 {resumenTitulo}
        </h3>
      </div>
      <motion.div
        className={styles.summaryGrid}
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={itemVariants} className={styles.summaryCard}>
          <span className={styles.summaryLabel}>💰 TOTAL INGRESOS</span>
          <span className={styles.summaryValueAccent}>
            {resumen ? formatCurrency(resumen.totalIngresos) : '$0'}
          </span>
        </motion.div>
        {/* PR2 cash (decisión owner: el ingreso se cuenta cuando se cobra):
            totalCobrado = Σ pagos recibidos; totalFiadoDia = fiado originado en el período. */}
        <motion.div variants={itemVariants} className={styles.summaryCard} style={{ borderColor: 'rgba(52,211,153,0.3)' }}>
          <span className={styles.summaryLabel}>💰 Cobrado</span>
          <span className={styles.summaryValue} style={{ color: '#34d399' }}>
            {resumen?.totalCobrado != null ? formatCurrency(resumen.totalCobrado) : '$0'}
          </span>
        </motion.div>
        <motion.div variants={itemVariants} className={styles.summaryCard} style={{ borderColor: 'rgba(251,146,60,0.3)' }}>
          <span className={styles.summaryLabel}>🧾 Fiado del período</span>
          <span className={styles.summaryValue} style={{ color: '#fb923c' }}>
            {resumen?.totalFiadoDia != null ? formatCurrency(resumen.totalFiadoDia) : '$0'}
          </span>
        </motion.div>
        {/* Comentado por decisión de negocio: no mostrar métricas sensibles a todo rol
        <motion.div variants={itemVariants} className={styles.summaryCard}>
          <span className={styles.summaryLabel}>✂️ Atenciones</span>
          <span className={styles.summaryValue}>
            {resumen?.cantidadAtenciones ?? 0}
          </span>
        </motion.div>
        */}
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
        {/* Comentado por decisión de negocio: no mostrar métricas sensibles a todo rol
        <motion.div variants={itemVariants} className={styles.summaryCard}>
          <span className={styles.summaryLabel}>💸 Comisiones</span>
          <span className={styles.summaryValue}>
            {resumen ? formatCurrency(resumen.totalComisiones) : '$0'}
          </span>
        </motion.div>
        <motion.div variants={itemVariants} className={styles.summaryCard} style={{ borderColor: 'rgba(251,146,60,0.3)' }}>
          <span className={styles.summaryLabel}>🧴 Costo base insumos</span>
          <span className={styles.summaryValue} style={{ color: '#fb923c' }}>
            {resumen ? formatCurrency(resumen.totalCostoBaseInsumos) : '$0'}
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
        */}
        {/* Comentado por decisión de negocio: no mostrar métricas sensibles a todo rol
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
        */}
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
        {((registroDesde && !registroHasta) || (!registroDesde && registroHasta)) && (
          <span
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '0.7rem',
              color: 'var(--danger)',
              background: 'rgba(224,85,106,0.08)',
              border: '1px solid rgba(224,85,106,0.25)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.35rem 0.7rem',
            }}
          >
            ⚠️ Para filtrar por rango completá ambas fechas
          </span>
        )}
        {isPrivileged && salonId && (
          <>
            <label style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              fontWeight: 500,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.3rem',
              minWidth: '180px',
            }}>
              <EmpleadaSearchableSelect
                salonId={salonId}
                value={registroUsuarioId ? Number(registroUsuarioId) : null}
                selectedName={registroEmpleadaNombre || undefined}
                onSelect={(e) => {
                  setRegistroUsuarioId(e.id ? String(e.id) : '');
                  setRegistroEmpleadaNombre(e.id ? e.nombre : '');
                  setRegistroPage(1);
                }}
                placeholder="🔍 Buscar empleada..."
              />
            </label>
            <label style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              fontWeight: 500,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.3rem',
              minWidth: '180px',
            }}>
              <ClienteSearchableSelect
                salonId={salonId}
                value={registroClienteId ? Number(registroClienteId) : null}
                selectedName={registroClienteNombre || undefined}
                onSelect={(c) => {
                  setRegistroClienteId(c.id ? String(c.id) : '');
                  setRegistroClienteNombre(c.id ? c.nombre : '');
                  setRegistroPage(1);
                }}
                placeholder="🔍 Buscar cliente..."
              />
            </label>
          </>
        )}
        {!isPrivileged && (
          <span
            style={{
              background: 'var(--bg-surface)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.35rem 0.85rem',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'default',
            }}
            title="Solo podés ver tus propios registros"
          >
            👤 Solo mis registros
          </span>
        )}
        <div style={{ display: 'flex', gap: '0.35rem', marginLeft: 'auto' }}>
          <select
            aria-label="Filtrar por estado de registro"
            value={registroEstadoFilter}
            onChange={(e) => {
              setRegistroEstadoFilter(e.target.value as 'ACTIVOS' | 'ANULADOS' | 'TODOS');
              setRegistroPage(1);
            }}
            style={{
              background: 'var(--bg-surface)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.35rem 0.6rem',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '0.75rem',
              cursor: 'pointer',
            }}
          >
            <option value="ACTIVOS">Activos</option>
            <option value="ANULADOS">Anulados</option>
            <option value="TODOS">Todos</option>
          </select>
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
          <table className={`${styles.table} ${styles.registrosTable}`}>
            <thead className={styles.tableHead}>
              <tr>
                <th>#</th>
                <th>Fecha</th>
                <th>Hora</th>
                <th>Cliente</th>
                <th>Empleada</th>
                <th>Servicios</th>
                <th>Productos</th>
                <th>Dto.%</th>
                <th>Ajustado</th>
                <th>Total</th>
                <th>Método de pago</th>
                <th>Estado</th>
                <th className={styles.stickyActions}>Acciones</th>
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
                  <td data-label="#" style={{ color: 'var(--text-dim)', fontWeight: 600 }}>
                    {reg.id}
                  </td>
                  {/* Fecha */}
                  <td data-label="Fecha" style={{ color: 'var(--text-dim)', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                    {formatShortDate(reg.fechaHora ?? reg.creadoEn)}
                  </td>
                  {/* Hora */}
                  <td data-label="Hora" style={{ color: 'var(--text-dim)', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                    {formatTimeAMPM(reg.fechaHora ?? reg.creadoEn)}
                  </td>
                  <td data-label="Cliente" style={{ fontWeight: 500 }}>
                    {reg._clienteNombre ?? `Cliente #${reg.clienteId}`}
                  </td>
                  <td data-label="Empleada" style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 500 }}>
                    {reg._empleadaNombre ?? `Usuaria #${reg.usuarioId}`}
                  </td>
                  <td data-label="Servicios" style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 500 }}>
                    {reg.totalServicios > 0 ? formatCurrency(reg.totalServicios) : '---'}
                  </td>
                  <td data-label="Productos" style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 500 }}>
                    {reg.totalProductos > 0 ? formatCurrency(reg.totalProductos) : '---'}
                  </td>
                  {/* Descuento */}
                  <td data-label="Dto.%" style={{ textAlign: 'center' }}>
                    {reg.porcentajeDescuento != null && reg.porcentajeDescuento > 0 ? (
                      <span style={{ color: 'var(--danger)', fontWeight: 500 }}>{reg.porcentajeDescuento}%</span>
                    ) : (
                      <span style={{ color: 'var(--text-dim)' }}>—</span>
                    )}
                  </td>
                  {/* Ajustado */}
                  <td data-label="Ajustado" style={{ textAlign: 'center' }}>
                    {reg.precioAjustado ? (
                      <span style={{ background: 'rgba(212,168,83,0.15)', color: 'var(--accent)', padding: '0.1rem 0.4rem', borderRadius: 'var(--radius-sm)', fontSize: '0.65rem', fontWeight: 600 }}>Sí</span>
                    ) : (
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.65rem' }}>No</span>
                    )}
                  </td>
                  <td data-label="Total" style={{ fontWeight: 600, color: 'var(--accent)' }}>
                    {formatCurrency(calcTotal(reg))}
                  </td>
                  <td data-label="Método de pago">
                    <span style={{ fontSize: '0.75rem' }}>
                      {METODO_PAGO_LABELS[reg.pagos?.[0]?.metodoPago ?? '---'] ?? '---'}
                    </span>
                  </td>
                  <td data-label="Estado">
                    {reg.estado === 'ANULADO' ? (
                      <span className={`${styles.badge} ${styles.badgeEliminado}`}>Anulado</span>
                    ) : reg.estaPagadaEmpleada ? (
                      <span className={`${styles.badge} ${styles.badgeLiquidado ?? styles.badgeServicios}`} style={{ background: 'rgba(92,186,123,0.15)', color: 'var(--success)' }}>Liquidado</span>
                    ) : (
                      <span className={`${styles.badge} ${styles.badgeServicios}`}>Activo</span>
                    )}
                  </td>
                  <td data-label="Acciones" className={styles.stickyActions}>
                    <div style={{ display: 'flex', gap: '0.15rem' }}>
                      <button
                        className={styles.actionBtn}
                        onClick={() => openDetail(reg)}
                        title="Ver detalle"
                        aria-label="Ver detalle"
                      >
                        👁️
                      </button>
                      {reg.estado !== 'ANULADO' && !reg.estaPagadaEmpleada ? (
                        <button
                          className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                          onClick={() => !cajaCerradaAnular(reg) && openAnular(reg)}
                          disabled={cajaCerradaAnular(reg)}
                          title={
                            cajaCerradaAnular(reg)
                              ? 'No se puede anular: la caja de ese día ya está cerrada'
                              : 'Anular'
                          }
                          aria-label={cajaCerradaAnular(reg) ? 'Anular bloqueado (caja cerrada)' : 'Anular'}
                          style={cajaCerradaAnular(reg) ? { opacity: 0.35, cursor: 'not-allowed' } : undefined}
                        >
                          🚫
                        </button>
                      ) : null}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination controls ── */}
      <PaginationBar
        page={registroPage}
        totalPages={registroMeta.totalPages}
        total={registroMeta.total}
        label="registros"
        onPrev={() => setRegistroPage((p) => p - 1)}
        onNext={() => setRegistroPage((p) => p + 1)}
      />

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
            error={anularError}
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
            onNavigateToCaja={() => {
              setWalkInOpen(false);
              onNavigateToCaja?.();
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
  const totalPagos = registro.pagos?.reduce((s, p) => s + p.monto, 0) ?? 0;
  const cambio = totalPagos > totalFinal ? totalPagos - totalFinal : 0;

  return (
    <motion.div
      className={`${styles.modalOverlay} mobileBottomSheet`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        className={`${styles.modalContent} ${styles.modalContentXl} mobileBottomSheetContent`}
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
                  {formatDateTimeAMPM(registro.fechaHora ?? registro.creadoEn)}
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

            {/* ── Servicio items section (detail table: name + price) ── */}
            {registro.serviciosItems && registro.serviciosItems.length > 0 && (
              <div style={{ marginBottom: '0.75rem' }}>
                <h4 className={styles.sectionSubtitle}>Servicios realizados</h4>
                <div style={{
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  background: 'var(--bg-surface)',
                }}>
                  {/* Table header */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1.6fr 1fr',
                    gap: '0.5rem',
                    padding: '0.45rem 0.65rem',
                    background: 'var(--bg-elevated)',
                    borderBottom: '1px solid var(--border)',
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '0.6rem',
                    fontWeight: 600,
                    color: 'var(--text-dim)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}>
                    <span>Servicio</span>
                    <span style={{ textAlign: 'right' }}>Precio</span>
                  </div>

                  {/* Table rows */}
                  {registro.serviciosItems.map((si, idx) => (
                    <motion.div
                      key={si.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.03, duration: 0.2 }}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1.6fr 1fr',
                        gap: '0.5rem',
                        padding: '0.45rem 0.65rem',
                        borderBottom: '1px solid var(--border)',
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '0.7rem',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {si.nombreServicio}
                      </span>
                      <span style={{ textAlign: 'right', color: 'var(--text-primary)' }}>{formatCurrency(si.precioServicio)}</span>
                    </motion.div>
                  ))}
                  {/* Totals row */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1.6fr 1fr',
                    gap: '0.5rem',
                    padding: '0.45rem 0.65rem',
                    background: 'var(--bg-elevated)',
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    alignItems: 'center',
                  }}>
                    <span style={{ color: 'var(--text-primary)' }}>Total servicios</span>
                    <span style={{ textAlign: 'right', color: 'var(--accent)' }}>{formatCurrency(registro.totalServicios)}</span>
                  </div>
                </div>
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

            {/* ── Resumen (total original / final + nota de ajuste) ── */}
            <div style={{ marginBottom: '0.75rem' }}>
              <h4 className={styles.sectionSubtitle}>Resumen</h4>
              <div style={{
                background: 'var(--bg-elevated)',
                border: '1px dashed var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '0.6rem 0.9rem',
              }}>
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
  /** Error del DELETE — se muestra inline y el modal permanece abierto. */
  error?: string | null;
}

const RenderConfirmAnular: React.FC<AnularConfirmProps> = ({ registro, submitting, onCancel, onConfirm, error }) => (
  <motion.div
    className={`${styles.modalOverlay} mobileBottomSheet`}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.2 }}
    onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
          >
            <motion.div
              className={`${styles.modalContent} ${styles.modalContentXl} mobileBottomSheetContent`}
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

      {/* ── Error de anulación (mensaje real del backend) — el modal permanece abierto ── */}
      {error && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.5rem',
            background: 'rgba(224,85,106,0.12)',
            borderBottom: '1px solid rgba(224,85,106,0.3)',
            color: 'var(--danger)',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '0.8125rem',
            fontWeight: 500,
          }}
        >
          ⚠️ {error}
        </div>
      )}

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
  const [createError, setCreateError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
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
    setCreateError(null);
    setFormOpen(true);
  };

  const openDelete = (g: Gasto) => {
    setSelectedGasto(g);
    setDeleteError(null);
    setDeleteOpen(true);
  };

  const handleCreate = async () => {
    if (!salonId) return;
    setSubmitting(true);
    setCreateError(null);
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
    } catch (err) {
      setCreateError(extractApiErrorMessage(err, 'Error al crear el gasto. Intentá de nuevo.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!salonId || !selectedGasto) return;
    setSubmitting(true);
    setDeleteError(null);
    try {
      await api.delete(`/salones/${salonId}/gastos/${selectedGasto.id}`);
      setDeleteOpen(false);
      setSelectedGasto(null);
      fetchGastos();
    } catch (err) {
      setDeleteError(extractApiErrorMessage(err, 'Error al eliminar el gasto. Intentá de nuevo.'));
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = form.descripcion.trim().length > 0 && Number(form.monto) > 0;

  if (loading) {
    return (
      <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Skeleton height="60px" width="200px" variant="rect" style={{ marginBottom: '1rem' }} />
        <TableSkeleton rows={5} columns={['Descripción', 'Categoría', 'Monto', 'Fecha', 'Acciones']} />
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
                <th className={styles.stickyActions}>Acciones</th>
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
                  <td data-label="Descripción" style={{ fontWeight: 500 }}>{g.descripcion}</td>
                  <td data-label="Categoría">
                    <span className={`${styles.badge} ${getCategoryBadge(g.categoria)}`}>
                      {GASTO_CATEGORIAS.find((c) => c.value === g.categoria)?.label ?? g.categoria}
                    </span>
                  </td>
                  <td data-label="Monto" style={{ fontWeight: 600, color: 'var(--danger)' }}>{formatCurrency(Number(g.monto ?? 0))}</td>
                  <td data-label="Fecha" style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{formatDate(g.fecha)}</td>
                  <td data-label="Acciones" className={styles.stickyActions}>
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
      <PaginationBar
        page={gastoPage}
        totalPages={gastoMeta.totalPages}
        total={gastoMeta.total}
        label="registros"
        onPrev={() => setGastoPage((p) => p - 1)}
        onNext={() => setGastoPage((p) => p + 1)}
      />

      {/* ── Create Gasto Modal ── */}
      <AnimatePresence>
        {formOpen && (
          <motion.div
            className={`${styles.modalOverlay} mobileBottomSheet`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => { if (e.target === e.currentTarget) setFormOpen(false); }}
          >
            <motion.div
              className={`${styles.modalContent} mobileBottomSheetContent`}
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
                  <MoneyInput
                    value={Number(form.monto) || 0}
                    onChange={(n) => setForm((prev) => ({ ...prev, monto: n === 0 ? '' : String(n) }))}
                    placeholder="0"
                    className={styles.formInput}
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
                {createError && (
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem', color: 'var(--danger)', margin: 0, alignSelf: 'center' }}>
                    {createError}
                  </p>
                )}
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
            className={`${styles.modalOverlay} mobileBottomSheet`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => { if (e.target === e.currentTarget) { setDeleteOpen(false); setSelectedGasto(null); } }}
          >
            <motion.div
              className={`${styles.modalContent} mobileBottomSheetContent`}
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
                  ¿Estás segura de eliminar <strong>{selectedGasto.descripcion}</strong>?
                </p>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  Esta acción no se puede deshacer.
                </p>
                <div className={styles.deleteWarning}>
                  ⚠️ Monto: {formatCurrency(Number(selectedGasto.monto ?? 0))} — {GASTO_CATEGORIAS.find((c) => c.value === (selectedGasto.categoria ?? '').toUpperCase())?.label ?? selectedGasto.categoria ?? '—'}
                </div>
              </div>

              {/* ── Error de borrado (mensaje real del backend) — el modal permanece abierto ── */}
              {deleteError && (
                <div
                  role="alert"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1.5rem',
                    background: 'rgba(224,85,106,0.12)',
                    borderBottom: '1px solid rgba(224,85,106,0.3)',
                    color: 'var(--danger)',
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                  }}
                >
                  ⚠️ {deleteError}
                </div>
              )}

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
        <TableSkeleton rows={5} columns={['Tipo', 'Producto', 'Cantidad', 'Motivo', 'Monto dev.', 'Fecha']} />
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
                  <td data-label="Tipo">
                    <span className={`${styles.badge} ${d.productoId != null ? styles.badgeProductos : styles.badgeServicios}`}>
                      {d.productoId != null ? 'Producto' : 'Servicio'}
                    </span>
                  </td>
                  <td data-label="Producto" style={{ fontWeight: 500 }}>{d.producto?.nombre ?? '—'}</td>
                  <td data-label="Cantidad">{d.cantidad}</td>
                  <td data-label="Motivo" className={styles.motivoCell} style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{d.motivo}</td>
                  <td data-label="Monto dev." style={{ fontWeight: 600, color: 'var(--danger)' }}>{formatCurrency(d.montoDevolucion)}</td>
                  <td data-label="Fecha" style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{formatDate(d.creadoEn || d.fecha)}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination controls ── */}
      <PaginationBar
        page={devolucionPage}
        totalPages={devolucionMeta.totalPages}
        total={devolucionMeta.total}
        label="registros"
        onPrev={() => setDevolucionPage((p) => p - 1)}
        onNext={() => setDevolucionPage((p) => p + 1)}
      />

      {/* ── Create Devolución Modal ── */}
      <AnimatePresence>
        {formOpen && (
          <motion.div
            className={`${styles.modalOverlay} mobileBottomSheet`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => { if (e.target === e.currentTarget) setFormOpen(false); }}
          >
            <motion.div
              className={`${styles.modalContent} mobileBottomSheetContent`}
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
                    <MoneyInput
                      value={Number(form.montoDevolucion) || 0}
                      onChange={(n) => setForm((prev) => ({ ...prev, montoDevolucion: n === 0 ? '' : String(n) }))}
                      placeholder="0"
                      className={styles.formInput}
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
  const [clientesMap, setClientesMap] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<number | null>(null);

  // Total a cobrar del registro (misma lógica que RegistrosTab, usada por el modal de detalle)
  const calcTotal = (r: Registro): number => {
    if (r.estado === 'ANULADO') return 0;
    if (r.precioAjustado && r.valorFinal != null) {
      return r.valorFinal;
    }
    return r.montoTotal || (r.totalServicios + r.totalProductos);
  };

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
  // Registros no pagados traídos del server (por usuarioId). El filtro por período es
  // CLIENT-side: `auditarRegistros` deriva del rango editable (pago fuera de ciclo).
  const [auditarAllRegistros, setAuditarAllRegistros] = useState<Registro[]>([]);
  const [auditarLoading, setAuditarLoading] = useState(false);
  const [auditarError, setAuditarError] = useState<string | null>(null);
  // Período editable Desde/Hasta (día Colombia, inclusivo). Default = período de la fila.
  const [auditDesde, setAuditDesde] = useState('');
  const [auditHasta, setAuditHasta] = useState('');
  // Detail modal opened from the audit table (each service row opens its registro)
  const [auditDetailRegistro, setAuditDetailRegistro] = useState<Registro | null>(null);
  const [auditDetailOpen, setAuditDetailOpen] = useState(false);

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

  // ── Helper: registros del detalle de auditoría filtrados por el período EDITADO ──
  // El fetch es por usuarioId (server); el filtro por rango es client-side para permitir
  // el pago fuera de ciclo. Bordes con la misma semántica del backend (colombiaDayStartUTC
  // / colombiaDayEndUTC) para no romper los bordes de día de Colombia (D4).
  const auditarRegistros = useMemo(() => {
    if (!auditDesde || !auditHasta) return auditarAllRegistros;
    const desde = new Date(`${auditDesde}T05:00:00.000Z`);
    const hasta = new Date(`${addDaysInput(auditHasta, 1)}T05:00:00.000Z`);
    return auditarAllRegistros.filter((r) => {
      const creado = new Date(r.fechaHora ?? r.creadoEn);
      return creado >= desde && creado < hasta;
    });
  }, [auditarAllRegistros, auditDesde, auditHasta]);

  // Totales del modal: comisiones/propinas se recalculan del detalle filtrado;
  // bono+sueldo se toman del row (el factor de frecuencia ya está aplicado) — D5.
  const auditarTotales = useMemo(
    () => ({
      comisiones: auditarRegistros.reduce((sum, r) => sum + Number(r.comisionCalculada ?? 0), 0),
      propinas: auditarRegistros.reduce((sum, r) => sum + Number(r.propina ?? 0), 0),
    }),
    [auditarRegistros],
  );

  // Aviso de solapamiento (D6): si el rango EDITADO intersecta una liquidación previa de la
  // misma empleada, el comp fijo podría pagarse de nuevo en el tramo solapado. Informacional.
  const liquidacionSolapada = useMemo(() => {
    if (!selectedEmpleada || !auditDesde || !auditHasta) return null;
    return (
      historial.find((h) => {
        if (h.usuarioId !== selectedEmpleada.empleadaId) return false;
        const hIni = periodoDayInput(h.fechaDesde);
        const hFin = periodoDayInput(h.fechaHasta, true);
        if (!hIni || !hFin) return false;
        return auditDesde <= hFin && hIni <= auditHasta; // intersección de rangos inclusivos
      }) ?? null
    );
  }, [historial, selectedEmpleada, auditDesde, auditHasta]);

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
    () => filteredHistorial.reduce((sum, r) => sum + (r.totalPagado || 0), 0),
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
        api.get(`/salones/${salonId}/clientes`),
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
      if (results[3]?.status === 'fulfilled') {
        const raw = results[3].value.data;
        const list = Array.isArray(raw) ? raw : (raw?.data ?? []);
        const map = new Map<number, string>();
        for (const c of list) {
          if (c.id != null && c.nombre) map.set(c.id, c.nombre);
        }
        setClientesMap(map);
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
    periodo?: { periodoInicio: string; periodoFin: string },
    totalPagadoOverride?: number,
    descuentos?: Array<{prestamoId: number; monto: number}>,
  ) => {
    if (!salonId) return;
    setSubmittingId(empleadaId);
    setError(null);
    try {
      // Usar el período de la fila pendiente (calculado por frecuencia en el backend);
      // fallback al mes actual si la fila no lo trae.
      const periodoBody = periodo?.periodoInicio && periodo?.periodoFin
        ? { periodoInicio: periodo.periodoInicio, periodoFin: periodo.periodoFin }
        : (() => {
            const now = new Date();
            const firstDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
            const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
            return { periodoInicio: toISODate(firstDay), periodoFin: toISODate(today) };
          })();
      const body: Record<string, any> = {
        usuarioId: empleadaId,
        ...periodoBody,
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
      // NO tocar setError global: desmontaría NominaTab (y el modal) por la pantalla de error.
      // El manejo visual del error lo hace handleConfirmLiquidar con setAuditarError.
      throw new Error(msg);
    } finally {
      setSubmittingId(null);
    }
  };

  const handleAuditar = async (emp: NominaEmpleado) => {
    setSelectedEmpleada(emp);
    // Default del período editable = MES COMPLETO (1° → último día del mes de la
    // fila pendiente), sin importar la frecuencia (semanal/quincenal/mensual).
    // El usuario MAY cambiarlo: pago fuera de ciclo / adelantado.
    const mesInicio = periodoDayInput(emp.periodoInicio);
    const primerDia = mesInicio ? firstOfMonthISO(new Date(`${mesInicio}T12:00:00Z`)) : '';
    // Último día del mes: día 0 del mes siguiente (Date.UTC normaliza).
    const anio = Number(primerDia.slice(0, 4));
    const mes = Number(primerDia.slice(5, 7));
    const ultimoDiaMes = String(new Date(Date.UTC(anio, mes, 0)).getUTCDate()).padStart(2, '0');
    setAuditDesde(primerDia);
    setAuditHasta(`${primerDia.slice(0, 8)}${ultimoDiaMes}`);
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

      // Fetch detailed registros for audit (por usuarioId; el filtro por período es client-side)
      setAuditarLoading(true);
      try {
        const { data: regData } = await api.get(`/salones/${salonId}/registros`, {
          params: { usuarioId: emp.empleadaId, limit: 50 },
        });
        const allRegs = Array.isArray(regData?.data) ? regData.data : Array.isArray(regData) ? regData : [];
        const noPagados = allRegs.filter((r: any) => r.estaPagadaEmpleada !== false ? false : true);
        // Enrich with resolved client/employee names so the detail modal shows names, not IDs
        setAuditarAllRegistros(noPagados.map((r: any) => ({
          ...r,
          _clienteNombre: r._clienteNombre ?? clientesMap.get(r.clienteId) ?? undefined,
          _empleadaNombre: r._empleadaNombre ?? empleadasMap.get(r.usuarioId) ?? undefined,
        })));
      } catch {
        setAuditarAllRegistros([]);
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
        {
          // Bordes en ISO con hora Colombia (colombiaDayStartUTC / colombiaDayEndUTC):
          // el fin es EXCLUSIVO → hasta inclusive + 1 día a las 05:00 UTC (D4).
          periodoInicio: `${auditDesde}T05:00:00.000Z`,
          periodoFin: `${addDaysInput(auditHasta, 1)}T05:00:00.000Z`,
        },
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
      setAuditDesde('');
      setAuditHasta('');
      setAuditarAllRegistros([]);
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
        <TableSkeleton
          rows={3}
          columns={['Empleada', 'Período', 'Comisiones', 'Propinas', 'Bono horario', 'Sueldo fijo', 'Total Pagado', 'Fecha']}
        />
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
                  key={`${emp.empleadaId}-${emp.periodoInicio}`}
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
                      <div style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '0.6875rem',
                        color: 'var(--text-dim)',
                        marginTop: '0.1rem',
                      }}>
                        Período {emp.frecuenciaPago} · {formatPeriodoFecha(emp.periodoInicio)} → {formatPeriodoFecha(emp.periodoFin, true)}
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
            <div className={styles.historialScroll}>
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
                        <td data-label="Empleada" style={{ fontWeight: 500 }}>
                          {empleadasMap.get(h.usuarioId) ?? `Empleada #${h.usuarioId}`}
                        </td>
                        <td data-label="Período" style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                          {formatDate(h.fechaDesde)} — {formatDate(h.fechaHasta)}
                        </td>
                        <td data-label="Comisiones" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(h.totalComisiones)}</td>
                        <td data-label="Propinas" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(h.totalPropinas)}</td>
                        <td data-label="Bono horario" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(h.bonoHorario)}</td>
                        <td data-label="Sueldo fijo" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(h.sueldoFijo)}</td>
                        <td data-label="Total Pagado" style={{ fontWeight: 600, color: 'var(--accent)' }}>{formatCurrency(h.totalPagado)}</td>
                        <td data-label="Fecha" style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{formatDate(h.creadoEn)}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Pagination controls ── */}
          <PaginationBar
            page={historialPage}
            totalPages={historialTotalPages}
            total={filteredHistorial.length}
            label="registros"
            onPrev={() => setHistorialPage((p) => p - 1)}
            onNext={() => setHistorialPage((p) => p + 1)}
          />
        </>
      )}

      {/* ── Pre-liquidation Audit Modal ── */}
      <AnimatePresence>
        {auditarOpen && selectedEmpleada && (
          <motion.div
            className={`${styles.modalOverlay} mobileBottomSheet`}
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
              className={`${styles.modalContent} ${styles.modalContentXl} mobileBottomSheetContent`}
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
                    setAuditDesde('');
                    setAuditHasta('');
                    setAuditarAllRegistros([]);
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
                      color: 'var(--text-secondary)', display: 'flex', alignItems: 'center',
                      gap: '0.5rem',
                    }}>
                      <span>Período a liquidar:</span>
                      <input
                        type="date"
                        aria-label="Período desde"
                        value={auditDesde}
                        onChange={(e) => setAuditDesde(e.target.value)}
                        style={{
                          fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem',
                          padding: '0.2rem 0.4rem',
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--text-primary)',
                        }}
                      />
                      <span style={{ color: 'var(--text-dim)' }}>→</span>
                      <input
                        type="date"
                        aria-label="Período hasta"
                        value={auditHasta}
                        onChange={(e) => setAuditHasta(e.target.value)}
                        style={{
                          fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem',
                          padding: '0.2rem 0.4rem',
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--text-primary)',
                        }}
                      />
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.6875rem' }}>
                        (editable — pago fuera de ciclo)
                      </span>
                    </div>
                    <div style={{
                      display: 'flex', gap: '0.35rem', flexWrap: 'wrap',
                      marginTop: '0.3rem',
                    }}>
                      {selectedEmpleada.sueldoFijo > 0 && (
                        <span style={{
                          background: 'rgba(92,186,123,0.12)',
                          color: 'var(--success)',
                          padding: '0.1rem 0.5rem',
                          borderRadius: '999px',
                          fontSize: '0.65rem',
                          fontWeight: 600,
                          fontFamily: "'DM Sans', sans-serif",
                          whiteSpace: 'nowrap',
                        }}>
                          💼 Sueldo fijo: {formatCurrency(selectedEmpleada.sueldoFijo)}
                        </span>
                      )}
                      {selectedEmpleada.porcentajeComisionServicio > 0 && (
                        <span style={{
                          background: 'rgba(212,168,83,0.15)',
                          color: 'var(--accent)',
                          padding: '0.1rem 0.5rem',
                          borderRadius: '999px',
                          fontSize: '0.65rem',
                          fontWeight: 600,
                          fontFamily: "'DM Sans', sans-serif",
                          whiteSpace: 'nowrap',
                        }}>
                          💰 Comisión: {selectedEmpleada.porcentajeComisionServicio}%
                        </span>
                      )}
                      {selectedEmpleada.sueldoFijo <= 0 && selectedEmpleada.porcentajeComisionServicio <= 0 && (
                        <span style={{
                          background: 'rgba(148,163,184,0.12)',
                          color: 'var(--text-dim)',
                          padding: '0.1rem 0.5rem',
                          borderRadius: '999px',
                          fontSize: '0.65rem',
                          fontWeight: 600,
                          fontFamily: "'DM Sans', sans-serif",
                          whiteSpace: 'nowrap',
                        }}>
                          ⚪ Sin esquema de pago definido
                        </span>
                      )}
                    </div>
                    {selectedEmpleada.frecuenciaPago &&
                      selectedEmpleada.sueldoFijo > 0 &&
                      selectedEmpleada.sueldoFijoMensual != null &&
                      selectedEmpleada.sueldoFijoMensual !== selectedEmpleada.sueldoFijo && (
                        <span
                          style={{
                            display: 'block',
                            marginTop: '0.3rem',
                            fontSize: '0.6875rem',
                            color: 'var(--text-secondary)',
                            fontFamily: "'DM Sans', sans-serif",
                          }}
                        >
                          💡 El sueldo fijo se guarda como valor MENSUAL y se prorratea según la frecuencia de pago:{' '}
                          {selectedEmpleada.frecuenciaPago} → {formatCurrency(selectedEmpleada.sueldoFijo)} de{' '}
                          {formatCurrency(selectedEmpleada.sueldoFijoMensual)} mensuales.
                        </span>
                      )}
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
                      label: 'Comisiones', value: auditarTotales.comisiones,
                      emoji: '💰', color: 'var(--accent)', borderColor: 'var(--accent)',
                    },
                    {
                      label: 'Propinas', value: auditarTotales.propinas,
                      emoji: '🎁', color: 'var(--success)', borderColor: 'var(--success)',
                    },
                    {
                      label: 'Bono + Sueldo', value: selectedEmpleada.bonoHorario + selectedEmpleada.sueldoFijo,
                      emoji: '⏰', color: '#818cf8', borderColor: '#818cf8',
                    },
                    {
                      label: 'Total bruto',
                      value: auditarTotales.comisiones + auditarTotales.propinas + selectedEmpleada.bonoHorario + selectedEmpleada.sueldoFijo,
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

                {liquidacionSolapada && (
                  <div
                    role="alert"
                    style={{
                      marginBottom: '1rem',
                      padding: '0.65rem 1rem',
                      background: 'rgba(245,158,11,0.1)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(245,158,11,0.4)',
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '0.75rem',
                      color: 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.5rem',
                    }}
                  >
                    <span>⚠️</span>
                    <span>
                      El período editado se solapa con la liquidación{' '}
                      <strong>#{liquidacionSolapada.id}</strong> de esta empleada. El comp fijo
                      podría pagarse nuevamente en el rango solapado.
                    </span>
                  </div>
                )}

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
                      {/* Service detail table */}
                      <div style={{
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        overflow: 'hidden',
                        background: 'var(--bg-surface)',
                      }}>
                        {/* Table header */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '0.5fr 1.5fr 0.9fr 0.8fr 1fr 1fr 1fr 1fr 1fr',
                          gap: '0.5rem',
                          padding: '0.5rem 0.75rem',
                          background: 'var(--bg-elevated)',
                          borderBottom: '1px solid var(--border)',
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: '0.625rem',
                          fontWeight: 600,
                          color: 'var(--text-dim)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}>
                          <span>#</span>
                          <span>Servicio</span>
                          <span>Fecha</span>
                          <span style={{ textAlign: 'center' }}>Prod.</span>
                          <span style={{ textAlign: 'right' }}>Precio</span>
                          <span style={{ textAlign: 'right' }}>Costo base</span>
                          <span style={{ textAlign: 'right' }}>Base neta</span>
                          <span style={{ textAlign: 'right' }}>Comisión</span>
                          <span style={{ textAlign: 'right' }}>Ganancia local</span>
                        </div>

                        {/* Table rows */}
                        {(() => {
                          const filas: Array<{
                            id: number;
                            registroId: number;
                            fecha: string;
                            nombre: string;
                            precio: number;
                            costoBase: number;
                            baseNeta: number;
                            comision: number;
                            gananciaLocal: number;
                            vendioProductos: boolean;
                          }> = [];

                          for (const reg of auditarRegistros) {
                            const items = reg.serviciosItems ?? [];
                            // Proporción de descuento/ajuste del registro (misma lógica que ResumenDiaUseCase):
                            // valorFinal / montoTotal, excluyendo propina. Así el precio refleja lo que realmente pagó el cliente.
                            const propina = Number(reg.propina ?? 0);
                            const montoTotal = Number(reg.montoTotal ?? 0);
                            const valorFinal = Number(reg.valorFinal ?? montoTotal);
                            const baseBruta = montoTotal - propina;
                            const baseReal = valorFinal - propina;
                            const proporcionAjuste = baseBruta > 0 ? baseReal / baseBruta : 1;
                            const precioAjustado = (si: { precioServicio: number }) =>
                              Math.round(Number(si.precioServicio) * proporcionAjuste);

                            const baseNetaTotal = items.reduce(
                              (sum, si) => sum + Math.max(0, precioAjustado(si) - (si.costoBaseInsumos ?? 0)),
                              0,
                            );
                            const comisionTotal = reg.comisionCalculada ?? 0;

                            for (const si of items) {
                              const precio = precioAjustado(si);
                              const baseNeta = Math.max(0, precio - (si.costoBaseInsumos ?? 0));
                              const proporcion = baseNetaTotal > 0 ? baseNeta / baseNetaTotal : 0;
                              filas.push({
                                id: si.id,
                                registroId: reg.id,
                                fecha: formatDateYMD(reg.fechaHora ?? reg.creadoEn),
                                nombre: si.nombreServicio,
                                precio,
                                costoBase: si.costoBaseInsumos ?? 0,
                                baseNeta,
                                comision: Math.round(comisionTotal * proporcion),
                                gananciaLocal: Math.max(0, precio - (si.costoBaseInsumos ?? 0) - Math.round(comisionTotal * proporcion)),
                                vendioProductos: (reg.productosVendidos ?? []).length > 0,
                              });
                            }
                          }

                          if (filas.length === 0) {
                            return (
                              <div style={{
                                fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem',
                                color: 'var(--text-dim)', padding: '0.75rem',
                                textAlign: 'center',
                              }}>
                                No se encontraron servicios detallados para este período.
                              </div>
                            );
                          }

                          const totales = {
                            precio: filas.reduce((s, f) => s + f.precio, 0),
                            costoBase: filas.reduce((s, f) => s + f.costoBase, 0),
                            baseNeta: filas.reduce((s, f) => s + f.baseNeta, 0),
                            comision: filas.reduce((s, f) => s + f.comision, 0),
                            gananciaLocal: filas.reduce((s, f) => s + f.gananciaLocal, 0),
                          };

                          return (
                            <>
                              {filas.map((fila, idx) => (
                                <motion.div
                                  key={fila.id}
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  transition={{ delay: idx * 0.02, duration: 0.2 }}
                                  onClick={() => {
                                    const reg = auditarRegistros.find((r) => r.id === fila.registroId);
                                    if (reg) {
                                      setAuditDetailRegistro(reg);
                                      setAuditDetailOpen(true);
                                    }
                                  }}
                                  title="Ver detalle del registro"
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: '0.5fr 1.5fr 0.9fr 0.8fr 1fr 1fr 1fr 1fr 1fr',
                                    gap: '0.5rem',
                                    padding: '0.5rem 0.75rem',
                                    borderBottom: '1px solid var(--border)',
                                    fontFamily: "'DM Sans', sans-serif",
                                    fontSize: '0.75rem',
                                    alignItems: 'center',
                                    cursor: 'pointer',
                                    transition: 'background 0.15s',
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                >
                                  <span style={{ color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                                    #{fila.registroId}
                                  </span>
                                  <span style={{ color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {fila.nombre}
                                  </span>
                                  <span style={{ color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                                    {fila.fecha}
                                  </span>
                                  <span style={{ textAlign: 'center' }}>
                                    <span style={{
                                      fontSize: '0.7rem',
                                      fontWeight: 600,
                                      padding: '0.1rem 0.5rem',
                                      borderRadius: '999px',
                                      background: fila.vendioProductos ? 'rgba(92,186,123,0.15)' : 'rgba(148,163,184,0.12)',
                                      color: fila.vendioProductos ? 'var(--success)' : 'var(--text-dim)',
                                    }}>
                                      {fila.vendioProductos ? 'Sí' : 'No'}
                                    </span>
                                  </span>
                                  <span style={{ textAlign: 'right', color: 'var(--text-primary)' }}>{formatCurrency(fila.precio)}</span>
                                  <span style={{ textAlign: 'right', color: '#fb923c' }}>{formatCurrency(fila.costoBase)}</span>
                                  <span style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{formatCurrency(fila.baseNeta)}</span>
                                  <span style={{ textAlign: 'right', color: 'var(--accent)', fontWeight: 600 }}>{formatCurrency(fila.comision)}</span>
                                  <span style={{ textAlign: 'right', color: '#34d399', fontWeight: 700 }}>{formatCurrency(fila.gananciaLocal)}</span>
                                </motion.div>
                              ))}
                              {/* Totals row */}
                              <div style={{
                                display: 'grid',
                                gridTemplateColumns: '0.5fr 1.5fr 0.9fr 0.8fr 1fr 1fr 1fr 1fr 1fr',
                                gap: '0.5rem',
                                padding: '0.5rem 0.75rem',
                                background: 'var(--bg-elevated)',
                                fontFamily: "'DM Sans', sans-serif",
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                alignItems: 'center',
                              }}>
                                <span />
                                <span style={{ color: 'var(--text-primary)' }}>Total servicios</span>
                                <span />
                                <span />
                                <span style={{ textAlign: 'right', color: 'var(--accent)' }}>{formatCurrency(totales.precio)}</span>
                                <span style={{ textAlign: 'right', color: '#fb923c' }}>{formatCurrency(totales.costoBase)}</span>
                                <span style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{formatCurrency(totales.baseNeta)}</span>
                                <span style={{ textAlign: 'right', color: 'var(--accent)' }}>{formatCurrency(totales.comision)}</span>
                                <span style={{ textAlign: 'right', color: '#34d399' }}>{formatCurrency(totales.gananciaLocal)}</span>
                              </div>
                            </>
                          );
                        })()}
                      </div>

                      {/* Registro cards with products/notes kept for context */}
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
                            Saldo: {formatCurrency(Number(p.saldoPendiente))}
                          </span>
                          <MoneyInput
                            value={desc.monto}
                            onChange={(n) => setDescuentosPrestamos((prev) => ({
                              ...prev,
                              [p.id]: { ...prev[p.id] ?? { checked: true }, monto: n },
                            }))}
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
                        <MoneyInput
                          value={pagoAjustado}
                          onChange={(n) => setPagoAjustado(n)}
                          onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          className={styles.formInput}
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
                    setAuditDesde('');
                    setAuditHasta('');
                    setAuditarAllRegistros([]);
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

        {/* Detail modal opened from the audit service table */}
        {auditDetailOpen && auditDetailRegistro && (
          <RenderRegistroDetail
            registro={auditDetailRegistro}
            calcTotal={calcTotal}
            onClose={() => {
              setAuditDetailOpen(false);
              setAuditDetailRegistro(null);
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

/* ================================================================ */
/*  REPORTES TAB                                                     */
/* ================================================================ */

const ReportesTab: React.FC<{ salonId: number | null; user: IUser | null }> = ({
  salonId,
  user,
}) => {
  const today = useMemo(() => new Date(), []);
  // Default del rango: mes actual en Colombia (1° del mes → hoy). A las 23:30 COT
  // del 31/08, UTC ya es 01/09 — se usa la fecha de negocio Colombia.
  const [reporteDesde, setReporteDesde] = useState(firstOfMonthColombiaISO());
  const [reporteHasta, setReporteHasta] = useState(colombiaTodayISO());
  const [mes, setMes] = useState(getMonthISO(today));

  const [pyl, setPyl] = useState<PyLData | null>(null);
  const [resumen, setResumen] = useState<FinanzasResumen | null>(null);
  const [roi, setRoi] = useState<ROIData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);

  // Filtro por empleada: solo roles privilegiados (misma regla que RegistrosTab)
  const [reporteUsuarioId, setReporteUsuarioId] = useState('');
  const [reporteEmpleadaNombre, setReporteEmpleadaNombre] = useState('');

  const isPrivileged = !!user && (
    user.rol === Rol.SUPERADMIN ||
    user.rol === Rol.DUEÑA ||
    user.rol === Rol.ADMINISTRADOR ||
    user.rol === Rol.CONTADOR
  );

  // Params compartidos P&L + resumen: desde + hasta + usuarioId role-scoped.
  // Los roles restringidos son forzados a su propio usuarioId.
  const buildReportParams = useCallback((): Record<string, string> => {
    const params: Record<string, string> = { desde: reporteDesde, hasta: reporteHasta };
    if (!isPrivileged && user) {
      params.usuarioId = String(user.id);
    } else if (reporteUsuarioId) {
      params.usuarioId = reporteUsuarioId;
    }
    return params;
  }, [reporteDesde, reporteHasta, isPrivileged, user, reporteUsuarioId]);

  const fetchPyl = useCallback(async () => {
    if (!salonId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/salones/${salonId}/finanzas/pyl`, {
        params: buildReportParams(),
      });
      setPyl(data);
    } catch {
      setPyl(null);
    } finally {
      setLoading(false);
    }
  }, [salonId, buildReportParams]);

  const fetchResumen = useCallback(async () => {
    if (!salonId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/salones/${salonId}/finanzas/resumen`, {
        params: buildReportParams(),
      });
      setResumen(data);
    } catch {
      setResumen(null);
    } finally {
      setLoading(false);
    }
  }, [salonId, buildReportParams]);

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
    fetchPyl();
    fetchResumen();
  }, [fetchPyl, fetchResumen]);

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

  const generarReportes = () => {
    fetchPyl();
    fetchResumen();
  };

  // Descarga el xlsx del período. Los errores de axios con responseType blob
  // llegan como Blob (no JSON): se lee el texto y se intenta extraer el mensaje.
  const downloadExcel = useCallback(async () => {
    if (!salonId || exportando) return;
    setExportando(true);
    setError(null);
    try {
      const response = await api.get(`/salones/${salonId}/finanzas/exportar`, {
        params: buildReportParams(),
        responseType: 'blob',
      });
      const blob = response.data as Blob;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `pyl_${reporteDesde}_${reporteHasta}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      const axiosErr = err as {
        response?: { data?: unknown };
        message?: string;
      };
      let mensaje = 'No se pudo exportar el reporte';
      const blobErr = axiosErr.response?.data;
      if (blobErr instanceof Blob) {
        try {
          const texto = await blobErr.text();
          const parsed = JSON.parse(texto) as { error?: { message?: string }; message?: string };
          mensaje = parsed.error?.message ?? parsed.message ?? mensaje;
        } catch {
          // Blob sin JSON: queda el mensaje por defecto
        }
      } else if (axiosErr.message) {
        mensaje = axiosErr.message;
      }
      setError(mensaje);
    } finally {
      setExportando(false);
    }
  }, [salonId, exportando, buildReportParams, reporteDesde, reporteHasta]);

  if (loading && !pyl && !resumen && !roi) {
    return (
      <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Skeleton height="60px" variant="rect" style={{ marginBottom: '1rem' }} />
        <Skeleton height="200px" variant="rect" />
      </motion.div>
    );
  }

  if (error && !pyl && !resumen && !roi) {
    return (
      <motion.div key="error" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={styles.emptyState}>
        <span className={styles.emptyIcon}>⚠️</span>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', color: 'var(--danger)', marginBottom: '1rem' }}>{error}</p>
        <Button variant="secondary" size="sm" onClick={generarReportes}>Reintentar</Button>
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
          {isPrivileged && salonId && (
            <label style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              fontWeight: 500,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.3rem',
              minWidth: '180px',
            }}>
              <EmpleadaSearchableSelect
                salonId={salonId}
                value={reporteUsuarioId ? Number(reporteUsuarioId) : null}
                selectedName={reporteEmpleadaNombre || undefined}
                onSelect={(e) => {
                  setReporteUsuarioId(e.id ? String(e.id) : '');
                  setReporteEmpleadaNombre(e.id ? e.nombre : '');
                }}
                placeholder="🔍 Buscar empleada..."
              />
            </label>
          )}
          {!isPrivileged && (
            <span
              style={{
                background: 'var(--bg-surface)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.35rem 0.85rem',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'default',
              }}
              title="Solo podés ver tus propios registros"
            >
              👤 Solo mis registros
            </span>
          )}
          <motion.button
            style={{ ...primaryBtnStyle, background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)' }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={downloadExcel}
            disabled={exportando}
            title="Descargar P&L y movimientos en Excel"
          >
            {exportando ? 'Exportando…' : '📥 Exportar Excel'}
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

      {error && (
        <div
          role="alert"
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '0.8125rem',
            color: 'var(--danger)',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.6rem 0.9rem',
            marginBottom: '0.75rem',
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* ── P&L del período (valores directos del backend) ── */}
      {pyl && (
        <div className={styles.reporteCard}>
          <h4 className={styles.reporteCardTitle}>
            💰 P&L Mensual — {pyl.desde} a {pyl.hasta}
            <span style={{ fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
              ({pyl.cantidadAtenciones} atenciones)
            </span>
          </h4>
          <div className={styles.summaryGrid}>
            {/* PR2 cash-basis (decisión owner: ingreso = cuando se cobra). Las
                líneas devengadas (brutos/netos/servicios/productos) siguen abajo
                como informativas. */}
            <div className={styles.summaryCard} style={{ borderColor: 'rgba(52,211,153,0.3)' }}>
              <span className={styles.summaryLabel}>💰 Cobrado</span>
              <span className={styles.summaryValue} style={{ color: '#34d399' }}>
                {pyl.cobrado != null ? formatCurrency(pyl.cobrado) : '$0'}
              </span>
            </div>
            <div className={styles.summaryCard} style={{ borderColor: 'rgba(251,146,60,0.3)' }}>
              <span className={styles.summaryLabel}>🧾 Fiado del período</span>
              <span className={styles.summaryValue} style={{ color: '#fb923c' }}>
                {pyl.fiadoPeriodo != null ? formatCurrency(pyl.fiadoPeriodo) : '$0'}
              </span>
            </div>
            <div className={styles.summaryCard} style={{ borderColor: 'rgba(251,191,36,0.3)' }}>
              <span className={styles.summaryLabel}>📌 Deudas por cobrar</span>
              <span className={styles.summaryValue} style={{ color: '#fbbf24' }}>
                {pyl.deudasPorCobrar != null ? formatCurrency(pyl.deudasPorCobrar) : '$0'}
              </span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>💰 Ingresos brutos</span>
              <span className={styles.summaryValueAccent}>{formatCurrency(pyl.ingresosBrutos)}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>🏷️ Descuentos</span>
              <span className={styles.summaryValue}>{formatCurrency(pyl.descuentos)}</span>
            </div>
            {pyl.incrementos ? (
              <div className={styles.summaryCard}>
                <span className={styles.summaryLabel}>📈 Incrementos</span>
                <span className={styles.summaryValue} style={{ color: '#fbbf24' }}>{formatCurrency(pyl.incrementos)}</span>
              </div>
            ) : null}
            <div className={styles.summaryCard} style={{ borderColor: 'rgba(52,211,153,0.3)' }}>
              <span className={styles.summaryLabel}>💵 Ingresos netos</span>
              <span className={styles.summaryValue} style={{ color: '#34d399' }}>{formatCurrency(pyl.ingresosNetos)}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>💇 Total servicios</span>
              <span className={styles.summaryValue} style={{ color: '#818cf8' }}>{formatCurrency(pyl.totalServicios)}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>🛒 Total productos</span>
              <span className={styles.summaryValue} style={{ color: '#34d399' }}>{formatCurrency(pyl.totalProductos)}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>🎁 Total propinas</span>
              <span className={styles.summaryValueSuccess}>{formatCurrency(pyl.propinas)}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>📦 Insumos (costo base)</span>
              <span className={styles.summaryValue} style={{ color: 'var(--danger)' }}>{formatCurrency(pyl.costoBaseInsumos)}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>📊 Margen bruto</span>
              <span className={styles.summaryValueAccent}>{formatCurrency(pyl.margenBruto)}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>👥 Comisiones</span>
              <span className={styles.summaryValue} style={{ color: 'var(--danger)' }}>{formatCurrency(pyl.comisiones)}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>💸 Gastos fijos</span>
              <span className={styles.summaryValue} style={{ color: 'var(--danger)' }}>{formatCurrency(pyl.gastosFijos)}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>📦 Gastos operativos</span>
              <span className={styles.summaryValue} style={{ color: 'var(--danger)' }}>{formatCurrency(pyl.gastosOperativos)}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>💸 Total gastos</span>
              <span className={styles.summaryValue} style={{ color: 'var(--danger)' }}>{formatCurrency(pyl.totalGastos)}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>↩️ Devoluciones</span>
              <span className={styles.summaryValue} style={{ color: 'var(--danger)' }}>{formatCurrency(pyl.devoluciones)}</span>
            </div>
            <div className={styles.summaryCard} style={{ gridColumn: '1 / -1', borderColor: (pyl.utilidadNeta ?? 0) >= 0 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)' }}>
              <span className={styles.summaryLabel}>📊 Utilidad neta</span>
              <span className={styles.summaryValue} style={{ color: (pyl.utilidadNeta ?? 0) >= 0 ? '#22c55e' : '#ef4444' }}>
                {formatCurrency(pyl.utilidadNeta)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Resumen del período (desde+hasta; sin ganancia neta client-side) ── */}
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
              <span className={styles.summaryLabel}>🎁 Propinas</span>
              <span className={styles.summaryValueSuccess}>{formatCurrency(resumen.totalPropinas)}</span>
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
              <span className={styles.summaryLabel}>💰 TOTAL INGRESOS</span>
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
      {!pyl && !resumen && !roi && (
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

/* ================================================================ */
/*  CUENTAS TAB                                                      */
/* ================================================================ */

/** Badge de tipo de deuda en Por cobrar: CLIENTE (neutral) | PRESTAMO (ámbar). */
const CuentaTipoBadge: React.FC<{ tipo: CuentaCobrar['tipo'] }> = ({ tipo }) => {
  const esPrestamo = tipo === 'PRESTAMO';
  return (
    <span
      style={{
        background: esPrestamo ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.12)',
        color: esPrestamo ? '#b45309' : 'var(--primary)',
        padding: '0.15rem 0.6rem',
        borderRadius: '999px',
        fontSize: '0.7rem',
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {esPrestamo ? 'Préstamo' : 'Cliente'}
    </span>
  );
};

/** "Al día" = sin deuda pendiente Y con historial liquidado (fallback para APIs antiguas sin alDia). */
function esAlDia(empleada: CuentaPagar): boolean {
  return empleada.alDia ?? (empleada.pendienteActual === 0 && empleada.liquidadoAcumulado > 0);
}

/**
 * Modal Cobrar/Abonar (D7, ventas-fiado-deudas): el endpoint de abono es POR
 * REGISTRO, así que el modal ofrece un select con el desglose `registros[]`
 * del cliente (default = el más antiguo, el backend los ordena ASC). El monto
 * arranca en el pendiente del registro seleccionado; al cambiar de registro el
 * monto se resetea al pendiente de ese registro. Los errores del backend
 * (409 MONTO_EXCEDE_PENDIENTE, 422 REGISTRO_ANULADO/CAJA_CERRADA, 404) se
 * muestran DENTRO del modal sin cerrarlo.
 */
const AbonarModal: React.FC<{
  cliente: CuentaCobrar;
  onClose: () => void;
  onConfirm: (registroId: number, monto: number, metodoPago: string) => Promise<void>;
}> = ({ cliente, onClose, onConfirm }) => {
  const registros = cliente.registros ?? [];
  const [registroId, setRegistroId] = useState<number>(registros[0]?.registroId ?? 0);
  const [monto, setMonto] = useState<number>(registros[0]?.montoPendiente ?? 0);
  const [metodoPago, setMetodoPago] = useState<string>('EFECTIVO');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const registroSeleccionado = registros.find((r) => r.registroId === registroId);

  const cambiarRegistro = (id: number) => {
    setRegistroId(id);
    const reg = registros.find((r) => r.registroId === id);
    setMonto(reg?.montoPendiente ?? 0);
    setError(null);
  };

  const confirmar = async () => {
    if (submitting || !registroSeleccionado || monto <= 0) return;
    setError(null);
    setSubmitting(true);
    try {
      // Éxito: el padre cierra el modal y refresca la lista
      await onConfirm(registroSeleccionado.registroId, monto, metodoPago);
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Error al registrar el abono. Intentá de nuevo.'));
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        data-testid="modal-abonar"
        className={`${styles.modalOverlay} mobileBottomSheet`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => {
          if (e.target === e.currentTarget && !submitting) onClose();
        }}
      >
        <motion.div
          className={`${styles.modalContent} mobileBottomSheetContent`}
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.25, ease: [0.22, 0.61, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.modalHeader}>
            <span className={styles.modalTitle}>💳 Cobrar / Abonar</span>
            <button
              className={styles.modalCloseBtn}
              onClick={onClose}
              disabled={submitting}
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>

          <div className={styles.modalBody}>
            {/* Cliente + deuda total */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {cliente.nombre}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'baseline', marginTop: '0.25rem' }}>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Deuda total
                </span>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '1.125rem', fontWeight: 700, color: 'var(--danger)' }}>
                  {formatCurrency(cliente.deudaTotal)}
                </span>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.6875rem', color: 'var(--text-dim)' }}>
                  {cliente.cantidadRegistros ?? 0} registros
                </span>
              </div>
            </div>

            {/* Desglose: select de registro (default = más antiguo, D7) */}
            <label
              style={{ display: 'block', fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '0.3rem' }}
            >
              Registro a abonar
            </label>
            <select
              aria-label="Registro a abonar"
              value={registroId}
              onChange={(e) => cambiarRegistro(Number(e.target.value))}
              disabled={submitting || registros.length === 0}
              style={{
                width: '100%',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '0.8125rem',
                padding: '0.5rem 0.6rem',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                marginBottom: '0.75rem',
              }}
            >
              {registros.map((r) => (
                <option key={r.registroId} value={r.registroId}>
                  📅 {formatDate(r.fechaHora)} — {formatCurrency(r.montoPendiente)} pend.
                </option>
              ))}
            </select>

            {/* Monto */}
            <label
              style={{ display: 'block', fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '0.3rem' }}
            >
              Monto a abonar
            </label>
            <MoneyInput
              value={monto}
              onChange={setMonto}
              ariaLabel="Monto a abonar"
              disabled={submitting}
              style={{
                width: '100%',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '0.875rem',
                padding: '0.5rem 0.6rem',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                marginBottom: '0.75rem',
              }}
            />

            {/* Método de pago */}
            <label
              style={{ display: 'block', fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '0.3rem' }}
            >
              Método de pago
            </label>
            <select
              aria-label="Método de pago"
              value={metodoPago}
              onChange={(e) => setMetodoPago(e.target.value)}
              disabled={submitting}
              style={{
                width: '100%',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '0.8125rem',
                padding: '0.5rem 0.6rem',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
              }}
            >
              {Object.entries(METODO_PAGO_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            {error && (
              <div
                role="alert"
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '0.8125rem',
                  color: 'var(--danger)',
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.6rem 0.9rem',
                  marginTop: '0.75rem',
                }}
              >
                ⚠️ {error}
              </div>
            )}
          </div>

          <div className={styles.modalFooter}>
            <Button variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" onClick={confirmar} disabled={submitting || monto <= 0 || !registroSeleccionado}>
              {submitting ? 'Cobrando…' : 'Cobrar'}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

const CuentasTab: React.FC<{ salonId: number | null }> = ({ salonId }) => {
  /* ── Sub-vistas: Cobrar (clientes con deuda) / Pagar (empleadas) ── */
  const [cuentasSubtab, setCuentasSubtab] = useState<'cobrar' | 'pagar'>('cobrar');

  const [cobrar, setCobrar] = useState<CuentaCobrar[]>([]);
  const [cobrarPage, setCobrarPage] = useState(1);
  const [cobrarMeta, setCobrarMeta] = useState(CUENTAS_META_VACIO);

  const [pagar, setPagar] = useState<CuentaPagar[]>([]);
  const [pagarPage, setPagarPage] = useState(1);
  const [pagarMeta, setPagarMeta] = useState(CUENTAS_META_VACIO);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ── Modal Cobrar/Abonar (PR4): cliente seleccionado + banner de éxito ── */
  const [abonarCliente, setAbonarCliente] = useState<CuentaCobrar | null>(null);
  const [abonoOk, setAbonoOk] = useState<string | null>(null);

  /* ── Fetchers (devuelven éxito para decidir el estado global de error) ── */
  const loadCobrar = useCallback(async (page: number): Promise<boolean> => {
    if (salonId == null) return false;
    try {
      const { data } = await api.get(`/salones/${salonId}/finanzas/cuentas/cobrar`, {
        params: { page, limit: CUENTAS_PAGE_SIZE },
      });
      const payload = data?.data;
      setCobrar(Array.isArray(payload?.data) ? payload.data : []);
      setCobrarMeta(payload?.meta ?? CUENTAS_META_VACIO);
      return true;
    } catch {
      setCobrar([]);
      setCobrarMeta(CUENTAS_META_VACIO);
      return false;
    }
  }, [salonId]);

  const loadPagar = useCallback(async (page: number): Promise<boolean> => {
    if (salonId == null) return false;
    try {
      const { data } = await api.get(`/salones/${salonId}/finanzas/cuentas/pagar`, {
        params: { page, limit: CUENTAS_PAGE_SIZE },
      });
      const payload = data?.data;
      const rows = Array.isArray(payload?.data) ? payload.data : [];
      setPagar(rows);
      setPagarMeta(payload?.meta ?? CUENTAS_META_VACIO);
      return true;
    } catch {
      setPagar([]);
      setPagarMeta(CUENTAS_META_VACIO);
      return false;
    }
  }, [salonId]);

  const fetchData = useCallback(async () => {
    if (salonId == null) return;
    setLoading(true);
    setError(null);
    const [cobrarOk, pagarOk] = await Promise.all([loadCobrar(1), loadPagar(1)]);
    if (!cobrarOk && !pagarOk) {
      setError('Error al cargar las cuentas');
    }
    setLoading(false);
  }, [salonId, loadCobrar, loadPagar]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ── Paginación por sub-vista (patrón cierres de CajaTab: sin flash global) ── */
  const goCobrarPage = (next: number) => {
    setCobrarPage(next);
    loadCobrar(next);
  };

  const goPagarPage = (next: number) => {
    setPagarPage(next);
    loadPagar(next);
  };

  /* ── Abono (PR4): POST /registros/:id/pagos → éxito cierra modal + refresca ──
   * Los errores del backend (409/422/404) se propagan al modal (throw) para
   * mostrarse sin cerrarlo; la lista NO se refresca (spec finanzas-cuentas).
   */
  const confirmarAbono = useCallback(
    async (registroId: number, monto: number, metodoPago: string): Promise<void> => {
      if (salonId == null) return;
      await api.post(`/salones/${salonId}/registros/${registroId}/pagos`, { monto, metodoPago });
      setAbonarCliente(null);
      setAbonoOk('✅ Abono registrado');
      await loadCobrar(cobrarPage);
    },
    [salonId, loadCobrar, cobrarPage],
  );

  const openAbonar = (cliente: CuentaCobrar) => {
    setAbonoOk(null);
    setAbonarCliente(cliente);
  };

  if (loading) {
    return (
      <motion.div key="cuentas-loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Skeleton height="36px" width="220px" variant="rect" style={{ marginBottom: '1rem' }} />
        <TableSkeleton rows={5} columns={['Cliente / Préstamo', 'Tipo', 'Deuda total', 'Registros', 'Antigüedad', 'Acciones']} />
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        key="cuentas-error"
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
    <motion.div key="cuentas" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
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
          className={`${styles.tabBtn} ${cuentasSubtab === 'cobrar' ? styles.tabActive : ''}`}
          onClick={() => setCuentasSubtab('cobrar')}
        >
          💳 Por cobrar
        </button>
        <button
          className={`${styles.tabBtn} ${cuentasSubtab === 'pagar' ? styles.tabActive : ''}`}
          onClick={() => setCuentasSubtab('pagar')}
        >
          💸 Por pagar
        </button>
      </div>

      {cuentasSubtab === 'cobrar' ? (
        /* ════════════════════════════════════════════════ */
        /*  POR COBRAR — clientes con deuda + préstamos      */
        /* ════════════════════════════════════════════════ */
        <div>
          {abonoOk && (
            <div
              role="status"
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '0.8125rem',
                color: 'var(--success)',
                background: 'rgba(92,186,123,0.1)',
                border: '1px solid rgba(92,186,123,0.3)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.6rem 0.9rem',
                marginBottom: '0.75rem',
              }}
            >
              {abonoOk}
            </div>
          )}
          {cobrar.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>✅</span>
              <h3 className={styles.emptyTitle}>No hay deudas pendientes</h3>
              <p className={styles.emptySubtitle}>
                Las deudas de clientes y los préstamos activos aparecerán aquí.
              </p>
            </div>
          ) : (
            <>
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead className={styles.tableHead}>
                    <tr>
                      <th>Cliente / Préstamo</th>
                      <th>Tipo</th>
                      <th>Deuda total</th>
                      <th>Registros</th>
                      <th>Antigüedad</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cobrar.map((c) => (
                      <tr key={c.id} className={styles.tableRow}>
                        <td data-label="Cliente / Préstamo" style={{ fontWeight: 500 }}>{c.nombre}</td>
                        <td data-label="Tipo">
                          <CuentaTipoBadge tipo={c.tipo ?? 'CLIENTE'} />
                        </td>
                        <td data-label="Deuda total" style={{ fontWeight: 600, color: 'var(--danger)' }}>
                          {formatCurrency(c.deudaTotal)}
                        </td>
                        <td data-label="Registros" style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 500 }}>
                          {c.cantidadRegistros ?? '—'}
                        </td>
                        <td data-label="Antigüedad" style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 500 }}>
                          {antiguedadLabel(c.antiguedadBucket)}
                        </td>
                        <td data-label="Acciones">
                          {/* Solo filas CLIENTE: el abono es por registro; los préstamos
                              tienen su propio flujo en Préstamos (read-only aquí). */}
                          {c.tipo === 'CLIENTE' && c.registros && c.registros.length > 0 ? (
                            <Button variant="secondary" size="sm" onClick={() => openAbonar(c)}>
                              Cobrar/Abonar
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <PaginationBar
                page={cobrarPage}
                totalPages={cobrarMeta.totalPages}
                total={cobrarMeta.total}
                label="deudas"
                onPrev={() => goCobrarPage(cobrarPage - 1)}
                onNext={() => goCobrarPage(cobrarPage + 1)}
              />
            </>
          )}

          {abonarCliente && (
            <AbonarModal
              cliente={abonarCliente}
              onClose={() => setAbonarCliente(null)}
              onConfirm={confirmarAbono}
            />
          )}
        </div>
      ) : (
        /* ════════════════════════════════════════════════ */
        /*  POR PAGAR — Pendientes vs Al día                */
        /* ════════════════════════════════════════════════ */
        <div>
          {pagar.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>✅</span>
              <h3 className={styles.emptyTitle}>No hay pagos pendientes</h3>
              <p className={styles.emptySubtitle}>
                Las obligaciones del salón con sus empleadas aparecerán aquí.
              </p>
            </div>
          ) : (
            <>
              {/* ── Pendientes: empleadas con deuda > 0 ── */}
              <div data-testid="seccion-pendientes" style={{ marginBottom: '1.75rem' }}>
                <h4 style={{ fontSize: '0.9rem', margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>
                  Pendientes
                </h4>
                {pagar.some((e) => !esAlDia(e)) ? (
                  <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                      <thead className={styles.tableHead}>
                        <tr>
                          <th>Empleada</th>
                          <th>Pendiente</th>
                          <th>Liquidado acumulado</th>
                          <th>Sueldo fijo</th>
                          <th>Comisión %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagar
                          .filter((e) => !esAlDia(e))
                          .sort((a, b) => b.pendienteActual - a.pendienteActual)
                          .map((e) => (
                            <tr key={e.empleadaId} className={styles.tableRow}>
                              <td data-label="Empleada" style={{ fontWeight: 500 }}>{e.nombre}</td>
                              <td data-label="Pendiente">
                                <span style={{ fontWeight: 600, color: 'var(--danger)' }}>
                                  {formatCurrency(e.pendienteActual)}
                                </span>
                              </td>
                              <td data-label="Liquidado acumulado" style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 500 }}>
                                {formatCurrency(e.liquidadoAcumulado)}
                              </td>
                              <td data-label="Sueldo fijo" style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 500 }}>
                                {formatCurrency(e.sueldoFijo)}
                              </td>
                              <td data-label="Comisión %" style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 500 }}>
                                {e.porcentajeComisionServicio}%
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                    🎉 Sin pagos pendientes
                  </p>
                )}
              </div>

              {/* ── Al día: liquidadas, sin deuda actual ── */}
              <div data-testid="seccion-al-dia">
                <h4 style={{ fontSize: '0.9rem', margin: '0 0 0.5rem', color: 'var(--success)' }}>
                  ✅ Al día
                </h4>
                {pagar.some((e) => esAlDia(e)) ? (
                  <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                      <thead className={styles.tableHead}>
                        <tr>
                          <th>Empleada</th>
                          <th>Pendiente</th>
                          <th>Liquidado acumulado</th>
                          <th>Sueldo fijo</th>
                          <th>Comisión %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagar
                          .filter((e) => esAlDia(e))
                          .sort((a, b) => a.nombre.localeCompare(b.nombre))
                          .map((e) => (
                            <tr key={e.empleadaId} className={styles.tableRow}>
                              <td data-label="Empleada" style={{ fontWeight: 500 }}>{e.nombre}</td>
                              <td data-label="Pendiente">
                                <span
                                  style={{
                                    background: 'rgba(92,186,123,0.15)',
                                    color: 'var(--success)',
                                    padding: '0.15rem 0.6rem',
                                    borderRadius: '999px',
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  ✅ Al día
                                </span>
                              </td>
                              <td data-label="Liquidado acumulado" style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 500 }}>
                                {formatCurrency(e.liquidadoAcumulado)}
                              </td>
                              <td data-label="Sueldo fijo" style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 500 }}>
                                {formatCurrency(e.sueldoFijo)}
                              </td>
                              <td data-label="Comisión %" style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 500 }}>
                                {e.porcentajeComisionServicio}%
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                    Sin empleadas al día con historial.
                  </p>
                )}
              </div>

              <PaginationBar
                page={pagarPage}
                totalPages={pagarMeta.totalPages}
                total={pagarMeta.total}
                label="empleadas"
                onPrev={() => goPagarPage(pagarPage - 1)}
                onNext={() => goPagarPage(pagarPage + 1)}
              />
            </>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default FinanzasPage;
