import type { QueryRunner } from 'typeorm';
import type { LiquidacionEntity } from '../../../../infrastructure/persistence/entities/LiquidacionEntity';

export interface ILiquidacionRepository {
  create(data: Partial<LiquidacionEntity>, queryRunner?: QueryRunner): Promise<LiquidacionEntity>;
  findById(id: number): Promise<LiquidacionEntity | null>;
  findBySalon(salonId: number): Promise<LiquidacionEntity[]>;
  findBySalonAndEmpleada(salonId: number, usuarioId: number): Promise<LiquidacionEntity[]>;
  findBySalonEmpleadaAndPeriodo(
    salonId: number,
    usuarioId: number,
    fechaDesde: Date,
    fechaHasta: Date,
  ): Promise<LiquidacionEntity[]>;
}
