import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { formatCurrency } from '../utils/format.js';
import { alcanceLabel, type DescuentoAlcance } from '../utils/reparto.js';
import type { LineaProducto, LineaServicio, UseCarritoReturn } from '../hooks/useCarrito.js';
import styles from './CarritoVenta.module.css';

/* ── Shared cart presentation ──
 *
 * ONE component rendered by both "Registrar servicio" (WalkInModal) and
 * "Ventas" (VentasPage). It owns the cart's items list (services + products),
 * the optional discount/notes sections (behind switches), the discount scope
 * selector and the totals. The surrounding chrome (wizard, side panel, client/
 * employee/payment blocks) stays per-screen and is injected through slots.
 *
 * It reads/writes the shared `useCarrito` hook; the screen keeps ownership of
 * the hook instance and the API payloads stay unchanged.
 */

const FORM_LABEL: React.CSSProperties = {
  display: 'block',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.75rem',
  fontWeight: 500,
  color: 'var(--text-secondary)',
  marginBottom: '0.3rem',
  letterSpacing: '0.02em',
};

/** Quantity stepper buttons: 40×40 touch target on every screen. */
const QTY_BTN: React.CSSProperties = {
  background: 'var(--bg-base)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)',
  minWidth: '40px',
  minHeight: '40px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  fontSize: '0.875rem',
  lineHeight: 1,
  padding: 0,
};

const QTY_COUNT: React.CSSProperties = {
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.8125rem',
  fontWeight: 600,
  color: 'var(--text-primary)',
  minWidth: '20px',
  textAlign: 'center',
};

const ALCANCE_LABELS: Record<DescuentoAlcance, string> = {
  SERVICIOS: 'Servicios',
  PRODUCTOS: 'Productos',
  AMBOS: 'Ambos',
};

export interface CarritoVentaProps {
  /** Shared cart hook instance owned by the screen. */
  carrito: UseCarritoReturn;
  /** Empty-state text (differs per screen). */
  emptyText: string;
  /** WalkIn: show "Subtotal servicios"/"Subtotal productos"; Ventas: single "Subtotal". */
  mostrarSubtotalesLinea?: boolean;
  /** WalkIn: show the general notes switch + textarea. */
  mostrarNotas?: boolean;
  /** Screen chrome rendered right after the items list (Fechas/Cliente/Empleada). */
  afterItems?: React.ReactNode;
  /**
   * Screen chrome injected between the items list and the discount section.
   * Kept per-screen; when both `afterItems` and `children` are given they render
   * in that order.
   */
  children?: React.ReactNode;
  /** Screen chrome rendered between the discount section and the totals (payment). */
  beforeTotals?: React.ReactNode;
  /** Extra total rows rendered at the top of the totals (e.g. per-kind rows). */
  beforeSubtotal?: React.ReactNode;
  /** Screen chrome rendered right after the totals (e.g. the reparto breakdown). */
  afterTotals?: React.ReactNode;
  /** Heading rendered at the top of the items list (e.g. "En carrito (N)"). */
  itemsHeader?: React.ReactNode;
  /**
   * Replaces the default rendering of a service line (Agenda needs the
   * "not performed" toggle, the read-only supply cost and its own labels).
   */
  renderServicioItem?: (item: LineaServicio) => React.ReactNode;
  /** Replaces the default rendering of a product line. */
  renderProductoItem?: (item: LineaProducto) => React.ReactNode;
  /**
   * Screen chrome rendered right after the items list and before `afterItems`
   * (e.g. the product catalog grid + barcode scanner on Agenda).
   */
  productPicker?: React.ReactNode;
  /** When true the component pads itself horizontally (Ventas side panel). */
  withPadding?: boolean;
}

