import { injectable, inject } from 'tsyringe';
import type { ILiquidacionRepository } from '../../../domain/ports/ILiquidacionRepository';
import type { LiquidacionEntity } from '../../../../../infrastructure/persistence/entities/LiquidacionEntity';

export interface HistorialLiquidacionesInput {
  salonId: number;
  usuarioId?: number;
}

@injectable()
export class HistorialLiquidacionesUseCase {
  constructor(
    @inject('ILiquidacionRepository')
    private readonly liquidacionRepo: ILiquidacionRepository,
  ) {}

  async execute(input: HistorialLiquidacionesInput): Promise<LiquidacionEntity[]> {
    if (input.usuarioId !== undefined) {
      return this.liquidacionRepo.findBySalonAndEmpleada(input.salonId, input.usuarioId);
    }

    return this.liquidacionRepo.findBySalon(input.salonId);
  }
}
