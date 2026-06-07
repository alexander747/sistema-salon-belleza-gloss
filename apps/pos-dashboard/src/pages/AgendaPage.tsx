import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Skeleton, Button } from '@pos-final/ui';
import { Rol, type IUser } from '@pos-final/types';
import api from '../services/api.js';
import SalonSwitcher from '../components/SalonSwitcher.js';
import ClienteSearchableSelect from '../components/ClienteSearchableSelect.js';
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

interface ProductoSimple {
  id: number;
  nombre: string;
  marca?: string;
  precioVenta: number;
  cantidadStock: number;
}

interface ProductCartItem {
  productoId: number;
  nombre: string;
  precioVenta: number;
  cantidad: number;
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
  { bg: string; border: string; dot: string; label: string; text: string }
> = {
  PENDIENTE: {
    bg: 'rgba(234, 179, 8, 0.35)',
    border: 'rgba(234, 179, 8, 0.85)',
    dot: '#eab308',
    label: 'Pendiente',
    text: '#eab308',
  },
  CONFIRMADA: {
    bg: 'rgba(59, 130, 246, 0.35)',
    border: 'rgba(59, 130, 246, 0.85)',
    dot: '#3b82f6',
    label: 'Confirmada',
    text: '#3b82f6',
  },
  EN_PROGRESO: {
    bg: 'rgba(139, 92, 246, 0.35)',
    border: 'rgba(139, 92, 246, 0.85)',
    dot: '#8b5cf6',
    label: 'En curso',
    text: '#8b5cf6',
  },
  COMPLETADA: {
    bg: 'rgba(34, 197, 94, 0.35)',
    border: 'rgba(34, 197, 94, 0.85)',
    dot: '#22c55e',
    label: 'Completada',
    text: '#22c55e',
  },
  CANCELADA: {
    bg: 'rgba(239, 68, 68, 0.3)',
    border: 'rgba(239, 68, 68, 0.75)',
    dot: '#ef4444',
    label: 'Cancelada',
    text: '#ef4444',
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
  const [productos, setProductos] = useState<ProductoSimple[]>([]);
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
    productosVendidos: [] as ProductCartItem[],
    propina: 0,
    metodoPago: 'EFECTIVO' as 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA',
    descuento: 0,  // percentage 0–100
    totalPersonalizado: null as number | null,
    ajustarTotal: false,
    notaAjuste: '',
    montoRecibido: 0,
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
      api.get(`/salones/${salonId}/productos?tipo=RETAIL`).catch(() => ({ data: [] })),
    ])
      .then(([empRes, svcRes, cliRes, prodRes]) => {
        const normalize = <T,>(d: unknown): T[] =>
          Array.isArray(d) ? d : (d as { data?: T[] })?.data ?? [];
        setEmpleadas(normalize<EmpleadaSimple>(empRes.data));
        setServicios(normalize<ServicioSimple>(svcRes.data));
        setClientes(normalize<ClienteSimple>(cliRes.data));
        setProductos(normalize<ProductoSimple>(prodRes.data));
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
      productosVendidos: [],
      propina: 0,
      metodoPago: 'EFECTIVO',
      descuento: 0,
      totalPersonalizado: null,
      ajustarTotal: false,
      notaAjuste: '',
      montoRecibido: 0,
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
      const totalServicios = serviciosConPrecios.reduce((sum, s) => sum + s.precio, 0);

      // Extra services added in completar
      const totalExtraServicios = servicios
        .filter(s => completarForm.nuevosServiciosIds.includes(s.id))
        .reduce((sum, s) => sum + (s.precioBase ?? 0), 0);

      const totalServiciosFinal = totalServicios + totalExtraServicios;
      const totalProductos = completarForm.productosVendidos.reduce(
        (sum, p) => sum + p.precioVenta * p.cantidad,
        0,
      );

      // Percentage discount
      const descuentoPct = completarForm.descuento || 0;
      const descuentoMonto = (totalServiciosFinal + totalProductos) * (descuentoPct / 100);
      const calculatedTotal = totalServiciosFinal + totalProductos + completarForm.propina - descuentoMonto;
      const finalTotal = completarForm.totalPersonalizado ?? calculatedTotal;
      const hasAdjustment = descuentoPct > 0 || completarForm.totalPersonalizado !== null;

      // Build notas with adjustment info
      let notas = `Cita completada: ${selectedCita.servicios.map(s => s.nombre).join(', ')}`;
      if (hasAdjustment && completarForm.notaAjuste.trim()) {
        const ajusteParts: string[] = [];
        if (descuentoPct > 0) ajusteParts.push(`descuento ${descuentoPct}%`);
        if (completarForm.totalPersonalizado !== null) ajusteParts.push(`total $${completarForm.totalPersonalizado}`);
        const prefix = `[AJUSTE: ${ajusteParts.join(' | ')}] Razón: ${completarForm.notaAjuste.trim()}`;
        notas = `${prefix}\n${notas}`;
      }

      // 1. Create registro financiero
      await api.post(`/salones/${salonId}/registros`, {
        salonId,
        clienteId: selectedCita.cliente.id,
        usuarioId: selectedCita.empleada.id,
        totalServicios: totalServiciosFinal,
        totalProductos,
        propina: completarForm.propina,
        montoTotal: finalTotal,
        pagos: [{ monto: finalTotal, metodoPago: completarForm.metodoPago }],
        serviciosIds: [...selectedCita.servicios.map(s => s.id), ...completarForm.nuevosServiciosIds],
        notas,
        registradoPorId: user?.id,
        productosVendidos: completarForm.productosVendidos.map(p => ({
          productoId: p.productoId,
          cantidad: p.cantidad,
        })),
        // Price adjustment fields
        porcentajeDescuento: descuentoPct,
        precioAjustado: hasAdjustment,
        valorOriginal: totalServiciosFinal + totalProductos + completarForm.propina,
        valorFinal: finalTotal,
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
            salonId={salonId!}
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
            productos={productos}
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
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          marginBottom: '1px',
                        }}
                      >
                        <span
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: '50%',
                            background: cfg.dot,
                            display: 'inline-block',
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            fontSize: '0.5rem',
                            color: cfg.text,
                            fontFamily: "'DM Sans', sans-serif",
                            fontWeight: 500,
                            lineHeight: 1.2,
                          }}
                        >
                          {cfg.label}
                        </span>
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
  salonId: number;
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
  servicioSearch: string;
  setServicioSearch: (v: string) => void;
}

