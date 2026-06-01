import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Skeleton, Button } from '@pos-final/ui';
import { Rol, type IUser } from '@pos-final/types';
import api from '../services/api.js';
import SalonSwitcher from '../components/SalonSwitcher.js';

/* ── Types ── */

interface Categoria {
  id: number;
  nombre: string;
  descripcion?: string;
}

interface Producto {
  id: number;
  nombre: string;
  descripcion?: string;
  marca?: string;
  codigoBarras?: string;
  presentacion?: string;
  costoCompra?: number;
  precioVenta: number;
  cantidadStock: number;
  stockMinimo: number;
  categoriaId?: number;
  categoria?: Categoria;
  tipoInventario?: 'RETAIL' | 'INTERNAL';
  creadoEn?: string;
  actualizadoEn?: string;
}

/* ── Constants ── */



const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/* ── Style constants ── */

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

const dangerBtnStyle: React.CSSProperties = {
  background: 'var(--danger)',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  color: '#fff',
  padding: '0.5rem 1.25rem',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.8125rem',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'background 0.2s',
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

const tableHeaderStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(120px, 1.2fr) 80px 65px 70px 100px 80px 90px 100px 100px 140px',
  gap: '0.75rem',
  padding: '0.65rem 1rem',
  borderBottom: '1px solid var(--border)',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.6875rem',
  fontWeight: 600,
  color: 'var(--text-dim)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};

const tableRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(120px, 1.2fr) 80px 65px 70px 100px 80px 90px 100px 100px 140px',
  gap: '0.75rem',
  padding: '0.75rem 1rem',
  borderBottom: '1px solid var(--border)',
  alignItems: 'center',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.8125rem',
  color: 'var(--text-primary)',
  transition: 'background 0.15s',
};

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.6)',
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 200,
  padding: '1rem',
};

const modalContentStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(212,168,83,0.06)',
  width: '100%',
  maxWidth: '520px',
  maxHeight: '90vh',
  overflowY: 'auto',
};

