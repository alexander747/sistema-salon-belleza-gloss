import type { QueryRunner } from 'typeorm';
import type { LiquidacionEntity } from '../../../../infrastructure/persistence/entities/LiquidacionEntity';

export interface ILiquidacionRepository {
  create(data: Partial<LiquidacionEntity>, queryRunner?: QueryRunner): Promise<LiquidacionEntity>;
  findById(id: number): Promise<LiquidacionEntity | null>;
  findBySalon(salonId: number): Promise<LiquidacionEntity[]>;
  /** Liquidaciones ligadas a una caja (para restar la nómina EFECTIVO del arqueo). */
  findByCajaId(cajaId: number): Promise<LiquidacionEntity[]>;
  /**
   * Σ totalPagado de liquidaciones EFECTIVO del salón en [fechaInicio, fechaFin)
   * por creadoEn — egreso cash-basis para el P&L.
   */
  sumEfectivoBySalonAndDateRange(
    salonId: number,
    fechaInicio: Date,
    fechaFin: Date,
  ): Promise<number>;
  findBySalonAndEmpleada(salonId: number, usuarioId: number): Promise<LiquidacionEntity[]>;
  findBySalonEmpleadaAndPeriodo(
    salonId: number,
    usuarioId: number,
    fechaDesde: Date,
    fechaHasta: Date,
  ): Promise<LiquidacionEntity[]>;
}
