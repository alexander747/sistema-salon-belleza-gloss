/* ── Modelo del recibo de venta + builder puro ─────────────────────
 * Compartido por los 3 flujos de venta (WalkInModal, VentasPage,
 * AgendaPage completar). buildRecibo() es puro y testeable sin UI.
 */

export type ReciboLineaTipo = 'SERVICIO' | 'PRODUCTO';

export interface ReciboLinea {
  tipo: ReciboLineaTipo;
  nombre: string;
  cantidad: number;
  /** Precio unitario (COP) */
  precio: number;
  /** cantidad × precio */
  subtotal: number;
}

export interface ReciboSalon {
  nombre?: string | null;
  logoUrl?: string | null;
}

export interface ReciboData {
  numero?: number | null;
  /** Fecha de negocio del registro (ISO). */
  fecha: string;
  clienteNombre: string;
  empleadaNombre: string;
  lineas: ReciboLinea[];
  metodoPago: string;
  total: number;
  propina: number;
  /** Monto total descontado (COP). */
  descuento: number;
  /** Porcentaje de descuento (solo informativo en el recibo). */
  descuentoPorcentaje?: number;
  /** Deuda restante en fiado (0 = pagado completo). */
  montoPendiente: number;
}

/** Línea tal como la ve el usuario en el carrito (aún sin subtotal). */
export interface ReciboOrigenLinea {
  tipo: ReciboLineaTipo;
  nombre: string;
  cantidad: number;
  /** Precio unitario (COP) */
  precio: number;
}

export interface BuildReciboArgs {
  numero?: number | null;
  /** Fecha de negocio del registro (ISO). */
  fecha: string;
  clienteNombre: string;
  empleadaNombre: string;
  lineas: ReciboOrigenLinea[];
  metodoPago: string;
  total: number;
  propina?: number;
  descuento?: number;
  descuentoPorcentaje?: number;
  montoPendiente?: number;
}

/** Construye el recibo calculando el subtotal de cada línea (cantidad × precio). */
export function buildRecibo(args: BuildReciboArgs): ReciboData {
  return {
    numero: args.numero ?? null,
    fecha: args.fecha,
    clienteNombre: args.clienteNombre,
    empleadaNombre: args.empleadaNombre,
    lineas: args.lineas.map((l) => ({
      tipo: l.tipo,
      nombre: l.nombre,
      cantidad: l.cantidad,
      precio: l.precio,
      subtotal: l.cantidad * l.precio,
    })),
    metodoPago: args.metodoPago,
    total: args.total,
    propina: args.propina ?? 0,
    descuento: args.descuento ?? 0,
    descuentoPorcentaje: args.descuentoPorcentaje,
    montoPendiente: args.montoPendiente ?? 0,
  };
}

/** Nº de recibo a partir de la respuesta del POST (RegistroServicioDTO.id). */
export function numeroDeRegistro(respuesta: unknown): number | null {
  if (!respuesta || typeof respuesta !== 'object') return null;
  const dto = respuesta as { id?: unknown };
  return typeof dto.id === 'number' ? dto.id : null;
}

/** Fecha del recibo: fechaHora del registro si viene en la respuesta, si no la fecha local. */
export function fechaDeRegistro(respuesta: unknown, fallbackISO: string): string {
  if (!respuesta || typeof respuesta !== 'object') return fallbackISO;
  const dto = respuesta as { fechaHora?: unknown };
  if (typeof dto.fechaHora === 'string' || dto.fechaHora instanceof Date) {
    const iso = new Date(dto.fechaHora as string).toISOString();
    if (!Number.isNaN(new Date(iso).getTime())) return iso;
  }
  return fallbackISO;
}
