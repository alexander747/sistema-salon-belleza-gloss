import { injectable, inject } from 'tsyringe';
import { NotFoundError } from '../../../../shared/errors';
import type { ISalonRepository } from '../../domain/ports/ISalonRepository';

@injectable()
export class DeleteSalonUseCase {
  constructor(
    @inject('ISalonRepository') private readonly salonRepo: ISalonRepository,
  ) {}

  async execute(id: number): Promise<void> {
    const existing = await this.salonRepo.findById(id);
    if (!existing) {
      throw new NotFoundError(`Salón con id ${id} no encontrado`);
    }

    const deleted = await this.salonRepo.delete(id);
    if (!deleted) {
      throw new NotFoundError(`Salón con id ${id} no encontrado al eliminar`);
    }
  }
}
