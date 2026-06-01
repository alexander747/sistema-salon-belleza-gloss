import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Skeleton, Button } from '@pos-final/ui';
import { Rol, type IUser } from '@pos-final/types';
import api from '../services/api.js';
import SalonSwitcher from '../components/SalonSwitcher.js';
import styles from './AgendaPage.module.css';

/* ── Types ── */

type CitaEstado =
  | 'PENDIENTE'
  | 'CONFIRMADA'
  | 'EN_PROGRESO'
  | 'COMPLETADA'
  | 'CANCELADA';

interface Cita {
  id: number;
  cliente: { id: number; nombre: string };
  servicios: Array<{
    id: number;
    nombre: string;
    duracionMinutos: number;
    precio: number;
  }>;
  empleada: { id: number; nombre: string };
  salonId: number;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  estado: CitaEstado;
  notas?: string;
  motivoCancelacion?: string;
  precioTotal: number;
  duracionTotal: number;
  creadoEn: string;
}

interface EmpleadaSimple {
  id: number;
  nombre: string;
}

interface ServicioSimple {
  id: number;
  nombre: string;
  duracionMinutos: number;
  precioBase: number;
  activo?: boolean;
}

interface ClienteSimple {
  id: number;
  nombre: string;
  telefono?: string;
}

/* ── Constants ── */

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTH_LABELS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const START_HOUR = 8;   // 08:00
const END_HOUR = 20;    // 20:00
const TOTAL_HOURS = END_HOUR - START_HOUR;
const HOUR_HEIGHT = 72; // px per hour row
const HEADER_HEIGHT = 50;
const MIN_COL_WIDTH = 140;
const TIME_COL_WIDTH = 56;
const CALENDAR_HEIGHT = TOTAL_HOURS * HOUR_HEIGHT;

const STATUS_CFG: Record<
  CitaEstado,
  { bg: string; border: string; dot: string; label: string }
> = {
  PENDIENTE: {
    bg: 'rgba(212,168,83,0.12)',
    border: 'var(--warning)',
    dot: 'var(--warning)',
    label: 'Pendiente',
  },
  CONFIRMADA: {
    bg: 'rgba(212,168,83,0.18)',
    border: 'var(--accent)',
    dot: 'var(--accent)',
    label: 'Confirmada',
  },
  EN_PROGRESO: {
    bg: 'rgba(70,130,220,0.14)',
    border: '#5b8def',
    dot: '#5b8def',
    label: 'En curso',
  },
  COMPLETADA: {
    bg: 'rgba(92,186,123,0.14)',
    border: 'var(--success)',
    dot: 'var(--success)',
    label: 'Completada',
  },
  CANCELADA: {
    bg: 'rgba(224,85,106,0.08)',
    border: 'var(--danger)',
    dot: 'var(--danger)',
    label: 'Cancelada',
  },
};



/* ── Helpers ── */

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay(); // 0=Sun
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getWeekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatWeekRange(days: Date[]): string {
  const a = days[0];
  const b = days[6];
  const sameMonth = a.getMonth() === b.getMonth();
  const month = MONTH_LABELS[a.getMonth()];
  const year = a.getFullYear();
  if (sameMonth) return `${a.getDate()} - ${b.getDate()} ${month} ${year}`;
  return `${a.getDate()} ${MONTH_LABELS[a.getMonth()]} - ${b.getDate()} ${MONTH_LABELS[b.getMonth()]} ${year}`;
}

function calcTop(horaInicio: string): number {
  const [h, m] = horaInicio.split(':').map(Number);
  const startMin = (h * 60 + m) - (START_HOUR * 60);
  return (startMin / 60) * HOUR_HEIGHT;
}

function calcHeight(minutes: number): number {
  return Math.max((minutes / 60) * HOUR_HEIGHT, 20);
}

/**
 * Count the maximum number of overlapping appointments in a group.
 * Used to determine how many columns are needed to display them side by side.
 */
function countMaxOverlap(citas: Cita[]): number {
  if (citas.length <= 1) return 1;
  let max = 1;
  for (let i = 0; i < citas.length; i++) {
    const [ih, im] = citas[i].horaInicio.split(':').map(Number);
    const istart = ih * 60 + im;
    const [ieh, iem] = citas[i].horaFin.split(':').map(Number);
    const iend = ieh * 60 + iem;
    let count = 1;
    for (let j = i + 1; j < citas.length; j++) {
      const [jh, jm] = citas[j].horaInicio.split(':').map(Number);
      const jstart = jh * 60 + jm;
      if (jstart < iend) count++;
    }
    max = Math.max(max, count);
  }
  return max;
}

function formatCurrency(n: number | null | undefined): string {
  if (n == null) return '$0';
  return `$${n.toLocaleString('es-CL')}`;
}

/* ── Component ── */

