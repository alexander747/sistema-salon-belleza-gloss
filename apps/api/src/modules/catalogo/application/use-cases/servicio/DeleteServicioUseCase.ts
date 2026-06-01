import { injectable, inject } from 'tsyringe';
import type { IServicioRepository } from '../../../domain/ports/IServicioRepository';
import { NotFoundError } from '../../../../../shared/errors';

interface DeleteServicioInput {
  salonId: number;
  id: number;
}

interface DeleteServicioOutput {
  success: boolean;
}

@injectable()
export class DeleteServicioUseCase {
  constructor(
    @inject('IServicioRepository') private readonly servicioRepo: IServicioRepository,
  ) {}

  async execute(input: DeleteServicioInput): Promise<DeleteServicioOutput> {
    const servicio = await this.servicioRepo.findBySalonAndId(input.salonId, input.id);
    if (!servicio) {
      throw new NotFoundError('Servicio no encontrado');
    }

    const deleted = await this.servicioRepo.softDelete(input.id);
    return { success: deleted };
  }
}
