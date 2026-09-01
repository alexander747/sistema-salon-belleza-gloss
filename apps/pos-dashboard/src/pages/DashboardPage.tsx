import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Skeleton,
  Button,
  Avatar,
  Chip,
  Divider,
} from '@mui/material';
import {
  TrendingUp,
  CalendarMonth,
  Group,
  Badge as BadgeIcon,
  ChevronRight,
  Refresh,
  ArrowForward,
} from '@mui/icons-material';
import { Rol, type IUser } from '@pos-final/types';
import api from '../services/api.js';
import SalonSwitcher from '../components/SalonSwitcher.js';
import { formatCurrency } from '../utils/format.js';

/* ── Types ── */

interface FinanzasResumen {
  totalServicios: number;
  totalProductos: number;
  totalPropinas: number;
  totalComisiones: number;
  cantidadAtenciones: number;
  totalIngresos: number;
  totalGastos?: number;
  balanceNeto?: number;
}

interface CitaDashboard {
  id: number;
  clienteId: number;
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

interface MensualItem {
  mes: string;
  ingresos: number;
  gastos: number;
  nomina: number;
  ganancia: number;
}

/* ── Constants ── */

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const STATUS_CFG: Record<string, { color: 'warning' | 'info' | 'success' | 'error'; label: string }> = {
  PENDIENTE: { color: 'warning', label: 'Pendiente' },
  CONFIRMADA: { color: 'info', label: 'Confirmada' },
  EN_PROGRESO: { color: 'info', label: 'En curso' },
  COMPLETADA: { color: 'success', label: 'Completada' },
  CANCELADA: { color: 'error', label: 'Cancelada' },
};

const QUICK_ACTIONS = [
  { icon: '📅', title: 'Nueva cita', subtitle: 'Agendar', href: '/agenda' },
  { icon: '👤', title: 'Clientes', subtitle: 'Gestionar', href: '/clientes' },
  { icon: '💅', title: 'Servicios', subtitle: 'Catálogo', href: '/servicios' },
];

/* ── Helpers ── */

/** Fecha de HOY en Colombia (UTC-5) como 'YYYY-MM-DD'. */
function colombiaNow(): string {
  const d = new Date(Date.now() - 5 * 3_600_000);
  return toISODate(d);
}

/** Fecha (UTC) de un Date, como 'YYYY-MM-DD'. Los helpers de semana ya corrigen
 *  la entrada a Colombia; las fechas del backend vienen como instantes UTC. */
function toISODate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getMonday(d: Date): Date {
  // Trabajar con la fecha Colombia (restar 5h) para que el lunes corresponda
  // al día de negocio real, no al UTC (que se adelanta antes de medianoche).
  const fechaCol = new Date(d.getTime() - 5 * 3_600_000);
  const day = fechaCol.getUTCDay();
  const diff = fechaCol.getUTCDate() - day + (day === 0 ? -6 : 1);
  fechaCol.setUTCDate(diff);
  fechaCol.setUTCHours(0, 0, 0, 0);
  return fechaCol;
}

function getWeekDays(monday: Date): Date[] {
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    return d;
  });
}

function isCurrentMonth(d: Date): boolean {
  const now = new Date(Date.now() - 5 * 3_600_000); // mes en Colombia
  return d.getUTCMonth() === now.getUTCMonth() && d.getUTCFullYear() === now.getUTCFullYear();
}

/** '2026-08' → 'Ago' (mes corto en español). */
function mesLabel(mes: string): string {
  const m = Number(mes.slice(5, 7));
  return m >= 1 && m <= 12 ? MESES_CORTOS[m - 1] : mes;
}

/** Monto compacto para los ejes (2.3M / 350k). */
function formatCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

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
    <Box
      sx={{
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        px: 1.5,
        py: 1,
        boxShadow: 4,
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
        {val} {val === 1 ? 'cita' : 'citas'}
      </Typography>
    </Box>
  );
};

