import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Skeleton, Button } from '@pos-final/ui';
import { Rol, type IUser } from '@pos-final/types';
import api from '../services/api.js';
import SalonSwitcher from '../components/SalonSwitcher.js';
import PaginationBar from '../components/PaginationBar.js';
import TableSkeleton from '../components/TableSkeleton.js';

/* ── Types ── */

interface Categoria {
  id: number;
  nombre: string;
  descripcion?: string;
  creadoEn?: string;
  actualizadoEn?: string;
}

/* ── Constants ── */

const PAGE_SIZE = 12;

/* ── Style constants ── */

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

const formFieldStyle: React.CSSProperties = {
  height: '34px',
  padding: '0 0.7rem',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)',
  background: 'var(--bg-base)',
  color: 'var(--text-primary)',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.8125rem',
  outline: 'none',
  transition: 'border-color 0.2s, box-shadow 0.2s',
  width: '100%',
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

const tableHeaderStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(150px, 1.2fr) 1fr 60px 60px 100px 100px 120px',
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
  gridTemplateColumns: 'minmax(150px, 1.2fr) 1fr 60px 60px 100px 100px 120px',
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
  maxWidth: '380px',
};

/* ── Component ── */

const CategoriasPage: React.FC = () => {
  const navigate = useNavigate();

  /* Auth state */
  const [user, setUser] = useState<IUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  /* Data state */
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [servicioCounts, setServicioCounts] = useState<Record<number, number>>({});
  const [productoCounts, setProductoCounts] = useState<Record<number, number>>({});
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  /* UI state */
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ nombre: '', descripcion: '' });
  const [editing, setEditing] = useState<Categoria | null>(null);
  const [deleting, setDeleting] = useState<Categoria | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  /* ── Derived ── */

  const salonId = useMemo(() => {
    if (!user) return null;
    const stored = localStorage.getItem('xSalonId');
    return stored ? Number(stored) : user.salonId;
  }, [user]);

  /* ── Client-side pagination ── */
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(categorias.length / PAGE_SIZE)),
    [categorias],
  );
  const paginatedCategorias = useMemo(
    () => categorias.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [categorias, page],
  );

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
      const [catRes, svcRes, prodRes] = await Promise.all([
        api.get(`/salones/${salonId}/categorias`),
        api.get(`/salones/${salonId}/servicios`).catch(() => ({ data: [] })),
        api.get(`/salones/${salonId}/productos`).catch(() => ({ data: [] })),
      ]);

      const cats = Array.isArray(catRes.data) ? catRes.data : catRes.data?.data ?? [];
      const svcs = Array.isArray(svcRes.data) ? svcRes.data : svcRes.data?.data ?? [];
      const prods = Array.isArray(prodRes.data) ? prodRes.data : prodRes.data?.data ?? [];

      setCategorias(cats);

      // Compute counts per category
      const svcCounts: Record<number, number> = {};
      for (const s of svcs) {
        if (s.categoriaId != null) {
          svcCounts[s.categoriaId] = (svcCounts[s.categoriaId] ?? 0) + 1;
        }
      }
      setServicioCounts(svcCounts);

      const prodCounts: Record<number, number> = {};
      for (const p of prods) {
        if (p.categoriaId != null) {
          prodCounts[p.categoriaId] = (prodCounts[p.categoriaId] ?? 0) + 1;
        }
      }
      setProductoCounts(prodCounts);
    } catch {
      setDataError('Error al cargar categorías');
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
    setForm({ nombre: '', descripcion: '' });
    setEditing(null);
  };

  /* ── Open create modal ── */
  const openCreate = () => {
    resetForm();
    setActionError(null);
    setShowModal(true);
  };

  /* ── Open edit modal ── */
  const openEdit = (cat: Categoria) => {
    setEditing(cat);
    setForm({ nombre: cat.nombre, descripcion: cat.descripcion ?? '' });
    setActionError(null);
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
      };
      if (editing) {
        await api.put(`/salones/${salonId}/categorias/${editing.id}`, payload);
      } else {
        await api.post(`/salones/${salonId}/categorias`, payload);
      }
      setShowModal(false);
      resetForm();
      fetchData();
    } catch {
      setActionError(
        editing
          ? 'Error al guardar la categoría. Verificá los datos e intentá de nuevo.'
          : 'Error al crear la categoría. Verificá los datos e intentá de nuevo.',
      );
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
      await api.delete(`/salones/${salonId}/categorias/${deleting.id}`);
      setDeleting(null);
      fetchData();
    } catch {
      setActionError('Error al eliminar la categoría. Intentá de nuevo.');
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
        <Skeleton height="200px" variant="rect" />
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
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              marginBottom: '1rem',
            }}
          >
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <button onClick={openCreate} style={primaryBtnStyle}>
                + Nueva Categoría
              </button>
            </motion.div>
          </motion.div>

          {/* ── List ── */}
          {dataLoading ? (
            <TableSkeleton
              columns={['Nombre', 'Descripción', '💅', '🧴', 'Creado', 'Modificado', 'Acción']}
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
          ) : categorias.length === 0 ? (
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
              <span style={{ fontSize: '3rem', marginBottom: '1rem' }}>📂</span>
              <h2
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '0.5rem',
                }}
              >
                No hay categorías
              </h2>
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '0.8125rem',
                  color: 'var(--text-secondary)',
                  maxWidth: '320px',
                }}
              >
                Creá categorías para organizar mejor tus servicios y productos.
              </p>
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
                <span>Descripción</span>
                <span>💅</span>
                <span>🧴</span>
                <span>Creado</span>
                <span>Modificado</span>
                <span style={{ textAlign: 'right' }}>Acción</span>
              </div>

              {/* Rows */}
              {paginatedCategorias.map((cat) => {
                return (
                  <motion.div
                    key={cat.id}
                    variants={itemVariants}
                    style={{
                      ...tableRowStyle,
                      borderBottom: '1px solid var(--border)',
                    }}
                    whileHover={{ background: 'var(--bg-hover)' }}
                    transition={{ duration: 0.15 }}
                  >
                    <span style={{ fontWeight: 500 }}>{cat.nombre}</span>

                    <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {cat.descripcion || '—'}
                    </span>

                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                      {servicioCounts[cat.id] ?? 0}
                    </span>
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                      {productoCounts[cat.id] ?? 0}
                    </span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                      {cat.creadoEn ? new Date(cat.creadoEn).toLocaleDateString('es-CL') : '—'}
                    </span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                      {cat.actualizadoEn ? new Date(cat.actualizadoEn).toLocaleDateString('es-CL') : '—'}
                    </span>
                    <span style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => openEdit(cat)}
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
                        onClick={() => setDeleting(cat)}
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
                );
              })}
            </div>
          )}

      {/* Paginación (client-side) */}
      <PaginationBar
        page={page}
        totalPages={totalPages}
        total={categorias.length}
        label="categorías"
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
      />

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
              style={{ ...modalContentStyle, maxWidth: '480px' }}
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
                  {editing ? 'Editar Categoría' : 'Nueva Categoría'}
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
                    placeholder="Ej: Cortes"
                    autoFocus
                  />
                </div>
                <div style={{ marginBottom: '0.875rem' }}>
                  <label style={formLabelStyle}>Descripción</label>
                  <input
                    type="text"
                    value={form.descripcion}
                    onChange={(e) => setForm((prev) => ({ ...prev, descripcion: e.target.value }))}
                    style={formFieldStyle}
                    placeholder="Opcional"
                  />
                </div>
                {actionError && (
                  <p
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '0.75rem',
                      color: 'var(--danger)',
                      marginTop: '0.75rem',
                      marginBottom: 0,
                    }}
                  >
                    {actionError}
                  </p>
                )}
              </div>

              {/* Footer */}
              <div
                style={{
                  padding: '0.75rem 1.5rem 1.25rem',
                  borderTop: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                }}
              >
                <button
                  style={ghostBtnStyle}
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                >
                  Cancelar
                </button>
                <button
                  style={primaryBtnStyle}
                  onClick={handleSave}
                  disabled={!form.nombre.trim() || actionLoading}
                >
                  {actionLoading ? '…' : editing ? 'Guardar' : 'Crear'}
                </button>
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
              style={modalContentStyle}
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
                  ¿Eliminar categoría?
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

export default CategoriasPage;
