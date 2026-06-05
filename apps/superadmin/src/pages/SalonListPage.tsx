import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Layout, Badge, Button, Skeleton } from '@pos-final/ui';
import type { ISalon, Plan } from '@pos-final/types';
import type { SidebarItem } from '@pos-final/ui';
import api from '../services/api.js';

const sidebarItems: SidebarItem[] = [
  { label: 'Inicio', href: '/', icon: '🏠' },
  { label: 'Salones', href: '/salones', icon: '🏪' },
  { label: 'Planes', href: '/planes', icon: '💎' },
  { label: 'Configuración', href: '/config', icon: '⚙️' },
];

const SalonListPage: React.FC = () => {
  const navigate = useNavigate();
  const [salones, setSalones] = useState<ISalon[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set());
  const [flashIds, setFlashIds] = useState<Set<number>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  const [planUpdatingIds, setPlanUpdatingIds] = useState<Set<number>>(new Set());
  const [planFlashIds, setPlanFlashIds] = useState<Set<number>>(new Set());
  const [planes, setPlanes] = useState<Array<{ id: number; nombre: string }>>([]);

  useEffect(() => {
    const fetchSalones = async () => {
      try {
        const { data } = await api.get('/superadmin/salones');
        setSalones(data);
      } catch {
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };
    fetchSalones();
    api.get('/superadmin/planes').then(({ data }) => {
      setPlanes(Array.isArray(data) ? data : []);
    }).catch(() => {});
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    navigate('/login');
  };

  const filteredSalones = useMemo(() => {
    if (!searchQuery.trim()) return salones;
    const q = searchQuery.toLowerCase();
    return salones.filter(
      (s) =>
        s.nombre.toLowerCase().includes(q) ||
        s.numeroWhatsApp.toLowerCase().includes(q),
    );
  }, [salones, searchQuery]);

  const handleToggle = async (id: number) => {
    setTogglingIds((prev) => new Set(prev).add(id));
    try {
      const { data } = await api.patch(`/superadmin/salones/${id}/toggle`);
      setSalones((prev) => prev.map((s) => (s.id === id ? { ...s, activo: data.activo } : s)));
      setFlashIds((prev) => new Set(prev).add(id));
      setTimeout(() => {
        setFlashIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 1200);
    } catch {
      // silently fail
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handlePlanChange = async (id: number, newPlan: Plan) => {
    setPlanUpdatingIds((prev) => new Set(prev).add(id));
    try {
      await api.put(`/superadmin/salones/${id}`, { plan: newPlan });
      setSalones((prev) =>
        prev.map((s) => (s.id === id ? { ...s, plan: newPlan } : s)),
      );
      setPlanFlashIds((prev) => new Set(prev).add(id));
      setTimeout(() => {
        setPlanFlashIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 1200);
    } catch {
      // silently fail
    } finally {
      setPlanUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingIds((prev) => new Set(prev).add(id));
    try {
      await api.delete(`/superadmin/salones/${id}`);
      // After brief animation delay, remove from list
      setTimeout(() => {
        setSalones((prev) => prev.filter((s) => s.id !== id));
        setDeletingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setConfirmDeleteId((prev) => (prev === id ? null : prev));
      }, 300);
    } catch {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setConfirmDeleteId((prev) => (prev === id ? null : prev));
    }
  };

  const isDeleting = (id: number) => deletingIds.has(id);

  interface LocalColumn {
    key: string;
    label: string;
    render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
    style?: React.CSSProperties;
  }

  const columns: LocalColumn[] = [
    { key: 'id', label: 'ID' },
    {
      key: 'nombre',
      label: 'Nombre',
      render: (_value: unknown, row: Record<string, unknown>) => {
        const id = row.id as number;
        const nombre = row.nombre as string;
        return (
          <motion.span
            whileHover={{ color: 'var(--accent)' }}
            onClick={() => navigate(`/salones/${id}`)}
            style={{
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontWeight: 500,
              transition: 'color 0.15s ease',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {nombre}
          </motion.span>
        );
      },
    },
    { key: 'numeroWhatsApp', label: 'WhatsApp' },
    {
      key: 'ownerEmail',
      label: 'Dueña',
      render: (_value: unknown, row: Record<string, unknown>) => (
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          {row.ownerEmail as string || '—'}
        </span>
      ),
    },
    {
      key: 'plan',
      label: 'Plan',
      render: (_value: unknown, row: Record<string, unknown>) => {
        const id = row.id as number;
        const currentPlan = row.plan as Plan;
        const isUpdating = planUpdatingIds.has(id);
        const isFlashing = planFlashIds.has(id);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <select
              value={currentPlan}
              onChange={(e) => handlePlanChange(id, e.target.value as Plan)}
              disabled={isUpdating}
              style={{
                background: isFlashing
                  ? 'rgba(78, 201, 160, 0.12)'
                  : 'var(--bg-surface)',
                border: isFlashing
                  ? '1px solid var(--success)'
                  : '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                padding: '0.375rem 0.5rem',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: isUpdating ? 'not-allowed' : 'pointer',
                opacity: isUpdating ? 0.6 : 1,
                transition: 'all 0.2s ease',
                outline: 'none',
              }}
            >
              <option value={currentPlan}>{currentPlan}</option>
              {planes.filter((p) => p.nombre !== currentPlan).map((p) => (
                <option key={p.id} value={p.nombre}>{p.nombre}</option>
              ))}
            </select>
            {isFlashing && (
              <motion.span
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                style={{ fontSize: '0.75rem', color: 'var(--success)' }}
              >
                ✓
              </motion.span>
            )}
          </div>
        );
      },
    },
    {
      key: 'activo',
      label: 'Estado',
      render: (_value: unknown, row: Record<string, unknown>) => {
        const activo = row.activo as boolean;
        const variant = activo ? 'success' : 'danger';
        const label = activo ? 'ACTIVO' : 'INACTIVO';
        return (
          <Badge
            variant={variant}
            className={activo ? 'pulse-badge' : undefined}
          >
            {label}
          </Badge>
        );
      },
    },
    {
      key: 'creadoEn',
      label: 'Creado',
      render: (_value: unknown, row: Record<string, unknown>) => {
        const date = row.creadoEn as string;
        return (
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            {new Date(date).toLocaleDateString('es-CO')}
          </span>
        );
      },
    },
    {
      key: 'acciones',
      label: 'Acciones',
      render: (_value: unknown, row: Record<string, unknown>) => {
        const id = row.id as number;
        const isToggling = togglingIds.has(id);
        const isDeletingRow = isDeleting(id);
        const showConfirm = confirmDeleteId === id;

        const baseBtnStyle: React.CSSProperties = {
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          fontSize: '1rem',
          padding: '0.375rem 0.5rem',
          lineHeight: 1,
        };

        const disabledBtnStyle: React.CSSProperties = {
          ...baseBtnStyle,
          cursor: 'not-allowed',
          opacity: 0.6,
        };

        return (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', position: 'relative' }}>
            {/* Edit */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate(`/salones/${id}/editar`)}
              style={baseBtnStyle}
              title="Editar"
            >
              ✏️
            </motion.button>

            {/* Toggle */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleToggle(id)}
              disabled={isToggling}
              style={isToggling ? disabledBtnStyle : baseBtnStyle}
              title={isToggling ? 'Cambiando...' : 'Toggle activo'}
            >
              🔄
            </motion.button>

            {/* Delete */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setConfirmDeleteId(id)}
              style={{
                ...baseBtnStyle,
                color: '#e0556a',
              }}
              title="Eliminar"
            >
              🗑️
            </motion.button>

            {/* Inline confirmation dialog */}
            <AnimatePresence>
              {showConfirm && (
                <motion.div
                  key="confirm-dialog"
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.96 }}
                  transition={{ duration: 0.2, ease: [0.22, 0.61, 0.36, 1] as const }}
                  style={{
                    position: 'absolute',
                    left: '100%',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    marginLeft: '0.75rem',
                    zIndex: 20,
                    background: 'linear-gradient(135deg, rgba(20, 20, 30, 0.95), rgba(15, 15, 22, 0.95))',
                    backdropFilter: 'blur(16px) saturate(180%)',
                    border: '1px solid rgba(224, 85, 106, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 24px rgba(224, 85, 106, 0.15)',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '0.8125rem',
                    color: 'var(--text-secondary)',
                  }}>
                    ¿Eliminar {(row.nombre as string) || ''}?
                  </span>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleDelete(id)}
                    disabled={isDeletingRow}
                    style={{
                      background: 'linear-gradient(135deg, var(--danger), var(--danger-dark))',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--bg-root)',
                      cursor: isDeletingRow ? 'not-allowed' : 'pointer',
                      padding: '0.375rem 0.75rem',
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                      opacity: isDeletingRow ? 0.6 : 1,
                    }}
                  >
                    {isDeletingRow ? '...' : 'Eliminar'}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setConfirmDeleteId(null)}
                    disabled={isDeletingRow}
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      padding: '0.375rem 0.75rem',
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                    }}
                  >
                    Cancelar
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      },
    },
  ];

  const data = filteredSalones.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    numeroWhatsApp: s.numeroWhatsApp,
    plan: s.plan,
    activo: s.activo,
    creadoEn: s.creadoEn,
    ownerEmail: s.ownerEmail,
  }));

  const rowVariants = {
    hidden: { opacity: 0, x: -24 },
    show: (i: number) => ({
      opacity: 1,
      x: 0,
      transition: {
        delay: i * 0.05,
        duration: 0.35,
        ease: [0.22, 0.61, 0.36, 1] as const,
      },
    }),
    exit: (_id: number) => ({
      opacity: 0,
      x: 24,
      height: 0,
      paddingTop: 0,
      paddingBottom: 0,
      overflow: 'hidden',
      transition: {
        duration: 0.3,
        ease: [0.22, 0.61, 0.36, 1] as const,
      },
    }),
  };

  return (
    <Layout sidebarItems={sidebarItems} onLogout={handleLogout} title="Salones">
      {/* Pattern 1: Atmospheric background */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: `
          radial-gradient(ellipse at 20% 50%, var(--accent-subtle) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 20%, rgba(77, 168, 218, 0.06) 0%, transparent 50%),
          var(--bg-root)
        `,
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Page title + button — staggered entrance */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 0.61, 0.36, 1] as const }}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem',
          }}
        >
          <h2
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '1.75rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            Salones
          </h2>
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15, duration: 0.3 }}
          >
            <Button onClick={() => navigate('/salones/nuevo')}>Nuevo salón</Button>
          </motion.div>
        </motion.div>

        {/* Search bar with glass morphism */}
        {!loading && salones.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.3 }}
            style={{
              marginBottom: '1rem',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
              backdropFilter: 'blur(12px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
              position: 'relative',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0.625rem 0.875rem',
              gap: '0.5rem',
            }}>
              <span style={{ fontSize: '1rem', opacity: 0.5, lineHeight: 1 }}>🔍</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre o WhatsApp..."
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: '0.875rem',
                }}
              />
              {searchQuery && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={() => setSearchQuery('')}
                  style={{
                    background: 'var(--bg-elevated)',
                    border: 'none',
                    borderRadius: '50%',
                    width: 22,
                    height: 22,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'var(--text-dim)',
                    fontSize: '0.75rem',
                    lineHeight: 1,
                  }}
                >
                  ✕
                </motion.button>
              )}
            </div>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="skeleton" exit={{ opacity: 0, transition: { duration: 0.2 } }}>
              <Skeleton height="300px" variant="rect" />
            </motion.div>
          ) : salones.length === 0 ? (
            /* Pattern 6: Delightful Empty State */
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '4rem 2rem',
                textAlign: 'center',
                background: 'linear-gradient(135deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))',
                backdropFilter: 'blur(12px) saturate(180%)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Geometric decorative line */}
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.2, duration: 0.6, ease: [0.22, 0.61, 0.36, 1] as const }}
                style={{
                  width: '120px',
                  height: '2px',
                  background: 'linear-gradient(90deg, transparent, var(--accent), transparent)',
                  marginBottom: '2rem',
                  transformOrigin: 'center',
                }}
              />
              {/* Large emoji with spring entrance */}
              <motion.span
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 250, damping: 12, delay: 0.1 }}
                style={{ fontSize: '5rem', marginBottom: '1.5rem', display: 'block' }}
              >
                🏪
              </motion.span>
              {/* Poetic message */}
              <p
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: '1.375rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '0.5rem',
                  letterSpacing: '-0.01em',
                }}
              >
                Aún no hay salones
              </p>
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '2rem',
                  maxWidth: 320,
                  lineHeight: 1.6,
                }}
              >
                Este espacio espera ser habitado. Crea el primer salón y
                empieza a construir tu red de negocios.
              </p>
              {/* CTA with glow */}
              <motion.div
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                <Button onClick={() => navigate('/salones/nuevo')}>
                  Crear primer salón
                </Button>
              </motion.div>
            </motion.div>
          ) : (
            /* Table with row reveal */
            <motion.div
              key="table"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
                  backdropFilter: 'blur(20px) saturate(180%)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
                  overflow: 'hidden',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {columns.map((col) => (
                        <th
                          key={col.key}
                          style={{
                            textAlign: 'left',
                            padding: '0.875rem 1rem',
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: 'var(--text-dim)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            borderBottom: '1px solid var(--border)',
                          }}
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.length === 0 ? (
                      <motion.tr
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        <td
                          colSpan={columns.length}
                          style={{
                            padding: '2rem',
                            textAlign: 'center',
                            color: 'var(--text-dim)',
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: '0.875rem',
                          }}
                        >
                          Ningún salón coincide con tu búsqueda
                        </td>
                      </motion.tr>
                    ) : (
                      <AnimatePresence>
                        {data.map((row, i) => {
                          const isFlashing = flashIds.has(row.id);
                          return (
                            <motion.tr
                              key={row.id}
                              custom={row.id}
                              variants={rowVariants}
                              initial="hidden"
                              animate="show"
                              exit="exit"
                              whileHover={{
                                backgroundColor: 'rgba(196, 69, 90, 0.04)',
                                transition: { duration: 0.15 },
                              }}
                              style={{
                                borderBottom: i < data.length - 1 ? '1px solid var(--border)' : 'none',
                                transition: 'background-color 0.15s ease',
                                backgroundColor: isFlashing ? 'rgba(78, 201, 160, 0.08)' : undefined,
                              }}
                            >
                              {columns.map((col) => (
                                <td
                                  key={col.key}
                                  style={{
                                    padding: '0.75rem 1rem',
                                    fontFamily: "'DM Sans', sans-serif",
                                    fontSize: '0.875rem',
                                    color: 'var(--text-primary)',
                                  }}
                                >
                                  {(col.render
                                    ? col.render((row as Record<string, unknown>)[col.key], row as Record<string, unknown>)
                                    : String((row as Record<string, unknown>)[col.key] ?? ''))}
                                </td>
                              ))}
                            </motion.tr>
                          );
                        })}
                      </AnimatePresence>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!loading && salones.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            style={{ marginTop: '1rem' }}
          >
            <Button variant="ghost" onClick={() => navigate('/')}>
              ← Volver
            </Button>
          </motion.div>
        )}
      </div>
    </Layout>
  );
};

export default SalonListPage;
