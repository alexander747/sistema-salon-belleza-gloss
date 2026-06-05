import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout, Badge, Button, Skeleton } from '@pos-final/ui';
import type { SidebarItem } from '@pos-final/ui';
import api from '../services/api.js';

/* ── Types ── */
interface Plan {
  id: number;
  nombre: string;
  precioMensual: number;
  maxEmpleadas: number;
  maxSucursales: number;
  features: string[];
  activo: boolean;
  creadoEn: string;
  actualizadoEn: string;
}

interface PlanForm {
  nombre: string;
  precioMensual: string;
  maxEmpleadas: string;
  maxSucursales: string;
  features: string;
  activo: boolean;
}

/* ── Constants ── */
const sidebarItems: SidebarItem[] = [
  { label: 'Inicio', href: '/', icon: '🏠' },
  { label: 'Salones', href: '/salones', icon: '🏪' },
  { label: 'Planes', href: '/planes', icon: '💎' },
  { label: 'Configuración', href: '/config', icon: '⚙️' },
];

const EMPTY_FORM: PlanForm = {
  nombre: '',
  precioMensual: '0',
  maxEmpleadas: '5',
  maxSucursales: '1',
  features: '',
  activo: true,
};

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
});

/* ── Styles ── */
const glassCard: React.CSSProperties = {
  background: 'linear-gradient(135deg, var(--bg-elevated), var(--bg-surface))',
  backdropFilter: 'blur(12px)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: '1.25rem',
  boxShadow: 'var(--shadow-sm)',
};

const primaryBtn: React.CSSProperties = {
  background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--bg-root)',
  padding: '0.5rem 1.25rem',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.8125rem',
  fontWeight: 600,
  cursor: 'pointer',
  boxShadow: 'var(--shadow-sm), 0 0 0 0 var(--accent-glow)',
  transition: 'all 200ms var(--ease-out)',
};

const secondaryBtn: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)',
  padding: '0.5rem 1.25rem',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.8125rem',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 200ms var(--ease-out)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)',
  background: 'var(--bg-base)',
  color: 'var(--text-primary)',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.8125rem',
  outline: 'none',
};

const modalOverlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.6)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 200,
};

