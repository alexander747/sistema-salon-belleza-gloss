import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, MenuItem, useMediaQuery } from '@mui/material';
import { Inventory2, RemoveCircle, Edit, History, DeleteOutlined } from '@mui/icons-material';
import { Skeleton, Button } from '@pos-final/ui';
import { Rol, type IUser } from '@pos-final/types';
import api from '../services/api.js';
import SalonSwitcher from '../components/SalonSwitcher.js';
import PaginationBar from '../components/PaginationBar.js';
import TableSkeleton from '../components/TableSkeleton.js';
import MoneyInput from '../components/MoneyInput.js';
import { formatCurrency } from '../utils/format.js';
import styles from './ProductosPage.module.css';
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

/** Botón "⋮" que abre el menú de acciones de una fila. */
const menuTriggerBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: '1.15rem',
  padding: '0.2rem 0.45rem',
  borderRadius: 'var(--radius-sm)',
  transition: 'background 0.15s, color 0.15s',
  color: 'var(--text-secondary)',
  lineHeight: 1,
};

/** Fila de acción del bottom-sheet móvil. */
const sheetActionBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.65rem',
  width: '100%',
  padding: '0.85rem 1rem',
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid var(--border)',
  color: 'var(--text-primary)',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.875rem',
  fontWeight: 500,
  cursor: 'pointer',
  textAlign: 'left',
};