const AgendaPage: React.FC = () => {
  const navigate = useNavigate();

  /* ── Auth state ── */
  const [user, setUser] = useState<IUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  /* ── Data state ── */
  const [citas, setCitas] = useState<Cita[]>([]);
  const [citasLoading, setCitasLoading] = useState(true);
  const [citasError, setCitasError] = useState<string | null>(null);
  const [empleadas, setEmpleadas] = useState<EmpleadaSimple[]>([]);
  const [servicios, setServicios] = useState<ServicioSimple[]>([]);
  const [clientes, setClientes] = useState<ClienteSimple[]>([]);
  const [refDataLoading, setRefDataLoading] = useState(true);

  /* ── Calendar state ── */
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [filterEmpleadaId, setFilterEmpleadaId] = useState<number | null>(null);

  /* ── Create modal state ── */
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    clienteId: 0,
    serviciosIds: [] as number[],
    empleadaId: 0,
    fecha: '',
    horaInicio: '',
    notas: '',
  });
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [clienteSearch, setClienteSearch] = useState('');
  const [servicioSearch, setServicioSearch] = useState('');

  /* ── Detail modal state ── */
  const [selectedCita, setSelectedCita] = useState<Cita | null>(null);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelMotivo, setCancelMotivo] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  /* ── Completar modal state ── */
  const [showCompletar, setShowCompletar] = useState(false);
  const [completarForm, setCompletarForm] = useState({
    serviciosPrecios: {} as Record<number, number>,
    nuevosServiciosIds: [] as number[],
    totalProductos: 0,
    propina: 0,
    metodoPago: 'EFECTIVO' as 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA',
    aplicarDescuento: false,
    descuento: 0,
    motivoDescuento: '',
  });
  const [completando, setCompletando] = useState(false);

  /* ── Derived ── */

  const salonId = useMemo(() => {
    if (!user) return null;
    const stored = localStorage.getItem('xSalonId');
    return stored ? Number(stored) : user.salonId;
  }, [user]);

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);

  const todayStr = useMemo(() => toISODate(new Date()), []);

  const filteredCitas = useMemo(() => {
    if (!filterEmpleadaId) return citas;
    return citas.filter((c) => c.empleada.id === filterEmpleadaId);
  }, [citas, filterEmpleadaId]);

  const citasByDay = useMemo(() => {
    const map = new Map<string, Cita[]>();
    for (const c of filteredCitas) {
      const existing = map.get(c.fecha) ?? [];
      existing.push(c);
      map.set(c.fecha, existing);
    }
    return map;
  }, [filteredCitas]);

  const daysWithCitas = useMemo(
    () => weekDays.map((d) => ({ date: d, citas: citasByDay.get(toISODate(d)) ?? [] })),
    [weekDays, citasByDay],
  );

  const weekRangeStr = useMemo(() => formatWeekRange(weekDays), [weekDays]);

  /* ── Auth effect ── */
  useEffect(() => {
    api
      .get('/auth/me')
      .then(({ data }) => setUser(data))
      .catch(() => navigate('/login'))
      .finally(() => setAuthLoading(false));
  }, [navigate]);

  /* ── Fetch citas ── */
  const fetchCitas = useCallback(async () => {
    if (salonId == null) return;
    setCitasLoading(true);
    setCitasError(null);
    try {
      const desde = toISODate(weekStart);
      const hasta = toISODate(weekDays[6]);
      const { data } = await api.get(`/salones/${salonId}/agenda/citas`, {
        params: { desde, hasta },
      });
      const raw = Array.isArray(data) ? data : [];
      // Transform API response (CitaDTO) to frontend Cita format
      const transformed: Cita[] = raw.map((item: any) => {
        const fechaHora = new Date(item.fechaHora);
        const fecha = toISODate(fechaHora);
        const horaInicio = `${String(fechaHora.getHours()).padStart(2, '0')}:${String(fechaHora.getMinutes()).padStart(2, '0')}`;
        const duracionTotal = item.duracionTotalMinutos ?? 0;
        const [h, m] = horaInicio.split(':').map(Number);
        const endMin = h * 60 + m + duracionTotal;
        const horaFin = `${String(Math.floor(endMin / 60) % 24).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
        const precioTotal = (item.servicios ?? []).reduce((sum: number, s: any) => sum + (s.precioBase ?? 0), 0);
        return {
          id: item.id,
          salonId: item.salonId,
          fecha,
          horaInicio,
          horaFin,
          estado: item.estado,
          notas: item.notas ?? undefined,
          motivoCancelacion: item.motivoCancelacion ?? undefined,
          precioTotal,
          duracionTotal,
          creadoEn: item.creadoEn,
          cliente: { id: item.clienteId, nombre: clientes.find((c: any) => c.id === item.clienteId)?.nombre ?? `Cliente #${item.clienteId}` },
          empleada: { id: item.usuarioId, nombre: empleadas.find((e: any) => e.id === item.usuarioId)?.nombre ?? `Empleada #${item.usuarioId}` },
          servicios: (item.servicios ?? []).map((s: any) => ({
            id: s.id,
            nombre: s.nombre,
            duracionMinutos: s.duracionMinutos,
            precio: s.precioBase ?? 0,
          })),
        };
      });
      setCitas(transformed);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Error al cargar citas';
      setCitasError(msg);
      setCitas([]);
    } finally {
      setCitasLoading(false);
    }
  }, [salonId, weekStart, weekDays, clientes, empleadas]);

  useEffect(() => {
    fetchCitas();
  }, [fetchCitas]);

  /* ── Fetch reference data ── */
  useEffect(() => {
    if (salonId == null) return;
    setRefDataLoading(true);
    Promise.all([
      api.get(`/salones/${salonId}/empleadas`).catch(() => ({ data: [] })),
      api.get(`/salones/${salonId}/servicios`).catch(() => ({ data: [] })),
      api.get(`/salones/${salonId}/clientes`).catch(() => ({ data: [] })),
    ])
      .then(([empRes, svcRes, cliRes]) => {
        const normalize = <T,>(d: unknown): T[] =>
          Array.isArray(d) ? d : (d as { data?: T[] })?.data ?? [];
        setEmpleadas(normalize<EmpleadaSimple>(empRes.data));
        setServicios(normalize<ServicioSimple>(svcRes.data));
        setClientes(normalize<ClienteSimple>(cliRes.data));
      })
      .finally(() => setRefDataLoading(false));
  }, [salonId]);

  /* ── Fetch disponibility slots ── */
  useEffect(() => {
    if (
      !showCreate ||
      !createForm.fecha ||
      !createForm.empleadaId ||
      createForm.serviciosIds.length === 0
    ) {
      setAvailableSlots([]);
      return;
    }
    setSlotsLoading(true);
    const params = {
      fecha: createForm.fecha,
      usuarioId: createForm.empleadaId,
      duracionMinutos: totalDuration || 60,
    };
    api
      .get(`/salones/${salonId}/agenda/disponibilidad/slots`, { params })
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : [];
        // API returns [{hora, disponible}] — extract hora strings
        const slots = list
          .filter((s: { hora?: string; disponible?: boolean }) => s.disponible !== false)
          .map((s: { hora: string }) => s.hora);
        setAvailableSlots(slots);
      })
      .catch(() => setAvailableSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [showCreate, createForm.fecha, createForm.empleadaId, createForm.serviciosIds, salonId]);

  /* ── Derived form values ── */

  const selectedServicios = useMemo(
    () => servicios.filter((s) => createForm.serviciosIds.includes(s.id)),
    [servicios, createForm.serviciosIds],
  );

  const totalDuration = useMemo(
    () => selectedServicios.reduce((sum, s) => sum + s.duracionMinutos, 0),
    [selectedServicios],
  );

  const totalPrice = useMemo(
    () => selectedServicios.reduce((sum, s) => sum + (s.precioBase ?? 0), 0),
    [selectedServicios],
  );

  /* ── Week navigation ── */

  const goPrevWeek = () =>
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });

  const goNextWeek = () =>
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });

  const goToday = () => setWeekStart(getMonday(new Date()));

  /* ── Clear create form ── */
  const resetCreateForm = () => {
    setCreateForm({
      clienteId: 0,
      serviciosIds: [],
      empleadaId: 0,
      fecha: '',
      horaInicio: '',
      notas: '',
    });
    setAvailableSlots([]);
    setClienteSearch('');
    setServicioSearch('');
  };

  /* ── Create appointment ── */
  const handleCreate = async () => {
    if (!salonId) return;
    setCreating(true);
    try {
      await api.post(`/salones/${salonId}/agenda/citas`, {
        clienteId: createForm.clienteId,
        serviciosIds: createForm.serviciosIds,
        usuarioId: createForm.empleadaId,
        fechaHora: new Date(`${createForm.fecha}T${createForm.horaInicio}:00`).toISOString(),
        notas: createForm.notas || undefined,
      });
      setShowCreate(false);
      resetCreateForm();
      fetchCitas();
    } catch {
      // error handled silently — could show toast in the future
    } finally {
      setCreating(false);
    }
  };

  /* ── Change estado (PATCH) ── */
  const handleChangeEstado = async (nuevoEstado: string, motivo?: string) => {
    if (!salonId || !selectedCita) return;
    setActionLoading(true);
    try {
      await api.patch(
        `/salones/${salonId}/agenda/citas/${selectedCita.id}/estado`,
        { estado: nuevoEstado, motivo },
      );
      setSelectedCita(null);
      setShowCancelForm(false);
      setCancelMotivo('');
      fetchCitas();
    } finally {
      setActionLoading(false);
    }
  };

  /* ── Completar (abrir modal) ── */
  const handleAbrirCompletar = async () => {
    if (!selectedCita) return;
    const precios: Record<number, number> = {};
    selectedCita.servicios.forEach(s => { precios[s.id] = s.precio; });
    setCompletarForm({
      serviciosPrecios: precios,
      nuevosServiciosIds: [],
      totalProductos: 0,
      propina: 0,
      metodoPago: 'EFECTIVO',
      aplicarDescuento: false,
      descuento: 0,
      motivoDescuento: '',
    });
    setShowCompletar(true);
  };

  /* ── Confirmar completar (POST registro + completar cita) ── */
  const handleConfirmarCompletar = async () => {
    if (!salonId || !selectedCita) return;
    setCompletando(true);
    try {
      const serviciosConPrecios = selectedCita.servicios.map(s => ({
        id: s.id,
        precio: completarForm.serviciosPrecios[s.id] ?? s.precio,
      }));
      let totalServicios = serviciosConPrecios.reduce((sum, s) => sum + s.precio, 0);

      // Apply discount if enabled
      const descuento = completarForm.aplicarDescuento ? (completarForm.descuento || 0) : 0;
      const motivoDescuento = completarForm.motivoDescuento.trim();
      if (descuento > 0) {
        totalServicios = Math.max(0, totalServicios - descuento);
      }

      const total = totalServicios + completarForm.totalProductos + completarForm.propina;

      // Build notas with discount info if applied
      let notas = `Cita completada: ${selectedCita.servicios.map(s => s.nombre).join(', ')}`;
      if (descuento > 0 && motivoDescuento) {
        notas += ` | Descuento aplicado: $${descuento} — Motivo: ${motivoDescuento}`;
      }

      // 1. Create registro financiero
      await api.post(`/salones/${salonId}/registros`, {
        salonId,
        clienteId: selectedCita.cliente.id,
        usuarioId: selectedCita.empleada.id,
        totalServicios,
        totalProductos: completarForm.totalProductos,
        propina: completarForm.propina,
        pagos: [{ monto: total, metodoPago: completarForm.metodoPago }],
        serviciosIds: [...selectedCita.servicios.map(s => s.id), ...completarForm.nuevosServiciosIds],
        notas,
        registradoPorId: user?.id,
      });

      // 2. Mark cita as completed
      await api.post(`/salones/${salonId}/agenda/citas/${selectedCita.id}/completar`);

      setShowCompletar(false);
      setSelectedCita(null);
      fetchCitas();
    } catch (err) {
      console.error('Error al completar cita:', err);
    } finally {
      setCompletando(false);
    }
  };

  /* ── Completar form helpers ── */
  const handleCompletarFormChange = (patch: Partial<typeof completarForm>) => {
    setCompletarForm(prev => ({ ...prev, ...patch }));
  };

  const handleToggleServicioCompletar = (servicioId: number) => {
    if (!selectedCita) return;
    const isOriginal = selectedCita.servicios.some(s => s.id === servicioId);
    if (isOriginal) {
      const originalPrecio = selectedCita.servicios.find(s => s.id === servicioId)?.precio ?? 0;
      const currentPrice = completarForm.serviciosPrecios[servicioId] ?? originalPrecio;
      setCompletarForm(prev => ({
        ...prev,
        serviciosPrecios: {
          ...prev.serviciosPrecios,
          [servicioId]: currentPrice > 0 ? 0 : originalPrecio,
        },
      }));
    } else {
      setCompletarForm(prev => ({
        ...prev,
        nuevosServiciosIds: prev.nuevosServiciosIds.filter(id => id !== servicioId),
      }));
    }
  };

  const handleUpdatePrecioCompletar = (servicioId: number, precio: number) => {
    setCompletarForm(prev => ({
      ...prev,
      serviciosPrecios: { ...prev.serviciosPrecios, [servicioId]: precio },
    }));
  };

  /* ── Cancelar (POST) ── */
  const handleCancelar = async () => {
    if (!salonId || !selectedCita || !cancelMotivo.trim()) return;
    setActionLoading(true);
    try {
      await api.post(
        `/salones/${salonId}/agenda/citas/${selectedCita.id}/cancelar`,
        { motivo: cancelMotivo.trim() },
      );
      setSelectedCita(null);
      setShowCancelForm(false);
      setCancelMotivo('');
      fetchCitas();
    } finally {
      setActionLoading(false);
    }
  };

  /* ── Animated variants ── */
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.06, delayChildren: 0.08 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.35, ease: [0.22, 0.61, 0.36, 1] as const },
    },
  };

  /* ================================================================ */
  /*  RENDER: Loading skeleton                                         */
  /* ================================================================ */

  if (authLoading) {
    return (
      <>
        <Skeleton height="36px" width="220px" variant="rect" style={{ marginBottom: '1.5rem' }} />
        <Skeleton height="200px" variant="rect" />
      </>
    );
  }

  /* ================================================================ */
  /*  RENDER: Content                                                  */
  /* ================================================================ */

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div
          key="agenda-content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          {/* SalonSwitcher for superadmin */}
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

          {/* ── Week Navigation ── */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            style={{ marginBottom: '1rem' }}
          >
            <motion.div
              variants={itemVariants}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
                marginBottom: '0.75rem',
              }}
            >
              {/* Left: nav buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  onClick={goPrevWeek}
                  style={navBtnStyle}
                  title="Semana anterior"
                  aria-label="Semana anterior"
                >
                  ←
                </button>
                <button onClick={goToday} style={todayBtnStyle}>
                  Hoy
                </button>
                <button
                  onClick={goNextWeek}
                  style={navBtnStyle}
                  title="Semana siguiente"
                  aria-label="Semana siguiente"
                >
                  →
                </button>
              </div>

              {/* Week title */}
              <h2
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: '1.125rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  margin: 0,
                }}
              >
                {weekRangeStr}
              </h2>

              {/* Spacer for balance */}
              <div style={{ width: 0 }} />
            </motion.div>

            {/* ── Toolbar: filter + create button ── */}
            <motion.div
              variants={itemVariants}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}
            >
              {/* Employee filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Filtrar:
                </span>
                <select
                  value={filterEmpleadaId ?? ''}
                  onChange={(e) =>
                    setFilterEmpleadaId(
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                  className={styles.formSelect}
                  style={{
                    width: 'auto',
                    minWidth: '160px',
                    height: '34px',
                    fontSize: '0.75rem',
                  }}
                >
                  <option value="">Todas las empleadas</option>
                  {empleadas.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* New appointment button */}
              <motion.div
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                <button
                  onClick={() => {
                    resetCreateForm();
                    setShowCreate(true);
                  }}
                  style={primaryBtnStyle}
                >
                  + Nueva Cita
                </button>
              </motion.div>
            </motion.div>
          </motion.div>

          {/* ── Calendar Grid ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            {citasLoading ? (
              /* ── Loading skeleton ── */
              <div className={styles.calendarWrapper}>
                <div style={{ display: 'flex', gap: '1px', padding: 0 }}>
                  {Array.from({ length: 7 }, (_, i) => (
                    <div key={i} style={{ flex: 1, padding: '0.5rem' }}>
                      <div
                        className={styles.skeletonBlock}
                        style={{ height: 20, marginBottom: 8, width: '60%' }}
                      />
                      {[1, 2, 3].map((j) => (
                        <div
                          key={j}
                          className={styles.skeletonBlock}
                          style={{ height: 60, marginBottom: 6 }}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ) : citasError ? (
              /* ── Error state ── */
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '3rem 2rem',
                  textAlign: 'center',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface)',
                }}
              >
                <span style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>
                  ⚠️
                </span>
                <p
                  style={{
                    color: 'var(--danger)',
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '0.875rem',
                    marginBottom: '1rem',
                  }}
                >
                  {citasError}
                </p>
                <Button variant="secondary" size="sm" onClick={fetchCitas}>
                  Reintentar
                </Button>
              </div>
            ) : (
              /* ── Calendar grid ── */
              <RenderCalendar
                daysWithCitas={daysWithCitas}
                todayStr={todayStr}
                onSelectCita={(c) => {
                  setSelectedCita(c);
                  setShowCancelForm(false);
                  setCancelMotivo('');
                }}
              />
            )}
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {/* ── Create Modal ── */}
      <AnimatePresence>
        {showCreate && (
          <RenderCreateModal
            clientes={clientes}
            servicios={servicios}
            empleadas={empleadas}
            loading={refDataLoading}
            form={createForm}
            onChange={(patch) =>
              setCreateForm((prev) => ({ ...prev, ...patch }))
            }
            availableSlots={availableSlots}
            slotsLoading={slotsLoading}
            totalDuration={totalDuration}
            totalPrice={totalPrice}
            creating={creating}
            onCancel={() => {
              setShowCreate(false);
              resetCreateForm();
            }}
            onCreate={handleCreate}
            clienteSearch={clienteSearch}
            setClienteSearch={setClienteSearch}
            servicioSearch={servicioSearch}
            setServicioSearch={setServicioSearch}
          />
        )}
      </AnimatePresence>

      {/* ── Detail Modal ── */}
      <AnimatePresence>
        {selectedCita && !showCompletar && (
          <RenderDetailModal
            cita={selectedCita}
            showCancelForm={showCancelForm}
            cancelMotivo={cancelMotivo}
            actionLoading={actionLoading}
            onClose={() => {
              setSelectedCita(null);
              setShowCancelForm(false);
              setCancelMotivo('');
            }}
            onChangeEstado={handleChangeEstado}
            onCompletar={handleAbrirCompletar}
            onCancelar={handleCancelar}
            onShowCancelForm={() => setShowCancelForm(true)}
            onCancelMotivoChange={setCancelMotivo}
          />
        )}
      </AnimatePresence>

      {/* ── Completar Modal ── */}
      <AnimatePresence>
        {showCompletar && selectedCita && (
          <RenderCompletarModal
            cita={selectedCita}
            servicios={servicios}
            completando={completando}
            form={completarForm}
            onChangeForm={handleCompletarFormChange}
            onClose={() => {
              setShowCompletar(false);
            }}
            onConfirmar={handleConfirmarCompletar}
            onToggleServicio={handleToggleServicioCompletar}
            onUpdatePrecio={handleUpdatePrecioCompletar}
          />
        )}
      </AnimatePresence>
    </>
  );
};

