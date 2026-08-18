import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Skeleton, Button } from '@pos-final/ui';
import { Rol, type IUser } from '@pos-final/types';
import api from '../services/api.js';
import SalonSwitcher from '../components/SalonSwitcher.js';
import PaginationBar from '../components/PaginationBar.js';
import TableSkeleton from '../components/TableSkeleton.js';
import MoneyInput from '../components/MoneyInput.js';
import { formatCurrency } from '../utils/format.js';
import styles from './ServiciosPage.module.css';
import {
  fetchServicios,
  type Servicio,
  type PaginatedResult,
} from '../services/servicioService.js';

/* ── Types ── */

interface Categoria {
  id: number;
  nombre: string;
  descripcion?: string;
}

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

/* ── Component ── */

const ServiciosPage: React.FC = () => {
  const navigate = useNavigate();

  /* Auth state */
  const [user, setUser] = useState<IUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  /* Data state */
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
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
  const [editing, setEditing] = useState<Servicio | null>(null);
  const [deleting, setDeleting] = useState<Servicio | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [form, setForm] = useState({
    nombre: '',
    descripcion: '',
    precioBase: 0,
    duracionMinutos: 30,
    costoBaseInsumos: 0,
    categoriaId: 0,
    activo: true,
  });

  /* ── Derived ── */

  const salonId = useMemo(() => {
    if (!user) return null;
    const stored = localStorage.getItem('xSalonId');
    return stored ? Number(stored) : user.salonId;
  }, [user]);

  const hasData = useMemo(() => servicios.length > 0, [servicios]);

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
      const [svcResult, catRes] = await Promise.all([
        fetchServicios(salonId, {
          page: currentPage,
          limit: ITEMS_PER_PAGE,
          q: debouncedSearch || undefined,
        }) as Promise<PaginatedResult<Servicio>>,
        api.get(`/salones/${salonId}/categorias`),
      ]);
      const catData = Array.isArray(catRes.data) ? catRes.data : catRes.data?.data ?? [];
      setServicios(svcResult.data);
      setTotalCount(svcResult.meta.total);
      setPageCount(svcResult.meta.totalPages);
      setCategorias(catData);
    } catch {
      setDataError('Error al cargar servicios');
      setServicios([]);
      setTotalCount(0);
      setPageCount(0);
      setCategorias([]);
    } finally {
      setDataLoading(false);
    }
  }, [salonId, currentPage, debouncedSearch]);

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
      precioBase: 0,
      duracionMinutos: 30,
      costoBaseInsumos: 0,
      categoriaId: 0,
      activo: true,
    });
    setEditing(null);
  };

  /* ── Open edit modal ── */
  const openEdit = (svc: Servicio) => {
    setEditing(svc);
    setForm({
      nombre: svc.nombre,
      descripcion: svc.descripcion ?? '',
      precioBase: svc.precioBase,
      duracionMinutos: svc.duracionMinutos,
      costoBaseInsumos: svc.costoBaseInsumos ?? 0,
      categoriaId: svc.categoriaId ?? 0,
      activo: svc.activo,
    });
    setShowModal(true);
  };

  /* ── Create / Update ── */
  const handleSave = async () => {
    if (!salonId || !form.nombre.trim()) return;
    setActionError(null);
    setActionLoading(true);
    try {
      const payload = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || undefined,
        precioBase: form.precioBase,
        duracionMinutos: form.duracionMinutos,
        costoBaseInsumos: form.costoBaseInsumos > 0 ? form.costoBaseInsumos : undefined,
        categoriaId: form.categoriaId > 0 ? form.categoriaId : undefined,
        activo: form.activo,
      };

      if (editing) {
        await api.put(`/salones/${salonId}/servicios/${editing.id}`, payload);
      } else {
        await api.post(`/salones/${salonId}/servicios`, payload);
      }
      setShowModal(false);
      resetForm();
      fetchData();
    } catch {
      setActionError(editing ? 'Error al guardar el servicio. Verificá los datos e intentá de nuevo.' : 'Error al crear el servicio. Verificá los datos e intentá de nuevo.');
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
      await api.delete(`/salones/${salonId}/servicios/${deleting.id}`);
      setDeleting(null);
      fetchData();
    } catch {
      setActionError('Error al eliminar el servicio. Intentá de nuevo.');
    } finally {
      setActionLoading(false);
    }
  };

  /* ── Animation variants ── */
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.06, delayChildren: 0.08 },
    },
  };

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

  /* ================================================================ */
  /*  RENDER: Content                                                   */
  /* ================================================================ */

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
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            style={{ marginBottom: '1rem' }}
          >
            <motion.div
              variants={itemVariants}
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
                placeholder="Buscar servicio…"
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
                  + Nuevo Servicio
                </button>
              </motion.div>
            </motion.div>
          </motion.div>

          {/* ── Content area ── */}
          {dataLoading ? (
            <TableSkeleton
              columns={['Nombre', 'Duración', 'Precio', 'Costo base insumos', 'Categoría', 'Estado', 'Creado', 'Modificado', 'Acción']}
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
              <span style={{ fontSize: '3rem', marginBottom: '1rem' }}>💅</span>
              <h2
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '0.5rem',
                }}
              >
                {debouncedSearch ? 'Sin resultados' : 'No hay servicios'}
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
                  ? 'No encontramos servicios con ese nombre.'
                  : 'Agregá tu primer servicio para empezar a usarlo en las citas.'}
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
                  + Nuevo Servicio
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
                  opacity: 1,
                  visibility: 'visible' as const,
                }}
              >
              {/* Table header */}
              <div className={styles.gridHeader}>
                <span>Nombre</span>
                <span>Duración</span>
                <span>Precio</span>
                <span>Costo base insumos</span>
                <span>Categoría</span>
                <span>Estado</span>
                <span>Creado</span>
                <span>Modificado</span>
                <span style={{ textAlign: 'right' }}>Acción</span>
              </div>

              {/* Rows — active first, then inactive */}
              {servicios.map((svc) => (
                <motion.div
                  key={svc.id}
                  className={styles.gridRow}
                  whileHover={{ background: 'var(--bg-hover)' }}
                  transition={{ duration: 0.15 }}
                >
                  <span style={{ fontWeight: 500, color: svc.activo ? 'var(--text-primary)' : 'var(--text-dim)' }} data-label="Nombre">
                    {svc.nombre}
                  </span>
                  <span style={{ color: 'var(--text-secondary)' }} data-label="Duración">
                    {svc.duracionMinutos} min
                  </span>
                  <span style={{ color: 'var(--accent)', fontWeight: 500 }} data-label="Precio">
                    {formatCurrency(svc.precioBase)}
                  </span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }} data-label="Costo base insumos">
                    {(svc.costoBaseInsumos ?? 0) > 0 ? formatCurrency(svc.costoBaseInsumos ?? 0) : '—'}
                  </span>
                  <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }} data-label="Categoría">
                    {svc.categoria?.nombre ?? '—'}
                  </span>
                  <span data-label="Estado">
                    <span style={{
                      fontSize: '0.65rem',
                      padding: '0.15rem 0.45rem',
                      borderRadius: 'var(--radius-sm)',
                      fontWeight: 600,
                      fontFamily: "'DM Sans', sans-serif",
                      whiteSpace: 'nowrap',
                      background: svc.activo ? 'rgba(80,200,120,0.15)' : 'rgba(140,136,148,0.15)',
                      color: svc.activo ? '#50c878' : 'var(--text-dim)',
                      border: svc.activo ? '1px solid rgba(80,200,120,0.3)' : '1px solid rgba(140,136,148,0.3)',
                    }}>
                      {svc.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', whiteSpace: 'nowrap' }} data-label="Creado">
                    {svc.creadoEn ? new Date(svc.creadoEn).toLocaleDateString('es-CL') : '—'}
                  </span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', whiteSpace: 'nowrap' }} data-label="Modificado">
                    {svc.actualizadoEn ? new Date(svc.actualizadoEn).toLocaleDateString('es-CL') : '—'}
                  </span>
                  <span style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }} data-label="Acciones">
                    <button
                      onClick={() => openEdit(svc)}
                      style={{
                        background: 'none',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text-secondary)',
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.7rem',
                        cursor: 'pointer',
                        transition: 'color 0.2s, border-color 0.2s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => setDeleting(svc)}
                      style={{
                        background: 'none',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--danger)',
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.7rem',
                        cursor: 'pointer',
                        transition: 'border-color 0.2s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--danger)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                    >
                      Eliminar
                    </button>
                  </span>
                </motion.div>
              ))}
              </div>

              {/* ── Pagination ── */}
              <PaginationBar
                page={currentPage}
                totalPages={pageCount}
                total={totalCount}
                label="servicios"
                onPrev={() => setCurrentPage((p) => Math.max(1, p - 1))}
                onNext={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}
              />
            </>
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
                  {editing ? 'Editar Servicio' : 'Nuevo Servicio'}
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
                    placeholder="Ej: Corte de cabello"
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
                    <label style={formLabelStyle}>Precio base *</label>
                    <MoneyInput
                      value={form.precioBase}
                      onChange={(n) => setForm((prev) => ({ ...prev, precioBase: n }))}
                      style={formFieldStyle}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label style={formLabelStyle}>Duración (min) *</label>
                    <input
                      type="number"
                      min={5}
                      step={5}
                      value={form.duracionMinutos}
                      onChange={(e) => setForm((prev) => ({ ...prev, duracionMinutos: Number(e.target.value) }))}
                      style={formFieldStyle}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '0.875rem' }}>
                  <label style={formLabelStyle}>Costo base insumos</label>
                  <MoneyInput
                    value={form.costoBaseInsumos}
                    onChange={(n) => setForm((prev) => ({ ...prev, costoBaseInsumos: n }))}
                    style={formFieldStyle}
                    placeholder="0"
                  />
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

                <div style={{ marginBottom: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label style={{ ...formLabelStyle, marginBottom: 0, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.activo}
                      onChange={(e) => setForm((prev) => ({ ...prev, activo: e.target.checked }))}
                      style={{ accentColor: 'var(--accent)', marginRight: '0.4rem' }}
                    />
                    Servicio activo
                  </label>
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
                  disabled={!form.nombre.trim() || form.precioBase <= 0 || form.duracionMinutos <= 0}
                  loading={actionLoading}
                  onClick={handleSave}
                >
                  {editing ? 'Guardar cambios' : 'Crear servicio'}
                </Button>
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
                  ¿Eliminar servicio?
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

export default ServiciosPage;
