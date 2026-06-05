import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Box, Paper, Typography, TextField, Button } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import api from '../services/api.js';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const [email, setEmail] = useState('duena@test.com');
  const [password, setPassword] = useState('duena123');
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
        const msg = errorData?.message ?? 'Error al iniciar sesión';
        // Use field-specific validation detail only when it adds value over the generic message
        const firstDetail = errorData?.details
          ? Object.values(errorData.details).flat()[0]
          : undefined;
        const isGenericMsg = msg === 'Datos inválidos' || msg === 'Error de validación';
        setError(isGenericMsg && firstDetail ? firstDetail : msg);
      } else {
        setError('Error de conexión');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `
          radial-gradient(ellipse 80% 60% at 20% 80%, rgba(212,168,83,0.08) 0%, transparent 50%),
          radial-gradient(ellipse 60% 80% at 80% 20%, rgba(212,168,83,0.05) 0%, transparent 50%),
          radial-gradient(ellipse 40% 50% at 50% 50%, rgba(180,140,70,0.03) 0%, transparent 70%),
          #08080d
        `,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative gradient orbs */}
      <Box
        sx={{
          position: 'absolute',
          top: '-20%',
          right: '-10%',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(212,168,83,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: '-25%',
          left: '-15%',
          width: '550px',
          height: '550px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(212,168,83,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      {/* Subtle geometric grid */}
      <Box
        sx={{
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
        <Paper
          elevation={8}
          sx={{
            width: 400,
            position: 'relative',
            zIndex: 1,
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          <Box sx={{ p: '2.5rem 2rem', textAlign: 'center' }}>
            {/* Logo area */}
            <Box sx={{ mb: '1.5rem' }}>
              <Typography
                sx={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: '2.5rem',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  color: 'text.primary',
                }}
              >
                Sistema<span style={{ color: theme.palette.primary.main }}>Pro</span>
              </Typography>
            </Box>

            {/* Decorative line */}
            <Box
              sx={{
                width: '40px',
                height: '2px',
                background: `linear-gradient(90deg, ${theme.palette.primary.main}, transparent)`,
                margin: '0 auto 0.75rem',
                borderRadius: '1px',
              }}
            />

            <Typography
              variant="body2"
              sx={{ color: 'text.secondary', mb: '2rem' }}
            >
              Acceso al dashboard del salón
            </Typography>

            <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.3 }}
                style={{ marginBottom: '1rem' }}
              >
                <TextField
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="tucorreo@salon.com"
                  fullWidth
                  variant="outlined"
                  size="medium"
                />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.3 }}
                style={{ marginBottom: '1.25rem' }}
              >
                <TextField
                  label="Contraseña"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  fullWidth
                  variant="outlined"
                  size="medium"
                />
              </motion.div>
              {error && (
                <motion.p
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 12 }}
                  style={{
                    color: theme.palette.error.main,
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
                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  size="large"
                  disabled={loading}
                  sx={{ py: 1.25 }}
                >
                  {loading ? 'Ingresando...' : 'Ingresar'}
                </Button>
              </motion.div>
            </form>
          </Box>
        </Paper>
      </motion.div>
    </Box>
  );
};

export default LoginPage;