/* ================================================================ */
/*  SUB-COMPONENT: Calendar Grid                                      */
/* ================================================================ */

interface RenderCalendarProps {
  daysWithCitas: Array<{ date: Date; citas: Cita[] }>;
  todayStr: string;
  onSelectCita: (c: Cita) => void;
}

const RenderCalendar: React.FC<RenderCalendarProps> = ({
  daysWithCitas,
  todayStr,
  onSelectCita,
}) => {
  const numDays = daysWithCitas.length || 6;
  const totalMinWidth = TIME_COL_WIDTH + numDays * MIN_COL_WIDTH;

  return (
    <div className={styles.calendarWrapper}>
      <div
        className={styles.calendarInner}
        style={{ minWidth: totalMinWidth, height: HEADER_HEIGHT + CALENDAR_HEIGHT }}
      >
        {/* ── Day headers ── */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: HEADER_HEIGHT,
            display: 'flex',
            zIndex: 8,
          }}
        >
          {/* Corner cell */}
          <div
            style={{
              width: TIME_COL_WIDTH,
              minWidth: TIME_COL_WIDTH,
              flexShrink: 0,
              borderRight: '1px solid var(--border)',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
            }}
          />
          {daysWithCitas.map(({ date }) => {
            const dateStr = toISODate(date);
            const isToday = dateStr === todayStr;
            return (
              <div
                key={dateStr}
                className={styles.dayHeader}
                style={{
                  flex: 1,
                  minWidth: MIN_COL_WIDTH,
                  background: isToday
                    ? 'rgba(212,168,83,0.07)'
                    : 'var(--bg-elevated)',
                  borderBottom: isToday
                    ? '2px solid var(--accent)'
                    : '1px solid var(--border)',
                }}
              >
                <span className={styles.dayName}>{DAY_LABELS[date.getDay()]}</span>
                <span
                  className={styles.dayNumber}
                  style={{
                    color: isToday ? 'var(--accent)' : undefined,
                    fontWeight: isToday ? 700 : 600,
                  }}
                >
                  {date.getDate()}
                </span>
              </div>
            );
          })}
        </div>

        {/* ── Time labels ── */}
        <div
          style={{
            position: 'absolute',
            top: HEADER_HEIGHT,
            left: 0,
            width: TIME_COL_WIDTH,
            height: CALENDAR_HEIGHT,
            zIndex: 5,
          }}
        >
          {Array.from({ length: TOTAL_HOURS }, (_, i) => {
            const hour = START_HOUR + i;
            return (
              <div
                key={hour}
                className={styles.timeLabel}
                style={{
                  height: HOUR_HEIGHT,
                  paddingTop: -6,
                }}
              >
                {`${String(hour).padStart(2, '0')}:00`}
              </div>
            );
          })}
        </div>

        {/* ── Horizontal grid lines ── */}
        <div
          style={{
            position: 'absolute',
            top: HEADER_HEIGHT,
            left: TIME_COL_WIDTH,
            right: 0,
            height: CALENDAR_HEIGHT,
            pointerEvents: 'none',
            zIndex: 1,
          }}
        >
          {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => {
            if (i === 0) return null;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  top: i * HOUR_HEIGHT - 1,
                  left: 0,
                  right: 0,
                  height: 1,
                  background: 'var(--border)',
                }}
              />
            );
          })}
          {Array.from({ length: TOTAL_HOURS }, (_, i) => (
            <div
              key={`half-${i}`}
              style={{
                position: 'absolute',
                top: i * HOUR_HEIGHT + HOUR_HEIGHT / 2,
                left: 0,
                right: 0,
                height: 1,
                background: 'rgba(255,255,255,0.03)',
              }}
            />
          ))}
        </div>

        {/* ── Vertical column dividers ── */}
        {daysWithCitas.length > 0 &&
          Array.from({ length: daysWithCitas.length - 1 }, (_, i) => (
            <div
              key={`v-${i}`}
              style={{
                position: 'absolute',
                top: HEADER_HEIGHT,
                left: `calc(${TIME_COL_WIDTH}px + (100% - ${TIME_COL_WIDTH}px) / ${numDays} * ${i + 1})`,
                width: 1,
                height: CALENDAR_HEIGHT,
                background: 'var(--border)',
                zIndex: 1,
              }}
            />
          ))}

        {/* ── Appointment cards per day column ── */}
        {daysWithCitas.map(({ date, citas }, dayIdx) => {
          const dateStr = toISODate(date);
          const isToday = dateStr === todayStr;
          const isPast =
            dateStr < todayStr && dateStr !== todayStr;

          return (
            <div
              key={dateStr}
              className={styles.dayColumn}
              style={{
                top: HEADER_HEIGHT,
                left: `calc(${TIME_COL_WIDTH}px + (100% - ${TIME_COL_WIDTH}px) / ${numDays} * ${dayIdx})`,
                width: `calc((100% - ${TIME_COL_WIDTH}px) / ${numDays})`,
                height: CALENDAR_HEIGHT,
                opacity: isPast ? 0.5 : 1,
                background: isToday
                  ? 'rgba(212,168,83,0.03)'
                  : 'transparent',
              }}
            >
              {/* Row backgrounds for hour alignment */}
              {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                <div
                  key={i}
                  style={{
                    height: HOUR_HEIGHT,
                    borderBottom: '1px solid transparent',
                  }}
                />
              ))}

              {/* Appointment cards */}
              {(() => {
                const sorted = [...citas].sort((a, b) =>
                  a.horaInicio.localeCompare(b.horaInicio),
                );
                const groups: Array<{ citas: Cita[]; maxOverlap: number }> = [];
                let currentGroup: Cita[] = [];
                let groupEndMin = 0;

                for (const cita of sorted) {
                  const [h, m] = cita.horaInicio.split(':').map(Number);
                  const startMin = h * 60 + m;
                  if (currentGroup.length > 0 && startMin >= groupEndMin) {
                    groups.push({ citas: currentGroup, maxOverlap: countMaxOverlap(currentGroup) });
                    currentGroup = [];
                    groupEndMin = 0;
                  }
                  currentGroup.push(cita);
                  const [eh, em] = cita.horaFin.split(':').map(Number);
                  const endMin = eh * 60 + em;
                  groupEndMin = Math.max(groupEndMin, endMin);
                }
                if (currentGroup.length > 0) {
                  groups.push({ citas: currentGroup, maxOverlap: countMaxOverlap(currentGroup) });
                }

                const flattened: Array<{ cita: Cita; col: number; totalCols: number }> = [];
                for (const group of groups) {
                  const cols = group.maxOverlap;
                  group.citas.forEach((cita, idx) => {
                    flattened.push({ cita, col: idx % cols, totalCols: cols });
                  });
                }

                return flattened.map(({ cita, col, totalCols }) => {
                  const cfg = STATUS_CFG[cita.estado];
                  const top = calcTop(cita.horaInicio);
                  const height = calcHeight(cita.duracionTotal);
                  const isCancelada = cita.estado === 'CANCELADA';
                  const cardWidth = `calc(${100 / totalCols}% - 3px)`;
                  const cardLeft = `calc(${(col / totalCols) * 100}% + 2px)`;

                  return (
                    <motion.div
                      key={cita.id}
                      className={`${styles.appointmentCard} ${isCancelada ? styles.cardCancel : ''}`}
                      style={{
                        top,
                        height,
                        left: cardLeft,
                        width: cardWidth,
                        background: cfg.bg,
                        borderLeftColor: cfg.border,
                        minHeight: 20,
                        position: 'absolute',
                        right: 'auto',
                      }}
                      initial={{ opacity: 0, scaleY: 0.8 }}
                      animate={{ opacity: 1, scaleY: 1 }}
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                      whileHover={{ scale: 1.02 }}
                      onClick={() => onSelectCita(cita)}
                      title={`${cita.cliente.nombre} - ${cita.horaInicio} a ${cita.horaFin}`}
                    >
                      <div className={styles.cardTitle}>
                        {cita.cliente.nombre}
                      </div>
                      <div className={styles.cardSub}>
                        {cita.servicios.map((s) => s.nombre).join(', ')}
                      </div>
                      {(height > 30 || totalCols <= 1) && (
                        <div className={styles.cardTime}>
                          {cita.horaInicio} - {cita.horaFin}
                        </div>
                      )}
                    </motion.div>
                  );
                });
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ================================================================ */
/*  SUB-COMPONENT: Create Modal                                       */
/* ================================================================ */
/*  SUB-COMPONENT: Create Modal                                       */
/* ================================================================ */

interface CreateModalProps {
  clientes: ClienteSimple[];
  servicios: ServicioSimple[];
  empleadas: EmpleadaSimple[];
  loading: boolean;
  form: {
    clienteId: number;
    serviciosIds: number[];
    empleadaId: number;
    fecha: string;
    horaInicio: string;
    notas: string;
  };
  onChange: (patch: Partial<CreateModalProps['form']>) => void;
  availableSlots: string[];
  slotsLoading: boolean;
  totalDuration: number;
  totalPrice: number;
  creating: boolean;
  onCancel: () => void;
  onCreate: () => void;
  clienteSearch: string;
  setClienteSearch: (v: string) => void;
  servicioSearch: string;
  setServicioSearch: (v: string) => void;
}

const RenderCreateModal: React.FC<CreateModalProps> = ({
  clientes,
  servicios,
  empleadas,
  loading,
  form,
  onChange,
  availableSlots,
  slotsLoading,
  totalDuration,
  totalPrice,
  creating,
  onCancel,
  onCreate,
  clienteSearch,
  setClienteSearch,
  servicioSearch,
  setServicioSearch,
}) => {
  const canCreate =
    form.clienteId > 0 &&
    form.serviciosIds.length > 0 &&
    form.empleadaId > 0 &&
    form.fecha &&
    form.horaInicio;

  const toggleServicio = (id: number) => {
    const next = form.serviciosIds.includes(id)
      ? form.serviciosIds.filter((s) => s !== id)
      : [...form.serviciosIds, id];
    onChange({ serviciosIds: next, horaInicio: '' });
  };

  const selectedServicios = useMemo(
    () => servicios.filter((s) => form.serviciosIds.includes(s.id)),
    [servicios, form.serviciosIds],
  );

  return (
    <motion.div
      className={styles.modalOverlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <motion.div
        className={styles.modalContent}
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.25, ease: [0.22, 0.61, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Nueva Cita</span>
          <button
            onClick={onCancel}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-dim)',
              fontSize: '1.25rem',
              cursor: 'pointer',
              padding: '0 0.25rem',
              lineHeight: 1,
            }}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem 0' }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className={styles.skeletonBlock} style={{ height: 36, borderRadius: 'var(--radius-sm)' }} />
              ))}
              <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.8125rem', marginTop: '0.5rem' }}>
                Cargando datos...
              </p>
            </div>
          ) : (
          <>
          {/* Cliente */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Cliente</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className={styles.formInput}
                placeholder="Buscar o escribir nombre..."
                value={
                  form.clienteId > 0
                    ? clientes.find(c => c.id === form.clienteId)?.nombre ?? clienteSearch
                    : clienteSearch
                }
                onChange={(e) => {
                  setClienteSearch(e.target.value);
                  if (form.clienteId > 0) onChange({ clienteId: 0 });
                }}
                onFocus={() => {
                  if (form.clienteId > 0) {
                    setClienteSearch('');
                    onChange({ clienteId: 0 });
                  }
                }}
                style={{ paddingRight: '28px' }}
              />
              {form.clienteId > 0 && (
                <button
                  onClick={() => { onChange({ clienteId: 0 }); setClienteSearch(''); }}
                  style={{
                    position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer',
                    fontSize: '0.875rem', padding: 0,
                  }}
                  aria-label="Limpiar cliente"
                >✕</button>
              )}
              {!form.clienteId && clienteSearch.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                  maxHeight: '160px', overflowY: 'auto',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-surface)', marginTop: '2px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                }}>
                  {clientes
                    .filter(c => c.nombre.toLowerCase().includes(clienteSearch.toLowerCase()))
                    .slice(0, 8)
                    .map(c => (
                      <div
                        key={c.id}
                        onClick={() => { onChange({ clienteId: c.id }); setClienteSearch(''); }}
                        style={{
                          padding: '0.5rem 0.75rem', cursor: 'pointer',
                          fontFamily: "'DM Sans', sans-serif", fontSize: '0.8125rem',
                          color: 'var(--text-primary)',
                          borderBottom: '1px solid var(--border)',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        {c.nombre}
                        {c.telefono && <span style={{ color: 'var(--text-dim)', fontSize: '0.7rem', marginLeft: '0.5rem' }}>{c.telefono}</span>}
                      </div>
                    ))
                  }
                  {clientes.filter(c => c.nombre.toLowerCase().includes(clienteSearch.toLowerCase())).length === 0 && (
                    <div style={{
                      padding: '0.5rem 0.75rem', fontFamily: "'DM Sans', sans-serif",
                      fontSize: '0.75rem', color: 'var(--text-dim)',
                    }}>
                      No se encontraron clientes
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Servicios */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Servicios</label>
            <input
              type="text"
              className={styles.formInput}
              placeholder="Buscar servicio..."
              value={servicioSearch}
              onChange={(e) => setServicioSearch(e.target.value)}
              style={{ marginBottom: '0.4rem' }}
            />
            <div className={styles.checkboxGroup}>
              {servicios.filter(s => s.activo !== false && s.nombre.toLowerCase().includes(servicioSearch.toLowerCase())).length === 0 ? (
                <span style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem',
                  color: 'var(--text-dim)', padding: '0.5rem',
                }}>
                  {servicioSearch ? 'No hay servicios que coincidan' : 'No hay servicios disponibles'}
                </span>
              ) : (
                servicios
                  .filter(s => s.activo !== false && s.nombre.toLowerCase().includes(servicioSearch.toLowerCase()))
                  .map((svc) => (
                    <label key={svc.id} className={styles.checkboxItem}>
                      <input
                        type="checkbox"
                        checked={form.serviciosIds.includes(svc.id)}
                        onChange={() => toggleServicio(svc.id)}
                      />
                      <span className={styles.checkboxLabel}>{svc.nombre}</span>
                      <span className={styles.checkboxPrice}>
                        {formatCurrency(svc.precioBase)}
                      </span>
                    </label>
                  ))
              )}
            </div>
            {form.serviciosIds.length > 0 && (
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.4rem',
              }}>
                {selectedServicios.map(svc => (
                  <span key={svc.id} style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                    padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-sm)',
                    background: 'var(--accent-subtle)', border: '1px solid var(--accent)',
                    fontFamily: "'DM Sans', sans-serif", fontSize: '0.7rem', color: 'var(--accent)',
                  }}>
                    {svc.nombre}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleServicio(svc.id); }}
                      style={{
                        background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer',
                        padding: 0, fontSize: '0.7rem', lineHeight: 1,
                      }}
                    >✕</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Empleada */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Empleada</label>
            <select
              className={styles.formSelect}
              value={form.empleadaId || ''}
              onChange={(e) =>
                onChange({
                  empleadaId: e.target.value ? Number(e.target.value) : 0,
                  horaInicio: '',
                })
              }
            >
              <option value="">Seleccionar empleada...</option>
              {empleadas.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Fecha */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Fecha</label>
            <input
              type="date"
              className={styles.formInput}
              value={form.fecha}
              onChange={(e) => onChange({ fecha: e.target.value, horaInicio: '' })}
              min={toISODate(new Date())}
            />
          </div>

          {/* Hora / Slots */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Hora</label>
            {!form.fecha || !form.empleadaId || form.serviciosIds.length === 0 ? (
              <span
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '0.75rem',
                  color: 'var(--text-dim)',
                }}
              >
                Selecciona fecha, empleada y servicios para ver disponibilidad
              </span>
            ) : slotsLoading ? (
              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className={styles.skeletonBlock}
                    style={{ width: 60, height: 28, borderRadius: 4 }}
                  />
                ))}
              </div>
            ) : availableSlots.length === 0 ? (
              <span
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '0.75rem',
                  color: 'var(--danger)',
                }}
              >
                No hay horarios disponibles para esta combinación
              </span>
            ) : (
              <div className={styles.slotsGrid}>
                {availableSlots.map((slot) => (
                  <button
                    key={slot}
                    className={`${styles.slotButton} ${
                      form.horaInicio === slot ? styles.slotButtonSelected : ''
                    }`}
                    onClick={() => onChange({ horaInicio: slot })}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notas */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Notas</label>
            <textarea
              className={styles.formTextarea}
              value={form.notas}
              onChange={(e) => onChange({ notas: e.target.value })}
              placeholder="Opcional..."
              rows={2}
            />
          </div>

          {/* Summary */}
          {form.serviciosIds.length > 0 && (
            <div
              style={{
                marginTop: '0.5rem',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.5rem 0.75rem',
              }}
            >
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Duración estimada</span>
                <span className={styles.summaryValue}>
                  {totalDuration} min
                </span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Precio total</span>
                <span className={styles.summaryValue}>
                  {formatCurrency(totalPrice)}
                </span>
              </div>
            </div>
          )}
          </>
          )}
        </div>

        <div className={styles.modalFooter}>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!canCreate}
            loading={creating}
            onClick={onCreate}
          >
            Crear cita
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
};

