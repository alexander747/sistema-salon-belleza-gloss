import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Skeleton } from '@pos-final/ui';
import { type IUser } from '@pos-final/types';
import api from '../services/api.js';
import { prestamoService, type Prestamo, type PagoPrestamo } from '../services/prestamoService.js';
import SalonSwitcher from '../components/SalonSwitcher.js';
import styles from './PrestamosPage.module.css';

/* ── Types ── */

interface Empleada {
  id: number;
  nombre: string;
}

/* ── Constants ── */

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

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
  whiteSpace: 'nowrap',
};

const ghostBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)',
  padding: '0.5rem 1.25rem',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.8125rem',
  cursor: 'pointer',
  transition: 'background 0.2s',
};

/* ── Helpers ── */

function getEstadoBadgeClass(estado: string): string {
  switch (estado) {
    case 'ACTIVO':
      return `${styles.badge} ${styles.badgeWarning}`;
    case 'PAGADO':
      return `${styles.badge} ${styles.badgeSuccess}`;
    case 'CANCELADO':
      return `${styles.badge} ${styles.badgeDanger}`;
    default:
      return styles.badge;
  }
}

function getTipoPagoBadgeClass(tipo: string): string {
  return tipo === 'LIQUIDACION'
    ? `${styles.badge} ${styles.badgeInfo}`
    : `${styles.badge} ${styles.badgeWarning}`;
}

/* ================================================================ */
/*  MAIN COMPONENT                                                    */
/* ================================================================ */

