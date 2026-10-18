import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { IUser } from '@pos-final/types';
import api from '../../services/api.js';
import {
  CAJA_REFRESH_EVENT,
  dispatchCajaRefresh,
  formatCurrency,
  getColombiaDateString,
  puedeGestionarCaja,
  type CajaDTO,
} from './CajaBanner.js';
import MoneyInput from '../MoneyInput.js';
import HelpTip from '../HelpTip.js';
import PaginationBar from '../PaginationBar.js';
import SaldoInicialCajaCard from './SaldoInicialCajaCard.js';

/* ================================================================ */
/*  TIPOS                                                            */
/* ================================================================ */

export interface PorMetodoPagoTotals {
  EFECTIVO: number;
  TARJETA: number;
  TRANSFERENCIA: number;
}

export interface ReporteCierre {
  totalServicios: number;
  totalProductos: number;
  /** Ingresos NETOS por tipo (post-descuento). Opcionales: fallback si falta (API vieja/mocks). */
  ingresosServicios?: number;
  ingresosProductos?: number;
  /** Fondo de apertura (montoInicial) expuesto por el reporte. Opcional por compatibilidad. */
  montoInicial?: number;
  ingresosBrutos: number;
  descuentos: number;
  ingresosNetos: number;
  porMetodoPago: PorMetodoPagoTotals;
  /** Σ(efectivo + tarjeta + transferencia). Opcional: fallback si falta (API vieja/mocks). */
  totalRecaudado?: number;
  /** Cobros recibidos por ventas del MISMO día (todos los métodos). */
  cobrosVentasDia?: number;
  /** Abonos recibidos contra ventas de días ANTERIORES (deuda vieja, todos los métodos). */
  cobrosDeudaAnteriorDia?: number;
  /** Cobros de préstamos manuales recibidos en la caja (todos los métodos). */
  cobrosPrestamoDia?: number;
  comisiones: number;
  /** Σ fiado generado por las ventas del día (no entró a la caja). Opcional por compatibilidad. */
  fiadoDia?: number;
  totalGastos: number;
  /** Σ devoluciones del día (todos los métodos); opcional por compatibilidad. */
  totalDevoluciones?: number;
  /** Σ nómina/préstamos liquidados del día (todos los métodos); opcional por compatibilidad. */
  totalNominaPrestamos?: number;
  montoEsperado: number;
  montoReal: number | null;
  diferencia: number | null;
  cantidadMovimientos: number;
}

export interface ReporteCierreDTO {
  caja: CajaDTO;
  reporte: ReporteCierre;
}

/** Movimiento individual del detalle de un cierre (registro SERVICIO o gasto GASTO). */
export interface MovimientoDetalle {
  id: number;
  tipo: 'SERVICIO' | 'GASTO';
  fecha: string;
  descripcion: string;
  monto: number;
  metodoPago: string | null;
}

export interface DetalleCierreDTO {
  caja: CajaDTO;
  reporte: ReporteCierre;
  movimientos: MovimientoDetalle[];
}

/* ================================================================ */
/*  HELPERS                                                          */
/* ================================================================ */

/** fechaCaja viene como 'YYYY-MM-DD' (DATE column) → 'DD/MM/YYYY' sin pasar por Date (TZ-safe). */
function formatFechaCaja(fechaCaja?: string): string {
  if (!fechaCaja) return '—';
  const [y, m, d] = fechaCaja.split('-');
  if (!y || !m || !d) return fechaCaja;
  return `${d}/${m}/${y}`;
}

/** Monto de arqueo: null (caja ABIERTA) → '—' (no fabricar $0 ni un arqueo falso). */
function formatMonto(n: number | null | undefined): string {
  return n == null ? '—' : formatCurrency(n);
}

/**
 * Total RECAUDADO del día (todos los métodos: efectivo + tarjeta + transferencia).
 * El API ya lo envía; si por compatibilidad no viene, se suma el breakdown local.
 */
function totalRecaudadoDe(reporte: ReporteCierre): number {
  if (typeof reporte.totalRecaudado === 'number') return reporte.totalRecaudado;
  const p = reporte.porMetodoPago;
  return (p?.EFECTIVO ?? 0) + (p?.TARJETA ?? 0) + (p?.TRANSFERENCIA ?? 0);
}

/**
 * Fondo de apertura del cierre. El reporte lo expone (`montoInicial`); si falta
 * (API vieja/mocks) se usa el `montoInicial` del DTO de la caja como fallback.
 */
function montoAperturaDe(reporte: ReporteCierre, caja?: CajaDTO | null): number {
  if (typeof reporte.montoInicial === 'number') return reporte.montoInicial;
  return caja?.montoInicial ?? 0;
}

/** Ingresos NETOS del día por tipo; fallback a los brutos si el API no los trae. */
function ingresosServiciosDe(reporte: ReporteCierre): number {
  return typeof reporte.ingresosServicios === 'number' ? reporte.ingresosServicios : reporte.totalServicios;
}

function ingresosProductosDe(reporte: ReporteCierre): number {
  return typeof reporte.ingresosProductos === 'number' ? reporte.ingresosProductos : reporte.totalProductos;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** View model of the closing-detail chain (sold → collected → drawer count). */
interface CadenaCierre {
  ventasNetas: number;
  /** Derived exactly as `ventasNetas − fiado`: the part of today's sales collected at sale time. */
  cobradoHoy: number;
  fiado: number;
  /** Abonos received today against previous-day sales (money that entered, not today's sales). */
  abonosViejos: number;
  /** Same-day abonos beyond the fiado snapshot (keeps the collection chain exact). */
  abonosMismoDia: number;
  /** Manual loan collections (also money that entered, not sales). */
  cobrosPrestamo: number;
  /** All money collected in the caja: cash + card + transfer. */
  totalRecobrado: number;
  efectivo: number;
  tarjeta: number;
  transferencia: number;
  enCuenta: number;
  apertura: number;
  salidasEfectivo: number;
  esperado: number;
  contado: number | null;
  diferencia: number | null;
}

/**
 * Regroups values already present in `ReporteCierre` into the owner's story.
 *
 * Block 1 (`ventasNetas = cobradoHoy + fiado`) is exact BY CONSTRUCTION:
 * `cobradoHoy` is derived as `ventasNetas − fiado`, never read from the cash
 * total (which also contains old-debt abonos and loan collections).
 *
 * Block 2 keeps the real method split (`porMetodoPago`) so its tiles always add
 * up to `totalRecaudado`. The origin buckets exposed by the API
 * (`cobrosVentasDia`, `cobrosDeudaAnteriorDia`, `cobrosPrestamoDia`) let us
 * show where that money came from without plugging numbers:
 *   totalRecaudado = cobrosVentasDia + abonosViejos + cobrosPrestamo
 * and `cobrosVentasDia − cobradoHoy` is the same-day-abono surplus.
 *
 * `salidasEfectivo` is the cash outflow already embedded in the expected
 * drawer amount. The backend formula is:
 *   montoEsperado = montoInicial + Σ efectivo − gastosEfectivo − egresosEfectivo
 * so isolating that outflow keeps block 3 exact, including for historical
 * closings whose expected amount was persisted at close time.
 */
function cadenaDeCierre(reporte: ReporteCierre, caja?: CajaDTO | null): CadenaCierre {
  const efectivo = reporte.porMetodoPago?.EFECTIVO ?? 0;
  const tarjeta = reporte.porMetodoPago?.TARJETA ?? 0;
  const transferencia = reporte.porMetodoPago?.TRANSFERENCIA ?? 0;
  const apertura = montoAperturaDe(reporte, caja);
  const esperado = reporte.montoEsperado;

  const ventasNetas = reporte.ingresosNetos;
  const fiado = reporte.fiadoDia ?? 0;
  const cobradoHoy = round2(ventasNetas - fiado);
  const abonosViejos = reporte.cobrosDeudaAnteriorDia ?? 0;
  const cobrosPrestamo = reporte.cobrosPrestamoDia ?? 0;
  // API viejas sin el split: assume every collection is from today's sales.
  const cobrosVentasDia =
    typeof reporte.cobrosVentasDia === 'number' ? reporte.cobrosVentasDia : cobradoHoy;
  const abonosMismoDia = round2(Math.max(0, cobrosVentasDia - cobradoHoy));

  return {
    ventasNetas,
    cobradoHoy,
    fiado,
    abonosViejos,
    abonosMismoDia,
    cobrosPrestamo,
    totalRecobrado: totalRecaudadoDe(reporte),
    efectivo,
    tarjeta,
    transferencia,
    enCuenta: round2(tarjeta + transferencia),
    apertura,
    salidasEfectivo: round2(apertura + efectivo - esperado),
    esperado,
    contado: reporte.montoReal,
    diferencia: reporte.diferencia,
  };
}

/** Owner-facing verdict for the counted-vs-expected difference. */
function etiquetaCuadre(diferencia: number | null): 'Cuadra' | 'Sobrante' | 'Faltante' | 'Sin arqueo' {
  if (diferencia == null) return 'Sin arqueo';
  if (diferencia < 0) return 'Faltante';
  if (diferencia > 0) return 'Sobrante';
  return 'Cuadra';
}

function colorCuadre(diferencia: number | null): string {
  if (diferencia == null) return 'var(--text-dim)';
  if (diferencia < 0) return 'var(--danger)';
  if (diferencia > 0) return '#fbbf24';
  return 'var(--success)';
}

/** Badge de estado: ABIERTA verde, CERRADA ámbar (filas y modales). */
function estadoBadgeStyle(estado: 'ABIERTA' | 'CERRADA'): React.CSSProperties {
  return estado === 'ABIERTA'
    ? { background: 'rgba(92,186,123,0.12)', color: 'var(--success)' }
    : { background: 'rgba(251,191,36,0.12)', color: '#fbbf24' };
}

/** Fecha de movimiento: 'YYYY-MM-DD' (gasto) → 'DD/MM/YYYY'; ISO datetime (registro) → fecha+hora local. */
function formatFechaMovimiento(fecha: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return formatFechaCaja(fecha);
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const METODO_LABELS: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TARJETA: 'Tarjeta',
  TRANSFERENCIA: 'Transferencia',
};

const ROWS_PER_PAGE = 12;

/* ── Inline styles (patrón FinanzasPage) ── */

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: '1rem 1.25rem',
  marginBottom: '1rem',
};

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

const ghostBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-secondary)',
  padding: '0.5rem 1.25rem',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.8125rem',
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap' as const,
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.6)',
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  zIndex: 1300,
  padding: '12vh 1rem 2rem',
};

const modalStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(212,168,83,0.06)',
  width: '100%',
  maxWidth: 520,
  maxHeight: '80vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-root)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)',
  padding: '0.55rem 0.8rem',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.875rem',
  outline: 'none',
};

/* ── Arqueo (cierre de caja): agrupación visual del modal ── */

/** Caja que agrupa un bloque del arqueo (efectivo, no-efectivo, info). */
const arqueoGroupStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '0.75rem 0.9rem',
  marginBottom: '0.9rem',
};

/** Título de sección (uppercase, mismo patrón que el resto de Finanzas). */
const arqueoSectionTitleStyle: React.CSSProperties = {
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.7rem',
  color: 'var(--text-dim)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: '0.5rem',
};

/** Fila label / monto dentro de un bloque del arqueo. */
const arqueoRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  gap: '0.75rem',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.8rem',
};

/** Nota explicativa chica (helper text) dentro del arqueo. */
const arqueoNoteStyle: React.CSSProperties = {
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.7rem',
  color: 'var(--text-dim)',
  lineHeight: 1.5,
  margin: '0 0 0.5rem',
};

/* ── Detalle del cierre: cadena ventas → cobrado → cuadre ── */

/** Bloque numerado de la cadena principal. */
const chainBlockStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: '1rem 1.1rem',
  marginBottom: '0.9rem',
};

const chainHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '0.65rem',
  marginBottom: '0.75rem',
};

/** Círculo con el número de paso. */
const chainNumberStyle: React.CSSProperties = {
  flex: '0 0 auto',
  width: 26,
  height: 26,
  borderRadius: '50%',
  background: 'var(--accent)',
  color: 'var(--bg-root)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.8rem',
  fontWeight: 800,
};

const chainTitleStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '0.35rem',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.95rem',
  fontWeight: 700,
  color: 'var(--text-primary)',
};

const chainSubtitleStyle: React.CSSProperties = {
  marginTop: '0.15rem',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.72rem',
  color: 'var(--text-dim)',
};

const chainBigRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: '0.75rem',
  marginBottom: '0.65rem',
};

const chainBigLabelStyle: React.CSSProperties = {
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.8rem',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  letterSpacing: '0.02em',
};

const chainBigValueStyle: React.CSSProperties = {
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 'clamp(1.5rem, 3.2vw, 2rem)',
  fontWeight: 800,
  lineHeight: 1.1,
  letterSpacing: '-0.02em',
  color: 'var(--accent)',
};

/** Ecuación en una línea que se parte sola en pantallas chicas. */
const chainEquationStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '0.5rem',
  padding: '0.55rem 0.7rem',
  background: 'var(--bg-root)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
};

const chainTermStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'baseline',
  gap: '0.35rem',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.78rem',
  color: 'var(--text-secondary)',
};

const chainTermValueStyle: React.CSSProperties = {
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.86rem',
  fontWeight: 700,
  color: 'var(--text-primary)',
};

const chainOperatorStyle: React.CSSProperties = {
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.9rem',
  fontWeight: 700,
  color: 'var(--text-dim)',
};

const chainNoteStyle: React.CSSProperties = {
  ...arqueoNoteStyle,
  margin: '0.55rem 0 0',
};

/** Dos tarjetas lado a lado en desktop; apiladas en mobile (auto-fit). */
const chainGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
  gap: '0.65rem',
};

const chainTileStyle: React.CSSProperties = {
  background: 'var(--bg-root)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '0.7rem 0.8rem',
};

const chainTileTitleStyle: React.CSSProperties = {
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.78rem',
  fontWeight: 700,
  color: 'var(--text-primary)',
};

const chainTileLabelStyle: React.CSSProperties = {
  display: 'block',
  marginTop: '0.15rem',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.68rem',
  color: 'var(--text-dim)',
};

const chainTileValueStyle: React.CSSProperties = {
  display: 'block',
  marginTop: '0.35rem',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 'clamp(1.2rem, 2.4vw, 1.55rem)',
  fontWeight: 800,
  lineHeight: 1.15,
  color: 'var(--text-primary)',
};

const chainBreakdownStyle: React.CSSProperties = {
  display: 'block',
  marginTop: '0.3rem',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.66rem',
  color: 'var(--text-dim)',
};

const chainResultGridStyle: React.CSSProperties = {
  ...chainGridStyle,
  marginTop: '0.65rem',
};

const chainResultTileStyle: React.CSSProperties = {
  ...chainTileStyle,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
};

/** Bloque secundario: no compite con la cadena principal. */
const secondaryBlockStyle: React.CSSProperties = {
  ...chainBlockStyle,
  background: 'transparent',
  borderStyle: 'dashed',
};

const secondaryGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
  gap: '0.75rem',
  marginBottom: '0.9rem',
};

const secondaryTitleStyle: React.CSSProperties = {
  ...arqueoSectionTitleStyle,
  marginBottom: '0.6rem',
};

/* ================================================================ */
/*  CAJA TAB                                                         */
/* ================================================================ */

interface CajaTabProps {
  salonId: number | null;
  user: IUser | null;
}

