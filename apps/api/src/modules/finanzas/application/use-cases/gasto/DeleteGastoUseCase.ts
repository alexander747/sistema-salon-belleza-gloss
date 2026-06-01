import { injectable, inject } from 'tsyringe';
import type { IGastoRepository } from '../../../domain/ports/IGastoRepository';
import { NotFoundError } from '../../../../../shared/errors';

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

    await this.gastoRepo.delete(input.id);
  }
}
