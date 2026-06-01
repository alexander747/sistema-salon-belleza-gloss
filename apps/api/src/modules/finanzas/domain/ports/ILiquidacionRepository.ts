import type { LiquidacionEntity } from '../../../../infrastructure/persistence/entities/LiquidacionEntity';

export interface ILiquidacionRepository {
  create(data: Partial<LiquidacionEntity>): Promise<LiquidacionEntity>;
  findById(id: number): Promise<LiquidacionEntity | null>;
  findBySalon(salonId: number): Promise<LiquidacionEntity[]>;
  findBySalonAndEmpleada(salonId: number, usuarioId: number): Promise<LiquidacionEntity[]>;
}