const formFieldStyle: React.CSSProperties = {
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
  transition: 'border-color 0.2s, box-shadow 0.2s',
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

const ProductosPage: React.FC = () => {
  const navigate = useNavigate();

  /* Auth state */
  const [user, setUser] = useState<IUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  /* Data state */
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  /* UI state */
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Producto | null>(null);
  const [deleting, setDeleting] = useState<Producto | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  /* Filter state */
  const [filterTipo, setFilterTipo] = useState<'TODOS' | 'RETAIL' | 'INTERNAL'>('TODOS');

  /* Stock modal state */
  const [stockModal, setStockModal] = useState<{ producto: Producto; type: 'descontar' | 'reabastecer' } | null>(null);
  const [stockCantidad, setStockCantidad] = useState(0);

  const [form, setForm] = useState({
    nombre: '',
    descripcion: '',
    marca: '',
    codigoBarras: '',
    presentacion: '',
    costoCompra: 0,
    precioVenta: 0,
    cantidadStock: 0,
    stockMinimo: 0,
    categoriaId: 0,
    tipoInventario: 'RETAIL' as 'RETAIL' | 'INTERNAL',
  });

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
    if (filterTipo !== 'TODOS') {
      list = list.filter((p) => p.tipoInventario === filterTipo);
    }
    return list;
  }, [productos, search, filterTipo]);

  const hasData = filteredProductos.length > 0;

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
      const [prodRes, catRes] = await Promise.all([
        api.get(`/salones/${salonId}/productos`),
        api.get(`/salones/${salonId}/categorias`),
      ]);
      const prodData = Array.isArray(prodRes.data) ? prodRes.data : prodRes.data?.data ?? [];
      const catData = Array.isArray(catRes.data) ? catRes.data : catRes.data?.data ?? [];
      setProductos(prodData);
      setCategorias(catData);
    } catch {
      setDataError('Error al cargar productos');
      setProductos([]);
      setCategorias([]);
    } finally {
      setDataLoading(false);
    }
  }, [salonId]);

  useEffect(() => {
    if (!authLoading && salonId != null) {
      fetchData();
    }
  }, [authLoading, salonId, fetchData]);

  /* ── Reset form ── */
  const resetForm = () => {
    setForm({
      nombre: '',
      descripcion: '',
      marca: '',
      codigoBarras: '',
      presentacion: '',
      costoCompra: 0,
      precioVenta: 0,
      cantidadStock: 0,
      stockMinimo: 0,
      categoriaId: 0,
      tipoInventario: 'RETAIL',
    });
    setEditing(null);
  };

  /* ── Open edit modal ── */
  const openEdit = (prod: Producto) => {
    setEditing(prod);
    setForm({
      nombre: prod.nombre,
      descripcion: prod.descripcion ?? '',
      marca: prod.marca ?? '',
      codigoBarras: prod.codigoBarras ?? '',
      presentacion: prod.presentacion ?? '',
      costoCompra: prod.costoCompra ?? 0,
      precioVenta: prod.precioVenta,
      cantidadStock: prod.cantidadStock,
      stockMinimo: prod.stockMinimo,
      categoriaId: prod.categoriaId ?? 0,
      tipoInventario: prod.tipoInventario ?? 'RETAIL',
    });
    setShowModal(true);
  };

  /* ── Create / Update ── */
  const handleSave = async () => {
    if (!salonId || !form.nombre.trim() || form.precioVenta <= 0) return;
    setActionError(null);
    setActionLoading(true);
    try {
      const payload = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || undefined,
        marca: form.marca.trim() || undefined,
        codigoBarras: form.codigoBarras.trim() || undefined,
        presentacion: form.presentacion.trim() || undefined,
        costoCompra: form.costoCompra > 0 ? form.costoCompra : undefined,
        precioVenta: form.precioVenta,
        cantidadStock: form.cantidadStock,
        stockMinimo: form.stockMinimo,
        categoriaId: form.categoriaId > 0 ? form.categoriaId : undefined,
        tipoInventario: form.tipoInventario,
      };

      if (editing) {
        await api.put(`/salones/${salonId}/productos/${editing.id}`, payload);
      } else {
        await api.post(`/salones/${salonId}/productos`, payload);
      }
      setShowModal(false);
      resetForm();
      fetchData();
    } catch {
      setActionError(editing ? 'Error al guardar el producto. Verificá los datos e intentá de nuevo.' : 'Error al crear el producto. Verificá los datos e intentá de nuevo.');
    } finally {
      setActionLoading(false);
    }
  };

  /* ── Stock operations ── */
  const handleStockAction = async () => {
    if (!salonId || !stockModal || stockCantidad <= 0) return;
    setActionError(null);
    setActionLoading(true);
    try {
      const endpoint =
        stockModal.type === 'descontar'
          ? `/salones/${salonId}/productos/${stockModal.producto.id}/descontar`
          : `/salones/${salonId}/productos/${stockModal.producto.id}/reabastecer`;
      await api.post(endpoint, { cantidad: stockCantidad });
      setStockModal(null);
      setStockCantidad(0);
      fetchData();
    } catch {
      setActionError('Error al actualizar el stock. Intentá de nuevo.');
    } finally {
      setActionLoading(false);
    }
  };

  /* ── Delete ── */
  const handleDelete = async () => {
    if (!salonId || !deleting) return;
    setActionError(null);
    setActionLoading(true);
    try {
      await api.delete(`/salones/${salonId}/productos/${deleting.id}`);
      setDeleting(null);
      fetchData();
    } catch {
      setActionError('Error al eliminar el producto. Intentá de nuevo.');
    } finally {
      setActionLoading(false);
    }
  };

  /* ── Animation variants ── */
  const itemVariants = {
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
          key="productos-content"
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

          {/* ── Toolbar ── */}
          <div
            style={{ marginBottom: '1rem', opacity: 1, visibility: 'visible' as const }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
                opacity: 1,
                visibility: 'visible' as const,
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
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <button
                  onClick={() => {
                    resetForm();
                    setShowModal(true);
                  }}
                  style={primaryBtnStyle}
                >
                  + Nuevo Producto
                </button>
              </motion.div>
            </div>
          </div>

          {/* ── Tipo filter chips ── */}
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              marginBottom: '1rem',
              flexWrap: 'wrap',
            }}
          >
            {(['TODOS', 'RETAIL', 'INTERNAL'] as const).map((tipo) => {
              const isActive = filterTipo === tipo;
              return (
                <motion.button
                  key={tipo}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setFilterTipo(tipo)}
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
                  {tipo === 'TODOS' ? 'Todos' : tipo === 'RETAIL' ? 'Para Venta' : 'Uso Interno'}
                </motion.button>
              );
            })}
          </div>

          {/* ── Content area ── */}
          {dataLoading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
            >
              <Skeleton height="40px" variant="rect" style={{ marginBottom: '0.25rem' }} />
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} height="48px" variant="rect" style={{ marginBottom: '2px' }} />
              ))}
            </motion.div>
          ) : dataError ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '3rem 2rem',
                textAlign: 'center',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-surface)',
              }}
            >
              <span style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⚠️</span>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', color: 'var(--danger)', marginBottom: '1rem' }}>
                {dataError}
              </p>
              <Button variant="secondary" size="sm" onClick={fetchData}>
                Reintentar
              </Button>
            </motion.div>
          ) : !hasData ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4rem 2rem',
                textAlign: 'center',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-surface)',
              }}
            >
              <span style={{ fontSize: '3rem', marginBottom: '1rem' }}>🧴</span>
              <h2
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '0.5rem',
                }}
              >
                No hay productos
              </h2>
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '0.8125rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '1.5rem',
                  maxWidth: '320px',
                }}
              >
                Agregá tu primer producto al inventario.
              </p>
              <motion.button
                style={primaryBtnStyle}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  resetForm();
                  setShowModal(true);
                }}
              >
                + Nuevo Producto
              </motion.button>
            </motion.div>
          ) : (
            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-surface)',
                overflowX: 'auto',
                opacity: 1,
                visibility: 'visible' as const,
              }}
            >
              {/* Table header */}
              <div style={tableHeaderStyle}>
                <span>Nombre</span>
                <span>Marca</span>
                <span>Stock</span>
                <span>Tipo</span>
                <span>Precio Venta</span>
                <span>Costo</span>
                <span>Categoría</span>
                <span>Creado</span>
                <span>Modificado</span>
                <span style={{ textAlign: 'right' }}>Acción</span>
              </div>

              {/* Rows */}
              {filteredProductos.map((prod, idx) => {
                const isLowStock = prod.cantidadStock <= prod.stockMinimo;
                const isLast = idx === filteredProductos.length - 1;

                return (
                  <motion.div
                    key={prod.id}
                    variants={itemVariants}
                    style={{
                      ...tableRowStyle,
                      borderBottom: isLast ? 'none' : '1px solid var(--border)',
                      background: isLowStock ? 'rgba(224,85,106,0.04)' : 'transparent',
                    }}
                    whileHover={{ background: isLowStock ? 'rgba(224,85,106,0.08)' : 'var(--bg-hover)' }}
                    transition={{ duration: 0.15 }}
                  >
                    <span style={{ fontWeight: 500 }}>{prod.nombre}</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                      {prod.marca || '—'}
                    </span>
                    <span>
                      <span style={{ color: isLowStock ? 'var(--danger)' : 'var(--text-primary)', fontWeight: isLowStock ? 600 : 400 }}>
                        {prod.cantidadStock}
                      </span>
                      {isLowStock && (
                        <span
                          style={{
                            marginLeft: '0.35rem',
                            fontSize: '0.6rem',
                            padding: '0.1rem 0.35rem',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--danger)',
                            color: '#fff',
                            fontWeight: 600,
                            fontFamily: "'DM Sans', sans-serif",
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Mínimo
                        </span>
                      )}
                    </span>
                    <span>
                      {prod.tipoInventario ? (
                        <span
                          style={{
                            fontSize: '0.65rem',
                            padding: '0.15rem 0.45rem',
                            borderRadius: 'var(--radius-sm)',
                            fontWeight: 600,
                            fontFamily: "'DM Sans', sans-serif",
                            whiteSpace: 'nowrap',
                            background: prod.tipoInventario === 'RETAIL' ? 'rgba(80,200,120,0.15)' : 'rgba(200,160,80,0.15)',
                            color: prod.tipoInventario === 'RETAIL' ? '#50c878' : '#c8a850',
                            border: prod.tipoInventario === 'RETAIL' ? '1px solid rgba(80,200,120,0.3)' : '1px solid rgba(200,160,80,0.3)',
                          }}
                        >
                          {prod.tipoInventario === 'RETAIL' ? 'Venta' : 'Interno'}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>—</span>
                      )}
                    </span>
                    <span style={{ color: 'var(--accent)', fontWeight: 500 }}>
                      {formatCurrency(prod.precioVenta)}
                    </span>
                    <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>
                      {prod.costoCompra ? formatCurrency(prod.costoCompra) : '—'}
                    </span>
                    <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>
                      {prod.categoria?.nombre ?? '—'}
                    </span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                      {prod.creadoEn ? new Date(prod.creadoEn).toLocaleDateString('es-CL') : '—'}
                    </span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                      {prod.actualizadoEn ? new Date(prod.actualizadoEn).toLocaleDateString('es-CL') : '—'}
                    </span>
                    <span style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => {
                          setStockModal({ producto: prod, type: 'descontar' });
                          setStockCantidad(0);
                        }}
                        style={{
                          background: 'none',
                          border: '1px solid var(--danger)',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--danger)',
                          padding: '0.3rem 0.5rem',
                          fontSize: '0.7rem',
                          cursor: 'pointer',
                          lineHeight: 1,
                        }}
                        title="Descontar stock"
                        aria-label="Descontar stock"
                      >
                        - Stock
                      </button>
                      <button
                        onClick={() => {
                          setStockModal({ producto: prod, type: 'reabastecer' });
                          setStockCantidad(0);
                        }}
                        style={{
                          background: 'none',
                          border: '1px solid var(--success)',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--success)',
                          padding: '0.3rem 0.5rem',
                          fontSize: '0.7rem',
                          cursor: 'pointer',
                          lineHeight: 1,
                        }}
                        title="Reabastecer stock"
                        aria-label="Reabastecer stock"
                      >
                        + Stock
                      </button>
                      <button
                        onClick={() => openEdit(prod)}
                        style={{
                          background: 'none',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--text-secondary)',
                          padding: '0.3rem 0.5rem',
                          fontSize: '0.7rem',
                          cursor: 'pointer',
                          lineHeight: 1,
                          transition: 'color 0.2s, border-color 0.2s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => setDeleting(prod)}
                        style={{
                          background: 'none',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--danger)',
                          padding: '0.3rem 0.5rem',
                          fontSize: '0.7rem',
                          cursor: 'pointer',
                          lineHeight: 1,
                          transition: 'border-color 0.2s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--danger)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                      >
                        Eliminar
                      </button>
                    </span>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── Create / Edit Modal ── */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            style={modalOverlayStyle}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowModal(false);
                resetForm();
              }
            }}
          >
            <motion.div
              style={modalContentStyle}
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.25, ease: [0.22, 0.61, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                style={{
                  padding: '1.25rem 1.5rem 0.75rem',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: '1.125rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}
                >
                  {editing ? 'Editar Producto' : 'Nuevo Producto'}
                </span>
                <button
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-dim)',
                    fontSize: '1.25rem',
                    cursor: 'pointer',
                    padding: '0 0.25rem',
                    lineHeight: 1,
                  }}
                  aria-label="Cerrar"
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div style={{ padding: '1.25rem 1.5rem' }}>
                <div style={{ marginBottom: '0.875rem' }}>
                  <label style={formLabelStyle}>Nombre *</label>
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value }))}
                    style={formFieldStyle}
                    placeholder="Ej: Shampoo profesional"
                    autoFocus
                  />
                </div>

                <div style={{ marginBottom: '0.875rem' }}>
                  <label style={formLabelStyle}>Descripción</label>
                  <textarea
                    value={form.descripcion}
                    onChange={(e) => setForm((prev) => ({ ...prev, descripcion: e.target.value }))}
                    style={{ ...formFieldStyle, height: 'auto', minHeight: '60px', padding: '0.5rem 0.7rem', resize: 'vertical' }}
                    placeholder="Opcional…"
                    rows={2}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.875rem' }}>
                  <div>
                    <label style={formLabelStyle}>Marca</label>
                    <input
                      type="text"
                      value={form.marca}
                      onChange={(e) => setForm((prev) => ({ ...prev, marca: e.target.value }))}
                      style={formFieldStyle}
                      placeholder="Opcional"
                    />
                  </div>
                  <div>
                    <label style={formLabelStyle}>Código de barras</label>
                    <input
                      type="text"
                      value={form.codigoBarras}
                      onChange={(e) => setForm((prev) => ({ ...prev, codigoBarras: e.target.value }))}
                      style={formFieldStyle}
                      placeholder="Opcional"
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '0.875rem' }}>
                  <label style={formLabelStyle}>Presentación</label>
                  <input
                    type="text"
                    value={form.presentacion}
                    onChange={(e) => setForm((prev) => ({ ...prev, presentacion: e.target.value }))}
                    style={formFieldStyle}
                    placeholder="Ej: 500ml, 1L, unidad"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.875rem' }}>
                  <div>
                    <label style={formLabelStyle}>Costo compra</label>
                    <input
                      type="number"
                      min={0}
                      value={form.costoCompra || ''}
                      onChange={(e) => setForm((prev) => ({ ...prev, costoCompra: Number(e.target.value) }))}
                      style={formFieldStyle}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label style={formLabelStyle}>Precio venta *</label>
                    <input
                      type="number"
                      min={0}
                      value={form.precioVenta || ''}
                      onChange={(e) => setForm((prev) => ({ ...prev, precioVenta: Number(e.target.value) }))}
                      style={formFieldStyle}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.875rem' }}>
                  <div>
                    <label style={formLabelStyle}>Stock inicial</label>
                    <input
                      type="number"
                      min={0}
                      value={form.cantidadStock}
                      onChange={(e) => setForm((prev) => ({ ...prev, cantidadStock: Number(e.target.value) }))}
                      style={formFieldStyle}
                    />
                  </div>
                  <div>
                    <label style={formLabelStyle}>Stock mínimo</label>
                    <input
                      type="number"
                      min={0}
                      value={form.stockMinimo}
                      onChange={(e) => setForm((prev) => ({ ...prev, stockMinimo: Number(e.target.value) }))}
                      style={formFieldStyle}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '0.875rem' }}>
                  <label style={formLabelStyle}>Categoría</label>
                  <select
                    value={form.categoriaId}
                    onChange={(e) => setForm((prev) => ({ ...prev, categoriaId: Number(e.target.value) }))}
                    style={{
                      ...formFieldStyle,
                      appearance: 'none',
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill='%238c8894' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 10px center',
                      paddingRight: '28px',
                      cursor: 'pointer',
                    }}
                  >
                    <option value={0}>Sin categoría</option>
                    {categorias.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: '0.875rem' }}>
                  <label style={formLabelStyle}>Tipo de inventario</label>
                  <select
                    value={form.tipoInventario}
                    onChange={(e) => setForm((prev) => ({ ...prev, tipoInventario: e.target.value as 'RETAIL' | 'INTERNAL' }))}
                    style={{
                      ...formFieldStyle,
                      appearance: 'none',
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill='%238c8894' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 10px center',
                      paddingRight: '28px',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="RETAIL">Para Venta</option>
                    <option value="INTERNAL">Uso Interno</option>
                  </select>
                </div>
              </div>

              {/* Footer */}
              {actionError && (
                <div style={{ padding: '0 1.5rem' }}>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem', color: 'var(--danger)', margin: 0 }}>
                    {actionError}
                  </p>
                </div>
              )}
              <div
                style={{
                  padding: '0.75rem 1.5rem 1.25rem',
                  borderTop: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                }}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!form.nombre.trim() || form.precioVenta <= 0}
                  loading={actionLoading}
                  onClick={handleSave}
                >
                  {editing ? 'Guardar cambios' : 'Crear producto'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Stock Modal ── */}
      <AnimatePresence>
        {stockModal && (
          <motion.div
            style={modalOverlayStyle}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setStockModal(null);
                setStockCantidad(0);
              }
            }}
          >
            <motion.div
              style={{ ...modalContentStyle, maxWidth: '360px' }}
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.25, ease: [0.22, 0.61, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ padding: '1.5rem' }}>
                <h3
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: '0.25rem',
                  }}
                >
                  {stockModal.type === 'descontar' ? 'Descontar stock' : 'Reabastecer stock'}
                </h3>
                <p
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '0.75rem',
                    color: 'var(--text-dim)',
                    marginBottom: '1rem',
                  }}
                >
                  {stockModal.producto.nombre} — Stock actual:{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {stockModal.producto.cantidadStock}
                  </strong>
                </p>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={formLabelStyle}>Cantidad</label>
                  <input
                    type="number"
                    min={1}
                    value={stockCantidad || ''}
                    onChange={(e) => setStockCantidad(Number(e.target.value))}
                    style={formFieldStyle}
                    placeholder="0"
                    autoFocus
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button
                    style={ghostBtnStyle}
                    onClick={() => {
                      setStockModal(null);
                      setStockCantidad(0);
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    style={{
                      ...primaryBtnStyle,
                      background: stockModal.type === 'descontar' ? 'var(--danger)' : 'var(--success)',
                      boxShadow: 'none',
                    }}
                    onClick={handleStockAction}
                    disabled={stockCantidad <= 0 || actionLoading}
                  >
                    {actionLoading
                      ? 'Procesando…'
                      : stockModal.type === 'descontar'
                        ? 'Descontar'
                        : 'Reabastecer'}
                  </button>
                </div>
                {actionError && (
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem', color: 'var(--danger)', marginTop: '0.75rem', marginBottom: 0 }}>
                    {actionError}
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Delete confirmation ── */}
      <AnimatePresence>
        {deleting && (
          <motion.div
            style={modalOverlayStyle}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setDeleting(null);
            }}
          >
            <motion.div
              style={{ ...modalContentStyle, maxWidth: '380px' }}
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.25, ease: [0.22, 0.61, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.75rem' }}>🗑️</span>
                <h3
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: '0.5rem',
                  }}
                >
                  ¿Eliminar producto?
                </h3>
                <p
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '0.8125rem',
                    color: 'var(--text-secondary)',
                    marginBottom: '1.25rem',
                  }}
                >
                  Esta acción eliminará permanentemente <strong>{deleting.nombre}</strong>.
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                  <button
                    style={ghostBtnStyle}
                    onClick={() => setDeleting(null)}
                  >
                    Cancelar
                  </button>
                  <button
                    style={dangerBtnStyle}
                    onClick={handleDelete}
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Eliminando…' : 'Eliminar'}
                  </button>
                </div>
                {actionError && (
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem', color: 'var(--danger)', marginTop: '0.75rem', marginBottom: 0 }}>
                    {actionError}
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ProductosPage;