const PrestamosPage: React.FC = () => {
  const [user, setUser] = useState<IUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPagosModal, setShowPagosModal] = useState<number | null>(null);
  const [selectedPrestamo, setSelectedPrestamo] = useState<{
    id: number;
    pagos: PagoPrestamo[];
    saldoPendiente: number;
    nombreDeudor: string;
  } | null>(null);
  const [empleadas, setEmpleadas] = useState<Empleada[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formTipo, setFormTipo] = useState<'empleado' | 'tercero'>('empleado');
  const [formUsuarioId, setFormUsuarioId] = useState<number | ''>('');
  const [formNombreTercero, setFormNombreTercero] = useState('');
  const [formMonto, setFormMonto] = useState('');
  const [formMotivo, setFormMotivo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Pago form state
  const [pagoMonto, setPagoMonto] = useState('');
  const [pagoObservacion, setPagoObservacion] = useState('');
  const [submittingPago, setSubmittingPago] = useState(false);

  const salonId = useMemo(() => {
    const stored = localStorage.getItem('xSalonId');
    if (stored) return Number(stored);
    if (user?.salonId) return user.salonId;
    return 1; // fallback
  }, [user]);

  /* ── Auth ── */
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data } = await api.get('/auth/me');
        // /auth/me devuelve el usuario directamente, no { user: ... }
        if (data?.id) {
          setUser(data);
        } else {
          console.warn('Auth response sin usuario:', data);
          // No redirigir - ya estamos dentro de ProtectedRoute
        }
      } catch (err) {
        console.warn('Error auth check:', err);
        // No redirigir - ya estamos dentro de ProtectedRoute
      } finally {
        setAuthLoading(false);
      }
    };
    checkAuth();
  }, []);

  const fetchPrestamos = useCallback(async () => {
    if (!salonId) return;
    try {
      setLoading(true);
      setError(null);
      const result = await prestamoService.getPrestamos({ limit: 100 });
      setPrestamos(result.data);
    } catch (err) {
      console.error('Error fetching prestamos:', err);
      setError('Error al cargar préstamos');
    } finally {
      setLoading(false);
    }
  }, [salonId]);

  const fetchEmpleadas = useCallback(async () => {
    if (!salonId) return;
    try {
      const { data } = await api.get(`/salones/${salonId}/empleadas`);
      setEmpleadas(data ?? []);
    } catch (err) {
      console.error('Error fetching empleadas:', err);
    }
  }, [salonId]);

  useEffect(() => {
    if (salonId) {
      fetchPrestamos();
      fetchEmpleadas();
    }
  }, [salonId, fetchPrestamos, fetchEmpleadas]);

  /* ── Summary stats ── */
  const stats = useMemo(() => {
    const totalPrestamos = prestamos.length;
    const totalMonto = prestamos.reduce((sum, p) => sum + Number(p.monto), 0);
    const totalSaldoPendiente = prestamos.reduce((sum, p) => sum + Number(p.saldoPendiente), 0);
    const activos = prestamos.filter((p) => p.estado === 'ACTIVO').length;
    return { totalPrestamos, totalMonto, totalSaldoPendiente, activos };
  }, [prestamos]);

  /* ── Handlers ── */
  const handleCreate = async () => {
    if (!salonId) return;
    setSubmitting(true);
    setError(null);
    try {
      await prestamoService.createPrestamo({
        usuarioId: formTipo === 'empleado' ? (formUsuarioId || null) : null,
        nombreTercero: formTipo === 'tercero' ? formNombreTercero : null,
        monto: Number(formMonto),
        motivo: formMotivo || undefined,
      });
      setShowCreateModal(false);
      resetForm();
      await fetchPrestamos();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Error al crear préstamo');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormTipo('empleado');
    setFormUsuarioId('');
    setFormNombreTercero('');
    setFormMonto('');
    setFormMotivo('');
    setError(null);
  };

  const openPagosModal = async (prestamoId: number) => {
    try {
      const detalle = await prestamoService.getPrestamo(prestamoId);
      setSelectedPrestamo({
        id: detalle.id,
        pagos: detalle.pagos,
        saldoPendiente: detalle.saldoPendiente,
        nombreDeudor: detalle.nombreEmpleado ?? detalle.nombreTercero ?? 'Desconocido',
      });
      setPagoMonto(String(detalle.saldoPendiente));
      setPagoObservacion('');
      setShowPagosModal(prestamoId);
    } catch (err) {
      setError('Error al cargar detalle del préstamo');
    }
  };

  const handlePago = async () => {
    if (!showPagosModal) return;
    setSubmittingPago(true);
    setError(null);
    try {
      await prestamoService.registrarPago(showPagosModal, {
        monto: Number(pagoMonto),
        observacion: pagoObservacion || undefined,
      });
      setShowPagosModal(null);
      setSelectedPrestamo(null);
      await fetchPrestamos();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Error al registrar pago');
    } finally {
      setSubmittingPago(false);
    }
  };

  const handleCancelar = async (id: number) => {
    if (!confirm('¿Estás segura de cancelar este préstamo?')) return;
    try {
      await prestamoService.cancelarPrestamo(id);
      await fetchPrestamos();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Error al cancelar préstamo');
    }
  };

  if (authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: "'DM Sans', sans-serif", color: 'var(--text-secondary)' }}>
        Cargando...
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      {/* Header */}
      <div className={styles.toolbar}>
        <div>
          <h1
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '1.5rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            Préstamos
          </h1>
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '0.8125rem',
              color: 'var(--text-secondary)',
              margin: '0.25rem 0 0',
            }}
          >
            Gestiona los préstamos a empleadas y terceros
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <SalonSwitcher userSalonId={salonId ?? 0} />
          <button
            style={primaryBtnStyle}
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
          >
            + Nuevo préstamo
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Total préstamos</span>
          <span className={styles.summaryValue}>{stats.totalPrestamos}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Monto total prestado</span>
          <span className={`${styles.summaryValue} ${styles.summaryValueAccent}`}>
            {currencyFormatter.format(stats.totalMonto)}
          </span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Saldo pendiente</span>
          <span className={`${styles.summaryValue} ${styles.summaryValueDanger}`}>
            {currencyFormatter.format(stats.totalSaldoPendiente)}
          </span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Préstamos activos</span>
          <span className={`${styles.summaryValue} ${styles.summaryValueSuccess}`}>
            {stats.activos}
          </span>
        </div>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              background: 'rgba(224, 85, 106, 0.08)',
              border: '1px solid rgba(224, 85, 106, 0.2)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '0.8125rem',
              color: 'var(--danger)',
            }}
          >
            {error}
            <button
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--danger)',
                fontSize: '1rem',
                cursor: 'pointer',
                padding: '0 0.25rem',
              }}
              onClick={() => setError(null)}
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} height={56} />
          ))}
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead className={styles.tableHead}>
              <tr>
                <th>Deudor</th>
                <th>Monto</th>
                <th>Saldo pendiente</th>
                <th>Estado</th>
                <th>Motivo</th>
                <th>Fecha</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {prestamos.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className={styles.emptyState}>
                      <div className={styles.emptyIcon}>💰</div>
                      <h3 className={styles.emptyTitle}>Sin préstamos</h3>
                      <p className={styles.emptySubtitle}>
                        No hay préstamos registrados. Crea uno nuevo para comenzar.
                      </p>
                      <button
                        style={primaryBtnStyle}
                        onClick={() => {
                          resetForm();
                          setShowCreateModal(true);
                        }}
                      >
                        Crear primer préstamo
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                prestamos.map((p) => (
                  <tr key={p.id} className={styles.tableRow}>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                        <span style={{ fontWeight: 600 }}>
                          {p.nombreEmpleado ?? p.nombreTercero ?? '-'}
                        </span>
                        {p.nombreEmpleado && p.nombreTercero && (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              color: 'var(--text-dim)',
                            }}
                          >
                            {p.nombreTercero}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>{currencyFormatter.format(Number(p.monto))}</td>
                    <td>
                      <span
                        style={{
                          fontWeight: 600,
                          color:
                            Number(p.saldoPendiente) > 0
                              ? 'var(--accent)'
                              : 'var(--success)',
                        }}
                      >
                        {currencyFormatter.format(Number(p.saldoPendiente))}
                      </span>
                    </td>
                    <td>
                      <span className={getEstadoBadgeClass(p.estado)}>{p.estado}</span>
                    </td>
                    <td>
                      <span
                        style={{
                          color: p.motivo ? 'var(--text-primary)' : 'var(--text-dim)',
                          fontStyle: p.motivo ? 'normal' : 'italic',
                        }}
                      >
                        {p.motivo || 'Sin motivo'}
                      </span>
                    </td>
                    <td>
                      {new Date(p.fechaCreacion).toLocaleDateString('es-CO', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                        <button
                          className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                          onClick={() => openPagosModal(p.id)}
                          title="Ver pagos"
                        >
                          Pagos
                        </button>
                        {p.estado === 'ACTIVO' && (
                          <button
                            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                            onClick={() => handleCancelar(p.id)}
                            title="Cancelar préstamo"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              className={styles.modalContent}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <h2 className={styles.modalTitle}>Nuevo préstamo</h2>
                <button
                  className={styles.modalCloseBtn}
                  onClick={() => setShowCreateModal(false)}
                >
                  ×
                </button>
              </div>

              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Tipo de deudor</label>
                  <div className={styles.radioGroup}>
                    <label className={styles.radioLabel}>
                      <input
                        type="radio"
                        value="empleado"
                        checked={formTipo === 'empleado'}
                        onChange={() => setFormTipo('empleado')}
                      />
                      Empleada
                    </label>
                    <label className={styles.radioLabel}>
                      <input
                        type="radio"
                        value="tercero"
                        checked={formTipo === 'tercero'}
                        onChange={() => setFormTipo('tercero')}
                      />
                      Tercero
                    </label>
                  </div>
                </div>

                {formTipo === 'empleado' ? (
                  <div className={styles.formGroup}>
                    <label className={`${styles.formLabel} ${styles.formRequired}`}>
                      Empleada
                    </label>
                    <select
                      value={formUsuarioId}
                      onChange={(e) =>
                        setFormUsuarioId(e.target.value ? Number(e.target.value) : '')
                      }
                      className={styles.formSelect}
                    >
                      <option value="">Seleccionar empleada...</option>
                      {empleadas.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className={styles.formGroup}>
                    <label className={`${styles.formLabel} ${styles.formRequired}`}>
                      Nombre del tercero
                    </label>
                    <input
                      type="text"
                      value={formNombreTercero}
                      onChange={(e) => setFormNombreTercero(e.target.value)}
                      className={styles.formInput}
                      placeholder="Nombre completo"
                    />
                  </div>
                )}

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={`${styles.formLabel} ${styles.formRequired}`}>
                      Monto
                    </label>
                    <input
                      type="number"
                      value={formMonto}
                      onChange={(e) => setFormMonto(e.target.value)}
                      className={styles.formInput}
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Motivo (opcional)</label>
                    <input
                      type="text"
                      value={formMotivo}
                      onChange={(e) => setFormMotivo(e.target.value)}
                      className={styles.formInput}
                      placeholder="Ej: Adelanto de sueldo"
                    />
                  </div>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button style={ghostBtnStyle} onClick={() => setShowCreateModal(false)}>
                  Cancelar
                </button>
                <button
                  style={{
                    ...primaryBtnStyle,
                    opacity:
                      submitting ||
                      !formMonto ||
                      Number(formMonto) <= 0 ||
                      (formTipo === 'empleado' && !formUsuarioId) ||
                      (formTipo === 'tercero' && !formNombreTercero)
                        ? 0.5
                        : 1,
                    cursor:
                      submitting ||
                      !formMonto ||
                      Number(formMonto) <= 0 ||
                      (formTipo === 'empleado' && !formUsuarioId) ||
                      (formTipo === 'tercero' && !formNombreTercero)
                        ? 'not-allowed'
                        : 'pointer',
                  }}
                  onClick={handleCreate}
                  disabled={
                    submitting ||
                    !formMonto ||
                    Number(formMonto) <= 0 ||
                    (formTipo === 'empleado' && !formUsuarioId) ||
                    (formTipo === 'tercero' && !formNombreTercero)
                  }
                >
                  {submitting ? 'Creando...' : 'Crear préstamo'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pagos Modal */}
      <AnimatePresence>
        {showPagosModal && selectedPrestamo && (
          <motion.div
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setShowPagosModal(null);
              setSelectedPrestamo(null);
            }}
          >
            <motion.div
              className={`${styles.modalContent} ${styles.modalContentWide}`}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <h2 className={styles.modalTitle}>
                  Pagos — {selectedPrestamo.nombreDeudor}
                </h2>
                <button
                  className={styles.modalCloseBtn}
                  onClick={() => {
                    setShowPagosModal(null);
                    setSelectedPrestamo(null);
                  }}
                >
                  ×
                </button>
              </div>

              <div className={styles.modalBody}>
                {/* Saldo pendiente */}
                <div className={styles.pagoResumen}>
                  <div>
                    <div className={styles.pagoResumenLabel}>Saldo pendiente</div>
                  </div>
                  <div className={styles.pagoResumenValue}>
                    {currencyFormatter.format(Number(selectedPrestamo.saldoPendiente))}
                  </div>
                </div>

                {/* Historial */}
                <h3 className={styles.sectionTitle}>Historial de pagos</h3>
                {selectedPrestamo.pagos.length === 0 ? (
                  <div className={styles.emptyState} style={{ padding: '2rem' }}>
                    <div className={styles.emptyIcon}>📋</div>
                    <p className={styles.emptySubtitle}>Sin pagos registrados</p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className={styles.historyTable}>
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Monto</th>
                          <th>Tipo</th>
                          <th>Observación</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPrestamo.pagos.map((pago) => (
                          <tr key={pago.id}>
                            <td>
                              {new Date(pago.fechaPago).toLocaleDateString('es-CO', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </td>
                            <td style={{ fontWeight: 600 }}>
                              {currencyFormatter.format(Number(pago.monto))}
                            </td>
                            <td>
                              <span className={getTipoPagoBadgeClass(pago.tipoPago)}>
                                {pago.tipoPago === 'LIQUIDACION' ? 'Liquidación' : 'Manual'}
                              </span>
                            </td>
                            <td
                              style={{
                                color: pago.observacion
                                  ? 'var(--text-primary)'
                                  : 'var(--text-dim)',
                                fontStyle: pago.observacion ? 'normal' : 'italic',
                              }}
                            >
                              {pago.observacion || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Registrar pago */}
                {selectedPrestamo.saldoPendiente > 0 && (
                  <>
                    <h3 className={styles.sectionTitle}>Registrar pago manual</h3>
                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <label className={`${styles.formLabel} ${styles.formRequired}`}>
                          Monto
                        </label>
                        <input
                          type="number"
                          value={pagoMonto}
                          onChange={(e) => setPagoMonto(e.target.value)}
                          className={styles.formInput}
                          min="0"
                          step="0.01"
                          max={selectedPrestamo.saldoPendiente}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Observación</label>
                        <input
                          type="text"
                          value={pagoObservacion}
                          onChange={(e) => setPagoObservacion(e.target.value)}
                          className={styles.formInput}
                          placeholder="Ej: Pago en efectivo"
                        />
                      </div>
                    </div>
                    <button
                      style={{
                        ...primaryBtnStyle,
                        opacity:
                          submittingPago || !pagoMonto || Number(pagoMonto) <= 0 ? 0.5 : 1,
                        cursor:
                          submittingPago || !pagoMonto || Number(pagoMonto) <= 0
                            ? 'not-allowed'
                            : 'pointer',
                      }}
                      onClick={handlePago}
                      disabled={submittingPago || !pagoMonto || Number(pagoMonto) <= 0}
                    >
                      {submittingPago ? 'Registrando...' : 'Registrar pago'}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PrestamosPage;
