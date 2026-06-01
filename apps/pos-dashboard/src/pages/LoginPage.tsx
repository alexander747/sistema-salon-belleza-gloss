import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button, Input, Card } from '@pos-final/ui';
import api from '../services/api.js';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      navigate('/');
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { error?: { message?: string; details?: Record<string, string[]> } } } };
        const errorData = axiosErr.response?.data?.error;
        const firstDetail = errorData?.details
          ? Object.values(errorData.details).flat()[0]
          : undefined;
        setError(firstDetail ?? errorData?.message ?? 'Error al iniciar sesión');
      } else {
        setError('Error de conexión');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-root)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative gradient orbs */}
      <div
        style={{
          position: 'absolute',
          top: '-20%',
          right: '-10%',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(212,168,83,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-20%',
          left: '-10%',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(212,168,83,0.04) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(212,168,83,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(212,168,83,0.02) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
          pointerEvents: 'none',
        }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1] as const }}
      >
        <Card
          style={{
            width: 400,
            padding: 0,
            position: 'relative',
            zIndex: 1,
            animation: 'none',
          }}
        >
          <Card.Body
            style={{
              padding: '2.5rem 2rem',
              textAlign: 'center',
            }}
          >
            {/* Logo area */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h1
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: '2.5rem',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  color: 'var(--text-primary)',
                  margin: 0,
                }}
              >
                <span style={{ color: 'var(--text-primary)' }}>POS</span>
                <span style={{ color: 'var(--accent)' }}>·</span>Final
              </h1>
            </div>

            {/* Decorative line */}
            <div
              style={{
                width: '40px',
                height: '2px',
                background: 'linear-gradient(90deg, var(--accent), transparent)',
                margin: '0 auto 0.75rem',
                borderRadius: '1px',
              }}
            />

            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '0.8125rem',
                color: 'var(--text-secondary)',
                marginBottom: '2rem',
              }}
            >
              Acceso al dashboard del salón
            </p>

            <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.3 }}
                style={{ marginBottom: '1rem' }}
              >
                <Input
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="tucorreo@salon.com"
                  icon="✉"
                />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.3 }}
                style={{ marginBottom: '1.25rem' }}
              >
                <Input
                  label="Contraseña"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  icon="🔒"
                />
              </motion.div>
              {error && (
                <motion.p
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 12 }}
                  style={{
                    color: 'var(--danger)',
                    marginBottom: '1rem',
                    fontSize: '0.8125rem',
                    textAlign: 'center',
                  }}
                >
                  {error}
                </motion.p>
              )}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.3 }}
              >
                <Button type="submit" loading={loading} size="lg" style={{ width: '100%' }}>
                  Ingresar
                </Button>
              </motion.div>
            </form>
          </Card.Body>
        </Card>
      </motion.div>
    </div>
  );
};

export default LoginPage;
