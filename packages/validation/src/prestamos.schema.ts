import { z } from 'zod';

// ── Crear Préstamo ───────────────────────────────────────────

export const crearPrestamoSchema = z.object({
  usuarioId: z.number().int().positive('El usuarioId debe ser un entero positivo').optional().nullable(),
  nombreTercero: z.string().min(1, 'El nombre del tercero es requerido').max(150).optional().nullable(),
  monto: z.number().positive('El monto debe ser positivo'),
  motivo: z.string().max(300).optional(),
}).refine(
  (data) => data.usuarioId || data.nombreTercero,
  { message: 'Debe especificar un empleado o un nombre de tercero' },
).refine(
  (data) => !(data.usuarioId && data.nombreTercero),
  { message: 'No puede especificar empleado y tercero simultáneamente' },
);

export type CrearPrestamoInput = z.infer<typeof crearPrestamoSchema>;

// ── Registrar Pago ───────────────────────────────────────────

export const registrarPagoSchema = z.object({
  monto: z.number().positive('El monto del pago debe ser positivo'),
  observacion: z.string().max(300).optional(),
});

export type RegistrarPagoInput = z.infer<typeof registrarPagoSchema>;

// ── Editar Préstamo ─────────────────────────────────────────

export const editarPrestamoSchema = z.object({
  monto: z.number().positive('El monto debe ser positivo').optional(),
  motivo: z.string().max(300).optional(),
});

export type EditarPrestamoInput = z.infer<typeof editarPrestamoSchema>;
