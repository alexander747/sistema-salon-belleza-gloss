import { injectable, inject } from 'tsyringe';
import type { ICategoriaServicioRepository } from '../../../domain/ports/ICategoriaServicioRepository';
import { CategoriaServicioDTO } from '../../dtos/CategoriaServicioDTO';
import { ConflictError } from '../../../../../shared/errors';

interface CreateCategoriaInput {
  salonId: number;
  nombre: string;
  descripcion?: string;
  emoji?: string;
  orden?: number;
}

@injectable()
export class CreateCategoriaUseCase {
  constructor(
    @inject('ICategoriaServicioRepository') private readonly categoriaRepo: ICategoriaServicioRepository,
  ) {}

  async execute(input: CreateCategoriaInput): Promise<CategoriaServicioDTO> {
    // Check duplicate name per salon
    const existing = await this.categoriaRepo.findByNameAndSalon(input.nombre, input.salonId);
    if (existing) {
      throw new ConflictError(`Ya existe una categoría con el nombre "${input.nombre}" en este salón`);
    }

    const categoria = await this.categoriaRepo.create({
      nombre: input.nombre,
      descripcion: input.descripcion ?? undefined,
      emoji: input.emoji ?? undefined,
      orden: input.orden ?? 0,
      salonId: input.salonId,
      activo: true,
    });

    return CategoriaServicioDTO.fromEntity(categoria);
  }
}
