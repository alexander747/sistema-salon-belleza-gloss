import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Layout, Button, Input, Card } from '@pos-final/ui';
import type { SidebarItem } from '@pos-final/ui';
import type { ISalon } from '@pos-final/types';
import api from '../services/api.js';

const sidebarItems: SidebarItem[] = [
  { label: 'Inicio', href: '/', icon: '🏠' },
  { label: 'Salones', href: '/salones', icon: '🏪' },
  { label: 'Configuración', href: '/config', icon: '⚙️' },
];

const formFieldBaseDelay = 0.08;

const dividerVariants = {
  hidden: { scaleX: 0 },
  show: {
    scaleX: 1,
    transition: { duration: 0.5, ease: [0.22, 0.61, 0.36, 1] as const },
  },
};

const containerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const fieldItemVariants = {
  hidden: { opacity: 0, x: -16, filter: 'blur(2px)' },
  show: {
    opacity: 1,
    x: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.4, ease: [0.22, 0.61, 0.36, 1] as const },
  },
};

const EditSalonPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Form state
  const [nombre, setNombre] = useState('');
  const [numeroWhatsApp, setNumeroWhatsApp] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [colorPrimario, setColorPrimario] = useState('#c4455a');
  const [colorSecundario, setColorSecundario] = useState('#22222e');
  const [tema, setTema] = useState('oscuro');
  const [nombreBot, setNombreBot] = useState('');
  const [tonoVoz, setTonoVoz] = useState('amigable');
  const [horasCancelacion, setHorasCancelacion] = useState(24);
  const [plan, setPlan] = useState('BASIC');
  const [activo, setActivo] = useState(true);
  const [ownerPassword, setOwnerPassword] = useState('');

  useEffect(() => {
    const fetchSalon = async () => {
      try {
        const { data } = await api.get(`/superadmin/salones/${id}`);
        const salon: ISalon = data;
        setNombre(salon.nombre);
        setNumeroWhatsApp(salon.numeroWhatsApp);
        setLogoUrl(salon.logoUrl ?? '');
        setColorPrimario(salon.colorPrimario ?? '#c4455a');
        setColorSecundario(salon.colorSecundario ?? '#22222e');
        setTema(salon.tema ?? 'oscuro');
        setNombreBot(salon.nombreBot);
        setTonoVoz(salon.tonoVoz);
        setHorasCancelacion(salon.horasCancelacion);
        setPlan(salon.plan);
        setActivo(salon.activo);
      } catch {
        navigate('/salones');
      } finally {
        setLoading(false);
      }
    };
    fetchSalon();
  }, [id, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      await api.put(`/superadmin/salones/${id}`, {
        nombre,
        numeroWhatsApp,
        logoUrl: logoUrl || null,
        colorPrimario: colorPrimario || null,
        colorSecundario: colorSecundario || null,
        tema: tema || null,
        nombreBot,
        tonoVoz,
        horasCancelacion,
        plan,
        activo,
        ...(ownerPassword ? { ownerPassword } : {}),
      });
      setSuccess(true);
      setTimeout(() => navigate('/salones'), 1200);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
        setError(axiosErr.response?.data?.error?.message ?? 'Error al guardar cambios');
      } else {
        setError('Error de conexión');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    navigate('/login');
  };

  if (loading) {
    return (
      <Layout sidebarItems={sidebarItems} onLogout={handleLogout} title="Editar salón">
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
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
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

  return (
    <Layout sidebarItems={sidebarItems} onLogout={handleLogout} title="Editar salón">
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
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                >
                  {/* Grid Row 1: Sections 1 + 2 */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '1.5rem',
                    marginBottom: '1.5rem',
                  }}>
                    {/* Section 1 — Datos del salón */}
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
                        <motion.div variants={fieldItemVariants}>
                          <Input
                            label="Nombre del salón"
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                            required
                            placeholder="Ej: Nails & Spa"
                          />
                        </motion.div>

                        <motion.div variants={fieldItemVariants}>
                          <Input
                            label="WhatsApp"
                            value={numeroWhatsApp}
                            onChange={(e) => setNumeroWhatsApp(e.target.value)}
                            required
                            placeholder="521234567890"
                          />
                        </motion.div>
                      </div>

                      <motion.div variants={fieldItemVariants} style={{ marginTop: '1rem' }}>
                        <Input
                          label="Logo URL"
                          value={logoUrl}
                          onChange={(e) => setLogoUrl(e.target.value)}
                          placeholder="https://ejemplo.com/logo.png"
                        />
                      </motion.div>
                    </div>

                    {/* Section 2 — Personalización visual */}
                    <div>
                      <motion.h3
                        initial={{ opacity: 0, x: -16, filter: 'blur(2px)' }}
                        animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                        transition={{ delay: formFieldBaseDelay + 0.2, duration: 0.35 }}
                        style={{
                          fontFamily: "'Playfair Display', serif",
                          fontSize: '1.25rem',
                          fontWeight: 600,
                          color: 'var(--accent)',
                          marginBottom: '1rem',
                        }}
                      >
                        Personalización visual
                      </motion.h3>

                      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                        <motion.div variants={fieldItemVariants} style={{ flex: 1 }}>
                          <label style={{
                            display: 'block',
                            fontSize: '0.8125rem',
                            fontWeight: 500,
                            color: 'var(--text-secondary)',
                            marginBottom: '0.375rem',
                          }}>Color primario</label>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <input
                              type="color"
                              value={colorPrimario}
                              onChange={(e) => setColorPrimario(e.target.value)}
                              style={{
                                width: 40,
                                height: 40,
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-sm)',
                                background: 'transparent',
                                cursor: 'pointer',
                                padding: 2,
                              }}
                            />
                            <input
                              type="text"
                              value={colorPrimario}
                              onChange={(e) => setColorPrimario(e.target.value)}
                              placeholder="#c4455a"
                              style={{
                                flex: 1,
                                background: 'var(--bg-surface)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-sm)',
                                color: 'var(--text-primary)',
                                padding: '0.5rem 0.75rem',
                                fontFamily: "'DM Sans', monospace",
                                fontSize: '0.8125rem',
                              }}
                            />
                          </div>
                        </motion.div>

                        <motion.div variants={fieldItemVariants} style={{ flex: 1 }}>
                          <label style={{
                            display: 'block',
                            fontSize: '0.8125rem',
                            fontWeight: 500,
                            color: 'var(--text-secondary)',
                            marginBottom: '0.375rem',
                          }}>Color secundario</label>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <input
                              type="color"
                              value={colorSecundario}
                              onChange={(e) => setColorSecundario(e.target.value)}
                              style={{
                                width: 40,
                                height: 40,
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-sm)',
                                background: 'transparent',
                                cursor: 'pointer',
                                padding: 2,
                              }}
                            />
                            <input
                              type="text"
                              value={colorSecundario}
                              onChange={(e) => setColorSecundario(e.target.value)}
                              placeholder="#22222e"
                              style={{
                                flex: 1,
                                background: 'var(--bg-surface)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-sm)',
                                color: 'var(--text-primary)',
                                padding: '0.5rem 0.75rem',
                                fontFamily: "'DM Sans', monospace",
                                fontSize: '0.8125rem',
                              }}
                            />
                          </div>
                        </motion.div>
                      </div>

                      <motion.div variants={fieldItemVariants} style={{ marginBottom: '1rem' }}>
                        <label style={{
                          display: 'block',
                          fontSize: '0.8125rem',
                          fontWeight: 500,
                          color: 'var(--text-secondary)',
                          marginBottom: '0.375rem',
                        }}>Tema</label>
                        <select
                          value={tema}
                          onChange={(e) => setTema(e.target.value)}
                          style={{
                            width: '100%',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--text-primary)',
                            padding: '0.625rem 0.75rem',
                            fontFamily: "'Plus Jakarta Sans', sans-serif",
                            fontSize: '0.875rem',
                          }}
                        >
                          <option value="oscuro">Oscuro</option>
                          <option value="claro">Claro</option>
                        </select>
                      </motion.div>

                      {/* Color Preview Card */}
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.5, duration: 0.4, ease: [0.22, 0.61, 0.36, 1] as const }}
                        style={{
                          padding: '1rem',
                          borderRadius: 'var(--radius-md)',
                          background: colorSecundario,
                          border: `1px solid ${colorPrimario}44`,
                        }}
                      >
                        <p style={{
                          fontFamily: "'Playfair Display', serif",
                          fontSize: '0.9375rem',
                          fontWeight: 600,
                          color: colorPrimario,
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
                            background: colorPrimario,
                          }} />
                          <span style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-secondary)',
                            fontFamily: "'DM Sans', sans-serif",
                          }}>
                            {colorPrimario} · {colorSecundario}
                          </span>
                        </div>
                      </motion.div>
                    </div>
                  </div>

                  {/* Animated divider */}
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

                  {/* Grid Row 2: Sections 3 + 4 */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '1.5rem',
                    marginBottom: '1.5rem',
                  }}>
                    {/* Section 3 — Configuración del bot */}
                    <div>
                      <motion.h3
                        initial={{ opacity: 0, x: -16, filter: 'blur(2px)' }}
                        animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                        transition={{ delay: formFieldBaseDelay + 0.5, duration: 0.35 }}
                        style={{
                          fontFamily: "'Playfair Display', serif",
                          fontSize: '1.25rem',
                          fontWeight: 600,
                          color: 'var(--accent)',
                          marginBottom: '1rem',
                        }}
                      >
                        Configuración del bot
                      </motion.h3>

                      <motion.div variants={fieldItemVariants} style={{ marginBottom: '1rem' }}>
                        <Input
                          label="Nombre del bot"
                          value={nombreBot}
                          onChange={(e) => setNombreBot(e.target.value)}
                          placeholder="Asistente Virtual"
                        />
                      </motion.div>

                      <motion.div variants={fieldItemVariants} style={{ marginBottom: '1rem' }}>
                        <label style={{
                          display: 'block',
                          fontSize: '0.8125rem',
                          fontWeight: 500,
                          color: 'var(--text-secondary)',
                          marginBottom: '0.375rem',
                        }}>Tono de voz</label>
                        <select
                          value={tonoVoz}
                          onChange={(e) => setTonoVoz(e.target.value)}
                          style={{
                            width: '100%',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--text-primary)',
                            padding: '0.625rem 0.75rem',
                            fontFamily: "'Plus Jakarta Sans', sans-serif",
                            fontSize: '0.875rem',
                          }}
                        >
                          <option value="amigable">Amigable</option>
                          <option value="profesional">Profesional</option>
                          <option value="divertido">Divertido</option>
                        </select>
                      </motion.div>

                      <motion.div variants={fieldItemVariants} style={{ marginBottom: '1rem' }}>
                        <Input
                          label="Horas de cancelación"
                          type="number"
                          value={String(horasCancelacion)}
                          onChange={(e) => setHorasCancelacion(Number(e.target.value))}
                          min={0}
                          placeholder="24"
                        />
                      </motion.div>
                    </div>

                    {/* Section 4 — Plan y estado */}
                    <div>
                      <motion.h3
                        initial={{ opacity: 0, x: -16, filter: 'blur(2px)' }}
                        animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                        transition={{ delay: formFieldBaseDelay + 0.8, duration: 0.35 }}
                        style={{
                          fontFamily: "'Playfair Display', serif",
                          fontSize: '1.25rem',
                          fontWeight: 600,
                          color: 'var(--accent)',
                          marginBottom: '1rem',
                        }}
                      >
                        Plan y estado
                      </motion.h3>

                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <motion.div variants={fieldItemVariants} style={{ flex: 1 }}>
                          <label style={{
                            display: 'block',
                            fontSize: '0.8125rem',
                            fontWeight: 500,
                            color: 'var(--text-secondary)',
                            marginBottom: '0.375rem',
                          }}>Plan</label>
                          <select
                            value={plan}
                            onChange={(e) => setPlan(e.target.value)}
                            style={{
                              width: '100%',
                              background: 'var(--bg-surface)',
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-sm)',
                              color: 'var(--text-primary)',
                              padding: '0.625rem 0.75rem',
                              fontFamily: "'Plus Jakarta Sans', sans-serif",
                              fontSize: '0.875rem',
                            }}
                          >
                            <option value="BASIC">BASIC</option>
                            <option value="PREMIUM">PREMIUM</option>
                          </select>
                        </motion.div>

                        <motion.div variants={fieldItemVariants} style={{ flex: 1, display: 'flex', alignItems: 'flex-end', paddingBottom: '0.375rem' }}>
                          <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            cursor: 'pointer',
                          }}>
                            <span style={{
                              fontSize: '0.8125rem',
                              fontWeight: 500,
                              color: 'var(--text-secondary)',
                            }}>
                              Activo
                            </span>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={activo}
                              onClick={() => setActivo(!activo)}
                              style={{
                                position: 'relative',
                                width: 44,
                                height: 24,
                                borderRadius: 12,
                                border: 'none',
                                background: activo ? 'var(--accent)' : 'var(--bg-elevated)',
                                cursor: 'pointer',
                                transition: 'background 0.2s ease',
                                boxShadow: activo ? '0 0 12px var(--accent-glow)' : 'none',
                              }}
                            >
                              <span style={{
                                position: 'absolute',
                                top: 2,
                                left: activo ? 22 : 2,
                                width: 20,
                                height: 20,
                                borderRadius: '50%',
                                background: '#fff',
                                transition: 'left 0.25s ease',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                              }} />
                            </button>
                          </label>
                        </motion.div>
                      </div>

                      <motion.div variants={fieldItemVariants} style={{ marginTop: '1rem' }}>
                        <label style={{
                          display: 'block',
                          fontSize: '0.8125rem',
                          fontWeight: 500,
                          color: 'var(--text-secondary)',
                          marginBottom: '0.375rem',
                        }}>Contraseña dueña (dejar vacío para no cambiar)</label>
                        <Input
                          type="password"
                          placeholder="Nueva contraseña"
                          value={ownerPassword}
                          onChange={(e) => setOwnerPassword(e.target.value)}
                        />
                      </motion.div>
                    </div>
                  </div>

                  {/* Error */}
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

                  {/* Success feedback */}
                  {success && (
                    <motion.p
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 12 }}
                      style={{
                        color: 'var(--success)',
                        marginBottom: '1rem',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                      }}
                    >
                      ✓ Cambios guardados — redirigiendo...
                    </motion.p>
                  )}

                  {/* Buttons */}
                  <motion.div
                    variants={fieldItemVariants}
                    style={{ display: 'flex', gap: '0.75rem' }}
                  >
                    <motion.div
                      whileHover={{
                        boxShadow: '0 0 24px var(--accent-glow)',
                        scale: 1.02,
                        transition: { duration: 0.25, ease: 'easeOut' },
                      }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Button type="submit" loading={saving} disabled={success}>
                        Guardar cambios
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
                </motion.div>
              </form>
            </Card.Body>
          </Card>
        </motion.div>
      </div>
    </Layout>
  );
};

export default EditSalonPage;
