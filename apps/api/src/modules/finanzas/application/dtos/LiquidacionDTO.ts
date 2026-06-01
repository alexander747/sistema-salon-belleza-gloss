import type { LiquidacionEntity } from '../../../../infrastructure/persistence/entities/LiquidacionEntity';

export interface LiquidacionDTO {
  id: number;
  salonId: number;
  usuarioId: number;
  fechaDesde: Date;
  fechaHasta: Date;
  totalServicios: number;
  totalComisiones: number;
  totalPropinas: number;
  sueldoFijo: number;
  bonoHorario: number;
  totalPagado: number;
  creadoEn: Date;
}

export function liquidacionToDTO(entity: LiquidacionEntity): LiquidacionDTO {
  return {
    id: entity.id,
    salonId: entity.salonId,
    usuarioId: entity.usuarioId,
    fechaDesde: entity.fechaDesde,
    fechaHasta: entity.fechaHasta,
    totalServicios: Number(entity.totalServicios),
    totalComisiones: Number(entity.totalComisiones),
    totalPropinas: Number(entity.totalPropinas),
    sueldoFijo: Number(entity.sueldoFijo),
    bonoHorario: Number(entity.bonoHorario),
    totalPagado: Number(entity.totalPagado),
    creadoEn: entity.creadoEn,
  };
}
