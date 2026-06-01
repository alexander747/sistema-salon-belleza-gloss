import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Layout, StatsCard, Card, Skeleton, Badge } from '@pos-final/ui';
import { Rol, type IUser } from '@pos-final/types';
import type { SidebarItem } from '@pos-final/ui';
import api from '../services/api.js';
import SalonSwitcher from '../components/SalonSwitcher.js';

/* ── Types ── */

interface FinanzasResumen {
  totalServicios: number;
  totalProductos: number;
  totalPropinas: number;
  totalComisiones: number;
  cantidadAtenciones: number;
  totalIngresos: number;
}

interface CitaDashboard {
  id: number;
  cliente: { id: number; nombre: string };
  servicios: Array<{ id: number; nombre: string }>;
  usuario: { id: number; nombre: string };
  estado: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
}

interface ClienteSimple {
  id: number;
  nombre: string;
  createdAt?: string;
}

interface EmpleadaSimple {
  id: number;
  nombre: string;
  activo: boolean;
}

/* ── Constants ── */

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const sidebarItems: SidebarItem[] = [
  { label: 'Inicio', href: '/', icon: '🏠' },
  { label: 'Citas', href: '/agenda', icon: '📅' },
  { label: 'Empleadas', href: '/empleadas', icon: '👩‍💼' },
  { label: 'Servicios', href: '/servicios', icon: '💅' },
  { label: 'Productos', href: '/productos', icon: '🧴' },
  { label: 'Categorías', href: '/categorias', icon: '📂' },
  { label: 'Clientes', href: '/clientes', icon: '👤' },
  { label: 'Ventas', href: '/ventas', icon: '🛒' },
  { label: 'Finanzas', href: '/finanzas', icon: '💰' },
];

const STATUS_CFG: Record<
  string,
  { variant: 'success' | 'warning' | 'danger' | 'neutral'; label: string }
> = {
  PENDIENTE: { variant: 'warning', label: 'Pendiente' },
  CONFIRMADA: { variant: 'warning', label: 'Confirmada' },
  EN_PROGRESO: { variant: 'neutral', label: 'En curso' },
  COMPLETADA: { variant: 'success', label: 'Completada' },
  CANCELADA: { variant: 'danger', label: 'Cancelada' },
};

const QUICK_ACTIONS = [
  { icon: '📅', title: 'Nueva cita', subtitle: 'Agendar', href: '/agenda' },
  { icon: '👤', title: 'Clientes', subtitle: 'Gestionar', href: '/clientes' },
  { icon: '💅', title: 'Servicios', subtitle: 'Catálogo', href: '/servicios' },
];

/* ── Helpers ── */

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function formatCurrency(n: number): string {
  return currencyFormatter.format(n);
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay(); // 0=Sun
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getWeekDays(monday: Date): Date[] {
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function isCurrentMonth(d: Date): boolean {
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

export type CitaEstado =
  | 'PENDIENTE'
  | 'CONFIRMADA'
  | 'EN_PROGRESO'
  | 'COMPLETADA'
  | 'CANCELADA';

/* ── Chart Tooltip ── */

interface TooltipPayloadItem {
  value: number;
  name: string;
  color: string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

const ChartTooltipContent: React.FC<ChartTooltipProps> = ({
  active,
  payload,
  label,
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const val = payload[0].value;
  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '0.5rem 0.75rem',
        fontFamily: "'DM Sans', sans-serif",
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <p
        style={{
          color: 'var(--text-secondary)',
          fontSize: '0.6875rem',
          margin: 0,
        }}
      >
        {label}
      </p>
      <p
        style={{
          color: 'var(--accent)',
          fontSize: '0.875rem',
          fontWeight: 600,
          margin: 0,
        }}
      >
        {val} {val === 1 ? 'cita' : 'citas'}
      </p>
    </div>
  );
};

/* ── Inline Styles ── */

const quickActionStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '1rem 1.25rem',
  borderRadius: 'var(--radius-md)',
  background:
    'linear-gradient(135deg, rgba(30, 30, 40, 0.6), rgba(22, 22, 30, 0.8))',
  backdropFilter: 'blur(12px)',
  border: '1px solid var(--border)',
  cursor: 'pointer',
  transition: 'all 250ms var(--ease-out)',
  fontFamily: 'inherit',
  color: 'var(--text-primary)',
  textAlign: 'left' as const,
  width: '100%',
};

const quickActionIconStyle: React.CSSProperties = {
  fontSize: '1.5rem',
  width: 44,
  height: 44,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--accent-subtle)',
  border: '1px solid var(--border-glow)',
  flexShrink: 0,
};

const errorBtnStyle: React.CSSProperties = {
  padding: '0.625rem 1.5rem',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--accent)',
  border: 'none',
  color: 'var(--bg-root)',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.8125rem',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'background 0.2s, box-shadow 0.2s',
  boxShadow: '0 2px 12px rgba(212,168,83,0.25)',
};

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
  textDecoration: 'none',
  display: 'inline-block',
  transition: 'background 0.2s, box-shadow 0.2s',
  boxShadow: '0 2px 12px rgba(212,168,83,0.25)',
};

const citaRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0.75rem 0',
  borderBottom: '1px solid var(--border)',
  gap: '0.75rem',
};

const citaLastRowStyle: React.CSSProperties = {
  ...citaRowStyle,
  borderBottom: 'none',
};

/* ── Sub-components ── */

interface CitaRowProps {
  cita: CitaDashboard;
  isLast: boolean;
}

const CitaRow: React.FC<CitaRowProps> = ({ cita, isLast }) => {
  const cfg = STATUS_CFG[cita.estado] ?? STATUS_CFG.PENDIENTE;
  return (
    <motion.div
      style={isLast ? citaLastRowStyle : citaRowStyle}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ x: 4, transition: { duration: 0.15 } }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: 'var(--accent)',
            whiteSpace: 'nowrap',
            minWidth: '3.5rem',
            paddingTop: '0.125rem',
          }}
        >
          {cita.horaInicio.slice(0, 5)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '0.875rem',
              fontWeight: 500,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {cita.cliente.nombre}
          </div>
          <div
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '0.75rem',
              color: 'var(--text-dim)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {cita.servicios.map((s) => s.nombre).join(', ')}
          </div>
        </div>
      </div>
      <Badge variant={cfg.variant}>{cfg.label}</Badge>
    </motion.div>
  );
};

interface QuickActionCardProps {
  icon: string;
  title: string;
  subtitle: string;
  href: string;
  navigate: (path: string) => void;
}

const QuickActionCard: React.FC<QuickActionCardProps> = ({
  icon,
  title,
  subtitle,
  href,
  navigate: nav,
}) => (
  <motion.button
    style={quickActionStyle}
    whileHover={{
      y: -2,
      borderColor: 'var(--border-glow)',
      boxShadow: 'var(--shadow-md), var(--shadow-glow)',
    }}
    whileTap={{ scale: 0.98 }}
    onClick={() => nav(href)}
  >
    <span style={quickActionIconStyle}>{icon}</span>
    <div>
      <div
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '0.875rem',
          fontWeight: 600,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
        }}
      >
        {subtitle}
      </div>
    </div>
  </motion.button>
);