const CarritoVenta: React.FC<CarritoVentaProps> = ({
  carrito,
  emptyText,
  mostrarSubtotalesLinea = false,
  mostrarNotas = false,
  afterItems,
  children,
  beforeTotals,
  afterTotals,
  beforeSubtotal,
  itemsHeader,
  renderServicioItem,
  renderProductoItem,
  productPicker,
  withPadding = false,
}) => {
  /* Optional sections behind switches (hidden by default, matching both screens). */
  const [descuentoActivo, setDescuentoActivo] = useState(false);
  const [notasActivo, setNotasActivo] = useState(false);

  const {
    servicios,
    productos,
    updateServicioQty,
    updateServicioPrecio,
    updateServicioGramos,
    removeServicio,
    updateProductoQty,
    updateProductoPrecio,
    removeProducto,
    totalServicios,
    totalProductos,
    subtotal,
    descuento,
    setDescuento,
    descuentoAlcance,
    setDescuentoAlcance,
    alcancesAplicables,
    notaAjuste,
    setNotaAjuste,
    notas,
    setNotas,
    propina,
    descuentoMonto,
    finalTotal,
    hasAdjustment,
    ajusteNoteRequired,
  } = carrito;

  const vacio = servicios.length === 0 && productos.length === 0;

  return (
    <div
      className={styles.raiz}
      style={withPadding ? ({ '--carrito-pad': '1.25rem' } as React.CSSProperties) : undefined}
    >
      {/* ── Items list ── */}
      <div className={styles.section}>
        {itemsHeader}
        {vacio ? (
          <p className={styles.emptyText}>{emptyText}</p>
        ) : (
          <div className={styles.cartList}>
            {servicios.map((item) => {
              if (renderServicioItem) {
                return (
                  <React.Fragment key={`svc-${item.servicioId}`}>
                    {renderServicioItem(item)}
                  </React.Fragment>
                );
              }
              const gramosLinea = item.gramosUsados ?? 0;
              const costoInsumoLinea = gramosLinea * (item.precioPorGramo ?? 0);
              return (
                <motion.div
                  key={`svc-${item.servicioId}`}
                  layout
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className={styles.cartItem}
                >
                  <div className={styles.cartItemInfo}>
                    <div className={styles.itemNameRow}>
                      <span className={`${styles.badge} ${styles.badgeServicio}`}>S</span>
                      <div className={`${styles.cartItemName} ${styles.cartItemNameWrap}`}>
                        {item.nombre}
                      </div>
                    </div>
                    <div className={styles.cartItemDuration}>{item.duracionMinutos} min</div>
                    <div className={styles.priceRow}>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        inputMode="decimal"
                        aria-label={`Precio ${item.nombre}`}
                        value={item.precio}
                        onChange={(e) =>
                          updateServicioPrecio(item.servicioId, Number(e.target.value))
                        }
                        className={`${styles.noSpinner} ${styles.priceInput}`}
                        title="Precio unitario"
                      />
                    </div>
                  </div>
                  <div className={styles.qtyControls}>
                    <button
                      type="button"
                      aria-label={`Quitar ${item.nombre}`}
                      onClick={() => updateServicioQty(item.servicioId, -1)}
                      style={QTY_BTN}
                    >
                      −
                    </button>
                    <span aria-label={`Cantidad ${item.nombre}`} style={QTY_COUNT}>
                      {item.cantidad}
                    </span>
                    <button
                      type="button"
                      aria-label={`Agregar ${item.nombre}`}
                      onClick={() => updateServicioQty(item.servicioId, 1)}
                      style={QTY_BTN}
                    >
                      +
                    </button>
                  </div>
                  <span className={styles.lineTotal}>
                    {formatCurrency(item.precio * item.cantidad)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeServicio(item.servicioId)}
                    className={styles.removeBtn}
                  >
                    ✕
                  </button>
                  {item.tipoCostoInsumo === 'POR_GRAMO' && (
                    <div className={styles.gramsField}>
                      <div className={styles.gramsPair}>
                        <label
                          className={styles.gramsLabel}
                          htmlFor={`gramos-svc-${item.servicioId}`}
                        >
                          Gramos usados
                        </label>
                        <div className={styles.gramsInputWrap}>
                          <input
                            id={`gramos-svc-${item.servicioId}`}
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            aria-label={`Gramos usados ${item.nombre}`}
                            placeholder="0"
                            value={item.gramosUsados ?? ''}
                            onChange={(e) =>
                              updateServicioGramos(
                                item.servicioId,
                                e.target.value === '' ? undefined : Number(e.target.value),
                              )
                            }
                            className={styles.gramsInput}
                          />
                          <span className={styles.gramsSuffix}>g</span>
                        </div>
                      </div>
                      <div className={styles.gramsPair}>
                        <span className={styles.gramsLabel}>Costo de insumos</span>
                        <span
                          className={styles.gramsCostValue}
                          aria-label={`Costo de insumos ${item.nombre}`}
                        >
                          {costoInsumoLinea > 0 ? formatCurrency(costoInsumoLinea) : '—'}
                        </span>
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}

            {productos.map((item) => {
              if (renderProductoItem) {
                return (
                  <React.Fragment key={`prod-${item.productoId}`}>
                    {renderProductoItem(item)}
                  </React.Fragment>
                );
              }
              return (
              <motion.div
                key={`prod-${item.productoId}`}
                layout
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className={styles.cartItem}
              >
                <div className={styles.cartItemInfo}>
                  <div className={styles.itemNameRow}>
                    <span className={`${styles.badge} ${styles.badgeProducto}`}>P</span>
                    <div className={styles.cartItemName}>{item.nombre}</div>
                  </div>
                  <div className={styles.priceRow}>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      inputMode="decimal"
                      aria-label={`Precio ${item.nombre}`}
                      value={item.precioVenta}
                      onChange={(e) =>
                        updateProductoPrecio(item.productoId, Number(e.target.value))
                      }
                      className={`${styles.noSpinner} ${styles.priceInput}`}
                      title="Precio unitario"
                    />
                    <span>× {item.cantidad}</span>
                  </div>
                </div>
                <div className={styles.qtyControls}>
                  <button
                    type="button"
                    onClick={() => updateProductoQty(item.productoId, -1)}
                    style={QTY_BTN}
                  >
                    −
                  </button>
                  <span style={QTY_COUNT}>{item.cantidad}</span>
                  <button
                    type="button"
                    onClick={() => updateProductoQty(item.productoId, 1)}
                    style={QTY_BTN}
                  >
                    +
                  </button>
                </div>
                <span className={styles.lineTotal}>
                  {formatCurrency(item.precioVenta * item.cantidad)}
                </span>
                <button
                  type="button"
                  onClick={() => removeProducto(item.productoId)}
                  className={styles.removeBtn}
                >
                  ✕
                </button>
              </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {productPicker}
      {afterItems}
      {children}

      {/* ── Price adjustments: discount + notes (behind switches) ── */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Ajustes de precio</div>

        <div style={{ marginBottom: '0.5rem' }}>
          <label className={styles.switchLabel}>
            <input
              type="checkbox"
              checked={descuentoActivo}
              onChange={(e) => {
                setDescuentoActivo(e.target.checked);
                if (!e.target.checked) setDescuento(0);
              }}
            />
            <span className={styles.switchSlider} />
            <span className={styles.switchLabelText}>Agregar descuento por %</span>
          </label>

          {descuentoActivo && (
            <div style={{ marginTop: '0.5rem' }}>
              <label style={FORM_LABEL}>Descuento (%)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={descuento || ''}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setDescuento(Math.min(100, Math.max(0, val)));
                  }}
                  placeholder="0"
                  aria-label="Descuento (%)"
                  className={styles.noSpinner}
                  style={{
                    width: '100%',
                    maxWidth: '100px',
                    height: '38px',
                    padding: '0 0.7rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-base)',
                    color: 'var(--text-primary)',
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '0.8125rem',
                    outline: 'none',
                  }}
                />
                <span
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  %
                </span>
              </div>

              {/* Scope: only the scopes that actually apply to this cart. */}
              {alcancesAplicables.length > 0 && (
                <>
                  <label style={{ ...FORM_LABEL, marginTop: '0.5rem' }}>Aplicar a</label>
                  <div className={styles.scopeRow}>
                    {alcancesAplicables.map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-label={`Alcance ${ALCANCE_LABELS[value]}`}
                        onClick={() => setDescuentoAlcance(value)}
                        className={`${styles.typeFilterBtn} ${
                          descuentoAlcance === value ? styles.typeFilterBtnActive : ''
                        }`}
                      >
                        {ALCANCE_LABELS[value]}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {hasAdjustment && (
          <div>
            <label
              style={{ ...FORM_LABEL, color: ajusteNoteRequired ? 'var(--danger)' : undefined }}
            >
              ¿Por qué se ajustó el precio? *
            </label>
            <textarea
              value={notaAjuste}
              onChange={(e) => setNotaAjuste(e.target.value)}
              placeholder="Indicá el motivo del ajuste..."
              className={styles.notesInput}
              style={{ borderColor: ajusteNoteRequired ? 'var(--danger)' : undefined }}
            />
            {ajusteNoteRequired && (
              <span className={styles.errorText}>
                Este campo es obligatorio cuando hay descuento.
              </span>
            )}
          </div>
        )}

        {mostrarNotas && (
          <div style={{ marginTop: '0.5rem' }}>
            <label className={styles.switchLabel}>
              <input
                type="checkbox"
                checked={notasActivo}
                onChange={(e) => {
                  setNotasActivo(e.target.checked);
                  if (!e.target.checked) setNotas('');
                }}
              />
              <span className={styles.switchSlider} />
              <span className={styles.switchLabelText}>Agregar notas</span>
            </label>
            {notasActivo && (
              <div style={{ marginTop: '0.5rem' }}>
                <label style={FORM_LABEL}>Notas (opcional)</label>
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Notas adicionales…"
                  className={styles.notesInput}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {beforeTotals}

      {/* ── Totals ── */}
      <div className={styles.totalsSection}>
        {beforeSubtotal}
        {mostrarSubtotalesLinea ? (
          <>
            <div className={styles.totalRow}>
              <span>Subtotal servicios</span>
              <span>{formatCurrency(totalServicios)}</span>
            </div>
            <div className={styles.totalRow}>
              <span>Subtotal productos</span>
              <span>{formatCurrency(totalProductos)}</span>
            </div>
          </>
        ) : (
          <div className={styles.totalRow}>
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
        )}
        {propina > 0 && (
          <div className={styles.totalRow}>
            <span>Propina</span>
            <span style={{ color: 'var(--success)' }}>+{formatCurrency(propina)}</span>
          </div>
        )}
        {descuentoMonto > 0 && (
          <div className={styles.totalRow}>
            <span>
              Descuento ({descuento}% {alcanceLabel(descuentoAlcance)})
            </span>
            <span style={{ color: 'var(--danger)' }}>-{formatCurrency(descuentoMonto)}</span>
          </div>
        )}
        <div className={styles.totalRowFinal}>
          <span>Total</span>
          <span>{formatCurrency(finalTotal)}</span>
        </div>
      </div>

      {afterTotals}
    </div>
  );
};

export default CarritoVenta;