/* ================================================================ */
/*  SUB-COMPONENT: Detail Modal                                       */
/* ================================================================ */

interface DetailModalProps {
  cita: Cita;
  showCancelForm: boolean;
  cancelMotivo: string;
  actionLoading: boolean;
  onClose: () => void;
  onChangeEstado: (estado: string, motivo?: string) => Promise<void>;
  onCompletar: () => Promise<void>;
  onCancelar: () => Promise<void>;
  onShowCancelForm: () => void;
  onCancelMotivoChange: (val: string) => void;
}

const RenderDetailModal: React.FC<DetailModalProps> = ({
  cita,
  showCancelForm,
  cancelMotivo,
  actionLoading,
  onClose,
  onChangeEstado,
  onCompletar,
  onCancelar,
  onShowCancelForm,
  onCancelMotivoChange,
}) => {
  const cfg = STATUS_CFG[cita.estado];
  const isTerminal = cita.estado === 'COMPLETADA' || cita.estado === 'CANCELADA';

  return (
    <motion.div
      className={styles.modalOverlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        className={styles.modalContent}
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.25, ease: [0.22, 0.61, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>
            Cita #{cita.id}
            <span
              className={styles.badgeDot}
              style={{ background: cfg.dot, verticalAlign: 'middle', marginLeft: 8 }}
            />
            <span
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '0.7rem',
                fontWeight: 500,
                color: cfg.dot,
                verticalAlign: 'middle',
              }}
            >
              {cfg.label}
            </span>
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-dim)',
              fontSize: '1.25rem',
              cursor: 'pointer',
              padding: '0 0.25rem',
              lineHeight: 1,
            }}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>
          {/* Info */}
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Cliente</span>
            <span className={styles.infoValue}>{cita.cliente.nombre}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Servicios</span>
            <span className={styles.infoValue}>
              {cita.servicios.map((s) => s.nombre).join(', ')}
            </span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Empleada</span>
            <span className={styles.infoValue}>{cita.empleada.nombre}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Horario</span>
            <span className={styles.infoValue}>
              {new Date(cita.fecha + 'T' + cita.horaInicio).toLocaleDateString('es-CL', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}{' '}
              {cita.horaInicio} - {cita.horaFin}
            </span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Duración</span>
            <span className={styles.infoValue}>{cita.duracionTotal} min</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Precio</span>
            <span className={styles.infoValue}>
              {formatCurrency(cita.precioTotal)}
            </span>
          </div>
          {cita.notas && (
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Notas</span>
              <span className={styles.infoValue}>{cita.notas}</span>
            </div>
          )}
          {cita.motivoCancelacion && (
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Motivo cancelación</span>
              <span className={styles.infoValue} style={{ color: 'var(--danger)' }}>
                {cita.motivoCancelacion}
              </span>
            </div>
          )}

          {/* ── Action buttons ── */}
          {!isTerminal && (
            <div className={styles.actionGroup} style={{ marginTop: '1rem' }}>
              {cita.estado === 'PENDIENTE' && (
                <>
                  <ActionBtn label="Confirmar" onClick={() => onChangeEstado('CONFIRMADA')} loading={actionLoading} />
                  <ActionBtn label="Completar" variant="success" onClick={onCompletar} loading={false} />
                  <ActionBtn label="Cancelar" variant="danger" onClick={onShowCancelForm} loading={false} />
                </>
              )}
              {cita.estado === 'CONFIRMADA' && (
                <>
                  <ActionBtn label="Completar" variant="success" onClick={onCompletar} loading={false} />
                  <ActionBtn label="Cancelar" variant="danger" onClick={onShowCancelForm} loading={false} />
                </>
              )}
            </div>
          )}

          {/* ── Cancel sub-form ── */}
          {showCancelForm && (
            <motion.div
              className={styles.cancelBox}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.2 }}
            >
              <label
                className={styles.formLabel}
                style={{ color: 'var(--danger)' }}
              >
                Motivo de cancelación
              </label>
              <textarea
                className={styles.formTextarea}
                value={cancelMotivo}
                onChange={(e) => onCancelMotivoChange(e.target.value)}
                placeholder="Indica el motivo..."
                rows={2}
                style={{ borderColor: 'rgba(224,85,106,0.3)', marginBottom: '0.5rem' }}
              />
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onCancelMotivoChange('');
                    onShowCancelForm(); // toggle off
                  }}
                  disabled={actionLoading}
                >
                  Volver
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={!cancelMotivo.trim()}
                  loading={actionLoading}
                  onClick={onCancelar}
                >
                  Confirmar cancelación
                </Button>
              </div>
            </motion.div>
          )}
        </div>

      </motion.div>
    </motion.div>
  );
};

