import { useCallback, useEffect, useMemo, useState } from 'react';
import { alcanceLabel, type DescuentoAlcance } from '../utils/reparto.js';
import { calcularPendiente } from '../utils/fiado.js';

/* ── Shared cart contract ──
 *
 * Single source of truth for the sale cart used by "Registrar servicio"
 * (WalkInModal) and "Ventas" (VentasPage). It owns both line collections
 * (services + products), the price/discount/payment state and every derived
 * total, so both screens compute and send IDENTICAL payloads.
 *
 * Rendering stays per-screen: each page keeps its own layout/classes.
 */

export type PaymentMethod = 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA';

/** Service line in the cart (WalkInModal builds these from the catalog). */
export interface LineaServicio {
  servicioId: number;
  nombre: string;
  precio: number;
  duracionMinutos: number;
  costoBaseInsumos?: number;
  /** Units sold; N units expand into N per-unit item rows server-side. */
  cantidad: number;
  tipoCostoInsumo?: 'FIJO' | 'POR_GRAMO';
  precioPorGramo?: number | null;
  /** Grams used per unit — only for `POR_GRAMO` services. */
  gramosUsados?: number;
  /**
   * Legacy override field kept only for payload compatibility. The supply cost
   * is NO LONGER editable at sale time, so this stays `undefined`; the real
   * cost is derived server-side (grams × $/g for `POR_GRAMO`).
   */
  costoInsumosOverride?: number;
}

/** Product line in the cart (shared by both screens). */
export interface LineaProducto {
  productoId: number;
  nombre: string;
  precioVenta: number;
  cantidad: number;
}

/** Catalog service shape `addServicio` accepts. */
export interface ServicioCatalogo {
  id: number;
  nombre: string;
  precioFinal: number;
  duracionMinutos: number;
  costoBaseInsumos?: number;
  tipoCostoInsumo?: 'FIJO' | 'POR_GRAMO';
  precioPorGramo?: number | null;
}

/** Catalog product shape `addProducto` accepts. */
export interface ProductoCatalogo {
  id: number;
  nombre: string;
  precioVenta: number;
  cantidadStock: number;
}

/** Payment object exactly as it travels in the `pagos` payload array. */
export interface PagoCarrito {
  monto: number;
  metodoPago: PaymentMethod;
  referencia?: string;
}

export interface UseCarritoReturn {
  /* Lines */
  servicios: LineaServicio[];
  productos: LineaProducto[];
  addServicio: (serv: ServicioCatalogo) => void;
  updateServicioQty: (servicioId: number, delta: number) => void;
  updateServicioPrecio: (servicioId: number, precio: number) => void;
  updateServicioGramos: (servicioId: number, gramos: number | undefined) => void;
  removeServicio: (servicioId: number) => void;
  addProducto: (prod: ProductoCatalogo) => void;
  updateProductoQty: (productoId: number, delta: number) => void;
  updateProductoPrecio: (productoId: number, precio: number) => void;
  removeProducto: (productoId: number) => void;
  /** Clears both line collections only (the "Vaciar" button). */
  vaciar: () => void;
  /**
   * Clears lines + discount/notes/payment state.
   * `paymentMethod` is only reset when explicitly passed, so WalkInModal keeps
   * its current method across close/reopen while VentasPage resets to EFECTIVO.
   */
  reset: (opts?: { paymentMethod?: PaymentMethod }) => void;

  /* Discount & notes */
  propina: number;
  setPropina: (n: number) => void;
  descuento: number;
  setDescuento: (n: number) => void;
  descuentoAlcance: DescuentoAlcance;
  setDescuentoAlcance: (a: DescuentoAlcance) => void;
  /**
   * Scopes that actually apply to the current cart (order: SERVICIOS,
   * PRODUCTOS, AMBOS). A scope with no items would yield a $0 discount, so it
   * is not offered. Empty when the cart is empty.
   */
  alcancesAplicables: DescuentoAlcance[];
  notaAjuste: string;
  setNotaAjuste: (s: string) => void;
  notas: string;
  setNotas: (s: string) => void;

