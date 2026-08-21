import { z } from 'zod';

// ── Caja (apertura / cierre) ──────────────────────────────────

export const abrirCajaSchema = z.object({
  montoInicial: z.number().min(0, 'El monto inicial debe ser mayor o igual a 0'),
});

export type AbrirCajaInput = z.infer<typeof abrirCajaSchema>;

export const cerrarCajaSchema = z.object({
  montoRealEfectivo: z.number().min(0, 'El monto real de efectivo debe ser mayor o igual a 0'),
  // Opcional: cierra ESA caja (huérfana de otro día). Sin él → cierra la de hoy.
  cajaId: z.number().int().positive().optional(),
});

export type CerrarCajaInput = z.infer<typeof cerrarCajaSchema>;
