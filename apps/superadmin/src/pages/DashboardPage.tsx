import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Layout, StatsCard, Button, Skeleton } from '@pos-final/ui';
import type { IUser } from '@pos-final/types';
import type { SidebarItem } from '@pos-final/ui';
import api from '../services/api.js';

const sidebarItems: SidebarItem[] = [
  { label: 'Inicio', href: '/', icon: '🏠' },
  { label: 'Salones', href: '/salones', icon: '🏪' },
  { label: 'Planes', href: '/planes', icon: '💎' },
  { label: 'Configuración', href: '/config', icon: '⚙️' },
];

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<IUser | null>(null);
  const [totalSalones, setTotalSalones] = useState(0);
  const [activos, setActivos] = useState(0);
  const [premium, setPremium] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [meRes, salonesRes] = await Promise.all([
          api.get('/auth/me'),
          api.get('/superadmin/salones'),
        ]);
        setUser(meRes.data);
        const s = salonesRes.data as Array<{ estado: string; plan: string }>;
        setTotalSalones(s.length);
        setActivos(s.filter((salon) => salon.estado === 'ACTIVO').length);
        setPremium(s.filter((salon) => salon.plan === 'PREMIUM').length);
      } catch {
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    navigate('/login');
  };

  const containerVariants = {
    hidden: {},
    show: {
      transition: { staggerChildren: 0.1, delayChildren: 0.15 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 24, filter: 'blur(2px)' },
    show: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: { duration: 0.45, ease: [0.22, 0.61, 0.36, 1] as const },
    },
  };

  return (
    <Layout sidebarItems={sidebarItems} onLogout={handleLogout} title="Panel Superadmin" userName={user?.nombre}>
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
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="skeleton"
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} height="120px" variant="rect" />
                ))}
              </div>
              <Skeleton height="180px" variant="rect" style={{ marginBottom: '1rem' }} />
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <Skeleton width="140px" height="40px" variant="rect" />
                <Skeleton width="140px" height="40px" variant="rect" />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              {/* Stats cards with animated accent lines */}
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '1rem',
                  marginBottom: '1.5rem',
                }}
              >
                {[
                  <StatsCard icon="🏪" value={totalSalones} label="Total salones" />,
                  <StatsCard icon="✅" value={activos} label="Salones activos" />,
                  <StatsCard icon="⭐" value={premium} label="Planes premium" />,
                ].map((card, i) => (
                  <motion.div key={i} variants={itemVariants}>
                    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 'var(--radius-md)' }}>
                      {/* Pattern 4: Animated accent line */}
                      <motion.div
                        style={{
                          position: 'absolute', top: 0, left: 0, right: 0, height: '3px', zIndex: 2,
                          background: 'linear-gradient(90deg, var(--accent), var(--accent-hover))',
                          transformOrigin: 'left',
                        }}
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ delay: 0.3 + i * 0.1, duration: 0.6, ease: 'easeOut' }}
                      />
                      {card}
                    </div>
                  </motion.div>
                ))}
              </motion.div>

              {/* Navigation buttons */}
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
                style={{ display: 'flex', gap: '0.75rem' }}
              >
                <Button onClick={() => navigate('/salones')}>Ver salones</Button>
                <Button variant="ghost" onClick={() => navigate('/salones/nuevo')}>
                  + Crear salón
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
};

export default DashboardPage;
