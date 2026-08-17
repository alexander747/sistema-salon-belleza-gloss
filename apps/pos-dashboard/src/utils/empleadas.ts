/* ── Empleadas helpers ── */

export interface EmpleadaConActivo {
  id: number;
  nombre: string;
  activo?: boolean;
}

/**
 * Filtra empleadas inactivas para selects de venta/agenda.
 * Una empleada sin campo `activo` (DTOs antiguos) se trata como activa.
 */
export function filterEmpleadasActivas<T extends EmpleadaConActivo>(empleadas: T[]): T[] {
  return empleadas.filter((e) => e.activo !== false);
}