/* ── Small action button inside detail modal ── */

interface ActionBtnProps {
  label: string;
  variant?: 'default' | 'danger' | 'success';
  onClick: () => void;
  loading: boolean;
}

const ActionBtn: React.FC<ActionBtnProps> = ({
  label,
  variant = 'default',
  onClick,
  loading,
}) => {
  const bgColor =
    variant === 'danger'
      ? 'var(--danger)'
      : variant === 'success'
        ? 'var(--success)'
        : 'var(--bg-elevated)';
  const textColor =
    variant === 'default' ? 'var(--text-primary)' : 'var(--bg-root)';
  const borderColor =
    variant === 'default' ? 'var(--border)' : bgColor;
  return (
    <motion.button
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      disabled={loading}
      style={{
        padding: '0.5rem 1rem',
        borderRadius: 'var(--radius-sm)',
        border: `1px solid ${borderColor}`,
        fontFamily: "'DM Sans', sans-serif",
        fontSize: '0.8125rem',
        fontWeight: 500,
        cursor: loading ? 'not-allowed' : 'pointer',
        background: loading ? 'var(--bg-hover)' : bgColor,
        color: loading ? 'var(--text-dim)' : textColor,
        opacity: loading ? 0.6 : 1,
        transition: 'background 0.2s',
      }}
    >
      {loading ? '...' : label}
    </motion.button>
  );
};