/* ── Component ── */
const PlanesPage: React.FC = () => {
  const navigate = useNavigate();

  const [planes, setPlanes] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState<PlanForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Plan | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* ── Fetch ── */
  const fetchPlanes = async () => {
    try {
      setError(null);
      const { data } = await api.get('/superadmin/planes');
      setPlanes(Array.isArray(data) ? data : []);
    } catch {
      setError('Error al cargar planes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPlanes(); }, []);

  /* ── Filter ── */
  const filtered = useMemo(() => {
    if (!search.trim()) return planes;
    const q = search.toLowerCase();
    return planes.filter((p) => p.nombre.toLowerCase().includes(q));
  }, [planes, search]);

  /* ── Modal ── */
  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (plan: Plan) => {
    setEditing(plan);
    setForm({
      nombre: plan.nombre,
      precioMensual: String(plan.precioMensual),
      maxEmpleadas: String(plan.maxEmpleadas),
      maxSucursales: String(plan.maxSucursales),
      features: plan.features.join(', '),
      activo: plan.activo,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = async () => {
    if (!form.nombre.trim()) return;
    setSaving(true);
    try {
      const payload = {
        nombre: form.nombre.trim(),
        precioMensual: Number(form.precioMensual) || 0,
        maxEmpleadas: Number(form.maxEmpleadas) || 0,
        maxSucursales: Number(form.maxSucursales) || 0,
        features: form.features.split(',').map((f) => f.trim()).filter(Boolean),
        activo: form.activo,
      };

      if (editing) {
        await api.put(`/superadmin/planes/${editing.id}`, payload);
      } else {
        await api.post('/superadmin/planes', payload);
      }
      closeModal();
      fetchPlanes();
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await api.delete(`/superadmin/planes/${deleteConfirm.id}`);
      setDeleteConfirm(null);
      fetchPlanes();
    } catch {
      // silent
    } finally {
      setDeleting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    navigate('/login');
  };

  /* ── Render ── */
  const isValid = form.nombre.trim().length > 0;

  return (
    <Layout sidebarItems={sidebarItems} onLogout={handleLogout} title="Planes">
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.875rem' }}>🔍</span>
          <input
            type="text"
            placeholder="Buscar plan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...inputStyle, paddingLeft: '2.25rem' }}
          />
        </div>
        <button style={primaryBtn} onClick={openCreate}>+ Nuevo Plan</button>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {[1, 2, 3].map((i) => <Skeleton key={i} height="64px" variant="rect" />)}
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--danger)', marginBottom: '1rem' }}>⚠️ {error}</p>
          <Button variant="secondary" size="sm" onClick={fetchPlanes}>Reintentar</Button>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', ...glassCard }}>
          <h3 style={{ fontFamily: "'DM Sans', sans-serif", marginBottom: '0.5rem' }}>No hay planes</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
            {search ? `Ningún plan coincide con «${search}»` : 'Crea el primer plan de suscripción'}
          </p>
          {!search && <button style={primaryBtn} onClick={openCreate}>Crear primer plan</button>}
        </div>
      ) : (
        <div style={{ ...glassCard, padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'DM Sans', sans-serif" }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Nombre', 'Precio', 'Empleadas', 'Sucursales', 'Features', 'Estado', 'Creado', 'Acciones'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-secondary)', background: 'linear-gradient(135deg, var(--bg-elevated), var(--bg-surface))' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {filtered.map((plan) => (
                  <motion.tr
                    key={plan.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    style={{ borderBottom: '1px solid var(--border)' }}
                  >
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>{plan.nombre}</td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--accent)', fontWeight: 600 }}>
                      {plan.precioMensual === 0 ? 'Gratis' : currencyFormatter.format(plan.precioMensual)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>{plan.maxEmpleadas}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{plan.maxSucursales}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {plan.features.slice(0, 3).map((f, i) => (
                          <Badge key={i} variant="neutral">{f}</Badge>
                        ))}
                        {plan.features.length > 3 && <Badge variant="neutral">+{plan.features.length - 3}</Badge>}
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <Badge variant={plan.activo ? 'success' : 'danger'}>
                        {plan.activo ? 'ACTIVO' : 'INACTIVO'}
                      </Badge>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      {new Date(plan.creadoEn).toLocaleDateString('es-CO')}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button onClick={() => openEdit(plan)} style={{ ...secondaryBtn, padding: '0.35rem 0.6rem', fontSize: '0.875rem' }} title="Editar">✏️</button>
                        <button onClick={() => setDeleteConfirm(plan)} style={{ ...secondaryBtn, padding: '0.35rem 0.6rem', fontSize: '0.875rem', color: 'var(--danger)' }} title="Eliminar">🗑️</button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            style={modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
          >
            <motion.div
              style={{ ...glassCard, width: '480px', maxHeight: '90vh', overflow: 'auto' }}
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ fontFamily: "'DM Sans', sans-serif", margin: 0 }}>{editing ? 'Editar Plan' : 'Nuevo Plan'}</h3>
                <button onClick={closeModal} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.25rem' }}>✕</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Nombre *</label>
                  <input type="text" style={inputStyle} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: BASIC" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Precio $</label>
                    <input type="number" style={inputStyle} value={form.precioMensual} onChange={(e) => setForm({ ...form, precioMensual: e.target.value })} min={0} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Max Empleadas</label>
                    <input type="number" style={inputStyle} value={form.maxEmpleadas} onChange={(e) => setForm({ ...form, maxEmpleadas: e.target.value })} min={0} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Max Sucursales</label>
                    <input type="number" style={inputStyle} value={form.maxSucursales} onChange={(e) => setForm({ ...form, maxSucursales: e.target.value })} min={0} />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Features (separadas por coma)</label>
                  <input type="text" style={inputStyle} value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} placeholder="Feature 1, Feature 2, ..." />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />
                  <label style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Activo</label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
                <button style={secondaryBtn} onClick={closeModal}>Cancelar</button>
                <button style={{ ...primaryBtn, opacity: isValid && !saving ? 1 : 0.5 }} disabled={!isValid || saving} onClick={handleSave}>
                  {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear plan'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div style={modalOverlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteConfirm(null)}>
            <motion.div style={{ ...glassCard, width: '380px', textAlign: 'center' }} initial={{ scale: 0.9 }} animate={{ scale: 1 }} onClick={(e) => e.stopPropagation()}>
              <p style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🗑️</p>
              <h3 style={{ fontFamily: "'DM Sans', sans-serif", marginBottom: '0.5rem' }}>¿Eliminar plan?</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
                «{deleteConfirm.nombre}» se eliminará permanentemente.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                <button style={secondaryBtn} onClick={() => setDeleteConfirm(null)}>Cancelar</button>
                <button
                  style={{ ...primaryBtn, background: 'linear-gradient(135deg, var(--danger), var(--danger-dark))', opacity: deleting ? 0.5 : 1 }}
                  disabled={deleting}
                  onClick={handleDelete}
                >
                  {deleting ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
};

export default PlanesPage;