/** Tooltip de las gráficas mensuales: formatea cada serie como moneda. */
const MoneyTooltipContent: React.FC<ChartTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        px: 1.5,
        py: 1,
        boxShadow: 4,
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
        {label}
      </Typography>
      {payload.map((item) => (
        <Typography key={item.name} variant="body2" sx={{ fontWeight: 600, color: item.color }}>
          {item.name}: {formatCurrency(item.value)}
        </Typography>
      ))}
    </Box>
  );
};

/* ── Sub-components ── */

interface CitaRowProps {
  cita: CitaDashboard;
  isLast: boolean;
  clientesMap: Record<number, string>;
}

const CitaRow: React.FC<CitaRowProps> = ({ cita, isLast, clientesMap }) => {
  const cfg = STATUS_CFG[cita.estado] ?? STATUS_CFG.PENDIENTE;
  const displayName = clientesMap[cita.clienteId] ?? `Cliente #${cita.clienteId}`;
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        py: 1.25,
        borderBottom: isLast ? 'none' : '1px solid',
        borderColor: 'divider',
        gap: 1.5,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}>
        <Typography
          variant="caption"
          color="primary.main"
          sx={{ whiteSpace: 'nowrap', minWidth: 56, fontWeight: 600 }}
        >
          {cita.horaInicio.slice(0, 5)}
        </Typography>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
            {displayName}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {cita.servicios.map((s) => s.nombre).join(', ')}
          </Typography>
        </Box>
      </Box>
      <Chip
        label={cfg.label}
        color={cfg.color}
        size="small"
        variant="outlined"
        sx={{ borderRadius: 1, fontSize: '0.6875rem' }}
      />
    </Box>
  );
};

/* ── KPI Card ── */

interface KpiCardProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  trend?: { value: number; positive: boolean };
}

