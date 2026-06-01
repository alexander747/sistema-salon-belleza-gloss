import { injectable, inject } from 'tsyringe';
import type { ICategoriaServicioRepository } from '../../../domain/ports/ICategoriaServicioRepository';
import { NotFoundError } from '../../../../../shared/errors';

interface DeleteCategoriaInput {
  salonId: number;
  id: number;
}

interface DeleteCategoriaOutput {
  success: boolean;
  warning?: string;
}

@injectable()
export class DeleteCategoriaUseCase {
  constructor(
    @inject('ICategoriaServicioRepository') private readonly categoriaRepo: ICategoriaServicioRepository,
  ) {}

  async execute(input: DeleteCategoriaInput): Promise<DeleteCategoriaOutput> {
    const categoria = await this.categoriaRepo.findBySalonAndId(input.salonId, input.id);
    if (!categoria) {
      throw new NotFoundError('Categoría no encontrada');
    }

    const activeServicios = await this.categoriaRepo.countActiveServicios(input.id);
    const result: DeleteCategoriaOutput = { success: false };

    if (activeServicios > 0) {
      result.warning = `Esta categoría tiene ${activeServicios} servicio(s) activo(s). Se eliminará la categoría pero los servicios permanecerán.`;
    }

    const deleted = await this.categoriaRepo.softDelete(input.id);
    result.success = deleted;

    return result;
  }
}
