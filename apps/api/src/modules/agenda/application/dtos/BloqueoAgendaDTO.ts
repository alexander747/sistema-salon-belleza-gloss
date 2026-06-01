import type { BloqueoAgendaEntity } from '../../../../infrastructure/persistence/entities/BloqueoAgendaEntity';

export class BloqueoAgendaDTO {
  id: number;
  salonId: number;
  usuarioId: number | null;
  fechaInicio: string;
  fechaFin: string;
  tipo: string;
  motivo: string | null;

  static fromEntity(entity: BloqueoAgendaEntity): BloqueoAgendaDTO {
    return {
      id: entity.id,
      salonId: entity.salonId,
      usuarioId: entity.usuarioId,
      fechaInicio: entity.fechaInicio.toISOString(),
      fechaFin: entity.fechaFin.toISOString(),
      tipo: entity.tipo,
      motivo: entity.motivo,
    };
  }
}
