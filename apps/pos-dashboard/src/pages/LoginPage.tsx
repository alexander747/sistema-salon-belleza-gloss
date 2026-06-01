import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Box, Paper, Typography, TextField, Button } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import api from '../services/api.js';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
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
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
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
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(212,168,83,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
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
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(212,168,83,0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(212,168,83,0.015) 1px, transparent 1px)
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
                POS<span style={{ color: theme.palette.primary.main }}>·</span>Final
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