/* ================================================================ */
/*  SUB-COMPONENT: Completar Modal                                    */
/* ================================================================ */

interface CompletarModalProps {
  cita: Cita;
  servicios: ServicioSimple[];
  completando: boolean;
  form: {
    serviciosPrecios: Record<number, number>;
    nuevosServiciosIds: number[];
    totalProductos: number;
    propina: number;
    metodoPago: 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA';
    aplicarDescuento: boolean;
    descuento: number;
    motivoDescuento: string;
  };
  onChangeForm: (patch: Partial<CompletarModalProps['form']>) => void;
  onClose: () => void;
  onConfirmar: () => Promise<void>;
  onToggleServicio: (id: number) => void;
  onUpdatePrecio: (servicioId: number, precio: number) => void;
}

const RenderCompletarModal: React.FC<CompletarModalProps> = ({
  cita,
  servicios,
  completando,
  form,
  onChangeForm,
  onClose,
  onConfirmar,
  onToggleServicio,
  onUpdatePrecio,
}) => {
  const addedServicios = useMemo(
    () => servicios.filter(s => form.nuevosServiciosIds.includes(s.id)),
    [servicios, form.nuevosServiciosIds],
  );

  const availableExtraServicios = useMemo(
    () => servicios.filter(
      s => s.activo !== false
        && !cita.servicios.some(cs => cs.id === s.id)
        && !form.nuevosServiciosIds.includes(s.id),
    ),
    [servicios, cita.servicios, form.nuevosServiciosIds],
  );

  const totalOriginalServicios = useMemo(
    () => cita.servicios.reduce((sum, s) => sum + (form.serviciosPrecios[s.id] ?? s.precio), 0),
    [cita.servicios, form.serviciosPrecios],
  );

  const totalExtraServicios = useMemo(
    () => addedServicios.reduce((sum, s) => sum + (s.precioBase ?? 0), 0),
    [addedServicios],
  );

  const descuentoAplicado = form.aplicarDescuento ? (form.descuento || 0) : 0;
  const totalServiciosFinal = totalOriginalServicios + totalExtraServicios - descuentoAplicado;
  const totalFinal = totalServiciosFinal + form.totalProductos + form.propina;

  const fechaStr = new Date(cita.fecha + 'T' + cita.horaInicio).toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <motion.div
      className={styles.modalOverlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        className={styles.modalContent}
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.25, ease: [0.22, 0.61, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>
            Completar Cita #{cita.id}
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-dim)',
              fontSize: '1.25rem',
              cursor: 'pointer',
              padding: '0 0.25rem',
              lineHeight: 1,
            }}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>
          {/* ── Resumen ── */}
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Cliente</span>
            <span className={styles.infoValue}>{cita.cliente.nombre}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Empleada</span>
            <span className={styles.infoValue}>{cita.empleada.nombre}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Fecha</span>
            <span className={styles.infoValue}>{fechaStr}</span>
          </div>

          {/* ── Servicios ── */}
          <div style={{ marginTop: '1rem', marginBottom: '0.75rem' }}>
            <div
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '0.7rem',
                fontWeight: 600,
                color: 'var(--text-dim)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: '0.35rem',
              }}
            >
              Servicios
            </div>
            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.5rem',
              }}
            >
              {/* Original services */}
              {cita.servicios.map(s => {
                const currentPrice = form.serviciosPrecios[s.id] ?? s.precio;
                const isRemoved = currentPrice === 0 && form.serviciosPrecios[s.id] === 0;
                return (
                  <div
                    key={s.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.25rem 0',
                      opacity: isRemoved ? 0.5 : 1,
                      textDecoration: isRemoved ? 'line-through' : 'none',
                    }}
                  >
                    <span
                      style={{
                        flex: 1,
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '0.8125rem',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {s.nombre}
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={currentPrice}
                      onChange={(e) => onUpdatePrecio(s.id, Math.max(0, Number(e.target.value)))}
                      style={{
                        width: '80px',
                        height: '28px',
                        padding: '0 0.4rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)',
                        background: 'var(--bg-base)',
                        color: 'var(--text-primary)',
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '0.75rem',
                        textAlign: 'right',
                        outline: 'none',
                      }}
                    />
                    <button
                      onClick={() => onToggleServicio(s.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-dim)',
                        cursor: 'pointer',
                        padding: '0 0.25rem',
                        fontSize: '0.875rem',
                        lineHeight: 1,
                      }}
                      aria-label="Quitar servicio"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
              {/* Added services */}
              {addedServicios.map(s => (
                <div
                  key={s.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.25rem 0',
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '0.8125rem',
                      color: 'var(--accent)',
                    }}
                  >
                    + {s.nombre}
                  </span>
                  <span
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {formatCurrency(s.precioBase ?? 0)}
                  </span>
                  <button
                    onClick={() => onToggleServicio(s.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-dim)',
                      cursor: 'pointer',
                      padding: '0 0.25rem',
                      fontSize: '0.875rem',
                      lineHeight: 1,
                    }}
                    aria-label="Quitar servicio extra"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {/* Add service dropdown */}
              {availableExtraServicios.length > 0 && (
                <select
                  value=""
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    if (id > 0) {
                      onChangeForm({ nuevosServiciosIds: [...form.nuevosServiciosIds, id] });
                    }
                  }}
                  style={{
                    width: '100%',
                    height: '30px',
                    marginTop: '0.35rem',
                    padding: '0 0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-base)',
                    color: 'var(--accent)',
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    outline: 'none',
                    appearance: 'none',
                  }}
                >
                  <option value="">+ Agregar servicio...</option>
                  {availableExtraServicios.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.nombre} — {formatCurrency(s.precioBase ?? 0)}
                    </option>
                  ))}
                </select>
              )}
              {availableExtraServicios.length === 0 && cita.servicios.length > 0 && (
                <div
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '0.75rem',
                    color: 'var(--text-dim)',
                    padding: '0.25rem 0',
                  }}
                >
                  No hay más servicios disponibles
                </div>
              )}
            </div>
          </div>

          {/* ── Totals + Productos / Propina ── */}
          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.5rem 0.75rem',
              marginBottom: '0.75rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.3rem 0',
                borderBottom: '1px solid var(--border)',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '0.8125rem',
              }}
            >
              <span style={{ color: 'var(--text-secondary)' }}>Total servicios</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                {formatCurrency(totalServiciosFinal + descuentoAplicado)}
              </span>
            </div>

            {/* ── Discount toggle ── */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.3rem 0',
                borderBottom: '1px solid var(--border)',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '0.8125rem',
              }}
            >
              <span style={{ color: 'var(--text-secondary)' }}>Aplicar descuento</span>
              <button
                onClick={() => onChangeForm({
                  aplicarDescuento: !form.aplicarDescuento,
                  descuento: form.aplicarDescuento ? 0 : form.descuento,
                })}
                style={{
                  width: '44px',
                  height: '24px',
                  borderRadius: '12px',
                  border: 'none',
                  cursor: 'pointer',
                  position: 'relative',
                  background: form.aplicarDescuento ? 'var(--accent)' : 'var(--border)',
                  transition: 'background 0.2s',
                }}
                aria-label="Toggle descuento"
              >
                <span
                  style={{
                    position: 'absolute',
                    top: '2px',
                    left: form.aplicarDescuento ? '22px' : '2px',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: 'var(--bg-root)',
                    transition: 'left 0.2s',
                  }}
                />
              </button>
            </div>

            {form.aplicarDescuento && (
              <>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.3rem 0',
                    borderBottom: '1px solid var(--border)',
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '0.8125rem',
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)' }}>Monto descuento</span>
                  <input
                    type="number"
                    min="0"
                    max={totalServiciosFinal + descuentoAplicado}
                    value={form.descuento}
                    onChange={(e) => onChangeForm({ descuento: Math.max(0, Number(e.target.value)) })}
                    style={{
                      width: '100px',
                      height: '28px',
                      padding: '0 0.4rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-base)',
                      color: 'var(--text-primary)',
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '0.75rem',
                      textAlign: 'right',
                      outline: 'none',
                    }}
                  />
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                    padding: '0.3rem 0',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <span style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: 'var(--text-dim)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}>
                    Motivo del descuento *
                  </span>
                  <textarea
                    value={form.motivoDescuento}
                    onChange={(e) => onChangeForm({ motivoDescuento: e.target.value })}
                    placeholder="Indica el motivo del descuento (mín. 10 caracteres)"
                    rows={2}
                    style={{
                      width: '100%',
                      padding: '0.4rem',
                      borderRadius: 'var(--radius-sm)',
                      border: form.motivoDescuento.trim().length > 0 && form.motivoDescuento.trim().length < 10
                        ? '1px solid var(--danger)'
                        : '1px solid var(--border)',
                      background: 'var(--bg-base)',
                      color: 'var(--text-primary)',
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '0.75rem',
                      outline: 'none',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                    }}
                  />
                  {form.motivoDescuento.trim().length > 0 && form.motivoDescuento.trim().length < 10 && (
                    <span style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '0.65rem',
                      color: 'var(--danger)',
                    }}>
                      Mínimo 10 caracteres
                    </span>
                  )}
                </div>
              </>
            )}

            {/* ── Discounted total ── */}
            {form.aplicarDescuento && descuentoAplicado > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.3rem 0',
                  borderBottom: '1px solid var(--border)',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '0.8125rem',
                }}
              >
                <span style={{ color: 'var(--success)', fontWeight: 600 }}>Total con descuento</span>
                <span style={{ color: 'var(--success)', fontWeight: 700 }}>
                  {formatCurrency(totalServiciosFinal)}
                </span>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.3rem 0',
                borderBottom: '1px solid var(--border)',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '0.8125rem',
              }}
            >
              <span style={{ color: 'var(--text-secondary)' }}>Productos (retail)</span>
              <input
                type="number"
                min="0"
                value={form.totalProductos}
                onChange={(e) => onChangeForm({ totalProductos: Math.max(0, Number(e.target.value)) })}
                style={{
                  width: '100px',
                  height: '28px',
                  padding: '0 0.4rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-base)',
                  color: 'var(--text-primary)',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '0.75rem',
                  textAlign: 'right',
                  outline: 'none',
                }}
              />
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.3rem 0',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '0.8125rem',
              }}
            >
              <span style={{ color: 'var(--text-secondary)' }}>Propina</span>
              <input
                type="number"
                min="0"
                value={form.propina}
                onChange={(e) => onChangeForm({ propina: Math.max(0, Number(e.target.value)) })}
                style={{
                  width: '100px',
                  height: '28px',
                  padding: '0 0.4rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-base)',
                  color: 'var(--text-primary)',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '0.75rem',
                  textAlign: 'right',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* ── Pago ── */}
          <div>
            <div
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '0.7rem',
                fontWeight: 600,
                color: 'var(--text-dim)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: '0.35rem',
              }}
            >
              Pago
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}
            >
              <select
                value={form.metodoPago}
                onChange={(e) => onChangeForm({ metodoPago: e.target.value as 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' })}
                style={{
                  flex: 1,
                  height: '36px',
                  padding: '0 0.6rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-base)',
                  color: 'var(--text-primary)',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  outline: 'none',
                  appearance: 'none',
                }}
              >
                <option value="EFECTIVO">Efectivo</option>
                <option value="TARJETA">Tarjeta</option>
                <option value="TRANSFERENCIA">Transferencia</option>
              </select>
              <span
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                }}
              >
                Monto: {formatCurrency(totalFinal)}
              </span>
            </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={completando}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={completando}
            onClick={onConfirmar}
            disabled={
              form.aplicarDescuento &&
              (form.descuento || 0) > 0 &&
              form.motivoDescuento.trim().length < 10
            }
          >
            Confirmar y Registrar
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
};

/* ── Inline styles ── */

const navBtnStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)',
  padding: '0.35rem 0.75rem',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.8125rem',
  cursor: 'pointer',
  transition: 'background 0.2s, border-color 0.2s',
};

const todayBtnStyle: React.CSSProperties = {
  ...navBtnStyle,
  color: 'var(--accent)',
  fontWeight: 600,
  borderColor: 'var(--accent-glow)',
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
  transition: 'background 0.2s, box-shadow 0.2s',
  boxShadow: '0 2px 12px rgba(212,168,83,0.25)',
};

export default AgendaPage;
