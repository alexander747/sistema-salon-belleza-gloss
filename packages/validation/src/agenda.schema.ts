import { z } from 'zod';

// ── Citas ────────────────────────────────────────────────

export const createCitaSchema = z.object({
  clienteId: z.number().int().min(1, 'Cliente requerido'),
  usuarioId: z.number().int().min(1, 'Usuario/empleada requerido'),
  fechaHora: z.string().datetime({ message: 'Formato ISO requerido' }),
  serviciosIds: z.array(z.number().int().positive()).min(1, 'Al menos un servicio requerido'),
  notas: z.string().max(300).optional(),
});

export type CreateCitaInput = z.infer<typeof createCitaSchema>;

export const cambiarEstadoSchema = z.object({
  estado: z.enum(['CONFIRMADA', 'CANCELADA', 'COMPLETADA', 'NO_LLEGO']),
});

export type CambiarEstadoInput = z.infer<typeof cambiarEstadoSchema>;

export const disponibilidadQuerySchema = z.object({
  usuarioId: z.coerce.number().int().min(1, 'Usuario requerido'),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD requerido'),
  hora: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM requerido').optional(),
  duracionMinutos: z.coerce.number().int().positive().optional().default(60),
});

export type DisponibilidadQueryInput = z.infer<typeof disponibilidadQuerySchema>;

// ── Bloqueos ─────────────────────────────────────────────

export const createBloqueoSchema = z.object({
  fechaInicio: z.string().datetime({ message: 'Formato ISO requerido' }),
  fechaFin: z.string().datetime({ message: 'Formato ISO requerido' }),
  tipo: z.enum(['PARCIAL', 'TOTAL']).default('PARCIAL'),
  motivo: z.string().max(200).optional(),
  usuarioId: z.number().int().positive().optional(),
});

export type CreateBloqueoInput = z.infer<typeof createBloqueoSchema>;

// ── Horarios ─────────────────────────────────────────────

export const updateHorariosSchema = z.array(
  z.object({
    diaSemana: z.number().int().min(0).max(6),
    horaApertura: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM requerido'),
    horaCierre: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM requerido'),
    estaAbierto: z.boolean(),
  }),
);

export type UpdateHorariosInput = z.infer<typeof updateHorariosSchema>;