const KpiCard: React.FC<KpiCardProps> = ({ icon, value, label, trend }) => (
  <Card
    sx={{
      borderRadius: 3,
      bgcolor: 'background.paper',
      border: '1px solid',
      borderColor: 'divider',
      transition: 'transform 0.2s, box-shadow 0.2s',
      '&:hover': { transform: 'translateY(-2px)', boxShadow: 6 },
    }}
  >
    <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.25 }}>
            {value}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
        </Box>
        <Avatar
          sx={{
            bgcolor: 'rgba(212, 168, 83, 0.12)',
            color: 'primary.main',
            width: 44,
            height: 44,
          }}
        >
          {icon}
        </Avatar>
      </Box>
      {trend && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
          <TrendingUp
            sx={{
              fontSize: 14,
              color: trend.positive ? 'success.main' : 'error.main',
              transform: trend.positive ? 'none' : 'rotate(180deg)',
            }}
          />
          <Typography
            variant="caption"
            color={trend.positive ? 'success.main' : 'error.main'}
            sx={{ fontWeight: 600 }}
          >
            {trend.positive ? '+' : ''}
            {trend.value}%
          </Typography>
          <Typography variant="caption" color="text.secondary">
            vs mes anterior
          </Typography>
        </Box>
      )}
    </CardContent>
  </Card>
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
  const [mensualData, setMensualData] = useState<MensualItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const clientesMapRef = useRef<Record<number, string>>({});

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
    const monday = getMonday(today);
    const weekDays = getWeekDays(monday);
    const weekDesde = new Date(`${toISODate(weekDays[0])}T00:00:00`).toISOString();
    const weekHasta = new Date(`${toISODate(weekDays[5])}T23:59:59.999`).toISOString();

    // Resumen del MES ACTUAL en Colombia (1° del mes → hoy): sin rango el backend
    // usa solo el día de hoy y el dashboard mostraría $0 fuera de la fecha actual.
    const hoyColombia = colombiaNow();
    const mesDesde = `${hoyColombia.slice(0, 8)}01`;

    try {
      if (salonId == null) {
        setDataError('Error al cargar datos del dashboard');
        return;
      }

      const results = await Promise.allSettled([
        api.get(`/salones/${salonId}/finanzas/resumen`, {
          params: { desde: mesDesde, hasta: hoyColombia },
        }),
        api.get(`/salones/${salonId}/agenda/citas`, { params: { desde: weekDesde, hasta: weekHasta } }),
        api.get(`/salones/${salonId}/clientes`),
        api.get(`/salones/${salonId}/empleadas`),
        api.get(`/salones/${salonId}/finanzas/mensual`, { params: { meses: 6 } }),
      ]);

      const [resumenRes, citasRes, clientesRes, empleadasRes, mensualRes] = results;

      if (resumenRes.status === 'fulfilled') {
        setResumen(resumenRes.value.data);
      } else {
        setResumen(null);
      }

      if (mensualRes.status === 'fulfilled') {
        const raw = mensualRes.value.data;
        setMensualData(Array.isArray(raw) ? raw : []);
      } else {
        setMensualData([]);
      }

      if (clientesRes.status === 'fulfilled') {
        const raw = clientesRes.value.data;
        const list = Array.isArray(raw) ? raw : raw?.data ?? [];
        const arr = Array.isArray(list) ? list : [];
        setClientes(arr);
        clientesMapRef.current = Object.fromEntries(arr.map((c: any) => [c.id, c.nombre]));
      } else {
        setClientes([]);
        clientesMapRef.current = {};
      }

      if (citasRes.status === 'fulfilled') {
        const raw = citasRes.value.data;
        const list = Array.isArray(raw) ? raw : raw?.data ?? [];
        // Transform API response: fechaHora → fecha + horaInicio + horaFin
        setCitas((Array.isArray(list) ? list : []).map((c: any) => {
          const fh = c.fechaHora ? new Date(c.fechaHora) : null;
          const duracion = c.duracionTotalMinutos ?? 60;
          return {
            ...c,
            fecha: fh ? toISODate(fh) : '',
            horaInicio: fh ? `${String(fh.getUTCHours()).padStart(2, '0')}:${String(fh.getUTCMinutes()).padStart(2, '0')}` : '',
            horaFin: fh ? new Date(fh.getTime() + duracion * 60000).toISOString() : '',
            cliente: c.cliente ?? { id: c.clienteId, nombre: clientesMapRef.current[c.clienteId] ?? `Cliente #${c.clienteId}` },
          };
        }));
      } else {
        setCitas([]);
      }

      if (empleadasRes.status === 'fulfilled') {
        const raw = empleadasRes.value.data;
        const list = Array.isArray(raw) ? raw : raw?.data ?? [];
        setEmpleadas(Array.isArray(list) ? list : []);
      } else {
        setEmpleadas([]);
      }

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

  /* ── Derived values ── */

  const isLoading = authLoading || dataLoading;

  const todayStr = useMemo(() => colombiaNow(), []);

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
        const count = citas.filter((c) => c.fecha === dayStr && c.estado !== 'CANCELADA').length;
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

  /** Último mes de la serie CON DATOS (ingresos/gastos/nómina no todos 0).
   *  El pastel muestra ese mes; si el mes más reciente (ej. el actual) está
   *  vacío, se usa el último que tenga movimiento. */
  const ultimoMes = useMemo(
    () =>
      mensualData.length > 0
        ? [...mensualData]
            .reverse()
            .find((m) => m.ingresos !== 0 || m.gastos !== 0 || m.nomina !== 0) ??
          mensualData[mensualData.length - 1]
        : null,
    [mensualData],
  );

  /** Pastel: ingresos vs gastos vs nómina del último mes. null si todo es 0. */
  const pieData = useMemo(() => {
    if (!ultimoMes) return null;
    const { ingresos, gastos, nomina } = ultimoMes;
    if (ingresos === 0 && gastos === 0 && nomina === 0) return null;
    return [
      { name: 'Ingresos', value: ingresos, color: '#D4A853' },
      { name: 'Gastos', value: gastos, color: '#ef4444' },
      { name: 'Nómina', value: nomina, color: '#3b82f6' },
    ];
  }, [ultimoMes]);

  const clientesMap = useMemo(
    () => Object.fromEntries(clientes.map((c) => [c.id, c.nombre])),
    [clientes],
  );

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */

  /* ── Loading skeleton ── */
  if (isLoading) {
    return (
      <Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 3 }}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="rounded" height={120} sx={{ borderRadius: 3 }} />
          ))}
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Skeleton variant="rounded" height={260} sx={{ borderRadius: 3 }} />
          <Skeleton variant="rounded" height={260} sx={{ borderRadius: 3 }} />
        </Box>
      </Box>
    );
  }

  /* ── Error state ── */
  if (dataError) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          py: 8,
          textAlign: 'center',
        }}
      >
        <Typography variant="h1" sx={{ fontSize: '3rem', mb: 2 }}>
          ⚠️
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
          {dataError}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Verificá tu conexión e intentá de nuevo.
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<Refresh />}
          onClick={fetchDashboardData}
        >
          Reintentar
        </Button>
      </Box>
    );
  }

  /* ── Empty salon state ── */
  if (isSalonEmpty) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          py: 8,
          textAlign: 'center',
        }}
      >
        <Typography variant="h1" sx={{ fontSize: '3rem', mb: 2 }}>
          ✨
        </Typography>
        <Typography
          variant="h4"
          sx={{ fontWeight: 600, fontFamily: '"Playfair Display", serif', mb: 1 }}
        >
          Tu salón está listo
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ maxWidth: 360, mb: 3, lineHeight: 1.6 }}
        >
          Comenzá agregando tus servicios, empleadas y la primera cita. El dashboard mostrará las
          métricas automáticamente.
        </Typography>
        <Button
          variant="contained"
          color="primary"
          endIcon={<ArrowForward />}
          onClick={() => navigate('/agenda')}
        >
          Ir a Agenda
        </Button>
      </Box>
    );
  }

  /* ── Content: real dashboard ── */
  return (
    <Box>
      {/* SalonSwitcher — only for superadmin */}
      {user?.rol === Rol.SUPERADMIN && (
        <Box sx={{ mb: 2 }}>
          <SalonSwitcher userSalonId={user!.salonId} />
        </Box>
      )}

      {/* ── KPI Cards ── */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 2,
          mb: 3,
        }}
      >
        <KpiCard
          icon={<TrendingUp sx={{ fontSize: 20 }} />}
          value={resumen ? formatCurrency(resumen.totalIngresos) : '$0'}
          label="TOTAL INGRESOS"
          trend={
            resumen && resumen.cantidadAtenciones > 0
              ? { value: 12.5, positive: true }
              : undefined
          }
        />
        <KpiCard
          icon={<CalendarMonth sx={{ fontSize: 20 }} />}
          value={todayCitas.length}
          label="Citas hoy"
          trend={
            todayCitas.length > 0
              ? { value: todayCitas.length, positive: true }
              : undefined
          }
        />
        <KpiCard
          icon={<Group sx={{ fontSize: 20 }} />}
          value={clientes.length}
          label="Clientes"
          trend={
            newClientsThisMonth > 0
              ? { value: newClientsThisMonth, positive: true }
              : undefined
          }
        />
        <KpiCard
          icon={<BadgeIcon sx={{ fontSize: 20 }} />}
          value={activeEmpleadas}
          label="Empleadas activas"
        />
      </Box>

      {/* ── Two-column grid ── */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
          gap: 2,
          mb: 3,
        }}
      >
        {/* Left: Today's appointments */}
        <Card
          sx={{
            borderRadius: 3,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
            <Typography variant="h4" sx={{ fontWeight: 600, mb: 1.5 }}>
              Próximas citas hoy
            </Typography>

            {todayCitas.length === 0 ? (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  py: 3,
                  textAlign: 'center',
                }}
              >
                <Typography variant="h1" sx={{ fontSize: '2rem', mb: 1, opacity: 0.5 }}>
                  📅
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  No hay citas para hoy
                </Typography>
                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  onClick={() => navigate('/agenda')}
                >
                  Crear una cita
                </Button>
              </Box>
            ) : (
              <>
                {todayCitas.map((cita, i) => (
                  <CitaRow key={cita.id} cita={cita} isLast={i === todayCitas.length - 1} clientesMap={clientesMap} />
                ))}
                <Divider sx={{ my: 1.5 }} />
                <Button
                  variant="text"
                  color="primary"
                  size="small"
                  endIcon={<ChevronRight />}
                  onClick={() => navigate('/agenda')}
                  sx={{ width: '100%' }}
                >
                  Ver agenda completa
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Right: Weekly Activity Chart */}
        <Card
          sx={{
            borderRadius: 3,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
            <Typography variant="h4" sx={{ fontWeight: 600, mb: 2 }}>
              Actividad semanal
            </Typography>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 4, bottom: 0, left: -12 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.06)"
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#9E9E9E', fontSize: 12 }}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#9E9E9E', fontSize: 12 }}
                />
                <Tooltip
                  content={<ChartTooltipContent />}
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                />
                <Bar
                  dataKey="citas"
                  fill="#D4A853"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                />
              </BarChart>
            </ResponsiveContainer>
            {chartData.every((d) => d.citas === 0) && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
                No hay citas esta semana
              </Typography>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* ── Resumen mensual (gráficas de 6 meses) ── */}
      <Card
        sx={{
          borderRadius: 3,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          mb: 3,
        }}
      >
        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 2 }}>
            📈 Resumen de los últimos 6 meses
          </Typography>
          {mensualData.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No hay datos mensuales todavía.
            </Typography>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: 'repeat(3, 1fr)' },
                gap: 2,
              }}
            >
              {/* Línea: ingresos y ganancia por mes */}
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  Ingresos y ganancia por mes
                </Typography>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={mensualData} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis
                      dataKey="mes"
                      tickFormatter={mesLabel}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#9E9E9E', fontSize: 11 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#9E9E9E', fontSize: 11 }}
                      tickFormatter={formatCompact}
                    />
                    <Tooltip content={<MoneyTooltipContent />} cursor={{ stroke: 'rgba(255,255,255,0.15)' }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      type="monotone"
                      dataKey="ingresos"
                      name="Ingresos"
                      stroke="#D4A853"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#D4A853' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="ganancia"
                      name="Ganancia"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#22c55e' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>

              {/* Barras: ingresos por mes */}
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  Ingresos por mes
                </Typography>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={mensualData} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis
                      dataKey="mes"
                      tickFormatter={mesLabel}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#9E9E9E', fontSize: 11 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#9E9E9E', fontSize: 11 }}
                      tickFormatter={formatCompact}
                    />
                    <Tooltip content={<MoneyTooltipContent />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                    <Bar dataKey="ingresos" name="Ingresos" fill="#D4A853" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>

              {/* Pastel: distribución del último mes */}
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  Distribución del mes{ultimoMes ? `: ${mesLabel(ultimoMes.mes)}` : ''}
                </Typography>
                {pieData ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={45}
                        outerRadius={80}
                        paddingAngle={2}
                      >
                        {pieData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<MoneyTooltipContent />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: 220,
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      Sin datos para este mes
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* ── Quick Actions ── */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 1.5,
        }}
      >
        {QUICK_ACTIONS.map((action) => (
          <Card
            key={action.href}
            onClick={() => navigate(action.href)}
            sx={{
              borderRadius: 3,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: 4,
                borderColor: 'rgba(212, 168, 83, 0.3)',
              },
            }}
          >
            <CardContent
              sx={{
                p: 2,
                '&:last-child': { pb: 2 },
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
              }}
            >
              <Avatar
                sx={{
                  bgcolor: 'rgba(212, 168, 83, 0.1)',
                  color: 'primary.main',
                  width: 40,
                  height: 40,
                  fontSize: '1.25rem',
                }}
              >
                {action.icon}
              </Avatar>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {action.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {action.subtitle}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  );
};

export default DashboardPage;
