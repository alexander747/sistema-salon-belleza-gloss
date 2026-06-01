import type { DevolucionEntity } from '../../../../infrastructure/persistence/entities/DevolucionEntity';

export interface DevolucionDTO {
  id: number;
  registroServicioId: number;
  productoId: number | null;
  motivo: string;
  cantidad: number;
  montoDevolucion: number;
  regresaAlStock: boolean;
  procesada: boolean;
  salonId: number;
  creadoEn: Date;
}

export function devolucionToDTO(entity: DevolucionEntity): DevolucionDTO {
  return {
    id: entity.id,
    registroServicioId: entity.registroServicioId,
    productoId: entity.productoId ?? null,
    motivo: entity.motivo,
    cantidad: Number(entity.cantidad),
    montoDevolucion: Number(entity.montoDevolucion),
    regresaAlStock: entity.regresaAlStock,
    procesada: entity.procesada,
    salonId: entity.salonId,
    creadoEn: entity.creadoEn,
  };
}
