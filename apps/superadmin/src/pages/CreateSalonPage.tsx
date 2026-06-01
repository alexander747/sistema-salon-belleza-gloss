import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Layout, Button, Input, Card } from '@pos-final/ui';
import type { SidebarItem } from '@pos-final/ui';
import api from '../services/api.js';

const sidebarItems: SidebarItem[] = [
  { label: 'Inicio', href: '/', icon: '🏠' },
  { label: 'Salones', href: '/salones', icon: '🏪' },
  { label: 'Configuración', href: '/config', icon: '⚙️' },
];

const CreateSalonPage: React.FC = () => {
  const navigate = useNavigate();
  const [nombre, setNombre] = useState('');
  const [numeroWhatsApp, setNumeroWhatsApp] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [dueñaNombre, setDueñaNombre] = useState('');
  const [dueñaEmail, setDueñaEmail] = useState('');
  const [dueñaPassword, setDueñaPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post('/superadmin/salones', {
        nombre,
        numeroWhatsApp,
        logoUrl: logoUrl || undefined,
        dueñaNombre: dueñaNombre || undefined,
        dueñaEmail: dueñaEmail || undefined,
        dueñaPassword: dueñaPassword || undefined,
      });
      navigate('/salones');
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
        setError(axiosErr.response?.data?.error?.message ?? 'Error al crear salón');
      } else {
        setError('Error de conexión');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    navigate('/login');
  };

  const formFieldBaseDelay = 0.1;

  const dividerVariants = {
    hidden: { scaleX: 0 },
    show: {
      scaleX: 1,
      transition: { duration: 0.5, ease: [0.22, 0.61, 0.36, 1] as const },
    },
  };

  return (
    <Layout sidebarItems={sidebarItems} onLogout={handleLogout} title="Nuevo Salón">
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
        {/* Back button */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          style={{ marginBottom: '1.5rem' }}
        >
          <Button variant="ghost" onClick={() => navigate('/salones')}>
            ← Volver a salones
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1] as const }}
        >
          <Card
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
              backdropFilter: 'blur(20px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.06)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            <Card.Body style={{ padding: '1.5rem' }}>
              <form onSubmit={handleSubmit}>
                {/* 2-column grid: Datos + Dueña side by side */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '1.5rem',
                }}>
                  {/* Section: Datos del salón */}
                  <div>
                    <motion.h3
                      initial={{ opacity: 0, x: -16, filter: 'blur(2px)' }}
                      animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                      transition={{ delay: formFieldBaseDelay, duration: 0.35 }}
                      style={{
                        fontFamily: "'Playfair Display', serif",
                        fontSize: '1.25rem',
                        fontWeight: 600,
                        color: 'var(--accent)',
                        marginBottom: '1rem',
                      }}
                    >
                      Datos del salón
                    </motion.h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <motion.div
                        initial={{ opacity: 0, x: -16, filter: 'blur(2px)' }}
                        animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                        transition={{ delay: formFieldBaseDelay + 0.08, duration: 0.35 }}
                      >
                        <Input
                          label="Nombre del salón"
                          value={nombre}
                          onChange={(e) => setNombre(e.target.value)}
                          required
                          placeholder="Ej: Nails & Spa"
                        />
                      </motion.div>
                      <motion.div
                        initial={{ opacity: 0, x: -16, filter: 'blur(2px)' }}
                        animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                        transition={{ delay: formFieldBaseDelay + 0.16, duration: 0.35 }}
                      >
                        <Input
                          label="WhatsApp"
                          value={numeroWhatsApp}
                          onChange={(e) => setNumeroWhatsApp(e.target.value)}
                          required
                          placeholder="521234567890"
                        />
                      </motion.div>
                    </div>

                    <motion.div
                      initial={{ opacity: 0, x: -16, filter: 'blur(2px)' }}
                      animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                      transition={{ delay: formFieldBaseDelay + 0.24, duration: 0.35 }}
                      style={{ marginTop: '1rem' }}
                    >
                      <Input
                        label="Logo URL (opcional)"
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        placeholder="https://ejemplo.com/logo.png"
                      />
                    </motion.div>
                  </div>

                  {/* Section: Dueña */}
                  <div>
                    <motion.h3
                      initial={{ opacity: 0, x: -16, filter: 'blur(2px)' }}
                      animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                      transition={{ delay: formFieldBaseDelay + 0.4, duration: 0.35 }}
                      style={{
                        fontFamily: "'Playfair Display', serif",
                        fontSize: '1.25rem',
                        fontWeight: 600,
                        color: 'var(--accent)',
                        marginBottom: '1rem',
                      }}
                    >
                      Dueña
                    </motion.h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <motion.div
                        initial={{ opacity: 0, x: -16, filter: 'blur(2px)' }}
                        animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                        transition={{ delay: formFieldBaseDelay + 0.48, duration: 0.35 }}
                      >
                        <Input
                          label="Nombre de la dueña"
                          value={dueñaNombre}
                          onChange={(e) => setDueñaNombre(e.target.value)}
                          placeholder="Ej: María García"
                        />
                      </motion.div>
                      <motion.div
                        initial={{ opacity: 0, x: -16, filter: 'blur(2px)' }}
                        animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                        transition={{ delay: formFieldBaseDelay + 0.56, duration: 0.35 }}
                      >
                        <Input
                          label="Email de la dueña"
                          type="email"
                          value={dueñaEmail}
                          onChange={(e) => setDueñaEmail(e.target.value)}
                          placeholder="duena@salon.com"
                        />
                      </motion.div>
                    </div>

                    <motion.div
                      initial={{ opacity: 0, x: -16, filter: 'blur(2px)' }}
                      animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                      transition={{ delay: formFieldBaseDelay + 0.64, duration: 0.35 }}
                      style={{ marginTop: '1rem' }}
                    >
                      <Input
                        label="Contraseña de la dueña"
                        type="password"
                        value={dueñaPassword}
                        onChange={(e) => setDueñaPassword(e.target.value)}
                        placeholder="••••••••"
                      />
                    </motion.div>
                  </div>
                </div>

                {/* Animated divider line */}
                <motion.div
                  variants={dividerVariants}
                  initial="hidden"
                  animate="show"
                  style={{
                    width: '100%',
                    height: '1px',
                    background: 'linear-gradient(90deg, var(--accent), var(--border), transparent)',
                    margin: '1.5rem 0',
                    transformOrigin: 'left',
                  }}
                />

                {error && (
                  <motion.p
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 12 }}
                    style={{
                      color: 'var(--danger)',
                      marginBottom: '1rem',
                      fontSize: '0.8125rem',
                    }}
                  >
                    {error}
                  </motion.p>
                )}

                {/* Submit buttons */}
                <motion.div
                  initial={{ opacity: 0, x: -16, filter: 'blur(2px)' }}
                  animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                  transition={{ delay: formFieldBaseDelay + 0.72, duration: 0.35 }}
                  style={{ display: 'flex', gap: '0.75rem' }}
                >
                  <motion.div
                    whileHover={{
                      boxShadow: '0 0 24px rgba(77, 168, 218, 0.35)',
                      scale: 1.02,
                      transition: { duration: 0.25, ease: 'easeOut' },
                    }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button type="submit" loading={loading}>
                      Crear salón
                    </Button>
                  </motion.div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => navigate('/salones')}
                  >
                    Cancelar
                  </Button>
                </motion.div>
              </form>
            </Card.Body>
          </Card>
        </motion.div>
      </div>
    </Layout>
  );
};

export default CreateSalonPage;
