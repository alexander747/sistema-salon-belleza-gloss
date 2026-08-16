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
  ingresosBrutos: number;
  descuentos: number;
  ingresosNetos: number;
  porMetodoPago: PorMetodoPagoTotals;
  comisiones: number;
  totalGastos: number;
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
  zIndex: 200,
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
  const [abrirSubmitting, setAbrirSubmitting] = useState(false);

  /* ── Modal Cerrar (arqueo) ── */
  const [cerrarOpen, setCerrarOpen] = useState(false);
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
  }, [fetchCaja, fetchCierres, cierresPage]);

  /* ── Mount + listener caja-refresh ── */
  useEffect(() => {
    fetchCaja();
    fetchCierres(1);
    fetchEmpleadas();
    window.addEventListener(CAJA_REFRESH_EVENT, refreshAll);
    return () => window.removeEventListener(CAJA_REFRESH_EVENT, refreshAll);
  }, [fetchCaja, fetchCierres, fetchEmpleadas, refreshAll]);

  /* ── Handlers ── */
  const handleAbrir = async () => {
    if (!salonId) return;
    setAbrirSubmitting(true);
    try {
      const { data } = await api.post(`/salones/${salonId}/caja/abrir`, {
        montoInicial: Number(montoInicial),
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
      });
      setReporte(data?.data ?? null);
      setCerrarOpen(false);
      setCaja(null);
      setMontoRealEfectivo('');
      dispatchCajaRefresh();
      fetchCierres(1);
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

  const abrirModal = () => {
    setMontoInicial('');
    setAbrirOpen(true);
  };

  const cerrarModal = () => {
    setMontoRealEfectivo('');
    setEsperado(null);
    setCerrarOpen(true);
    fetchEsperado();
  };

  /* Diferencia en vivo: real − esperado (solo si hay esperado cargado) */
  const montoRealNum = montoRealEfectivo === '' ? null : Number(montoRealEfectivo);
  const diferenciaPreview =
    esperado && montoRealNum !== null ? montoRealNum - esperado.montoEsperado : null;

  const nombreAuditor = (id: number | null | undefined): string => {
    if (id == null) return '—';
    return empleadasMap.get(id) ?? `#${id}`;
  };

  /* ================================================================ */
  /*  RENDER                                                          */
  /* ================================================================ */

  const abierta = !!caja && caja.estado === 'ABIERTA';
  // La caja de HOY ya fue cerrada (p. ej. para almorzar) → se puede reabrir.
  // El historial trae las CERRADA más recientes primero; si la primera es de hoy, es esta caja.
  const hoyCerrada =
    !abierta &&
    cierres.length > 0 &&
    cierres[0].estado === 'CERRADA' &&
    cierres[0].fechaCaja === getColombiaDateString();

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
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
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.2rem' }}>Fondo inicial</div>
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
              ) : (
                <button onClick={abrirModal} style={primaryBtnStyle}>
                  Abrir
                </button>
              ))}
          </div>
        )}
      </div>

      {/* ── Historial ── */}
      <div style={cardStyle}>
        <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.75rem' }}>
          Historial de cierres
        </h3>

        {cierres.length === 0 ? (
          <div style={{ color: 'var(--text-dim)', fontFamily: "'DM Sans', sans-serif", fontSize: '0.8125rem', padding: '0.5rem 0' }}>
            Sin cierres registrados todavía.
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
                      <td style={{ padding: '0.55rem 0.6rem', fontSize: '0.8rem', color: 'var(--text-primary)' }}>{formatCurrency(c.montoEsperado)}</td>
                      <td style={{ padding: '0.55rem 0.6rem', fontSize: '0.8rem', color: 'var(--text-primary)' }}>{formatCurrency(c.montoRealEfectivo)}</td>
                      <td style={{ padding: '0.55rem 0.6rem', fontSize: '0.8rem', fontWeight: 700, color: diffColor }}>{formatCurrency(diff)}</td>
                      <td style={{ padding: '0.55rem 0.6rem', fontSize: '0.75rem' }}>
                        <span style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', padding: '0.15rem 0.5rem', borderRadius: '999px', fontWeight: 700 }}>{c.estado}</span>
                      </td>
                      <td style={{ padding: '0.55rem 0.6rem', whiteSpace: 'nowrap' }}>
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
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Paginación ── */}
        {cierresMeta.totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '0.9rem', alignItems: 'center' }}>
            <button
              disabled={cierresPage <= 1}
              onClick={() => {
                const next = cierresPage - 1;
                setCierresPage(next);
                fetchCierres(next);
              }}
              style={{
                fontSize: '0.8125rem',
                padding: '0.35rem 0.85rem',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                cursor: cierresPage <= 1 ? 'not-allowed' : 'pointer',
                opacity: cierresPage <= 1 ? 0.5 : 1,
              }}
            >
              ← Anterior
            </button>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Página {cierresMeta.page} de {cierresMeta.totalPages} ({cierresMeta.total} cierres)
            </span>
            <button
              disabled={cierresPage >= cierresMeta.totalPages}
              onClick={() => {
                const next = cierresPage + 1;
                setCierresPage(next);
                fetchCierres(next);
              }}
              style={{
                fontSize: '0.8125rem',
                padding: '0.35rem 0.85rem',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                cursor: cierresPage >= cierresMeta.totalPages ? 'not-allowed' : 'pointer',
                opacity: cierresPage >= cierresMeta.totalPages ? 0.5 : 1,
              }}
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>

      {/* ── Modal Abrir ── */}
      <AnimatePresence>
        {abrirOpen && (
          <motion.div style={overlayStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={(e) => { if (e.target === e.currentTarget) setAbrirOpen(false); }}>
            <motion.div
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
                <input
                  id="montoInicial"
                  aria-label="Monto inicial"
                  type="number"
                  min={0}
                  value={montoInicial}
                  onChange={(e) => setMontoInicial(e.target.value)}
                  placeholder="0"
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
          <motion.div style={overlayStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={(e) => { if (e.target === e.currentTarget) setCerrarOpen(false); }}>
            <motion.div
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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.7rem 0.9rem', marginBottom: '0.75rem' }}>
                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Efectivo esperado</span>
                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '1rem', fontWeight: 800, color: 'var(--accent)' }}>{formatCurrency(esperado.montoEsperado)}</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '1rem' }}>
                      {(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'] as const).map((met) => (
                        <div key={met} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'DM Sans', sans-serif", fontSize: '0.8rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{METODO_LABELS[met]}</span>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(esperado.porMetodoPago?.[met])}</span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'DM Sans', sans-serif", fontSize: '0.8rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Gastos</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(esperado.totalGastos)}</span>
                      </div>
                    </div>

                    <label htmlFor="montoReal" style={{ display: 'block', fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                      Monto real en efectivo (conteo físico)
                    </label>
                    <input
                      id="montoReal"
                      aria-label="Monto real en efectivo"
                      type="number"
                      min={0}
                      value={montoRealEfectivo}
                      onChange={(e) => setMontoRealEfectivo(e.target.value)}
                      placeholder="0"
                      style={inputStyle}
                    />

                    {diferenciaPreview !== null && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.75rem', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.7rem 0.9rem' }}>
                        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Diferencia</span>
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
          <motion.div data-testid="reporte-cierre-modal" style={overlayStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={(e) => { if (e.target === e.currentTarget) setReporte(null); }}>
            <motion.div
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
                  <span style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700 }}>CERRADA</span>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    {formatFechaCaja(reporte.caja.fechaCaja)} · {nombreAuditor(reporte.caja.aperturaPorId)} → {nombreAuditor(reporte.caja.cierrePorId)}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem', marginBottom: '1rem' }}>
                  {[
                    { label: 'Servicios', value: reporte.reporte.totalServicios },
                    { label: 'Productos', value: reporte.reporte.totalProductos },
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

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '1rem' }}>
                  {(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'] as const).map((met) => (
                    <div key={met} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'DM Sans', sans-serif", fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{METODO_LABELS[met]}</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(reporte.reporte.porMetodoPago?.[met])}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px solid var(--border)', paddingTop: '0.9rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Efectivo esperado</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(reporte.reporte.montoEsperado)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Monto real</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(reporte.reporte.montoReal)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'DM Sans', sans-serif", fontSize: '0.9375rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Diferencia</span>
                    <span
                      style={{
                        fontWeight: 800,
                        color: (reporte.reporte.diferencia ?? 0) < 0 ? 'var(--danger)' : (reporte.reporte.diferencia ?? 0) > 0 ? '#fbbf24' : 'var(--success)',
                      }}
                    >
                      {formatCurrency(reporte.reporte.diferencia)}
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
          <motion.div data-testid="detalle-cierre-modal" style={overlayStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={(e) => { if (e.target === e.currentTarget) setDetalleOpen(false); }}>
            <motion.div
              style={{ ...modalStyle, maxWidth: 640 }}
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
                ) : detalleCierre && detalleReporte ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                      <span style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700 }}>CERRADA</span>
                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                        {formatFechaCaja(detalleCierre.fechaCaja)} · {nombreAuditor(detalleCierre.aperturaPorId)} → {nombreAuditor(detalleCierre.cierrePorId)}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem', marginBottom: '1rem' }}>
                      {[
                        { label: 'Servicios', value: detalleReporte.totalServicios },
                        { label: 'Productos', value: detalleReporte.totalProductos },
                        { label: 'Ingresos brutos', value: detalleReporte.ingresosBrutos },
                        { label: 'Descuentos', value: detalleReporte.descuentos },
                        { label: 'Ingresos netos', value: detalleReporte.ingresosNetos },
                        { label: 'Comisiones', value: detalleReporte.comisiones },
                        { label: 'Gastos', value: detalleReporte.totalGastos },
                        { label: 'Movimientos', value: detalleReporte.cantidadMovimientos },
                      ].map((f) => (
                        <div key={f.label} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.6rem 0.8rem' }}>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.2rem' }}>{f.label}</div>
                          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(f.value)}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '1rem' }}>
                      {(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'] as const).map((met) => (
                        <div key={met} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'DM Sans', sans-serif", fontSize: '0.8rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{METODO_LABELS[met]}</span>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(detalleReporte.porMetodoPago?.[met])}</span>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px solid var(--border)', paddingTop: '0.9rem', marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Efectivo esperado</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(detalleReporte.montoEsperado)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Monto real</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(detalleReporte.montoReal)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'DM Sans', sans-serif", fontSize: '0.9375rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Diferencia</span>
                        <span
                          style={{
                            fontWeight: 800,
                            color: (detalleReporte.diferencia ?? 0) < 0 ? 'var(--danger)' : (detalleReporte.diferencia ?? 0) > 0 ? '#fbbf24' : 'var(--success)',
                          }}
                        >
                          {formatCurrency(detalleReporte.diferencia)}
                        </span>
                      </div>
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
