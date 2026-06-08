import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Skeleton, Button } from '@pos-final/ui';
import { Rol, type IUser } from '@pos-final/types';
import api from '../services/api.js';
import SalonSwitcher from '../components/SalonSwitcher.js';
import {
  fetchProductos,
  createProducto,
  updateProducto,
  deleteProducto,
  restockProducto,
  fetchHistorialPrecios,
  type Producto,
  type ProductoPrecioHistorico,
  type PaginatedResult,
} from '../services/productoService.js';

/* ── Constants ── */

const ITEMS_PER_PAGE = 12;

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

const smallActionBtn: React.CSSProperties = {
  background: 'none',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-secondary)',
  padding: '0.3rem 0.5rem',
  fontSize: '0.7rem',
  cursor: 'pointer',
  lineHeight: 1,
  transition: 'color 0.2s, border-color 0.2s',
};

const paginationBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)',
  padding: '0.35rem 0.7rem',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.75rem',
  cursor: 'pointer',
  transition: 'background 0.2s, border-color 0.2s',
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

const previewChipStyle: React.CSSProperties = {
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.7rem',
  color: 'var(--accent)',
  fontStyle: 'italic',
  marginTop: '0.2rem',
  paddingLeft: '0.1rem',
};

/* ── Helpers ── */

function formatCurrency(n: number): string {
  return currencyFormatter.format(n);
}

function getMargenColor(margen: number): string {
  if (margen >= 50) return 'var(--success)';
  if (margen >= 30) return 'var(--accent)';
  if (margen >= 15) return '#c8a850';
  return 'var(--danger)';
}

/* ── Component ── */

