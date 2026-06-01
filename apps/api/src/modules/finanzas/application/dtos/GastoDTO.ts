import type { GastoEntity } from '../../../../infrastructure/persistence/entities/GastoEntity';

export interface GastoDTO {
  id: number;
  salonId: number;
  descripcion: string;
  monto: number;
  metodoPago: string;
  esGastoFijo: boolean;
  categoria: string | null;
  fecha: Date;
  reportadoPorId: number | null;
  creadoEn: Date;
}

export function gastoToDTO(entity: GastoEntity): GastoDTO {
  return {
    id: entity.id,
    salonId: entity.salonId,
    descripcion: entity.descripcion,
    monto: Number(entity.monto),
    metodoPago: entity.metodoPago,
    esGastoFijo: entity.esGastoFijo,
    categoria: entity.categoria ?? null,
    fecha: entity.fecha,
    reportadoPorId: entity.reportadoPorId ?? null,
    creadoEn: entity.creadoEn,
  };
}
