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
  creadoEn?: string;
  actualizadoEn?: string;
}

/* ── Constants ── */



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
  const [newNombre, setNewNombre] = useState('');
  const [newDescripcion, setNewDescripcion] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editDescripcion, setEditDescripcion] = useState('');
  const [deleting, setDeleting] = useState<Categoria | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  /* ── Derived ── */

  const salonId = useMemo(() => {
    if (!user) return null;
    const stored = localStorage.getItem('xSalonId');
    return stored ? Number(stored) : user.salonId;
  }, [user]);

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

      console.log('[DEBUG CategoriasPage] cats:', cats.length, cats);
      console.log('[DEBUG CategoriasPage] svcs:', svcs.length);
      console.log('[DEBUG CategoriasPage] prods:', prods.length);

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
    console.log('[DEBUG CategoriasPage EFFECT] authLoading:', authLoading, 'salonId:', salonId, 'user:', user);
    if (!authLoading && salonId != null) {
      console.log('[DEBUG CategoriasPage] Calling fetchData');
      fetchData();
    }
  }, [authLoading, salonId, fetchData]);

  /* ── Create ── */
  const handleCreate = async () => {
    if (!salonId || !newNombre.trim()) return;
    setActionError(null);
    setActionLoading(true);
    try {
      await api.post(`/salones/${salonId}/categorias`, {
        nombre: newNombre.trim(),
        descripcion: newDescripcion.trim() || undefined,
      });
      setNewNombre('');
      setNewDescripcion('');
      fetchData();
    } catch {
      setActionError('Error al crear la categoría. Verificá los datos e intentá de nuevo.');
    } finally {
      setActionLoading(false);
    }
  };

  /* ── Start edit ── */
  const startEdit = (cat: Categoria) => {
    setEditingId(cat.id);
    setEditNombre(cat.nombre);
    setEditDescripcion(cat.descripcion ?? '');
  };

  /* ── Save edit ── */
  const handleSaveEdit = async (id: number) => {
    if (!salonId || !editNombre.trim()) return;
    setActionError(null);
    setActionLoading(true);
    try {
      await api.put(`/salones/${salonId}/categorias/${id}`, {
        nombre: editNombre.trim(),
        descripcion: editDescripcion.trim() || undefined,
      });
      setEditingId(null);
      fetchData();
    } catch {
      setActionError('Error al guardar la categoría. Verificá los datos e intentá de nuevo.');
    } finally {
      setActionLoading(false);
    }
  };

  /* ── Cancel edit ── */
  const cancelEdit = () => {
    setEditingId(null);
    setEditNombre('');
    setEditDescripcion('');
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
      <AnimatePresence mode="wait">
        <motion.div
          key="categorias-content"
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

          {/* ── Inline create ── */}
          <div
            style={{ marginBottom: '1.5rem', opacity: 1, visibility: 'visible' as const }}
          >
            <div
              style={{
                padding: '1rem 1.25rem',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-surface)',
                opacity: 1,
                visibility: 'visible' as const,
              }}
            >
              <h3
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  color: 'var(--accent)',
                  marginBottom: '0.75rem',
                  margin: 0,
                }}
              >
                Nueva categoría
              </h3>
              <div
                style={{
                  display: 'flex',
                  gap: '0.5rem',
                  alignItems: 'flex-end',
                  flexWrap: 'wrap',
                  marginTop: '0.75rem',
                }}
              >
                <div style={{ flex: 1, minWidth: '180px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '0.7rem',
                      color: 'var(--text-dim)',
                      marginBottom: '0.25rem',
                    }}
                  >
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={newNombre}
                    onChange={(e) => setNewNombre(e.target.value)}
                    style={formFieldStyle}
                    placeholder="Ej: Cortes"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreate();
                    }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: '180px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '0.7rem',
                      color: 'var(--text-dim)',
                      marginBottom: '0.25rem',
                    }}
                  >
                    Descripción
                  </label>
                  <input
                    type="text"
                    value={newDescripcion}
                    onChange={(e) => setNewDescripcion(e.target.value)}
                    style={formFieldStyle}
                    placeholder="Opcional"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreate();
                    }}
                  />
                </div>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <button
                    style={{
                      ...primaryBtnStyle,
                      padding: '0.5rem 1rem',
                      height: '34px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    onClick={handleCreate}
                    disabled={!newNombre.trim() || actionLoading}
                  >
                    {actionLoading ? '…' : 'Crear'}
                  </button>
                </motion.div>
              </div>
              {actionError && (
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem', color: 'var(--danger)', marginTop: '0.75rem', marginBottom: 0 }}>
                  {actionError}
                </p>
              )}
            </div>
          </div>

          {/* ── List ── */}
          {(() => { console.log('[DEBUG CategoriasPage RENDER] dataLoading:', dataLoading, 'dataError:', dataError, 'categorias.length:', categorias.length); return null; })()}
          {dataLoading ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} height="64px" variant="rect" style={{ marginBottom: '0.5rem' }} />
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
              {categorias.map((cat) => {
                const isEditing = editingId === cat.id;
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
                    {isEditing ? (
                      /* ── Inline edit: nombre ── */
                      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                        <input
                          type="text"
                          value={editNombre}
                          onChange={(e) => setEditNombre(e.target.value)}
                          style={{ ...formFieldStyle, height: '30px', fontSize: '0.75rem' }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(cat.id);
                            if (e.key === 'Escape') cancelEdit();
                          }}
                          autoFocus
                        />
                        <button
                          style={{
                            background: 'var(--accent)',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--bg-root)',
                            padding: '0.3rem 0.6rem',
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                          onClick={() => handleSaveEdit(cat.id)}
                          disabled={!editNombre.trim() || actionLoading}
                        >
                          Guardar
                        </button>
                        <button
                          style={{
                            ...ghostBtnStyle,
                            padding: '0.3rem 0.6rem',
                            fontSize: '0.7rem',
                          }}
                          onClick={cancelEdit}
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontWeight: 500 }}>{cat.nombre}</span>
                    )}

                    {isEditing ? (
                      <input
                        type="text"
                        value={editDescripcion}
                        onChange={(e) => setEditDescripcion(e.target.value)}
                        style={{ ...formFieldStyle, height: '30px', fontSize: '0.75rem' }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit(cat.id);
                          if (e.key === 'Escape') cancelEdit();
                        }}
                      />
                    ) : (
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cat.descripcion || '—'}
                      </span>
                    )}

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
                        onClick={() => !isEditing && startEdit(cat)}
                        style={{
                          background: 'none',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--text-secondary)',
                          padding: '0.3rem 0.6rem',
                          fontSize: '0.7rem',
                          cursor: isEditing ? 'default' : 'pointer',
                          opacity: isEditing ? 0.4 : 1,
                          transition: 'color 0.2s, border-color 0.2s',
                        }}
                        onMouseEnter={(e) => { if (!isEditing) { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent)'; } }}
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
                          padding: '0.3rem 0.6rem',
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
        </motion.div>
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
