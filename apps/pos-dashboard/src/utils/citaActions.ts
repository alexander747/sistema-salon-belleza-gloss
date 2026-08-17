/* ── Gating de acciones del modal de detalle de cita ── */

export type CitaAccion = 'CONFIRMAR' | 'COMPLETAR' | 'CANCELAR' | 'NO_LLEGO';

/**
 * Devuelve las acciones permitidas según el estado de la cita,
 * espejo del state-machine del backend (apps/api/.../agenda/domain/state-machine.ts):
 *   PENDIENTE  → [CONFIRMADA, CANCELADA]
 *   CONFIRMADA → [COMPLETADA, NO_LLEGO, CANCELADA]
 * Estados terminales (COMPLETADA, CANCELADA, NO_LLEGO) no admiten acciones.
 */
export function getCitaActions(estado: string): CitaAccion[] {
  switch (estado) {
    case 'PENDIENTE':
      return ['CONFIRMAR', 'CANCELAR'];
    case 'CONFIRMADA':
      return ['COMPLETAR', 'NO_LLEGO', 'CANCELAR'];
    default:
      return [];
  }
}
