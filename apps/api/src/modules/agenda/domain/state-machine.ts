import type { CitaEntity } from '../../../infrastructure/persistence/entities/CitaEntity';
import { EstadoCita } from '../../../infrastructure/persistence/entities/CitaEntity';

/**
 * Mapa de transiciones válidas desde cada estado.
 * Terminales: COMPLETADA, CANCELADA, NO_LLEGO — no permiten transiciones de salida.
 */
export const ESTADO_TRANSICIONES_VALIDAS: Record<EstadoCita, EstadoCita[]> = {
  [EstadoCita.PENDIENTE]: [EstadoCita.CONFIRMADA, EstadoCita.COMPLETADA, EstadoCita.CANCELADA],
  [EstadoCita.CONFIRMADA]: [EstadoCita.COMPLETADA, EstadoCita.NO_LLEGO, EstadoCita.CANCELADA],
  [EstadoCita.COMPLETADA]: [],
  [EstadoCita.CANCELADA]: [],
  [EstadoCita.NO_LLEGO]: [],
};

export function validarTransicion(actual: EstadoCita, nuevo: EstadoCita): boolean {
  const permitidas = ESTADO_TRANSICIONES_VALIDAS[actual];
  return permitidas?.includes(nuevo) ?? false;
}

export function cambiarEstado(cita: CitaEntity, nuevo: EstadoCita): void {
  if (!validarTransicion(cita.estado, nuevo)) {
    const permitidas = ESTADO_TRANSICIONES_VALIDAS[cita.estado] ?? [];
    const txt = permitidas.length > 0 ? permitidas.join(', ') : 'ninguna';
    throw new Error(
      `Transición inválida: de ${cita.estado} a ${nuevo}. ` +
      `Transiciones permitidas desde ${cita.estado}: [${txt}]`,
    );
  }
  cita.estado = nuevo;
}