/* ── Main Component ── */

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();

  /* Auth state */
  const [user, setUser] = useState<IUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const salonId = useMemo(() => {
    if (!user) return null;
    const stored = localStorage.getItem('xSalonId');
    return stored ? Number(stored) : user.salonId;
  }, [user]);

  /* Dashboard data state */
  const [resumen, setResumen] = useState<FinanzasResumen | null>(null);
  const [citas, setCitas] = useState<CitaDashboard[]>([]);
  const [clientes, setClientes] = useState<ClienteSimple[]>([]);
  const [empleadas, setEmpleadas] = useState<EmpleadaSimple[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  /* ── Auth effect ── */
  useEffect(() => {
    api
      .get('/auth/me')
      .then(({ data }) => setUser(data))
      .catch(() => navigate('/login'))
      .finally(() => setAuthLoading(false));
  }, [navigate]);

  /* ── Dashboard data fetch ── */
  const fetchDashboardData = useCallback(async () => {
    setDataLoading(true);
    setDataError(null);

    const today = new Date();
    const todayStr = toISODate(today);
    const monday = getMonday(today);
    const weekDays = getWeekDays(monday);
    const weekDesde = toISODate(weekDays[0]);
    const weekHasta = toISODate(weekDays[5]);

    try {
      if (salonId == null) {
        setDataError('Error al cargar datos del dashboard');
        return;
      }

      const results = await Promise.allSettled([
        api.get(`/salones/${salonId}/finanzas/resumen`, { params: { fecha: todayStr } }),
        api.get(`/salones/${salonId}/agenda/citas`, { params: { desde: weekDesde, hasta: weekHasta } }),
        api.get(`/salones/${salonId}/clientes`),
        api.get(`/salones/${salonId}/empleadas`),
      ]);

      const [resumenRes, citasRes, clientesRes, empleadasRes] = results;

      // Resumen
      if (resumenRes.status === 'fulfilled') {
        setResumen(resumenRes.value.data);
      } else {
        setResumen(null);
      }

      // Citas (for the whole week — we filter for today and chart)
      if (citasRes.status === 'fulfilled') {
        const raw = citasRes.value.data;
        setCitas(Array.isArray(raw) ? raw : []);
      } else {
        setCitas([]);
      }

      // Clientes
      if (clientesRes.status === 'fulfilled') {
        const raw = clientesRes.value.data;
        setClientes(Array.isArray(raw) ? raw : []);
      } else {
        setClientes([]);
      }

      // Empleadas
      if (empleadasRes.status === 'fulfilled') {
        const raw = empleadasRes.value.data;
        setEmpleadas(Array.isArray(raw) ? raw : []);
      } else {
        setEmpleadas([]);
      }

      // Error state: only if ALL requests failed
      const allFailed = results.every((r) => r.status === 'rejected');
      if (allFailed) {
        setDataError('Error al cargar datos del dashboard');
      }
    } catch {
      setDataError('Error al cargar datos del dashboard');
    } finally {
      setDataLoading(false);
    }
  }, [salonId]);

  useEffect(() => {
    if (!authLoading && user && salonId) {
      fetchDashboardData();
    }
  }, [authLoading, user, salonId, fetchDashboardData]);

  /* ── Handlers ── */
  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    navigate('/login');
  };

  /* ── Derived values ── */

  const isLoading = authLoading || dataLoading;

  const todayStr = useMemo(() => toISODate(new Date()), []);

  const todayCitas = useMemo(
    () =>
      citas
        .filter((c) => c.fecha === todayStr && c.estado !== 'CANCELADA')
        .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)),
    [citas, todayStr],
  );

  const activeEmpleadas = useMemo(
    () => empleadas.filter((e) => e.activo).length,
    [empleadas],
  );

  const newClientsThisMonth = useMemo(
    () =>
      clientes.filter((c) => {
        if (!c.createdAt) return false;
        const d = new Date(c.createdAt);
        return isCurrentMonth(d);
      }).length,
    [clientes],
  );

  const weekDays = useMemo(() => getWeekDays(getMonday(new Date())), []);

  const chartData = useMemo(
    () =>
      weekDays.map((day, i) => {
        const dayStr = toISODate(day);
        const count = citas.filter((c) => c.fecha === dayStr).length;
        return { day: DAY_LABELS[i], citas: count };
      }),
    [citas, weekDays],
  );

  const isSalonEmpty = useMemo(() => {
    const noIngresos = !resumen || resumen.totalIngresos === 0;
    const noClientes = clientes.length === 0;
    const noEmpleadas = empleadas.length === 0;
    return noIngresos && noClientes && noEmpleadas;
  }, [resumen, clientes, empleadas]);

  /* ── Animation variants (kept from original) ── */

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 24 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: [0.22, 0.61, 0.36, 1] as const },
    },
  };

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */

  return (
    <Layout
      sidebarItems={sidebarItems}
      onLogout={handleLogout}
      title="Dashboard"
      userName={user?.nombre}
    >
      <AnimatePresence mode="wait">
        {/* ── Loading skeleton ── */}
        {isLoading ? (
          <motion.div
            key="skeleton"
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '1rem',
                marginBottom: '1.5rem',
              }}
            >
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} height="120px" variant="rect" />
              ))}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem',
              }}
            >
              <Skeleton height="200px" variant="rect" />
              <Skeleton height="200px" variant="rect" />
            </div>
          </motion.div>
        ) : dataError ? (
          /* ── Error state ── */
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4rem 2rem',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</span>
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '0.9375rem',
                color: 'var(--text-secondary)',
                marginBottom: '0.5rem',
              }}
            >
              {dataError}
            </p>
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '0.8125rem',
                color: 'var(--text-dim)',
                marginBottom: '1.5rem',
              }}
            >
              Verificá tu conexión e intentá de nuevo.
            </p>
            <motion.button
              style={errorBtnStyle}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={fetchDashboardData}
            >
              Reintentar
            </motion.button>
          </motion.div>
        ) : isSalonEmpty ? (
          /* ── Empty salon state ── */
          <motion.div
            key="empty"
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
            }}
          >
            <span style={{ fontSize: '3rem', marginBottom: '1rem' }}>✨</span>
            <h2
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: '1.5rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '0.5rem',
              }}
            >
              Tu salón está listo
            </h2>
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                maxWidth: '360px',
                marginBottom: '1.5rem',
                lineHeight: 1.6,
              }}
            >
              Comenzá agregando tus servicios, empleadas y la primera cita. El
              dashboard mostrará las métricas automáticamente.
            </p>
            <motion.button
              style={errorBtnStyle}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/agenda')}
            >
              Ir a Agenda
            </motion.button>
          </motion.div>
        ) : (
          /* ── Content: real dashboard ── */
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            {/* SalonSwitcher — only for superadmin */}
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

            {/* ── Stats cards ── */}
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
              <motion.div variants={itemVariants}>
                <StatsCard
                  icon="💰"
                  value={resumen ? formatCurrency(resumen.totalIngresos) : '$0'}
                  label="Ingresos"
                  trend={
                    resumen && resumen.cantidadAtenciones > 0
                      ? { value: 100, positive: true }
                      : undefined
                  }
                />
              </motion.div>
              <motion.div variants={itemVariants}>
                <StatsCard
                  icon="✂️"
                  value={resumen?.cantidadAtenciones ?? 0}
                  label="Atenciones hoy"
                />
              </motion.div>
              <motion.div variants={itemVariants}>
                <StatsCard
                  icon="👥"
                  value={clientes.length}
                  label="Clientes"
                  trend={
                    newClientsThisMonth > 0
                      ? { value: newClientsThisMonth, positive: true }
                      : undefined
                  }
                />
              </motion.div>
              <motion.div variants={itemVariants}>
                <StatsCard
                  icon="💇"
                  value={activeEmpleadas}
                  label="Empleadas activas"
                />
              </motion.div>
            </motion.div>

            {/* ── Two-column grid ── */}
            <motion.div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem',
                marginBottom: '1.5rem',
              }}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              {/* Left: Today's appointments */}
              <Card hoverable>
                <Card.Header>Próximas citas hoy</Card.Header>
                <Card.Body style={{ padding: '0.5rem 1.25rem' }}>
                  {todayCitas.length === 0 ? (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        padding: '1.5rem 0',
                        textAlign: 'center',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '2rem',
                          marginBottom: '0.5rem',
                          opacity: 0.5,
                        }}
                      >
                        📅
                      </span>
                      <p
                        style={{
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: '0.8125rem',
                          color: 'var(--text-dim)',
                          marginBottom: '0.75rem',
                        }}
                      >
                        No hay citas para hoy
                      </p>
                      <motion.button
                        style={primaryBtnStyle}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => navigate('/agenda')}
                      >
                        Crear una cita
                      </motion.button>
                    </div>
                  ) : (
                    <>
                      {todayCitas.map((cita, i) => (
                        <CitaRow
                          key={cita.id}
                          cita={cita}
                          isLast={i === todayCitas.length - 1}
                        />
                      ))}
                      <motion.div
                        style={{
                          marginTop: '0.75rem',
                          textAlign: 'center',
                          paddingTop: '0.5rem',
                          borderTop: '1px solid var(--border)',
                        }}
                        whileHover={{ x: 4 }}
                        transition={{ duration: 0.2 }}
                      >
                        <a
                          href="/agenda"
                          onClick={(e) => {
                            e.preventDefault();
                            navigate('/agenda');
                          }}
                          style={{
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: '0.8125rem',
                            color: 'var(--accent)',
                            textDecoration: 'none',
                            fontWeight: 500,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                          }}
                        >
                          Ver agenda completa →
                        </a>
                      </motion.div>
                    </>
                  )}
                </Card.Body>
              </Card>

              {/* Right: Weekly Activity Chart */}
              <Card hoverable>
                <Card.Header>Actividad semanal</Card.Header>
                <Card.Body>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={chartData}
                      margin={{ top: 8, right: 4, bottom: 0, left: -12 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="day"
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fill: 'var(--text-secondary)',
                          fontSize: 12,
                          fontFamily: "'DM Sans', sans-serif",
                        }}
                      />
                      <YAxis
                        allowDecimals={false}
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fill: 'var(--text-secondary)',
                          fontSize: 12,
                          fontFamily: "'DM Sans', sans-serif",
                        }}
                      />
                      <Tooltip
                        content={<ChartTooltipContent />}
                        cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                      />
                      <Bar
                        dataKey="citas"
                        fill="var(--accent)"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={36}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                  {chartData.every((d) => d.citas === 0) && (
                    <p
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '0.75rem',
                        color: 'var(--text-dim)',
                        textAlign: 'center',
                        marginTop: '0.5rem',
                      }}
                    >
                      Conectá el módulo de finanzas para ver ingresos
                    </p>
                  )}
                </Card.Body>
              </Card>
            </motion.div>

            {/* ── Quick Actions ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.4, delay: 0.15 }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '0.75rem',
                }}
              >
                {QUICK_ACTIONS.map((action) => (
                  <QuickActionCard
                    key={action.href}
                    icon={action.icon}
                    title={action.title}
                    subtitle={action.subtitle}
                    href={action.href}
                    navigate={navigate}
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
};

export default DashboardPage;