const CajaTab: React.FC<CajaTabProps> = ({ salonId, user }) => {
  /* ── Estado actual de caja ── */
  const [caja, setCaja] = useState<CajaDTO | null>(null);
  const [loading, setLoading] = useState(true);

  /* ── Modal Abrir ── */
  const [abrirOpen, setAbrirOpen] = useState(false);
  const [montoInicial, setMontoInicial] = useState('');
  const [fechaCaja, setFechaCaja] = useState(getColombiaDateString());
  const [abrirSubmitting, setAbrirSubmitting] = useState(false);

  /* ── Modal Cerrar (arqueo) ── */
  const [cerrarOpen, setCerrarOpen] = useState(false);
  /** Caja objetivo del arqueo: null = la de hoy (card principal); id = ESA caja (historial/aviso). */
  const [cerrarCajaId, setCerrarCajaId] = useState<number | null>(null);
  const [esperado, setEsperado] = useState<ReporteCierre | null>(null);
  const [esperadoLoading, setEsperadoLoading] = useState(false);
  const [montoRealEfectivo, setMontoRealEfectivo] = useState('');
  const [cerrarSubmitting, setCerrarSubmitting] = useState(false);
  const [reporte, setReporte] = useState<ReporteCierreDTO | null>(null);

  /* ── Reabrir (caja de hoy cerrada) ── */
  const [reabrirSubmitting, setReabrirSubmitting] = useState(false);
  const [reabrirError, setReabrirError] = useState<string | null>(null);

  /* ── Historial paginado ── */
  const [cierres, setCierres] = useState<CajaDTO[]>([]);
  const [cierresPage, setCierresPage] = useState(1);
  const [cierresMeta, setCierresMeta] = useState({ page: 1, limit: 12, total: 0, totalPages: 0 });
  const [empleadasMap, setEmpleadasMap] = useState<Map<number, string>>(new Map());

  /* ── Cajas ABIERTA de cualquier día (aviso "pendiente de cierre") ── */
  const [abiertas, setAbiertas] = useState<CajaDTO[]>([]);

  /* ── Modal Detalle de Cierre ── */
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [detalleCierre, setDetalleCierre] = useState<CajaDTO | null>(null);
  const [detalleReporte, setDetalleReporte] = useState<ReporteCierre | null>(null);
  const [detalleMovimientos, setDetalleMovimientos] = useState<MovimientoDetalle[]>([]);
  const [detalleLoading, setDetalleLoading] = useState(false);

  const canManage = puedeGestionarCaja(user);

  /* ── Fetchers ── */
  const fetchCaja = useCallback(async () => {
    if (!salonId) return;
    try {
      const { data } = await api.get(`/salones/${salonId}/caja/actual`);
      setCaja(data?.data ?? null);
    } catch {
      // 404 CAJA_NO_ABIERTA → sin caja abierta
      setCaja(null);
    } finally {
      setLoading(false);
    }
  }, [salonId]);

  const fetchCierres = useCallback(
    async (page: number) => {
      if (!salonId) return;
      try {
        const { data } = await api.get(
          `/salones/${salonId}/caja/cierres?page=${page}&limit=${ROWS_PER_PAGE}`,
        );
        const payload = data?.data;
        setCierres(payload?.data ?? []);
        setCierresMeta(payload?.meta ?? { page: 1, limit: 12, total: 0, totalPages: 0 });
      } catch {
        setCierres([]);
      }
    },
    [salonId],
  );

  /* Cajas ABIERTA de cualquier día: fetch dedicado estado=ABIERTA&limit=0 para que
     el aviso de pendientes tenga un count exacto aunque el historial esté paginado. */
  const fetchCajasAbiertas = useCallback(async () => {
    if (!salonId) return;
    try {
      const { data } = await api.get(`/salones/${salonId}/caja/cierres?estado=ABIERTA&limit=0`);
      setAbiertas(data?.data?.data ?? []);
    } catch {
      setAbiertas([]);
    }
  }, [salonId]);

  const fetchEmpleadas = useCallback(async () => {
    if (!salonId) return;
    try {
      const { data } = await api.get(`/salones/${salonId}/empleadas`);
      const raw = data?.data ?? data;
      const list = Array.isArray(raw) ? raw : [];
      const map = new Map<number, string>();
      for (const e of list) {
        if (e?.id != null && e?.nombre) map.set(e.id, e.nombre);
      }
      setEmpleadasMap(map);
    } catch {
      /* sin nombres → fallback #id */
    }
  }, [salonId]);

  const fetchEsperado = useCallback(async () => {
    if (!salonId) return;
    setEsperadoLoading(true);
    try {
      const { data } = await api.get(`/salones/${salonId}/caja/actual/esperado`);
      setEsperado(data?.data ?? null);
    } catch {
      setEsperado(null);
    } finally {
      setEsperadoLoading(false);
    }
  }, [salonId]);

  /* Abre el modal de detalle: caja del historial + reporte recomputado + movimientos. */
  const handleVerDetalle = useCallback(
    async (c: CajaDTO) => {
      if (!salonId) return;
      setDetalleCierre(c);
      setDetalleReporte(null);
      setDetalleMovimientos([]);
      setDetalleOpen(true);
      setDetalleLoading(true);
      try {
        const { data } = await api.get(`/salones/${salonId}/caja/${c.id}/cierre`);
        setDetalleReporte(data?.data?.reporte ?? null);
        setDetalleMovimientos(data?.data?.movimientos ?? []);
      } catch {
        // Error visible en el modal ("No se pudo cargar el detalle")
      } finally {
        setDetalleLoading(false);
      }
    },
    [salonId],
  );

  const refreshAll = useCallback(() => {
    fetchCaja();
    fetchCierres(cierresPage);
    fetchCajasAbiertas();
  }, [fetchCaja, fetchCierres, fetchCajasAbiertas, cierresPage]);

  /* ── Mount + listener caja-refresh ── */
  useEffect(() => {
    fetchCaja();
    fetchCierres(1);
    fetchCajasAbiertas();
    fetchEmpleadas();
    window.addEventListener(CAJA_REFRESH_EVENT, refreshAll);
    return () => window.removeEventListener(CAJA_REFRESH_EVENT, refreshAll);
  }, [fetchCaja, fetchCierres, fetchCajasAbiertas, fetchEmpleadas, refreshAll]);

  /* ── Handlers ── */
  const handleAbrir = async () => {
    if (!salonId) return;
    setAbrirSubmitting(true);
    try {
      const { data } = await api.post(`/salones/${salonId}/caja/abrir`, {
        montoInicial: Number(montoInicial),
        // Backfill: fecha de negocio seleccionable (default hoy Colombia)
        fechaCaja,
      });
      setCaja(data?.data ?? null);
      setAbrirOpen(false);
      setMontoInicial('');
      dispatchCajaRefresh();
      fetchCierres(1);
    } finally {
      setAbrirSubmitting(false);
    }
  };

  const handleCerrar = async () => {
    if (!salonId) return;
    setCerrarSubmitting(true);
    try {
      const { data } = await api.post(`/salones/${salonId}/caja/cerrar`, {
        montoRealEfectivo: Number(montoRealEfectivo),
        // Con cajaId → cierra ESA caja (huérfana del historial); sin él → la de hoy
        ...(cerrarCajaId ? { cajaId: cerrarCajaId } : {}),
      });
      setReporte(data?.data ?? null);
      setCerrarOpen(false);
      setCaja(null);
      setMontoRealEfectivo('');
      setCerrarCajaId(null);
      dispatchCajaRefresh();
      fetchCierres(1);
      fetchCajasAbiertas();
    } finally {
      setCerrarSubmitting(false);
    }
  };

  const handleReabrir = async () => {
    if (!salonId) return;
    if (!confirm('¿Reabrir la caja de hoy? Se descarta el cierre anterior.')) return;
    setReabrirError(null);
    setReabrirSubmitting(true);
    try {
      const { data } = await api.post(`/salones/${salonId}/caja/reabrir`);
      setCaja(data?.data ?? null);
      dispatchCajaRefresh();
      fetchCierres(1);
    } catch (err) {
      const code = (err as { response?: { data?: { error?: { code?: string } } } })?.response?.data
        ?.error?.code;
      if (code === 'CAJA_YA_ABIERTA') {
        // Ya la abrió otra persona/flujo → refrescar el estado real
        setReabrirError('La caja ya está abierta (se actualizó el estado).');
        fetchCaja();
      } else if (code === 'CAJA_NO_ABIERTA') {
        setReabrirError('No hay caja de hoy para reabrir.');
      } else {
        setReabrirError('No se pudo reabrir la caja. Intentá de nuevo.');
      }
    } finally {
      setReabrirSubmitting(false);
    }
  };

  /** Reabre una caja CERRADA de un día específico (historial) — misma fila. */
  const handleReabrirPorFecha = async (c: CajaDTO) => {
    if (!salonId) return;
    if (!confirm(`¿Reabrir la caja del ${formatFechaCaja(c.fechaCaja)}? Se descarta el cierre anterior y podés agregar/corregir movimientos.`)) return;
    setReabrirError(null);
    setReabrirSubmitting(true);
    try {
      const { data } = await api.post(`/salones/${salonId}/caja/reabrir`, {
        fechaCaja: c.fechaCaja,
      });
      setCaja(data?.data ?? null);
      dispatchCajaRefresh();
      fetchCierres(1);
    } catch (err) {
      const code = (err as { response?: { data?: { error?: { code?: string } } } })?.response?.data
        ?.error?.code;
      if (code === 'CAJA_YA_ABIERTA') {
        setReabrirError('La caja ya está abierta (se actualizó el estado).');
        fetchCaja();
      } else if (code === 'CAJA_NO_ABIERTA') {
        setReabrirError('No existe una caja para esa fecha.');
      } else {
        setReabrirError('No se pudo reabrir la caja. Intentá de nuevo.');
      }
    } finally {
      setReabrirSubmitting(false);
    }
  };

  const abrirModal = () => {
    setMontoInicial('');
    // Default hoy (Colombia): el backfill cambia la fecha solo si hace falta
    setFechaCaja(getColombiaDateString());
    setAbrirOpen(true);
  };

  const cerrarModal = () => {
    setMontoRealEfectivo('');
    setEsperado(null);
    setCerrarCajaId(null);
    setCerrarOpen(true);
    fetchEsperado();
  };

  /** Arqueo por id (huérfana del historial o aviso): prefill con el reporte de ESA caja. */
  const cerrarModalPorId = useCallback(
    async (c: CajaDTO) => {
      if (!salonId) return;
      setMontoRealEfectivo('');
      setEsperado(null);
      setCerrarCajaId(c.id);
      setCerrarOpen(true);
      setEsperadoLoading(true);
      try {
        const { data } = await api.get(`/salones/${salonId}/caja/${c.id}/cierre`);
        // Reporte de ESA caja (null-safe: ABIERTA trae montos null que el modal ya maneja)
        setEsperado(data?.data?.reporte ?? null);
      } catch {
        setEsperado(null);
      } finally {
        setEsperadoLoading(false);
      }
    },
    [salonId],
  );

  /* Diferencia en vivo: real − esperado (solo si hay esperado cargado) */
  const montoRealNum = montoRealEfectivo === '' ? null : Number(montoRealEfectivo);
  const diferenciaPreview =
    esperado && montoRealNum !== null ? montoRealNum - esperado.montoEsperado : null;

  const nombreAuditor = (id: number | null | undefined): string => {
    if (id == null) return '—';
    return empleadasMap.get(id) ?? `#${id}`;
  };

  /* Cadena del detalle: solo reagrupa números del reporte (sin fórmulas nuevas). */
  const detalleCadena = detalleReporte ? cadenaDeCierre(detalleReporte, detalleCierre) : null;
  const totalSalidasRegistradas = detalleReporte
    ? (detalleReporte.totalGastos ?? 0) +
      (detalleReporte.totalDevoluciones ?? 0) +
      (detalleReporte.totalNominaPrestamos ?? 0)
    : 0;

  /* ================================================================ */
  /*  RENDER                                                          */
  /* ================================================================ */

  const abierta = !!caja && caja.estado === 'ABIERTA';
  // Cajas ABIERTA de un día anterior (huérfanas): aviso "pendiente de cierre".
  // El count sale del fetch dedicado estado=ABIERTA (exacto aunque el historial esté paginado).
  const pendientes = abiertas.filter(
    (c) => c.estado === 'ABIERTA' && c.fechaCaja < getColombiaDateString(),
  );
  // Cualquier ABIERTA (cualquier fecha) bloquea "Abrir": primero hay que cerrar la pendiente.
  const hayAbierta = abiertas.some((c) => c.estado === 'ABIERTA');

  // La caja de HOY ya fue cerrada (p. ej. para almorzar) → se puede reabrir.
  // Buscamos la CERRADA de hoy en el historial (todas las cajas, fechaCaja DESC);
  // `.find` es inmune a futuros filtros por estado que reordenen la lista.
  const hoyCerrada =
    !abierta &&
    !!cierres.find((c) => c.estado === 'CERRADA' && c.fechaCaja === getColombiaDateString());

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      {/* ── Saldo inicial de caja + posición (informativo, NO ganancia) ── */}
      <SaldoInicialCajaCard salonId={salonId} user={user} />

      {/* ── Estado actual ── */}
      <div style={cardStyle}>
        {loading ? (
          <div style={{ color: 'var(--text-dim)', fontFamily: "'DM Sans', sans-serif", fontSize: '0.8125rem' }}>
            Cargando estado de caja…
          </div>
        ) : abierta ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <span style={{ background: 'rgba(92,186,123,0.12)', color: 'var(--success)', padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em' }}>
                  ABIERTA
                </span>
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  Caja abierta
                </h3>
              </div>
              {canManage && (
                <button onClick={cerrarModal} style={dangerBtnStyle}>
                  Cerrar
                </button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginTop: '0.9rem' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.2rem' }}>Monto de apertura</div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.9375rem', fontWeight: 700, color: 'var(--accent)' }}>{formatCurrency(caja?.montoInicial)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.2rem' }}>Abierta por</div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>{nombreAuditor(caja?.aperturaPorId)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.2rem' }}>Fecha</div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>{formatFechaCaja(caja?.fechaCaja)}</div>
              </div>
              {caja?.montoEsperado != null && (
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.2rem' }}>Esperado</div>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(caja.montoEsperado)}</div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div>
              <span style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em' }}>
                Caja cerrada
              </span>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '0.5rem 0 0' }}>
                {hoyCerrada
                  ? 'La caja de hoy está cerrada. Reabrí para seguir registrando ventas.'
                  : hayAbierta
                    ? 'No se puede abrir: hay una caja abierta pendiente de cierre.'
                    : 'No hay caja abierta hoy. Abrí la caja para registrar ventas.'}
              </p>
              {reabrirError && (
                <p role="alert" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.8125rem', color: 'var(--danger)', margin: '0.5rem 0 0' }}>
                  {reabrirError}
                </p>
              )}
            </div>
            {canManage &&
              (hoyCerrada ? (
                <button onClick={handleReabrir} disabled={reabrirSubmitting} style={{ ...primaryBtnStyle, opacity: reabrirSubmitting ? 0.6 : 1 }}>
                  {reabrirSubmitting ? 'Reabriendo…' : 'Reabrir caja'}
                </button>
              ) : !hayAbierta ? (
                <button onClick={abrirModal} style={primaryBtnStyle}>
                  Abrir
                </button>
              ) : null)}
          </div>
        )}
      </div>

      {/* ── Aviso: caja(s) abierta(s) de un día anterior pendientes de cierre ── */}
      {pendientes.length > 0 && (
        <div
          role="alert"
          style={{
            background: 'rgba(224,85,106,0.1)',
            border: '1px solid rgba(224,85,106,0.35)',
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', fontWeight: 700, color: 'var(--danger)' }}>
              ⚠️ Hay {pendientes.length} caja(s) abierta(s) de un día anterior pendientes de cierre
            </div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              Se cuentan todas las cajas abiertas del salón, aunque el historial esté paginado.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button
              onClick={() => handleVerDetalle(pendientes[0])}
              style={{
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--accent)',
                padding: '0.25rem 0.6rem',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '0.7rem',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Ver
            </button>
            {canManage && (
              <button
                onClick={() => cerrarModalPorId(pendientes[0])}
                style={{
                  background: 'none',
                  border: '1px solid rgba(224,85,106,0.4)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--danger)',
                  padding: '0.25rem 0.6rem',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Cerrar
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Historial ── */}
      <div style={cardStyle}>
        <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.75rem' }}>
          Historial de cajas
        </h3>

        {cierres.length === 0 ? (
          <div style={{ color: 'var(--text-dim)', fontFamily: "'DM Sans', sans-serif", fontSize: '0.8125rem', padding: '0.5rem 0' }}>
            Sin cajas registradas.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead>
                <tr>
                  {['Fecha', 'Abierta por', 'Cerrada por', 'Inicial', 'Esperado', 'Real', 'Diferencia', 'Estado', 'Acción'].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: 'left',
                        padding: '0.5rem 0.6rem',
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        color: 'var(--text-dim)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        borderBottom: '1px solid var(--border)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cierres.map((c) => {
                  const diff = c.diferencia;
                  const diffColor = diff == null ? 'var(--text-dim)' : diff < 0 ? 'var(--danger)' : diff > 0 ? '#fbbf24' : 'var(--success)';
                  return (
                    <motion.tr
                      key={c.id}
                      onClick={() => handleVerDetalle(c)}
                      whileHover={{ backgroundColor: 'rgba(212,168,83,0.07)' }}
                      style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                    >
                      <td style={{ padding: '0.55rem 0.6rem', fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatFechaCaja(c.fechaCaja)}</td>
                      <td style={{ padding: '0.55rem 0.6rem', fontSize: '0.8rem', color: 'var(--text-primary)' }}>{nombreAuditor(c.aperturaPorId)}</td>
                      <td style={{ padding: '0.55rem 0.6rem', fontSize: '0.8rem', color: 'var(--text-primary)' }}>{nombreAuditor(c.cierrePorId)}</td>
                      <td style={{ padding: '0.55rem 0.6rem', fontSize: '0.8rem', color: 'var(--text-primary)' }}>{formatCurrency(c.montoInicial)}</td>
                      <td style={{ padding: '0.55rem 0.6rem', fontSize: '0.8rem', color: 'var(--text-primary)' }}>{formatMonto(c.montoEsperado)}</td>
                      <td style={{ padding: '0.55rem 0.6rem', fontSize: '0.8rem', color: 'var(--text-primary)' }}>{formatMonto(c.montoRealEfectivo)}</td>
                      <td style={{ padding: '0.55rem 0.6rem', fontSize: '0.8rem', fontWeight: 700, color: diffColor }}>{formatMonto(diff)}</td>
                      <td style={{ padding: '0.55rem 0.6rem', fontSize: '0.75rem' }}>
                        <span style={{ ...estadoBadgeStyle(c.estado), padding: '0.15rem 0.5rem', borderRadius: '999px', fontWeight: 700 }}>{c.estado}</span>
                      </td>
                      <td style={{ padding: '0.55rem 0.6rem', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleVerDetalle(c);
                            }}
                            style={{
                              background: 'none',
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-sm)',
                              color: 'var(--accent)',
                              padding: '0.25rem 0.6rem',
                              fontFamily: "'DM Sans', sans-serif",
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Ver
                          </button>
                          {c.estado === 'CERRADA' && canManage && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReabrirPorFecha(c);
                              }}
                              style={{
                                background: 'none',
                                border: '1px solid rgba(212,168,83,0.4)',
                                borderRadius: 'var(--radius-sm)',
                                color: 'var(--accent)',
                                padding: '0.25rem 0.6rem',
                                fontFamily: "'DM Sans', sans-serif",
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              Reabrir
                            </button>
                          )}
                          {c.estado === 'ABIERTA' && canManage && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                cerrarModalPorId(c);
                              }}
                              style={{
                                background: 'none',
                                border: '1px solid rgba(224,85,106,0.4)',
                                borderRadius: 'var(--radius-sm)',
                                color: 'var(--danger)',
                                padding: '0.25rem 0.6rem',
                                fontFamily: "'DM Sans', sans-serif",
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              Cerrar
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Paginación ── */}
        <PaginationBar
          page={cierresPage}
          totalPages={cierresMeta.totalPages}
          total={cierresMeta.total}
          label="cajas"
          onPrev={() => {
            const next = cierresPage - 1;
            setCierresPage(next);
            fetchCierres(next);
          }}
          onNext={() => {
            const next = cierresPage + 1;
            setCierresPage(next);
            fetchCierres(next);
          }}
        />
      </div>

      {/* ── Modal Abrir ── */}
      <AnimatePresence>
        {abrirOpen && (
          <motion.div className="mobileBottomSheet" style={overlayStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={(e) => { if (e.target === e.currentTarget) setAbrirOpen(false); }}>
            <motion.div
              className="mobileBottomSheetContent"
              style={modalStyle}
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.25, ease: [0.22, 0.61, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>Abrir caja</span>
                <button onClick={() => setAbrirOpen(false)} aria-label="Cerrar" style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '1rem', cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ padding: '1.25rem', overflowY: 'auto' }}>
                <label htmlFor="montoInicial" style={{ display: 'block', fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Monto inicial (fondo)
                </label>
                <MoneyInput
                  id="montoInicial"
                  ariaLabel="Monto inicial"
                  value={Number(montoInicial) || 0}
                  onChange={(n) => setMontoInicial(n === 0 ? '' : String(n))}
                  placeholder="0"
                  style={inputStyle}
                />
                <label htmlFor="fechaCaja" style={{ display: 'block', fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '1rem', marginBottom: '0.35rem' }}>
                  Fecha de apertura
                </label>
                <input
                  id="fechaCaja"
                  type="date"
                  aria-label="Fecha de apertura"
                  value={fechaCaja}
                  onChange={(e) => setFechaCaja(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', padding: '1rem 1.25rem', borderTop: '1px solid var(--border)' }}>
                <button onClick={() => setAbrirOpen(false)} style={ghostBtnStyle}>Cancelar</button>
                <button onClick={handleAbrir} disabled={abrirSubmitting || montoInicial === ''} style={{ ...primaryBtnStyle, opacity: abrirSubmitting || montoInicial === '' ? 0.6 : 1 }}>
                  {abrirSubmitting ? 'Abriendo…' : 'Confirmar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal Cerrar (arqueo) ── */}
      <AnimatePresence>
        {cerrarOpen && (
          <motion.div className="mobileBottomSheet" style={overlayStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={(e) => { if (e.target === e.currentTarget) setCerrarOpen(false); }}>
            <motion.div
              className="mobileBottomSheetContent"
              style={modalStyle}
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.25, ease: [0.22, 0.61, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>Cerrar caja — Arqueo</span>
                <button onClick={() => setCerrarOpen(false)} aria-label="Cerrar" style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '1rem', cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ padding: '1.25rem', overflowY: 'auto' }}>
                {esperadoLoading ? (
                  <div style={{ color: 'var(--text-dim)', fontFamily: "'DM Sans', sans-serif", fontSize: '0.8125rem' }}>Calculando esperado…</div>
                ) : esperado ? (
                  <>
                    {/* 1. Arqueo de efectivo: lo ÚNICO que se cuenta en el cajón */}
                    <div style={{ ...arqueoGroupStyle, borderColor: 'rgba(212,168,83,0.35)' }}>
                      <div style={{ ...arqueoSectionTitleStyle, color: 'var(--accent)' }}>
                        💵 Efectivo del cajón — esto es lo que contás
                        <HelpTip
                          label="Efectivo del cajón"
                          text="Solo el efectivo: es lo único que se cuenta en el arqueo. No incluye tarjeta ni transferencia."
                        />
                      </div>

                      <div style={{ ...arqueoRowStyle, marginBottom: '0.3rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          Monto de apertura
                          <HelpTip
                            label="Monto de apertura"
                            text="Plata con la que abriste el cajón. Se arrastra de un día al otro y no se cuenta como ganancia del negocio."
                          />
                        </span>
                        <span data-testid="arqueo-monto-apertura" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(montoAperturaDe(esperado, caja))}</span>
                      </div>
                      <p style={{ ...arqueoNoteStyle, margin: '0 0 0.5rem' }}>
                        El monto de apertura es la plata con la que abriste el cajón; se arrastra de un día al otro y <strong>no se cuenta como ganancia del negocio</strong>.
                      </p>
                      <div style={{ ...arqueoRowStyle, marginBottom: '0.3rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Cobros en efectivo</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(esperado.porMetodoPago?.EFECTIVO)}</span>
                      </div>

                      <div style={{ ...arqueoRowStyle, borderTop: '1px solid var(--border)', paddingTop: '0.5rem', marginTop: '0.35rem' }}>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                          Efectivo esperado en el cajón
                          <HelpTip
                            label="Efectivo esperado en el cajón"
                            text="Efectivo que debería haber en el cajón: apertura + cobros en efectivo. Es contra esto que comparás lo que contaste."
                          />
                        </span>
                        <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent)' }}>{formatCurrency(esperado.montoEsperado)}</span>
                      </div>
                    </div>

                    {/* Conteo físico: SOLO efectivo */}
                    <div style={{ marginBottom: '1rem' }}>
                      <label htmlFor="montoReal" style={{ display: 'block', fontFamily: "'DM Sans', sans-serif", fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                        ¿Cuánto contaste en el cajón?
                      </label>
                      <MoneyInput
                        id="montoReal"
                        ariaLabel="¿Cuánto contaste en el cajón?"
                        value={Number(montoRealEfectivo) || 0}
                        onChange={(n) => setMontoRealEfectivo(n === 0 ? '' : String(n))}
                        placeholder="0"
                        style={inputStyle}
                      />
                      <p style={{ ...arqueoNoteStyle, margin: '0.4rem 0 0' }}>
                        Contá TODO el efectivo del cajón, incluido el fondo de apertura. Las transferencias y tarjeta NO van acá (no están en el cajón).
                      </p>
                    </div>

                    {diferenciaPreview !== null && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.7rem 0.9rem' }}>
                        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          Diferencia ({diferenciaPreview < 0 ? 'faltante' : diferenciaPreview > 0 ? 'sobrante' : 'cuadra'})
                          <HelpTip
                            label="Diferencia"
                            text="Lo que contaste menos lo esperado. Negativo = faltante; positivo = sobrante; 0 = cuadra."
                          />
                        </span>
                        <span
                          style={{
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: '1rem',
                            fontWeight: 800,
                            color: diferenciaPreview < 0 ? 'var(--danger)' : diferenciaPreview > 0 ? '#fbbf24' : 'var(--success)',
                          }}
                        >
                          {formatCurrency(diferenciaPreview)}
                        </span>
                      </div>
                    )}

                    {/* 2. Cobros que NO entran al cajón */}
                    <div style={arqueoGroupStyle}>
                      <div style={arqueoSectionTitleStyle}>
                        🏦 Cobros que NO van al cajón
                        <HelpTip
                          label="Cobros que NO van al cajón"
                          text="Cobros con tarjeta o transferencia: no están físicamente en el cajón y no se cuentan en el arqueo."
                        />
                      </div>
                      <p style={arqueoNoteStyle}>No se cuentan en el arqueo.</p>
                      <div style={{ ...arqueoRowStyle, marginBottom: '0.3rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Tarjeta</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(esperado.porMetodoPago?.TARJETA)}</span>
                      </div>
                      <div style={arqueoRowStyle}>
                        <span style={{ color: 'var(--text-secondary)' }}>Transferencia</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(esperado.porMetodoPago?.TRANSFERENCIA)}</span>
                      </div>
                    </div>

                    {/* 3. Información del día: NO se cuenta en el arqueo */}
                    <div style={{ ...arqueoGroupStyle, background: 'transparent', borderStyle: 'dashed', marginBottom: 0 }}>
                      <div style={arqueoSectionTitleStyle}>📊 Información del día (no se cuenta)</div>
                      <div style={{ ...arqueoRowStyle, marginBottom: '0.3rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          Total recaudado (todos los métodos)
                          <HelpTip
                            label="Total recaudado"
                            text="Todo lo recaudado en el día sumando efectivo, tarjeta y transferencia. Informativo: solo el efectivo entra al arqueo."
                          />
                        </span>
                        <span data-testid="arqueo-total-recaudado" style={{ color: 'var(--accent)', fontWeight: 800 }}>{formatCurrency(totalRecaudadoDe(esperado))}</span>
                      </div>
                      <div style={{ ...arqueoRowStyle, marginBottom: '0.6rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Gastos</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(esperado.totalGastos)}</span>
                      </div>

                      <div style={{ ...arqueoSectionTitleStyle, marginTop: '0.2rem', marginBottom: '0.4rem' }}>
                        Ingresos por tipo (neto)
                        <HelpTip
                          label="Ingresos por tipo (neto)"
                          text="Lo facturado neto de descuentos, separado en servicios y productos."
                        />
                      </div>
                      <div style={{ ...arqueoRowStyle, marginBottom: '0.3rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Servicios</span>
                        <span data-testid="arqueo-ingresos-servicios" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(ingresosServiciosDe(esperado))}</span>
                      </div>
                      <div style={arqueoRowStyle}>
                        <span style={{ color: 'var(--text-secondary)' }}>Productos</span>
                        <span data-testid="arqueo-ingresos-productos" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(ingresosProductosDe(esperado))}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ color: 'var(--danger)', fontFamily: "'DM Sans', sans-serif", fontSize: '0.8125rem' }}>
                    No se pudo calcular el esperado.
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', padding: '1rem 1.25rem', borderTop: '1px solid var(--border)' }}>
                <button onClick={() => setCerrarOpen(false)} style={ghostBtnStyle}>Cancelar</button>
                <button onClick={handleCerrar} disabled={cerrarSubmitting || montoRealEfectivo === ''} style={{ ...dangerBtnStyle, opacity: cerrarSubmitting || montoRealEfectivo === '' ? 0.6 : 1 }}>
                  {cerrarSubmitting ? 'Cerrando…' : 'Confirmar cierre'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal Reporte de Cierre ── */}
      <AnimatePresence>
        {reporte && (
          <motion.div data-testid="reporte-cierre-modal" className="mobileBottomSheet" style={overlayStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={(e) => { if (e.target === e.currentTarget) setReporte(null); }}>
            <motion.div
              className="mobileBottomSheetContent"
              style={{ ...modalStyle, maxWidth: 640 }}
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.25, ease: [0.22, 0.61, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>Reporte de cierre</span>
                <button onClick={() => setReporte(null)} aria-label="Cerrar" style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '1rem', cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ padding: '1.25rem', overflowY: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                  <span style={{ ...estadoBadgeStyle(reporte.caja.estado), padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700 }}>{reporte.caja.estado}</span>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    {formatFechaCaja(reporte.caja.fechaCaja)} · {nombreAuditor(reporte.caja.aperturaPorId)} → {nombreAuditor(reporte.caja.cierrePorId)}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem', marginBottom: '1rem' }}>
                  {[
                    { label: 'Servicios (bruto)', value: reporte.reporte.totalServicios },
                    { label: 'Productos (bruto)', value: reporte.reporte.totalProductos },
                    { label: 'Ingresos brutos', value: reporte.reporte.ingresosBrutos },
                    { label: 'Descuentos', value: reporte.reporte.descuentos },
                    { label: 'Ingresos netos', value: reporte.reporte.ingresosNetos },
                    { label: 'Comisiones', value: reporte.reporte.comisiones },
                    { label: 'Gastos', value: reporte.reporte.totalGastos },
                  ].map((f) => (
                    <div key={f.label} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.6rem 0.8rem' }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.2rem' }}>{f.label}</div>
                      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(f.value)}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'DM Sans', sans-serif", fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    Monto de apertura
                    <HelpTip
                      label="Monto de apertura"
                      text="Plata con la que abriste el cajón. Se arrastra de un día al otro y no se cuenta como ganancia del negocio."
                    />
                  </span>
                  <span data-testid="reporte-monto-apertura" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(montoAperturaDe(reporte.reporte, reporte.caja))}</span>
                </div>

                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>
                  Cobros por método
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '1rem' }}>
                  {(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'] as const).map((met) => (
                    <div key={met} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'DM Sans', sans-serif", fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{METODO_LABELS[met]}</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(reporte.reporte.porMetodoPago?.[met])}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'DM Sans', sans-serif", fontSize: '0.85rem', borderTop: '1px solid var(--border)', paddingTop: '0.4rem', marginTop: '0.15rem' }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                      Total recaudado
                      <HelpTip
                        label="Total recaudado"
                        text="Todo lo recaudado en el día sumando efectivo, tarjeta y transferencia. Informativo: solo el efectivo entra al arqueo."
                      />
                    </span>
                    <span data-testid="reporte-total-recaudado" style={{ color: 'var(--accent)', fontWeight: 800 }}>{formatCurrency(totalRecaudadoDe(reporte.reporte))}</span>
                  </div>
                </div>

                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>
                  Ingresos por tipo (neto)
                  <HelpTip
                    label="Ingresos por tipo (neto)"
                    text="Lo facturado neto de descuentos, separado en servicios y productos."
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'DM Sans', sans-serif", fontSize: '0.8rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Servicios</span>
                    <span data-testid="reporte-ingresos-servicios" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(ingresosServiciosDe(reporte.reporte))}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'DM Sans', sans-serif", fontSize: '0.8rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Productos</span>
                    <span data-testid="reporte-ingresos-productos" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(ingresosProductosDe(reporte.reporte))}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px solid var(--border)', paddingTop: '0.9rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Efectivo esperado
                      <HelpTip
                        label="Efectivo esperado"
                        text="Efectivo que debería haber en el cajón: apertura + cobros en efectivo. Es contra esto que comparás lo que contaste."
                      />
                    </span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(reporte.reporte.montoEsperado)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Monto real</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatMonto(reporte.reporte.montoReal)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'DM Sans', sans-serif", fontSize: '0.9375rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Diferencia
                      <HelpTip
                        label="Diferencia"
                        text="Lo que contaste menos lo esperado. Negativo = faltante; positivo = sobrante; 0 = cuadra."
                      />
                    </span>
                    <span
                      style={{
                        fontWeight: 800,
                        color: (reporte.reporte.diferencia ?? 0) < 0 ? 'var(--danger)' : (reporte.reporte.diferencia ?? 0) > 0 ? '#fbbf24' : 'var(--success)',
                      }}
                    >
                      {formatMonto(reporte.reporte.diferencia)}
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '1rem 1.25rem', borderTop: '1px solid var(--border)' }}>
                <button onClick={() => setReporte(null)} style={primaryBtnStyle}>Listo</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal Detalle de Cierre (historial) ── */}
      <AnimatePresence>
        {detalleOpen && (
          <motion.div data-testid="detalle-cierre-modal" className="mobileBottomSheet" style={overlayStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={(e) => { if (e.target === e.currentTarget) setDetalleOpen(false); }}>
            <motion.div
              className="mobileBottomSheetContent"
              /* Wider on desktop so the three-block chain and the movement
                 table breathe; on ≤600px the global `.mobileBottomSheetContent`
                 rule forces max-width:100% and the grid stacks. */
              style={{ ...modalStyle, maxWidth: 1120, maxHeight: '84vh' }}
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.25, ease: [0.22, 0.61, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>Detalle del cierre</span>
                <button onClick={() => setDetalleOpen(false)} aria-label="Cerrar" style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '1rem', cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ padding: '1.25rem', overflowY: 'auto' }}>
                {detalleLoading ? (
                  <div style={{ color: 'var(--text-dim)', fontFamily: "'DM Sans', sans-serif", fontSize: '0.8125rem' }}>
                    Cargando detalle…
                  </div>
                ) : detalleCierre && detalleReporte && detalleCadena ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                      <span style={{ ...estadoBadgeStyle(detalleCierre.estado), padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700 }}>{detalleCierre.estado}</span>
                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                        {formatFechaCaja(detalleCierre.fechaCaja)} · {nombreAuditor(detalleCierre.aperturaPorId)} → {nombreAuditor(detalleCierre.cierrePorId)}
                      </span>
                    </div>

                    {/* ① How much was sold: collected + fiado decomposes net sales. */}
                    <section data-testid="detalle-block-ventas" style={chainBlockStyle}>
                      <div style={chainHeaderStyle}>
                        <span style={chainNumberStyle}>1</span>
                        <div>
                          <div style={chainTitleStyle}>
                            ¿Cuánto vendiste?
                            <HelpTip
                              label="Ventas netas"
                              text="Lo facturado neto de descuentos. No es lo mismo que lo cobrado: parte pudo quedar fiada."
                            />
                          </div>
                          <div style={chainSubtitleStyle}>Ventas netas del día, después de descuentos</div>
                        </div>
                      </div>
                      <div style={chainBigRowStyle}>
                        <span style={chainBigLabelStyle}>Ventas del día (neto)</span>
                        <span data-testid="detalle-ventas-netas" style={chainBigValueStyle}>{formatCurrency(detalleCadena.ventasNetas)}</span>
                      </div>
                      <div style={chainEquationStyle}>
                        <span style={chainTermStyle}>
                          Cobrado de tus ventas de hoy
                          <strong data-testid="detalle-ventas-cobrado" style={chainTermValueStyle}>{formatCurrency(detalleCadena.cobradoHoy)}</strong>
                        </span>
                        <span style={chainOperatorStyle}>+</span>
                        <span style={chainTermStyle}>
                          Fiado del día
                          <strong data-testid="detalle-fiado-dia" style={{ ...chainTermValueStyle, color: '#fbbf24' }}>{formatCurrency(detalleCadena.fiado)}</strong>
                        </span>
                      </div>
                      <div style={{ ...chainEquationStyle, marginTop: '0.5rem', borderStyle: 'dashed' }}>
                        <span style={chainTermStyle}>
                          + Abonos de deudas viejas
                          <strong data-testid="detalle-abonos-viejos" style={{ ...chainTermValueStyle, color: 'var(--success)' }}>{formatCurrency(detalleCadena.abonosViejos)}</strong>
                        </span>
                      </div>
                      <p style={chainNoteStyle}>
                        Cobrado de tus ventas de hoy + fiado = ventas del día. Los abonos de deudas
                        viejas son plata que entró, pero <strong>no es de las ventas de hoy</strong>.
                        El fiado quedó a crédito y todavía no entró a la caja.
                      </p>
                    </section>

                    {/* ② Where the collected money is: drawer cash vs account. */}
                    <section data-testid="detalle-block-cobrado" style={chainBlockStyle}>
                      <div style={chainHeaderStyle}>
                        <span style={chainNumberStyle}>2</span>
                        <div>
                          <div style={chainTitleStyle}>
                            ¿Dónde está lo cobrado?
                            <HelpTip
                              label="Lo cobrado"
                              text="Plata que efectivamente entró por ventas del día, abonos de deudas viejas y cobros. Solo el efectivo está en el cajón."
                            />
                          </div>
                          <div style={chainSubtitleStyle}>Todo lo que entró, separado por dónde está</div>
                        </div>
                      </div>
                      <div style={chainGridStyle}>
                        <div style={chainTileStyle}>
                          <div style={chainTileTitleStyle}>💵 En caja</div>
                          <span style={chainTileLabelStyle}>Efectivo</span>
                          <span data-testid="detalle-caja-efectivo" style={{ ...chainTileValueStyle, color: 'var(--success)' }}>
                            {formatCurrency(detalleCadena.efectivo)}
                          </span>
                        </div>
                        <div style={chainTileStyle}>
                          <div style={chainTileTitleStyle}>🏦 En la cuenta</div>
                          <span style={chainTileLabelStyle}>Tarjeta + transferencia</span>
                          <span data-testid="detalle-cuenta-total" style={chainTileValueStyle}>
                            {formatCurrency(detalleCadena.enCuenta)}
                          </span>
                          <span style={chainBreakdownStyle}>
                            Tarjeta{' '}
                            <strong data-testid="detalle-cobrado-tarjeta" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(detalleCadena.tarjeta)}</strong>
                            {' · '}
                            Transferencia{' '}
                            <strong data-testid="detalle-cobrado-transferencia" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(detalleCadena.transferencia)}</strong>
                          </span>
                        </div>
                      </div>
                      <div style={{ ...chainEquationStyle, marginTop: '0.65rem' }}>
                        <span style={chainTermStyle}>En caja {formatCurrency(detalleCadena.efectivo)}</span>
                        <span style={chainOperatorStyle}>+</span>
                        <span style={chainTermStyle}>En la cuenta {formatCurrency(detalleCadena.enCuenta)}</span>
                        <span style={chainOperatorStyle}>=</span>
                        <span style={chainTermStyle}>
                          Total cobrado
                          <strong data-testid="detalle-total-recaudado" style={chainTermValueStyle}>{formatCurrency(detalleCadena.totalRecobrado)}</strong>
                        </span>
                      </div>
                      <div style={{ ...chainEquationStyle, marginTop: '0.5rem', borderStyle: 'dashed' }}>
                        <span style={chainTermStyle}>
                          Ventas de hoy {formatCurrency(detalleCadena.cobradoHoy)}
                        </span>
                        <span style={chainOperatorStyle}>+</span>
                        <span style={chainTermStyle}>
                          Abonos de deudas viejas {formatCurrency(detalleCadena.abonosViejos)}
                        </span>
                        {detalleCadena.abonosMismoDia > 0 && (
                          <>
                            <span style={chainOperatorStyle}>+</span>
                            <span style={chainTermStyle}>
                              Abonos del mismo día {formatCurrency(detalleCadena.abonosMismoDia)}
                            </span>
                          </>
                        )}
                        {detalleCadena.cobrosPrestamo > 0 && (
                          <>
                            <span style={chainOperatorStyle}>+</span>
                            <span style={chainTermStyle}>
                              Cobros de préstamos {formatCurrency(detalleCadena.cobrosPrestamo)}
                            </span>
                          </>
                        )}
                        <span style={chainOperatorStyle}>=</span>
                        <span style={chainTermStyle}>
                          Total cobrado {formatCurrency(detalleCadena.totalRecobrado)}
                        </span>
                      </div>
                      <p style={chainNoteStyle}>
                        Lo de la cuenta ya está cobrado, pero no está físicamente en el cajón y no se cuenta en el arqueo.
                      </p>
                    </section>

                    {/* ③ Drawer reconciliation: opening + cash − outflows = expected, then counted vs difference. */}
                    <section
                      data-testid="detalle-block-cuadre"
                      style={{ ...chainBlockStyle, borderColor: 'rgba(212,168,83,0.35)', background: 'linear-gradient(180deg, rgba(212,168,83,0.06), var(--bg-elevated) 45%)' }}
                    >
                      <div style={chainHeaderStyle}>
                        <span style={chainNumberStyle}>3</span>
                        <div>
                          <div style={chainTitleStyle}>
                            Cuadre de la caja
                            <HelpTip
                              label="Cuadre de la caja"
                              text="Apertura + efectivo cobrado − salidas en efectivo = lo que debería haber. Después se compara contra lo que contaste."
                            />
                          </div>
                          <div style={chainSubtitleStyle}>Cuánto debería haber y cuánto contaste</div>
                        </div>
                      </div>
                      <div style={chainEquationStyle}>
                        <span style={chainTermStyle}>
                          Apertura
                          <strong data-testid="detalle-monto-apertura" style={chainTermValueStyle}>{formatCurrency(detalleCadena.apertura)}</strong>
                        </span>
                        <span style={chainOperatorStyle}>+</span>
                        <span style={chainTermStyle}>
                          Efectivo cobrado
                          <strong style={chainTermValueStyle}>{formatCurrency(detalleCadena.efectivo)}</strong>
                        </span>
                        <span style={chainOperatorStyle}>−</span>
                        <span style={chainTermStyle}>
                          Salidas en efectivo
                          <strong data-testid="detalle-salidas-efectivo" style={chainTermValueStyle}>{formatCurrency(detalleCadena.salidasEfectivo)}</strong>
                        </span>
                        <span style={chainOperatorStyle}>=</span>
                        <span style={chainTermStyle}>
                          Debería haber
                          <strong data-testid="detalle-efectivo-esperado" style={{ ...chainTermValueStyle, fontSize: '1.05rem', color: 'var(--accent)' }}>
                            {formatCurrency(detalleCadena.esperado)}
                          </strong>
                        </span>
                      </div>
                      <div style={chainResultGridStyle}>
                        <div style={chainResultTileStyle}>
                          <div style={chainTileTitleStyle}>Contaste</div>
                          <span style={chainTileLabelStyle}>Efectivo contado al cerrar</span>
                          <span data-testid="detalle-monto-real" style={chainTileValueStyle}>{formatMonto(detalleCadena.contado)}</span>
                        </div>
                        <div style={{ ...chainResultTileStyle, borderColor: colorCuadre(detalleCadena.diferencia) }}>
                          <div style={chainTileTitleStyle}>
                            Diferencia
                            <HelpTip
                              label="Diferencia"
                              text="Lo que contaste menos lo esperado. Negativo = faltante; positivo = sobrante; 0 = cuadra."
                            />
                          </div>
                          <span data-testid="detalle-cuadre-etiqueta" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.72rem', fontWeight: 800, color: colorCuadre(detalleCadena.diferencia) }}>
                            {etiquetaCuadre(detalleCadena.diferencia)}
                          </span>
                          <span data-testid="detalle-diferencia" style={{ ...chainTileValueStyle, color: colorCuadre(detalleCadena.diferencia) }}>
                            {formatMonto(detalleCadena.diferencia)}
                          </span>
                        </div>
                      </div>
                      <p style={chainNoteStyle}>
                        Las salidas en efectivo son gastos, devoluciones y nómina pagados en efectivo. El resto de los métodos no toca el cajón.
                      </p>
                    </section>

                    {/* Secondary detail: supports the chain without competing with it. */}
                    <div style={secondaryGridStyle}>
                      <section data-testid="detalle-secundario-ventas" style={secondaryBlockStyle}>
                        <div style={secondaryTitleStyle}>Detalle de ventas</div>
                        <div style={{ ...arqueoRowStyle, marginBottom: '0.3rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Servicios (neto)</span>
                          <span data-testid="detalle-total-servicios" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(ingresosServiciosDe(detalleReporte))}</span>
                        </div>
                        <div style={{ ...arqueoRowStyle, marginBottom: '0.3rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Productos (neto)</span>
                          <span data-testid="detalle-total-productos" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(ingresosProductosDe(detalleReporte))}</span>
                        </div>
                        <div style={arqueoRowStyle}>
                          <span style={{ color: 'var(--text-secondary)' }}>Descuentos</span>
                          <span data-testid="detalle-descuentos" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(detalleReporte.descuentos)}</span>
                        </div>
                      </section>

                      <section data-testid="detalle-secundario-salidas" style={secondaryBlockStyle}>
                        <div style={secondaryTitleStyle}>Salidas registradas (todos los métodos)</div>
                        <div style={{ ...arqueoRowStyle, marginBottom: '0.3rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Gastos</span>
                          <span data-testid="detalle-gastos" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(detalleReporte.totalGastos)}</span>
                        </div>
                        <div style={{ ...arqueoRowStyle, marginBottom: '0.3rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Devoluciones</span>
                          <span data-testid="detalle-devoluciones" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(detalleReporte.totalDevoluciones ?? 0)}</span>
                        </div>
                        <div style={{ ...arqueoRowStyle, marginBottom: '0.3rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Nómina y préstamos</span>
                          <span data-testid="detalle-nomina" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(detalleReporte.totalNominaPrestamos ?? 0)}</span>
                        </div>
                        <div style={{ ...arqueoRowStyle, borderTop: '1px solid var(--border)', paddingTop: '0.45rem', marginTop: '0.35rem' }}>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Total registrado</span>
                          <span data-testid="detalle-total-salidas" style={{ color: 'var(--danger)', fontWeight: 800 }}>{formatCurrency(totalSalidasRegistradas)}</span>
                        </div>
                        <p style={{ ...arqueoNoteStyle, margin: '0.45rem 0 0' }}>
                          Informativo: solo la parte pagada en efectivo reduce el cajón.
                        </p>
                      </section>
                    </div>

                    {/* Datos de apoyo que no forman parte del flujo de caja. */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                      <span>Comisiones: <strong data-testid="detalle-comisiones" style={{ color: 'var(--text-primary)' }}>{formatCurrency(detalleReporte.comisiones)}</strong></span>
                      <span>Movimientos: <strong data-testid="detalle-movimientos" style={{ color: 'var(--text-primary)' }}>{detalleReporte.cantidadMovimientos}</strong></span>
                    </div>

                    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                        <thead>
                          <tr>
                            {['Tipo', 'Fecha', 'Descripción', 'Método', 'Monto'].map((h) => (
                              <th
                                key={h}
                                style={{
                                  textAlign: 'left',
                                  padding: '0.45rem 0.6rem',
                                  fontSize: '0.65rem',
                                  fontWeight: 600,
                                  color: 'var(--text-dim)',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.06em',
                                  borderBottom: '1px solid var(--border)',
                                  whiteSpace: 'nowrap',
                                  background: 'var(--bg-elevated)',
                                }}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {detalleMovimientos.map((m) => {
                            const metodoLabel = m.metodoPago ? METODO_LABELS[m.metodoPago] ?? m.metodoPago : '—';
                            return (
                              <tr key={`${m.tipo}-${m.id}`}>
                                <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                                  <span
                                    style={{
                                      background: m.tipo === 'SERVICIO' ? 'rgba(92,186,123,0.12)' : 'rgba(224,85,106,0.12)',
                                      color: m.tipo === 'SERVICIO' ? 'var(--success)' : 'var(--danger)',
                                      padding: '0.15rem 0.5rem',
                                      borderRadius: '999px',
                                      fontWeight: 700,
                                    }}
                                  >
                                    {m.tipo}
                                  </span>
                                </td>
                                <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatFechaMovimiento(m.fecha)}</td>
                                <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.8rem', color: 'var(--text-primary)' }}>{m.descripcion}</td>
                                <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{metodoLabel}</td>
                                <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 600, whiteSpace: 'nowrap' }}>{formatCurrency(m.monto)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div style={{ color: 'var(--danger)', fontFamily: "'DM Sans', sans-serif", fontSize: '0.8125rem' }}>
                    No se pudo cargar el detalle.
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '1rem 1.25rem', borderTop: '1px solid var(--border)' }}>
                <button onClick={() => setDetalleOpen(false)} style={primaryBtnStyle}>Listo</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default CajaTab;
