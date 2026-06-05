import React, { useEffect, useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Skeleton } from '@pos-final/ui';
import api from '../services/api.js';
import styles from './WalkInModal.module.css';

/* ── Types ── */

interface Servicio {
  id: number;
  nombre: string;
  descripcion: string | null;
  precioFinal: number;
  duracionMinutos: number;
  categoriaId: number;
}

interface CartItem {
  servicioId: number;
  nombre: string;
  precio: number;
  duracionMinutos: number;
}

interface Producto {
  id: number;
  nombre: string;
  marca?: string;
  precioVenta: number;
  cantidadStock: number;
  categoriaId: number;
}

interface ProductCartItem {
  productoId: number;
  nombre: string;
  precioVenta: number;
  cantidad: number;
}

interface Cliente {
  id: number;
  nombre: string;
}

interface Empleada {
  id: number;
  nombre: string;
}

type PaymentMethod = 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA';

type TypeFilter = 'TODO' | 'SERVICIOS' | 'PRODUCTOS';

interface UnifiedCatalogItem {
  type: 'SERVICIO' | 'PRODUCTO';
  id: number;
  nombre: string;
  descripcion?: string;
  precio: number;
  // Service-specific
  duracionMinutos?: number;
  // Product-specific
  marca?: string;
  cantidadStock?: number;
}

interface WalkInModalProps {
  salonId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/* ── Constants ── */

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

function formatCurrency(n: number): string {
  return currencyFormatter.format(n);
}

/* ── Inline styles (matching VentasPage / FinanzasPage patterns) ── */

const searchInputStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '320px',
  height: '38px',
  padding: '0 0.75rem',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)',
  background: 'var(--bg-base)',
  color: 'var(--text-primary)',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.8125rem',
  outline: 'none',
  transition: 'border-color 0.2s, box-shadow 0.2s',
};

const selectStyle: React.CSSProperties = {
  width: '100%',
  height: '38px',
  padding: '0 0.7rem',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)',
  background: 'var(--bg-base)',
  color: 'var(--text-primary)',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.8125rem',
  outline: 'none',
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill='%238c8894' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 10px center',
  paddingRight: '28px',
  cursor: 'pointer',
};

const formLabelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.75rem',
  fontWeight: 500,
  color: 'var(--text-secondary)',
  marginBottom: '0.3rem',
  letterSpacing: '0.02em',
};

const inputStyle: React.CSSProperties = {
  ...searchInputStyle,
  maxWidth: '100%',
};

/* ── Animation variants ── */

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.22, 0.61, 0.36, 1] as const },
  },
};

/* ── Component ── */

