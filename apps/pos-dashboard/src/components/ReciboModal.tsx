import React from 'react';
import { formatCurrency } from '../utils/format.js';
import type { ReciboData, ReciboSalon } from '../utils/recibo.js';
import styles from './ReciboModal.module.css';

/* Re-export de tipos para que los flujos de venta tipen su estado de recibo. */
export type { ReciboData, ReciboLinea, ReciboLineaTipo, ReciboSalon } from '../utils/recibo.js';

interface ReciboModalProps {
  open: boolean;
  onClose: () => void;
  salon?: ReciboSalon | null;
  recibo: ReciboData | null;
}

/* ── Helpers de display ── */

const METODO_PAGO_LABEL: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TARJETA: 'Tarjeta',
  TRANSFERENCIA: 'Transferencia',
};

function metodoPagoLabel(metodo: string): string {
  return METODO_PAGO_LABEL[metodo] ?? metodo;
}

function formatFecha(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/* ── Component ── */

const ReciboModal: React.FC<ReciboModalProps> = ({ open, onClose, salon, recibo }) => {
  if (!open || !recibo) return null;

  const subtotal = recibo.lineas.reduce((sum, l) => sum + l.subtotal, 0);
  const salonNombre = salon?.nombre ?? null;
  const showDescuento = recibo.descuento > 0;
  const showPropina = recibo.propina > 0;
  const showPendiente = recibo.montoPendiente > 0;

  return (
    <div className={styles.overlay} role="presentation">
      <div className={styles.panel} role="dialog" aria-label="Recibo de venta">
        {/* Toolbar (no se imprime) */}
        <div className={styles.toolbar}>
          <span className={styles.toolbarTitle}>🧾 Recibo de venta</span>
          <div className={styles.toolbarActions}>
            <button
              type="button"
              className={styles.printBtn}
              onClick={() => window.print()}
              aria-label="Imprimir recibo"
            >
              🖨️ Imprimir
            </button>
            <button type="button" className={styles.closeBtn} onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>

        {/* ── Área imprimible ── */}
        <div className={styles.printArea}>
          {/* Header */}
          <div className={styles.header}>
            {salonNombre && <div className={styles.salonNombre}>{salonNombre}</div>}
            <div className={styles.titulo}>Recibo de venta</div>
            <div className={styles.metaRow}>
              {recibo.numero != null && <span>Nº {recibo.numero}</span>}
              <span data-testid="recibo-fecha">{formatFecha(recibo.fecha)}</span>
            </div>
          </div>

          {/* Datos del cliente */}
          <div className={styles.dataGrid}>
            <div>
              <div className={styles.dataLabel}>Cliente</div>
              <div className={styles.dataValue}>{recibo.clienteNombre}</div>
            </div>
            <div>
              <div className={styles.dataLabel}>Empleada</div>
              <div className={styles.dataValue}>{recibo.empleadaNombre}</div>
            </div>
          </div>

          {/* Líneas */}
          <table className={styles.lineasTable}>
            <thead>
              <tr>
                <th className={styles.colDesc}>Descripción</th>
                <th className={styles.colCant}>Cant.</th>
                <th className={styles.colPrecio}>P. unit.</th>
                <th className={styles.colSubtotal}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {recibo.lineas.map((l, idx) => (
                <tr key={`${l.tipo}-${l.nombre}-${idx}`}>
                  <td className={styles.colDesc}>
                    <span className={l.tipo === 'PRODUCTO' ? styles.badgeProducto : styles.badgeServicio}>
                      {l.tipo === 'PRODUCTO' ? 'P' : 'S'}
                    </span>
                    {l.nombre}
                  </td>
                  <td className={styles.colCant}>{l.cantidad}</td>
                  <td className={styles.colPrecio}>{formatCurrency(l.precio)}</td>
                  <td className={styles.colSubtotal}>{formatCurrency(l.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totales */}
          <div className={styles.totales}>
            <div className={styles.totalRow}>
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {showDescuento && (
              <div className={styles.totalRow}>
                <span>
                  {recibo.descuentoPorcentaje
                    ? `Descuento (${recibo.descuentoPorcentaje}%)`
                    : 'Descuento'}
                </span>
                <span className={styles.descuentoVal}>-{formatCurrency(recibo.descuento)}</span>
              </div>
            )}
            {showPropina && (
              <div className={styles.totalRow}>
                <span>Propina</span>
                <span className={styles.propinaVal}>+{formatCurrency(recibo.propina)}</span>
              </div>
            )}
            <div className={styles.totalRowFinal}>
              <span>Total</span>
              <span>{formatCurrency(recibo.total)}</span>
            </div>
            {showPendiente && (
              <div className={styles.totalRow}>
                <span>Pendiente</span>
                <span className={styles.pendienteVal}>{formatCurrency(recibo.montoPendiente)}</span>
              </div>
            )}
          </div>

          {/* Pago */}
          <div className={styles.pagoRow}>
            <span>Método de pago</span>
            <span>{metodoPagoLabel(recibo.metodoPago)}</span>
          </div>

          <div className={styles.footer}>¡Gracias por tu visita! 💛</div>
        </div>
      </div>
    </div>
  );
};

export default ReciboModal;
