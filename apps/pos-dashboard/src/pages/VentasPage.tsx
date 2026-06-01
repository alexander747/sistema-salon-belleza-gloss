import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Skeleton } from '@pos-final/ui';
import { Rol, type IUser } from '@pos-final/types';
import api from '../services/api.js';
import SalonSwitcher from '../components/SalonSwitcher.js';

/* ── Types ── */

interface Categoria {
  id: number;
  nombre: string;
}

interface Producto {
  id: number;
  nombre: string;
  marca?: string;
  precioVenta: number;
  cantidadStock: number;
  categoria?: Categoria;
  categoriaId?: number;
}

interface CartItem {
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

/* ── Constants ── */



const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

type PaymentMethod = 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA';

/* ── Style constants (matching ProductosPage) ── */

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
  whiteSpace: 'nowrap',
  transition: 'background 0.2s, box-shadow 0.2s',
  boxShadow: '0 2px 12px rgba(212,168,83,0.25)',
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

/* ── Helpers ── */

function formatCurrency(n: number): string {
  return currencyFormatter.format(n);
}

/* ── Component ── */

const VentasPage: React.FC = () => {
  const navigate = useNavigate();

  /* Auth state */
  const [user, setUser] = useState<IUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  /* Data state */
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [empleadas, setEmpleadas] = useState<Empleada[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  /* UI state */
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<number | 'TODAS'>('TODAS');

  /* Cart state */
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | ''>('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('EFECTIVO');
  const [montoRecibido, setMontoRecibido] = useState<number>(0);
  const [paymentRef, setPaymentRef] = useState('');
  const [processing, setProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  /* ── Derived ── */

  const salonId = useMemo(() => {
    if (!user) return null;
    const stored = localStorage.getItem('xSalonId');
    return stored ? Number(stored) : user.salonId;
  }, [user]);

  const filteredProductos = useMemo(() => {
    let list = productos;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.nombre.toLowerCase().includes(q));
    }
    if (catFilter !== 'TODAS') {
      list = list.filter((p) => p.categoriaId === catFilter);
    }
    return list;
  }, [productos, search, catFilter]);

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.precioVenta * item.cantidad, 0);
  }, [cart]);

  const cambio = useMemo(() => {
    if (paymentMethod !== 'EFECTIVO') return 0;
    return Math.max(0, montoRecibido - cartTotal);
  }, [paymentMethod, montoRecibido, cartTotal]);

  const canCobrar = useMemo(() => {
    if (cart.length === 0) return false;
    if (!selectedCustomerId) return false;
    if (!selectedEmployeeId) return false;
    if (paymentMethod === 'EFECTIVO' && montoRecibido < cartTotal) return false;
    return true;
  }, [cart, selectedCustomerId, selectedEmployeeId, paymentMethod, montoRecibido, cartTotal]);

  const hasProductos = filteredProductos.length > 0;

  /* ── Auth effect ── */
  useEffect(() => {
    api
      .get('/auth/me')
      .then(({ data }) => setUser(data))
      .catch(() => navigate('/login'))
      .finally(() => setAuthLoading(false));
  }, [navigate]);

  /* ── Fetch data ── */
  const fetchData = useCallback(async () => {
    if (salonId == null) return;
    setDataLoading(true);
    setDataError(null);
    try {
      const [prodRes, catRes, cliRes, empRes] = await Promise.all([
        api.get(`/salones/${salonId}/productos?tipo=RETAIL`),
        api.get(`/salones/${salonId}/categorias`),
        api.get(`/salones/${salonId}/clientes`),
        api.get(`/salones/${salonId}/empleadas`),
      ]);
      const prodData = Array.isArray(prodRes.data) ? prodRes.data : prodRes.data?.data ?? [];
      const catData = Array.isArray(catRes.data) ? catRes.data : catRes.data?.data ?? [];
      const cliData = Array.isArray(cliRes.data) ? cliRes.data : cliRes.data?.data ?? [];
      const empData = Array.isArray(empRes.data) ? empRes.data : empRes.data?.data ?? [];
      setProductos(prodData);
      setCategorias(catData);
      setClientes(cliData);
      setEmpleadas(empData);
    } catch {
      setDataError('Error al cargar datos');
      setProductos([]);
      setCategorias([]);
      setClientes([]);
      setEmpleadas([]);
    } finally {
      setDataLoading(false);
    }
  }, [salonId]);

  useEffect(() => {
    if (!authLoading && salonId != null) {
      fetchData();
    }
  }, [authLoading, salonId, fetchData]);

  /* ── Cart helpers ── */

  const addToCart = (prod: Producto) => {
    if (prod.cantidadStock <= 0) return;
    setCart((prev) => {
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

  const updateQty = (productoId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.productoId === productoId
            ? { ...item, cantidad: Math.max(0, item.cantidad + delta) }
            : item,
        )
        .filter((item) => item.cantidad > 0),
    );
  };

  const removeFromCart = (productoId: number) => {
    setCart((prev) => prev.filter((item) => item.productoId !== productoId));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCustomerId('');
    setSelectedEmployeeId('');
    setMontoRecibido(0);
    setPaymentRef('');
    setPaymentMethod('EFECTIVO');
    setSuccessMsg(null);
  };

  /* ── Cobrar ── */

  const handleCobrar = async () => {
    if (!salonId || !selectedCustomerId || !selectedEmployeeId) return;
    setProcessing(true);
    setSuccessMsg(null);
    try {
      const payload = {
        salonId,
        clienteId: Number(selectedCustomerId),
        usuarioId: Number(selectedEmployeeId),
        totalServicios: 0,
        totalProductos: cartTotal,
        propina: 0,
        pagos: [
          {
            monto: paymentMethod === 'EFECTIVO' ? montoRecibido : cartTotal,
            metodoPago: paymentMethod,
            referencia: paymentRef.trim() || undefined,
          },
        ],
        notas: `Venta directa: ${cart.map((i) => `${i.cantidad}x ${i.nombre}`).join(', ')}`,
        productosVendidos: cart.map((item) => ({
          productoId: item.productoId,
          cantidad: item.cantidad,
        })),
      };
      await api.post(`/salones/${salonId}/registros`, payload);
      setSuccessMsg('Venta registrada con éxito');
      setCart([]);
      setSelectedCustomerId('');
      setSelectedEmployeeId('');
      setMontoRecibido(0);
      setPaymentRef('');
      setPaymentMethod('EFECTIVO');
      fetchData();
    } catch {
      setSuccessMsg(null);
      setDataError('Error al procesar la venta. Intentá de nuevo.');
    } finally {
      setProcessing(false);
    }
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

  /* ================================================================ */
  /*  RENDER: Loading skeleton                                          */
  /* ================================================================ */

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
      <AnimatePresence mode="wait">
        <motion.div
          key="ventas-content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          {/* SalonSwitcher */}
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

          {/* Success message */}
          <AnimatePresence>
            {successMsg && (
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(80,200,120,0.12)',
                  border: '1px solid rgba(80,200,120,0.3)',
                  color: '#50c878',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  marginBottom: '1rem',
                }}
              >
                ✅ {successMsg}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error message */}
          {dataError && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(224,85,106,0.12)',
                border: '1px solid rgba(224,85,106,0.3)',
                color: 'var(--danger)',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '0.8125rem',
                fontWeight: 500,
                marginBottom: '1rem',
              }}
            >
              ⚠️ {dataError}
            </motion.div>
          )}

          {/* ── Two-column layout ── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '3fr 2fr',
              gap: '1rem',
              alignItems: 'start',
            }}
          >
            {/* ============================================================ */}
            {/*  LEFT PANEL — Product Catalog                                 */}
            {/* ============================================================ */}
            <div>
              {/* Toolbar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  marginBottom: '1rem',
                  flexWrap: 'wrap',
                }}
              >
                <input
                  type="text"
                  placeholder="Buscar producto…"
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
                <select
                  value={catFilter === 'TODAS' ? 'TODAS' : catFilter}
                  onChange={(e) =>
                    setCatFilter(e.target.value === 'TODAS' ? 'TODAS' : Number(e.target.value))
                  }
                  style={{ ...selectStyle, maxWidth: '180px' }}
                >
                  <option value="TODAS">Todas las categorías</option>
                  {categorias.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* Product grid */}
              {dataLoading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Skeleton key={i} height="140px" variant="rect" />
                  ))}
                </div>
              ) : !hasProductos ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '3rem 2rem',
                    textAlign: 'center',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-surface)',
                  }}
                >
                  <span style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🧴</span>
                  <p
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '0.875rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {search || catFilter !== 'TODAS'
                      ? 'No hay productos que coincidan con la búsqueda.'
                      : 'No hay productos disponibles para la venta.'}
                  </p>
                </motion.div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '0.75rem',
                  }}
                >
                  {filteredProductos.map((prod) => {
                    const outOfStock = prod.cantidadStock <= 0;
                    return (
                      <motion.div
                        key={prod.id}
                        variants={cardVariants}
                        initial="hidden"
                        animate="show"
                        whileHover={!outOfStock ? { scale: 1.02, y: -2 } : undefined}
                        whileTap={!outOfStock ? { scale: 0.98 } : undefined}
                        onClick={() => !outOfStock && addToCart(prod)}
                        style={{
                          background: 'var(--bg-surface)',
                          border: outOfStock
                            ? '1px solid var(--border)'
                            : '1px solid var(--border)',
                          borderRadius: 'var(--radius-md)',
                          padding: '1rem',
                          cursor: outOfStock ? 'not-allowed' : 'pointer',
                          opacity: outOfStock ? 0.5 : 1,
                          transition: 'border-color 0.2s, box-shadow 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          if (!outOfStock) {
                            e.currentTarget.style.borderColor = 'var(--accent)';
                            e.currentTarget.style.boxShadow =
                              '0 4px 20px rgba(212,168,83,0.15)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--border)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        <div
                          style={{
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            marginBottom: '0.35rem',
                            lineHeight: 1.3,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {prod.nombre}
                        </div>
                        {prod.marca && (
                          <div
                            style={{
                              fontFamily: "'DM Sans', sans-serif",
                              fontSize: '0.7rem',
                              color: 'var(--text-dim)',
                              marginBottom: '0.5rem',
                            }}
                          >
                            {prod.marca}
                          </div>
                        )}
                        <div
                          style={{
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: '1rem',
                            fontWeight: 700,
                            color: 'var(--accent)',
                            marginBottom: '0.5rem',
                          }}
                        >
                          {formatCurrency(prod.precioVenta)}
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                          }}
                        >
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: outOfStock
                                ? 'var(--danger)'
                                : prod.cantidadStock <= 5
                                  ? 'var(--warning)'
                                  : 'var(--success)',
                              display: 'inline-block',
                            }}
                          />
                          <span
                            style={{
                              fontFamily: "'DM Sans', sans-serif",
                              fontSize: '0.7rem',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {outOfStock
                              ? 'Sin stock'
                              : `${prod.cantidadStock} en stock`}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* Refresh button on error */}
              {dataError && (
                <div style={{ marginTop: '0.75rem' }}>
                  <button
                    onClick={fetchData}
                    style={{
                      ...primaryBtnStyle,
                      background: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      boxShadow: 'none',
                      border: '1px solid var(--border)',
                    }}
                  >
                    Reintentar
                  </button>
                </div>
              )}
            </div>

            {/* ============================================================ */}
            {/*  RIGHT PANEL — Cart + Payment                                 */}
            {/* ============================================================ */}
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                position: 'sticky',
                top: '1rem',
              }}
            >
              {/* Cart header */}
              <div
                style={{
                  padding: '1rem 1.25rem',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}
                >
                  🛒 Carrito de Venta
                </span>
                <button
                  onClick={clearCart}
                  disabled={cart.length === 0}
                  style={{
                    background: 'none',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-dim)',
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.7rem',
                    fontFamily: "'DM Sans', sans-serif",
                    cursor: cart.length === 0 ? 'default' : 'pointer',
                    opacity: cart.length === 0 ? 0.4 : 1,
                    transition: 'color 0.2s, border-color 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (cart.length > 0) {
                      e.currentTarget.style.color = 'var(--danger)';
                      e.currentTarget.style.borderColor = 'var(--danger)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--text-dim)';
                    e.currentTarget.style.borderColor = 'var(--border)';
                  }}
                >
                  Vaciar
                </button>
              </div>

              {/* Cart items */}
              <div
                style={{
                  padding: '0.75rem 1.25rem',
                  maxHeight: '280px',
                  overflowY: 'auto',
                }}
              >
                {cart.length === 0 ? (
                  <p
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '0.8125rem',
                      color: 'var(--text-dim)',
                      textAlign: 'center',
                      padding: '1.5rem 0',
                      margin: 0,
                    }}
                  >
                    Seleccioná productos de la lista para agregarlos al carrito.
                  </p>
                ) : (
                  cart.map((item) => (
                    <motion.div
                      key={item.productoId}
                      layout
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.5rem 0',
                        borderBottom: '1px solid var(--border)',
                        gap: '0.5rem',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: '0.8125rem',
                            fontWeight: 500,
                            color: 'var(--text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {item.nombre}
                        </div>
                        <div
                          style={{
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: '0.7rem',
                            color: 'var(--accent)',
                          }}
                        >
                          {formatCurrency(item.precioVenta)} × {item.cantidad}
                        </div>
                      </div>

                      {/* Quantity controls */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                        }}
                      >
                        <button
                          onClick={() => updateQty(item.productoId, -1)}
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
                          onClick={() => updateQty(item.productoId, 1)}
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
                        onClick={() => removeFromCart(item.productoId)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-dim)',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                          padding: '0.15rem',
                          lineHeight: 1,
                          transition: 'color 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = 'var(--danger)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--text-dim)';
                        }}
                      >
                        ✕
                      </button>
                    </motion.div>
                  ))
                )}
              </div>

              {/* Customer + Employee selectors */}
              <div
                style={{
                  padding: '0.75rem 1.25rem',
                  borderTop: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.625rem',
                }}
              >
                <div>
                  <label style={formLabelStyle}>Cliente *</label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value ? Number(e.target.value) : '')}
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
                <div>
                  <label style={formLabelStyle}>Empleada *</label>
                  <select
                    value={selectedEmployeeId}
                    onChange={(e) => setSelectedEmployeeId(e.target.value ? Number(e.target.value) : '')}
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

              {/* Payment section */}
              <div
                style={{
                  padding: '0.75rem 1.25rem',
                  borderTop: '1px solid var(--border)',
                }}
              >
                {/* Payment method tabs */}
                <label style={formLabelStyle}>Método de pago</label>
                <div
                  style={{
                    display: 'flex',
                    gap: '0.35rem',
                    marginBottom: '0.75rem',
                  }}
                >
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
                          style={{
                            flex: 1,
                            background: isActive ? 'var(--accent)' : 'var(--bg-base)',
                            color: isActive ? 'var(--bg-root)' : 'var(--text-secondary)',
                            border: isActive
                              ? '1px solid var(--accent)'
                              : '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0.4rem 0.5rem',
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: '0.7rem',
                            fontWeight: isActive ? 600 : 400,
                            cursor: 'pointer',
                            transition: 'background 0.2s, color 0.2s',
                          }}
                        >
                          {labels[method]}
                        </button>
                      );
                    },
                  )}
                </div>

                {/* Efectivo: monto recibido + cambio */}
                {paymentMethod === 'EFECTIVO' && (
                  <div style={{ marginBottom: '0.625rem' }}>
                    <label style={formLabelStyle}>Monto recibido</label>
                    <input
                      type="number"
                      min={0}
                      value={montoRecibido || ''}
                      onChange={(e) => setMontoRecibido(Number(e.target.value))}
                      placeholder="0"
                      style={{
                        ...searchInputStyle,
                        maxWidth: '100%',
                      }}
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
                    {montoRecibido >= cartTotal && cartTotal > 0 && (
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginTop: '0.35rem',
                          padding: '0.35rem 0.5rem',
                          borderRadius: 'var(--radius-sm)',
                          background: 'rgba(80,200,120,0.08)',
                          border: '1px solid rgba(80,200,120,0.2)',
                        }}
                      >
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

                {/* Tarjeta / Transferencia: referencia */}
                {(paymentMethod === 'TARJETA' || paymentMethod === 'TRANSFERENCIA') && (
                  <div style={{ marginBottom: '0.625rem' }}>
                    <label style={formLabelStyle}>Referencia (opcional)</label>
                    <input
                      type="text"
                      value={paymentRef}
                      onChange={(e) => setPaymentRef(e.target.value)}
                      placeholder="Nro. de referencia"
                      style={{
                        ...searchInputStyle,
                        maxWidth: '100%',
                      }}
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
                  </div>
                )}
              </div>

              {/* Totals */}
              <div
                style={{
                  padding: '0.75rem 1.25rem',
                  borderTop: '1px solid var(--border)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.25rem',
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '0.8125rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Subtotal
                  </span>
                  <span
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {formatCurrency(cartTotal)}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '0.5rem',
                    borderTop: '1px solid var(--border)',
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '1rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                    }}
                  >
                    Total
                  </span>
                  <span
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '1.25rem',
                      fontWeight: 800,
                      color: 'var(--accent)',
                    }}
                  >
                    {formatCurrency(cartTotal)}
                  </span>
                </div>
              </div>

              {/* Cobrar button */}
              <div
                style={{
                  padding: '0.75rem 1.25rem 1.25rem',
                  borderTop: '1px solid var(--border)',
                }}
              >
                <motion.button
                  whileHover={canCobrar && !processing ? { scale: 1.02 } : undefined}
                  whileTap={canCobrar && !processing ? { scale: 0.98 } : undefined}
                  onClick={handleCobrar}
                  disabled={!canCobrar || processing}
                  style={{
                    width: '100%',
                    background: canCobrar && !processing ? 'var(--accent)' : 'var(--bg-base)',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    color: canCobrar && !processing ? 'var(--bg-root)' : 'var(--text-dim)',
                    padding: '0.75rem 1rem',
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    cursor: canCobrar && !processing ? 'pointer' : 'default',
                    transition: 'background 0.2s, box-shadow 0.2s',
                    boxShadow:
                      canCobrar && !processing
                        ? '0 2px 16px rgba(212,168,83,0.3)'
                        : 'none',
                  }}
                >
                  {processing
                    ? 'Procesando…'
                    : `Cobrar ${formatCurrency(cartTotal)}`}
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
};

export default VentasPage;