const WalkInModal: React.FC<WalkInModalProps> = ({ salonId, isOpen, onClose, onSuccess }) => {
  /* ── Catalog data ── */
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [empleadas, setEmpleadas] = useState<Empleada[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  /* ── Product catalog state ── */
  const [productos, setProductos] = useState<Producto[]>([]);

  /* ── UI state ── */
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('TODO');

  /* ── Cart state ── */
  const [cart, setCart] = useState<CartItem[]>([]);
  const [productCart, setProductCart] = useState<ProductCartItem[]>([]);
  const [clienteId, setClienteId] = useState<number | ''>('');
  const [empleadaId, setEmpleadaId] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('EFECTIVO');
  const [montoRecibido, setMontoRecibido] = useState<number>(0);
  const [referencia, setReferencia] = useState('');
  const [propina, setPropina] = useState<number>(0);
  const [notas, setNotas] = useState('');

  /* ── Discount & Override state ── */
  const [descuento, setDescuento] = useState<number>(0);
  const [totalPersonalizado, setTotalPersonalizado] = useState<number | null>(null);
  const [ajustarTotal, setAjustarTotal] = useState(false);
  const [notaAjuste, setNotaAjuste] = useState('');

  /* ── Submission state ── */
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── Derived ── */

  const unifiedItems: UnifiedCatalogItem[] = useMemo(() => {
    const items: UnifiedCatalogItem[] = [
      ...servicios.map((s) => ({
        type: 'SERVICIO' as const,
        id: s.id,
        nombre: s.nombre,
        descripcion: s.descripcion ?? undefined,
        precio: s.precioFinal,
        duracionMinutos: s.duracionMinutos,
      })),
      ...productos.map((p) => ({
        type: 'PRODUCTO' as const,
        id: p.id,
        nombre: p.nombre,
        descripcion: p.marca ?? undefined,
        precio: p.precioVenta,
        marca: p.marca,
        cantidadStock: p.cantidadStock,
      })),
    ];
    return items;
  }, [servicios, productos]);

  const filteredItems = useMemo(() => {
    let list = unifiedItems;
    // Type filter
    if (typeFilter === 'SERVICIOS') {
      list = list.filter((i) => i.type === 'SERVICIO');
    } else if (typeFilter === 'PRODUCTOS') {
      list = list.filter((i) => i.type === 'PRODUCTO');
    }
    // Universal search (name, description, brand)
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          i.nombre.toLowerCase().includes(q) ||
          (i.descripcion && i.descripcion.toLowerCase().includes(q)) ||
          (i.type === 'PRODUCTO' && i.marca && i.marca.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [unifiedItems, typeFilter, search]);

  const totalServicios = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.precio, 0);
  }, [cart]);

  const totalProductos = useMemo(() => {
    return productCart.reduce((sum, p) => sum + p.precioVenta * p.cantidad, 0);
  }, [productCart]);

  const subtotal = useMemo(() => totalServicios + totalProductos, [totalServicios, totalProductos]);

  const descuentoMonto = useMemo(() => {
    return subtotal * (descuento / 100);
  }, [subtotal, descuento]);

  const calculatedTotal = useMemo(() => {
    return subtotal + propina - descuentoMonto;
  }, [subtotal, propina, descuentoMonto]);

  const finalTotal = useMemo(() => {
    return totalPersonalizado !== null ? totalPersonalizado : calculatedTotal;
  }, [totalPersonalizado, calculatedTotal]);

  const cambio = useMemo(() => {
    if (paymentMethod !== 'EFECTIVO') return 0;
    return Math.max(0, montoRecibido - finalTotal);
  }, [paymentMethod, montoRecibido, finalTotal]);

  const descripcionServicio = useMemo(() => {
    const names = cart.map((item) => item.nombre);
    names.push(...productCart.map((p) => `${p.nombre} x${p.cantidad}`));
    return names.join(', ');
  }, [cart, productCart]);

  const hasAdjustment = descuento > 0 || totalPersonalizado !== null;
  const ajusteNoteRequired = hasAdjustment && notaAjuste.trim().length === 0;

  const canSubmit = useMemo(() => {
    if (cart.length === 0 && productCart.length === 0) return false;
    if (!clienteId) return false;
    if (!empleadaId) return false;
    if (paymentMethod === 'EFECTIVO' && montoRecibido < finalTotal) return false;
    if (hasAdjustment && notaAjuste.trim().length === 0) return false;
    return true;
  }, [cart, productCart, clienteId, empleadaId, paymentMethod, montoRecibido, finalTotal, hasAdjustment, notaAjuste]);

  /* ── Fetch data on modal open ── */

  useEffect(() => {
    if (!isOpen || salonId == null) return;
    let cancelled = false;

    const fetchData = async () => {
      setDataLoading(true);
      setDataError(null);
      try {
        const [servRes, cliRes, empRes, prodRes] = await Promise.all([
          api.get(`/salones/${salonId}/servicios`),
          api.get(`/salones/${salonId}/clientes`),
          api.get(`/salones/${salonId}/empleadas`),
          api.get(`/salones/${salonId}/productos?tipo=RETAIL`),
        ]);
        if (cancelled) return;
        setServicios(Array.isArray(servRes.data) ? servRes.data : servRes.data?.data ?? []);
        setClientes(Array.isArray(cliRes.data) ? cliRes.data : cliRes.data?.data ?? []);
        setEmpleadas(Array.isArray(empRes.data) ? empRes.data : empRes.data?.data ?? []);
        setProductos(Array.isArray(prodRes.data) ? prodRes.data : prodRes.data?.data ?? []);
      } catch {
        if (cancelled) return;
        setDataError('Error al cargar datos');
        setServicios([]);
        setClientes([]);
        setEmpleadas([]);
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [isOpen, salonId]);

  /* ── Reset state when modal closes ── */

  useEffect(() => {
    if (!isOpen) {
      setCart([]);
      setClienteId('');
      setEmpleadaId('');
      setMontoRecibido(0);
      setReferencia('');
      setPropina(0);
      setNotas('');
      setSearch('');
      setTypeFilter('TODO');
      setProductCart([]);
      setDescuento(0);
      setTotalPersonalizado(null);
      setAjustarTotal(false);
      setNotaAjuste('');
      setError(null);
      setProcessing(false);
      setDataError(null);
    }
  }, [isOpen]);

  /* ── Cart helpers ── */

  const addToCart = (serv: Servicio) => {
    setCart((prev) => {
      if (prev.find((item) => item.servicioId === serv.id)) return prev;
      return [
        ...prev,
        {
          servicioId: serv.id,
          nombre: serv.nombre,
          precio: serv.precioFinal,
          duracionMinutos: serv.duracionMinutos,
        },
      ];
    });
  };

  const removeFromCart = (servicioId: number) => {
    setCart((prev) => prev.filter((item) => item.servicioId !== servicioId));
  };

  const updatePrice = (servicioId: number, precio: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.servicioId === servicioId ? { ...item, precio: Math.max(0, precio) } : item,
      ),
    );
  };

  /* ── Product cart helpers ── */

  const addProductToCart = (prod: Producto) => {
    if (prod.cantidadStock <= 0) return;
    setProductCart((prev) => {
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
  };

  const updateProductQty = (productoId: number, delta: number) => {
    setProductCart((prev) =>
      prev
        .map((item) =>
          item.productoId === productoId
            ? { ...item, cantidad: Math.max(0, item.cantidad + delta) }
            : item,
        )
        .filter((item) => item.cantidad > 0),
    );
  };

  const removeProductFromCart = (productoId: number) => {
    setProductCart((prev) => prev.filter((item) => item.productoId !== productoId));
  };

  /* ── Unified cart for display ── */

  const unifiedCart = useMemo(() => {
    const items: Array<
      { type: 'SERVICIO'; data: CartItem } | { type: 'PRODUCTO'; data: ProductCartItem }
    > = [
      ...cart.map((item) => ({ type: 'SERVICIO' as const, data: item })),
      ...productCart.map((item) => ({ type: 'PRODUCTO' as const, data: item })),
    ];
    return items;
  }, [cart, productCart]);

  /* ── Submit handler ── */

  const handleSubmit = async () => {
    if (!salonId || !clienteId || !empleadaId) return;
    if (cart.length === 0 && productCart.length === 0) return;
    setProcessing(true);
    setError(null);
    try {
      // Build notas with adjustment info
      let finalNotas = notas.trim() || undefined;
      if (hasAdjustment && notaAjuste.trim()) {
        const ajusteParts: string[] = [];
        if (descuento > 0) ajusteParts.push(`descuento ${descuento}%`);
        if (totalPersonalizado !== null) ajusteParts.push(`total $${totalPersonalizado}`);
        const prefix = `[AJUSTE: ${ajusteParts.join(' | ')}] Razón: ${notaAjuste.trim()}`;
        finalNotas = finalNotas ? `${prefix}\n${finalNotas}` : prefix;
      }

      const payload = {
        salonId,
        clienteId: Number(clienteId),
        usuarioId: Number(empleadaId),
        totalServicios,
        totalProductos,
        propina,
        montoTotal: finalTotal,
        descripcionServicio: descripcionServicio || undefined,
        pagos: [
          {
            monto: paymentMethod === 'EFECTIVO' ? montoRecibido : finalTotal,
            metodoPago: paymentMethod,
            referencia: referencia.trim() || undefined,
          },
        ],
        notas: finalNotas,
        productosVendidos: productCart.map((p) => ({
          productoId: p.productoId,
          cantidad: p.cantidad,
        })),
        // Price adjustment fields
        porcentajeDescuento: descuento,
        precioAjustado: hasAdjustment,
        valorOriginal: subtotal + propina,
        valorFinal: finalTotal,
      };
      await api.post(`/salones/${salonId}/registros`, payload);
      onSuccess();
    } catch {
      setError('Error al registrar el servicio. Intentá de nuevo.');
    } finally {
      setProcessing(false);
    }
  };

  /* ── Render ── */

  if (!isOpen) return null;

  return (
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
        className={styles.modalContent}
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.25, ease: [0.22, 0.61, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Registrar servicio</span>
          <button className={styles.modalCloseBtn} onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        {/* ── Error banner ── */}
        <AnimatePresence>
          {error && (
            <motion.div
              className={styles.errorBanner}
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
            >
              ⚠️ {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Body ── */}
        <div className={styles.modalBody}>
          {dataLoading ? (
            <div className={styles.loadingGrid}>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} height="100px" variant="rect" />
              ))}
            </div>
          ) : dataError ? (
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
                {dataError}
              </p>
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '0.8125rem',
                  color: 'var(--text-secondary)',
                }}
              >
                Cerra el formulario e intentá de nuevo.
              </p>
            </div>
          ) : (
            <div className={styles.twoColumn}>
              {/* ============================================================ */}
              {/*  LEFT PANEL — Unified Catalog                                */}
              {/* ============================================================ */}
              <div className={styles.catalogPanel}>
                {/* ── Type filter buttons ── */}
                <div className={styles.typeFilterRow}>
                  {(['TODO', 'SERVICIOS', 'PRODUCTOS'] as TypeFilter[]).map((t) => {
                    const isActive = typeFilter === t;
                    const labels: Record<TypeFilter, string> = {
                      TODO: 'Todo',
                      SERVICIOS: 'Servicios',
                      PRODUCTOS: 'Productos',
                    };
                    return (
                      <button
                        key={t}
                        onClick={() => setTypeFilter(t)}
                        className={`${styles.typeFilterBtn} ${isActive ? styles.typeFilterBtnActive : ''}`}
                      >
                        {labels[t]}
                      </button>
                    );
                  })}
                </div>

                {/* ── Universal search ── */}
                <div className={styles.catalogToolbar}>
                  <input
                    type="text"
                    placeholder="Buscar servicios o productos…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={searchInputStyle}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent)';
                      e.currentTarget.style.boxShadow = '0 0 0 2px var(--accent-glow)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>

                {/* ── Unified grid ── */}
                {filteredItems.length === 0 ? (
                  <div className={styles.emptyState}>
                    <span className={styles.emptyIcon}>
                      {typeFilter === 'PRODUCTOS' ? '🧴' : '💇'}
                    </span>
                    <p
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '0.875rem',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {search
                        ? 'No hay resultados que coincidan con la búsqueda.'
                        : typeFilter === 'SERVICIOS'
                          ? 'No hay servicios disponibles.'
                          : typeFilter === 'PRODUCTOS'
                            ? 'No hay productos disponibles.'
                            : 'No hay servicios ni productos disponibles.'}
                    </p>
                  </div>
                ) : (
                  <div className={styles.serviceGrid}>
                    {filteredItems.map((item) => {
                      const isService = item.type === 'SERVICIO';
                      const inServiceCart = isService
                        ? cart.some((c) => c.servicioId === item.id)
                        : false;
                      const inProductCart = !isService
                        ? productCart.some((p) => p.productoId === item.id)
                        : false;
                      const inCart = isService ? inServiceCart : inProductCart;
                      const outOfStock = !isService && (item.cantidadStock ?? 0) <= 0;
                      return (
                        <motion.div
                          key={`${item.type}-${item.id}`}
                          variants={cardVariants}
                          initial="hidden"
                          animate="show"
                          whileHover={!inCart && !outOfStock ? { scale: 1.02, y: -2 } : undefined}
                          whileTap={!inCart && !outOfStock ? { scale: 0.98 } : undefined}
                          onClick={() => {
                            if (inCart || outOfStock) return;
                            if (isService) {
                              const serv = servicios.find((s) => s.id === item.id);
                              if (serv) addToCart(serv);
                            } else {
                              const prod = productos.find((p) => p.id === item.id);
                              if (prod) addProductToCart(prod);
                            }
                          }}
                          className={`${styles.serviceCard} ${inCart ? styles.serviceCardSelected : ''}`}
                          style={{ cursor: outOfStock ? 'not-allowed' : undefined }}
                        >
                          {/* Type badge */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              marginBottom: '0.35rem',
                            }}
                          >
                            <span
                              style={{
                                fontFamily: "'DM Sans', sans-serif",
                                fontSize: '0.6rem',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                                padding: '0.1rem 0.35rem',
                                borderRadius: '3px',
                                background: isService
                                  ? 'rgba(212,168,83,0.15)'
                                  : 'rgba(92,186,123,0.15)',
                                color: isService ? 'var(--accent)' : 'var(--success)',
                                lineHeight: 1.3,
                              }}
                            >
                              {isService ? 'Servicio' : 'Producto'}
                            </span>
                          </div>
                          <div className={styles.serviceName}>{item.nombre}</div>
                          {isService && item.descripcion && (
                            <div className={styles.serviceDesc}>{item.descripcion}</div>
                          )}
                          {!isService && item.marca && (
                            <div
                              style={{
                                fontFamily: "'DM Sans', sans-serif",
                                fontSize: '0.6875rem',
                                color: 'var(--text-dim)',
                                marginBottom: '0.4rem',
                              }}
                            >
                              {item.marca}
                            </div>
                          )}
                          <div className={styles.servicePrice}>
                            {formatCurrency(item.precio)}
                          </div>
                          {isService && item.duracionMinutos && (
                            <div className={styles.serviceDuration}>
                              🕐 {item.duracionMinutos} min
                            </div>
                          )}
                          {!isService && (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                marginTop: '0.25rem',
                              }}
                            >
                              <span
                                style={{
                                  width: '8px',
                                  height: '8px',
                                  borderRadius: '50%',
                                  background: outOfStock
                                    ? 'var(--danger)'
                                    : (item.cantidadStock ?? 0) <= 5
                                      ? 'var(--warning)'
                                      : 'var(--success)',
                                  display: 'inline-block',
                                }}
                              />
                              <span
                                style={{
                                  fontFamily: "'DM Sans', sans-serif",
                                  fontSize: '0.6875rem',
                                  color: 'var(--text-secondary)',
                                }}
                              >
                                {outOfStock
                                  ? 'Sin stock'
                                  : `${item.cantidadStock} en stock`}
                              </span>
                            </div>
                          )}
                          {inCart && <div className={styles.inCartBadge}>✓</div>}
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ============================================================ */}
              {/*  RIGHT PANEL — Cart + Checkout                               */}
              {/* ============================================================ */}
              <div className={styles.checkoutPanel}>
                {/* ── Unified cart ── */}
                <div className={styles.checkoutSection}>
                  <div className={styles.checkoutHeader}>
                    <span className={styles.checkoutTitle}>Carrito</span>
                    {(cart.length > 0 || productCart.length > 0) && (
                      <button
                        onClick={() => {
                          setCart([]);
                          setProductCart([]);
                        }}
                        className={styles.clearBtn}
                      >
                        Vaciar
                      </button>
                    )}
                  </div>
                  {unifiedCart.length === 0 ? (
                    <p
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '0.8125rem',
                        color: 'var(--text-dim)',
                        textAlign: 'center',
                        padding: '1rem 0',
                        margin: 0,
                      }}
                    >
                      Seleccioná servicios o productos de la lista para agregarlos.
                    </p>
                  ) : (
                    <div className={styles.cartList}>
                      {unifiedCart.map((entry) => {
                        if (entry.type === 'SERVICIO') {
                          const item = entry.data;
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
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                  }}
                                >
                                  <span
                                    style={{
                                      fontFamily: "'DM Sans', sans-serif",
                                      fontSize: '0.55rem',
                                      fontWeight: 600,
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.04em',
                                      padding: '0.05rem 0.25rem',
                                      borderRadius: '2px',
                                      background: 'rgba(212,168,83,0.15)',
                                      color: 'var(--accent)',
                                      lineHeight: 1.3,
                                    }}
                                  >
                                    S
                                  </span>
                                  <div className={styles.cartItemName}>{item.nombre}</div>
                                </div>
                                <div className={styles.cartItemDuration}>
                                  {item.duracionMinutos} min
                                </div>
                              </div>
                              <input
                                type="number"
                                min={0}
                                value={item.precio}
                                onChange={(e) =>
                                  updatePrice(item.servicioId, Number(e.target.value))
                                }
                                className={`${styles.priceInput} ${styles.noSpinner}`}
                                onFocus={(e) => {
                                  e.currentTarget.style.borderColor = 'var(--accent)';
                                  e.currentTarget.style.boxShadow =
                                    '0 0 0 2px var(--accent-glow)';
                                }}
                                onBlur={(e) => {
                                  e.currentTarget.style.borderColor = 'var(--border)';
                                  e.currentTarget.style.boxShadow = 'none';
                                }}
                              />
                              <button
                                onClick={() => removeFromCart(item.servicioId)}
                                className={styles.removeBtn}
                              >
                                ✕
                              </button>
                            </motion.div>
                          );
                        } else {
                          const item = entry.data;
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
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                  }}
                                >
                                  <span
                                    style={{
                                      fontFamily: "'DM Sans', sans-serif",
                                      fontSize: '0.55rem',
                                      fontWeight: 600,
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.04em',
                                      padding: '0.05rem 0.25rem',
                                      borderRadius: '2px',
                                      background: 'rgba(92,186,123,0.15)',
                                      color: 'var(--success)',
                                      lineHeight: 1.3,
                                    }}
                                  >
                                    P
                                  </span>
                                  <div className={styles.cartItemName}>{item.nombre}</div>
                                </div>
                                <div
                                  style={{
                                    fontFamily: "'DM Sans', sans-serif",
                                    fontSize: '0.6875rem',
                                    color: 'var(--text-secondary)',
                                  }}
                                >
                                  {formatCurrency(item.precioVenta)} × {item.cantidad}
                                </div>
                              </div>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                }}
                              >
                                <button
                                  onClick={() => updateProductQty(item.productoId, -1)}
                                  style={{
                                    background: 'var(--bg-base)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 'var(--radius-sm)',
                                    color: 'var(--text-primary)',
                                    width: '26px',
                                    height: '26px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    fontSize: '0.875rem',
                                    lineHeight: 1,
                                    padding: 0,
                                  }}
                                >
                                  −
                                </button>
                                <span
                                  style={{
                                    fontFamily: "'DM Sans', sans-serif",
                                    fontSize: '0.8125rem',
                                    fontWeight: 600,
                                    color: 'var(--text-primary)',
                                    minWidth: '20px',
                                    textAlign: 'center',
                                  }}
                                >
                                  {item.cantidad}
                                </span>
                                <button
                                  onClick={() => updateProductQty(item.productoId, 1)}
                                  style={{
                                    background: 'var(--bg-base)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 'var(--radius-sm)',
                                    color: 'var(--text-primary)',
                                    width: '26px',
                                    height: '26px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    fontSize: '0.875rem',
                                    lineHeight: 1,
                                    padding: 0,
                                  }}
                                >
                                  +
                                </button>
                              </div>
                              <div
                                style={{
                                  fontFamily: "'DM Sans', sans-serif",
                                  fontSize: '0.8125rem',
                                  fontWeight: 600,
                                  color: 'var(--accent)',
                                  minWidth: '70px',
                                  textAlign: 'right',
                                }}
                              >
                                {formatCurrency(item.precioVenta * item.cantidad)}
                              </div>
                              <button
                                onClick={() => removeProductFromCart(item.productoId)}
                                className={styles.removeBtn}
                              >
                                ✕
                              </button>
                            </motion.div>
                          );
                        }
                      })}
                    </div>
                  )}
                </div>

                {/* ── Client + Employee ── */}
                <div className={styles.checkoutSection}>
                  <div>
                    <label style={formLabelStyle}>Cliente *</label>
                    <select
                      value={clienteId}
                      onChange={(e) =>
                        setClienteId(e.target.value ? Number(e.target.value) : '')
                      }
                      style={selectStyle}
                    >
                      <option value="">Seleccionar cliente…</option>
                      {clientes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ marginTop: '0.625rem' }}>
                    <label style={formLabelStyle}>Empleada *</label>
                    <select
                      value={empleadaId}
                      onChange={(e) =>
                        setEmpleadaId(e.target.value ? Number(e.target.value) : '')
                      }
                      style={selectStyle}
                    >
                      <option value="">Seleccionar empleada…</option>
                      {empleadas.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* ── Propina ── */}
                <div className={styles.checkoutSection}>
                  <div>
                    <label style={formLabelStyle}>Propina</label>
                    <input
                      type="number"
                      min={0}
                      value={propina || ''}
                      onChange={(e) => setPropina(Number(e.target.value))}
                      placeholder="0"
                      style={inputStyle}
                      className={styles.noSpinner}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'var(--accent)';
                        e.currentTarget.style.boxShadow = '0 0 0 2px var(--accent-glow)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                </div>

                {/* ── Discount & Price Override ── */}
                <div className={styles.checkoutSection}>
                  <div
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      color: 'var(--text-dim)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      marginBottom: '0.5rem',
                    }}
                  >
                    Ajustes de precio
                  </div>

                  {/* Descuento % */}
                  <div style={{ marginBottom: '0.5rem' }}>
                    <label style={formLabelStyle}>Descuento (%)</label>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
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
                        className={styles.noSpinner}
                        style={{ ...inputStyle, maxWidth: '100px' }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = 'var(--accent)';
                          e.currentTarget.style.boxShadow = '0 0 0 2px var(--accent-glow)';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = 'var(--border)';
                          e.currentTarget.style.boxShadow = 'none';
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
                  </div>

                  {/* Total ajustado toggle + input */}
                  <div style={{ marginBottom: '0.5rem' }}>
                    <label className={styles.switchLabel}>
                      <input
                        type="checkbox"
                        checked={ajustarTotal}
                        onChange={(e) => {
                          setAjustarTotal(e.target.checked);
                          if (!e.target.checked) setTotalPersonalizado(null);
                        }}
                      />
                      <span className={styles.switchSlider} />
                      <span className={styles.switchLabelText}>Ajustar valor total</span>
                    </label>
                    {ajustarTotal && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <input
                          type="number"
                          min={0}
                          value={totalPersonalizado !== null ? totalPersonalizado : ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setTotalPersonalizado(val ? Number(val) : null);
                          }}
                          placeholder={formatCurrency(calculatedTotal)}
                          className={styles.noSpinner}
                          style={inputStyle}
                          onFocus={(e) => {
                            e.currentTarget.style.borderColor = 'var(--accent)';
                            e.currentTarget.style.boxShadow = '0 0 0 2px var(--accent-glow)';
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.borderColor = 'var(--border)';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Note de ajuste (required if discount or override) */}
                  {hasAdjustment && (
                    <div>
                      <label
                        style={{
                          ...formLabelStyle,
                          color: ajusteNoteRequired ? 'var(--danger)' : undefined,
                        }}
                      >
                        ¿Por qué se ajustó el precio? *
                      </label>
                      <textarea
                        value={notaAjuste}
                        onChange={(e) => setNotaAjuste(e.target.value)}
                        placeholder="Indicá el motivo del ajuste..."
                        className={styles.notesInput}
                        style={{
                          borderColor: ajusteNoteRequired ? 'var(--danger)' : undefined,
                        }}
                      />
                      {ajusteNoteRequired && (
                        <span
                          style={{
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: '0.65rem',
                            color: 'var(--danger)',
                            marginTop: '0.2rem',
                            display: 'block',
                          }}
                        >
                          Este campo es obligatorio cuando hay descuento o ajuste de total.
                        </span>
                      )}
                    </div>
                  )}

                  {/* Notas generales */}
                  <div style={{ marginTop: '0.5rem' }}>
                    <label style={formLabelStyle}>Notas (opcional)</label>
                    <textarea
                      value={notas}
                      onChange={(e) => setNotas(e.target.value)}
                      placeholder="Notas adicionales…"
                      className={styles.notesInput}
                    />
                  </div>
                </div>

                {/* ── Payment ── */}
                <div className={styles.checkoutSection}>
                  <label style={formLabelStyle}>Método de pago</label>
                  <div className={styles.paymentTabs}>
                    {(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'] as PaymentMethod[]).map(
                      (method) => {
                        const isActive = paymentMethod === method;
                        const labels: Record<PaymentMethod, string> = {
                          EFECTIVO: 'Efectivo',
                          TARJETA: 'Tarjeta',
                          TRANSFERENCIA: 'Transferencia',
                        };
                        return (
                          <button
                            key={method}
                            onClick={() => setPaymentMethod(method)}
                            className={`${styles.paymentTab} ${isActive ? styles.paymentTabActive : ''}`}
                          >
                            {labels[method]}
                          </button>
                        );
                      },
                    )}
                  </div>

                  {paymentMethod === 'EFECTIVO' && (
                    <div>
                      <label style={formLabelStyle}>Monto recibido</label>
                      <input
                        type="number"
                        min={0}
                        value={montoRecibido || ''}
                        onChange={(e) => setMontoRecibido(Number(e.target.value))}
                        placeholder="0"
                        className={styles.noSpinner}
                        style={inputStyle}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = 'var(--accent)';
                          e.currentTarget.style.boxShadow = '0 0 0 2px var(--accent-glow)';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = 'var(--border)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      />
                      {montoRecibido >= finalTotal && finalTotal > 0 && (
                        <div className={styles.cambioDisplay}>
                          <span
                            style={{
                              fontFamily: "'DM Sans', sans-serif",
                              fontSize: '0.75rem',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            Cambio
                          </span>
                          <span
                            style={{
                              fontFamily: "'DM Sans', sans-serif",
                              fontSize: '0.875rem',
                              fontWeight: 700,
                              color: '#50c878',
                            }}
                          >
                            {formatCurrency(cambio)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {(paymentMethod === 'TARJETA' || paymentMethod === 'TRANSFERENCIA') && (
                    <div>
                      <label style={formLabelStyle}>Referencia (opcional)</label>
                      <input
                        type="text"
                        value={referencia}
                        onChange={(e) => setReferencia(e.target.value)}
                        placeholder="Nro. de referencia"
                        style={inputStyle}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = 'var(--accent)';
                          e.currentTarget.style.boxShadow = '0 0 0 2px var(--accent-glow)';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = 'var(--border)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* ── Totals ── */}
                <div className={styles.totalsSection}>
                  <div className={styles.totalRow}>
                    <span>Subtotal servicios</span>
                    <span>{formatCurrency(totalServicios)}</span>
                  </div>
                  <div className={styles.totalRow}>
                    <span>Subtotal productos</span>
                    <span>{formatCurrency(totalProductos)}</span>
                  </div>
                  {propina > 0 && (
                    <div className={styles.totalRow}>
                      <span>Propina</span>
                      <span style={{ color: 'var(--success)' }}>
                        +{formatCurrency(propina)}
                      </span>
                    </div>
                  )}
                  {descuentoMonto > 0 && (
                    <div className={styles.totalRow}>
                      <span>Descuento ({descuento}%)</span>
                      <span style={{ color: 'var(--danger)' }}>
                        -{formatCurrency(descuentoMonto)}
                      </span>
                    </div>
                  )}
                  {totalPersonalizado !== null && totalPersonalizado !== calculatedTotal && (
                    <div className={styles.totalRow}>
                      <span>Ajuste</span>
                      <span
                        style={{
                          color:
                            totalPersonalizado > calculatedTotal
                              ? 'var(--success)'
                              : 'var(--danger)',
                        }}
                      >
                        {totalPersonalizado > calculatedTotal ? '+' : '-'}
                        {formatCurrency(Math.abs(totalPersonalizado - calculatedTotal))}
                      </span>
                    </div>
                  )}
                  <div className={styles.totalRowFinal}>
                    <span>Total</span>
                    <span>{formatCurrency(finalTotal)}</span>
                  </div>
                </div>

                {/* ── Submit ── */}
                <div className={styles.submitSection}>
                  <motion.button
                    whileHover={canSubmit && !processing ? { scale: 1.02 } : undefined}
                    whileTap={canSubmit && !processing ? { scale: 0.98 } : undefined}
                    onClick={handleSubmit}
                    disabled={!canSubmit || processing}
                    className={`${styles.submitBtn} ${canSubmit && !processing ? styles.submitBtnActive : ''}`}
                  >
                    {processing
                      ? 'Procesando…'
                      : `Registrar ${formatCurrency(finalTotal)}`}
                  </motion.button>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default WalkInModal;
