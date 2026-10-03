import { injectable, inject } from 'tsyringe';
import type { IGastoRepository } from '../../../domain/ports/IGastoRepository';
import { NotFoundError, UnprocessableEntityError } from '../../../../../shared/errors';

export interface DeleteGastoInput {
  id: number;
  salonId: number;
}

@injectable()
export class DeleteGastoUseCase {
  constructor(
    @inject('IGastoRepository')
    private readonly gastoRepo: IGastoRepository,
  ) {}

  async execute(input: DeleteGastoInput): Promise<void> {
    const gasto = await this.gastoRepo.findById(input.id);
    if (!gasto || gasto.salonId !== input.salonId) {
      throw new NotFoundError('Gasto no encontrado');
    }

    // Un gasto originado por un préstamo no se borra suelto: dejaría el
    // préstamo huérfano (deuda viva sin el egreso). Se revierte desde el préstamo.
    if (gasto.prestamoId) {
      throw new UnprocessableEntityError(
        'Este gasto proviene de un préstamo. Para revertirlo, cancelá el préstamo desde Préstamos.',
      );
    }

    await this.gastoRepo.delete(input.id);
  }
}
