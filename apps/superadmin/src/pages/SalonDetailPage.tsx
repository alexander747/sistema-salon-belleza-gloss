import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Layout, Button } from '@pos-final/ui';
import type { SidebarItem } from '@pos-final/ui';
import type { ISalon } from '@pos-final/types';
import api from '../services/api.js';

const sidebarItems: SidebarItem[] = [
  { label: 'Inicio', href: '/', icon: '🏠' },
  { label: 'Salones', href: '/salones', icon: '🏪' },
  { label: 'Configuración', href: '/config', icon: '⚙️' },
];

const staggerContainer = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.07, delayChildren: 0.15 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 16, filter: 'blur(2px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.4, ease: [0.22, 0.61, 0.36, 1] as const },
  },
};

const cardStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
  backdropFilter: 'blur(20px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 'var(--radius-md)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
  padding: '1.25rem',
};

const labelStyle: React.CSSProperties = {
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.6875rem',
  fontWeight: 600,
  color: 'var(--text-dim)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: '0.25rem',
};

const valueStyle: React.CSSProperties = {
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  fontSize: '0.9375rem',
  color: 'var(--text-primary)',
  fontWeight: 500,
};

const SalonDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [salon, setSalon] = useState<ISalon | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    const fetchSalon = async () => {
      try {
        const { data } = await api.get(`/superadmin/salones/${id}`);
        setSalon(data);
      } catch {
        navigate('/salones');
      } finally {
        setLoading(false);
      }
    };
    fetchSalon();
  }, [id, navigate]);

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    navigate('/login');
  };

  const handleCopyKey = async () => {
    if (!salon) return;
    try {
      await navigator.clipboard.writeText(salon.apiKeyN8n);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // silent
    }
  };

  const handleDelete = async () => {
    if (!salon) return;
    setDeleting(true);
    try {
      await api.delete(`/superadmin/salones/${salon.id}`);
      setDeleted(true);
      setTimeout(() => navigate('/salones'), 500);
    } catch {
      setDeleteConfirm(false);
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Layout sidebarItems={sidebarItems} onLogout={handleLogout} title="Cargando...">
        <div style={{
          position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
          background: `
            radial-gradient(ellipse at 20% 50%, var(--accent-subtle) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 20%, rgba(77, 168, 218, 0.06) 0%, transparent 50%),
            var(--bg-root)
          `,
        }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
              backdropFilter: 'blur(20px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 'var(--radius-md)',
              padding: '1.5rem',
            }}>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} style={{
                  height: 36,
                  marginBottom: '1rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'linear-gradient(90deg, var(--bg-elevated) 25%, var(--bg-hover) 50%, var(--bg-elevated) 75%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.5s ease-in-out infinite',
                }} />
              ))}
            </div>
          </motion.div>
        </div>
      </Layout>
    );
  }

  if (deleted || !salon) {
    return null;
  }

  const infoFields = [
    { label: 'WhatsApp', value: salon.numeroWhatsApp },
    { label: 'Dueña', value: salon.ownerEmail || '—' },
    { label: 'Logo', value: salon.logoUrl || 'Sin logo', mono: !!salon.logoUrl },
    { label: 'Plan', value: salon.plan },
    { label: 'Estado', value: salon.estado },
    { label: 'Activo', value: salon.activo ? '✅' : '❌' },
    { label: 'Creado', value: new Date(salon.creadoEn).toLocaleDateString('es-CO') },
  ];

  const customizationFields = [
    { label: 'Color primario', value: salon.colorPrimario, color: salon.colorPrimario },
    { label: 'Color secundario', value: salon.colorSecundario, color: salon.colorSecundario },
    { label: 'Tema', value: salon.tema || 'No definido' },
  ];

  const botFields = [
    { label: 'Nombre', value: salon.nombreBot },
    { label: 'Tono', value: salon.tonoVoz },
    { label: 'Cancelación', value: `${salon.horasCancelacion}h` },
  ];

  return (
    <Layout sidebarItems={sidebarItems} onLogout={handleLogout} title={salon.nombre}>
      {/* Atmospheric background */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: `
          radial-gradient(ellipse at 20% 50%, var(--accent-subtle) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 20%, rgba(77, 168, 218, 0.06) 0%, transparent 50%),
          var(--bg-root)
        `,
      }} />

      <motion.div
        style={{ position: 'relative', zIndex: 1 }}
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        {/* Back button */}
        <motion.div variants={staggerItem}>
          <Button variant="ghost" onClick={() => navigate('/salones')}>
            ← Volver a salones
          </Button>
        </motion.div>

        {/* Page title */}
        <motion.h1
          variants={staggerItem}
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: '2.25rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: '0.75rem 0 1.5rem',
            letterSpacing: '-0.02em',
          }}
        >
          {salon.nombre}
        </motion.h1>

        {/* 2-column grid of glass cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.25rem',
          marginBottom: '1.5rem',
        }}>
          {/* Información general */}
          <motion.div variants={staggerItem} style={cardStyle}>
            <h3 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '1.125rem',
              fontWeight: 600,
              color: 'var(--accent)',
              marginBottom: '1rem',
            }}>
              Información general
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {infoFields.map((field) => (
                <div key={field.label}>
                  <div style={labelStyle}>{field.label}</div>
                  <div style={{
                    ...valueStyle,
                    fontFamily: field.mono ? "'DM Sans', monospace" : undefined,
                    fontSize: field.mono ? '0.8125rem' : '0.9375rem',
                    wordBreak: 'break-all',
                  }}>
                    {field.value}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Personalización */}
          <motion.div variants={staggerItem} style={cardStyle}>
            <h3 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '1.125rem',
              fontWeight: 600,
              color: 'var(--accent)',
              marginBottom: '1rem',
            }}>
              Personalización
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {customizationFields.map((field) => (
                <div key={field.label}>
                  <div style={labelStyle}>{field.label}</div>
                  <div style={{ ...valueStyle, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {field.color && (
                      <span style={{
                        display: 'inline-block',
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        background: field.color,
                        border: '1px solid var(--border)',
                        flexShrink: 0,
                      }} />
                    )}
                    {field.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Color preview card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, duration: 0.4, ease: [0.22, 0.61, 0.36, 1] as const }}
              style={{
                marginTop: '1rem',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                background: salon.colorSecundario || 'var(--bg-elevated)',
                border: `1px solid ${(salon.colorPrimario || '#c4455a')}44`,
              }}
            >
              <p style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: '0.875rem',
                fontWeight: 600,
                color: salon.colorPrimario || 'var(--accent)',
                marginBottom: '0.25rem',
              }}>
                Vista previa
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{
                  display: 'inline-block',
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: salon.colorPrimario || 'var(--accent)',
                }} />
                <span style={{
                  fontSize: '0.6875rem',
                  color: 'var(--text-secondary)',
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                  {salon.colorPrimario || '#c4455a'} · {salon.colorSecundario || '#22222e'}
                </span>
              </div>
            </motion.div>
          </motion.div>

          {/* Bot */}
          <motion.div variants={staggerItem} style={cardStyle}>
            <h3 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '1.125rem',
              fontWeight: 600,
              color: 'var(--accent)',
              marginBottom: '1rem',
            }}>
              Bot
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {botFields.map((field) => (
                <div key={field.label}>
                  <div style={labelStyle}>{field.label}</div>
                  <div style={valueStyle}>{field.value}</div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* API Key */}
          <motion.div variants={staggerItem} style={cardStyle}>
            <h3 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '1.125rem',
              fontWeight: 600,
              color: 'var(--accent)',
              marginBottom: '1rem',
            }}>
              API Key
            </h3>
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={labelStyle}>Clave de API</div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginTop: '0.25rem',
              }}>
                <code style={{
                  flex: 1,
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.5rem 0.75rem',
                  fontFamily: "'DM Sans', monospace",
                  fontSize: '0.8125rem',
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {salon.apiKeyN8n}
                </code>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleCopyKey}
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: copied ? 'var(--success)' : 'var(--text-primary)',
                    cursor: 'pointer',
                    padding: '0.5rem 0.75rem',
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    fontSize: '0.8125rem',
                    whiteSpace: 'nowrap',
                    transition: 'color 0.2s ease',
                  }}
                >
                  {copied ? '✓ Copiado' : '📋 Copiar'}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Action buttons */}
        <motion.div
          variants={staggerItem}
          style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}
        >
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button onClick={() => navigate(`/salones/${salon.id}/editar`)}>
              ✏️ Editar
            </Button>
          </motion.div>

          {!deleteConfirm ? (
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button variant="danger" onClick={() => setDeleteConfirm(true)}>
                🗑️ Eliminar
              </Button>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
            >
              <span style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '0.8125rem',
                color: 'var(--text-secondary)',
              }}>
                ¿Eliminar {salon.nombre}?
              </span>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button variant="danger" onClick={handleDelete} loading={deleting}>
                  Eliminar
                </Button>
              </motion.div>
              <Button variant="secondary" onClick={() => setDeleteConfirm(false)} disabled={deleting}>
                Cancelar
              </Button>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </Layout>
  );
};

export default SalonDetailPage;
