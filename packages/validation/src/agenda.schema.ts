import { z } from 'zod';

// ── Citas ────────────────────────────────────────────────

/** Línea de servicio de una cita: `cantidad` (int ≥ 1, default 1) se expande en duración y persistencia. */
export const citaServicioLineaSchema = z.object({
  servicioId: z.number().int().positive('Servicio requerido'),
  cantidad: z
    .number()
    .int('La cantidad debe ser un entero')
    .min(1, 'La cantidad debe ser ≥ 1')
    .default(1),
});

export type CitaServicioLineaInput = z.infer<typeof citaServicioLineaSchema>;

export const createCitaSchema = z
  .object({
    clienteId: z.number().int().min(1, 'Cliente requerido'),
    usuarioId: z.number().int().min(1, 'Usuario/empleada requerido'),
    fechaHora: z.string().datetime({ message: 'Formato ISO requerido' }),
    // Nuevo formato: líneas con cantidad. Legacy: `serviciosIds` (cantidad implícita 1).
    servicios: z
      .array(citaServicioLineaSchema)
      .min(1, 'Al menos un servicio requerido')
      .optional(),
    serviciosIds: z
      .array(z.number().int().positive())
      .min(1, 'Al menos un servicio requerido')
      .optional(),
    notas: z.string().max(300).optional(),
  })
  .refine(
    (data) => (data.servicios?.length ?? 0) > 0 || (data.serviciosIds?.length ?? 0) > 0,
    { message: 'Al menos un servicio requerido', path: ['servicios'] },
  );

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
