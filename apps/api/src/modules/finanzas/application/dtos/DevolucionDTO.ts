import type { DevolucionEntity } from '../../../../infrastructure/persistence/entities/DevolucionEntity';
import type { MetodoPago } from '../../../../infrastructure/persistence/entities/MetodoPago';

export interface DevolucionDTO {
  id: number;
  registroServicioId: number;
  productoId: number | null;
  motivo: string;
  cantidad: number;
  montoDevolucion: number;
  regresaAlStock: boolean;
  procesada: boolean;
  /** Cómo se reintegró el dinero: solo EFECTIVO reduce el arqueo. */
  metodoPago: MetodoPago;
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
    metodoPago: entity.metodoPago,
    salonId: entity.salonId,
    creadoEn: entity.creadoEn,
  };
}