  /* Totals */
  totalServicios: number;
  totalProductos: number;
  subtotal: number;
  descuentoMonto: number;
  finalTotal: number;

  /* Payment */
  paymentMethod: PaymentMethod;
  setPaymentMethod: (m: PaymentMethod) => void;
  montoRecibido: number;
  setMontoRecibido: (n: number) => void;
  esFiado: boolean;
  setEsFiado: (b: boolean) => void;
  referencia: string;
  setReferencia: (s: string) => void;
  cambio: number;
  pendiente: number;

  /* Derived flags */
  hasAdjustment: boolean;
  ajusteNoteRequired: boolean;
  carritoVacio: boolean;
  /** A `POR_GRAMO` line is missing its grams (blocks submit). */
  faltanGramos: boolean;
  /** Without fiado, cash must cover the total; card/transfer always do. */
  pagoSuficiente: boolean;

  /* Payload builders */
  /** Prepends the `[AJUSTE: …]` block to `base` when a discount is present. */
  buildNotas: (base: string | undefined) => string | undefined;
  /** The single `pagos[0]` entry, identical for both screens. */
  buildPago: () => PagoCarrito;
}

export function useCarrito(): UseCarritoReturn {
  const [servicios, setServicios] = useState<LineaServicio[]>([]);
  const [productos, setProductos] = useState<LineaProducto[]>([]);

  const [propina, setPropina] = useState<number>(0);
  const [descuento, setDescuento] = useState<number>(0);
  const [descuentoAlcance, setDescuentoAlcance] = useState<DescuentoAlcance>('AMBOS');
  const [notaAjuste, setNotaAjuste] = useState('');
  const [notas, setNotas] = useState('');

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('EFECTIVO');
  const [montoRecibido, setMontoRecibido] = useState<number>(0);
  const [esFiado, setEsFiado] = useState(false);
  const [referencia, setReferencia] = useState('');

  /* ── Line mutators: services ── */

  const addServicio = useCallback((serv: ServicioCatalogo) => {
    setServicios((prev) => {
      // Re-click increments quantity instead of duplicating the line.
      const existing = prev.find((item) => item.servicioId === serv.id);
      if (existing) {
        return prev.map((item) =>
          item.servicioId === serv.id ? { ...item, cantidad: item.cantidad + 1 } : item,
        );
      }
      return [
        ...prev,
        {
          servicioId: serv.id,
          nombre: serv.nombre,
          precio: serv.precioFinal,
          duracionMinutos: serv.duracionMinutos,
          costoBaseInsumos: serv.costoBaseInsumos ?? 0,
          cantidad: 1,
          tipoCostoInsumo: serv.tipoCostoInsumo,
          precioPorGramo: serv.precioPorGramo ?? null,
        },
      ];
    });
  }, []);

  const updateServicioQty = useCallback((servicioId: number, delta: number) => {
    setServicios((prev) =>
      prev
        .map((item) =>
          item.servicioId === servicioId
            ? { ...item, cantidad: Math.max(0, item.cantidad + delta) }
            : item,
        )
        .filter((item) => item.cantidad > 0),
    );
  }, []);

  const updateServicioPrecio = useCallback((servicioId: number, precio: number) => {
    setServicios((prev) =>
      prev.map((item) =>
        item.servicioId === servicioId ? { ...item, precio: Math.max(0, precio) } : item,
      ),
    );
  }, []);

  const updateServicioGramos = useCallback((servicioId: number, gramos: number | undefined) => {
    setServicios((prev) =>
      prev.map((item) =>
        item.servicioId === servicioId
          ? { ...item, gramosUsados: gramos, costoInsumosOverride: undefined }
          : item,
      ),
    );
  }, []);

  const removeServicio = useCallback((servicioId: number) => {
    setServicios((prev) => prev.filter((item) => item.servicioId !== servicioId));
  }, []);

  /* ── Line mutators: products ── */

  const addProducto = useCallback((prod: ProductoCatalogo) => {
    if (prod.cantidadStock <= 0) return;
    setProductos((prev) => {
      const existing = prev.find((item) => item.productoId === prod.id);
      if (existing) {
        return prev.map((item) =>
          item.productoId === prod.id
            ? { ...item, cantidad: Math.min(item.cantidad + 1, prod.cantidadStock) }
            : item,
        );
      }
      return [
        ...prev,
        {
          productoId: prod.id,
          nombre: prod.nombre,
          precioVenta: prod.precioVenta,
          cantidad: 1,
        },
      ];
    });
  }, []);

  const updateProductoQty = useCallback((productoId: number, delta: number) => {
    setProductos((prev) =>
      prev
        .map((item) =>
          item.productoId === productoId
            ? { ...item, cantidad: Math.max(0, item.cantidad + delta) }
            : item,
        )
        .filter((item) => item.cantidad > 0),
    );
  }, []);

  const updateProductoPrecio = useCallback((productoId: number, precio: number) => {
    setProductos((prev) =>
      prev.map((item) =>
        item.productoId === productoId ? { ...item, precioVenta: Math.max(0, precio) } : item,
      ),
    );
  }, []);

  const removeProducto = useCallback((productoId: number) => {
    setProductos((prev) => prev.filter((item) => item.productoId !== productoId));
  }, []);

  const vaciar = useCallback(() => {
    setServicios([]);
    setProductos([]);
  }, []);

  const reset = useCallback((opts?: { paymentMethod?: PaymentMethod }) => {
    setServicios([]);
    setProductos([]);
    setPropina(0);
    setDescuento(0);
    setDescuentoAlcance('AMBOS');
    setNotaAjuste('');
    setNotas('');
    setMontoRecibido(0);
    setEsFiado(false);
    setReferencia('');
    if (opts?.paymentMethod) setPaymentMethod(opts.paymentMethod);
  }, []);

  /* ── Discount scopes that apply to this cart ──
   * A scope with no matching items can only yield a $0 discount, so it is not
   * offered. When exactly one scope applies we point `descuentoAlcance` at it,
   * so a services-only cart can never leave the discount aimed at products. */
  const hasServicios = servicios.length > 0;
  const hasProductos = productos.length > 0;

  const alcancesAplicables = useMemo<DescuentoAlcance[]>(() => {
    if (hasServicios && hasProductos) return ['SERVICIOS', 'PRODUCTOS', 'AMBOS'];
    if (hasServicios) return ['SERVICIOS'];
    if (hasProductos) return ['PRODUCTOS'];
    return [];
  }, [hasServicios, hasProductos]);

  useEffect(() => {
    if (alcancesAplicables.length === 1 && descuentoAlcance !== alcancesAplicables[0]) {
      setDescuentoAlcance(alcancesAplicables[0]);
    }
  }, [alcancesAplicables, descuentoAlcance]);

  /* ── Derived totals ── */

  const totalServicios = useMemo(
    () => servicios.reduce((sum, item) => sum + item.precio * item.cantidad, 0),
    [servicios],
  );

  const totalProductos = useMemo(
    () => productos.reduce((sum, item) => sum + item.precioVenta * item.cantidad, 0),
    [productos],
  );

  const subtotal = useMemo(
    () => totalServicios + totalProductos,
    [totalServicios, totalProductos],
  );

  // The % only applies to the selected scope; each side is discounted separately.
  const pctServ =
    descuentoAlcance === 'SERVICIOS' || descuentoAlcance === 'AMBOS' ? descuento : 0;
  const pctProd =
    descuentoAlcance === 'PRODUCTOS' || descuentoAlcance === 'AMBOS' ? descuento : 0;

  const descuentoMonto = useMemo(() => {
    const descServicios = totalServicios - Math.round(totalServicios * (1 - pctServ / 100));
    const descProductos = totalProductos - Math.round(totalProductos * (1 - pctProd / 100));
    return descServicios + descProductos;
  }, [totalServicios, totalProductos, pctServ, pctProd]);

  const finalTotal = useMemo(
    () => subtotal + propina - descuentoMonto,
    [subtotal, propina, descuentoMonto],
  );

  const cambio = useMemo(() => {
    if (paymentMethod !== 'EFECTIVO') return 0;
    return Math.max(0, montoRecibido - finalTotal);
  }, [paymentMethod, montoRecibido, finalTotal]);

  /** Remaining debt: the tip is never financed (owner decision D8). */
  const pendiente = useMemo(
    () => calcularPendiente(finalTotal, propina, montoRecibido),
    [finalTotal, propina, montoRecibido],
  );

  // Only a real (non-zero) discount is an adjustment; an empty scope is not.
  const hasAdjustment = descuentoMonto > 0;
  const ajusteNoteRequired = hasAdjustment && notaAjuste.trim().length === 0;

  const carritoVacio = servicios.length === 0 && productos.length === 0;

  const faltanGramos = useMemo(
    () =>
      servicios.some(
        (item) =>
          item.tipoCostoInsumo === 'POR_GRAMO' &&
          !(item.gramosUsados != null && item.gramosUsados > 0),
      ),
    [servicios],
  );

  const pagoSuficiente =
    esFiado || paymentMethod !== 'EFECTIVO' || montoRecibido >= finalTotal;

  /* ── Payload builders ── */

  const buildNotas = useCallback(
    (base: string | undefined): string | undefined => {
      if (!(hasAdjustment && notaAjuste.trim())) return base;
      const ajusteParts: string[] = [];
      if (descuento > 0) {
        ajusteParts.push(`descuento ${descuento}% ${alcanceLabel(descuentoAlcance)}`);
      }
      const prefix = `[AJUSTE: ${ajusteParts.join(' | ')}] Razón: ${notaAjuste.trim()}`;
      return base ? `${prefix}\n${base}` : prefix;
    },
    [hasAdjustment, notaAjuste, descuento, descuentoAlcance],
  );

  const buildPago = useCallback(
    (): PagoCarrito => ({
      // Fiado: the amount charged (0 = full fiado, or partial).
      // Without fiado: cash uses montoRecibido; card/transfer pay the total.
      monto: esFiado ? montoRecibido : paymentMethod === 'EFECTIVO' ? montoRecibido : finalTotal,
      metodoPago: paymentMethod,
      referencia: referencia.trim() || undefined,
    }),
    [esFiado, montoRecibido, paymentMethod, finalTotal, referencia],
  );

  return {
    servicios,
    productos,
    addServicio,
    updateServicioQty,
    updateServicioPrecio,
    updateServicioGramos,
    removeServicio,
    addProducto,
    updateProductoQty,
    updateProductoPrecio,
    removeProducto,
    vaciar,
    reset,

    propina,
    setPropina,
    descuento,
    setDescuento,
    descuentoAlcance,
    setDescuentoAlcance,
    alcancesAplicables,
    notaAjuste,
    setNotaAjuste,
    notas,
    setNotas,

    totalServicios,
    totalProductos,
    subtotal,
    descuentoMonto,
    finalTotal,

    paymentMethod,
    setPaymentMethod,
    montoRecibido,
    setMontoRecibido,
    esFiado,
    setEsFiado,
    referencia,
    setReferencia,
    cambio,
    pendiente,

    hasAdjustment,
    ajusteNoteRequired,
    carritoVacio,
    faltanGramos,
    pagoSuficiente,

    buildNotas,
    buildPago,
  };
}