const ProductosPage: React.FC = () => {
  const navigate = useNavigate();

  /* Auth state */
  const [user, setUser] = useState<IUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  /* Data state */
  const [productos, setProductos] = useState<Producto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  /* UI state */
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Producto | null>(null);
  const [deleting, setDeleting] = useState<Producto | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  /* Filter state */
  const [filterTipo, setFilterTipo] = useState<'TODOS' | 'RETAIL' | 'INTERNAL'>('TODOS');

  /* Stock modal state */
  const [stockModal, setStockModal] = useState<{ producto: Producto; type: 'descontar' | 'reabastecer' | 'restock' } | null>(null);
  const [stockCantidad, setStockCantidad] = useState(0);
  const [restockPrecioCompra, setRestockPrecioCompra] = useState(0);

  /* History modal */
  const [historyModal, setHistoryModal] = useState<Producto | null>(null);
  const [historialData, setHistorialData] = useState<ProductoPrecioHistorico[]>([]);
  const [historialLoading, setHistorialLoading] = useState(false);

  const [form, setForm] = useState({
    nombre: '',
    descripcion: '',
    marca: '',
    precioCompra: 0,
    margenGanancia: 30,
    precioVenta: 0,
    cantidadStock: 0,
    stockMinimo: 0,
    tipoInventario: 'RETAIL' as 'RETAIL' | 'INTERNAL',
  });

  /* ── Derived ── */

  const salonId = useMemo(() => {
    if (!user) return null;
    const stored = localStorage.getItem('xSalonId');
    return stored ? Number(stored) : user.salonId;
  }, [user]);

  const suggestedPrecioVenta = useMemo(() => {
    if (form.precioCompra > 0 && form.margenGanancia > 0) {
      return Math.round(form.precioCompra * (1 + form.margenGanancia / 100) * 100) / 100;
    }
    return 0;
  }, [form.precioCompra, form.margenGanancia]);

  const canViewCost = user?.rol === Rol.DUEÑA || user?.rol === Rol.ADMINISTRADOR || user?.rol === Rol.CONTADOR || user?.rol === Rol.SUPERADMIN;

  /* ── Debounced search ── */
  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setCurrentPage(1);
    }, 300);
  };

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
      const result = await fetchProductos(salonId, {
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        q: debouncedSearch || undefined,
        tipo: filterTipo,
      }) as PaginatedResult<Producto>;

      setProductos(result.data);
      setTotalCount(result.meta.total);
      setPageCount(result.meta.totalPages);
    } catch {
      setDataError('Error al cargar productos');
      setProductos([]);
      setTotalCount(0);
      setPageCount(0);
    } finally {
      setDataLoading(false);
    }
  }, [salonId, currentPage, debouncedSearch, filterTipo]);

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
      precioCompra: 0,
      margenGanancia: 30,
      precioVenta: 0,
      cantidadStock: 0,
      stockMinimo: 0,
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
      precioCompra: prod.precioCompra ?? 0,
      margenGanancia: prod.margenGanancia,
      precioVenta: prod.precioVenta,
      cantidadStock: prod.cantidadStock,
      stockMinimo: prod.stockMinimo,
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
      const payload: Record<string, unknown> = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || undefined,
        marca: form.marca.trim() || undefined,
        precioCompra: form.precioCompra,
        margenGanancia: form.margenGanancia,
        cantidadStock: form.cantidadStock,
        stockMinimo: form.stockMinimo,
        tipoInventario: form.tipoInventario,
      };

      // If user manually edited precioVenta to something different from suggested,
      // send it explicitly. Otherwise omit it so backend auto-calculates.
      if (form.precioVenta !== suggestedPrecioVenta) {
        payload.precioVenta = form.precioVenta;
      }

      if (editing) {
        await updateProducto(salonId, editing.id, payload);
      } else {
        await createProducto(salonId, payload as any);
      }
      setShowModal(false);
      resetForm();
      fetchData();
    } catch {
      setActionError(
        editing
          ? 'Error al guardar el producto. Verificá los datos e intentá de nuevo.'
          : 'Error al crear el producto. Verificá los datos e intentá de nuevo.',
      );
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
      if (stockModal.type === 'restock') {
        await restockProducto(salonId, stockModal.producto.id, {
          cantidad: stockCantidad,
          precioCompra: restockPrecioCompra,
        });
      } else {
        await api.post(`/salones/${salonId}/productos/${stockModal.producto.id}/descontar`, {
          cantidad: stockCantidad,
        });
      }
      setStockModal(null);
      setStockCantidad(0);
      setRestockPrecioCompra(0);
      fetchData();
    } catch {
      setActionError('Error al actualizar el stock. Intentá de nuevo.');
    } finally {
      setActionLoading(false);
    }
  };

  /* ── Restock preview ── */
  const restockPreview = useMemo(() => {
    if (!stockModal || stockModal.type !== 'restock' || stockCantidad <= 0 || restockPrecioCompra <= 0) return null;
    const prod = stockModal.producto;
    const stockActual = prod.cantidadStock;
    const precioCompraActual = prod.precioCompra ?? 0;
    const nuevoPMP = stockActual > 0
      ? Math.round(((stockActual * precioCompraActual) + (stockCantidad * restockPrecioCompra)) / (stockActual + stockCantidad) * 100) / 100
      : restockPrecioCompra;
    const nuevoPV = Math.round(nuevoPMP * (1 + prod.margenGanancia / 100) * 100) / 100;

    return { nuevoPMP, nuevoPV, nuevoStock: stockActual + stockCantidad };
  }, [stockModal, stockCantidad, restockPrecioCompra]);

  /* ── Delete ── */
  const handleDelete = async () => {
    if (!salonId || !deleting) return;
    setActionError(null);
    setActionLoading(true);
    try {
      await deleteProducto(salonId, deleting.id);
      setDeleting(null);
      fetchData();
    } catch {
      setActionError('Error al eliminar el producto. Intentá de nuevo.');
    } finally {
      setActionLoading(false);
    }
  };

  /* ── Open history ── */
  const openHistory = async (prod: Producto) => {
    if (!salonId) return;
    setHistoryModal(prod);
    setHistorialLoading(true);
    try {
      const data = await fetchHistorialPrecios(salonId, prod.id);
      setHistorialData(data);
    } catch {
      setHistorialData([]);
    } finally {
      setHistorialLoading(false);
    }
  };

  /* ── Pagination ── */
  const goToPage = (page: number) => {
    if (page < 1 || page > pageCount) return;
    setCurrentPage(page);
  };

  const paginationRange = useMemo(() => {
    const range: (number | string)[] = [];
    const maxVisible = 5;
    if (pageCount <= maxVisible + 2) {
      for (let i = 1; i <= pageCount; i++) range.push(i);
    } else {
      range.push(1);
      if (currentPage > 3) range.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(pageCount - 1, currentPage + 1);
      for (let i = start; i <= end; i++) range.push(i);
      if (currentPage < pageCount - 2) range.push('...');
      range.push(pageCount);
    }
    return range;
  }, [pageCount, currentPage]);

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
          <div style={{ marginBottom: '1rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}
            >
              <input
                type="text"
                placeholder="Buscar por nombre o marca…"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
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
                  onClick={() => {
                    setFilterTipo(tipo);
                    setCurrentPage(1);
                  }}
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
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
          ) : productos.length === 0 ? (
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
                {debouncedSearch ? 'Sin resultados' : 'No hay productos'}
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
                {debouncedSearch
                  ? 'No encontramos productos con ese nombre o marca.'
                  : 'Agregá tu primer producto al inventario.'}
              </p>
              {!debouncedSearch && (
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
              )}
            </motion.div>
          ) : (
            <>
              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface)',
                  overflowX: 'auto',
                }}
              >
                {/* Table header */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(120px, 1.2fr) 60px 80px 90px 70px 80px 100px 100px',
                    gap: '0.75rem',
                    padding: '0.65rem 1rem',
                    borderBottom: '1px solid var(--border)',
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    color: 'var(--text-dim)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  <span>Nombre</span>
                  <span>Stock</span>
                  <span>P. Compra</span>
                  <span>P. Venta</span>
                  <span>Margen</span>
                  <span>Tipo</span>
                  <span>Marca</span>
                  <span style={{ textAlign: 'right' }}>Acción</span>
                </div>

                {/* Rows */}
                {productos.map((prod, idx) => {
                  const isLowStock = prod.cantidadStock <= prod.stockMinimo;
                  const isLast = idx === productos.length - 1;
                  const margen = prod.margenGanancia;

                  return (
                    <motion.div
                      key={prod.id}
                      variants={itemVariants}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(120px, 1.2fr) 60px 80px 90px 70px 80px 100px 100px',
                        gap: '0.75rem',
                        padding: '0.75rem 1rem',
                        borderBottom: isLast ? 'none' : '1px solid var(--border)',
                        alignItems: 'center',
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '0.8125rem',
                        color: 'var(--text-primary)',
                        transition: 'background 0.15s',
                        background: isLowStock ? 'rgba(224,85,106,0.04)' : 'transparent',
                      }}
                      whileHover={{ background: isLowStock ? 'rgba(224,85,106,0.08)' : 'var(--bg-hover)' }}
                      transition={{ duration: 0.15 }}
                    >
                      <span style={{ fontWeight: 500 }}>{prod.nombre}</span>
                      <span>
                        <span
                          style={{
                            color: isLowStock ? 'var(--danger)' : 'var(--text-primary)',
                            fontWeight: isLowStock ? 600 : 400,
                          }}
                        >
                          {Math.round(prod.cantidadStock)}
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
                            Mín
                          </span>
                        )}
                      </span>
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>
                        {canViewCost && prod.precioCompra ? formatCurrency(prod.precioCompra) : '—'}
                      </span>
                      <span style={{ color: 'var(--accent)', fontWeight: 500 }}>
                        {formatCurrency(prod.precioVenta)}
                      </span>
                      <span style={{ color: getMargenColor(margen), fontWeight: 600, fontSize: '0.75rem' }}>
                        {margen}%
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
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                        {prod.marca || '—'}
                      </span>
                      <span style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => {
                            setStockModal({ producto: prod, type: 'restock' });
                            setStockCantidad(0);
                            setRestockPrecioCompra(prod.precioCompra ?? 0);
                          }}
                          style={{
                            ...smallActionBtn,
                            borderColor: 'var(--success)',
                            color: 'var(--success)',
                          }}
                          title="Re-stock inteligente"
                          aria-label="Re-stock inteligente"
                        >
                          Re-stock
                        </button>
                        <button
                          onClick={() => {
                            setStockModal({ producto: prod, type: 'descontar' });
                            setStockCantidad(0);
                          }}
                          style={{
                            ...smallActionBtn,
                            borderColor: 'var(--danger)',
                            color: 'var(--danger)',
                          }}
                          title="Descontar stock"
                          aria-label="Descontar stock"
                        >
                          - Stock
                        </button>
                        <button
                          onClick={() => openEdit(prod)}
                          style={smallActionBtn}
                          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => openHistory(prod)}
                          style={smallActionBtn}
                          title="Historial de precios"
                        >
                          Historial
                        </button>
                        <button
                          onClick={() => setDeleting(prod)}
                          style={{
                            ...smallActionBtn,
                            color: 'var(--danger)',
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

              {/* ── Pagination ── */}
              {pageCount > 1 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem',
                    marginTop: '1rem',
                  }}
                >
                  <button
                    style={{
                      ...paginationBtnStyle,
                      opacity: currentPage === 1 ? 0.4 : 1,
                      cursor: currentPage === 1 ? 'default' : 'pointer',
                    }}
                    disabled={currentPage === 1}
                    onClick={() => goToPage(currentPage - 1)}
                  >
                    ←
                  </button>
                  {paginationRange.map((p, i) =>
                    typeof p === 'string' ? (
                      <span
                        key={`ellipsis-${i}`}
                        style={{ color: 'var(--text-dim)', fontSize: '0.75rem', padding: '0 0.25rem' }}
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        style={{
                          ...paginationBtnStyle,
                          background: p === currentPage ? 'var(--accent)' : 'transparent',
                          color: p === currentPage ? 'var(--bg-root)' : 'var(--text-primary)',
                          borderColor: p === currentPage ? 'var(--accent)' : 'var(--border)',
                          fontWeight: p === currentPage ? 600 : 400,
                        }}
                        onClick={() => goToPage(p)}
                      >
                        {p}
                      </button>
                    ),
                  )}
                  <button
                    style={{
                      ...paginationBtnStyle,
                      opacity: currentPage === pageCount ? 0.4 : 1,
                      cursor: currentPage === pageCount ? 'default' : 'pointer',
                    }}
                    disabled={currentPage === pageCount}
                    onClick={() => goToPage(currentPage + 1)}
                  >
                    →
                  </button>
                  <span
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '0.7rem',
                      color: 'var(--text-dim)',
                      marginLeft: '0.5rem',
                    }}
                  >
                    {totalCount} productos
                  </span>
                </div>
              )}
            </>
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
                    <label style={formLabelStyle}>Precio de compra</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={form.precioCompra || ''}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setForm((prev) => ({ ...prev, precioCompra: val }));
                      }}
                      style={formFieldStyle}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.875rem' }}>
                  <div>
                    <label style={formLabelStyle}>Margen de ganancia (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={1000}
                      value={form.margenGanancia}
                      onChange={(e) => setForm((prev) => ({ ...prev, margenGanancia: Number(e.target.value) }))}
                      style={formFieldStyle}
                      placeholder="30"
                    />
                  </div>
                  <div>
                    <label style={formLabelStyle}>Precio de venta</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={form.precioVenta || ''}
                      onChange={(e) => setForm((prev) => ({ ...prev, precioVenta: Number(e.target.value) }))}
                      style={{
                        ...formFieldStyle,
                        borderColor: form.precioVenta !== suggestedPrecioVenta && suggestedPrecioVenta > 0 ? 'var(--accent)' : 'var(--border)',
                      }}
                      placeholder="0"
                    />
                    {suggestedPrecioVenta > 0 && (
                      <div style={previewChipStyle}>
                        Sugerido: {formatCurrency(suggestedPrecioVenta)}
                        {form.precioVenta !== suggestedPrecioVenta && (
                          <span style={{ color: 'var(--text-dim)', marginLeft: '0.3rem' }}>
                            (manual)
                          </span>
                        )}
                      </div>
                    )}
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

      {/* ── Stock Modal (re-stock & descontar) ── */}
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
                setRestockPrecioCompra(0);
              }
            }}
          >
            <motion.div
              style={{ ...modalContentStyle, maxWidth: '400px' }}
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
                  {stockModal.type === 'restock' ? 'Re-stock inteligente' : 'Descontar stock'}
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
                    {Math.round(stockModal.producto.cantidadStock)}
                  </strong>
                </p>

                <div style={{ marginBottom: '1rem' }}>
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

                {stockModal.type === 'restock' && (
                  <>
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={formLabelStyle}>Nuevo precio de compra unitario</label>
                      <input
                        type="number"
                        min={0.01}
                        step={0.01}
                        value={restockPrecioCompra || ''}
                        onChange={(e) => setRestockPrecioCompra(Number(e.target.value))}
                        style={formFieldStyle}
                        placeholder="0"
                      />
                    </div>

                    {restockPreview && (
                      <div
                        style={{
                          background: 'var(--bg-base)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0.75rem',
                          marginBottom: '1rem',
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: '0.75rem',
                          border: '1px solid var(--border)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Nuevo PMP:</span>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                            {formatCurrency(restockPreview.nuevoPMP)}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Nuevo P. Venta ({stockModal.producto.margenGanancia}% margen):</span>
                          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                            {formatCurrency(restockPreview.nuevoPV)}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Stock resultante:</span>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                            {restockPreview.nuevoStock}
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button
                    style={ghostBtnStyle}
                    onClick={() => {
                      setStockModal(null);
                      setStockCantidad(0);
                      setRestockPrecioCompra(0);
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
                    disabled={
                      stockCantidad <= 0 ||
                      actionLoading ||
                      (stockModal.type === 'restock' && restockPrecioCompra <= 0)
                    }
                  >
                    {actionLoading
                      ? 'Procesando…'
                      : stockModal.type === 'descontar'
                        ? 'Descontar'
                        : 'Confirmar re-stock'}
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

      {/* ── Historial de precios modal ── */}
      <AnimatePresence>
        {historyModal && (
          <motion.div
            style={modalOverlayStyle}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setHistoryModal(null);
            }}
          >
            <motion.div
              style={{ ...modalContentStyle, maxWidth: '600px' }}
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.25, ease: [0.22, 0.61, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
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
                  Historial de precios — {historyModal.nombre}
                </span>
                <button
                  onClick={() => setHistoryModal(null)}
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

              <div style={{ padding: '1.5rem' }}>
                {historialLoading ? (
                  <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <Skeleton height="20px" width="100%" variant="rect" />
                  </div>
                ) : historialData.length === 0 ? (
                  <p
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '0.8125rem',
                      color: 'var(--text-dim)',
                      textAlign: 'center',
                      padding: '2rem',
                    }}
                  >
                    No hay registros de re-stock todavía.
                  </p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr',
                        gap: '0.5rem',
                        padding: '0.5rem 0',
                        borderBottom: '1px solid var(--border)',
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        color: 'var(--text-dim)',
                        textTransform: 'uppercase',
                      }}
                    >
                      <span>Fecha</span>
                      <span>Agregado</span>
                      <span>P. Compra</span>
                      <span>P. Venta</span>
                      <span>Stock final</span>
                    </div>
                    {historialData.map((h) => (
                      <div
                        key={h.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr',
                          gap: '0.5rem',
                          padding: '0.5rem 0',
                          borderBottom: '1px solid var(--border)',
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: '0.75rem',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>
                          {new Date(h.fecha).toLocaleString('es-CL')}
                        </span>
                        <span>{h.cantidadAgregada}</span>
                        <span style={{ color: 'var(--text-dim)' }}>
                          {canViewCost ? formatCurrency(h.precioCompra) : '—'}
                        </span>
                        <span style={{ color: 'var(--accent)' }}>{formatCurrency(h.precioVenta)}</span>
                        <span>{h.stockDespues}</span>
                      </div>
                    ))}
                  </div>
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
                  <button style={ghostBtnStyle} onClick={() => setDeleting(null)}>
                    Cancelar
                  </button>
                  <button style={dangerBtnStyle} onClick={handleDelete} disabled={actionLoading}>
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
