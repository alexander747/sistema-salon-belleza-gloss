import { z } from 'zod';

// ── Registro Servicio ────────────────────────────────────────

export const pagoTransaccionSchema = z.object({
  monto: z.number().min(0, 'El monto debe ser mayor o igual a 0'),
  metodoPago: z.enum(['EFECTIVO', 'TRANSFERENCIA', 'TARJETA']),
  referencia: z.string().max(100).optional(),
});

export type PagoTransaccionInput = z.infer<typeof pagoTransaccionSchema>;

export const divisionRegistroSchema = z.object({
  usuarioId: z.number().int().positive('El usuarioId es requerido'),
  porcentaje: z.number().min(0).max(100),
  monto: z.number().min(0),
});

export type DivisionRegistroInput = z.infer<typeof divisionRegistroSchema>;

/** Alcance del descuento %: solo servicios, solo productos, o ambos. */
export const descuentoAlcanceSchema = z.enum(['SERVICIOS', 'PRODUCTOS', 'AMBOS']);

export type DescuentoAlcance = z.infer<typeof descuentoAlcanceSchema>;

export const createRegistroSchema = z.object({
  salonId: z.number().int().positive(),
  clienteId: z.number().int().positive('El clienteId es requerido'),
  usuarioId: z.number().int().positive('El usuarioId es requerido'),
  totalServicios: z.number().min(0, 'El total de servicios debe ser mayor o igual a 0').default(0),
  totalProductos: z.number().min(0, 'El total de productos debe ser mayor o igual a 0').default(0),
  propina: z.number().min(0).default(0),
  descripcionServicio: z.string().max(200).optional(),
  esRetoque: z.boolean().default(false),
  // Fecha de negocio (ISO datetime). Default = ahora en CreateRegistroUseCase;
  // los registros legacy sin ella caen al fallback creadoEn en los filtros.
  fechaHora: z.string().datetime().optional(),
  pagos: z.array(pagoTransaccionSchema).optional().default([]),
  divisiones: z.array(divisionRegistroSchema).optional().default([]),
  notas: z.string().max(500).optional(),
  registradoPorId: z.number().int().optional(),
  // Descuento: un único % aplicado a un ALCANCE elegido (servicios/productos/ambos).
  // Reemplaza el antiguo ajuste de "valor total" (totalPersonalizado): el precio
  // ahora se ajusta por línea (precioServicio/precioVenta) + este %.
  porcentajeDescuento: z.number().min(0).max(100).optional().default(0),
  // Opcional en el schema; el use case aplica el default 'AMBOS' cuando falta.
  descuentoAlcance: descuentoAlcanceSchema.optional(),
  productosVendidos: z.array(z.object({
    productoId: z.number().int().positive(),
    cantidad: z.number().int().positive(),
    // Precio unitario editado por el usuario. Ausente → el server usa el
    // precio del catálogo (comportamiento legacy).
    precioVenta: z.number().min(0, 'El precio de venta debe ser mayor o igual a 0').optional(),
  })).optional().default([]),
  serviciosItems: z.array(z.object({
    servicioId: z.number().int().positive('El servicioId debe ser un entero positivo'),
    nombreServicio: z.string().min(1, 'El nombre del servicio es requerido').max(200),
    precioServicio: z.number().min(0, 'El precio del servicio debe ser mayor o igual a 0'),
    // FIJO: costoBaseInsumos is the catalog snapshot sent by the client (server
    // re-resolves the catalog). POR_GRAMO: ignored — the server derives it.
    costoBaseInsumos: z.number().min(0).default(0).optional(),
    // POR_GRAMO only: grams used per unit (> 0). Shape validation lives here;
    // the use case enforces "POR_GRAMO without grams → 422" after resolving the catalog.
    gramosUsados: z.number().positive('Los gramos deben ser mayores a 0').optional(),
    // Editado por el usuario (ej. descuento de insumos). Si viene, el server lo
    // usa como costo de la línea en vez de derivarlo (gramos × $/g).
    costoInsumosOverride: z.number().min(0, 'El costo de insumos no puede ser negativo').optional(),
    // Quantity of units sold for this line (expanded to N item rows server-side).
    cantidad: z.number().int('La cantidad debe ser un entero').positive('La cantidad debe ser ≥ 1').default(1),
  })).optional().default([]),
});

export type CreateRegistroInput = z.infer<typeof createRegistroSchema>;

// ── Abonar deuda (POST /registros/:id/pagos) ──────────────────

export const abonarDeudaSchema = z.object({
  monto: z.number().positive('El monto debe ser positivo'),
  metodoPago: z.enum(['EFECTIVO', 'TRANSFERENCIA', 'TARJETA']),
  referencia: z.string().max(100).optional(),
});

export type AbonarDeudaInput = z.infer<typeof abonarDeudaSchema>;

// ── Completar cita (atómico) ─────────────────────────────────

export const completarCitaSchema = z.object({
  // registro es opcional → sin body conserva el comportamiento legacy
  registro: createRegistroSchema.optional(),
});

export type CompletarCitaInput = z.infer<typeof completarCitaSchema>;

// ── Gasto ────────────────────────────────────────────────────

export const createGastoSchema = z.object({
  descripcion: z.string().min(1, 'La descripción es requerida').max(300),
  monto: z.number().positive('El monto debe ser positivo'),
  metodoPago: z.enum(['EFECTIVO', 'TRANSFERENCIA', 'TARJETA']).default('EFECTIVO'),
  esGastoFijo: z.boolean().default(false),
  fecha: z.string().optional(),
  categoria: z.string().max(100).optional(),
});

export type CreateGastoInput = z.infer<typeof createGastoSchema>;

// ── Devolución ───────────────────────────────────────────────

export const createDevolucionSchema = z.object({
  registroServicioId: z.number().int().positive('El registroServicioId es requerido'),
  productoId: z.number().int().positive().optional(),
  motivo: z.string().min(1, 'El motivo es requerido').max(300),
  cantidad: z.number().positive('La cantidad debe ser positiva').default(1),
  regresaAlStock: z.boolean().default(true),
});

export type CreateDevolucionInput = z.infer<typeof createDevolucionSchema>;

// ── Liquidación ──────────────────────────────────────────────

export const liquidarEmpleadaSchema = z.object({
  usuarioId: z.number().int().positive('El usuarioId es requerido'),
});

export type LiquidarEmpleadaInput = z.infer<typeof liquidarEmpleadaSchema>;
