import type { CitaEntity } from '../../../../infrastructure/persistence/entities/CitaEntity';

export interface ServicioResumenDTO {
  id: number;
  nombre: string;
  duracionMinutos: number;
  precioBase: number;
  costoBaseInsumos: number;
  cantidad: number;
}

export class CitaDTO {
  id: number;
  salonId: number;
  usuarioId: number;
  clienteId: number;
  fechaHora: string;
  estado: string;
  notas: string | null;
  esWalkIn: boolean;
  servicios: ServicioResumenDTO[];
  duracionTotalMinutos: number;
  creadoEn: string;
  actualizadoEn: string;

  static fromEntity(entity: CitaEntity): CitaDTO {
    // Explicit join: each `citasServicios` row carries its service + cantidad.
    const servicios: ServicioResumenDTO[] = (entity.citasServicios ?? []).map((cs) => ({
      id: cs.servicio.id,
      nombre: cs.servicio.nombre,
      duracionMinutos: cs.servicio.duracionMinutos,
      precioBase: Number(cs.servicio.precioBase),
      costoBaseInsumos: Number(cs.servicio.costoBaseInsumos ?? 0),
      cantidad: cs.cantidad ?? 1,
    }));

    const duracionTotalMinutos = servicios.reduce(
      (sum, s) => sum + s.duracionMinutos * s.cantidad,
      0,
    );

    return {
      id: entity.id,
      salonId: entity.salonId,
      usuarioId: entity.usuarioId,
      clienteId: entity.clienteId,
      fechaHora: entity.fechaHora.toISOString(),
      estado: entity.estado,
      notas: entity.notas,
      esWalkIn: entity.esWalkIn,
      servicios,
      duracionTotalMinutos,
      creadoEn: entity.creadoEn.toISOString(),
      actualizadoEn: entity.actualizadoEn.toISOString(),
    };
  }
}
