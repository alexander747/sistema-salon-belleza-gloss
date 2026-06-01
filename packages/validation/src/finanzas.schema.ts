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

export const createRegistroSchema = z.object({
  salonId: z.number().int().positive(),
  clienteId: z.number().int().positive('El clienteId es requerido'),
  usuarioId: z.number().int().positive('El usuarioId es requerido'),
  serviciosIds: z.array(z.number().int().positive()).optional(),
  totalServicios: z.number().min(0, 'El total de servicios debe ser mayor o igual a 0').default(0),
  totalProductos: z.number().min(0, 'El total de productos debe ser mayor o igual a 0').default(0),
  propina: z.number().min(0).default(0),
  descripcionServicio: z.string().max(200).optional(),
  esRetoque: z.boolean().default(false),
  pagos: z.array(pagoTransaccionSchema).optional().default([]),
  divisiones: z.array(divisionRegistroSchema).optional().default([]),
  notas: z.string().max(500).optional(),
  registradoPorId: z.number().int().optional(),
  productosVendidos: z.array(z.object({
    productoId: z.number().int().positive(),
    cantidad: z.number().int().positive(),
  })).optional().default([]),
});

export type CreateRegistroInput = z.infer<typeof createRegistroSchema>;

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