/* ── Mini-modal inline state ── */
interface NewClienteForm {
  nombre: string;
  telefono: string;
  cedula: string;
  email: string;
}

const RenderCreateModal: React.FC<CreateModalProps> = ({
  salonId,
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
  servicioSearch,
  setServicioSearch,
}) => {
  const [showCreateCliente, setShowCreateCliente] = useState(false);
  const [newClienteForm, setNewClienteForm] = useState<NewClienteForm>({
    nombre: '',
    telefono: '',
    cedula: '',
    email: '',
  });
  const [creatingCliente, setCreatingCliente] = useState(false);
  const [createClienteError, setCreateClienteError] = useState('');
  const [selectedClienteName, setSelectedClienteName] = useState('');

  const refreshClientes = async () => {
    if (salonId == null) return;
    try {
      const { data } = await api.get(`/salones/${salonId}/clientes`, { params: { limit: 0 } });
      const paginatedData = data?.data ?? data;
      const list = Array.isArray(paginatedData) ? paginatedData : [];
      setClientes(list.map((c: Record<string, unknown>) => ({
        id: c.id as number,
        nombre: c.nombre as string,
        telefono: c.telefono as string,
      })));
    } catch {
      // Silently fail - clientes will refresh on next page load
    }
  };

  const handleCreateCliente = async () => {
    if (!newClienteForm.nombre.trim() || !newClienteForm.telefono.trim()) {
      setCreateClienteError('Nombre y teléfono son obligatorios');
      return;
    }
    setCreatingCliente(true);
    setCreateClienteError('');
    try {
      const { data, status } = await api.post(`/salones/${salonId}/clientes`, {
        nombre: newClienteForm.nombre.trim(),
        telefono: newClienteForm.telefono.trim(),
        cedula: newClienteForm.cedula.trim() || undefined,
        email: newClienteForm.email.trim() || undefined,
      });
      const newCliente = data?.cliente ?? data?.data ?? data;
      if (newCliente?.id) {
        setSelectedClienteName(newCliente.nombre);
        onChange({ clienteId: newCliente.id });
        // Refresh client list so new client appears in search
        await refreshClientes();
        setShowCreateCliente(false);
        setNewClienteForm({ nombre: '', telefono: '', cedula: '', email: '' });
      } else {
        setCreateClienteError('Error al crear el cliente. Intenta de nuevo.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al crear el cliente. Intenta de nuevo.';
      // Check if it's a validation error from the server
      if (typeof err === 'object' && err !== null && 'response' in err) {
        const axiosError = err as { response?: { data?: { message?: string } } };
        const serverMsg = axiosError.response?.data?.message;
        if (serverMsg) {
          setCreateClienteError(serverMsg);
        } else {
          setCreateClienteError(msg);
        }
      } else {
        setCreateClienteError(msg);
      }
    } finally {
      setCreatingCliente(false);
    }
  };
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
        style={{ maxWidth: 640 }}
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

        <div className={styles.modalBody} style={{ position: 'relative' }}>
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
          {/* Cliente — Searchable Select */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              Cliente <span className={styles.requiredAsterisk}>*</span>
            </label>
            <ClienteSearchableSelect
              salonId={salonId}
              value={form.clienteId}
              selectedName={selectedClienteName}
              onSelect={(cliente) => {
                onChange({ clienteId: cliente.id });
                setSelectedClienteName(cliente.nombre);
              }}
              onCreateNew={() => setShowCreateCliente(true)}
              placeholder="🔍 Buscar cliente por nombre, celular o cédula..."
            />
          </div>

          {/* Servicios */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Servicios <span className={styles.requiredAsterisk}>*</span></label>
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
              <div className={styles.serviceChips}>
                {selectedServicios.map(svc => (
                  <span key={svc.id} className={styles.serviceChip}>
                    {svc.nombre}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleServicio(svc.id); }}
                      className={styles.serviceChipRemove}
                    >✕</button>
                  </span>
                ))}
              </div>
            )}
            {form.serviciosIds.length > 0 && (
              <div className={styles.totalPriceBadge}>
                Total: {formatCurrency(totalPrice)}
              </div>
            )}
          </div>

          {/* Empleada */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Empleada <span className={styles.requiredAsterisk}>*</span></label>
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

          {/* Fecha + Hora — 2-column grid */}
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                Fecha <span className={styles.requiredAsterisk}>*</span>
              </label>
              <input
                type="date"
                className={styles.formInput}
                value={form.fecha}
                onChange={(e) => onChange({ fecha: e.target.value, horaInicio: '' })}
                min={toISODate(new Date())}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                Hora <span className={styles.requiredAsterisk}>*</span>
              </label>
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

          {/* ── Mini-modal inline: Crear nuevo cliente ── */}
          <AnimatePresence>
            {showCreateCliente && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0,0,0,0.5)',
                  backdropFilter: 'blur(4px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 50,
                  borderRadius: 'var(--radius-lg)',
                }}
                onClick={(e) => {
                  if (e.target === e.currentTarget) setShowCreateCliente(false);
                }}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  transition={{ duration: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
                  onClick={(e) => e.stopPropagation()}
                  className={styles.clienteMiniModal}
                >
                  {/* Header */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '1rem 1.25rem 0.75rem',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'Playfair Display', serif",
                        fontSize: '1rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                      }}
                    >
                      Crear nuevo cliente
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowCreateCliente(false)}
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

                  {/* Body */}
                  <div
                    style={{
                      padding: '1rem 1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                    }}
                  >
                    {/* Nombre */}
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          color: 'var(--text-secondary)',
                          marginBottom: '0.3rem',
                        }}
                      >
                        Nombre completo <span style={{ color: 'var(--danger)' }}>*</span>
                      </label>
                      <input
                        type="text"
                        className={styles.formInput}
                        value={newClienteForm.nombre}
                        onChange={(e) =>
                          setNewClienteForm((prev) => ({ ...prev, nombre: e.target.value }))
                        }
                        placeholder="Nombre del cliente"
                      />
                    </div>

                    {/* Teléfono */}
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          color: 'var(--text-secondary)',
                          marginBottom: '0.3rem',
                        }}
                      >
                        Teléfono <span style={{ color: 'var(--danger)' }}>*</span>
                      </label>
                      <input
                        type="tel"
                        className={styles.formInput}
                        value={newClienteForm.telefono}
                        onChange={(e) =>
                          setNewClienteForm((prev) => ({ ...prev, telefono: e.target.value }))
                        }
                        placeholder="Número de teléfono"
                      />
                    </div>

                    {/* Cédula */}
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          color: 'var(--text-secondary)',
                          marginBottom: '0.3rem',
                        }}
                      >
                        Cédula
                      </label>
                      <input
                        type="text"
                        className={styles.formInput}
                        value={newClienteForm.cedula}
                        onChange={(e) =>
                          setNewClienteForm((prev) => ({ ...prev, cedula: e.target.value }))
                        }
                        placeholder="Opcional"
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          color: 'var(--text-secondary)',
                          marginBottom: '0.3rem',
                        }}
                      >
                        Email
                      </label>
                      <input
                        type="email"
                        className={styles.formInput}
                        value={newClienteForm.email}
                        onChange={(e) =>
                          setNewClienteForm((prev) => ({ ...prev, email: e.target.value }))
                        }
                        placeholder="Opcional"
                      />
                    </div>

                    {/* Error */}
                    {createClienteError && (
                      <p
                        style={{
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: '0.75rem',
                          color: 'var(--danger)',
                          margin: 0,
                        }}
                      >
                        {createClienteError}
                      </p>
                    )}
                  </div>

                  {/* Footer */}
                  <div
                    style={{
                      padding: '0.75rem 1.25rem 1rem',
                      borderTop: '1px solid var(--border)',
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: '0.75rem',
                    }}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowCreateCliente(false);
                        setCreateClienteError('');
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={
                        !newClienteForm.nombre.trim() ||
                        !newClienteForm.telefono.trim()
                      }
                      loading={creatingCliente}
                      onClick={handleCreateCliente}
                    >
                      Crear y seleccionar
                    </Button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
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
            <div className={styles.actionGroup} style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              {cita.estado === 'PENDIENTE' && (
                <>
                  <ActionBtn label="Confirmar" onClick={() => onChangeEstado('CONFIRMADA')} loading={actionLoading} />
                  <ActionBtn label="Completar" variant="success" onClick={onCompletar} loading={false} />
                  <ActionBtn label="Cancelar Cita" variant="danger" onClick={onShowCancelForm} loading={false} />
                </>
              )}
              {cita.estado === 'CONFIRMADA' && (
                <>
                  <ActionBtn label="Completar" variant="success" onClick={onCompletar} loading={false} />
                  <ActionBtn label="Cancelar Cita" variant="danger" onClick={onShowCancelForm} loading={false} />
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
  productos: ProductoSimple[];
  completando: boolean;
  form: {
    serviciosPrecios: Record<number, number>;
    nuevosServiciosIds: number[];
    productosVendidos: ProductCartItem[];
    propina: number;
    metodoPago: 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA';
    descuento: number;  // percentage 0–100
    totalPersonalizado: number | null;
    ajustarTotal: boolean;
    notaAjuste: string;
    montoRecibido: number;
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
  productos,
  completando,
  form,
  onChangeForm,
  onClose,
  onConfirmar,
  onToggleServicio,
  onUpdatePrecio,
}) => {
  const [productSearch, setProductSearch] = useState('');

  const filteredProductos = useMemo(() => {
    let list = productos;
    if (productSearch.trim()) {
      const q = productSearch.toLowerCase();
      list = list.filter((p) => p.nombre.toLowerCase().includes(q));
    }
    return list;
  }, [productos, productSearch]);

  const addProductToCart = (prod: ProductoSimple) => {
    if (prod.cantidadStock <= 0) return;
    const prev = form.productosVendidos;
    const existing = prev.find((item) => item.productoId === prod.id);
    if (existing) {
      onChangeForm({
        productosVendidos: prev.map((item) =>
          item.productoId === prod.id
            ? { ...item, cantidad: Math.min(item.cantidad + 1, prod.cantidadStock) }
            : item,
        ),
      });
    } else {
      onChangeForm({
        productosVendidos: [
          ...prev,
          { productoId: prod.id, nombre: prod.nombre, precioVenta: prod.precioVenta, cantidad: 1 },
        ],
      });
    }
  };

  const updateProductQty = (productoId: number, delta: number) => {
    onChangeForm({
      productosVendidos: form.productosVendidos
        .map((item) =>
          item.productoId === productoId
            ? { ...item, cantidad: Math.max(0, item.cantidad + delta) }
            : item,
        )
        .filter((item) => item.cantidad > 0),
    });
  };

  const removeProductFromCart = (productoId: number) => {
    onChangeForm({
      productosVendidos: form.productosVendidos.filter((item) => item.productoId !== productoId),
    });
  };

  const totalProductosCalc = useMemo(
    () => form.productosVendidos.reduce((sum, p) => sum + p.precioVenta * p.cantidad, 0),
    [form.productosVendidos],
  );

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

  const descuentoPct = form.descuento || 0;
  const subtotalBeforeDiscount = totalOriginalServicios + totalExtraServicios + totalProductosCalc;
  const descuentoMonto = subtotalBeforeDiscount * (descuentoPct / 100);
  const calculatedTotal = subtotalBeforeDiscount + form.propina - descuentoMonto;
  const totalFinal = form.totalPersonalizado ?? calculatedTotal;
  const hasAdjustment = descuentoPct > 0 || form.totalPersonalizado !== null;
  const ajusteNoteRequired = hasAdjustment && form.notaAjuste.trim().length === 0;

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
          <div className={styles.completarGrid}>
            {/* ── LEFT COLUMN ── */}
            <div>
              {/* ── Header Card ── */}
              <div className={styles.headerCard}>
                <div className={styles.clientName}>{cita.cliente.nombre}</div>
                <div className={styles.headerMeta}>
                  <span>{cita.empleada.nombre}</span>
                  <span>{fechaStr}</span>
                  <span>#{cita.id}</span>
                </div>
              </div>

              {/* ── Servicios ── */}
              <div style={{ marginBottom: '1rem' }}>
                <div className={styles.sectionTitle}>Servicios</div>
                <div>
                  {/* Original services */}
                  {cita.servicios.map(s => {
                    const currentPrice = form.serviciosPrecios[s.id] ?? s.precio;
                    const isRemoved = currentPrice === 0 && form.serviciosPrecios[s.id] === 0;
                    return (
                      <div
                        key={s.id}
                        className={styles.serviceCard}
                        style={{
                          opacity: isRemoved ? 0.5 : 1,
                          textDecoration: isRemoved ? 'line-through' : 'none',
                        }}
                      >
                        <span className={styles.serviceName}>{s.nombre}</span>
                        <input
                          type="number"
                          min="0"
                          value={currentPrice}
                          onChange={(e) => onUpdatePrecio(s.id, Math.max(0, Number(e.target.value)))}
                          className={`${styles.noSpinner} ${styles.servicePriceInput}`}
                        />
                        <button
                          onClick={() => onToggleServicio(s.id)}
                          className={styles.serviceRemoveBtn}
                          aria-label="Quitar servicio"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                  {/* Added services */}
                  {addedServicios.map(s => (
                    <div key={s.id} className={`${styles.serviceCard} ${styles.serviceCardAdded}`}>
                      <span className={`${styles.serviceName} ${styles.serviceNameAdded}`}>+ {s.nombre}</span>
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
                        className={styles.serviceRemoveBtn}
                        aria-label="Quitar servicio extra"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {/* Add service dropdown */}
                  {availableExtraServicios.length > 0 ? (
                    <select
                      value=""
                      onChange={(e) => {
                        const id = Number(e.target.value);
                        if (id > 0) {
                          onChangeForm({ nuevosServiciosIds: [...form.nuevosServiciosIds, id] });
                        }
                      }}
                      className={styles.addServiceSelect}
                    >
                      <option value="">+ Agregar servicio</option>
                      {availableExtraServicios.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.nombre} — {formatCurrency(s.precioBase ?? 0)}
                        </option>
                      ))}
                    </select>
                  ) : cita.servicios.length > 0 ? (
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
                  ) : null}
                </div>
              </div>

              {/* ── Productos ── */}
              <div>
                <div className={styles.sectionTitle}>Productos</div>
                <input
                  type="text"
                  placeholder="Buscar producto…"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className={styles.productSearchInput}
                />
                {filteredProductos.length === 0 ? (
                  <div
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '0.75rem',
                      color: 'var(--text-dim)',
                      padding: '0.35rem 0',
                    }}
                  >
                    {productSearch
                      ? 'No hay productos que coincidan'
                      : 'No hay productos disponibles'}
                  </div>
                ) : (
                  <div className={styles.productGrid}>
                    {filteredProductos.map((prod) => {
                      const outOfStock = prod.cantidadStock <= 0;
                      const inCart = form.productosVendidos.some((p) => p.productoId === prod.id);
                      return (
                        <div
                          key={prod.id}
                          onClick={() => !outOfStock && addProductToCart(prod)}
                          className={`${styles.productCard} ${outOfStock ? styles.productCardOutOfStock : ''} ${inCart ? styles.productCardInCart : ''}`}
                        >
                          <div className={styles.productCardName}>{prod.nombre}</div>
                          <div className={styles.productCardPrice}>{formatCurrency(prod.precioVenta)}</div>
                          <div className={`${styles.productCardStock} ${outOfStock ? styles.productCardStockOut : ''}`}>
                            {outOfStock ? 'Sin stock' : `${prod.cantidadStock} en stock`}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* Selected products in cart */}
                {form.productosVendidos.length > 0 && (
                  <div className={styles.selectedProductsSection}>
                    <div className={styles.sectionTitle}>
                      En carrito ({form.productosVendidos.length})
                    </div>
                    {form.productosVendidos.map((item) => (
                      <div key={item.productoId} className={styles.selectedProductItem}>
                        <span className={styles.selectedProductName}>{item.nombre}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          <button
                            onClick={() => updateProductQty(item.productoId, -1)}
                            className={styles.qtyBtn}
                          >
                            −
                          </button>
                          <span className={styles.qtyValue}>{item.cantidad}</span>
                          <button
                            onClick={() => updateProductQty(item.productoId, 1)}
                            className={styles.qtyBtn}
                          >
                            +
                          </button>
                        </div>
                        <span className={styles.selectedProductTotal}>
                          {formatCurrency(item.precioVenta * item.cantidad)}
                        </span>
                        <button
                          onClick={() => removeProductFromCart(item.productoId)}
                          className={styles.serviceRemoveBtn}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <div
                      className={styles.receiptRow}
                      style={{ padding: '0.25rem 0 0', fontWeight: 600 }}
                    >
                      <span className={styles.receiptLabel}>Total productos</span>
                      <span className={styles.selectedProductTotal}>
                        {formatCurrency(totalProductosCalc)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── RIGHT COLUMN ── */}
            <div>
              <div className={styles.receiptSection}>
                {/* Totals */}
                <div className={styles.receiptRow}>
                  <span className={styles.receiptLabel}>Servicios</span>
                  <span className={styles.receiptValue}>
                    {formatCurrency(totalOriginalServicios + totalExtraServicios)}
                  </span>
                </div>
                {form.productosVendidos.length > 0 && (
                  <div className={styles.receiptRow}>
                    <span className={styles.receiptLabel}>Productos</span>
                    <span className={styles.receiptValue}>{formatCurrency(totalProductosCalc)}</span>
                  </div>
                )}
                <div className={styles.receiptRow}>
                  <span className={styles.receiptLabel}>Subtotal</span>
                  <span className={styles.receiptValue}>{formatCurrency(subtotalBeforeDiscount)}</span>
                </div>
                <hr className={styles.receiptDivider} />

                {/* Discount */}
                <div className={styles.receiptRow}>
                  <span className={styles.receiptLabel}>Descuento (%)</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={form.descuento}
                      onChange={(e) =>
                        onChangeForm({
                          descuento: Math.min(100, Math.max(0, Number(e.target.value))),
                        })
                      }
                      className={`${styles.noSpinner} ${styles.propinaInput}`}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>%</span>
                  </div>
                </div>
                {descuentoMonto > 0 && (
                  <div className={styles.receiptRow}>
                    <span
                      style={{
                        color: 'var(--success)',
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '0.8125rem',
                      }}
                    >
                      Descuento
                    </span>
                    <span className={styles.receiptDiscountValue}>
                      -{formatCurrency(descuentoMonto)}
                    </span>
                  </div>
                )}

                {/* Ajustar total toggle */}
                <div
                  style={{
                    padding: '0.3rem 0',
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '0.8125rem',
                  }}
                >
                  <label className={styles.toggleLabel}>
                    <input
                      type="checkbox"
                      checked={form.ajustarTotal}
                      onChange={(e) => {
                        onChangeForm({
                          ajustarTotal: e.target.checked,
                          totalPersonalizado: e.target.checked ? form.totalPersonalizado : null,
                        });
                      }}
                      style={{ display: 'none' }}
                    />
                    <span
                      style={{
                        position: 'relative',
                        width: '36px',
                        height: '20px',
                        background: form.ajustarTotal ? 'var(--accent)' : 'var(--border)',
                        borderRadius: '10px',
                        transition: 'background 0.2s',
                        flexShrink: 0,
                        display: 'inline-block',
                      }}
                    >
                      <span
                        style={{
                          content: '""',
                          position: 'absolute',
                          top: '2px',
                          left: form.ajustarTotal ? '18px' : '2px',
                          width: '16px',
                          height: '16px',
                          background: 'var(--bg-root)',
                          borderRadius: '50%',
                          transition: 'left 0.2s',
                        }}
                      />
                    </span>
                    <span>Ajustar valor total</span>
                  </label>
                  {form.ajustarTotal && (
                    <input
                      type="number"
                      min="0"
                      value={form.totalPersonalizado !== null ? form.totalPersonalizado : ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        onChangeForm({ totalPersonalizado: val ? Number(val) : null });
                      }}
                      placeholder={formatCurrency(calculatedTotal)}
                      className={`${styles.noSpinner} ${styles.amountInput}`}
                      style={{
                        width: '100%',
                        marginTop: '0.3rem',
                        boxSizing: 'border-box',
                      }}
                    />
                  )}
                </div>

                {/* Custom total warning */}
                {form.totalPersonalizado !== null &&
                  form.totalPersonalizado !== calculatedTotal && (
                    <div className={styles.receiptRow}>
                      <span
                        style={{
                          color: 'var(--warning)',
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: '0.8125rem',
                        }}
                      >
                        Ajuste
                      </span>
                      <span className={styles.receiptAdjustmentWarning}>
                        {form.totalPersonalizado > calculatedTotal ? '+' : '-'}
                        {formatCurrency(Math.abs(form.totalPersonalizado - calculatedTotal))}
                      </span>
                    </div>
                  )}

                <hr className={styles.receiptDivider} />

                {/* Final Total */}
                <div className={styles.receiptRow}>
                  <span className={styles.receiptTotalLabel}>Total</span>
                  <span
                    className={`${styles.receiptTotalValue} ${form.totalPersonalizado !== null ? styles.receiptCustomTotalValue : ''}`}
                  >
                    {formatCurrency(totalFinal)}
                  </span>
                </div>

                {/* Propina */}
                <div className={styles.propinaRow}>
                  <span className={styles.receiptLabel}>Propina</span>
                  <input
                    type="number"
                    min="0"
                    value={form.propina}
                    onChange={(e) => onChangeForm({ propina: Math.max(0, Number(e.target.value)) })}
                    className={`${styles.noSpinner} ${styles.propinaInput}`}
                  />
                </div>

                <hr className={styles.receiptDivider} />

                {/* Required adjustment note */}
                {hasAdjustment && (
                  <div className={styles.adjustNoteSection}>
                    <span
                      className={`${styles.adjustNoteLabel} ${ajusteNoteRequired ? styles.adjustNoteLabelError : styles.adjustNoteLabelOk}`}
                    >
                      ¿Por qué se ajustó el precio? *
                    </span>
                    <textarea
                      value={form.notaAjuste}
                      onChange={(e) => onChangeForm({ notaAjuste: e.target.value })}
                      placeholder="Indicá el motivo del ajuste..."
                      rows={2}
                      className={`${styles.adjustNoteTextarea} ${ajusteNoteRequired ? styles.adjustNoteTextareaError : styles.adjustNoteTextareaOk}`}
                    />
                    {ajusteNoteRequired && (
                      <span className={styles.adjustNoteError}>
                        Este campo es obligatorio cuando hay descuento o ajuste de total.
                      </span>
                    )}
                  </div>
                )}

                {/* Payment Method */}
                <div className={styles.sectionTitle}>Método de pago</div>
                <div className={styles.paymentBtnGroup}>
                  {(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => onChangeForm({ metodoPago: m })}
                      className={`${styles.paymentBtn} ${form.metodoPago === m ? styles.paymentBtnActive : ''}`}
                    >
                      {m === 'EFECTIVO'
                        ? 'Efectivo'
                        : m === 'TARJETA'
                          ? 'Tarjeta'
                          : 'Transferencia'}
                    </button>
                  ))}
                </div>

                {/* Amount received (only for cash) */}
                {form.metodoPago === 'EFECTIVO' && (
                  <>
                    <div className={styles.amountRow}>
                      <span className={styles.receiptLabel}>Monto recibido</span>
                      <input
                        type="number"
                        min="0"
                        value={form.montoRecibido || ''}
                        onChange={(e) =>
                          onChangeForm({ montoRecibido: Math.max(0, Number(e.target.value)) })
                        }
                        placeholder={formatCurrency(totalFinal)}
                        className={`${styles.noSpinner} ${styles.amountInput}`}
                      />
                    </div>
                    {form.montoRecibido > totalFinal && (
                      <div className={styles.cambioDisplay}>
                        <span>Vuelto</span>
                        <span>{formatCurrency(form.montoRecibido - totalFinal)}</span>
                      </div>
                    )}
                  </>
                )}

                {/* Action Buttons */}
                <div className={styles.actionButtons}>
                  <button
                    onClick={onClose}
                    style={{
                      flex: 1,
                      height: '38px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      background: 'transparent',
                      color: 'var(--text-secondary)',
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                    disabled={completando}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={onConfirmar}
                    disabled={ajusteNoteRequired || completando}
                    style={{
                      flex: 2,
                      height: '38px',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      background: ajusteNoteRequired ? 'var(--border)' : 'var(--accent)',
                      color: ajusteNoteRequired ? 'var(--text-dim)' : 'var(--bg-root)',
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      cursor: ajusteNoteRequired ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {completando ? 'Registrando…' : 'Confirmar y Registrar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
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