const iconGap: React.CSSProperties = { marginRight: '0.6rem' };

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.6)',
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1300,
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
  maxWidth: '1100px',
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

  /* Row actions overlay state: MUI Menu (>600px) o bottom-sheet (≤600px) */
  const [actionsAnchor, setActionsAnchor] = useState<HTMLElement | null>(null);
  const [actionsProducto, setActionsProducto] = useState<Producto | null>(null);
  const isMobile = useMediaQuery('(max-width:600px)');

  /* Export Excel state */
  const [exportando, setExportando] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  /* Filter state */
  const [filterTipo, setFilterTipo] = useState<'TODOS' | 'RETAIL' | 'INTERNAL'>('TODOS');

  /* Stock modal state */
  const [stockModal, setStockModal] = useState<{ producto: Producto; type: 'descontar' | 'reabastecer' | 'restock' } | null>(null);
  const [stockCantidad, setStockCantidad] = useState(0);
  const [restockPrecioCompra, setRestockPrecioCompra] = useState(0);
  const [restockPrecioVenta, setRestockPrecioVenta] = useState(0);

  /* History modal */
  const [historyModal, setHistoryModal] = useState<Producto | null>(null);
  const [historialData, setHistorialData] = useState<ProductoPrecioHistorico[]>([]);
  const [historialLoading, setHistorialLoading] = useState(false);

  const [form, setForm] = useState({
    nombre: '',
    codigoBarras: '',
    descripcion: '',
    marca: '',
    precioCompra: 0,
    margenGanancia: 30,
    precioVenta: 0,
    tipoPrecio: 'MARGEN' as 'FIJO' | 'MARGEN',
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

  // Auto-set precioVenta in MARGEN mode
  useEffect(() => {
    if (form.tipoPrecio === 'MARGEN' && suggestedPrecioVenta > 0) {
      setForm((prev) => ({ ...prev, precioVenta: suggestedPrecioVenta }));
    }
  }, [suggestedPrecioVenta, form.tipoPrecio]);

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
      codigoBarras: '',
      descripcion: '',
      marca: '',
      precioCompra: 0,
      margenGanancia: 30,
      precioVenta: 0,
      tipoPrecio: 'MARGEN',
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
      codigoBarras: prod.codigoBarras ?? '',
      descripcion: prod.descripcion ?? '',
      marca: prod.marca ?? '',
      precioCompra: prod.precioCompra ?? 0,
      margenGanancia: prod.margenGanancia,
      precioVenta: prod.precioVenta,
      tipoPrecio: prod.tipoPrecio ?? 'MARGEN',
      cantidadStock: prod.cantidadStock,
      stockMinimo: prod.stockMinimo,
      tipoInventario: prod.tipoInventario ?? 'RETAIL',
    });
    setShowModal(true);
  };

  /* ── Row actions (trigger ⋮) ── */
  const openActions = (e: React.MouseEvent<HTMLElement>, prod: Producto) => {
    setActionsAnchor(e.currentTarget);
    setActionsProducto(prod);
  };

  const closeActions = () => {
    setActionsAnchor(null);
    setActionsProducto(null);
  };

  /** Cierra el overlay antes de ejecutar la acción elegida. */
  const runAction = (cb: (prod: Producto) => void) => {
    const prod = actionsProducto;
    closeActions();
    if (prod) cb(prod);
  };

  const openRestock = (prod: Producto) => {
    setStockModal({ producto: prod, type: 'restock' });
    setStockCantidad(0);
    setRestockPrecioCompra(prod.precioCompra ?? 0);
    setRestockPrecioVenta(0);
  };

  const openDescontar = (prod: Producto) => {
    setStockModal({ producto: prod, type: 'descontar' });
    setStockCantidad(0);
  };

  const openDelete = (prod: Producto) => setDeleting(prod);

  /* ── Create / Update ── */
  const handleSave = async () => {
    if (!salonId || !form.nombre.trim() || form.precioVenta <= 0) return;
    setActionError(null);
    setActionLoading(true);
    try {
      const payload: Record<string, unknown> = {
        nombre: form.nombre.trim(),
        // '' viaja como string vacío → el backend normaliza '' → null.
        // Así editar sin código limpia un código previo (no lo deja stale).
        codigoBarras: form.codigoBarras.trim(),
        descripcion: form.descripcion.trim() || undefined,
        marca: form.marca.trim() || undefined,
        precioCompra: form.precioCompra,
        margenGanancia: form.margenGanancia,
        tipoPrecio: form.tipoPrecio,
        cantidadStock: form.cantidadStock,
        stockMinimo: form.stockMinimo,
        tipoInventario: form.tipoInventario,
      };

      // FIJO always sends the configured price. MARGEN sends an explicit price
      // only when the user overrode the suggested one; otherwise the backend
      // derives it so it stays in sync with cost/margin.
      if (form.tipoPrecio === 'FIJO' || form.precioVenta !== suggestedPrecioVenta) {
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
        const payload: { cantidad: number; precioCompra: number; precioVenta?: number } = {
          cantidad: stockCantidad,
          precioCompra: restockPrecioCompra,
        };
        // Only FIJO accepts a new fixed price; MARGEN always recomputes.
        if (stockModal.producto.tipoPrecio === 'FIJO' && restockPrecioVenta > 0) {
          payload.precioVenta = restockPrecioVenta;
        }
        await restockProducto(salonId, stockModal.producto.id, payload);
      } else {
        await api.post(`/salones/${salonId}/productos/${stockModal.producto.id}/descontar`, {
          cantidad: stockCantidad,
        });
      }
      setStockModal(null);
      setStockCantidad(0);
      setRestockPrecioCompra(0);
      setRestockPrecioVenta(0);
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
    // FIJO keeps its configured price (or an explicit incoming one); MARGEN
    // recomputes from the new PMP.
    const esFijo = prod.tipoPrecio === 'FIJO';
    const nuevoPV = esFijo
      ? (restockPrecioVenta > 0 ? restockPrecioVenta : prod.precioVenta)
      : Math.round(nuevoPMP * (1 + prod.margenGanancia / 100) * 100) / 100;

    return { nuevoPMP, nuevoPV, nuevoStock: stockActual + stockCantidad, esFijo };
  }, [stockModal, stockCantidad, restockPrecioCompra, restockPrecioVenta]);

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

  /* ── Export Excel ──
     Descarga el xlsx de inventario. Los errores de axios con responseType blob
     llegan como Blob (no JSON): se lee el texto y se intenta extraer el mensaje. */
  const downloadExcel = useCallback(async () => {
    if (salonId == null || exportando) return;
    setExportando(true);
    setExportError(null);
    try {
      const response = await api.get(`/salones/${salonId}/productos/exportar`, {
        responseType: 'blob',
      });
      const blob = response.data as Blob;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `productos_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      const axiosErr = err as {
        response?: { data?: unknown };
        message?: string;
      };
      let mensaje = 'No se pudo exportar el inventario';
      const blobErr = axiosErr.response?.data;
      if (blobErr instanceof Blob) {
        try {
          const texto = await blobErr.text();
          const parsed = JSON.parse(texto) as { error?: { message?: string }; message?: string };
          mensaje = parsed.error?.message ?? parsed.message ?? mensaje;
        } catch {
          // Blob sin JSON: queda el mensaje por defecto
        }
      } else if (axiosErr.message) {
        mensaje = axiosErr.message;
      }
      setExportError(mensaje);
    } finally {
      setExportando(false);
    }
  }, [salonId, exportando]);

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
                placeholder="Buscar por nombre, marca o código…"
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
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {canViewCost && (
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <button
                      onClick={downloadExcel}
                      disabled={exportando}
                      style={{
                        ...ghostBtnStyle,
                        opacity: exportando ? 0.6 : 1,
                        cursor: exportando ? 'wait' : 'pointer',
                      }}
                      title="Descargar inventario de productos en Excel"
                    >
                      {exportando ? 'Exportando…' : '📥 Exportar Excel'}
                    </button>
                  </motion.div>
                )}
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
            {exportError && (
              <p
                role="alert"
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '0.75rem',
                  color: 'var(--danger)',
                  margin: '0.5rem 0 0',
                }}
              >
                {exportError}
              </p>
            )}
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
              <TableSkeleton
                columns={['Nombre', 'Stock', 'P. Compra', 'P. Venta', 'Precio', 'Marca', 'Código', 'Acción']}
                rows={5}
              />
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
                <div className={styles.gridHeader}>
                  <span>Nombre</span>
                  <span>Stock</span>
                  <span>P. Compra</span>
                  <span>P. Venta</span>
                  <span>Precio</span>
                  <span>Marca</span>
                  <span>Código</span>
                  <span style={{ textAlign: 'right' }}>Acción</span>
                </div>

                {/* Rows */}
                {productos.map((prod, idx) => {
                  const isLowStock = prod.cantidadStock <= prod.stockMinimo;
                  const isLast = idx === productos.length - 1;
                  const margen = prod.margenGanancia;
                  const isMargin = prod.tipoPrecio === 'MARGEN';

                  return (
                    <motion.div
                      key={prod.id}
                      variants={itemVariants}
                      className={styles.gridRow}
                      style={{
                        borderBottom: isLast ? 'none' : '1px solid var(--border)',
                        background: isLowStock ? 'rgba(224,85,106,0.04)' : 'transparent',
                      }}
                      whileHover={{ background: isLowStock ? 'rgba(224,85,106,0.08)' : 'var(--bg-hover)' }}
                      transition={{ duration: 0.15 }}
                    >
                      <span style={{ fontWeight: 500, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }} data-label="Nombre">{prod.nombre}</span>
                      <span data-label="Stock">
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
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }} data-label="P. Compra">
                        {canViewCost && prod.precioCompra ? formatCurrency(prod.precioCompra) : '—'}
                      </span>
                      <span style={{ color: 'var(--accent)', fontWeight: 500 }} data-label="P. Venta">
                        {formatCurrency(prod.precioVenta)}
                      </span>
                      <span style={{
                        fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap',
                        color: isMargin ? getMargenColor(margen) : 'var(--text-dim)',
                      }} data-label="Precio">
                        {isMargin ? `📐 ${margen}%` : '🎯 Fijo'}
                      </span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }} data-label="Marca">
                        {prod.marca || '—'}
                      </span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap' }} data-label="Código">
                        {prod.codigoBarras || '—'}
                      </span>
                      <span style={{ display: 'flex', justifyContent: 'flex-end' }} data-label="Acciones">
                        <button
                          type="button"
                          onClick={(e) => openActions(e, prod)}
                          style={menuTriggerBtn}
                          title="Acciones"
                          aria-label="Acciones"
                        >
                          ⋮
                        </button>
                      </span>
                    </motion.div>
                  );
                })}
              </div>

              {/* ── Pagination ── */}
              <PaginationBar
                page={currentPage}
                totalPages={pageCount}
                total={totalCount}
                label="productos"
                onPrev={() => goToPage(currentPage - 1)}
                onNext={() => goToPage(currentPage + 1)}
              />
            </>
          )}

      {/* ── Acciones de fila: Menu (desktop) / bottom-sheet (móvil) ── */}
      {!isMobile && (
        <Menu
          anchorEl={actionsAnchor}
          open={Boolean(actionsAnchor)}
          onClose={closeActions}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <MenuItem onClick={() => runAction(openRestock)}>
            <Inventory2 fontSize="small" style={iconGap} /> Re-stock
          </MenuItem>
          <MenuItem onClick={() => runAction(openDescontar)}>
            <RemoveCircle fontSize="small" style={iconGap} /> Descontar
          </MenuItem>
          <MenuItem onClick={() => runAction(openEdit)}>
            <Edit fontSize="small" style={iconGap} /> Editar
          </MenuItem>
          <MenuItem onClick={() => runAction(openHistory)}>
            <History fontSize="small" style={iconGap} /> Historial
          </MenuItem>
          <MenuItem onClick={() => runAction(openDelete)} style={{ color: 'var(--danger)' }}>
            <DeleteOutlined fontSize="small" style={iconGap} /> Eliminar
          </MenuItem>
        </Menu>
      )}

      {isMobile && actionsProducto && (
        <div
          className="mobileBottomSheet actionsSheet"
          style={modalOverlayStyle}
          onClick={closeActions}
        >
          <div
            className="mobileBottomSheetContent"
            style={{ ...modalContentStyle, maxWidth: '440px', padding: '0.75rem 0.5rem 0.5rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <p
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: '1rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                padding: '0 0.75rem 0.75rem',
                margin: 0,
                borderBottom: '1px solid var(--border)',
              }}
            >
              {actionsProducto.nombre}
            </p>
            <button type="button" style={sheetActionBtn} onClick={() => runAction(openRestock)}>
              <Inventory2 fontSize="small" /> Re-stock
            </button>
            <button type="button" style={sheetActionBtn} onClick={() => runAction(openDescontar)}>
              <RemoveCircle fontSize="small" /> Descontar
            </button>
            <button type="button" style={sheetActionBtn} onClick={() => runAction(openEdit)}>
              <Edit fontSize="small" /> Editar
            </button>
            <button type="button" style={sheetActionBtn} onClick={() => runAction(openHistory)}>
              <History fontSize="small" /> Historial
            </button>
            <button
              type="button"
              style={{ ...sheetActionBtn, color: 'var(--danger)', borderBottom: 'none' }}
              onClick={() => runAction(openDelete)}
            >
              <DeleteOutlined fontSize="small" /> Eliminar
            </button>
          </div>
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            style={modalOverlayStyle}
            className="mobileBottomSheet"
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
              className="mobileBottomSheetContent"
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
                  <label style={formLabelStyle}>Código de barras</label>
                  <input
                    type="text"
                    value={form.codigoBarras}
                    onChange={(e) => setForm((prev) => ({ ...prev, codigoBarras: e.target.value }))}
                    style={formFieldStyle}
                    placeholder="Escaneá o escribí el código"
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
                </div>
                {/* ── Pricing mode toggle ── */}
                <div style={{ marginBottom: '0.875rem' }}>
                  <label style={formLabelStyle}>Tipo de precio</label>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.3rem' }}>
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, tipoPrecio: 'MARGEN' }))}
                      style={{
                        flex: 1, height: '36px', borderRadius: 'var(--radius-sm)',
                        border: form.tipoPrecio === 'MARGEN' ? '2px solid var(--accent)' : '1px solid var(--border)',
                        background: form.tipoPrecio === 'MARGEN' ? 'var(--accent-subtle)' : 'var(--bg-base)',
                        color: form.tipoPrecio === 'MARGEN' ? 'var(--accent)' : 'var(--text-secondary)',
                        fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem', fontWeight: 600,
                        cursor: 'pointer', transition: 'all 0.2s',
                      }}
                    >
                      📐 Margen por %
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, tipoPrecio: 'FIJO' }))}
                      style={{
                        flex: 1, height: '36px', borderRadius: 'var(--radius-sm)',
                        border: form.tipoPrecio === 'FIJO' ? '2px solid var(--accent)' : '1px solid var(--border)',
                        background: form.tipoPrecio === 'FIJO' ? 'var(--accent-subtle)' : 'var(--bg-base)',
                        color: form.tipoPrecio === 'FIJO' ? 'var(--accent)' : 'var(--text-secondary)',
                        fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem', fontWeight: 600,
                        cursor: 'pointer', transition: 'all 0.2s',
                      }}
                    >
                      🎯 Precio fijo
                    </button>
                  </div>
                </div>

                {form.tipoPrecio === 'MARGEN' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.875rem' }}>
                    <div>
                      <label style={formLabelStyle}>Precio de compra</label>
                      <MoneyInput
                        value={form.precioCompra}
                        onChange={(n) => setForm((prev) => ({ ...prev, precioCompra: n }))}
                        style={formFieldStyle}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label style={formLabelStyle}>Margen de ganancia (%)</label>
                      <input
                        type="number" min={0} max={1000}
                        value={form.margenGanancia}
                        onChange={(e) => setForm((prev) => ({ ...prev, margenGanancia: Number(e.target.value) }))}
                        className="noSpinner"
                        style={formFieldStyle}
                        placeholder="30"
                      />
                    </div>
                    <div>
                      <label style={{ ...formLabelStyle, color: 'var(--success)' }}>Precio de venta sugerido</label>
                      <div style={{
                        ...formFieldStyle,
                        display: 'flex', alignItems: 'center',
                        background: 'var(--bg-elevated)',
                        color: form.precioVenta > 0 ? 'var(--success)' : 'var(--text-dim)',
                        fontWeight: 600, fontSize: '0.875rem',
                        cursor: 'default',
                      }}>
                        {form.precioVenta > 0 ? formatCurrency(form.precioVenta) : '—'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.875rem' }}>
                    <div>
                      <label style={formLabelStyle}>Precio de compra</label>
                      <MoneyInput
                        value={form.precioCompra}
                        onChange={(n) => setForm((prev) => ({ ...prev, precioCompra: n }))}
                        style={formFieldStyle}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label style={{ ...formLabelStyle, color: 'var(--accent)' }}>Precio de venta *</label>
                      <MoneyInput
                        value={form.precioVenta}
                        onChange={(n) => setForm((prev) => ({ ...prev, precioVenta: n }))}
                        style={formFieldStyle}
                        placeholder="0"
                      />
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.875rem' }}>
                  <div>
                    <label style={formLabelStyle}>Stock inicial</label>
                    <input
                      type="number"
                      className="noSpinner"
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
                      className="noSpinner"
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
            className="mobileBottomSheet"
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
              className="mobileBottomSheetContent"
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
                    className="noSpinner"
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
                      <MoneyInput
                        value={restockPrecioCompra}
                        onChange={(n) => setRestockPrecioCompra(n)}
                        style={formFieldStyle}
                        placeholder="0"
                      />
                    </div>

                    {stockModal.producto.tipoPrecio === 'FIJO' && (
                      <div style={{ marginBottom: '1rem' }}>
                        <label style={formLabelStyle}>Nuevo precio de venta (opcional)</label>
                        <MoneyInput
                          value={restockPrecioVenta}
                          onChange={(n) => setRestockPrecioVenta(n)}
                          style={formFieldStyle}
                          placeholder="0"
                        />
                        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.7rem', color: 'var(--text-dim)', margin: '0.3rem 0 0' }}>
                          Dejalo en 0 para conservar el precio fijo actual.
                        </p>
                      </div>
                    )}

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
                          <span style={{ color: 'var(--text-secondary)' }}>
                            {restockPreview.esFijo
                              ? 'Precio de venta (fijo):'
                              : `Nuevo P. Venta (${stockModal.producto.margenGanancia}% margen):`}
                          </span>
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
                      setRestockPrecioVenta(0);
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
            className="mobileBottomSheet"
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
              className="mobileBottomSheetContent"
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
            className="mobileBottomSheet"
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
              className="mobileBottomSheetContent"
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
