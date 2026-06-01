import type { CitaEntity } from '../../../../infrastructure/persistence/entities/CitaEntity';

export interface ServicioResumenDTO {
  id: number;
  nombre: string;
  duracionMinutos: number;
  precioBase: number;
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
    const servicios: ServicioResumenDTO[] = (entity.servicios ?? []).map((s) => ({
      id: s.id,
      nombre: s.nombre,
      duracionMinutos: s.duracionMinutos,
      precioBase: Number(s.precioBase),
    }));

    const duracionTotalMinutos = servicios.reduce((sum, s) => sum + s.duracionMinutos, 0);

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
