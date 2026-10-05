import type { CajaEntity, EstadoCaja } from '../../../../infrastructure/persistence/entities/CajaEntity';

export interface CajaDTO {
  id: number;
  salonId: number;
  fechaCaja: string;
  montoInicial: number;
  montoEsperado: number | null;
  montoRealEfectivo: number | null;
  diferencia: number | null;
  /** Desglose recaudado por método, persistido al cerrar (null si ABIERTA/legacy). */
  montoEfectivo: number | null;
  montoTarjeta: number | null;
  montoTransferencia: number | null;
  /** Σ(efectivo + tarjeta + transferencia) persistido al cerrar. */
  montoRecaudado: number | null;
  /** Ingresos NETOS por tipo (post-descuento) persistidos al cerrar (null si ABIERTA/legacy). */
  montoServicios: number | null;
  montoProductos: number | null;
  estado: EstadoCaja;
  aperturaPorId: number | null;
  aperturaEn: Date;
  cierrePorId: number | null;
  cierreEn: Date | null;
  creadoEn: Date;
}

export function cajaToDTO(entity: CajaEntity): CajaDTO {
  const numOrNull = (v: number | string | null | undefined): number | null =>
    v === null || v === undefined ? null : Number(v);

  return {
    id: entity.id,
    salonId: entity.salonId,
    fechaCaja: entity.fechaCaja,
    montoInicial: Number(entity.montoInicial),
    montoEsperado: numOrNull(entity.montoEsperado),
    montoRealEfectivo: numOrNull(entity.montoRealEfectivo),
    diferencia: numOrNull(entity.diferencia),
    montoEfectivo: numOrNull(entity.montoEfectivo),
    montoTarjeta: numOrNull(entity.montoTarjeta),
    montoTransferencia: numOrNull(entity.montoTransferencia),
    montoRecaudado: numOrNull(entity.montoRecaudado),
    montoServicios: numOrNull(entity.montoServicios),
    montoProductos: numOrNull(entity.montoProductos),
    estado: entity.estado,
    aperturaPorId: entity.aperturaPorId ?? null,
    aperturaEn: entity.aperturaEn,
    cierrePorId: entity.cierrePorId ?? null,
    cierreEn: entity.cierreEn ?? null,
    creadoEn: entity.creadoEn,
  };
}
