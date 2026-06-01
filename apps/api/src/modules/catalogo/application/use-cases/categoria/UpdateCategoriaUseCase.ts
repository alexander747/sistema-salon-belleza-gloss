import { injectable, inject } from 'tsyringe';
import type { ICategoriaServicioRepository } from '../../../domain/ports/ICategoriaServicioRepository';
import { CategoriaServicioDTO } from '../../dtos/CategoriaServicioDTO';
import { NotFoundError, ConflictError } from '../../../../../shared/errors';

interface UpdateCategoriaInput {
  salonId: number;
  id: number;
  nombre?: string;
  descripcion?: string;
  emoji?: string;
  orden?: number;
}

@injectable()
export class UpdateCategoriaUseCase {
  constructor(
    @inject('ICategoriaServicioRepository') private readonly categoriaRepo: ICategoriaServicioRepository,
  ) {}

  async execute(input: UpdateCategoriaInput): Promise<CategoriaServicioDTO> {
    const categoria = await this.categoriaRepo.findBySalonAndId(input.salonId, input.id);
    if (!categoria) {
      throw new NotFoundError('Categoría no encontrada');
    }

    // If renaming, check duplicate per salon
    if (input.nombre && input.nombre !== categoria.nombre) {
      const existing = await this.categoriaRepo.findByNameAndSalon(input.nombre, input.salonId);
      if (existing && existing.id !== input.id) {
        throw new ConflictError(`Ya existe una categoría con el nombre "${input.nombre}" en este salón`);
      }
    }

    const updated = await this.categoriaRepo.update(input.id, {
      ...(input.nombre !== undefined && { nombre: input.nombre }),
      ...(input.descripcion !== undefined && { descripcion: input.descripcion }),
      ...(input.emoji !== undefined && { emoji: input.emoji }),
      ...(input.orden !== undefined && { orden: input.orden }),
    });

    return CategoriaServicioDTO.fromEntity(updated!);
  }
}
